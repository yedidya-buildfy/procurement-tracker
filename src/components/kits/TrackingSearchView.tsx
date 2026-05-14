'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { SAMPLE_STAGES } from '@/lib/sampleStages';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/useConfirm';
import StagePill from './StagePill';
import Link from 'next/link';
import {
  XMarkIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  ArchiveBoxIcon,
  ArchiveBoxXMarkIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,

  ChevronUpIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

// ── Fuzzy matching ──────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(search: string, target: string, threshold: number): { match: boolean; score: number } {
  const s = search.toLowerCase();
  const t = target.toLowerCase();
  if (s === t) return { match: true, score: 0 };
  if (t.includes(s)) return { match: true, score: 0.1 };
  if (s.includes(t)) return { match: true, score: 0.15 };
  const maxLen = Math.max(s.length, t.length);
  const dist = levenshtein(s, t);
  const ratio = dist / maxLen;
  const dynamicThreshold = threshold / 100;
  if (ratio <= dynamicThreshold) return { match: true, score: ratio };
  if (s.length >= 4 && t.length >= 4) {
    const shorter = s.length <= t.length ? s : t;
    const longer = s.length <= t.length ? t : s;
    for (let i = 0; i <= longer.length - shorter.length; i++) {
      const sub = longer.substring(i, i + shorter.length);
      const subDist = levenshtein(shorter, sub);
      const subRatio = subDist / shorter.length;
      if (subRatio <= dynamicThreshold) return { match: true, score: subRatio + 0.2 };
    }
  }
  return { match: false, score: 1 };
}

// ── Sort ────────────────────────────────────────────────────
type SortKey = 'trackingNumber' | 'leg' | 'supplierName' | 'kitName' | 'productName' | 'stage';
type SortDir = 'asc' | 'desc';

interface TrackingItem {
  _id: string;
  sampleId: string;
  trackingNumber: string;
  leg: string;
  carrier?: string;
  notes?: string;
  sample: {
    sampleId: string;
    kitProductId: string;
    supplierId: string;
    sampleCost?: number;
    paid: boolean;
    currentStage?: number;
    archived?: boolean;
    notes?: string;
    createdDate: string;
    rating?: number;
    ratingNotes?: string;
    isRelevant?: boolean;
    shippingMethod?: string;
  };
  productName: string;
  kitId: string;
  kitName: string;
  supplierName: string;
  imageUrls?: string[];
  matchedTerm?: string;
  fuzzyScore?: number;
}

function sortItems(items: TrackingItem[], key: SortKey | null, dir: SortDir): TrackingItem[] {
  if (!key) return items;
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'trackingNumber': cmp = a.trackingNumber.localeCompare(b.trackingNumber); break;
      case 'leg': cmp = a.leg.localeCompare(b.leg); break;
      case 'supplierName': cmp = a.supplierName.localeCompare(b.supplierName); break;
      case 'kitName': cmp = a.kitName.localeCompare(b.kitName); break;
      case 'productName': cmp = a.productName.localeCompare(b.productName); break;
      case 'stage': cmp = (a.sample.currentStage ?? -1) - (b.sample.currentStage ?? -1); break;
    }
    return dir === 'desc' ? -cmp : cmp;
  });
}

function ColHeader({ label, sortKey: key, currentKey, dir, onSort }: {
  label: string; sortKey: SortKey; currentKey: SortKey | null; dir: SortDir; onSort: (key: SortKey) => void;
}) {
  const active = currentKey === key;
  return (
    <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-500 cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap" onClick={() => onSort(key)}>
      <span className="inline-flex items-center gap-0.5">
        {label}
        <span className={`inline-flex flex-col ${active ? 'text-blue-600' : 'text-gray-300'}`}>
          <ChevronUpIcon className={`w-2.5 h-2.5 -mb-0.5 ${active && dir === 'asc' ? 'text-blue-600' : ''}`} />
          <ChevronDownIcon className={`w-2.5 h-2.5 ${active && dir === 'desc' ? 'text-blue-600' : ''}`} />
        </span>
      </span>
    </th>
  );
}

// ── Draggable resizer hook ──────────────────────────────────
function useResizer(initialPcts: [number, number, number]) {
  const [pcts, setPcts] = useState(initialPcts);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ idx: number; startX: number; startPcts: [number, number, number] } | null>(null);

  const onMouseDown = useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { idx, startX: e.clientX, startPcts: [...pcts] as [number, number, number] };
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const dx = ev.clientX - dragging.current.startX;
      // RTL layout: visual direction is reversed, so negate dx
      const deltaPct = (-dx / containerWidth) * 100;
      const newPcts = [...dragging.current.startPcts] as [number, number, number];
      const i = dragging.current.idx; // 0 = divider between panel 0 and 1, 1 = divider between panel 1 and 2
      const minPct = 10;
      let leftDelta = deltaPct;
      // Clamp
      const newLeft = newPcts[i] + leftDelta;
      const newRight = newPcts[i + 1] - leftDelta;
      if (newLeft < minPct) leftDelta = minPct - newPcts[i];
      if (newRight < minPct) leftDelta = newPcts[i + 1] - minPct;
      newPcts[i] = newPcts[i] + leftDelta;
      newPcts[i + 1] = newPcts[i + 1] - leftDelta;
      setPcts(newPcts);
    };
    const onMouseUp = () => {
      dragging.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [pcts]);

  return { pcts, containerRef, onMouseDown };
}

// ── Main ────────────────────────────────────────────────────
export default function TrackingSearchView() {
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const allTrackingData = useQuery(api.kits.getAllTrackingNumbers);
  const allKits = useQuery(api.kits.getAllKits);
  const updateSampleMutation = useMutation(api.kits.updateSample);
  const deleteSampleMutation = useMutation(api.kits.deleteSample);
  const bulkUpdateStageMutation = useMutation(api.kits.bulkUpdateSampleStage);
  const bulkDeleteMutation = useMutation(api.kits.bulkDeleteSamples);

  const [searchInput, setSearchInput] = useState('');
  const [searchScope, setSearchScope] = useState<string>('all');
  const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set());
  const [bulkStageValue, setBulkStageValue] = useState<number>(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [fuzzyThreshold, setFuzzyThreshold] = useState<number>(25);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [foundSort, setFoundSort] = useState<{ key: SortKey | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [notSearchedSort, setNotSearchedSort] = useState<{ key: SortKey | null; dir: SortDir }>({ key: null, dir: 'asc' });

  // Default: found 42%, not-searched 38%, not-found 20%
  const { pcts, containerRef, onMouseDown } = useResizer([42, 38, 20]);

  const toggleSort = (
    current: { key: SortKey | null; dir: SortDir },
    setter: (v: { key: SortKey | null; dir: SortDir }) => void,
    key: SortKey
  ) => {
    if (current.key === key) {
      if (current.dir === 'asc') setter({ key, dir: 'desc' });
      else setter({ key: null, dir: 'asc' });
    } else {
      setter({ key, dir: 'asc' });
    }
  };

  const { found, notSearched, notFound } = useMemo(() => {
    if (!allTrackingData || searchTerms.length === 0) {
      return { found: [] as TrackingItem[], notSearched: [] as TrackingItem[], notFound: [] as string[] };
    }
    const scopedTracking = searchScope === 'all'
      ? allTrackingData
      : allTrackingData.filter((t) => t.kitId === searchScope);

    const matchedTrackingIds = new Set<string>();
    const matchedSearchTerms = new Set<string>();
    const foundItems: TrackingItem[] = [];
    for (const term of searchTerms) {
      for (const t of scopedTracking) {
        if (matchedTrackingIds.has(t._id)) continue;
        const { match, score } = fuzzyMatch(term, t.trackingNumber, fuzzyThreshold);
        if (match) {
          matchedTrackingIds.add(t._id);
          matchedSearchTerms.add(term);
          foundItems.push({ ...t, matchedTerm: term, fuzzyScore: score });
        }
      }
    }
    foundItems.sort((a, b) => (a.fuzzyScore ?? 0) - (b.fuzzyScore ?? 0));
    const notSearchedItems: TrackingItem[] = scopedTracking
      .filter((t) => !matchedTrackingIds.has(t._id))
      .map((t) => ({ ...t }));
    const notFoundTerms = searchTerms.filter((term) => !matchedSearchTerms.has(term));
    return { found: foundItems, notSearched: notSearchedItems, notFound: notFoundTerms };
  }, [allTrackingData, searchTerms, searchScope, fuzzyThreshold]);

  const sortedFound = useMemo(() => sortItems(found, foundSort.key, foundSort.dir), [found, foundSort]);
  const sortedNotSearched = useMemo(() => sortItems(notSearched, notSearchedSort.key, notSearchedSort.dir), [notSearched, notSearchedSort]);

  const handleSearch = () => {
    const terms = searchInput.split(/[\s,;\n]+/).map((t) => t.trim()).filter((t) => t.length > 0);
    setSearchTerms(terms);
    setHasSearched(true);
    setSelectedSampleIds(new Set());
  };

  const handleStageChange = async (sampleId: string, stageId: number) => {
    try { await updateSampleMutation({ sampleId, currentStage: stageId }); }
    catch { showToast('שגיאה בעדכון שלב', 'error'); }
  };
  const handleArchiveSample = async (sampleId: string, archived: boolean) => {
    await updateSampleMutation({ sampleId, archived: !archived });
    showToast(!archived ? 'דוגמית הועברה לארכיון' : 'דוגמית שוחזרה', 'success');
  };
  const handleDeleteSample = async (sampleId: string) => {
    if (!(await confirm('האם למחוק את הדוגמית?'))) return;
    try { await deleteSampleMutation({ sampleId }); showToast('דוגמית נמחקה', 'success'); }
    catch { showToast('שגיאה במחיקת דוגמית', 'error'); }
  };
  const toggleSelectSample = (sampleId: string) => {
    setSelectedSampleIds((prev) => {
      const next = new Set(prev);
      if (next.has(sampleId)) next.delete(sampleId); else next.add(sampleId);
      return next;
    });
  };
  const toggleSelectAllInList = (items: TrackingItem[]) => {
    const ids = items.map((i) => i.sample.sampleId);
    const allSelected = ids.every((id) => selectedSampleIds.has(id));
    setSelectedSampleIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };
  const handleBulkStageChange = async () => {
    if (selectedSampleIds.size === 0) return;
    try {
      await bulkUpdateStageMutation({ sampleIds: Array.from(selectedSampleIds), currentStage: bulkStageValue });
      showToast(`${selectedSampleIds.size} דוגמיות עודכנו`, 'success');
      setSelectedSampleIds(new Set());
    } catch { showToast('שגיאה בעדכון', 'error'); }
  };
  const handleBulkDelete = async () => {
    if (selectedSampleIds.size === 0) return;
    if (!(await confirm(`האם למחוק ${selectedSampleIds.size} דוגמיות?`))) return;
    try {
      await bulkDeleteMutation({ sampleIds: Array.from(selectedSampleIds) });
      showToast(`${selectedSampleIds.size} דוגמיות נמחקו`, 'success');
      setSelectedSampleIds(new Set());
    } catch { showToast('שגיאה במחיקה', 'error'); }
  };
  const handleCopyTracking = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast('הועתק', 'success');
  };

  const renderTrackingTable = (
    items: TrackingItem[],
    sort: { key: SortKey | null; dir: SortDir },
    onSort: (key: SortKey) => void,
    showFuzzyMatch: boolean,
  ) => {
    if (items.length === 0) {
      return <p className="text-center text-gray-400 text-sm py-8">אין תוצאות</p>;
    }
    const allIds = items.map((i) => i.sample.sampleId);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedSampleIds.has(id));

    return (
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 sticky top-[37px] z-[1]">
            <th className="w-[28px] px-1 py-1.5 text-center">
              <input type="checkbox" checked={allSelected} onChange={() => toggleSelectAllInList(items)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
            </th>
            <th className="px-1 py-1.5 text-center text-xs font-medium text-gray-500 w-[36px]">תמונה</th>
            <ColHeader label="מעקב" sortKey="trackingNumber" currentKey={sort.key} dir={sort.dir} onSort={onSort} />
            {showFuzzyMatch && <th className="px-1 py-1.5 text-right text-xs font-medium text-gray-400 whitespace-nowrap">חיפוש</th>}
            <ColHeader label="קטע" sortKey="leg" currentKey={sort.key} dir={sort.dir} onSort={onSort} />
            <ColHeader label="ספק" sortKey="supplierName" currentKey={sort.key} dir={sort.dir} onSort={onSort} />
            <ColHeader label="ערכה" sortKey="kitName" currentKey={sort.key} dir={sort.dir} onSort={onSort} />
            <ColHeader label="מוצר" sortKey="productName" currentKey={sort.key} dir={sort.dir} onSort={onSort} />
            <ColHeader label="שלב" sortKey="stage" currentKey={sort.key} dir={sort.dir} onSort={onSort} />
            <th className="px-1 py-1.5 text-center text-xs font-medium text-gray-500 w-[60px]">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const sample = item.sample;
            const isExact = item.fuzzyScore !== undefined && item.fuzzyScore <= 0.1;
            const firstImage = item.imageUrls?.[0];
            return (
              <tr key={item._id}
                className={`border-b border-gray-100 hover:bg-blue-50/30 ${selectedSampleIds.has(sample.sampleId) ? 'bg-blue-50/50' : ''} ${sample.archived ? 'opacity-50' : ''}`}>
                <td className="px-1 py-1 text-center">
                  <input type="checkbox" checked={selectedSampleIds.has(sample.sampleId)}
                    onChange={() => toggleSelectSample(sample.sampleId)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </td>
                <td className="px-1 py-1 text-center">
                  {firstImage ? (
                    <img
                      src={firstImage}
                      alt=""
                      className="w-8 h-8 object-cover rounded cursor-pointer border border-gray-200 hover:border-blue-400 transition-colors mx-auto"
                      onClick={() => setLightboxImage(firstImage)}
                    />
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center mx-auto">
                      <PhotoIcon className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </td>
                <td className="px-2 py-1 font-mono text-xs text-gray-700">
                  <button onClick={() => handleCopyTracking(item.trackingNumber)}
                    className="hover:text-blue-600 hover:underline cursor-pointer text-right truncate max-w-[120px] block" title={item.trackingNumber}>
                    {item.trackingNumber}
                  </button>
                </td>
                {showFuzzyMatch && (
                  <td className="px-1 py-1 text-xs">
                    {item.matchedTerm && !isExact && (
                      <span className="font-mono text-amber-600 bg-amber-50 px-1 rounded truncate max-w-[80px] block" dir="ltr"
                        title={`דמיון: ${Math.round((1 - (item.fuzzyScore ?? 0)) * 100)}%`}>
                        {item.matchedTerm}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-2 py-1 text-xs text-gray-500 whitespace-nowrap">{item.leg}</td>
                <td className="px-2 py-1 font-medium text-gray-900 text-xs truncate max-w-[80px]" title={item.supplierName}>{item.supplierName}</td>
                <td className="px-2 py-1 text-xs text-gray-500 truncate max-w-[80px]" title={item.kitName}>
                  <Link href={`/kits/${item.kitId}/samples`} className="hover:text-blue-600 hover:underline">{item.kitName}</Link>
                </td>
                <td className="px-2 py-1 text-xs text-gray-500 truncate max-w-[70px]" title={item.productName}>{item.productName}</td>
                <td className="px-2 py-1">
                  <StagePill currentStage={sample.currentStage} onStageChange={(stageId) => handleStageChange(sample.sampleId, stageId)} />
                </td>
                <td className="px-1 py-1">
                  <div className="flex items-center gap-0.5 justify-center">
                    <button onClick={() => handleCopyTracking(item.trackingNumber)}
                      className="p-0.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="העתק">
                      <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleArchiveSample(sample.sampleId, !!sample.archived)}
                      className={`p-0.5 rounded transition-colors ${sample.archived ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}
                      title={sample.archived ? 'שחזר' : 'ארכיון'}>
                      {sample.archived ? <ArchiveBoxXMarkIcon className="w-3.5 h-3.5" /> : <ArchiveBoxIcon className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDeleteSample(sample.sampleId)}
                      className="p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="מחק">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const isLoading = !allTrackingData || !allKits;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-[1800px] mx-auto px-4 py-4 space-y-4 flex-1 flex flex-col w-full">
        <h2 className="text-xl font-bold text-gray-900">חיפוש מעקב מתקדם</h2>
        {/* Search Controls */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 shrink-0">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">מספרי מעקב (מופרדים ברווח, פסיק או שורה)</label>
              <textarea value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                placeholder="הדבק מספרי מעקב כאן..."
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono min-h-[80px]"
                rows={4} dir="ltr"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSearch(); } }} />
            </div>
            <div className="flex flex-col gap-3 w-56 shrink-0">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">טווח חיפוש</label>
                <select value={searchScope} onChange={(e) => setSearchScope(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="all">כל הערכות</option>
                  {allKits?.map((kit) => (<option key={kit.kitId} value={kit.kitId}>{kit.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">רגישות התאמה: {fuzzyThreshold}%</label>
                <input type="range" min={0} max={50} value={fuzzyThreshold}
                  onChange={(e) => setFuzzyThreshold(parseInt(e.target.value))} className="w-full accent-blue-600" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>מדויק</span><span>גמיש</span></div>
              </div>
              <button onClick={handleSearch} disabled={!searchInput.trim() || isLoading}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 rounded-lg transition-colors">
                <MagnifyingGlassIcon className="w-4 h-4" />
                חפש
              </button>
            </div>
          </div>
          {hasSearched && (
            <div className="flex items-center gap-6 pt-2 border-t border-gray-100 text-sm">
              <span className="text-gray-500">{searchTerms.length} מספרי מעקב הוזנו</span>
              <span className="flex items-center gap-1.5 text-green-600 font-medium"><CheckCircleIcon className="w-4 h-4" />{found.length} נמצאו</span>
              <span className="flex items-center gap-1.5 text-red-500 font-medium"><ExclamationTriangleIcon className="w-4 h-4" />{notFound.length} לא נמצאו</span>
              <span className="flex items-center gap-1.5 text-gray-400"><QuestionMarkCircleIcon className="w-4 h-4" />{notSearched.length} לא חיפשת</span>
              {fuzzyThreshold > 0 && (
                <span className="flex items-center gap-1 text-amber-600 text-xs"><ArrowPathIcon className="w-3.5 h-3.5" />התאמה גמישה ({fuzzyThreshold}%)</span>
              )}
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedSampleIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center gap-4 sticky top-[57px] z-10 shrink-0">
            <span className="text-sm font-semibold text-blue-700">{selectedSampleIds.size} נבחרו</span>
            <div className="flex items-center gap-2">
              <select value={bulkStageValue} onChange={(e) => setBulkStageValue(parseInt(e.target.value))}
                className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg">
                {SAMPLE_STAGES.map((stage) => (<option key={stage.id} value={stage.id}>{stage.name}</option>))}
              </select>
              <button onClick={handleBulkStageChange}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">שנה שלב</button>
            </div>
            <button onClick={handleBulkDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
              <TrashIcon className="w-3.5 h-3.5" />מחק
            </button>
            <button onClick={() => setSelectedSampleIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 mr-auto">בטל בחירה</button>
          </div>
        )}

        {/* Results with draggable panels */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">טוען...</div>
        ) : !hasSearched ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <MagnifyingGlassIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-500 mb-1">הזן מספרי מעקב</p>
            <p className="text-sm">הדבק מספרי מעקב בתיבה למעלה ולחץ חפש</p>
          </div>
        ) : (
          <div ref={containerRef} className="flex flex-1 gap-0 min-h-0" style={{ height: 'calc(100vh - 320px)' }}>
            {/* Panel 1: Found */}
            <div className="bg-white rounded-r-xl border border-green-200 overflow-hidden flex flex-col min-w-0" style={{ width: `${pcts[0]}%` }}>
              <div className="px-3 py-2 bg-green-50 border-b border-green-200 shrink-0">
                <div className="flex items-center gap-1.5">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">נמצאו ({found.length})</span>
                </div>
              </div>
              <div className="overflow-auto flex-1">{renderTrackingTable(sortedFound, foundSort, (key) => toggleSort(foundSort, setFoundSort, key), true)}</div>
            </div>

            {/* Resizer 1 */}
            <div
              className="w-2 shrink-0 cursor-col-resize hover:bg-blue-200 bg-gray-200 transition-colors flex items-center justify-center group"
              onMouseDown={(e) => onMouseDown(0, e)}
            >
              <div className="w-0.5 h-8 bg-gray-400 group-hover:bg-blue-500 rounded-full" />
            </div>

            {/* Panel 2: Not Searched */}
            <div className="bg-white border border-gray-200 overflow-hidden flex flex-col min-w-0" style={{ width: `${pcts[1]}%` }}>
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-1.5">
                  <QuestionMarkCircleIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700">לא חיפשת ({notSearched.length})</span>
                </div>
              </div>
              <div className="overflow-auto flex-1">{renderTrackingTable(sortedNotSearched, notSearchedSort, (key) => toggleSort(notSearchedSort, setNotSearchedSort, key), false)}</div>
            </div>

            {/* Resizer 2 */}
            <div
              className="w-2 shrink-0 cursor-col-resize hover:bg-blue-200 bg-gray-200 transition-colors flex items-center justify-center group"
              onMouseDown={(e) => onMouseDown(1, e)}
            >
              <div className="w-0.5 h-8 bg-gray-400 group-hover:bg-blue-500 rounded-full" />
            </div>

            {/* Panel 3: Not Found */}
            <div className="bg-white rounded-l-xl border border-red-200 overflow-hidden flex flex-col min-w-0" style={{ width: `${pcts[2]}%` }}>
              <div className="px-3 py-2 bg-red-50 border-b border-red-200 shrink-0">
                <div className="flex items-center gap-1.5">
                  <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-800">לא נמצאו ({notFound.length})</span>
                </div>
              </div>
              <div className="overflow-auto flex-1">
                {notFound.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">כל מספרי המעקב נמצאו</p>
                ) : (
                  <div className="p-2 space-y-1">
                    {notFound.map((term) => (
                      <div key={term} className="flex items-center justify-between px-2.5 py-2 bg-red-50/50 border border-red-100 rounded-lg">
                        <span className="font-mono text-sm text-red-700 truncate" dir="ltr">{term}</span>
                        <button onClick={() => handleCopyTracking(term)} className="p-1 text-gray-400 hover:text-gray-600 shrink-0" title="העתק">
                          <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setLightboxImage(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={() => setLightboxImage(null)}>
            <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden max-w-lg max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
              <img src={lightboxImage} alt="" className="max-w-full max-h-[65vh] object-contain" />
              <button onClick={() => setLightboxImage(null)}
                className="absolute top-2 left-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {ConfirmDialog}
    </div>
  );
}
