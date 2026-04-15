'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

function OrderNameCrumb({ orderId }: { orderId: string }) {
  const order = useQuery(api.orders.getOrderById, { orderId });
  return <>{order?.orderName ?? orderId}</>;
}

function KitNameCrumb({ kitId }: { kitId: string }) {
  const kit = useQuery(api.kits.getKitById, { kitId });
  return <>{kit?.name ?? kitId}</>;
}

function ProductNameCrumb({ productId }: { productId: string }) {
  const product = useQuery(api.products.getProductById, { productId });
  return <>{product?.name ?? productId}</>;
}

interface Crumb {
  label: string | React.ReactNode;
  href?: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  // /
  if (pathname === '/') {
    return [{ label: 'הזמנות' }];
  }

  // /kits/tracking-search
  if (pathname === '/kits/tracking-search') {
    return [
      { label: 'ערכות ודוגמיות', href: '/kits' },
      { label: 'חיפוש מעקב' },
    ];
  }

  // /kits/[kitId]
  const kitMatch = pathname.match(/^\/kits\/([^/]+)$/);
  if (kitMatch) {
    return [
      { label: 'ערכות ודוגמיות', href: '/kits' },
      { label: <KitNameCrumb kitId={kitMatch[1]} /> },
    ];
  }

  // /kits
  if (pathname === '/kits') {
    return [{ label: 'ערכות ודוגמיות' }];
  }

  // /orders/[orderId]/products/[productId]
  const productMatch = pathname.match(
    /^\/orders\/([^/]+)\/products\/([^/]+)$/
  );
  if (productMatch) {
    return [
      { label: 'הזמנות', href: '/' },
      {
        label: <OrderNameCrumb orderId={productMatch[1]} />,
        href: `/orders/${productMatch[1]}`,
      },
      { label: <ProductNameCrumb productId={productMatch[2]} /> },
    ];
  }

  // /orders/[orderId]
  const orderMatch = pathname.match(/^\/orders\/([^/]+)$/);
  if (orderMatch) {
    return [
      { label: 'הזמנות', href: '/' },
      { label: <OrderNameCrumb orderId={orderMatch[1]} /> },
    ];
  }

  return [{ label: 'מעקב רכש' }];
}

export default function BreadcrumbHeader() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <header className="bg-white border-b sticky top-0 z-20">
      <div className="px-6 py-3">
        <nav className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <ChevronLeftIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                )}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-gray-900 font-medium">
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
