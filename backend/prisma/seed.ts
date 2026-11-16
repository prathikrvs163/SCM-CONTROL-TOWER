import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.js";

// --------------------------------------------------
// Prisma connection
// --------------------------------------------------

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

const url = new URL(databaseUrl);

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.slice(1)),
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

// Derive record types from the generated Prisma client.
type WarehouseRecord = Awaited<
  ReturnType<typeof prisma.warehouse.upsert>
>;

type SkuRecord = Awaited<
  ReturnType<typeof prisma.sKU.upsert>
>;

type WarehouseSeed = {
  code: string;
  name: string;
  city: string;
};

type SkuSeed = {
  skuCode: string;
  name: string;
  description: string;
  unit: string;
};

function daysFromNow(days: number): Date {
  const date = new Date();

  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);

  return date;
}

// --------------------------------------------------
// Warehouse seed data
// --------------------------------------------------

const warehouseData: WarehouseSeed[] = [
  {
    code: "DEMO-WH-HYD",
    name: "Hyderabad Distribution Center",
    city: "Hyderabad",
  },
  {
    code: "DEMO-WH-CHN",
    name: "Chennai Distribution Center",
    city: "Chennai",
  },
  {
    code: "DEMO-WH-BLR",
    name: "Bengaluru Distribution Center",
    city: "Bengaluru",
  },
];

// --------------------------------------------------
// SKU seed data
// --------------------------------------------------

const skuData: SkuSeed[] = [
  {
    skuCode: "DEMO-LAP-001",
    name: "Business Laptop",
    description: "14-inch business laptop",
    unit: "EA",
  },
  {
    skuCode: "DEMO-MON-001",
    name: "LED Monitor",
    description: "24-inch LED monitor",
    unit: "EA",
  },
  {
    skuCode: "DEMO-KEY-001",
    name: "Wireless Keyboard",
    description: "Wireless office keyboard",
    unit: "EA",
  },
  {
    skuCode: "DEMO-MOU-001",
    name: "Wireless Mouse",
    description: "Wireless optical mouse",
    unit: "EA",
  },
  {
    skuCode: "DEMO-DCK-001",
    name: "USB-C Dock",
    description: "USB-C docking station",
    unit: "EA",
  },
  {
    skuCode: "DEMO-PRN-001",
    name: "Office Printer",
    description: "Network laser printer",
    unit: "EA",
  },
  {
    skuCode: "DEMO-RTR-001",
    name: "Network Router",
    description: "Enterprise network router",
    unit: "EA",
  },
  {
    skuCode: "DEMO-HDS-001",
    name: "Business Headset",
    description: "USB business headset",
    unit: "EA",
  },
  {
    skuCode: "DEMO-WEB-001",
    name: "HD Webcam",
    description: "1080p USB webcam",
    unit: "EA",
  },
  {
    skuCode: "DEMO-SSD-001",
    name: "External SSD",
    description: "1TB external solid-state drive",
    unit: "EA",
  },
  {
    skuCode: "DEMO-RAM-001",
    name: "RAM Module",
    description: "16GB memory module",
    unit: "EA",
  },
  {
    skuCode: "DEMO-CBL-001",
    name: "USB-C Cable",
    description: "USB-C connectivity cable",
    unit: "EA",
  },
];

// --------------------------------------------------
// Inventory seed data
// Quantity order: Hyderabad, Chennai, Bengaluru.
//
// Keyboard at Hyderabad starts with 15 units.
// DEMO-RCV-004 adds 25 received units.
// Final keyboard stock at Hyderabad = 40.
// --------------------------------------------------

const inventoryData = [
  {
    skuCode: "DEMO-LAP-001",
    quantities: [10, 8, 5],
    safetyStock: 2,
  },
  {
    skuCode: "DEMO-MON-001",
    quantities: [8, 5, 7],
    safetyStock: 2,
  },
  {
    skuCode: "DEMO-KEY-001",
    quantities: [15, 10, 10],
    safetyStock: 5,
  },
  {
    skuCode: "DEMO-MOU-001",
    quantities: [15, 12, 10],
    safetyStock: 3,
  },
  {
    skuCode: "DEMO-DCK-001",
    quantities: [8, 6, 5],
    safetyStock: 2,
  },
  {
    skuCode: "DEMO-PRN-001",
    quantities: [4, 3, 2],
    safetyStock: 1,
  },
  {
    skuCode: "DEMO-RTR-001",
    quantities: [5, 4, 3],
    safetyStock: 2,
  },
  {
    skuCode: "DEMO-HDS-001",
    quantities: [12, 8, 8],
    safetyStock: 2,
  },
  {
    skuCode: "DEMO-WEB-001",
    quantities: [8, 5, 5],
    safetyStock: 2,
  },
  {
    skuCode: "DEMO-SSD-001",
    quantities: [10, 5, 5],
    safetyStock: 2,
  },
  {
    skuCode: "DEMO-RAM-001",
    quantities: [8, 5, 5],
    safetyStock: 2,
  },
  {
    skuCode: "DEMO-CBL-001",
    quantities: [20, 15, 10],
    safetyStock: 5,
  },
];

// --------------------------------------------------
// Inbound receipt seed data
// --------------------------------------------------

const receiptData = [
  {
    receiptId: "DEMO-RCV-001",
    skuCode: "DEMO-LAP-001",
    warehouseCode: "DEMO-WH-HYD",
    quantity: 20,
    status: "PLANNED",
    arrivalInDays: 4,
  },
  {
    receiptId: "DEMO-RCV-002",
    skuCode: "DEMO-MON-001",
    warehouseCode: "DEMO-WH-CHN",
    quantity: 30,
    status: "IN_TRANSIT",
    arrivalInDays: 10,
  },
  {
    receiptId: "DEMO-RCV-003",
    skuCode: "DEMO-RTR-001",
    warehouseCode: "DEMO-WH-BLR",
    quantity: 15,
    status: "CANCELED",
    arrivalInDays: 2,
  },
  {
    receiptId: "DEMO-RCV-004",
    skuCode: "DEMO-KEY-001",
    warehouseCode: "DEMO-WH-HYD",
    quantity: 25,
    status: "RECEIVED",
    arrivalInDays: -1,
  },
] as const;

// --------------------------------------------------
// Customer order seed data
// --------------------------------------------------

const orderData = [
  {
    orderNumber: "DEMO-ORD-001",
    customerName: "Apex Systems",
    priority: "HIGH",
    lines: [
      {
        skuCode: "DEMO-LAP-001",
        quantity: 15,
        warehouseCode: "DEMO-WH-HYD",
      },
      {
        skuCode: "DEMO-MON-001",
        quantity: 6,
        warehouseCode: "DEMO-WH-CHN",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-002",
    customerName: "Northstar Technologies",
    priority: "HIGH",
    lines: [
      {
        skuCode: "DEMO-LAP-001",
        quantity: 12,
        warehouseCode: "DEMO-WH-HYD",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-003",
    customerName: "Vertex Networks",
    priority: "HIGH",
    lines: [
      {
        skuCode: "DEMO-RTR-001",
        quantity: 10,
        warehouseCode: "DEMO-WH-BLR",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-004",
    customerName: "Bluepeak Consulting",
    priority: "HIGH",
    lines: [
      {
        skuCode: "DEMO-MON-001",
        quantity: 18,
        warehouseCode: "DEMO-WH-CHN",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-005",
    customerName: "Summit Office Solutions",
    priority: "HIGH",
    lines: [
      {
        skuCode: "DEMO-KEY-001",
        quantity: 20,
        warehouseCode: "DEMO-WH-HYD",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-006",
    customerName: "Pioneer Digital",
    priority: "HIGH",
    lines: [
      {
        skuCode: "DEMO-SSD-001",
        quantity: 5,
        warehouseCode: "DEMO-WH-BLR",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-007",
    customerName: "Evergreen Services",
    priority: "MED",
    lines: [
      {
        skuCode: "DEMO-LAP-001",
        quantity: 10,
        warehouseCode: "DEMO-WH-HYD",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-008",
    customerName: "Cloudline Systems",
    priority: "MED",
    lines: [
      {
        skuCode: "DEMO-MON-001",
        quantity: 12,
        warehouseCode: "DEMO-WH-CHN",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-009",
    customerName: "Metro IT Services",
    priority: "MED",
    lines: [
      {
        skuCode: "DEMO-RTR-001",
        quantity: 8,
        warehouseCode: "DEMO-WH-BLR",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-010",
    customerName: "Crestview Enterprises",
    priority: "MED",
    lines: [
      {
        skuCode: "DEMO-KEY-001",
        quantity: 15,
        warehouseCode: "DEMO-WH-HYD",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-011",
    customerName: "Brightpath Technologies",
    priority: "MED",
    lines: [
      {
        skuCode: "DEMO-DCK-001",
        quantity: 10,
        warehouseCode: "DEMO-WH-HYD",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-012",
    customerName: "Redwood Business Group",
    priority: "MED",
    lines: [
      {
        skuCode: "DEMO-PRN-001",
        quantity: 4,
        warehouseCode: "DEMO-WH-CHN",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-013",
    customerName: "Silverline Tech",
    priority: "MED",
    lines: [
      {
        skuCode: "DEMO-RAM-001",
        quantity: 8,
        warehouseCode: "DEMO-WH-BLR",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-014",
    customerName: "Oakwood Solutions",
    priority: "LOW",
    lines: [
      {
        skuCode: "DEMO-LAP-001",
        quantity: 8,
        warehouseCode: "DEMO-WH-HYD",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-015",
    customerName: "Clearwater Systems",
    priority: "LOW",
    lines: [
      {
        skuCode: "DEMO-MON-001",
        quantity: 10,
        warehouseCode: "DEMO-WH-CHN",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-016",
    customerName: "Westbridge Networks",
    priority: "LOW",
    lines: [
      {
        skuCode: "DEMO-RTR-001",
        quantity: 5,
        warehouseCode: "DEMO-WH-BLR",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-017",
    customerName: "Greenfield Office",
    priority: "LOW",
    lines: [
      {
        skuCode: "DEMO-WEB-001",
        quantity: 6,
        warehouseCode: "DEMO-WH-HYD",
      },
    ],
  },
  {
    orderNumber: "DEMO-ORD-018",
    customerName: "UrbanEdge Technologies",
    priority: "LOW",
    lines: [
      {
        skuCode: "DEMO-CBL-001",
        quantity: 20,
        warehouseCode: "DEMO-WH-CHN",
      },
    ],
  },
] as const;

// --------------------------------------------------
// Catalog seeding
// --------------------------------------------------

async function getOrCreateWarehouse(data: WarehouseSeed) {
  return prisma.warehouse.upsert({
    where: {
      code: data.code,
    },
    update: {},
    create: data,
  });
}

async function getOrCreateSku(data: SkuSeed) {
  return prisma.sKU.upsert({
    where: {
      skuCode: data.skuCode,
    },
    update: {},
    create: data,
  });
}

async function seedCatalog() {
  const warehouses = new Map<string, WarehouseRecord>();
  const skus = new Map<string, SkuRecord>();

  for (const data of warehouseData) {
    const warehouse = await getOrCreateWarehouse(data);
    warehouses.set(data.code, warehouse);
  }

  for (const data of skuData) {
    const sku = await getOrCreateSku(data);
    skus.set(data.skuCode, sku);
  }

  console.log(`Warehouses available: ${warehouses.size}`);
  console.log(`SKUs available: ${skus.size}`);

  return { warehouses, skus };
}

// --------------------------------------------------
// Inventory seeding
// --------------------------------------------------

async function seedInventory(
  warehouses: Map<string, WarehouseRecord>,
  skus: Map<string, SkuRecord>,
) {
  let createdCount = 0;
  let skippedCount = 0;

  for (const row of inventoryData) {
    const sku = skus.get(row.skuCode);

    if (!sku) {
      throw new Error(`SKU not found: ${row.skuCode}`);
    }

    for (let index = 0; index < warehouseData.length; index += 1) {
      const warehouse = warehouses.get(warehouseData[index].code);

      if (!warehouse) {
        throw new Error(
          `Warehouse not found: ${warehouseData[index].code}`,
        );
      }

      const quantity = row.quantities[index];

      const existing = await prisma.inventory.findUnique({
        where: {
          skuId_warehouseId: {
            skuId: sku.id,
            warehouseId: warehouse.id,
          },
        },
      });

      if (existing) {
        skippedCount += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.inventory.create({
          data: {
            skuId: sku.id,
            warehouseId: warehouse.id,
            onHandQuantity: quantity,
            reservedQuantity: 0,
            safetyStock: row.safetyStock,
          },
        });

        if (quantity > 0) {
          await tx.inventoryAdjustment.create({
            data: {
              skuId: sku.id,
              warehouseId: warehouse.id,
              quantityChange: quantity,
              reason: "Demo seed opening balance",
            },
          });
        }
      });

      createdCount += 1;
    }
  }

  console.log(`Inventory balances created: ${createdCount}`);
  console.log(`Existing inventory balances skipped: ${skippedCount}`);
}

// --------------------------------------------------
// Inbound receipt seeding
// --------------------------------------------------

async function seedReceipts(
  warehouses: Map<string, WarehouseRecord>,
  skus: Map<string, SkuRecord>,
) {
  let createdCount = 0;
  let skippedCount = 0;

  for (const receipt of receiptData) {
    const existing = await prisma.inboundReceipt.findUnique({
      where: {
        receiptId: receipt.receiptId,
      },
    });

    if (existing) {
      skippedCount += 1;
      continue;
    }

    const sku = skus.get(receipt.skuCode);
    const warehouse = warehouses.get(receipt.warehouseCode);

    if (!sku || !warehouse) {
      throw new Error(
        `Missing SKU or warehouse for receipt ${receipt.receiptId}`,
      );
    }

    if (receipt.status === "RECEIVED") {
      // Create the receipt, increase stock and record the adjustment
      // atomically. A rerun skips this receipt and cannot add stock twice.
      await prisma.$transaction(async (tx) => {
        await tx.inboundReceipt.create({
          data: {
            receiptId: receipt.receiptId,
            skuId: sku.id,
            warehouseId: warehouse.id,
            quantity: receipt.quantity,
            status: "RECEIVED",
            expectedArrivalTime: daysFromNow(receipt.arrivalInDays),
            receivedAt: daysFromNow(-1),
          },
        });

        await tx.inventory.update({
          where: {
            skuId_warehouseId: {
              skuId: sku.id,
              warehouseId: warehouse.id,
            },
          },
          data: {
            onHandQuantity: {
              increment: receipt.quantity,
            },
          },
        });

        await tx.inventoryAdjustment.create({
          data: {
            skuId: sku.id,
            warehouseId: warehouse.id,
            quantityChange: receipt.quantity,
            reason: `Inbound receipt received: ${receipt.receiptId}`,
          },
        });
      });
    } else {
      await prisma.inboundReceipt.create({
        data: {
          receiptId: receipt.receiptId,
          skuId: sku.id,
          warehouseId: warehouse.id,
          quantity: receipt.quantity,
          status: receipt.status,
          expectedArrivalTime: daysFromNow(receipt.arrivalInDays),
        },
      });
    }

    createdCount += 1;
  }

  console.log(`Inbound receipts created: ${createdCount}`);
  console.log(`Existing receipts skipped: ${skippedCount}`);
}

// --------------------------------------------------
// Order seeding
// --------------------------------------------------

async function seedOrders(
  warehouses: Map<string, WarehouseRecord>,
  skus: Map<string, SkuRecord>,
) {
  let createdCount = 0;
  let skippedCount = 0;

  for (let index = 0; index < orderData.length; index += 1) {
    const order = orderData[index];

    const existing = await prisma.order.findUnique({
      where: {
        orderNumber: order.orderNumber,
      },
    });

    if (existing) {
      skippedCount += 1;
      continue;
    }

    const createdAt = new Date(
      Date.now() - (orderData.length - index) * 60_000,
    );

    const lines = order.lines.map((line) => {
      const sku = skus.get(line.skuCode);
      const warehouse = warehouses.get(line.warehouseCode);

      if (!sku || !warehouse) {
        throw new Error(
          `Missing SKU or warehouse for order ${order.orderNumber}`,
        );
      }

      return {
        skuId: sku.id,
        quantity: line.quantity,
        preferredWarehouseId: warehouse.id,
      };
    });

    await prisma.order.create({
      data: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        priority: order.priority,
        status: "CONFIRMED",
        requestedShipDate: daysFromNow(5),
        createdAt,
        lines: {
          create: lines,
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: "CONFIRMED",
            changedAt: createdAt,
          },
        },
      },
    });

    createdCount += 1;
  }

  console.log(`Orders created: ${createdCount}`);
  console.log(`Existing orders skipped: ${skippedCount}`);
}

// --------------------------------------------------
// Main seed function
// --------------------------------------------------

async function main() {
  console.log("Starting SCM demo data seed...");

  const { warehouses, skus } = await seedCatalog();

  await seedInventory(warehouses, skus);
  await seedReceipts(warehouses, skus);
  await seedOrders(warehouses, skus);

  console.log("----------------------------------------");
  console.log("SCM demo data seed completed.");
  console.log("Expected demo records:");
  console.log("- 3 warehouses");
  console.log("- 12 SKUs");
  console.log("- 36 inventory balances");
  console.log("- 4 inbound receipts");
  console.log("- 18 confirmed orders");
  console.log("----------------------------------------");
}

// --------------------------------------------------
// Execute and disconnect
// --------------------------------------------------

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
