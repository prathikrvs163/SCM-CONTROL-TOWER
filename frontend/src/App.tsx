import { useState } from 'react';

import Dashboard from './pages/Dashboard';
import SkuManagement from './pages/SkuManagement';
import WarehouseManagement from './pages/WarehouseManagement';
import InventoryManagement from './pages/InventoryManagement';

type Page = 'dashboard' | 'skus' | 'warehouses' | 'inventory';

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
        </div>
      </nav>

      <main>
        {page === 'dashboard' && <Dashboard />}

        {page === 'skus' && <SkuManagement />}

        {page === 'warehouses' && <WarehouseManagement />}

        {page === 'inventory' && <InventoryManagement />}
      </main>
    </div>
  );
}

export default App;
