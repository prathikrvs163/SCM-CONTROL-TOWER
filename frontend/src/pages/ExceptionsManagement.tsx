import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  clearExceptionError,
  fetchExceptions,
} from '../features/exceptions/exceptionSlice';
import type {
  ExceptionType,
  Severity,
  SupplyException,
} from '../types';

const exceptionTypeLabels: Record<ExceptionType, string> = {
  BACKORDER: 'Backorder',
  LATE_PROMISE: 'Late promise',
  INBOUND_DEPENDENCY: 'Inbound dependency',
};

function formatDate(value: string | null): string {
  if (!value) return 'Not available';

  return new Date(value).toLocaleDateString();
}

function ExceptionsManagement() {
  const dispatch = useAppDispatch();

  const { data, loading, error } = useAppSelector(
    (state) => state.exceptions,
  );

  const [severity, setSeverity] = useState<Severity | ''>('');
  const [type, setType] = useState<ExceptionType | ''>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchExceptions({ severity, type }));
  }, [dispatch, severity, type]);

  const exceptions = data?.exceptions ?? [];

  const filteredExceptions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return exceptions;

    return exceptions.filter((exception: SupplyException) =>
      [
        exception.orderNumber,
        exception.customerName,
        exception.skuCode,
        exception.reason,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [exceptions, search]);

  const handleRefresh = () => {
    dispatch(fetchExceptions({ severity, type }));
  };

  const handleClearFilters = () => {
    setSeverity('');
    setType('');
    setSearch('');
  };

  const handleFilterChange = () => {
    dispatch(clearExceptionError());
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Exceptions Queue</h1>
          <p>Monitor supply chain risks and orders requiring attention.</p>
        </div>

        <button
          className="primary-button"
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="error-state">
          <p>{error}</p>
          <button className="secondary-button" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      <div className="sku-stat-grid">
        <div className="sku-stat-card">
          <span>Total exceptions</span>
          <strong>{data?.totalExceptions ?? 0}</strong>
        </div>

        <div className="sku-stat-card">
          <span>High severity</span>
          <strong>{data?.highCount ?? 0}</strong>
        </div>

        <div className="sku-stat-card">
          <span>Medium severity</span>
          <strong>{data?.mediumCount ?? 0}</strong>
        </div>

        <div className="sku-stat-card">
          <span>Low severity</span>
          <strong>{data?.lowCount ?? 0}</strong>
        </div>
      </div>

      <section className="sku-table-panel">
        <div className="sku-toolbar">
          <input
            type="text"
            placeholder="Search order, customer, SKU or reason..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value as Severity | '');
              handleFilterChange();
            }}
          >
            <option value="">All severities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as ExceptionType | '');
              handleFilterChange();
            }}
          >
            <option value="">All exception types</option>
            <option value="BACKORDER">Backorder</option>
            <option value="LATE_PROMISE">Late promise</option>
            <option value="INBOUND_DEPENDENCY">Inbound dependency</option>
          </select>

          <button className="secondary-button" onClick={handleClearFilters}>
            Clear filters
          </button>
        </div>

        {loading && !data ? (
          <div className="empty-state">Loading exceptions...</div>
        ) : filteredExceptions.length === 0 ? (
          <div className="empty-state">
            {search || severity || type
              ? 'No exceptions match your filters.'
              : 'No supply chain exceptions found.'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="sku-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Priority</th>
                  <th>Exception</th>
                  <th>Severity</th>
                  <th>SKU</th>
                  <th>Affected Qty</th>
                  <th>Requested Ship</th>
                  <th>Promised Ship</th>
                  <th>Reason</th>
                </tr>
              </thead>

              <tbody>
                {filteredExceptions.map((exception, index) => (
                  <tr
                    key={`${exception.orderId}-${exception.skuId}-${exception.type}-${index}`}
                  >
                    <td>{exception.orderNumber}</td>
                    <td>{exception.customerName}</td>
                    <td>{exception.priority}</td>
                    <td>
                      {exceptionTypeLabels[exception.type]}
                    </td>
                    <td>
                      <span
                        className={`sku-status ${exception.severity.toLowerCase()}`}
                      >
                        {exception.severity}
                      </span>
                    </td>
                    <td>{exception.skuCode}</td>
                    <td>{exception.affectedQuantity}</td>
                    <td>{formatDate(exception.requestedShipDate)}</td>
                    <td>{formatDate(exception.promisedShipDate)}</td>
                    <td>{exception.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="muted-text">
          Showing {filteredExceptions.length} of {data?.exceptions.length ?? 0} exceptions
        </div>
      </section>
    </div>
  );
}

export default ExceptionsManagement;
