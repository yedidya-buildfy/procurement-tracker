'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import DimensionInput from '@/components/ui/DimensionInput';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/useConfirm';
import StagePill from './StagePill';
import SampleViewModal, { SampleViewFilters } from './SampleViewModal';
import Link from 'next/link';
import { SAMPLE_STAGES } from '@/lib/sampleStages';
import { exportSamplesToXLSX, stageToEnglish, trackingLegToEnglish, SampleExportRow } from '@/lib/exportSamples';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  PhotoIcon,
  XMarkIcon,
  StarIcon as StarOutline,
  ChevronUpIcon,
  ChevronDownIcon,
  FunnelIcon,
  ClipboardDocumentIcon,
  ArchiveBoxIcon,
  ArchiveBoxXMarkIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ChatBubbleLeftRightIcon,
  ArrowUpOnSquareIcon,
  Squares2X2Icon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { Doc, Id } from '../../../convex/_generated/dataModel';

function SortHeader({ label, sortKey: key, currentKey, dir, onSort, className = '', center = false }: {
  label: string;
  sortKey: string;
  currentKey: string | null;
  dir: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
  center?: boolean;
}) {
  const isActive = currentKey === key;
  return (
    <th
      className={`py-2.5 font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors ${center ? 'text-center' : 'text-right'} ${className}`}
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`inline-flex flex-col ${isActive ? 'text-blue-600' : 'text-gray-300'}`}>
          <ChevronUpIcon className={`w-3 h-3 -mb-1 ${isActive && dir === 'asc' ? 'text-blue-600' : ''}`} />
          <ChevronDownIcon className={`w-3 h-3 ${isActive && dir === 'desc' ? 'text-blue-600' : ''}`} />
        </span>
      </span>
    </th>
  );
}

interface KitSummary {
  kitId: string;
  name: string;
}

interface SampleImage {
  _id: string;
  sampleId: string;
  url: string | null;
  caption?: string;
}

type ActiveTab =
  | { type: 'all' }
  | { type: 'product'; productId: string }
  | { type: 'view'; viewId: string };

interface SamplesTabProps {
  kitId: string;
  products: Doc<'kitProducts'>[];
  samples: Doc<'samples'>[];
  sampleMilestones: Doc<'sampleMilestones'>[];
  trackingNumbers: Doc<'sampleTrackingNumbers'>[];
  sampleImages: SampleImage[];
  suppliers: Doc<'suppliers'>[];
  allSuppliers: Doc<'suppliers'>[];
  allKits: KitSummary[];
  views: Doc<'kitSampleViews'>[];
  kitSearch?: string;
  onForwardToFinal?: (data: {
    kitProductId: string;
    supplierId: string;
    weight?: string;
    volume?: string;
    dimHeight?: string;
    dimWidth?: string;
    dimLength?: string;
    notes?: string;
  }) => void;
}

export default function SamplesTab({
  kitId,
  products,
  samples,
  sampleMilestones,
  trackingNumbers,
  sampleImages,
  suppliers,
  allSuppliers,
  allKits,
  views,
  kitSearch = '',
  onForwardToFinal,
}: SamplesTabProps) {
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const addProductMutation = useMutation(api.kits.addKitProduct);
  const updateProductMutation = useMutation(api.kits.updateKitProduct);
  const deleteProductMutation = useMutation(api.kits.deleteKitProduct);
  const addSampleMutation = useMutation(api.kits.addSample);
  const updateSampleMutation = useMutation(api.kits.updateSample);
  const deleteSampleMutation = useMutation(api.kits.deleteSample);
  const moveProductMutation = useMutation(api.kits.moveProductToKit);
  const addTrackingMutation = useMutation(api.kits.addTrackingNumber);
  const deleteTrackingMutation = useMutation(api.kits.deleteTrackingNumber);
  const bulkUpdateStageMutation = useMutation(api.kits.bulkUpdateSampleStage);
  const bulkDeleteMutation = useMutation(api.kits.bulkDeleteSamples);
  const addSupplierMutation = useMutation(api.suppliers.addSupplier);
  const updateSupplierMutation = useMutation(api.suppliers.updateSupplier);
  const generateUploadUrlMutation = useMutation(api.kits.generateUploadUrl);
  const addImageMutation = useMutation(api.kits.addSampleImage);
  const deleteImageMutation = useMutation(api.kits.deleteSampleImage);
  const deleteViewMutation = useMutation(api.kitSampleViews.deleteView);

  const [activeTab, setActiveTab] = useState<ActiveTab>({ type: 'all' });
  const activeProductId = activeTab.type === 'product' ? activeTab.productId : '';
  const isMultiProductScope = activeTab.type !== 'product';
  const [showAddTabMenu, setShowAddTabMenu] = useState(false);
  const [viewModal, setViewModal] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; viewId: string; name: string; filters: SampleViewFilters }
    | null
  >(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', category: '', notes: '' });
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editProductData, setEditProductData] = useState({ name: '' });
  const [moveProduct, setMoveProduct] = useState<{ kitProductId: string; name: string } | null>(null);
  const [moveTargetKitId, setMoveTargetKitId] = useState('');
  const [chatUrlModal, setChatUrlModal] = useState<{ supplierId: string } | null>(null);
  const [chatUrlInput, setChatUrlInput] = useState('');
  const [showAddSample, setShowAddSample] = useState(false);
  const [newSample, setNewSample] = useState({
    supplierId: '',
    supplierSearch: '',
    sampleCost: '',
    currentStage: 0,
    notes: '',
    weight: '',
    volume: '',
    dimHeight: '',
    dimWidth: '',
    dimLength: '',
  });
  const [newSampleFiles, setNewSampleFiles] = useState<File[]>([]);

  // Inline editing state
  const [showRatingModal, setShowRatingModal] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingNotes, setRatingNotes] = useState('');
  const [showTrackingModal, setShowTrackingModal] = useState<string | null>(null);
  const [newTracking, setNewTracking] = useState({ leg: '', trackingNumber: '', carrier: '' });
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [uploadingSampleId, setUploadingSampleId] = useState<string | null>(null);
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [editSampleForm, setEditSampleForm] = useState({
    sampleCost: '',
    currentStage: 0,
    notes: '',
  });

  // Filter & sort
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState<number[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Tracking search
  const [trackingSearch, setTrackingSearch] = useState('');
  const trackingSearchResults = useQuery(
    api.kits.searchTrackingNumbers,
    trackingSearch.trim().length >= 2 ? { searchTerm: trackingSearch.trim() } : 'skip'
  );

  // Selection & bulk actions
  const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set());
  const [bulkStageValue, setBulkStageValue] = useState<number>(0);

  const activeProduct = activeTab.type === 'product'
    ? products.find((p) => p.kitProductId === activeTab.productId)
    : undefined;
  const activeView = activeTab.type === 'view'
    ? views.find((v) => v.viewId === activeTab.viewId)
    : undefined;

  const getSupplierName = (supplierId: string) => {
    const allSups = [...suppliers, ...allSuppliers];
    return allSups.find((sup) => sup.supplierId === supplierId)?.name || supplierId;
  };

  const getSupplierChatUrl = (supplierId: string) => {
    const allSups = [...suppliers, ...allSuppliers];
    return allSups.find((sup) => sup.supplierId === supplierId)?.alibabaChatUrl;
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(null); setSortDir('asc'); }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Tracking search: matched sample IDs (tracking number OR supplier name)
  const trackingMatchedSampleIds = useMemo(() => {
    const term = trackingSearch.trim().toLowerCase();
    if (!term) return null;

    const matched = new Set<string>();

    // Match by tracking number (from Convex search)
    if (trackingSearchResults) {
      for (const t of trackingSearchResults) matched.add(t.sampleId);
    }

    // Match by supplier name (client-side)
    const allSups = [...suppliers, ...allSuppliers];
    for (const sample of samples) {
      const sup = allSups.find((s) => s.supplierId === sample.supplierId);
      if (sup && sup.name.toLowerCase().includes(term)) {
        matched.add(sample.sampleId);
      }
    }

    return matched;
  }, [trackingSearch, trackingSearchResults, samples, suppliers, allSuppliers]);

  // Kit-wide search: match sample by supplier, notes, tracking, cost
  const kitSearchMatched = useMemo(() => {
    const term = kitSearch.trim().toLowerCase();
    if (!term) return null;
    const matched = new Set<string>();
    const allSups = [...suppliers, ...allSuppliers];
    for (const sample of samples) {
      const sup = allSups.find((s) => s.supplierId === sample.supplierId);
      if (sup && sup.name.toLowerCase().includes(term)) { matched.add(sample.sampleId); continue; }
      if (sample.notes && sample.notes.toLowerCase().includes(term)) { matched.add(sample.sampleId); continue; }
      if (sample.sampleCost != null && sample.sampleCost.toString().includes(term)) { matched.add(sample.sampleId); continue; }
      if (sample.ratingNotes && sample.ratingNotes.toLowerCase().includes(term)) { matched.add(sample.sampleId); continue; }
      const tracks = trackingNumbers.filter((t) => t.sampleId === sample.sampleId);
      if (tracks.some((t) => t.trackingNumber.toLowerCase().includes(term))) { matched.add(sample.sampleId); continue; }
    }
    return matched;
  }, [kitSearch, samples, suppliers, allSuppliers, trackingNumbers]);

  // Filter and sort samples — scope depends on the active tab.
  const sampleImageCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const img of sampleImages) {
      counts.set(img.sampleId, (counts.get(img.sampleId) || 0) + 1);
    }
    return counts;
  }, [sampleImages]);

  const productSamplesAll = useMemo(() => {
    if (activeTab.type === 'product') {
      return samples.filter((s) => s.kitProductId === activeTab.productId);
    }
    // 'all' or 'view' — span every sample in the kit (samples are already kit-scoped via getKitFull)
    let scope = samples;
    if (activeTab.type === 'view' && activeView) {
      const { stages, hasImage } = activeView.filters;
      scope = scope.filter((s) => {
        if (stages && stages.length > 0) {
          const stageId = s.currentStage ?? -1;
          if (!stages.includes(stageId)) return false;
        }
        if (hasImage !== undefined) {
          const has = (sampleImageCount.get(s.sampleId) || 0) > 0;
          if (has !== hasImage) return false;
        }
        return true;
      });
    }
    return scope;
  }, [samples, activeTab, activeView, sampleImageCount]);
  const archivedCount = productSamplesAll.filter((s) => s.archived).length;
  const productSamplesRaw = productSamplesAll.filter((s) => showArchived || !s.archived);
  const productSamples = productSamplesRaw
    .filter((s) => {
      if (starFilter !== null) {
        if (starFilter === 0 ? s.rating : s.rating !== starFilter) return false;
      }
      if (stageFilter.length > 0) {
        const stageId = s.currentStage ?? -1;
        if (!stageFilter.includes(stageId)) return false;
      }
      if (trackingMatchedSampleIds !== null && !trackingMatchedSampleIds.has(s.sampleId)) return false;
      if (kitSearchMatched !== null && !kitSearchMatched.has(s.sampleId)) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortKey) return 0;
      let cmp = 0;
      switch (sortKey) {
        case 'product': {
          const aName = products.find((p) => p.kitProductId === a.kitProductId)?.name || '';
          const bName = products.find((p) => p.kitProductId === b.kitProductId)?.name || '';
          cmp = aName.localeCompare(bName);
          break;
        }
        case 'supplier':
          cmp = getSupplierName(a.supplierId).localeCompare(getSupplierName(b.supplierId));
          break;
        case 'cost':
          cmp = (a.sampleCost || 0) - (b.sampleCost || 0);
          break;
        case 'paid':
          cmp = (a.paid ? 1 : 0) - (b.paid ? 1 : 0);
          break;
        case 'rating':
          cmp = (a.rating || 0) - (b.rating || 0);
          break;
        case 'stage':
          cmp = (a.currentStage ?? -1) - (b.currentStage ?? -1);
          break;
        case 'images': {
          const aCount = sampleImages.filter((i) => i.sampleId === a.sampleId).length;
          const bCount = sampleImages.filter((i) => i.sampleId === b.sampleId).length;
          cmp = aCount - bCount;
          break;
        }
        case 'date':
          cmp = a.createdDate.localeCompare(b.createdDate);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

  const filteredSupplierSuggestions = allSuppliers.filter((s) =>
    s.name.toLowerCase().includes(newSample.supplierSearch.toLowerCase())
  );


  // Handlers
  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) return;
    try {
      const id = await addProductMutation({
        kitId,
        name: newProduct.name,
        category: newProduct.category || undefined,
        notes: newProduct.notes || undefined,
      });
      showToast('מוצר נוסף בהצלחה', 'success');
      setShowAddProduct(false);
      setNewProduct({ name: '', category: '', notes: '' });
      setActiveTab({ type: 'product', productId: id });
    } catch (error) {
      console.error('Error adding product:', error);
      showToast('שגיאה בהוספת מוצר', 'error');
    }
  };

  const handleUpdateProduct = async (kitProductId: string) => {
    try {
      await updateProductMutation({ kitProductId, name: editProductData.name || undefined });
      showToast('מוצר עודכן', 'success');
      setEditingProduct(null);
    } catch (error) {
      console.error('Error updating product:', error);
      showToast('שגיאה בעדכון מוצר', 'error');
    }
  };

  const handleDeleteProduct = async (kitProductId: string) => {
    if (!(await confirm('האם למחוק את המוצר וכל הדוגמיות שלו?'))) return;
    try {
      await deleteProductMutation({ kitProductId });
      showToast('מוצר נמחק', 'success');
      if (activeTab.type === 'product' && activeTab.productId === kitProductId) {
        setActiveTab({ type: 'all' });
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      showToast('שגיאה במחיקת מוצר', 'error');
    }
  };

  const handleDeleteView = async (viewId: string) => {
    if (!(await confirm('האם למחוק את התצוגה?'))) return;
    try {
      await deleteViewMutation({ viewId });
      showToast('תצוגה נמחקה', 'success');
      if (activeTab.type === 'view' && activeTab.viewId === viewId) {
        setActiveTab({ type: 'all' });
      }
    } catch (error) {
      console.error('Error deleting view:', error);
      showToast('שגיאה במחיקת תצוגה', 'error');
    }
  };

  const handleMoveProduct = async () => {
    if (!moveProduct || !moveTargetKitId) return;
    try {
      await moveProductMutation({ kitProductId: moveProduct.kitProductId, newKitId: moveTargetKitId });
      showToast('מוצר הועבר בהצלחה', 'success');
      setMoveProduct(null);
      setMoveTargetKitId('');
    } catch (error) {
      console.error('Error moving product:', error);
      showToast('שגיאה בהעברת מוצר', 'error');
    }
  };

  const handleAddSample = async () => {
    if (!newSample.supplierId) return;
    try {
      const sampleId = await addSampleMutation({
        kitProductId: activeProductId,
        supplierId: newSample.supplierId,
        sampleCost: newSample.sampleCost ? parseFloat(newSample.sampleCost) : undefined,
        paid: false,
        notes: newSample.notes || undefined,
        weight: newSample.weight ? parseFloat(newSample.weight) : undefined,
        volume: newSample.volume ? parseFloat(newSample.volume) : undefined,
        dimHeight: newSample.dimHeight ? parseFloat(newSample.dimHeight) : undefined,
        dimWidth: newSample.dimWidth ? parseFloat(newSample.dimWidth) : undefined,
        dimLength: newSample.dimLength ? parseFloat(newSample.dimLength) : undefined,
      });

      // Set the stage
      if (newSample.currentStage >= 0) {
        await updateSampleMutation({ sampleId, currentStage: newSample.currentStage });
      }

      // Upload images if any
      if (newSampleFiles.length > 0) {
        for (const file of newSampleFiles) {
          const uploadUrl = await generateUploadUrlMutation();
          const result = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
          const { storageId } = await result.json();
          await addImageMutation({ sampleId, storageId });
        }
      }

      showToast('דוגמית נוספה בהצלחה', 'success');
      setShowAddSample(false);
      setNewSample({ supplierId: '', supplierSearch: '', sampleCost: '', currentStage: 0, notes: '', weight: '', volume: '', dimHeight: '', dimWidth: '', dimLength: '' });
      setNewSampleFiles([]);
    } catch (error) {
      console.error('Error adding sample:', error);
      showToast('שגיאה בהוספת דוגמית', 'error');
    }
  };

  const handleDeleteSample = async (sampleId: string) => {
    if (!(await confirm('האם למחוק את הדוגמית?'))) return;
    try {
      await deleteSampleMutation({ sampleId });
      showToast('דוגמית נמחקה', 'success');
    } catch (error) {
      console.error('Error deleting sample:', error);
      showToast('שגיאה במחיקת דוגמית', 'error');
    }
  };

  const handleSaveRating = async () => {
    if (!showRatingModal) return;
    try {
      await updateSampleMutation({ sampleId: showRatingModal, rating: ratingValue, ratingNotes });
      showToast('דירוג נשמר', 'success');
      setShowRatingModal(null);
    } catch (error) {
      console.error('Error saving rating:', error);
      showToast('שגיאה בשמירת דירוג', 'error');
    }
  };


  const handleAddTracking = async () => {
    if (!showTrackingModal || !newTracking.leg || !newTracking.trackingNumber.trim()) return;
    try {
      await addTrackingMutation({ sampleId: showTrackingModal, leg: newTracking.leg, trackingNumber: newTracking.trackingNumber, carrier: newTracking.carrier || undefined });
      showToast('מספר מעקב נוסף', 'success');
      setShowTrackingModal(null);
      setNewTracking({ leg: '', trackingNumber: '', carrier: '' });
    } catch (error) {
      console.error('Error adding tracking:', error);
      showToast('שגיאה בהוספת מספר מעקב', 'error');
    }
  };

  const handleStageChange = async (sampleId: string, stageId: number) => {
    try {
      await updateSampleMutation({ sampleId, currentStage: stageId });
    } catch (error) {
      console.error('Error updating stage:', error);
      showToast('שגיאה בעדכון שלב', 'error');
    }
  };

  const startEditSample = (sample: Doc<'samples'>) => {
    setEditingSampleId(sample.sampleId);
    setEditSampleForm({
      sampleCost: sample.sampleCost?.toString() || '',
      currentStage: sample.currentStage ?? 0,
      notes: sample.notes || '',
    });
  };

  const handleUpdateSample = async () => {
    if (!editingSampleId) return;
    try {
      await updateSampleMutation({
        sampleId: editingSampleId,
        sampleCost: editSampleForm.sampleCost ? parseFloat(editSampleForm.sampleCost) : undefined,
        currentStage: editSampleForm.currentStage,
        notes: editSampleForm.notes || undefined,
      });
      showToast('דוגמית עודכנה', 'success');
      setEditingSampleId(null);
    } catch (error) {
      console.error('Error updating sample:', error);
      showToast('שגיאה בעדכון דוגמית', 'error');
    }
  };

  const handleArchiveSample = async (sample: Doc<'samples'>) => {
    const newValue = !sample.archived;
    await updateSampleMutation({ sampleId: sample.sampleId, archived: newValue });
    showToast(newValue ? 'דוגמית הועברה לארכיון' : 'דוגמית שוחזרה', 'success');
  };

  const handleUploadImages = async (sampleId: string, files: FileList) => {
    setUploadingSampleId(sampleId);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadUrl = await generateUploadUrlMutation();
        const result = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
        const { storageId } = await result.json();
        await addImageMutation({ sampleId, storageId });
      }
      showToast(`${files.length} תמונות הועלו`, 'success');
    } catch (error) {
      console.error('Error uploading images:', error);
      showToast('שגיאה בהעלאת תמונות', 'error');
    } finally {
      setUploadingSampleId(null);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    await deleteImageMutation({ id: imageId as Id<'sampleImages'> });
  };

  const toggleSelectSample = (sampleId: string) => {
    setSelectedSampleIds((prev) => {
      const next = new Set(prev);
      if (next.has(sampleId)) next.delete(sampleId);
      else next.add(sampleId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSampleIds.size === productSamples.length) {
      setSelectedSampleIds(new Set());
    } else {
      setSelectedSampleIds(new Set(productSamples.map((s) => s.sampleId)));
    }
  };

  const handleBulkStageChange = async () => {
    if (selectedSampleIds.size === 0) return;
    try {
      await bulkUpdateStageMutation({ sampleIds: Array.from(selectedSampleIds), currentStage: bulkStageValue });
      showToast(`${selectedSampleIds.size} דוגמיות עודכנו`, 'success');
      setSelectedSampleIds(new Set());
    } catch (error) {
      console.error('Error bulk updating stage:', error);
      showToast('שגיאה בעדכון', 'error');
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportSamples = async (mode: 'selected' | 'visible') => {
    const target =
      mode === 'selected'
        ? productSamples.filter((s) => selectedSampleIds.has(s.sampleId))
        : productSamples;

    if (target.length === 0) {
      showToast('אין דוגמיות לייצוא', 'error');
      return;
    }

    const rows: SampleExportRow[] = target.map((s) => {
      const productName = products.find((p) => p.kitProductId === s.kitProductId)?.name || '';
      const supplierName = getSupplierName(s.supplierId);
      const tracks = trackingNumbers.filter((t) => t.sampleId === s.sampleId);
      const trackingStr = tracks
        .map((t) => `${trackingLegToEnglish(t.leg)}: ${t.trackingNumber}`)
        .join(' | ');
      const imageUrls = sampleImages
        .filter((i) => i.sampleId === s.sampleId)
        .map((i) => i.url)
        .filter((url): url is string => !!url);

      return {
        productName,
        supplierName,
        costUSD: s.sampleCost ?? null,
        stage: stageToEnglish(s.currentStage),
        trackingNumbers: trackingStr,
        rating: s.rating ?? null,
        ratingNotes: s.ratingNotes || '',
        notes: s.notes || '',
        archived: !!s.archived,
        imageUrls,
        createdDate: s.createdDate,
      };
    });

    const today = new Date().toISOString().split('T')[0];
    const scopeLabel =
      activeTab.type === 'product'
        ? products.find((p) => p.kitProductId === activeTab.productId)?.name || 'product'
        : activeTab.type === 'view'
          ? views.find((v) => v.viewId === activeTab.viewId)?.name || 'view'
          : 'all';

    setIsExporting(true);
    showToast('מכין קובץ אקסל עם תמונות...', 'success');
    try {
      await exportSamplesToXLSX(rows, `samples-${scopeLabel}-${today}`);
      showToast(`יוצאו ${rows.length} דוגמיות`, 'success');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('שגיאה בייצוא', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSampleIds.size === 0) return;
    if (!(await confirm(`האם למחוק ${selectedSampleIds.size} דוגמיות?`))) return;
    try {
      await bulkDeleteMutation({ sampleIds: Array.from(selectedSampleIds) });
      showToast(`${selectedSampleIds.size} דוגמיות נמחקו`, 'success');
      setSelectedSampleIds(new Set());
    } catch (error) {
      console.error('Error bulk deleting:', error);
      showToast('שגיאה במחיקה', 'error');
    }
  };

  const buildWhatsAppText = (sample: Doc<'samples'>) => {
    const supplierName = getSupplierName(sample.supplierId);
    const tracks = trackingNumbers.filter((t) => t.sampleId === sample.sampleId);
    const legTranslations: Record<string, string> = {
      'ספק לסוכן': 'Supplier to Agent',
      'סוכן אלינו': 'Agent to Us',
      'אחר': 'Other',
    };
    const lines: string[] = [];
    lines.push(`*Supplier:* ${supplierName}`);
    if (tracks.length > 0) {
      for (const t of tracks) {
        lines.push(`*Tracking (${legTranslations[t.leg] || t.leg}):* ${t.trackingNumber}`);
      }
    }
    return lines.join('\n');
  };

  const toPngBlob = async (url: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('no ctx')); return; }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('toBlob failed'));
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleCopyToClipboard = async (sample: Doc<'samples'>) => {
    const text = buildWhatsAppText(sample);
    const imgs = sampleImages.filter((i) => i.sampleId === sample.sampleId);

    if (imgs.length > 0 && imgs[0].url) {
      try {
        // 1) Copy text first (goes into clipboard history)
        await navigator.clipboard.writeText(text);

        // Small delay so clipboard history registers them as separate entries
        await new Promise((r) => setTimeout(r, 100));

        // 2) Copy image (becomes the current clipboard item, text stays in history)
        const pngBlob = await toPngBlob(imgs[0].url);
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob }),
        ]);
        showToast('הועתק: תמונה (Cmd+V) + טקסט (בהיסטוריה)', 'success');
        return;
      } catch {
        // fallback to text only
      }
    }

    await navigator.clipboard.writeText(text);
    showToast('טקסט הועתק', 'success');
  };

  return (
    <div className="space-y-0">
      {/* Tab Bar - Google Sheets style. Pinned "All", then product tabs, then saved-view tabs. */}
      <div className="flex items-center border-b bg-gray-50 rounded-t-lg overflow-x-auto">
        {/* Pinned "All" tab */}
        {(() => {
          const isActive = activeTab.type === 'all';
          return (
            <div
              key="__all__"
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-l border-gray-200 first:border-l-0 cursor-pointer select-none whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-white text-blue-700 border-b-2 border-b-blue-600 -mb-px'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab({ type: 'all' })}
              title="כל הדוגמיות בערכה"
            >
              <Squares2X2Icon className="w-4 h-4" />
              <span>הכל</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                {samples.length}
              </span>
            </div>
          );
        })()}

        {products.map((product) => {
          const count = samples.filter((s) => s.kitProductId === product.kitProductId).length;
          const isActive = activeTab.type === 'product' && activeTab.productId === product.kitProductId;
          const isEditing = editingProduct === product.kitProductId;

          return (
            <div
              key={product.kitProductId}
              className={`group relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-l border-gray-200 cursor-pointer select-none whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-white text-blue-700 border-b-2 border-b-blue-600 -mb-px'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab({ type: 'product', productId: product.kitProductId })}
            >
              {isEditing ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editProductData.name}
                    onChange={(e) => setEditProductData({ name: e.target.value })}
                    className="px-1.5 py-0.5 border rounded text-sm w-28"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateProduct(product.kitProductId);
                      if (e.key === 'Escape') setEditingProduct(null);
                    }}
                  />
                  <button onClick={() => handleUpdateProduct(product.kitProductId)} className="text-green-600 text-xs">V</button>
                  <button onClick={() => setEditingProduct(null)} className="text-red-500 text-xs">X</button>
                </div>
              ) : (
                <>
                  <span>{product.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                    {count}
                  </span>
                  {/* Actions on hover */}
                  <div className="hidden group-hover:flex items-center gap-0.5 mr-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProduct(product.kitProductId);
                        setEditProductData({ name: product.name });
                      }}
                      className="p-0.5 text-gray-400 hover:text-blue-600 rounded"
                    >
                      <PencilIcon className="w-3 h-3" />
                    </button>
                    {allKits.filter((k) => k.kitId !== kitId).length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoveProduct({ kitProductId: product.kitProductId, name: product.name });
                          setMoveTargetKitId('');
                        }}
                        className="p-0.5 text-gray-400 hover:text-blue-600 rounded"
                      >
                        <ArrowsRightLeftIcon className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProduct(product.kitProductId);
                      }}
                      className="p-0.5 text-gray-400 hover:text-red-500 rounded"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Saved view tabs */}
        {views.map((view) => {
          const isActive = activeTab.type === 'view' && activeTab.viewId === view.viewId;
          return (
            <div
              key={view.viewId}
              className={`group relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-l border-gray-200 cursor-pointer select-none whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-white text-blue-700 border-b-2 border-b-blue-600 -mb-px'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab({ type: 'view', viewId: view.viewId })}
              title="תצוגה שמורה"
            >
              <FunnelIcon className="w-3.5 h-3.5 text-gray-400" />
              <span>{view.name}</span>
              <div className="hidden group-hover:flex items-center gap-0.5 mr-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewModal({
                      mode: 'edit',
                      viewId: view.viewId,
                      name: view.name,
                      filters: view.filters,
                    });
                  }}
                  className="p-0.5 text-gray-400 hover:text-blue-600 rounded"
                  title="ערוך"
                >
                  <PencilIcon className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteView(view.viewId);
                  }}
                  className="p-0.5 text-gray-400 hover:text-red-500 rounded"
                  title="מחק"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add tab popover */}
        <div className="relative">
          <button
            onClick={() => setShowAddTabMenu((v) => !v)}
            className="flex items-center gap-1 px-3 py-2.5 text-sm text-gray-400 hover:text-blue-600 hover:bg-gray-100 transition-colors border-l border-gray-200"
            title="הוסף..."
          >
            <PlusIcon className="w-4 h-4" />
          </button>
          {showAddTabMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAddTabMenu(false)}
              />
              <div className="absolute z-20 top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                <button
                  onClick={() => {
                    setShowAddTabMenu(false);
                    setShowAddProduct(true);
                  }}
                  className="w-full text-right px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4 text-gray-400" />
                  מוצר חדש
                </button>
                <button
                  onClick={() => {
                    setShowAddTabMenu(false);
                    setViewModal({ mode: 'create' });
                  }}
                  className="w-full text-right px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <FunnelIcon className="w-4 h-4 text-gray-400" />
                  תצוגה חדשה
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table Content */}
      {(activeTab.type !== 'product' || activeProduct) ? (
        <div className="bg-white">
          {/* Tracking Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={trackingSearch}
              onChange={(e) => setTrackingSearch(e.target.value)}
              placeholder="חפש מספר מעקב או ספק..."
              className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-64"
            />
            {trackingSearch.trim() && (
              <button onClick={() => setTrackingSearch('')} className="p-0.5 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
            {trackingMatchedSampleIds !== null && (
              <span className="text-xs text-gray-400">{trackingMatchedSampleIds.size} תוצאות</span>
            )}
            <Link
              href="/kits/tracking-search"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors mr-auto"
            >
              <AdjustmentsHorizontalIcon className="w-4 h-4" />
              חיפוש מתקדם
            </Link>
            <button
              onClick={() => handleExportSamples('visible')}
              disabled={productSamples.length === 0 || isExporting}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              title="ייצוא לאקסל (תצוגה נוכחית)"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {isExporting ? 'מייצא...' : 'ייצוא לאקסל'}
            </button>
          </div>

          {/* Bulk Actions Bar */}
          {selectedSampleIds.size > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 border-b border-blue-200 bg-blue-50">
              <span className="text-sm font-medium text-blue-700">{selectedSampleIds.size} נבחרו</span>
              <div className="flex items-center gap-1.5">
                <select
                  value={bulkStageValue}
                  onChange={(e) => setBulkStageValue(parseInt(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  {SAMPLE_STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleBulkStageChange}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  שנה שלב
                </button>
              </div>
              <button
                onClick={() => handleExportSamples('selected')}
                disabled={isExporting}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                {isExporting ? 'מייצא...' : 'ייצוא לאקסל'}
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                מחק
              </button>
              <button
                onClick={() => setSelectedSampleIds(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 mr-auto"
              >
                בטל בחירה
              </button>
            </div>
          )}

          {/* Stage Filter Bar */}
          <div className="flex items-center flex-wrap gap-2 px-3 py-2 border-b border-gray-100">
            <FunnelIcon className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">איפה הדוגמית:</span>
            <button
              onClick={() => setStageFilter([])}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                stageFilter.length === 0 ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              הכל
            </button>
            <button
              onClick={() =>
                setStageFilter((prev) => (prev.includes(-1) ? prev.filter((s) => s !== -1) : [...prev, -1]))
              }
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                stageFilter.includes(-1) ? 'bg-gray-200 text-gray-700 font-medium' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              לא הוזמן
            </button>
            {SAMPLE_STAGES.map((stage) => {
              const active = stageFilter.includes(stage.id);
              return (
                <button
                  key={stage.id}
                  onClick={() =>
                    setStageFilter((prev) => (prev.includes(stage.id) ? prev.filter((s) => s !== stage.id) : [...prev, stage.id]))
                  }
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                    active ? `${stage.bg} ${stage.text} font-medium` : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {stage.name}
                </button>
              );
            })}
          </div>

          {/* Star Filter Bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <FunnelIcon className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">סינון דירוג:</span>
            <button
              onClick={() => setStarFilter(null)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                starFilter === null ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              הכל
            </button>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                onClick={() => setStarFilter(starFilter === star ? null : star)}
                className={`flex items-center gap-0.5 px-2 py-0.5 text-xs rounded-full transition-colors ${
                  starFilter === star ? 'bg-yellow-100 text-yellow-700 font-medium' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {star}
                <StarSolid className="w-3 h-3 text-yellow-400" />
              </button>
            ))}
            <button
              onClick={() => setStarFilter(starFilter === 0 ? null : 0)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                starFilter === 0 ? 'bg-gray-200 text-gray-700 font-medium' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              ללא דירוג
            </button>
            {(starFilter !== null || stageFilter.length > 0 || showArchived) && (
              <span className="text-xs text-gray-400">
                {productSamples.length} / {productSamplesAll.length}
              </span>
            )}
            {/* Archive toggle - push to left side */}
            <div className="mr-auto">
              {archivedCount > 0 && (
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
                    showArchived ? 'bg-gray-200 text-gray-700 font-medium' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <ArchiveBoxIcon className="w-3 h-3" />
                  {showArchived ? `הסתר ארכיון (${archivedCount})` : `ארכיון (${archivedCount})`}
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-[40px] px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={productSamples.length > 0 && selectedSampleIds.size === productSamples.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  {isMultiProductScope && (
                    <SortHeader label="מוצר" sortKey="product" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-3" />
                  )}
                  <SortHeader label="תמונה" sortKey="images" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[72px] px-2" />
                  <SortHeader label="ספק" sortKey="supplier" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-3" />
                  <SortHeader label="עלות" sortKey="cost" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[70px] px-3" />
                  <SortHeader label="איפה הדוגמית" sortKey="stage" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-3" />
                  <SortHeader label="דירוג" sortKey="rating" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[100px] px-2" center />
                  <th className="px-3 py-2.5 text-right font-medium text-gray-600 whitespace-nowrap">הערות</th>
                  <th className="px-2 py-2.5 text-center font-medium text-gray-600 whitespace-nowrap w-[100px]">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {productSamples.length === 0 ? (
                  <tr>
                    <td colSpan={isMultiProductScope ? 9 : 8} className="px-3 py-8 text-center text-gray-400">
                      {starFilter !== null || stageFilter.length > 0 || trackingMatchedSampleIds !== null
                        ? 'אין דוגמיות תואמות לסינון'
                        : activeTab.type === 'product'
                          ? 'אין דוגמיות למוצר זה'
                          : activeTab.type === 'view'
                            ? 'אין דוגמיות תואמות לתצוגה'
                            : 'אין דוגמיות בערכה'}
                    </td>
                  </tr>
                ) : (
                  productSamples.map((sample) => {
                    const tracks = trackingNumbers.filter((t) => t.sampleId === sample.sampleId);
                    const imgs = sampleImages.filter((i) => i.sampleId === sample.sampleId);

                    return (
                      <tr
                        key={sample.sampleId}
                        className={`border-b border-gray-100 hover:bg-blue-50/30 ${sample.archived ? 'opacity-50' : ''} ${selectedSampleIds.has(sample.sampleId) ? 'bg-blue-50/50' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="px-2 py-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={selectedSampleIds.has(sample.sampleId)}
                            onChange={() => toggleSelectSample(sample.sampleId)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        {/* Product (cross-product views only) */}
                        {isMultiProductScope && (
                          <td className="px-3 py-2 align-middle whitespace-nowrap">
                            <button
                              onClick={() => setActiveTab({ type: 'product', productId: sample.kitProductId })}
                              className="text-sm text-gray-700 hover:text-blue-600 hover:underline"
                              title="עבור למוצר"
                            >
                              {products.find((p) => p.kitProductId === sample.kitProductId)?.name || '—'}
                            </button>
                          </td>
                        )}
                        {/* Image - first column, big */}
                        <td className="px-2 py-1 align-middle">
                          <div className="flex items-center gap-1">
                            {imgs.length > 0 && imgs[0].url ? (
                              <div className="relative group/img">
                                <img
                                  src={imgs[0].url}
                                  alt=""
                                  className="w-14 h-14 object-cover rounded-lg cursor-pointer border border-gray-200 hover:border-blue-300 transition-colors"
                                  onClick={() => setLightboxImage(imgs[0].url)}
                                />
                                {imgs.length > 1 && (
                                  <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-xs px-1 rounded">
                                    +{imgs.length - 1}
                                  </span>
                                )}
                                <button
                                  onClick={() => handleDeleteImage(imgs[0]._id)}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                >
                                  <XMarkIcon className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ) : (
                              <label className="w-14 h-14 flex items-center justify-center border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                {uploadingSampleId === sample.sampleId ? (
                                  <span className="text-xs text-gray-400">...</span>
                                ) : (
                                  <PhotoIcon className="w-5 h-5 text-gray-300" />
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(e) => {
                                    if (e.target.files) handleUploadImages(sample.sampleId, e.target.files);
                                    e.target.value = '';
                                  }}
                                  className="hidden"
                                  disabled={uploadingSampleId === sample.sampleId}
                                />
                              </label>
                            )}
                            {/* Extra images thumbnails */}
                            {imgs.length > 1 && (
                              <div className="flex flex-col gap-0.5">
                                {imgs.slice(1, 4).map((img) =>
                                  img.url ? (
                                    <img
                                      key={img._id}
                                      src={img.url}
                                      alt=""
                                      className="w-4 h-4 object-cover rounded cursor-pointer border border-gray-200"
                                      onClick={() => setLightboxImage(img.url)}
                                    />
                                  ) : null
                                )}
                              </div>
                            )}
                            {/* Upload more button when has images */}
                            {imgs.length > 0 && (
                              <label className="w-5 h-14 flex items-center justify-center cursor-pointer hover:bg-blue-50 rounded transition-colors">
                                <PlusIcon className="w-3 h-3 text-gray-300" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(e) => {
                                    if (e.target.files) handleUploadImages(sample.sampleId, e.target.files);
                                    e.target.value = '';
                                  }}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </td>

                        {/* Supplier */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900">{getSupplierName(sample.supplierId)}</span>
                            {getSupplierChatUrl(sample.supplierId) ? (
                              <a
                                href={getSupplierChatUrl(sample.supplierId)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-0.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                title="צ'אט עם הספק באליבאבא"
                              >
                                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                              </a>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChatUrlInput('');
                                  setChatUrlModal({ supplierId: sample.supplierId });
                                }}
                                className="p-0.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                                title="הוסף קישור לצ'אט באליבאבא"
                              >
                                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">{formatDate(sample.createdDate)}</div>
                        </td>

                        {/* Cost */}
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {sample.sampleCost != null && sample.sampleCost > 0 ? `$${sample.sampleCost}` : '-'}
                        </td>

                        {/* Where is the sample */}
                        <td className="px-3 py-2">
                          <div className="space-y-1.5">
                            <StagePill
                              currentStage={sample.currentStage}
                              onStageChange={(stageId) => handleStageChange(sample.sampleId, stageId)}
                            />
                            {tracks.length > 0 && (
                              <div className="space-y-0.5">
                                {tracks.map((t) => (
                                  <div key={t._id} className="flex items-center gap-1 group/track text-xs">
                                    <span className="text-gray-400">{t.leg}:</span>
                                    <span className="font-mono text-gray-600 truncate max-w-[140px]" title={t.trackingNumber}>
                                      {t.trackingNumber}
                                    </span>
                                    <button
                                      onClick={() => deleteTrackingMutation({ id: t._id })}
                                      className="opacity-0 group-hover/track:opacity-100 p-0.5 text-red-400 hover:text-red-600"
                                    >
                                      <XMarkIcon className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setShowTrackingModal(sample.sampleId);
                                setNewTracking({ leg: '', trackingNumber: '', carrier: '' });
                              }}
                              className="text-xs text-blue-500 hover:text-blue-700"
                            >
                              + מעקב
                            </button>
                          </div>
                        </td>


                        {/* Rating */}
                        <td className="px-2 py-2">
                          <button
                            onClick={() => {
                              setShowRatingModal(sample.sampleId);
                              setRatingValue(sample.rating || 0);
                              setRatingNotes(sample.ratingNotes || '');
                            }}
                            className="flex items-center gap-0.5 mx-auto hover:bg-gray-100 rounded px-1 py-0.5 transition-colors"
                          >
                            {[1, 2, 3, 4, 5].map((star) =>
                              star <= (sample.rating || 0) ? (
                                <StarSolid key={star} className="w-3.5 h-3.5 text-yellow-400" />
                              ) : (
                                <StarOutline key={star} className="w-3.5 h-3.5 text-gray-300" />
                              )
                            )}
                          </button>
                          {sample.ratingNotes && (
                            <p className="text-xs text-gray-500 mt-0.5 text-center max-w-[100px] truncate mx-auto" title={sample.ratingNotes}>
                              {sample.ratingNotes}
                            </p>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="px-3 py-2 text-xs text-gray-600 max-w-[250px]">
                          <p className="whitespace-pre-wrap line-clamp-3" title={sample.notes || ''}>
                            {sample.notes || '-'}
                          </p>
                        </td>

                        {/* Actions */}
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={() => startEditSample(sample)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="ערוך"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCopyToClipboard(sample)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="העתק לווטסאפ"
                            >
                              <ClipboardDocumentIcon className="w-4 h-4" />
                            </button>
                            {onForwardToFinal && (
                              <button
                                onClick={() => onForwardToFinal({
                                  kitProductId: sample.kitProductId,
                                  supplierId: sample.supplierId,
                                  weight: sample.weight?.toString() || undefined,
                                  volume: sample.volume?.toString() || undefined,
                                  dimHeight: sample.dimHeight?.toString() || undefined,
                                  dimWidth: sample.dimWidth?.toString() || undefined,
                                  dimLength: sample.dimLength?.toString() || undefined,
                                  notes: sample.notes || undefined,
                                })}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="העבר לרכישה סופית"
                              >
                                <ArrowUpOnSquareIcon className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleArchiveSample(sample)}
                              className={`p-1.5 rounded transition-colors ${
                                sample.archived
                                  ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                              }`}
                              title={sample.archived ? 'שחזר מארכיון' : 'העבר לארכיון'}
                            >
                              {sample.archived ? <ArchiveBoxXMarkIcon className="w-4 h-4" /> : <ArchiveBoxIcon className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteSample(sample.sampleId)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="מחק"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Add sample button — only on a product tab; cross-product views don't have an implicit product to attach to */}
          {activeTab.type === 'product' && (
            <div className="border-t border-gray-200 px-3 py-2">
              <button
                onClick={() => {
                  setShowAddSample(true);
                  setNewSample({ supplierId: '', supplierSearch: '', sampleCost: '', currentStage: 0, notes: '', weight: '', volume: '', dimHeight: '', dimWidth: '', dimLength: '' });
                  setNewSampleFiles([]);
                }}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                הוסף דוגמית
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 bg-white">
          <p>אין מוצרים עדיין. הוסף מוצר ראשון לערכה.</p>
          <Button className="mt-4" onClick={() => setShowAddProduct(true)}>
            <PlusIcon className="w-4 h-4" />
            הוסף מוצר
          </Button>
        </div>
      )}

      {/* Modals */}

      {/* Add Product */}
      <Modal isOpen={showAddProduct} onClose={() => setShowAddProduct(false)} title="הוסף מוצר" size="sm">
        <div className="space-y-4">
          <Input id="productName" label="שם מוצר" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="לדוגמה: ציפוי ננו" required />
          <Input id="productCategory" label="קטגוריה" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAddProduct(false)}>ביטול</Button>
            <Button onClick={handleAddProduct} disabled={!newProduct.name.trim()}>הוסף</Button>
          </div>
        </div>
      </Modal>

      {/* Add Sample */}
      <Modal isOpen={showAddSample} onClose={() => { setShowAddSample(false); setNewSampleFiles([]); }} title="הוסף דוגמית" size="lg">
        <div className="space-y-4">
          {/* Row 1: Image upload + Supplier */}
          <div className="grid grid-cols-[120px_1fr] gap-4">
            {/* Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תמונה</label>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                {newSampleFiles.length > 0 ? (
                  <div className="flex gap-1 flex-wrap justify-center p-1">
                    {newSampleFiles.map((f, i) => (
                      <img key={i} src={URL.createObjectURL(f)} alt="" className="w-10 h-10 object-cover rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="text-center">
                    <PhotoIcon className="w-6 h-6 text-gray-400 mx-auto" />
                    <span className="text-xs text-gray-400 mt-1">בחר תמונות</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) setNewSampleFiles(Array.from(e.target.files));
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ספק</label>
              <div className="relative">
                <input type="text" value={newSample.supplierSearch} onChange={(e) => setNewSample({ ...newSample, supplierSearch: e.target.value, supplierId: '' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="חפש ספק..." />
                {newSample.supplierSearch && !newSample.supplierId && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredSupplierSuggestions.map((s) => (
                      <button key={s.supplierId} onClick={() => setNewSample({ ...newSample, supplierId: s.supplierId, supplierSearch: s.name })} className="w-full text-right px-3 py-2 hover:bg-blue-50 text-sm">{s.name}</button>
                    ))}
                    {filteredSupplierSuggestions.length === 0 && newSample.supplierSearch.trim() && (
                      <button
                        onClick={async () => {
                          try {
                            const supplierId = await addSupplierMutation({ name: newSample.supplierSearch.trim() });
                            setNewSample({ ...newSample, supplierId, supplierSearch: newSample.supplierSearch.trim() });
                            showToast('ספק נוצר בהצלחה', 'success');
                          } catch (error) {
                            console.error('Error creating supplier:', error);
                            showToast('שגיאה ביצירת ספק', 'error');
                          }
                        }}
                        className="w-full text-right px-3 py-2 hover:bg-green-50 text-sm text-green-700 font-medium border-t border-gray-100"
                      >
                        + צור ספק חדש: &quot;{newSample.supplierSearch.trim()}&quot;
                      </button>
                    )}
                  </div>
                )}
              </div>
              {newSample.supplierId && <p className="text-xs text-green-600 mt-1">נבחר: {getSupplierName(newSample.supplierId)}</p>}
            </div>
          </div>

          {/* Row 2: Cost + Stage */}
          <div className="grid grid-cols-2 gap-4">
            <Input id="sampleCost" label="עלות ($)" type="number" value={newSample.sampleCost} onChange={(e) => setNewSample({ ...newSample, sampleCost: e.target.value })} placeholder="0" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">איפה הדוגמית</label>
              <select
                value={newSample.currentStage}
                onChange={(e) => setNewSample({ ...newSample, currentStage: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SAMPLE_STAGES.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dimensions / Volume / Weight */}
          <DimensionInput
            dimHeight={newSample.dimHeight}
            dimWidth={newSample.dimWidth}
            dimLength={newSample.dimLength}
            volume={newSample.volume}
            weight={newSample.weight}
            showWeight={true}
            onDimChange={(field, value) => setNewSample({ ...newSample, [field]: value })}
            onVolumeChange={(value) => setNewSample({ ...newSample, volume: value, dimHeight: '', dimWidth: '', dimLength: '' })}
            onWeightChange={(value) => setNewSample({ ...newSample, weight: value })}
          />

          {/* Row 3: Notes */}
          <Input id="sampleNotes" label="הערות" value={newSample.notes} onChange={(e) => setNewSample({ ...newSample, notes: e.target.value })} />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowAddSample(false); setNewSampleFiles([]); }}>ביטול</Button>
            <Button onClick={handleAddSample} disabled={!newSample.supplierId}>הוסף דוגמית</Button>
          </div>
        </div>
      </Modal>

      {/* Rating */}
      <Modal isOpen={!!showRatingModal} onClose={() => setShowRatingModal(null)} title="דירוג דוגמית" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-1 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setRatingValue(star === ratingValue ? 0 : star)} className="p-1">
                {star <= ratingValue ? <StarSolid className="w-8 h-8 text-yellow-400" /> : <StarOutline className="w-8 h-8 text-gray-300 hover:text-yellow-300" />}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="ratingNotes" className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
            <textarea id="ratingNotes" value={ratingNotes} onChange={(e) => setRatingNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} placeholder="מה חשבת על הדוגמית?" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowRatingModal(null)}>ביטול</Button>
            <Button onClick={handleSaveRating}>שמור</Button>
          </div>
        </div>
      </Modal>

      {/* Tracking */}
      <Modal isOpen={!!showTrackingModal} onClose={() => setShowTrackingModal(null)} title="הוסף מספר מעקב" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">קטע משלוח</label>
            <select value={newTracking.leg} onChange={(e) => setNewTracking({ ...newTracking, leg: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">בחר...</option>
              <option value="ספק לסוכן">ספק לסוכן</option>
              <option value="סוכן אלינו">סוכן אלינו</option>
              <option value="אחר">אחר</option>
            </select>
          </div>
          <Input id="trackNum" label="מספר מעקב" value={newTracking.trackingNumber} onChange={(e) => setNewTracking({ ...newTracking, trackingNumber: e.target.value })} required />
          <Input id="carrier" label="חברת משלוח" value={newTracking.carrier} onChange={(e) => setNewTracking({ ...newTracking, carrier: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowTrackingModal(null)}>ביטול</Button>
            <Button onClick={handleAddTracking} disabled={!newTracking.leg || !newTracking.trackingNumber.trim()}>הוסף</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Sample */}
      <Modal isOpen={!!editingSampleId} onClose={() => setEditingSampleId(null)} title="עריכת דוגמית" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="editCost" label="עלות ($)" type="number" value={editSampleForm.sampleCost} onChange={(e) => setEditSampleForm({ ...editSampleForm, sampleCost: e.target.value })} placeholder="0" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">איפה הדוגמית</label>
              <select
                value={editSampleForm.currentStage}
                onChange={(e) => setEditSampleForm({ ...editSampleForm, currentStage: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SAMPLE_STAGES.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Input id="editNotes" label="הערות" value={editSampleForm.notes} onChange={(e) => setEditSampleForm({ ...editSampleForm, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setEditingSampleId(null)}>ביטול</Button>
            <Button onClick={handleUpdateSample}>שמור</Button>
          </div>
        </div>
      </Modal>

      {/* Move Product */}
      <Modal isOpen={!!moveProduct} onClose={() => setMoveProduct(null)} title={`העבר "${moveProduct?.name || ''}" לערכה אחרת`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ערכת יעד</label>
            <select value={moveTargetKitId} onChange={(e) => setMoveTargetKitId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">בחר ערכה...</option>
              {allKits.filter((k) => k.kitId !== kitId).map((k) => (<option key={k.kitId} value={k.kitId}>{k.name}</option>))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setMoveProduct(null)}>ביטול</Button>
            <Button onClick={handleMoveProduct} disabled={!moveTargetKitId}>העבר</Button>
          </div>
        </div>
      </Modal>

      {/* Lightbox */}
      {lightboxImage && (
        <>
          <div className="fixed inset-0 bg-black/80 z-40" onClick={() => setLightboxImage(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
            <div className="relative max-w-4xl max-h-[90vh]">
              <img src={lightboxImage} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
              <button onClick={() => setLightboxImage(null)} className="absolute top-2 left-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
      {ConfirmDialog}

      {/* Sample View Modal (create/edit) */}
      <SampleViewModal
        isOpen={viewModal !== null}
        onClose={() => setViewModal(null)}
        kitId={kitId}
        viewId={viewModal?.mode === 'edit' ? viewModal.viewId : undefined}
        initialName={viewModal?.mode === 'edit' ? viewModal.name : ''}
        initialFilters={viewModal?.mode === 'edit' ? viewModal.filters : undefined}
        onSaved={(viewId) => setActiveTab({ type: 'view', viewId })}
      />

      {/* Alibaba Chat URL Modal */}
      <Modal
        isOpen={!!chatUrlModal}
        onClose={() => setChatUrlModal(null)}
        title="קישור לצ'אט באליבאבא"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">הדבק את הקישור לצ'אט עם הספק באליבאבא</p>
          <Input
            id="alibaba_chat_url_samples"
            label="קישור"
            value={chatUrlInput}
            onChange={(e) => setChatUrlInput(e.target.value)}
            placeholder="https://message.alibaba.com/message/messenger.htm?..."
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setChatUrlModal(null)}>
              ביטול
            </Button>
            <Button
              disabled={!chatUrlInput.trim()}
              onClick={async () => {
                if (!chatUrlModal) return;
                try {
                  await updateSupplierMutation({
                    supplierId: chatUrlModal.supplierId,
                    alibabaChatUrl: chatUrlInput.trim(),
                  });
                  showToast('קישור צ\'אט נשמר', 'success');
                  setChatUrlModal(null);
                } catch (error) {
                  console.error('Error saving chat URL:', error);
                  showToast('שגיאה בשמירת קישור', 'error');
                }
              }}
            >
              שמור
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
