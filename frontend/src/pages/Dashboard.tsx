import { useEffect } from 'react';
import { fetchDashboard } from '../features/dashboard/dashboardSlice';
import { useAppDispatch, useAppSelector } from '../app/hooks';

function Dashboard() {
  const dispatch = useAppDispatch();

  const {
    skus,
    warehouses,
    inventory,
    orders,
    receipts,
    allocation,
    exceptions,
    loading,
    error,
    lastUpdated,
  } = useAppSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  const activeOrders = orders.filter(
    (order) => ['CONFIRMED', 'FULFILLING'].includes(order.status),
  ).length;

  const totalOnHand = inventory.reduce(
    (total, item) => total + item.onHandQuantity,
    0,
  );

  const totalBackordered = allocation?.orders.reduce(
    (total, order) =>
      total +
      order.lines.reduce(
        (lineTotal, line) => lineTotal + line.backorderedQuantity,
        0,
      ),
    0,
  ) ?? 0;

  const metrics = [
    { label: 'Active SKUs', value: skus.filter((s) => s.isActive).length },
    { label: 'Warehouses', value: warehouses.filter((w) => w.isActive).length },
    { label: 'Active Orders', value: activeOrders },
    { label: 'On-hand Units', value: totalOnHand },
    { label: 'Backordered Units', value: totalBackordered },
    { label: 'Open Exceptions', value: exceptions?.totalExceptions ?? 0 },
  ];

  if (loading && !lastUpdated) {
    return <div className="page-loading">Loading control tower...</div>;
  }

  if (error && !lastUpdated) {
    return (
      <main className="dashboard">
        <h1>Dashboard</h1>
        <div className="error-panel">
          <p>{error}</p>
          <button onClick={() => dispatch(fetchDashboard())}>Retry</button>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="page-header">
        <div>
          <p className="eyebrow">SUPPLY CHAIN MANAGEMENT</p>
          <h1>Control Tower</h1>
          <p className="subtitle">
            Monitor inventory, orders and fulfillment risk.
          </p>
        </div>
        <button
          className="refresh-button"
          onClick={() => dispatch(fetchDashboard())}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <p>{metric.label}</p>
            <h2>{metric.value.toLocaleString()}</h2>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Order Overview</h2>
            <span>{orders.length} total</span>
          </div>
          {orders.length === 0 ? (
            <p className="empty-state">No orders found.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 6).map((order) => (
                    <tr key={order.id}>
                      <td>{order.orderNumber}</td>
                      <td>{order.customerName}</td>
                      <td>
                        <span className={`priority ${order.priority.toLowerCase()}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td>{order.status.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Exception Summary</h2>
            <span>{exceptions?.totalExceptions ?? 0} total</span>
          </div>
          {exceptions?.exceptions.length ? (
            <div className="exception-list">
              {exceptions.exceptions.slice(0, 5).map((item, index) => (
                <div className="exception-item" key={`${item.orderId}-${item.type}-${index}`}>
                  <div>
                    <strong>{item.orderNumber}</strong>
                    <p>{item.type.replaceAll('_', ' ')}</p>
                  </div>
                  <span className={`severity ${item.severity.toLowerCase()}`}>
                    {item.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No exceptions found.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Inbound Supply</h2>
            <span>{receipts.length} receipts</span>
          </div>
          {receipts.length === 0 ? (
            <p className="empty-state">No inbound receipts found.</p>
          ) : (
            <div className="receipt-list">
              {receipts.slice(0, 4).map((receipt) => (
                <div className="receipt-item" key={receipt.id}>
                  <div>
                    <strong>{receipt.receiptId}</strong>
                    <p>{receipt.sku.skuCode} · {receipt.quantity} units</p>
                  </div>
                  <span className={`receipt-status ${receipt.status.toLowerCase()}`}>
                    {receipt.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Inventory Snapshot</h2>
            <span>{inventory.length} balances</span>
          </div>
          {inventory.length === 0 ? (
            <p className="empty-state">No inventory balances found.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Warehouse</th>
                    <th>On Hand</th>
                    <th>Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.slice(0, 5).map((item) => (
                    <tr key={`${item.skuId}-${item.warehouseId}`}>
                      <td>{item.sku.skuCode}</td>
                      <td>{item.warehouse.code}</td>
                      <td>{item.onHandQuantity}</td>
                      <td>{item.reservedQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <footer className="dashboard-footer">
        <span>
          Allocation method: {allocation?.allocationMethod ?? 'Unavailable'}
        </span>
        <span>
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
        </span>
      </footer>
    </main>
  );
}

export default Dashboard;
