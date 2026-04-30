'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  BeakerIcon,
  CubeIcon,
  ShoppingCartIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  {
    label: 'מוצרים ודוגמיות',
    href: '/kits',
    icon: BeakerIcon,
    matchPrefix: '/kits',
  },
  {
    label: 'רכישה סופית',
    href: '/final-purchase',
    icon: ShoppingCartIcon,
    matchPrefix: '/final-purchase',
    matchPattern: /\/kits\/[^/]+\/final/,
  },
  {
    label: 'הזמנות',
    href: '/',
    icon: CubeIcon,
    matchPrefix: '/orders',
    matchExact: '/',
  },
  {
    label: 'חיפוש מתקדם',
    href: '/kits/tracking-search',
    icon: MagnifyingGlassIcon,
    matchExact: '/kits/tracking-search',
  },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  const isActive = (item: (typeof navItems)[number]) => {
    if (item.matchExact && item.matchExact === pathname) return true;
    if ('matchPattern' in item && item.matchPattern && item.matchPattern.test(pathname)) return true;
    if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) {
      // Check if a more specific item matches instead
      const moreSpecific = navItems.find(
        (other) =>
          other !== item &&
          ((other.matchExact && other.matchExact === pathname) ||
           ('matchPattern' in other && other.matchPattern && (other.matchPattern as RegExp).test(pathname)))
      );
      if (moreSpecific) return false;
      return true;
    }
    return false;
  };

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`fixed top-0 right-0 h-screen bg-white border-l border-gray-200 flex flex-col z-30 transition-all duration-200 ease-in-out ${
        expanded ? 'w-52 shadow-lg' : 'w-16'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 py-4 border-b border-gray-100 ${expanded ? 'px-4' : 'justify-center px-0'}`}>
        <Link href="/" className="flex-shrink-0">
          <Image src="/Logo.png" alt="Logo" width={32} height={32} />
        </Link>
        <span
          className={`text-sm font-semibold text-gray-900 whitespace-nowrap overflow-hidden transition-all duration-200 ${
            expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
          }`}
        >
          מעקב רכש
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-1 pt-4 px-2">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 h-10 rounded-lg transition-colors ${
                expanded ? 'px-3' : 'justify-center'
              } ${
                active
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {expanded ? (
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
                  {item.label}
                </span>
              ) : (
                <span className="absolute right-full mr-2 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
