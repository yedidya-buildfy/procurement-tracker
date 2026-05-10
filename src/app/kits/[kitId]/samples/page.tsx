'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import Spinner from '@/components/ui/Spinner';
import SamplesTab from '@/components/kits/SamplesTab';
import { useToast } from '@/components/ui/Toast';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

export default function SamplesPage({ params }: { params: Promise<{ kitId: string }> }) {
  const { kitId } = use(params);
  const router = useRouter();

  const data = useQuery(api.kits.getKitFull, { kitId });
  const allSuppliers = useQuery(api.suppliers.getAllSuppliers);
  const allKitsRaw = useQuery(api.kits.getAllKits);
  const views = useQuery(api.kitSampleViews.getViewsByKit, { kitId });
  const updateKitMutation = useMutation(api.kits.updateKit);
  const { showToast } = useToast();

  const [kitSearch, setKitSearch] = useState('');
  const [reqDocOpen, setReqDocOpen] = useState(false);
  const [reqDocDraft, setReqDocDraft] = useState<string | null>(null);
  const [reqDocSaving, setReqDocSaving] = useState(false);

  const requirementsDoc = data?.kit?.requirementsDoc ?? '';

  useEffect(() => {
    if (data?.kit && requirementsDoc && !reqDocOpen && reqDocDraft === null) {
      setReqDocOpen(true);
    }
  }, [data?.kit, requirementsDoc, reqDocOpen, reqDocDraft]);

  const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

  const handleSaveRequirementsDoc = async () => {
    if (reqDocDraft === null) return;
    if (reqDocDraft === requirementsDoc) {
      setReqDocDraft(null);
      return;
    }
    setReqDocSaving(true);
    try {
      await updateKitMutation({ kitId, requirementsDoc: reqDocDraft });
      showToast('מסמך דרישות נשמר', 'success');
      setReqDocDraft(null);
    } catch (error) {
      console.error('Error saving requirements doc:', error);
      showToast('שגיאה בשמירת מסמך דרישות', 'error');
    } finally {
      setReqDocSaving(false);
    }
  };

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

        {/* Requirements Document (kit-level) */}
        <div className="bg-white rounded-xl shadow-sm border mb-3">
          <button
            type="button"
            onClick={() => setReqDocOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <DocumentTextIcon className="w-4 h-4 text-gray-500" />
            <span className="font-medium">מסמך דרישות</span>
            {requirementsDoc && (
              <span className="text-xs text-gray-400 truncate max-w-[60%]">
                {isUrl(requirementsDoc) ? requirementsDoc.trim() : requirementsDoc.slice(0, 80)}
              </span>
            )}
            <span className="mr-auto">
              {reqDocOpen ? (
                <ChevronUpIcon className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
              )}
            </span>
          </button>
          {reqDocOpen && (
            <div className="px-3 pb-3 pt-1 space-y-2">
              {reqDocDraft === null && requirementsDoc && isUrl(requirementsDoc) && (
                <a
                  href={requirementsDoc.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                  פתח קישור
                </a>
              )}
              <textarea
                value={reqDocDraft !== null ? reqDocDraft : requirementsDoc}
                onChange={(e) => setReqDocDraft(e.target.value)}
                onBlur={handleSaveRequirementsDoc}
                placeholder="הדבק קישור לנוטיון או הדבק טקסט"
                rows={Math.min(
                  10,
                  Math.max(2, ((reqDocDraft !== null ? reqDocDraft : requirementsDoc).match(/\n/g)?.length || 0) + 2)
                )}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                disabled={reqDocSaving}
              />
              {reqDocDraft !== null && reqDocDraft !== requirementsDoc && (
                <div className="flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setReqDocDraft(null)}
                    className="px-2 py-1 text-gray-500 hover:text-gray-700"
                    disabled={reqDocSaving}
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRequirementsDoc}
                    className="px-2.5 py-1 text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-blue-300"
                    disabled={reqDocSaving}
                  >
                    {reqDocSaving ? 'שומר...' : 'שמור'}
                  </button>
                </div>
              )}
            </div>
          )}
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
