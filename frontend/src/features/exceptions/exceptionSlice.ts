import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';
import type {
  ExceptionType,
  ExceptionsResponse,
  Severity,
} from '../../types';

export interface ExceptionFilters {
  severity?: Severity | '';
  type?: ExceptionType | '';
}

interface ExceptionsState {
  data: ExceptionsResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: ExceptionsState = {
  data: null,
  loading: false,
  error: null,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const fetchExceptions = createAsyncThunk(
  'exceptions/fetchExceptions',
  async (filters: ExceptionFilters = {}, { rejectWithValue }) => {
    try {
      const params: Record<string, string> = {};

      if (filters.severity) {
        params.severity = filters.severity;
      }

      if (filters.type) {
        params.type = filters.type;
      }

      const response = await api.get<ExceptionsResponse>('/exceptions', {
        params,
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const exceptionSlice = createSlice({
  name: 'exceptions',
  initialState,
  reducers: {
    clearExceptionError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExceptions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExceptions.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchExceptions.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload ?? action.error.message);
      });
  },
});

export const { clearExceptionError } = exceptionSlice.actions;

export default exceptionSlice.reducer;
