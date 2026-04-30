'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import {
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

export default function FinalPurchaseListPage() {
  const kits = useQuery(api.kits.getAllKitsWithFinalCounts);
  const [search, setSearch] = useState('');

  if (kits === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const filteredKits = kits.filter((kit) =>
    !search || kit.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">רכישה סופית</h1>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש ערכה..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Kits List */}
        {filteredKits.length === 0 ? (
          <Card className="text-center py-12">
            <ShoppingCartIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">אין ערכות</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredKits.map((kit) => (
              <Link
                key={kit.kitId}
                href={`/kits/${kit.kitId}/final`}
                className="block"
              >
                <Card className="hover:shadow-md hover:border-purple-200 transition-all !p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-xl">
                      <ShoppingCartIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{kit.name}</h3>
                      <p className="text-sm text-gray-500">
                        {kit.finalProductCount} פריטים, {kit.costCount} עלויות
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        kit.status === 'פעיל'
                          ? 'bg-green-100 text-green-700'
                          : kit.status === 'הושלם'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {kit.status}
                    </span>
                    <ArrowLeftIcon className="w-5 h-5 text-gray-400" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
