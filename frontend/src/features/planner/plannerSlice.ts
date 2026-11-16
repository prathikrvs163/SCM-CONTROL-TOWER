import {
  createAsyncThunk,
  createSlice,
  isFulfilled,
  isPending,
  isRejected,
} from '@reduxjs/toolkit';
import api from '../../services/api';
import type { InboundReceipt, Order, SplitOrderResult } from '../../types';

interface PlannerState {
  saving: boolean;
  error: string | null;
}

const initialState: PlannerState = {
  saving: false,
  error: null,
};

type PlannerThunkConfig = {
  state: { planner: PlannerState };
  rejectValue: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

// One planner action at a time: a second click while saving is ignored.
const notSaving = (_: unknown, { getState }: { getState: () => { planner: PlannerState } }) =>
  !getState().planner.saving;

export interface ExpediteReceiptArgs {
  receiptId: string;
  expectedArrivalTime: string;
  reason: string;
}

export const expediteReceipt = createAsyncThunk<
  InboundReceipt,
  ExpediteReceiptArgs,
  PlannerThunkConfig
>(
  'planner/expediteReceipt',
  async ({ receiptId, ...body }, { rejectWithValue }) => {
    try {
      const response = await api.post<InboundReceipt>(
        `/planner-actions/receipts/${receiptId}/expedite`,
        body,
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
  { condition: notSaving },
);

export interface ReassignLineArgs {
  orderLineId: string;
  warehouseId: string;
  reason: string;
}

export const reassignOrderLine = createAsyncThunk<
  Order,
  ReassignLineArgs,
  PlannerThunkConfig
>(
  'planner/reassignOrderLine',
  async ({ orderLineId, ...body }, { rejectWithValue }) => {
    try {
      const response = await api.post<Order>(
        `/planner-actions/order-lines/${orderLineId}/reassign`,
        body,
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
  { condition: notSaving },
);

export interface OverridePromiseArgs {
  orderLineId: string;
  /** null clears the override. */
  promisedShipDate: string | null;
  reason: string;
}

export const overridePromiseDate = createAsyncThunk<
  Order,
  OverridePromiseArgs,
  PlannerThunkConfig
>(
  'planner/overridePromiseDate',
  async ({ orderLineId, ...body }, { rejectWithValue }) => {
    try {
      const response = await api.post<Order>(
        `/planner-actions/order-lines/${orderLineId}/promise-override`,
        body,
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
  { condition: notSaving },
);

export interface SplitOrderArgs {
  orderId: string;
  lines: { orderLineId: string; quantity: number }[];
  reason: string;
}

export const splitOrder = createAsyncThunk<
  SplitOrderResult,
  SplitOrderArgs,
  PlannerThunkConfig
>(
  'planner/splitOrder',
  async ({ orderId, ...body }, { rejectWithValue }) => {
    try {
      const response = await api.post<SplitOrderResult>(
        `/planner-actions/orders/${orderId}/split`,
        body,
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
  { condition: notSaving },
);

const plannerThunks = [
  expediteReceipt,
  reassignOrderLine,
  overridePromiseDate,
  splitOrder,
] as const;

const plannerSlice = createSlice({
  name: 'planner',
  initialState,
  reducers: {
    clearPlannerError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(isPending(...plannerThunks), (state) => {
        state.saving = true;
        state.error = null;
      })
      .addMatcher(isFulfilled(...plannerThunks), (state) => {
        state.saving = false;
      })
      .addMatcher(isRejected(...plannerThunks), (state, action) => {
        state.saving = false;
        state.error =
          typeof action.payload === 'string'
            ? action.payload
            : (action.error.message ?? 'Something went wrong');
      });
  },
});

export const { clearPlannerError } = plannerSlice.actions;

export default plannerSlice.reducer;
