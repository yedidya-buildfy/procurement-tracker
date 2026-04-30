'use client';

import { useState, use, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import Spinner from '@/components/ui/Spinner';
import FinalPurchaseTab from '@/components/kits/FinalPurchaseTab';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function FinalPurchasePage({ params }: { params: Promise<{ kitId: string }> }) {
  const { kitId } = use(params);
  const searchParams = useSearchParams();
  const forwardSampleId = searchParams.get('forwardSample');

  const data = useQuery(api.kits.getKitFull, { kitId });
  const allSuppliers = useQuery(api.suppliers.getAllSuppliers);
  const updateKitMutation = useMutation(api.kits.updateKit);

  const [kitSearch, setKitSearch] = useState('');

  // Build forward data from sample ID in URL
  const forwardSampleData = useMemo(() => {
    if (!forwardSampleId || !data) return null;
    const sample = data.samples.find((s) => s.sampleId === forwardSampleId);
    if (!sample) return null;
    return {
      kitProductId: sample.kitProductId,
      supplierId: sample.supplierId,
      weight: sample.weight?.toString() || undefined,
      volume: sample.volume?.toString() || undefined,
      dimHeight: sample.dimHeight?.toString() || undefined,
      dimWidth: sample.dimWidth?.toString() || undefined,
      dimLength: sample.dimLength?.toString() || undefined,
      notes: sample.notes || undefined,
    };
  }, [forwardSampleId, data]);

  if (data === undefined || allSuppliers === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">ערכה לא נמצאה</p>
      </div>
    );
  }

  const { kit, products, finalProducts, finalProductFiles, costs, costFiles, suppliers, samples, sampleImages } = data;

  return (
    <div className="min-h-screen">
      <main className="mx-auto px-4 py-6">
        {/* Search */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">רכישה סופית</h1>
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={kitSearch}
              onChange={(e) => setKitSearch(e.target.value)}
              placeholder="חפש..."
              className="pr-8 pl-7 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-52"
            />
            {kitSearch && (
              <button
                onClick={() => setKitSearch('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-2">
          <FinalPurchaseTab
            kitId={kitId}
            products={products}
            finalProducts={finalProducts}
            finalProductFiles={finalProductFiles}
            costs={costs}
            costFiles={costFiles}
            suppliers={suppliers}
            allSuppliers={allSuppliers}
            kitSearch={kitSearch}
            samples={samples}
            sampleImages={sampleImages}
            forwardSampleData={forwardSampleData}
            onForwardConsumed={() => {
              // Clear the URL param without full navigation
              window.history.replaceState(null, '', `/kits/${kitId}/final`);
            }}
            targetKitCount={kit.targetKitCount}
            onUpdateTargetKitCount={async (count) => {
              await updateKitMutation({ kitId, targetKitCount: count });
            }}
          />
        </div>
      </main>
    </div>
  );
}
