import {
  Boxes,
  LayoutDashboard,
  Package,
  ScrollText,
  ShoppingCart,
  Sparkles,
  TriangleAlert,
  Truck,
  Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Extra words the command palette matches on. */
  keywords: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        path: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        keywords: 'home control tower kpi',
      },
      {
        path: '/exceptions',
        label: 'Exceptions',
        icon: TriangleAlert,
        keywords: 'risk late backorder queue alerts',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        path: '/orders',
        label: 'Orders',
        icon: ShoppingCart,
        keywords: 'customer demand allocation promise',
      },
      {
        path: '/supply',
        label: 'Supply',
        icon: Truck,
        keywords: 'inbound receipts purchase orders eta',
      },
      {
        path: '/inventory',
        label: 'Inventory',
        icon: Boxes,
        keywords: 'stock on hand adjustments safety',
      },
    ],
  },
  {
    label: 'Catalog',
    items: [
      {
        path: '/skus',
        label: 'SKUs',
        icon: Package,
        keywords: 'products items catalog',
      },
      {
        path: '/warehouses',
        label: 'Warehouses',
        icon: Warehouse,
        keywords: 'locations network sites',
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        path: '/ai',
        label: 'AI Assistant',
        icon: Sparkles,
        keywords: 'gemini summary customer draft',
      },
      {
        path: '/audit',
        label: 'Audit Log',
        icon: ScrollText,
        keywords: 'history trail changes planner actions',
      },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function findNavItem(pathname: string) {
  return (
    NAV_ITEMS.find((item) =>
      item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
    ) ?? null
  );
}

export function findNavGroup(pathname: string) {
  const item = findNavItem(pathname);
  return NAV_GROUPS.find((group) => item && group.items.includes(item)) ?? null;
}
