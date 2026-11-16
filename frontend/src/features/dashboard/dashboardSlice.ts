import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { dashboardApi } from '../../services/dashboardApi';
import type {
  Sku,
  Warehouse,
  Inventory,
  Order,
  InboundReceipt,
  AllocationPlan,
  ATPResponse,
  ExceptionsResponse,
} from '../../types';

interface DashboardState {
  skus: Sku[];
  warehouses: Warehouse[];
  inventory: Inventory[];
  orders: Order[];
  receipts: InboundReceipt[];
  allocation: AllocationPlan | null;
  atp: ATPResponse | null;
  exceptions: ExceptionsResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: DashboardState = {
  skus: [],
  warehouses: [],
  inventory: [],
  orders: [],
  receipts: [],
  allocation: null,
  atp: null,
  exceptions: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

export const fetchDashboard = createAsyncThunk(
  'dashboard/fetchDashboard',
  async () => {
    const [
      skus,
      warehouses,
      inventory,
      orders,
      receipts,
      allocation,
      atp,
      exceptions,
    ] = await Promise.all([
      dashboardApi.getSkus(),
      dashboardApi.getWarehouses(),
      dashboardApi.getInventory(),
      dashboardApi.getOrders(),
      dashboardApi.getReceipts(),
      dashboardApi.getAllocationPlan(),
      dashboardApi.getAtp(),
      dashboardApi.getExceptions(),
    ]);

    return {
      skus,
      warehouses,
      inventory,
      orders,
      receipts,
      allocation,
      atp,
      exceptions,
    };
  },
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        Object.assign(state, action.payload);
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load dashboard';
      });
  },
});

export default dashboardSlice.reducer;
