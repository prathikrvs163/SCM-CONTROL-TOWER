import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../services/api';
import plannerReducer from './plannerSlice';
import OrderPlannerPanel from './OrderPlannerPanel';
import type { OrderPlannerAction } from './OrderPlannerPanel';
import type { Order, Warehouse } from '../../types';

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

const warehouse = (id: string, code: string): Warehouse => ({
  id,
  code,
  name: `${code} warehouse`,
  city: code,
  isActive: true,
  createdAt: '',
  updatedAt: '',
});

const warehouses = [warehouse('wh-hyd', 'HYD'), warehouse('wh-chn', 'CHN')];

const order: Order = {
  id: 'order-1',
  orderNumber: 'SO-1',
  customerName: 'Acme Retail',
  priority: 'HIGH',
  requestedShipDate: null,
  status: 'CONFIRMED',
  splitFromOrderId: null,
  createdAt: '',
  updatedAt: '',
  lines: [
    {
      id: 'line-1',
      orderId: 'order-1',
      skuId: 'sku-1',
      quantity: 10,
      preferredWarehouseId: 'wh-hyd',
      promisedShipDateOverride: null,
      promiseOverrideReason: null,
      sku: {
        id: 'sku-1',
        skuCode: 'SKU-A',
        name: 'Widget',
        description: null,
        unit: 'EA',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      preferredWarehouse: warehouses[0],
    },
  ],
};

function renderPanel(action: OrderPlannerAction) {
  const store = configureStore({ reducer: { planner: plannerReducer } });
  const onCompleted = vi.fn();

  render(
    <Provider store={store}>
      <OrderPlannerPanel
        order={order}
        planOrder={null}
        warehouses={warehouses}
        action={action}
        onClose={vi.fn()}
        onCompleted={onCompleted}
      />
    </Provider>,
  );

  return { onCompleted };
}

describe('OrderPlannerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a reason before sending a planner action', async () => {
    const user = userEvent.setup();
    renderPanel({ kind: 'reassign', orderLineId: 'line-1' });

    await user.selectOptions(screen.getByLabelText(/New warehouse/), 'wh-chn');
    // Bypass the browser's required check to exercise our own validation.
    await user.type(screen.getByLabelText(/Reason/), 'ab');
    await user.click(
      screen.getByRole('button', { name: 'Reassign fulfillment location' }),
    );

    expect(
      screen.getByText('Enter a reason of at least 3 characters.'),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('does not offer the current warehouse as a reassignment target', () => {
    renderPanel({ kind: 'reassign', orderLineId: 'line-1' });

    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['Select warehouse', 'CHN — CHN warehouse']);
  });

  it('reassigns a line and reports the updated order', async () => {
    const user = userEvent.setup();
    const updated = { ...order };
    vi.mocked(api.post).mockResolvedValue({ data: updated } as never);
    const { onCompleted } = renderPanel({
      kind: 'reassign',
      orderLineId: 'line-1',
    });

    await user.selectOptions(screen.getByLabelText(/New warehouse/), 'wh-chn');
    await user.type(screen.getByLabelText(/Reason/), 'HYD dock closed');
    await user.click(
      screen.getByRole('button', { name: 'Reassign fulfillment location' }),
    );

    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith(
      '/planner-actions/order-lines/line-1/reassign',
      { warehouseId: 'wh-chn', reason: 'HYD dock closed' },
    );
    expect(onCompleted).toHaveBeenCalledWith(
      'SKU-A on SO-1 now ships from CHN first.',
      updated,
    );
  });

  it('blocks a split that moves more than the line quantity', async () => {
    const user = userEvent.setup();
    renderPanel({ kind: 'split' });

    const quantity = screen.getByLabelText('Units of SKU-A to move');
    await user.type(quantity, '11');
    await user.type(screen.getByLabelText(/Reason/), 'Ship what we have');
    await user.click(screen.getByRole('button', { name: 'Split shipment' }));

    // The input's max blocks submission before the request is sent.
    expect(quantity).toBeInvalid();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the backend error when the action is rejected', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue(
      new Error('Order status changed since it was loaded; reload and retry'),
    );
    const { onCompleted } = renderPanel({ kind: 'split' });

    await user.type(screen.getByLabelText('Units of SKU-A to move'), '4');
    await user.type(screen.getByLabelText(/Reason/), 'Ship what we have');
    await user.click(screen.getByRole('button', { name: 'Split shipment' }));

    expect(
      await screen.findByText(
        'Order status changed since it was loaded; reload and retry',
      ),
    ).toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
