
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

interface SupplyReceipt {
  id: string;
  receiptId: string;
  remainingQuantity: number;
  expectedArrivalTime: Date;
}

interface SupplyPool {
  skuId: string;
  warehouseId: string;
  onHandRemaining: number;
  safetyStockDeficit: number;
  receipts: SupplyReceipt[];
}

@Injectable()
export class AllocationService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlan() {
    const now = new Date();

    // Use a stable UTC planning date for deterministic promises.
    const planningDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );

    const [orders, warehouses, inventories, receipts] =
      await Promise.all([
        this.prisma.order.findMany({
          where: {
            status: {
              in: ['CONFIRMED', 'FULFILLING'],
            },
          },
          include: {
            lines: {
              include: {
                sku: true,
                preferredWarehouse: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        }),

        this.prisma.warehouse.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
        }),

        this.prisma.inventory.findMany(),

        this.prisma.inboundReceipt.findMany({
          where: {
            status: {
              in: ['PLANNED', 'IN_TRANSIT'],
            },
          },
          orderBy: [
            { expectedArrivalTime: 'asc' },
            { receiptId: 'asc' },
          ],
        }),
      ]);

    // Build a mutable supply pool for each SKU and warehouse.
    const pools = new Map<string, SupplyPool>();

    const getPool = (skuId: string, warehouseId: string) => {
      const key = `${skuId}::${warehouseId}`;

      let pool = pools.get(key);

      if (!pool) {
        pool = {
          skuId,
          warehouseId,
          onHandRemaining: 0,
          safetyStockDeficit: 0,
          receipts: [],
        };

        pools.set(key, pool);
      }

      return pool;
    };

    // Protect safety stock from customer order allocation.
    for (const inventory of inventories) {
      const pool = getPool(
        inventory.skuId,
        inventory.warehouseId,
      );

      pool.onHandRemaining = Math.max(
        0,
        inventory.onHandQuantity - inventory.safetyStock,
      );

      // Incoming stock must replenish this deficit first.
      pool.safetyStockDeficit = Math.max(
        0,
        inventory.safetyStock - inventory.onHandQuantity,
      );
    }

    for (const receipt of receipts) {
      getPool(
        receipt.skuId,
        receipt.warehouseId,
      ).receipts.push({
        id: receipt.id,
        receiptId: receipt.receiptId,
        remainingQuantity: receipt.quantity,
        expectedArrivalTime: receipt.expectedArrivalTime,
      });
    }

    // HIGH first, then MED, then LOW.
    const priorityRank = {
      HIGH: 1,
      MED: 2,
      LOW: 3,
    };

    orders.sort((a, b) => {
      const priorityDifference =
        priorityRank[a.priority] - priorityRank[b.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const createdDifference =
        a.createdAt.getTime() - b.createdAt.getTime();

      if (createdDifference !== 0) {
        return createdDifference;
      }

      return a.orderNumber.localeCompare(b.orderNumber);
    });

    const plan = [];

    for (const order of orders) {
      const linePlans = [];

      for (const line of order.lines) {
        let remainingDemand = line.quantity;
        const allocations = [];
        const usedWarehouseIds = new Set<string>();
        let latestSupplyDate: Date | null = null;

        // Preferred warehouse first, followed by other active warehouses.
        const orderedWarehouses = [...warehouses];

        if (line.preferredWarehouseId) {
          orderedWarehouses.sort((a, b) => {
            if (a.id === line.preferredWarehouseId) return -1;
            if (b.id === line.preferredWarehouseId) return 1;
            return a.code.localeCompare(b.code);
          });
        }

        for (const warehouse of orderedWarehouses) {
          if (remainingDemand <= 0) break;

          const pool = getPool(line.skuId, warehouse.id);

          // Consume available on-hand inventory above safety stock.
          const onHandAllocated = Math.min(
            remainingDemand,
            pool.onHandRemaining,
          );

          if (onHandAllocated > 0) {
            pool.onHandRemaining -= onHandAllocated;
            remainingDemand -= onHandAllocated;

            usedWarehouseIds.add(warehouse.id);

            allocations.push({
              warehouseId: warehouse.id,
              warehouseCode: warehouse.code,
              source: 'ON_HAND',
              quantity: onHandAllocated,
              receiptId: null,
              expectedArrivalTime: null,
            });
          }

          // Consume future inbound receipts in ETA order.
          for (const receipt of pool.receipts) {
            if (remainingDemand <= 0) break;
            if (receipt.remainingQuantity <= 0) continue;

            // Replenish the safety-stock deficit before promising
            // any incoming quantity to customer orders.
            if (pool.safetyStockDeficit > 0) {
              const replenishmentQuantity = Math.min(
                pool.safetyStockDeficit,
                receipt.remainingQuantity,
              );

              receipt.remainingQuantity -= replenishmentQuantity;
              pool.safetyStockDeficit -= replenishmentQuantity;
            }

            if (receipt.remainingQuantity <= 0) continue;

            const receiptAllocated = Math.min(
              remainingDemand,
              receipt.remainingQuantity,
            );

            receipt.remainingQuantity -= receiptAllocated;
            remainingDemand -= receiptAllocated;

            usedWarehouseIds.add(warehouse.id);

            allocations.push({
              warehouseId: warehouse.id,
              warehouseCode: warehouse.code,
              source: 'INBOUND_RECEIPT',
              quantity: receiptAllocated,
              receiptId: receipt.receiptId,
              expectedArrivalTime: receipt.expectedArrivalTime,
            });

            if (
              !latestSupplyDate ||
              receipt.expectedArrivalTime > latestSupplyDate
            ) {
              latestSupplyDate = receipt.expectedArrivalTime;
            }
          }
        }

        const allocatedQuantity = line.quantity - remainingDemand;
        const backorderedQuantity = remainingDemand;

        const promisedShipDate =
          backorderedQuantity > 0
            ? null
            : latestSupplyDate && latestSupplyDate > planningDate
              ? latestSupplyDate
              : planningDate;

        const requestedShipDate = order.requestedShipDate;

        const isLate =
          promisedShipDate !== null &&
          requestedShipDate !== null &&
          promisedShipDate > requestedShipDate;

        let promiseReason = 'Fulfilled from available on-hand inventory.';

        if (backorderedQuantity > 0) {
          promiseReason =
            'Insufficient on-hand and inbound supply to cover the full quantity.';
        } else if (latestSupplyDate) {
          promiseReason =
            'Fulfillment depends on inbound inventory.';
        }

        linePlans.push({
          orderLineId: line.id,
          skuId: line.skuId,
          skuCode: line.sku.skuCode,
          skuName: line.sku.name,
          requestedQuantity: line.quantity,
          allocatedQuantity,
          backorderedQuantity,
          fulfillmentWarehouseIds: [...usedWarehouseIds],
          allocations,
          requestedShipDate,
          promisedShipDate,
          isLate,
          promiseReason,
        });
      }

      plan.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        priority: order.priority,
        status: order.status,
        requestedShipDate: order.requestedShipDate,
        lines: linePlans,
      });
    }

    return {
      generatedAt: now,
      allocationMethod: 'DETERMINISTIC_RECOMPUTATION',
      orderCount: plan.length,
      orders: plan,
    };
  }

  async getAtp() {
    // Reuse the allocation plan so active order demand is deducted consistently.
    const plan = await this.getPlan();

    const [inventories, receipts] = await Promise.all([
      this.prisma.inventory.findMany({
        include: {
          sku: true,
          warehouse: true,
        },
      }),

      this.prisma.inboundReceipt.findMany({
        where: {
          status: {
            in: ['PLANNED', 'IN_TRANSIT'],
          },
        },
        include: {
          sku: true,
          warehouse: true,
        },
        orderBy: [
          { expectedArrivalTime: 'asc' },
          { receiptId: 'asc' },
        ],
      }),
    ]);

    const pools = new Map<
      string,
      {
        skuId: string;
        skuCode: string;
        skuName: string;
        warehouseId: string;
        warehouseCode: string;
        onHandQuantity: number;
        safetyStock: number;
        allocatedOnHand: number;
        receipts: {
          receiptId: string;
          expectedArrivalTime: Date;
          quantity: number;
          allocatedQuantity: number;
        }[];
      }
    >();

    const getPool = (
      sku: { id: string; skuCode: string; name: string },
      warehouse: { id: string; code: string },
    ) => {
      const key = `${sku.id}::${warehouse.id}`;

      let pool = pools.get(key);

      if (!pool) {
        pool = {
          skuId: sku.id,
          skuCode: sku.skuCode,
          skuName: sku.name,
          warehouseId: warehouse.id,
          warehouseCode: warehouse.code,
          onHandQuantity: 0,
          safetyStock: 0,
          allocatedOnHand: 0,
          receipts: [],
        };

        pools.set(key, pool);
      }

      return pool;
    };

    // Load on-hand inventory and safety stock from active warehouses.
    for (const inventory of inventories) {
      if (!inventory.warehouse.isActive) continue;

      const pool = getPool(inventory.sku, inventory.warehouse);

      pool.onHandQuantity = inventory.onHandQuantity;
      pool.safetyStock = inventory.safetyStock;
    }

    // Load only planned and in-transit receipts.
    for (const receipt of receipts) {
      if (!receipt.warehouse.isActive) continue;

      const pool = getPool(receipt.sku, receipt.warehouse);

      pool.receipts.push({
        receiptId: receipt.receiptId,
        expectedArrivalTime: receipt.expectedArrivalTime,
        quantity: receipt.quantity,
        allocatedQuantity: 0,
      });
    }

    // Deduct supply already assigned to active orders.
    for (const order of plan.orders) {
      for (const line of order.lines) {
        for (const allocation of line.allocations) {
          const pool = pools.get(
            `${line.skuId}::${allocation.warehouseId}`,
          );

          if (!pool) continue;

          if (allocation.source === 'ON_HAND') {
            pool.allocatedOnHand += allocation.quantity;
          } else if (allocation.source === 'INBOUND_RECEIPT') {
            const receipt = pool.receipts.find(
              (item) => item.receiptId === allocation.receiptId,
            );

            if (receipt) {
              receipt.allocatedQuantity += allocation.quantity;
            }
          }
        }
      }
    }

    const atp = [...pools.values()]
      .sort(
        (a, b) =>
          a.skuCode.localeCompare(b.skuCode) ||
          a.warehouseCode.localeCompare(b.warehouseCode),
      )
      .map((pool) => {
        // Available now excludes both active allocations and safety stock.
        const availableNow = Math.max(
          0,
          pool.onHandQuantity -
            pool.allocatedOnHand -
            pool.safetyStock,
        );

        // Keep the unallocated supply balance before subtracting
        // safety stock, so future receipts can replenish its deficit.
        let projectedSupply =
          pool.onHandQuantity - pool.allocatedOnHand;

        const futureReceipts = pool.receipts
          .map((receipt) => ({
            receiptId: receipt.receiptId,
            expectedArrivalTime: receipt.expectedArrivalTime,
            quantity: receipt.quantity,
            allocatedQuantity: receipt.allocatedQuantity,
            remainingQuantity: Math.max(
              0,
              receipt.quantity - receipt.allocatedQuantity,
            ),
          }))
          .filter((receipt) => receipt.remainingQuantity > 0)
          .sort(
            (a, b) =>
              a.expectedArrivalTime.getTime() -
                b.expectedArrivalTime.getTime() ||
              a.receiptId.localeCompare(b.receiptId),
          );

        const projectedAtp = futureReceipts.map((receipt) => {
          projectedSupply += receipt.remainingQuantity;

          return {
            asOf: receipt.expectedArrivalTime,
            receiptId: receipt.receiptId,
            projectedAvailableQuantity: Math.max(
              0,
              projectedSupply - pool.safetyStock,
            ),
          };
        });

        return {
          skuId: pool.skuId,
          skuCode: pool.skuCode,
          skuName: pool.skuName,
          warehouseId: pool.warehouseId,
          warehouseCode: pool.warehouseCode,
          onHandQuantity: pool.onHandQuantity,
          allocatedOnHandQuantity: pool.allocatedOnHand,
          safetyStock: pool.safetyStock,
          availableNow,
          futureReceipts,
          projectedAtp,
        };
      });

    return {
      generatedAt: new Date(),
      calculationMethod: 'NET_OF_ACTIVE_ORDER_ALLOCATIONS_AND_SAFETY_STOCK',
      locationCount: new Set(
        atp.map((item) => item.warehouseId),
      ).size,
      itemCount: atp.length,
      atp,
    };
  }
}
