'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/useConfirm';
import SamplesTab from '@/components/kits/SamplesTab';
import FinalPurchaseTab from '@/components/kits/FinalPurchaseTab';
import {
  ArrowRightIcon,
  PencilIcon,
  TrashIcon,
  BeakerIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';

type TabId = 'samples' | 'final';

export default function KitPage({ params }: { params: Promise<{ kitId: string }> }) {
  const { kitId } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const data = useQuery(api.kits.getKitFull, { kitId });
  const allSuppliers = useQuery(api.suppliers.getAllSuppliers);
  const allKitsRaw = useQuery(api.kits.getAllKits);
  const updateKitMutation = useMutation(api.kits.updateKit);
  const deleteKitMutation = useMutation(api.kits.deleteKit);

  const [activeTab, setActiveTab] = useState<TabId>('samples');
  const [isEditing, setIsEditing] = useState(false);
  const [editedKit, setEditedKit] = useState<{
    name?: string;
    status?: string;
    notes?: string;
  }>({});

  if (data && Object.keys(editedKit).length === 0) {
    setEditedKit({
      name: data.kit.name,
      status: data.kit.status,
      notes: data.kit.notes || '',
    });
  }

  const handleUpdateKit = async () => {
    try {
      await updateKitMutation({
        kitId,
        name: editedKit.name,
        status: editedKit.status,
        notes: editedKit.notes,
      });
      showToast('ערכה עודכנה בהצלחה', 'success');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating kit:', error);
      showToast('שגיאה בעדכון ערכה', 'error');
    }
  };

  const handleDeleteKit = async () => {
    if (!(await confirm('האם אתה בטוח שברצונך למחוק את הערכה?'))) return;
    try {
      await deleteKitMutation({ kitId });
      showToast('ערכה נמחקה בהצלחה', 'success');
      router.push('/kits');
    } catch (error) {
      console.error('Error deleting kit:', error);
      showToast('שגיאה במחיקת ערכה', 'error');
    }
  };

  if (data === undefined || allSuppliers === undefined || allKitsRaw === undefined) {
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

  const { kit, products, samples, sampleMilestones, trackingNumbers, sampleImages, finalProducts, finalProductFiles, costs, costFiles, suppliers } = data;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'samples', label: `מוצרים ודוגמיות (${products.length})` },
    { id: 'final', label: `קנייה סופית (${finalProducts.length + costs.length})` },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/kits" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowRightIcon className="w-5 h-5 text-gray-600" />
            </Link>

            <div className="flex-1">
              {isEditing ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={editedKit.name || ''}
                    onChange={(e) => setEditedKit({ ...editedKit, name: e.target.value })}
                    className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none"
                  />
                  <select
                    value={editedKit.status || 'פעיל'}
                    onChange={(e) => setEditedKit({ ...editedKit, status: e.target.value })}
                    className="px-3 py-1 border rounded-lg text-sm"
                  >
                    <option value="פעיל">פעיל</option>
                    <option value="הושלם">הושלם</option>
                    <option value="בהמתנה">בהמתנה</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{kit.name}</h1>
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
                </div>
              )}
              <p className="text-sm text-gray-500">{kit.kitId}</p>
            </div>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => setIsEditing(false)}>ביטול</Button>
                  <Button onClick={handleUpdateKit}>שמור</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                    <PencilIcon className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDeleteKit} className="text-red-600 hover:bg-red-50">
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CubeIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">מוצרים</p>
                <p className="text-lg font-bold text-gray-900">{products.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BeakerIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">דוגמיות</p>
                <p className="text-lg font-bold text-gray-900">{samples.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CubeIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">ספקים</p>
                <p className="text-lg font-bold text-gray-900">{suppliers.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="border-b">
            <nav className="flex gap-1 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-2">
            {activeTab === 'samples' && (
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
              />
            )}
            {activeTab === 'final' && (
              <FinalPurchaseTab
                kitId={kitId}
                products={products}
                finalProducts={finalProducts}
                finalProductFiles={finalProductFiles}
                costs={costs}
                costFiles={costFiles}
                suppliers={suppliers}
                allSuppliers={allSuppliers}
              />
            )}
          </div>
        </div>
      </main>
      {ConfirmDialog}
    </div>
  );
}
