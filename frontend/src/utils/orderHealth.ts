import type { Tone } from '../components/ui/Badge';
import type { AllocationOrder } from '../types';

export type OrderRisk = 'SHORT' | 'LATE' | 'INBOUND' | 'ON_TRACK';

export const RISK_META: Record<
  OrderRisk,
  { label: string; tone: Tone; rank: number; description: string }
> = {
  SHORT: {
    label: 'Short',
    tone: 'danger',
    rank: 0,
    description: 'Some quantity cannot be covered by on-hand or inbound supply.',
  },
  LATE: {
    label: 'Late',
    tone: 'warning',
    rank: 1,
    description: 'The promised ship date is after the requested date.',
  },
  INBOUND: {
    label: 'Awaiting inbound',
    tone: 'info',
    rank: 2,
    description: 'Covered, but part of the order waits on an inbound receipt.',
  },
  ON_TRACK: {
    label: 'On track',
    tone: 'success',
    rank: 3,
    description: 'Fully covered by on-hand stock and not late.',
  },
};

export interface OrderHealth {
  requested: number;
  allocated: number;
  fromOnHand: number;
  fromInbound: number;
  backordered: number;
  late: boolean;
  /** Latest line promise, or null when any line has no promise. */
  promisedShipDate: string | null;
  risk: OrderRisk;
}

/**
 * Summarize an order's allocation plan. Only CONFIRMED and FULFILLING
 * orders are in the plan, so other orders return null.
 */
export function getOrderHealth(
  planOrder: AllocationOrder | null | undefined,
): OrderHealth | null {
  if (!planOrder) return null;

  let requested = 0;
  let allocated = 0;
  let fromOnHand = 0;
  let fromInbound = 0;
  let backordered = 0;
  let late = false;
  let promised: string | null = null;
  let anyUnpromised = false;

  for (const line of planOrder.lines) {
    requested += line.requestedQuantity;
    allocated += line.allocatedQuantity;
    backordered += line.backorderedQuantity;
    late = late || line.isLate;

    for (const allocation of line.allocations) {
      if (allocation.source === 'ON_HAND') {
        fromOnHand += allocation.quantity;
      } else {
        fromInbound += allocation.quantity;
      }
    }

    if (!line.promisedShipDate) {
      anyUnpromised = true;
    } else if (!promised || line.promisedShipDate > promised) {
      promised = line.promisedShipDate;
    }
  }

  const risk: OrderRisk =
    backordered > 0
      ? 'SHORT'
      : late
        ? 'LATE'
        : fromInbound > 0
          ? 'INBOUND'
          : 'ON_TRACK';

  return {
    requested,
    allocated,
    fromOnHand,
    fromInbound,
    backordered,
    late,
    promisedShipDate: anyUnpromised ? null : promised,
    risk,
  };
}
