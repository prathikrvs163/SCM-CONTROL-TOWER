import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';

import { AppShell } from './layout/AppShell';
import { Button } from './components/ui/Button';
import { EmptyState, Skeleton } from './components/ui/Feedback';

// Each page is its own chunk, loaded on first visit.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ExceptionsManagement = lazy(() => import('./pages/ExceptionsManagement'));
const OrdersManagement = lazy(() => import('./pages/OrdersManagement'));
const SupplyManagement = lazy(() => import('./pages/SupplyManagement'));
const InventoryManagement = lazy(() => import('./pages/InventoryManagement'));
const SkuManagement = lazy(() => import('./pages/SkuManagement'));
const WarehouseManagement = lazy(() => import('./pages/WarehouseManagement'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const AuditLog = lazy(() => import('./pages/AuditLog'));

function PageFallback() {
  return (
    <div className="page" role="status" aria-label="Loading page">
      <div>
        <Skeleton width={90} height={12} />
        <Skeleton width={240} height={24} style={{ marginTop: 10 }} />
      </div>
      <div className="stat-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="stat-card" key={index}>
            <Skeleton width="50%" />
            <Skeleton width="35%" height={24} />
          </div>
        ))}
      </div>
      <div className="card card-body">
        <Skeleton height={220} />
      </div>
    </div>
  );
}

function page(element: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="card">
        <EmptyState
          icon={<Compass />}
          title="Page not found"
          description="The page you were looking for does not exist."
          action={
            <Button variant="primary" onClick={() => navigate('/')}>
              Back to dashboard
            </Button>
          }
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={page(<Dashboard />)} />
        <Route path="exceptions" element={page(<ExceptionsManagement />)} />
        <Route path="orders" element={page(<OrdersManagement />)} />
        <Route path="supply" element={page(<SupplyManagement />)} />
        <Route path="inventory" element={page(<InventoryManagement />)} />
        <Route path="skus" element={page(<SkuManagement />)} />
        <Route path="warehouses" element={page(<WarehouseManagement />)} />
        <Route path="ai" element={page(<AIAssistant />)} />
        <Route path="audit" element={page(<AuditLog />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
