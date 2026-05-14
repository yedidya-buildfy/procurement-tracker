'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import Spinner from '@/components/ui/Spinner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SamplesTab from '@/components/kits/SamplesTab';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/useConfirm';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowTopRightOnSquareIcon,
  PencilIcon,
  TrashIcon,
  BeakerIcon,
  CubeIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

export default function SamplesPage({ params }: { params: Promise<{ kitId: string }> }) {
  const { kitId } = use(params);
  const router = useRouter();

  const data = useQuery(api.kits.getKitFull, { kitId });
  const allSuppliers = useQuery(api.suppliers.getAllSuppliers);
  const allKitsRaw = useQuery(api.kits.getAllKits);
  const views = useQuery(api.kitSampleViews.getViewsByKit, { kitId });
  const updateKitMutation = useMutation(api.kits.updateKit);
  const deleteKitMutation = useMutation(api.kits.deleteKit);
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [kitSearch, setKitSearch] = useState('');
  const [reqDocOpen, setReqDocOpen] = useState(false);
  const [reqDocDraft, setReqDocDraft] = useState<string | null>(null);
  const [reqDocSaving, setReqDocSaving] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editedKit, setEditedKit] = useState<{ name?: string; status?: string }>({});

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [notesSaving, setNotesSaving] = useState(false);

  const requirementsDoc = data?.kit?.requirementsDoc ?? '';
  const notes = data?.kit?.notes ?? '';

  useEffect(() => {
    if (data?.kit && requirementsDoc && !reqDocOpen && reqDocDraft === null) {
      setReqDocOpen(true);
    }
  }, [data?.kit, requirementsDoc, reqDocOpen, reqDocDraft]);

  useEffect(() => {
    if (data?.kit && notes && !notesOpen && notesDraft === null) {
      setNotesOpen(true);
    }
  }, [data?.kit, notes, notesOpen, notesDraft]);

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

  const handleSaveNotes = async () => {
    if (notesDraft === null) return;
    if (notesDraft === notes) {
      setNotesDraft(null);
      return;
    }
    setNotesSaving(true);
    try {
      await updateKitMutation({ kitId, notes: notesDraft });
      showToast('הערות נשמרו', 'success');
      setNotesDraft(null);
    } catch (error) {
      console.error('Error saving notes:', error);
      showToast('שגיאה בשמירת הערות', 'error');
    } finally {
      setNotesSaving(false);
    }
  };

  const handleUpdateKit = async () => {
    try {
      await updateKitMutation({
        kitId,
        name: editedKit.name,
        status: editedKit.status,
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

  const { kit, products, samples, finalProducts, sampleMilestones, trackingNumbers, sampleImages, suppliers } = data;
  const totalSampleCost = samples.reduce((sum, s) => sum + (typeof s.sampleCost === 'number' ? s.sampleCost : 0), 0);

  return (
    <div className="min-h-screen">
      <main className="mx-auto px-4 py-6">
        {/* Kit Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={editedKit.name ?? kit.name}
                  onChange={(e) => setEditedKit({ ...editedKit, name: e.target.value })}
                  className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none"
                />
                <select
                  value={editedKit.status ?? kit.status}
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
                <h1 className="text-2xl font-bold text-gray-900 truncate">{kit.name}</h1>
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
                <Button variant="secondary" onClick={() => { setIsEditing(false); setEditedKit({}); }}>ביטול</Button>
                <Button onClick={handleUpdateKit}>שמור</Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditedKit({ name: kit.name, status: kit.status }); setIsEditing(true); }}
                >
                  <PencilIcon className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDeleteKit} className="text-red-600 hover:bg-red-50">
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
                <ShoppingCartIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">רכישה סופית</p>
                <p className="text-lg font-bold text-gray-900">{finalProducts.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CubeIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">ספקים</p>
                <p className="text-lg font-bold text-gray-900">{suppliers.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CurrencyDollarIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">עלות דוגמיות</p>
                <p className="text-lg font-bold text-gray-900">
                  ${totalSampleCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">מוצרים ודוגמיות</h2>
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

        {/* Notes (kit-level) */}
        <div className="bg-white rounded-xl shadow-sm border mb-3">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <DocumentTextIcon className="w-4 h-4 text-gray-500" />
            <span className="font-medium">הערות</span>
            {notes && (
              <span className="text-xs text-gray-400 truncate max-w-[60%]">
                {notes.slice(0, 80)}
              </span>
            )}
            <span className="mr-auto">
              {notesOpen ? (
                <ChevronUpIcon className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
              )}
            </span>
          </button>
          {notesOpen && (
            <div className="px-3 pb-3 pt-1 space-y-2">
              <textarea
                value={notesDraft !== null ? notesDraft : notes}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="הוסף הערות לערכה"
                rows={Math.min(
                  10,
                  Math.max(2, ((notesDraft !== null ? notesDraft : notes).match(/\n/g)?.length || 0) + 2)
                )}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                disabled={notesSaving}
              />
              {notesDraft !== null && notesDraft !== notes && (
                <div className="flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNotesDraft(null)}
                    className="px-2 py-1 text-gray-500 hover:text-gray-700"
                    disabled={notesSaving}
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="px-2.5 py-1 text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-blue-300"
                    disabled={notesSaving}
                  >
                    {notesSaving ? 'שומר...' : 'שמור'}
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
      {ConfirmDialog}
    </div>
  );
}
