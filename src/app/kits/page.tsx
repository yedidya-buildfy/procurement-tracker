'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BeakerIcon,
  CubeIcon,
  CurrencyDollarIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { Id } from '../../../convex/_generated/dataModel';

function KitImageSlot({ kitId }: { kitId: string }) {
  const images = useQuery(api.kits.getKitImages, { kitId });
  const generateUploadUrl = useMutation(api.kits.generateUploadUrl);
  const addImage = useMutation(api.kits.addKitImage);
  const deleteImage = useMutation(api.kits.deleteKitImage);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleUpload = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      const { storageId } = await res.json();
      await addImage({ kitId, storageId });
    }
  };

  return (
    <>
      <div className="flex-shrink-0">
        {(images || []).length > 0 && images![0].url ? (
          <div className="relative group/ki">
            <img
              src={images![0].url}
              alt=""
              className="w-16 h-16 object-cover rounded-xl border border-gray-200 hover:border-blue-300 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setLightbox(images![0].url); }}
            />
            <label
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover/ki:opacity-100 transition-opacity cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <PhotoIcon className="w-5 h-5 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  if (!e.target.files?.[0]) return;
                  // Delete old image first
                  if (images![0]._id) await deleteImage({ id: images![0]._id as Id<'kitImages'> });
                  await handleUpload(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <label
            className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <PhotoIcon className="w-6 h-6 text-gray-300" />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => { if (e.target.files) handleUpload(e.target.files); e.target.value = ''; }}
              className="hidden"
            />
          </label>
        )}
      </div>

      {lightbox && (
        <>
          <div className="fixed inset-0 bg-black/80 z-40" onClick={() => setLightbox(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
            <img src={lightbox} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
          </div>
        </>
      )}
    </>
  );
}

export default function KitsPage() {
  const kits = useQuery(api.kits.getAllKits);
  const createKitMutation = useMutation(api.kits.createKit);
  const deleteKitMutation = useMutation(api.kits.deleteKit);
  const updateKitMutation = useMutation(api.kits.updateKit);

  const [search, setSearch] = useState('');
  const [showNewKit, setShowNewKit] = useState(false);
  const [newKit, setNewKit] = useState({ name: '', notes: '' });
  const [deleteKitId, setDeleteKitId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingKitId, setEditingKitId] = useState<string | null>(null);
  const [editKitName, setEditKitName] = useState('');
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const costBreakdown = useQuery(
    api.kits.getSampleCostBreakdown,
    showCostBreakdown ? {} : 'skip'
  );
  const { showToast } = useToast();

  const handleCreateKit = async () => {
    if (!newKit.name.trim()) return;
    try {
      await createKitMutation({
        name: newKit.name,
        notes: newKit.notes || undefined,
      });
      showToast('ערכה נוצרה בהצלחה', 'success');
      setShowNewKit(false);
      setNewKit({ name: '', notes: '' });
    } catch (error) {
      console.error('Error creating kit:', error);
      showToast('שגיאה ביצירת ערכה', 'error');
    }
  };

  const confirmDeleteKit = async () => {
    if (!deleteKitId) return;
    setIsDeleting(true);
    try {
      await deleteKitMutation({ kitId: deleteKitId });
      showToast('ערכה נמחקה בהצלחה', 'success');
      setDeleteKitId(null);
    } catch (error) {
      console.error('Error deleting kit:', error);
      showToast('שגיאה במחיקת ערכה', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredKits = (kits || []).filter((kit) => {
    return (
      !search ||
      kit.name.toLowerCase().includes(search.toLowerCase()) ||
      kit.kitId.toLowerCase().includes(search.toLowerCase())
    );
  });

  const kitToDelete = kits?.find((k) => k.kitId === deleteKitId);

  if (kits === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Actions */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">ערכות ודוגמיות</h2>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowNewKit(true)}>
              <PlusIcon className="w-5 h-5" />
              ערכה חדשה
            </Button>
          </div>
        </div>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CubeIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">ערכות</p>
                <p className="text-xl font-bold text-gray-900">{kits.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BeakerIcon className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">סה"כ דוגמיות</p>
                <p className="text-xl font-bold text-gray-900">
                  {kits.reduce((sum, k) => sum + k.totalSamples, 0)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BeakerIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">דוגמיות ממתינות</p>
                <p className="text-xl font-bold text-gray-900">
                  {kits.reduce((sum, k) => sum + k.pendingSamples, 0)}
                </p>
              </div>
            </div>
          </Card>

          <button
            type="button"
            onClick={() => setShowCostBreakdown(true)}
            className="text-right rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-300"
            title="לחץ לפירוט מלא"
          >
            <Card className="hover:shadow-md hover:border-purple-200 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">עלות דוגמיות</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${kits.reduce((sum, k) => sum + (k.totalSampleCost || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </Card>
          </button>
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

        {/* Kits Grid */}
        {filteredKits.length === 0 ? (
          <Card className="text-center py-12">
            <CubeIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {kits.length === 0 ? 'אין ערכות עדיין' : 'לא נמצאו ערכות'}
            </p>
            {kits.length === 0 && (
              <Button className="mt-4" onClick={() => setShowNewKit(true)}>
                <PlusIcon className="w-5 h-5" />
                צור ערכה ראשונה
              </Button>
            )}
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredKits.map((kit) => (
              <div key={kit.kitId}>
                <Card className="hover:shadow-md hover:border-blue-200 transition-all !p-2">
                  <div className="flex items-center gap-6">
                    <KitImageSlot kitId={kit.kitId} />
                    <div className="flex-1 min-w-0">
                      {editingKitId === kit.kitId ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editKitName}
                            onChange={(e) => setEditKitName(e.target.value)}
                            className="font-semibold text-gray-900 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                            autoFocus
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && editKitName.trim()) {
                                await updateKitMutation({ kitId: kit.kitId, name: editKitName.trim() });
                                setEditingKitId(null);
                                showToast('שם ערכה עודכן', 'success');
                              }
                              if (e.key === 'Escape') setEditingKitId(null);
                            }}
                          />
                          <button
                            onClick={async () => {
                              if (editKitName.trim()) {
                                await updateKitMutation({ kitId: kit.kitId, name: editKitName.trim() });
                                setEditingKitId(null);
                                showToast('שם ערכה עודכן', 'success');
                              }
                            }}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingKitId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <Link href={`/kits/${kit.kitId}`} className="block cursor-pointer">
                          <h3 className="font-semibold text-gray-900 truncate">{kit.name}</h3>
                          <p className="text-sm text-gray-500">{kit.kitId}</p>
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <CubeIcon className="w-4 h-4 text-gray-400" />
                      <span>{kit.productCount} מוצרים</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <BeakerIcon className="w-4 h-4 text-gray-400" />
                      <span>{kit.totalSamples} דוגמיות</span>
                    </div>

                    {kit.pendingSamples > 0 && (
                      <div className="text-sm">
                        <span className="text-orange-600 font-medium">
                          {kit.pendingSamples} ממתינות
                        </span>
                      </div>
                    )}

                    {(kit.totalSampleCost || 0) > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CurrencyDollarIcon className="w-4 h-4 text-gray-400" />
                        <span>
                          ${kit.totalSampleCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="text-sm text-gray-500">
                      {formatDate(kit.createdDate)}
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

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingKitId(kit.kitId);
                        setEditKitName(kit.name);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="ערוך שם"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteKitId(kit.kitId);
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="מחק ערכה"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Kit Modal */}
      <Modal isOpen={showNewKit} onClose={() => setShowNewKit(false)} title="ערכה חדשה">
        <div className="space-y-4">
          <Input
            id="kitName"
            label="שם הערכה"
            value={newKit.name}
            onChange={(e) => setNewKit({ ...newKit, name: e.target.value })}
            placeholder="לדוגמה: ערכת ניקוי מקלחת"
            required
          />
          <Input
            id="kitNotes"
            label="הערות"
            value={newKit.notes}
            onChange={(e) => setNewKit({ ...newKit, notes: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowNewKit(false)}>
              ביטול
            </Button>
            <Button onClick={handleCreateKit} disabled={!newKit.name.trim()}>
              צור ערכה
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteKitId}
        onClose={() => setDeleteKitId(null)}
        onConfirm={confirmDeleteKit}
        title="מחיקת ערכה"
        message={`האם אתה בטוח שברצונך למחוק את הערכה "${kitToDelete?.name || ''}"? פעולה זו תמחק את כל המוצרים, הדוגמיות והנתונים הקשורים ולא ניתן לבטל אותה.`}
        confirmText="מחק ערכה"
        cancelText="ביטול"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Cost breakdown modal */}
      <Modal
        isOpen={showCostBreakdown}
        onClose={() => setShowCostBreakdown(false)}
        title="פירוט עלות דוגמיות"
        size="lg"
      >
        {costBreakdown === undefined ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : costBreakdown.length === 0 ? (
          <p className="text-center text-gray-500 py-8">אין דוגמיות עם עלות רשומה.</p>
        ) : (
          (() => {
            const grouped = new Map<string, { kitName: string; rows: typeof costBreakdown; subtotal: number }>();
            for (const row of costBreakdown) {
              const k = grouped.get(row.kitId) || { kitName: row.kitName, rows: [], subtotal: 0 };
              k.rows.push(row);
              k.subtotal += row.sampleCost;
              grouped.set(row.kitId, k);
            }
            const grandTotal = costBreakdown.reduce((s, r) => s + r.sampleCost, 0);
            return (
              <div className="space-y-5 max-h-[70vh] overflow-y-auto">
                {Array.from(grouped.entries()).map(([kitId, g]) => (
                  <div key={kitId} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <Link href={`/kits/${kitId}/samples`} className="font-semibold text-gray-900 hover:text-blue-600">
                        {g.kitName}
                      </Link>
                      <span className="text-sm font-semibold text-purple-700">
                        ${g.subtotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-white text-xs text-gray-500">
                        <tr>
                          <th className="text-right px-4 py-2 font-medium">מוצר</th>
                          <th className="text-right px-4 py-2 font-medium">ספק</th>
                          <th className="text-right px-4 py-2 font-medium">עלות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows
                          .slice()
                          .sort((a, b) => b.sampleCost - a.sampleCost)
                          .map((r) => (
                            <tr key={r.sampleId} className="border-t border-gray-100">
                              <td className="px-4 py-2 text-gray-800">{r.productName}</td>
                              <td className="px-4 py-2 text-gray-700">{r.supplierName}</td>
                              <td className="px-4 py-2 font-mono text-gray-900">
                                ${r.sampleCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                  <span className="text-sm text-gray-500">סה"כ ({costBreakdown.length} דוגמיות)</span>
                  <span className="text-lg font-bold text-purple-700">
                    ${grandTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })()
        )}
      </Modal>
    </div>
  );
}
