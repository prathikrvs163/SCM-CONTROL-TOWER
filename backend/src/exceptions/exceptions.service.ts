import { Injectable } from '@nestjs/common';
import { AllocationService } from '../allocation/allocation.service.js';

type ExceptionSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

type ExceptionType =
  | 'BACKORDER'
  | 'LATE_PROMISE'
  | 'INBOUND_DEPENDENCY';

interface ExceptionFilters {
  severity?: string;
  type?: string;
}

@Injectable()
export class ExceptionsService {
  constructor(
    private readonly allocationService: AllocationService,
  ) {}

  async findAll(filters: ExceptionFilters = {}) {
    const plan = await this.allocationService.getPlan();
    const exceptions = [];

    for (const order of plan.orders) {
      for (const line of order.lines) {
        const hasBackorder = line.backorderedQuantity > 0;

        const hasLatePromise = line.isLate;

        const hasInboundDependency = line.allocations.some(
          (allocation) => allocation.source === 'INBOUND_RECEIPT',
        );

        const baseSeverity: ExceptionSeverity =
          order.priority === 'HIGH' ? 'HIGH' : 'MEDIUM';

        if (hasBackorder) {
          exceptions.push({
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            priority: order.priority,
            status: order.status,
            type: 'BACKORDER' as ExceptionType,
            severity: baseSeverity,
            skuId: line.skuId,
            skuCode: line.skuCode,
            affectedQuantity: line.backorderedQuantity,
            reason: line.promiseReason,
            requestedShipDate: line.requestedShipDate,
            promisedShipDate: line.promisedShipDate,
          });
        }

        if (hasLatePromise) {
          exceptions.push({
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            priority: order.priority,
            status: order.status,
            type: 'LATE_PROMISE' as ExceptionType,
            severity: baseSeverity,
            skuId: line.skuId,
            skuCode: line.skuCode,
            affectedQuantity: line.requestedQuantity,
            reason: 'Promised ship date is later than the requested ship date.',
            requestedShipDate: line.requestedShipDate,
            promisedShipDate: line.promisedShipDate,
          });
        }

        if (hasInboundDependency) {
          exceptions.push({
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            priority: order.priority,
            status: order.status,
            type: 'INBOUND_DEPENDENCY' as ExceptionType,
            severity: 'LOW' as ExceptionSeverity,
            skuId: line.skuId,
            skuCode: line.skuCode,
            affectedQuantity: line.allocations
              .filter(
                (allocation) =>
                  allocation.source === 'INBOUND_RECEIPT',
              )
              .reduce(
                (total, allocation) => total + allocation.quantity,
                0,
              ),
            reason: 'Order fulfillment depends on inbound inventory.',
            requestedShipDate: line.requestedShipDate,
            promisedShipDate: line.promisedShipDate,
          });
        }
      }
    }

    const filteredExceptions = exceptions.filter((exception) => {
      const severityMatches =
        !filters.severity || exception.severity === filters.severity;

      const typeMatches =
        !filters.type || exception.type === filters.type;

      return severityMatches && typeMatches;
    });

    const severityRank = {
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };

    filteredExceptions.sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        a.orderNumber.localeCompare(b.orderNumber) ||
        a.skuCode.localeCompare(b.skuCode),
    );

    return {
      generatedAt: new Date(),
      totalExceptions: filteredExceptions.length,
      highCount: filteredExceptions.filter(
        (item) => item.severity === 'HIGH',
      ).length,
      mediumCount: filteredExceptions.filter(
        (item) => item.severity === 'MEDIUM',
      ).length,
      lowCount: filteredExceptions.filter(
        (item) => item.severity === 'LOW',
      ).length,
      exceptions: filteredExceptions,
    };
  }
}
