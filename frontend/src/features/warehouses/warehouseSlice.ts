import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';
import type { Warehouse } from '../../types';

export interface WarehouseInput {
  code: string;
  name: string;
  city: string;
}

interface WarehouseState {
  items: Warehouse[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: WarehouseState = {
  items: [],
  loading: false,
  saving: false,
  error: null,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const fetchWarehouses = createAsyncThunk(
  'warehouses/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<Warehouse[]>(
        '/warehouses?includeInactive=true',
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const createWarehouse = createAsyncThunk(
  'warehouses/create',
  async (data: WarehouseInput, { rejectWithValue }) => {
    try {
      const response = await api.post<Warehouse>('/warehouses', data);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateWarehouse = createAsyncThunk(
  'warehouses/update',
  async (
    { id, data }: { id: string; data: Partial<WarehouseInput> },
    { rejectWithValue },
  ) => {
    try {
      const response = await api.patch<Warehouse>(`/warehouses/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const deactivateWarehouse = createAsyncThunk(
  'warehouses/deactivate',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.delete<Warehouse>(`/warehouses/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const reactivateWarehouse = createAsyncThunk(
  'warehouses/reactivate',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.patch<Warehouse>(`/warehouses/${id}`, {
        isActive: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const warehouseSlice = createSlice({
  name: 'warehouses',
  initialState,
  reducers: {
    clearWarehouseError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWarehouses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWarehouses.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchWarehouses.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload ?? action.error.message);
      })
      .addCase(createWarehouse.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createWarehouse.fulfilled, (state, action) => {
        state.saving = false;
        state.items.unshift(action.payload);
      })
      .addCase(createWarehouse.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })
      .addCase(updateWarehouse.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateWarehouse.fulfilled, (state, action) => {
        state.saving = false;
        const index = state.items.findIndex(
          (item) => item.id === action.payload.id,
        );
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(updateWarehouse.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })
      .addCase(deactivateWarehouse.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(deactivateWarehouse.fulfilled, (state, action) => {
        state.saving = false;
        const index = state.items.findIndex(
          (item) => item.id === action.payload.id,
        );
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(deactivateWarehouse.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })
      .addCase(reactivateWarehouse.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(reactivateWarehouse.fulfilled, (state, action) => {
        state.saving = false;
        const index = state.items.findIndex(
          (item) => item.id === action.payload.id,
        );
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(reactivateWarehouse.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      });
  },
});

export const { clearWarehouseError } = warehouseSlice.actions;
export default warehouseSlice.reducer;
