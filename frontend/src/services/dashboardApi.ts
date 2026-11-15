import api from './api';
import type {
  Order,
  InboundReceipt,
  Inventory,
  AllocationPlan,
  ATPResponse,
  ExceptionsResponse,
  Sku,
  Warehouse,
} from '../types';

export const dashboardApi = {
  getSkus: async () => {
    const response = await api.get<Sku[]>('/skus');
    return response.data;
  },

  getWarehouses: async () => {
    const response = await api.get<Warehouse[]>('/warehouses');
    return response.data;
  },

  getInventory: async () => {
    const response = await api.get<Inventory[]>('/inventory');
    return response.data;
  },

  getOrders: async () => {
    const response = await api.get<Order[]>('/orders');
    return response.data;
  },

  getReceipts: async () => {
    const response = await api.get<InboundReceipt[]>('/inbound-receipts');
    return response.data;
  },

  getAllocationPlan: async () => {
    const response = await api.get<AllocationPlan>('/allocation/plan');
    return response.data;
  },

  getAtp: async () => {
    const response = await api.get<ATPResponse>('/allocation/atp');
    return response.data;
  },

  getExceptions: async () => {
    const response = await api.get<ExceptionsResponse>('/exceptions');
    return response.data;
  },
};
