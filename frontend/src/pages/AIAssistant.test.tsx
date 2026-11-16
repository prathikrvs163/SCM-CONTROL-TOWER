import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../services/api';
import aiReducer from '../features/ai/aiSlice';
import orderReducer from '../features/orders/orderSlice';
import AIAssistant from './AIAssistant';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockOrder = {
  id: 'order-123',
  orderNumber: 'SCM-TEST-001',
  customerName: 'Test Customer',
  status: 'CONFIRMED',
};

const createTestStore = () =>
  configureStore({
    reducer: {
      ai: aiReducer,
      orders: orderReducer,
    },
  });

function renderPage() {
  const store = createTestStore();

  render(
    <Provider store={store}>
      <AIAssistant />
    </Provider>,
  );

  return store;
}

describe('AIAssistant page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both AI features', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [mockOrder],
    } as never);

    renderPage();

    expect(
      screen.getByRole('heading', { name: 'AI Assistant' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Exception Summary' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Customer Communication' }),
    ).toBeInTheDocument();

    await screen.findByRole('option', {
      name: /SCM-TEST-001/,
    });
  });

  it('generates and displays an exception summary', async () => {
    const user = userEvent.setup();

    vi.mocked(api.get).mockResolvedValue({
      data: [mockOrder],
    } as never);

    vi.mocked(api.post).mockResolvedValue({
      data: {
        generatedAt: '2026-11-16T10:00:00Z',
        exceptionCount: 2,
        summary: 'Two supply chain exceptions need attention.',
      },
    } as never);

    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Generate Summary' }),
    );

    expect(
      await screen.findByText(
        'Two supply chain exceptions need attention.',
      ),
    ).toBeInTheDocument();

    expect(api.post).toHaveBeenCalledWith(
      '/ai/exception-summary',
      {},
      { timeout: 110000 },
    );
  });

  it('generates a customer communication for the selected order', async () => {
    const user = userEvent.setup();

    vi.mocked(api.get).mockResolvedValue({
      data: [mockOrder],
    } as never);

    vi.mocked(api.post).mockResolvedValue({
      data: {
        orderId: 'order-123',
        orderNumber: 'SCM-TEST-001',
        customerName: 'Test Customer',
        generatedAt: '2026-11-16T10:00:00Z',
        draft: 'Your order is being processed.',
      },
    } as never);

    renderPage();

    await screen.findByRole('option', {
       name: /SCM-TEST-001/,
    });

    await user.selectOptions(
        screen.getByLabelText('Select order'),
        'order-123',
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Generate Customer Draft',
      }),
    );

    expect(
      await screen.findByText('Your order is being processed.'),
    ).toBeInTheDocument();

    expect(api.post).toHaveBeenCalledWith(
      '/ai/customer-communication/order-123',
      {},
      { timeout: 110000 },
    );
  });

  it('displays an AI error when summary generation fails', async () => {
    const user = userEvent.setup();

    vi.mocked(api.get).mockResolvedValue({
      data: [mockOrder],
    } as never);

    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error('Quota exhausted'), {
        errorCode: 'GEMINI_QUOTA_EXHAUSTED',
      }),
    );

    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Generate Summary' }),
    );

    expect(
      await screen.findByText(
        'Gemini daily request quota exhausted. Try again after the quota resets.',
      ),
    ).toBeInTheDocument();
  });

  it('disables customer draft generation without an order selection', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [mockOrder],
    } as never);

    renderPage();

    const button = screen.getByRole('button', {
      name: 'Generate Customer Draft',
    });

    expect(button).toBeDisabled();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/orders');
    });
  });
});
