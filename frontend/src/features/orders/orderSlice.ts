import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';
import type {
  AllocationPlan,
  CreateOrderInput,
  Order,
  OrderStatusUpdate,
  OrderTimeline,
  UpdateOrderInput,
} from '../../types';

interface UpdateOrderArgs {
  id: string;
  data: UpdateOrderInput;
}

interface UpdateOrderStatusArgs {
  id: string;
  status: OrderStatusUpdate;
}

interface OrdersState {
  items: Order[];
  timeline: OrderTimeline | null;
  allocationPlan: AllocationPlan | null;
  loading: boolean;
  saving: boolean;
  timelineLoading: boolean;
  planLoading: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  items: [],
  timeline: null,
  allocationPlan: null,
  loading: false,
  saving: false,
  timelineLoading: false,
  planLoading: false,
  error: null,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const fetchOrders = createAsyncThunk(
  'orders/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<Order[]>('/orders');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const createOrder = createAsyncThunk(
  'orders/create',
  async (data: CreateOrderInput, { rejectWithValue }) => {
    try {
      const response = await api.post<Order>('/orders', data);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateOrder = createAsyncThunk(
  'orders/update',
  async ({ id, data }: UpdateOrderArgs, { rejectWithValue }) => {
    try {
      const response = await api.patch<Order>(`/orders/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async ({ id, status }: UpdateOrderStatusArgs, { rejectWithValue }) => {
    try {
      const response = await api.patch<Order>(`/orders/${id}/status`, {
        status,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchOrderTimeline = createAsyncThunk(
  'orders/fetchTimeline',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.get<OrderTimeline>(`/orders/${id}/timeline`);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchAllocationPlan = createAsyncThunk(
  'orders/fetchAllocationPlan',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<AllocationPlan>('/allocation/plan');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearOrderError(state) {
      state.error = null;
    },
    clearOrderTimeline(state) {
      state.timeline = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(createOrder.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.saving = false;
        state.items = [action.payload, ...state.items];
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(updateOrder.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateOrder.fulfilled, (state, action) => {
        state.saving = false;
        state.items = state.items.map((order) =>
          order.id === action.payload.id ? action.payload : order,
        );
      })
      .addCase(updateOrder.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(updateOrderStatus.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        state.saving = false;
        state.items = state.items.map((order) =>
          order.id === action.payload.id ? action.payload : order,
        );
      })
      .addCase(updateOrderStatus.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(fetchOrderTimeline.pending, (state) => {
        state.timelineLoading = true;
        state.error = null;
      })
      .addCase(fetchOrderTimeline.fulfilled, (state, action) => {
        state.timelineLoading = false;
        state.timeline = action.payload;
      })
      .addCase(fetchOrderTimeline.rejected, (state, action) => {
        state.timelineLoading = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(fetchAllocationPlan.pending, (state) => {
        state.planLoading = true;
        state.error = null;
      })
      .addCase(fetchAllocationPlan.fulfilled, (state, action) => {
        state.planLoading = false;
        state.allocationPlan = action.payload;
      })
      .addCase(fetchAllocationPlan.rejected, (state, action) => {
        state.planLoading = false;
        state.error = String(action.payload ?? action.error.message);
      });
  },
});

export const { clearOrderError, clearOrderTimeline } = orderSlice.actions;

export default orderSlice.reducer;
