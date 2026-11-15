import { useState } from 'react';

import Dashboard from './pages/Dashboard';
import SkuManagement from './pages/SkuManagement';
import WarehouseManagement from './pages/WarehouseManagement';
import InventoryManagement from './pages/InventoryManagement';
import OrdersManagement from './pages/OrdersManagement';
import SupplyManagement from './pages/SupplyManagement';
import ExceptionsManagement from './pages/ExceptionsManagement';

type Page = 'dashboard' | 'skus' | 'warehouses' | 'inventory' | 'orders' | 'supply' | 'exceptions';

function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-brand">
          <span className="brand-mark">SC</span>
          <span>Supply Chain Control Tower</span>
        </div>

        <div className="nav-links">
          <button
            className={
              page === 'dashboard' ? 'nav-link selected' : 'nav-link'
            }
            onClick={() => setPage('dashboard')}
          >
            Dashboard
          </button>

          <button
            className={
              page === 'skus' ? 'nav-link selected' : 'nav-link'
            }
            onClick={() => setPage('skus')}
          >
            SKU Management
          </button>

          <button
            className={
              page === 'warehouses' ? 'nav-link selected' : 'nav-link'
            }
            onClick={() => setPage('warehouses')}
          >
            Warehouses
          </button>

          <button
            className={
              page === 'inventory' ? 'nav-link selected' : 'nav-link'
            }
            onClick={() => setPage('inventory')}
          >
            Inventory
          </button>

          <button
            className={
              page === 'orders' ? 'nav-link selected' : 'nav-link'
            }
            onClick={() => setPage('orders')}
          >
            Orders
          </button>

          <button
            className={
              page === 'supply' ? 'nav-link selected' : 'nav-link'
            }
            onClick={() => setPage('supply')}
          >
            Supply
          </button>

          <button
            className={
              page === 'exceptions' ? 'nav-link selected' : 'nav-link'
            }
            onClick={() => setPage('exceptions')}
          >
            Exceptions
          </button>
        </div>
      </nav>

      <main>
        {page === 'dashboard' && <Dashboard />}

        {page === 'skus' && <SkuManagement />}

        {page === 'warehouses' && <WarehouseManagement />}

        {page === 'inventory' && <InventoryManagement />}

        {page === 'orders' && <OrdersManagement />}

        {page === 'supply' && <SupplyManagement />}

        {page === 'exceptions' && <ExceptionsManagement />}
      </main>
    </div>
  );
}

export default App;
