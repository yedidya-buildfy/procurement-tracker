'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import Spinner from '@/components/ui/Spinner';
import SamplesTab from '@/components/kits/SamplesTab';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function SamplesPage({ params }: { params: Promise<{ kitId: string }> }) {
  const { kitId } = use(params);
  const router = useRouter();

  const data = useQuery(api.kits.getKitFull, { kitId });
  const allSuppliers = useQuery(api.suppliers.getAllSuppliers);
  const allKitsRaw = useQuery(api.kits.getAllKits);
  const views = useQuery(api.kitSampleViews.getViewsByKit, { kitId });

  const [kitSearch, setKitSearch] = useState('');

  if (data === undefined || allSuppliers === undefined || allKitsRaw === undefined || views === undefined) {
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

  const { products, samples, sampleMilestones, trackingNumbers, sampleImages, suppliers } = data;

  return (
    <div className="min-h-screen">
      <main className="mx-auto px-4 py-6">
        {/* Search */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">מוצרים ודוגמיות</h1>
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
          <SamplesTab
            kitId={kitId}
            products={products}
            samples={samples}
            sampleMilestones={sampleMilestones}
            trackingNumbers={trackingNumbers}
            sampleImages={sampleImages}
            suppliers={suppliers}
            allSuppliers={allSuppliers}
            allKits={(allKitsRaw || []).map((k) => ({ kitId: k.kitId, name: k.name }))}
            views={views}
            kitSearch={kitSearch}
            onForwardToFinal={(sampleData) => {
              // Navigate to final purchase page with sample ID in URL
              // Find the sample to get its ID
              const sample = samples.find(
                (s) => s.kitProductId === sampleData.kitProductId && s.supplierId === sampleData.supplierId
              );
              if (sample) {
                router.push(`/kits/${kitId}/final?forwardSample=${sample.sampleId}`);
              } else {
                router.push(`/kits/${kitId}/final`);
              }
            }}
          />
        </div>
      </main>
    </div>
  );
}
