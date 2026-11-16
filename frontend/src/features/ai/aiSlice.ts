import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';
import { getAiErrorMessage } from './aiErrors';

export interface ExceptionSummaryResponse {
  generatedAt: string;
  exceptionCount: number;
  summary: string;
}

export interface CustomerCommunicationResponse {
  orderId: string;
  orderNumber: string;
  customerName: string;
  generatedAt: string;
  draft: string;
}

interface AiState {
  exceptionSummary: ExceptionSummaryResponse | null;
  customerCommunication: CustomerCommunicationResponse | null;
  summaryLoading: boolean;
  communicationLoading: boolean;
  summaryError: string | null;
  communicationError: string | null;
}

const initialState: AiState = {
  exceptionSummary: null,
  customerCommunication: null,
  summaryLoading: false,
  communicationLoading: false,
  summaryError: null,
  communicationError: null,
};

/**
 * The backend bounds each AI call (all Gemini attempts and retries) to 100s
 * (GEMINI_TOTAL_BUDGET_MS in backend ai.service.ts). This client timeout must
 * stay above that so the backend's specific error (503 high demand,
 * 504 timeout, 429 quota) reaches the UI instead of a generic Axios timeout,
 * and so the UI never re-enables the button while the backend is still
 * waiting on Gemini.
 */
const AI_REQUEST_TIMEOUT_MS = 110_000;


export const generateExceptionSummary = createAsyncThunk<
  ExceptionSummaryResponse,
  void,
  { state: { ai: AiState }; rejectValue: string }
>(
  'ai/generateExceptionSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post<ExceptionSummaryResponse>(
        '/ai/exception-summary',
        {},
        { timeout: AI_REQUEST_TIMEOUT_MS },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getAiErrorMessage(error));
    }
  },
  {
    // Ignore new requests while one is already in flight (double clicks,
    // re-mounts, multiple callers). Nothing is dispatched when skipped.
    condition: (_, { getState }) => !getState().ai.summaryLoading,
  },
);

export const generateCustomerCommunication = createAsyncThunk<
  CustomerCommunicationResponse,
  string,
  { state: { ai: AiState }; rejectValue: string }
>(
  'ai/generateCustomerCommunication',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await api.post<CustomerCommunicationResponse>(
        `/ai/customer-communication/${orderId}`,
        {},
        { timeout: AI_REQUEST_TIMEOUT_MS },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getAiErrorMessage(error));
    }
  },
  {
    condition: (_, { getState }) => !getState().ai.communicationLoading,
  },
);

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    clearAiErrors(state) {
      state.summaryError = null;
      state.communicationError = null;
    },
    clearCustomerCommunication(state) {
      state.customerCommunication = null;
      state.communicationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateExceptionSummary.pending, (state) => {
        state.summaryLoading = true;
        state.summaryError = null;
        state.exceptionSummary = null;
      })
      .addCase(generateExceptionSummary.fulfilled, (state, action) => {
        state.summaryLoading = false;
        state.exceptionSummary = action.payload;
      })
      .addCase(generateExceptionSummary.rejected, (state, action) => {
        state.summaryLoading = false;
        state.summaryError = String(
          action.payload ?? action.error.message,
        );
      })

      .addCase(generateCustomerCommunication.pending, (state) => {
        state.communicationLoading = true;
        state.communicationError = null;
        state.customerCommunication = null;
      })
      .addCase(generateCustomerCommunication.fulfilled, (state, action) => {
        state.communicationLoading = false;
        state.customerCommunication = action.payload;
      })
      .addCase(generateCustomerCommunication.rejected, (state, action) => {
        state.communicationLoading = false;
        state.communicationError = String(
          action.payload ?? action.error.message,
        );
      });
  },
});

export const {
  clearAiErrors,
  clearCustomerCommunication,
} = aiSlice.actions;

export default aiSlice.reducer;
