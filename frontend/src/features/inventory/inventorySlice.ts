import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';
import type { Inventory, InventoryAdjustment } from '../../types';

export interface InventoryAdjustmentInput {
  skuId: string;
  warehouseId: string;
  quantityChange: number;
  reason: string;
}

interface AdjustmentFilters {
  skuId?: string;
  warehouseId?: string;
}

interface InventoryState {
  items: Inventory[];
  adjustments: InventoryAdjustment[];
  loading: boolean;
  historyLoading: boolean;
  saving: boolean;
  error: string | null;
  historyError: string | null;
}

const initialState: InventoryState = {
  items: [],
  adjustments: [],
  loading: false,
  historyLoading: false,
  saving: false,
  error: null,
  historyError: null,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const fetchInventory = createAsyncThunk(
  'inventory/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<Inventory[]>('/inventory');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchAdjustmentHistory = createAsyncThunk(
  'inventory/fetchAdjustmentHistory',
  async (filters: AdjustmentFilters = {}, { rejectWithValue }) => {
    try {
      const response = await api.get<InventoryAdjustment[]>(
        '/inventory/adjustments',
        { params: filters },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const createInventoryAdjustment = createAsyncThunk(
  'inventory/createAdjustment',
  async (data: InventoryAdjustmentInput, { rejectWithValue }) => {
    try {
      const response = await api.post<Inventory>(
        '/inventory/adjustments',
        data,
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    clearInventoryError(state) {
      state.error = null;
    },
    clearHistoryError(state) {
      state.historyError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload ?? action.error.message);
      })
      .addCase(fetchAdjustmentHistory.pending, (state) => {
        state.historyLoading = true;
        state.historyError = null;
      })
      .addCase(fetchAdjustmentHistory.fulfilled, (state, action) => {
        state.historyLoading = false;
        state.adjustments = action.payload;
      })
      .addCase(fetchAdjustmentHistory.rejected, (state, action) => {
        state.historyLoading = false;
        state.historyError = String(
          action.payload ?? action.error.message,
        );
      })
      .addCase(createInventoryAdjustment.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createInventoryAdjustment.fulfilled, (state, action) => {
        state.saving = false;

        const index = state.items.findIndex(
          (item) =>
            item.skuId === action.payload.skuId &&
            item.warehouseId === action.payload.warehouseId,
        );

        if (index >= 0) {
          state.items[index] = action.payload;
        } else {
          state.items.push(action.payload);
        }
      })
      .addCase(createInventoryAdjustment.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      });
  },
});

export const { clearInventoryError, clearHistoryError } =
  inventorySlice.actions;

export default inventorySlice.reducer;
