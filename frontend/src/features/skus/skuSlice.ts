
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';
import type { Sku } from '../../types';

export interface SkuInput {
  skuCode: string;
  name: string;
  description?: string;
  unit?: string;
}

interface SkuState {
  items: Sku[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: SkuState = {
  items: [],
  loading: false,
  saving: false,
  error: null,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const fetchSkus = createAsyncThunk(
  'skus/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<Sku[]>('/skus?includeInactive=true');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const createSku = createAsyncThunk(
  'skus/create',
  async (data: SkuInput, { rejectWithValue }) => {
    try {
      const response = await api.post<Sku>('/skus', data);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateSku = createAsyncThunk(
  'skus/update',
  async (
    { id, data }: { id: string; data: Partial<SkuInput> },
    { rejectWithValue },
  ) => {
    try {
      const response = await api.patch<Sku>(`/skus/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const deactivateSku = createAsyncThunk(
  'skus/deactivate',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.delete<Sku>(`/skus/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const reactivateSku = createAsyncThunk(
  'skus/reactivate',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.patch<Sku>(`/skus/${id}`, {
        isActive: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const skuSlice = createSlice({
  name: 'skus',
  initialState,
  reducers: {
    clearSkuError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSkus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSkus.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchSkus.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(createSku.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createSku.fulfilled, (state, action) => {
        state.saving = false;
        state.items.unshift(action.payload);
      })
      .addCase(createSku.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(updateSku.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateSku.fulfilled, (state, action) => {
        state.saving = false;
        const index = state.items.findIndex(
          (sku) => sku.id === action.payload.id,
        );
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(updateSku.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(deactivateSku.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(deactivateSku.fulfilled, (state, action) => {
        state.saving = false;
        const index = state.items.findIndex(
          (sku) => sku.id === action.payload.id,
        );
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(deactivateSku.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(reactivateSku.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(reactivateSku.fulfilled, (state, action) => {
        state.saving = false;
        const index = state.items.findIndex(
          (sku) => sku.id === action.payload.id,
        );
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(reactivateSku.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      });
  },
});

export const { clearSkuError } = skuSlice.actions;
export default skuSlice.reducer;
