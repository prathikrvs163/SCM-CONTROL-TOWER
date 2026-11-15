import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import SkuManagement from './pages/SkuManagement';

type Page = 'dashboard' | 'skus';

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
            className={page === 'dashboard' ? 'nav-link selected' : 'nav-link'}
            onClick={() => setPage('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={page === 'skus' ? 'nav-link selected' : 'nav-link'}
            onClick={() => setPage('skus')}
          >
            SKU Management
          </button>
        </div>
      </nav>

      {page === 'dashboard' ? <Dashboard /> : <SkuManagement />}
    </div>
  );
}

export default App;
