import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';
import type {
  InboundReceipt,
} from '../../types';

export interface CreateReceiptInput {
  receiptId: string;
  skuId: string;
  warehouseId: string;
  expectedArrivalTime: string;
  quantity: number;
}

export interface UpdateReceiptInput {
  expectedArrivalTime?: string;
  quantity?: number;
}

interface UpdateReceiptArgs {
  id: string;
  data: UpdateReceiptInput;
}

interface UpdateReceiptStatusArgs {
  id: string;
  status: 'IN_TRANSIT' | 'CANCELED';
}

interface SupplyState {
  items: InboundReceipt[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: SupplyState = {
  items: [],
  loading: false,
  saving: false,
  error: null,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const fetchReceipts = createAsyncThunk(
  'supply/fetchReceipts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<InboundReceipt[]>('/inbound-receipts');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const createReceipt = createAsyncThunk(
  'supply/createReceipt',
  async (data: CreateReceiptInput, { rejectWithValue }) => {
    try {
      const response = await api.post<InboundReceipt>(
        '/inbound-receipts',
        data,
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateReceipt = createAsyncThunk(
  'supply/updateReceipt',
  async ({ id, data }: UpdateReceiptArgs, { rejectWithValue }) => {
    try {
      const response = await api.patch<InboundReceipt>(
        `/inbound-receipts/${id}`,
        data,
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateReceiptStatus = createAsyncThunk(
  'supply/updateReceiptStatus',
  async ({ id, status }: UpdateReceiptStatusArgs, { rejectWithValue }) => {
    try {
      const response = await api.patch<InboundReceipt>(
        `/inbound-receipts/${id}/status`,
        { status },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const receiveReceipt = createAsyncThunk(
  'supply/receiveReceipt',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.post<InboundReceipt>(
        `/inbound-receipts/${id}/receive`,
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const supplySlice = createSlice({
  name: 'supply',
  initialState,
  reducers: {
    clearSupplyError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReceipts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReceipts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchReceipts.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(createReceipt.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createReceipt.fulfilled, (state, action) => {
        state.saving = false;
        state.items = [action.payload, ...state.items];
      })
      .addCase(createReceipt.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(updateReceipt.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateReceipt.fulfilled, (state, action) => {
        state.saving = false;
        state.items = state.items.map((receipt) =>
          receipt.id === action.payload.id ? action.payload : receipt,
        );
      })
      .addCase(updateReceipt.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(updateReceiptStatus.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateReceiptStatus.fulfilled, (state, action) => {
        state.saving = false;
        state.items = state.items.map((receipt) =>
          receipt.id === action.payload.id ? action.payload : receipt,
        );
      })
      .addCase(updateReceiptStatus.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      })

      .addCase(receiveReceipt.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(receiveReceipt.fulfilled, (state, action) => {
        state.saving = false;
        state.items = state.items.map((receipt) =>
          receipt.id === action.payload.id ? action.payload : receipt,
        );
      })
      .addCase(receiveReceipt.rejected, (state, action) => {
        state.saving = false;
        state.error = String(action.payload ?? action.error.message);
      });
  },
});

export const { clearSupplyError } = supplySlice.actions;

export default supplySlice.reducer;
