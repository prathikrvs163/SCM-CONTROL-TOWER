export type Priority = 'LOW' | 'MED' | 'HIGH';

export type OrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'FULFILLING'
  | 'SHIPPED'
  | 'CANCELED';

export type ReceiptStatus =
  | 'PLANNED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'CANCELED';

export type ExceptionType =
  | 'BACKORDER'
  | 'LATE_PROMISE'
  | 'INBOUND_DEPENDENCY';

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Sku {
  id: string;
  skuCode: string;
  name: string;
  description: string | null;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  city: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Inventory {
  skuId: string;
  warehouseId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  safetyStock: number;
  updatedAt: string;
  sku: Sku;
  warehouse: Warehouse;
}

export interface InventoryAdjustment {
  id: string;
  skuId: string;
  warehouseId: string;
  quantityChange: number;
  reason: string;
  createdAt: string;
  sku: Sku;
  warehouse: Warehouse;
}

export interface OrderLine {
  id: string;
  orderId: string;
  skuId: string;
  quantity: number;
  preferredWarehouseId: string | null;
  sku: Sku;
  preferredWarehouse: Warehouse | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  priority: Priority;
  requestedShipDate: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
}

export interface InboundReceipt {
  id: string;
  receiptId: string;
  skuId: string;
  warehouseId: string;
  expectedArrivalTime: string;
  quantity: number;
  status: ReceiptStatus;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sku: Sku;
  warehouse: Warehouse;
}

export interface Allocation {
  warehouseId: string;
  warehouseCode: string;
  source: 'ON_HAND' | 'INBOUND_RECEIPT';
  quantity: number;
  receiptId: string | null;
  expectedArrivalTime: string | null;
}

export interface AllocationLine {
  orderLineId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  backorderedQuantity: number;
  fulfillmentWarehouseIds: string[];
  allocations: Allocation[];
  requestedShipDate: string | null;
  promisedShipDate: string | null;
  isLate: boolean;
  promiseReason: string;
}

export interface AllocationOrder {
  orderId: string;
  orderNumber: string;
  customerName: string;
  priority: Priority;
  status: OrderStatus;
  requestedShipDate: string | null;
  lines: AllocationLine[];
}

export interface AllocationPlan {
  generatedAt: string;
  allocationMethod: string;
  orderCount: number;
  orders: AllocationOrder[];
}

export interface ATPRecord {
  skuId: string;
  skuCode: string;
  skuName: string;
  warehouseId: string;
  warehouseCode: string;
  onHandQuantity: number;
  allocatedOnHandQuantity: number;
  availableNow: number;
  futureReceipts: unknown[];
  projectedAtp: unknown[];
}

export interface ATPResponse {
  generatedAt: string;
  calculationMethod: string;
  locationCount: number;
  itemCount: number;
  atp: ATPRecord[];
}

export interface SupplyException {
  orderId: string;
  orderNumber: string;
  customerName: string;
  priority: Priority;
  status: OrderStatus;
  type: ExceptionType;
  severity: Severity;
  skuId: string;
  skuCode: string;
  affectedQuantity: number;
  reason: string;
  requestedShipDate: string | null;
  promisedShipDate: string | null;
}

export interface ExceptionsResponse {
  generatedAt: string;
  totalExceptions: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  exceptions: SupplyException[];
}
