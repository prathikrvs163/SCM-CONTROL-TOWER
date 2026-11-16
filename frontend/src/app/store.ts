import { configureStore } from '@reduxjs/toolkit';
import dashboardReducer from '../features/dashboard/dashboardSlice';
import skuReducer from '../features/skus/skuSlice';
import warehouseReducer from '../features/warehouses/warehouseSlice';
import inventoryReducer from '../features/inventory/inventorySlice';
import orderReducer from '../features/orders/orderSlice';
import supplyReducer from '../features/supply/supplySlice';
import exceptionReducer from '../features/exceptions/exceptionSlice';
import aiReducer from '../features/ai/aiSlice';
import auditReducer from '../features/audit/auditSlice';
import plannerReducer from '../features/planner/plannerSlice';

export const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    skus: skuReducer,
    warehouses: warehouseReducer,
    inventory: inventoryReducer,
    orders: orderReducer,
    supply: supplyReducer,
    exceptions: exceptionReducer,
    ai: aiReducer,
    audit: auditReducer,
    planner: plannerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
