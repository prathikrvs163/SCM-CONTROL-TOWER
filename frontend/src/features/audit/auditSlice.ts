import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';
import type { AuditEntityType, AuditLogEntry } from '../../types';

export interface AuditLogFilters {
  entityType?: AuditEntityType;
  entityId?: string;
  limit?: number;
}

interface AuditState {
  /** Entries for the Audit Log page. */
  items: AuditLogEntry[];
  loading: boolean;
  error: string | null;
  /** Activity for the order open in the Orders page. */
  orderActivity: AuditLogEntry[];
  orderActivityId: string | null;
  orderActivityLoading: boolean;
}

const initialState: AuditState = {
  items: [],
  loading: false,
  error: null,
  orderActivity: [],
  orderActivityId: null,
  orderActivityLoading: false,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const fetchAuditLogs = createAsyncThunk<
  AuditLogEntry[],
  AuditLogFilters | undefined,
  { rejectValue: string }
>('audit/fetchAll', async (filters, { rejectWithValue }) => {
  try {
    const response = await api.get<AuditLogEntry[]>('/audit-logs', {
      params: { limit: 200, ...filters },
    });
    return response.data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const fetchOrderActivity = createAsyncThunk<
  AuditLogEntry[],
  string,
  { rejectValue: string }
>('audit/fetchOrderActivity', async (orderId, { rejectWithValue }) => {
  try {
    const response = await api.get<AuditLogEntry[]>('/audit-logs', {
      params: { entityType: 'ORDER', entityId: orderId, limit: 50 },
    });
    return response.data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error.message ?? null;
      })

      .addCase(fetchOrderActivity.pending, (state, action) => {
        state.orderActivityLoading = true;
        if (state.orderActivityId !== action.meta.arg) {
          state.orderActivity = [];
        }
        state.orderActivityId = action.meta.arg;
      })
      .addCase(fetchOrderActivity.fulfilled, (state, action) => {
        // Ignore a late response for an order that is no longer open.
        if (state.orderActivityId !== action.meta.arg) return;
        state.orderActivityLoading = false;
        state.orderActivity = action.payload;
      })
      .addCase(fetchOrderActivity.rejected, (state, action) => {
        if (state.orderActivityId !== action.meta.arg) return;
        state.orderActivityLoading = false;
        state.orderActivity = [];
      });
  },
});

export default auditSlice.reducer;
