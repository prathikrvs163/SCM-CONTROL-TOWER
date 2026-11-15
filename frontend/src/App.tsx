import { useState } from 'react';

import Dashboard from './pages/Dashboard';
import SkuManagement from './pages/SkuManagement';
import WarehouseManagement from './pages/WarehouseManagement';

type Page = 'dashboard' | 'skus' | 'warehouses';

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
        </div>
      </nav>

      <main>
        {page === 'dashboard' && <Dashboard />}

        {page === 'skus' && <SkuManagement />}

        {page === 'warehouses' && <WarehouseManagement />}
      </main>
    </div>
  );
}

export default App;
