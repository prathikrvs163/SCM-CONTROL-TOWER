import { configureStore } from '@reduxjs/toolkit';
import dashboardReducer from '../features/dashboard/dashboardSlice';
import skuReducer from '../features/skus/skuSlice';
import warehouseReducer from '../features/warehouses/warehouseSlice';
import inventoryReducer from '../features/inventory/inventorySlice';
import orderReducer from '../features/orders/orderSlice';

export const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    skus: skuReducer,
    warehouses: warehouseReducer,
    inventory: inventoryReducer,
    orders: orderReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
