'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatNumber } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/useConfirm';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  PaperClipIcon,
  DocumentIcon,
  PhotoIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  CubeIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { Doc, Id } from '../../../convex/_generated/dataModel';

function DebouncedQuantityInput({
  value,
  onSave,
  belowMoq,
}: {
  value: number | undefined | null;
  onSave: (val: number | undefined) => void;
  belowMoq: boolean;
}) {
  const [local, setLocal] = useState(value?.toString() ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(value);

  // Sync from server only if not currently editing
  useEffect(() => {
    if (savedRef.current !== value) {
      savedRef.current = value;
      setLocal(value?.toString() ?? '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setLocal(raw);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const parsed = raw ? parseInt(raw) : undefined;
      savedRef.current = parsed ?? null;
      onSave(parsed);
    }, 600);
  };

  // Save on blur immediately
  const handleBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const parsed = local ? parseInt(local) : undefined;
    savedRef.current = parsed ?? null;
    onSave(parsed);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={local}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full px-2 py-1.5 border rounded-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        belowMoq
          ? 'border-red-300 bg-red-50 text-red-700'
          : 'border-gray-200 text-gray-900'
      }`}
      placeholder="-"
    />
  );
}

interface FinalProductFile {
  _id: string;
  kitFinalProductId: string;
  url: string | null;
  fileName: string;
  fileType: string;
}

interface CostFile {
  _id: string;
  costId: string;
  url: string | null;
  fileName: string;
  fileType: string;
}

interface SampleImage {
  _id: string;
  sampleId: string;
  url: string | null;
  caption?: string;
}

interface FinalPurchaseTabProps {
  kitId: string;
  products: Doc<'kitProducts'>[];
  finalProducts: Doc<'kitFinalProducts'>[];
  finalProductFiles: FinalProductFile[];
  costs: Doc<'kitAdditionalCosts'>[];
  costFiles: CostFile[];
  suppliers: Doc<'suppliers'>[];
  allSuppliers: Doc<'suppliers'>[];
  kitSearch?: string;
  samples?: Doc<'samples'>[];
  sampleImages?: SampleImage[];
  targetKitCount?: number;
  onUpdateTargetKitCount?: (count: number | undefined) => void;
}

export default function FinalPurchaseTab({
  kitId,
  products,
  finalProducts,
  finalProductFiles,
  costs,
  costFiles,
  suppliers,
  allSuppliers,
  kitSearch = '',
  samples = [],
  sampleImages = [],
  targetKitCount,
  onUpdateTargetKitCount,
}: FinalPurchaseTabProps) {
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const addFinalProductMutation = useMutation(api.kits.addKitFinalProduct);
  const updateFinalProductMutation = useMutation(api.kits.updateKitFinalProduct);
  const deleteFinalProductMutation = useMutation(api.kits.deleteKitFinalProduct);
  const addKitProductMutation = useMutation(api.kits.addKitProduct);
  const addCostMutation = useMutation(api.kits.addKitCost);
  const updateCostMutation = useMutation(api.kits.updateKitCost);
  const deleteCostMutation = useMutation(api.kits.deleteKitCost);
  const addCostFileMutation = useMutation(api.kits.addCostFile);
  const deleteCostFileMutation = useMutation(api.kits.deleteCostFile);
  const generateUploadUrlMutation = useMutation(api.kits.generateUploadUrl);
  const addFileMutation = useMutation(api.kits.addFinalProductFile);
  const deleteFileMutation = useMutation(api.kits.deleteFinalProductFile);
  const updateSupplierMutation = useMutation(api.suppliers.updateSupplier);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [chatUrlModal, setChatUrlModal] = useState<{ supplierId: string; currentUrl: string } | null>(null);
  const [chatUrlInput, setChatUrlInput] = useState('');

  // Debounced target kit count
  const [localTargetKitCount, setLocalTargetKitCount] = useState(targetKitCount?.toString() ?? '');
  const targetKitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetKitSavedRef = useRef(targetKitCount);
  useEffect(() => {
    if (targetKitSavedRef.current !== targetKitCount) {
      targetKitSavedRef.current = targetKitCount;
      setLocalTargetKitCount(targetKitCount?.toString() ?? '');
    }
  }, [targetKitCount]);

  // Product form
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    kitProductId: '',
    newProductName: '',
    supplierId: '',
    supplierSearch: '',
    quantity: '',
    quantityPerKit: '',
    pricePerUnit: '',
    weight: '',
    dimHeight: '',
    dimWidth: '',
    dimLength: '',
    moq: '',
    productionRound: '',
    notes: '',
  });

  // Cost form
  const [showAddCost, setShowAddCost] = useState(false);
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [costForm, setCostForm] = useState({
    description: '',
    costType: 'fixed' as 'fixed' | 'percentage',
    amount: '',
    linkedProductIds: [] as string[],
    applyToAll: true,
    leadTime: '',
    notes: '',
  });

  const getSupplierName = (supplierId: string | undefined) => {
    if (!supplierId) return '-';
    const allSups = [...suppliers, ...allSuppliers];
    return allSups.find((s) => s.supplierId === supplierId)?.name || '-';
  };

  const getSupplierChatUrl = (supplierId: string | undefined) => {
    if (!supplierId) return undefined;
    const allSups = [...suppliers, ...allSuppliers];
    return allSups.find((s) => s.supplierId === supplierId)?.alibabaChatUrl;
  };

  const getProductName = (kitProductId: string) => {
    return products.find((p) => p.kitProductId === kitProductId)?.name || kitProductId;
  };

  // CBM = height(mm) * width(mm) * length(mm) / 1,000,000,000
  const getCbm = (fp: Doc<'kitFinalProducts'>): number | null => {
    if (fp.dimHeight != null && fp.dimWidth != null && fp.dimLength != null) {
      return (fp.dimHeight * fp.dimWidth * fp.dimLength) / 1_000_000_000;
    }
    if (fp.volume != null) return fp.volume;
    return null;
  };

  // Find the first sample image for a final product (same supplier + same product)
  const getSampleImageUrl = (fp: Doc<'kitFinalProducts'>): string | null => {
    if (!fp.supplierId) return null;
    const matchingSamples = samples.filter(
      (s) => s.supplierId === fp.supplierId && s.kitProductId === fp.kitProductId
    );
    for (const s of matchingSamples) {
      const img = sampleImages.find((i) => i.sampleId === s.sampleId && i.url);
      if (img?.url) return img.url;
    }
    return null;
  };

  const filteredSupplierSuggestions = allSuppliers.filter((s) =>
    s.name.toLowerCase().includes(productForm.supplierSearch.toLowerCase())
  );

  // Kit-wide search filter
  const filteredFinalProducts = useMemo(() => {
    const term = kitSearch.trim().toLowerCase();
    if (!term) return finalProducts;
    return finalProducts.filter((fp) => {
      if (getProductName(fp.kitProductId).toLowerCase().includes(term)) return true;
      if (getSupplierName(fp.supplierId).toLowerCase().includes(term)) return true;
      if (fp.notes && fp.notes.toLowerCase().includes(term)) return true;
      if (fp.pricePerUnit != null && fp.pricePerUnit.toString().includes(term)) return true;
      if (fp.productionRound && fp.productionRound.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [kitSearch, finalProducts, products, suppliers, allSuppliers]);

  const filteredCosts = useMemo(() => {
    const term = kitSearch.trim().toLowerCase();
    if (!term) return costs;
    return costs.filter((c) => {
      if (c.description.toLowerCase().includes(term)) return true;
      if (c.notes && c.notes.toLowerCase().includes(term)) return true;
      if (c.amount.toString().includes(term)) return true;
      if (c.leadTime && c.leadTime.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [kitSearch, costs]);

  // Calculate cost amounts
  const getRowTotal = (fp: Doc<'kitFinalProducts'>) => {
    const qty = fp.quantity || 0;
    const ppu = fp.pricePerUnit || 0;
    return qty * ppu;
  };
  const productsTotalCost = finalProducts.reduce((sum, fp) => sum + getRowTotal(fp), 0);

  const getCostCalculatedAmount = (cost: Doc<'kitAdditionalCosts'>) => {
    if (cost.costType === 'fixed') return cost.amount;
    // Percentage: calculate based on linked products or all
    const linkedIds = cost.linkedProductIds;
    const base = (!linkedIds || linkedIds.length === 0)
      ? productsTotalCost
      : finalProducts
          .filter((fp) => linkedIds.includes(fp.kitProductId))
          .reduce((sum, fp) => sum + (fp.totalCost || 0), 0);
    return (cost.amount / 100) * base;
  };

  const totalCostsAmount = costs.reduce((sum, c) => sum + getCostCalculatedAmount(c), 0);
  const grandTotal = productsTotalCost + totalCostsAmount;
  const totalWeight = finalProducts.reduce((sum, fp) => sum + ((fp.weight || 0) * (fp.quantity || 0)), 0);
  const totalWeightPerUnit = finalProducts.reduce((sum, fp) => sum + (fp.weight || 0), 0);
  const totalPricePerUnit = finalProducts.reduce((sum, fp) => sum + (fp.pricePerUnit || 0), 0);
  const totalQuantityPerKit = finalProducts.reduce((sum, fp) => sum + (fp.quantityPerKit || 0), 0);
  const totalWeightPerKit = finalProducts.reduce((sum, fp) => sum + ((fp.quantityPerKit || 0) * (fp.weight || 0)), 0);
  const totalPricePerKit = finalProducts.reduce((sum, fp) => sum + ((fp.quantityPerKit || 0) * (fp.pricePerUnit || 0)), 0);
  // Only box-marked products count toward CBM totals
  const boxProducts = finalProducts.filter((fp) => fp.isBox);
  const totalVolumePerKit = boxProducts.reduce((sum, fp) => sum + ((fp.quantityPerKit || 0) * (getCbm(fp) || 0)), 0);
  const totalVolumeAll = totalVolumePerKit * (targetKitCount || 0);
  // Kit amounts = min of (quantity / quantityPerKit) across all products that have both values
  const kitAmounts = finalProducts
    .filter((fp) => fp.quantity && fp.quantityPerKit && fp.quantityPerKit > 0)
    .map((fp) => Math.floor((fp.quantity || 0) / (fp.quantityPerKit || 1)));
  const totalKitAmounts = kitAmounts.length > 0 ? Math.min(...kitAmounts) : 0;

  // Product handlers
  const resetProductForm = () => setProductForm({ kitProductId: '', newProductName: '', supplierId: '', supplierSearch: '', quantity: '', quantityPerKit: '', pricePerUnit: '', weight: '', dimHeight: '', dimWidth: '', dimLength: '', moq: '', productionRound: '', notes: '' });

  const handleAddProduct = async () => {
    let productId = productForm.kitProductId;
    if (!productId && productForm.newProductName.trim()) {
      try {
        productId = await addKitProductMutation({ kitId, name: productForm.newProductName.trim() });
      } catch { showToast('שגיאה ביצירת מוצר', 'error'); return; }
    }
    if (!productId) return;
    try {
      const qty = productForm.quantity ? parseFloat(productForm.quantity) : undefined;
      const ppu = productForm.pricePerUnit ? parseFloat(productForm.pricePerUnit) : undefined;
      const total = qty && ppu ? qty * ppu : undefined;
      await addFinalProductMutation({
        kitProductId: productId,
        supplierId: productForm.supplierId || undefined,
        quantity: qty,
        quantityPerKit: productForm.quantityPerKit ? parseFloat(productForm.quantityPerKit) : undefined,
        pricePerUnit: ppu,
        weight: productForm.weight ? parseFloat(productForm.weight) : undefined,
        dimHeight: productForm.dimHeight ? parseFloat(productForm.dimHeight) : undefined,
        dimWidth: productForm.dimWidth ? parseFloat(productForm.dimWidth) : undefined,
        dimLength: productForm.dimLength ? parseFloat(productForm.dimLength) : undefined,
        moq: productForm.moq ? parseInt(productForm.moq) : undefined,
        totalCost: total,
        productionRound: productForm.productionRound || undefined,
        notes: productForm.notes || undefined,
      });
      showToast('פריט נוסף', 'success');
      setShowAddProduct(false);
      resetProductForm();
    } catch { showToast('שגיאה בהוספת פריט', 'error'); }
  };

  const handleUpdateProduct = async () => {
    if (!editingProductId) return;
    try {
      const qty = productForm.quantity ? parseFloat(productForm.quantity) : undefined;
      const ppu = productForm.pricePerUnit ? parseFloat(productForm.pricePerUnit) : undefined;
      const total = qty && ppu ? qty * ppu : undefined;
      await updateFinalProductMutation({
        kitFinalProductId: editingProductId,
        supplierId: productForm.supplierId || undefined,
        quantity: qty,
        quantityPerKit: productForm.quantityPerKit ? parseFloat(productForm.quantityPerKit) : undefined,
        pricePerUnit: ppu,
        weight: productForm.weight ? parseFloat(productForm.weight) : undefined,
        dimHeight: productForm.dimHeight ? parseFloat(productForm.dimHeight) : undefined,
        dimWidth: productForm.dimWidth ? parseFloat(productForm.dimWidth) : undefined,
        dimLength: productForm.dimLength ? parseFloat(productForm.dimLength) : undefined,
        moq: productForm.moq ? parseInt(productForm.moq) : undefined,
        totalCost: total,
        productionRound: productForm.productionRound || undefined,
        notes: productForm.notes || undefined,
      });
      showToast('פריט עודכן', 'success');
      setEditingProductId(null);
      resetProductForm();
    } catch { showToast('שגיאה בעדכון פריט', 'error'); }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!(await confirm('האם למחוק פריט זה?'))) return;
    await deleteFinalProductMutation({ kitFinalProductId: id });
  };

  const startEditProduct = (fp: Doc<'kitFinalProducts'>) => {
    setEditingProductId(fp.kitFinalProductId);
    setProductForm({
      kitProductId: fp.kitProductId,
      newProductName: '',
      supplierId: fp.supplierId || '',
      supplierSearch: fp.supplierId ? getSupplierName(fp.supplierId) : '',
      quantity: fp.quantity?.toString() || '',
      quantityPerKit: fp.quantityPerKit?.toString() || '',
      pricePerUnit: fp.pricePerUnit?.toString() || '',
      weight: fp.weight?.toString() || '',
      dimHeight: fp.dimHeight?.toString() || '',
      dimWidth: fp.dimWidth?.toString() || '',
      dimLength: fp.dimLength?.toString() || '',
      moq: fp.moq?.toString() || '',
      productionRound: fp.productionRound || '',
      notes: fp.notes || '',
    });
  };

  // Cost handlers
  const resetCostForm = () => setCostForm({ description: '', costType: 'fixed', amount: '', linkedProductIds: [], applyToAll: true, leadTime: '', notes: '' });

  const handleAddCost = async () => {
    if (!costForm.description.trim() || !costForm.amount) return;
    try {
      await addCostMutation({
        kitId,
        description: costForm.description,
        costType: costForm.costType,
        amount: parseFloat(costForm.amount),
        linkedProductIds: costForm.applyToAll ? undefined : costForm.linkedProductIds,
        leadTime: costForm.leadTime || undefined,
        notes: costForm.notes || undefined,
      });
      showToast('עלות נוספה', 'success');
      setShowAddCost(false);
      resetCostForm();
    } catch { showToast('שגיאה בהוספת עלות', 'error'); }
  };

  const handleUpdateCost = async () => {
    if (!editingCostId || !costForm.amount) return;
    try {
      await updateCostMutation({
        costId: editingCostId,
        description: costForm.description,
        costType: costForm.costType,
        amount: parseFloat(costForm.amount),
        linkedProductIds: costForm.applyToAll ? undefined : costForm.linkedProductIds,
        leadTime: costForm.leadTime || undefined,
        notes: costForm.notes || undefined,
      });
      showToast('עלות עודכנה', 'success');
      setEditingCostId(null);
      resetCostForm();
    } catch { showToast('שגיאה בעדכון עלות', 'error'); }
  };

  const handleDeleteCost = async (costId: string) => {
    if (!(await confirm('האם למחוק עלות זו?'))) return;
    await deleteCostMutation({ costId });
  };

  const startEditCost = (cost: Doc<'kitAdditionalCosts'>) => {
    setEditingCostId(cost.costId);
    setCostForm({
      description: cost.description,
      costType: cost.costType,
      amount: cost.amount.toString(),
      linkedProductIds: cost.linkedProductIds || [],
      applyToAll: !cost.linkedProductIds || cost.linkedProductIds.length === 0,
      leadTime: cost.leadTime || '',
      notes: cost.notes || '',
    });
  };

  const handleUploadFile = async (kitFinalProductId: string, files: FileList) => {
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadUrl = await generateUploadUrlMutation();
        const result = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
        const { storageId } = await result.json();
        await addFileMutation({ kitFinalProductId, storageId, fileName: file.name, fileType: file.type });
      }
      showToast(`${files.length} קבצים הועלו`, 'success');
    } catch {
      showToast('שגיאה בהעלאת קבצים', 'error');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    await deleteFileMutation({ id: fileId as Id<'kitFinalProductFiles'> });
  };

  const handleUploadCostFile = async (costId: string, files: FileList) => {
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadUrl = await generateUploadUrlMutation();
        const result = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
        const { storageId } = await result.json();
        await addCostFileMutation({ costId, storageId, fileName: file.name, fileType: file.type });
      }
    } catch { showToast('שגיאה בהעלאת קבצים', 'error'); }
  };

  const handleDeleteCostFile = async (fileId: string) => {
    await deleteCostFileMutation({ id: fileId as Id<'kitCostFiles'> });
  };

  const isImage = (fileType: string) => fileType.startsWith('image/');

  const fmt = (n: number | undefined | null, decimals = 2) => {
    if (n == null || n === 0) return '';
    return `$${n.toFixed(decimals)}`;
  };

  const handleExportCSV = () => {
    const headers = ['שם פריט', 'כמות', 'ספק', 'מחיר/יח ($)', 'סה"כ ($)', 'משקל/יח (ג)', 'משקל כולל (ק"ג)', 'MOQ', 'Lead Time'];
    const rows = finalProducts.map((fp) => {
      const total = getRowTotal(fp);
      const totalWt = ((fp.weight || 0) * (fp.quantity || 0)) / 1000;
      return [
        getProductName(fp.kitProductId),
        fp.quantity ?? '',
        getSupplierName(fp.supplierId),
        fmt(fp.pricePerUnit, 3),
        fmt(total),
        fp.weight ?? '',
        totalWt || '',
        fp.moq ?? '',
        fp.productionRound || '',
      ];
    });
    // Add costs
    for (const cost of costs) {
      const calculated = getCostCalculatedAmount(cost);
      const label = cost.costType === 'percentage' ? `${cost.description} (${cost.amount}%)` : cost.description;
      rows.push([label, '', '', '', fmt(calculated), '', '', '', cost.notes || '']);
    }
    // Totals
    rows.push(['סה"כ', '', '', fmt(totalPricePerUnit, 3), fmt(grandTotal), totalWeightPerUnit, (totalWeight / 1000).toFixed(1), '', '']);

    const BOM = '\uFEFF';
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'קנייה-סופית.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const canAddProduct = productForm.kitProductId || productForm.newProductName.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">קנייה סופית</h3>
          <div className="flex items-center gap-1.5">
            <label className="text-sm text-gray-500">ערכות רצויות:</label>
            <input
              type="text"
              inputMode="numeric"
              value={localTargetKitCount}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setLocalTargetKitCount(raw);
                if (targetKitTimerRef.current) clearTimeout(targetKitTimerRef.current);
                targetKitTimerRef.current = setTimeout(() => {
                  const val = raw ? parseInt(raw) : undefined;
                  targetKitSavedRef.current = val;
                  onUpdateTargetKitCount?.(val);
                }, 600);
              }}
              onBlur={() => {
                if (targetKitTimerRef.current) clearTimeout(targetKitTimerRef.current);
                const val = localTargetKitCount ? parseInt(localTargetKitCount) : undefined;
                targetKitSavedRef.current = val;
                onUpdateTargetKitCount?.(val);
              }}
              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg text-center font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="-"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={handleExportCSV}>
            <ArrowDownTrayIcon className="w-4 h-4" />
            CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setShowAddCost(true); resetCostForm(); }}>
            <PlusIcon className="w-4 h-4" />
            הוסף עלות
          </Button>
          <Button size="sm" onClick={() => { setShowAddProduct(true); resetProductForm(); }}>
            <PlusIcon className="w-4 h-4" />
            הוסף פריט
          </Button>
        </div>
      </div>

      {finalProducts.length === 0 && costs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>אין פריטים בקנייה סופית עדיין.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-3 text-right font-medium text-gray-600">שם פריט</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600 w-[80px]">כמות</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">ספק</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">מחיר/יח ($)</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">סה"כ ($)</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">משקל/יח (ג)</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">משקל כולל (ק"ג)</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">מידות (מ"מ)</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">CBM/יח</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">CBM ערכה</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600 w-[60px]">כמות בערכה</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">משקל ערכה (ג)</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">מחיר ערכה ($)</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">CBM כולל</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">כמות ערכות</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">MOQ</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">Lead Time</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">קבצים</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600 w-[80px]">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {/* Product rows */}
              {filteredFinalProducts.map((fp) => {
                const rowTotal = getRowTotal(fp);
                const belowMoq = fp.quantity != null && fp.moq != null && fp.quantity < fp.moq;
                return (
                <tr key={fp.kitFinalProductId} className={`border-b border-gray-100 hover:bg-gray-50 ${belowMoq ? 'bg-red-50' : ''}`}>
                  <td className={`px-3 py-3 font-medium ${belowMoq ? 'text-red-700' : 'text-gray-900'}`}>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const imgUrl = getSampleImageUrl(fp);
                        return imgUrl ? (
                          <img
                            src={imgUrl}
                            alt=""
                            className="w-8 h-8 object-cover rounded border border-gray-200 hover:border-blue-400 cursor-pointer transition-colors shrink-0"
                            onClick={() => setLightboxUrl(imgUrl)}
                          />
                        ) : null;
                      })()}
                      <span>{getProductName(fp.kitProductId)}</span>
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <DebouncedQuantityInput
                      value={fp.quantity}
                      belowMoq={belowMoq}
                      onSave={async (val) => {
                        const newTotal = val && fp.pricePerUnit ? val * fp.pricePerUnit : undefined;
                        await updateFinalProductMutation({
                          kitFinalProductId: fp.kitFinalProductId,
                          quantity: val,
                          totalCost: newTotal,
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span>{getSupplierName(fp.supplierId)}</span>
                      {fp.supplierId && (
                        getSupplierChatUrl(fp.supplierId) ? (
                          <a
                            href={getSupplierChatUrl(fp.supplierId)}
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
                              setChatUrlModal({ supplierId: fp.supplierId!, currentUrl: '' });
                            }}
                            className="p-0.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                            title="הוסף קישור לצ'אט באליבאבא"
                          >
                            <ChatBubbleLeftRightIcon className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-900">{fp.pricePerUnit != null ? `$${formatNumber(fp.pricePerUnit, 3)}` : '-'}</td>
                  <td className={`px-3 py-3 font-medium ${belowMoq ? 'text-red-700' : 'text-gray-900'}`}>{rowTotal > 0 ? `$${formatNumber(rowTotal)}` : '-'}</td>
                  <td className="px-3 py-3 text-gray-600">{fp.weight != null ? formatNumber(fp.weight, 0) : '-'}</td>
                  <td className="px-3 py-3 text-gray-600">{fp.weight != null && fp.quantity != null ? formatNumber((fp.weight * fp.quantity) / 1000, 1) : '-'}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          await updateFinalProductMutation({
                            kitFinalProductId: fp.kitFinalProductId,
                            isBox: !fp.isBox,
                          });
                        }}
                        className={`p-0.5 rounded transition-colors shrink-0 ${fp.isBox ? 'text-blue-600 bg-blue-100' : 'text-gray-300 hover:text-gray-500'}`}
                        title={fp.isBox ? 'מסומן כקופסה (נכלל בסה"כ CBM)' : 'סמן כקופסה'}
                      >
                        <CubeIcon className="w-4 h-4" />
                      </button>
                      <span>
                        {fp.dimHeight != null && fp.dimWidth != null && fp.dimLength != null
                          ? `${fp.dimHeight}×${fp.dimWidth}×${fp.dimLength}`
                          : '-'}
                      </span>
                    </div>
                  </td>
                  <td className={`px-3 py-3 ${fp.isBox ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>{getCbm(fp) != null ? formatNumber(getCbm(fp)!, 4) : '-'}</td>
                  <td className={`px-3 py-3 ${fp.isBox ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>{getCbm(fp) != null && fp.quantityPerKit != null ? formatNumber(getCbm(fp)! * fp.quantityPerKit, 4) : '-'}</td>
                  <td className="px-1 py-1 w-[60px]">
                    <DebouncedQuantityInput
                      value={fp.quantityPerKit}
                      belowMoq={false}
                      onSave={async (val) => {
                        await updateFinalProductMutation({
                          kitFinalProductId: fp.kitFinalProductId,
                          quantityPerKit: val,
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-3 text-gray-600">{fp.quantityPerKit != null && fp.weight != null ? formatNumber(fp.quantityPerKit * fp.weight, 0) : '-'}</td>
                  <td className="px-3 py-3 text-gray-600">{fp.quantityPerKit != null && fp.pricePerUnit != null ? `$${formatNumber(fp.quantityPerKit * fp.pricePerUnit, 2)}` : '-'}</td>
                  <td className={`px-3 py-3 ${fp.isBox ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>{fp.quantityPerKit != null && getCbm(fp) != null && targetKitCount ? formatNumber(fp.quantityPerKit * getCbm(fp)! * targetKitCount, 2) : '-'}</td>
                  <td className="px-3 py-3 text-gray-600 font-medium">{fp.quantity != null && fp.quantityPerKit != null && fp.quantityPerKit > 0 ? formatNumber(Math.floor(fp.quantity / fp.quantityPerKit), 0) : '-'}</td>
                  <td className={`px-3 py-3 ${belowMoq ? 'text-red-700 font-medium' : 'text-gray-600'}`}>{fp.moq != null ? formatNumber(fp.moq, 0) : '-'}</td>
                  <td className="px-3 py-3 text-gray-600">{fp.productionRound || '-'}</td>
                  {/* Files */}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {finalProductFiles
                        .filter((f) => f.kitFinalProductId === fp.kitFinalProductId)
                        .map((file) => (
                          <div key={file._id} className="relative group/file">
                            {isImage(file.fileType) && file.url ? (
                              <img
                                src={file.url}
                                alt={file.fileName}
                                className="w-8 h-8 object-cover rounded cursor-pointer border border-gray-200 hover:border-blue-300"
                                onClick={() => setLightboxUrl(file.url)}
                              />
                            ) : (
                              <a
                                href={file.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-1.5 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 hover:bg-blue-50 hover:border-blue-300"
                                title={file.fileName}
                              >
                                <DocumentIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate max-w-[60px]">{file.fileName.split('.').pop()}</span>
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteFile(file._id)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-opacity"
                            >
                              <XMarkIcon className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      <label className="flex items-center justify-center w-8 h-8 border border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <PaperClipIcon className="w-4 h-4 text-gray-400" />
                        <input
                          type="file"
                          accept="image/*,.pdf,.xlsx,.xls,.doc,.docx,.csv"
                          multiple
                          onChange={(e) => {
                            if (e.target.files) handleUploadFile(fp.kitFinalProductId, e.target.files);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => startEditProduct(fp)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteProduct(fp.kitFinalProductId)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}

              {/* Subtotal row (only if there are costs) */}
              {costs.length > 0 && finalProducts.length > 0 && (
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-gray-500 font-medium" colSpan={4}>סה"כ מוצרים</td>
                  <td className="px-3 py-2 text-gray-700 font-medium">${formatNumber(productsTotalCost)}</td>
                  <td colSpan={14} className="px-3 py-2"></td>
                </tr>
              )}

              {/* Cost rows */}
              {filteredCosts.map((cost) => {
                const calculated = getCostCalculatedAmount(cost);
                const label = cost.costType === 'percentage'
                  ? `${cost.description} (${cost.amount}%)`
                  : cost.description;
                const scope = cost.linkedProductIds && cost.linkedProductIds.length > 0
                  ? `${cost.linkedProductIds.length} מוצרים`
                  : 'כל המוצרים';

                return (
                  <tr key={cost.costId} className="border-b border-gray-100 hover:bg-orange-50/30 bg-orange-50/20">
                    {/* שם פריט */}
                    <td className="px-3 py-3 font-medium text-orange-800">{label}</td>
                    {/* כמות */}
                    <td className="px-3 py-3"></td>
                    {/* ספק */}
                    <td className="px-3 py-3 text-xs text-orange-600">{scope}</td>
                    {/* מחיר/יח */}
                    <td className="px-3 py-3"></td>
                    {/* סה"כ */}
                    <td className="px-3 py-3 font-medium text-orange-800">${formatNumber(calculated)}</td>
                    {/* משקל/יח */}
                    <td className="px-3 py-3"></td>
                    {/* משקל כולל */}
                    <td className="px-3 py-3 text-gray-500 text-xs">{cost.notes || ''}</td>
                    {/* מידות */}
                    <td className="px-3 py-3"></td>
                    {/* CBM/יח */}
                    <td className="px-3 py-3"></td>
                    {/* CBM כולל */}
                    <td className="px-3 py-3"></td>
                    {/* כמות בערכה */}
                    <td className="px-3 py-3"></td>
                    {/* משקל ערכה */}
                    <td className="px-3 py-3"></td>
                    {/* מחיר ערכה */}
                    <td className="px-3 py-3"></td>
                    {/* נפח ערכה */}
                    <td className="px-3 py-3"></td>
                    {/* כמות ערכות */}
                    <td className="px-3 py-3"></td>
                    {/* MOQ */}
                    <td className="px-3 py-3"></td>
                    {/* Lead Time */}
                    <td className="px-3 py-3 text-gray-600 text-xs">{cost.leadTime || '-'}</td>
                    {/* קבצים */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {costFiles
                          .filter((f) => f.costId === cost.costId)
                          .map((file) => (
                            <div key={file._id} className="relative group/cf">
                              {isImage(file.fileType) && file.url ? (
                                <img src={file.url} alt={file.fileName} className="w-8 h-8 object-cover rounded cursor-pointer border border-gray-200 hover:border-blue-300" onClick={() => setLightboxUrl(file.url)} />
                              ) : (
                                <a href={file.url || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-1.5 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 hover:bg-blue-50" title={file.fileName}>
                                  <DocumentIcon className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[60px]">{file.fileName.split('.').pop()}</span>
                                </a>
                              )}
                              <button onClick={() => handleDeleteCostFile(file._id)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/cf:opacity-100 transition-opacity">
                                <XMarkIcon className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        <label className="flex items-center justify-center w-8 h-8 border border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                          <PaperClipIcon className="w-4 h-4 text-gray-400" />
                          <input type="file" accept="image/*,.pdf,.xlsx,.xls,.doc,.docx,.csv" multiple onChange={(e) => { if (e.target.files) handleUploadCostFile(cost.costId, e.target.files); e.target.value = ''; }} className="hidden" />
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => startEditCost(cost)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteCost(cost.costId)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td className="px-3 py-3 text-gray-900">סה"כ</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-gray-900">${formatNumber(totalPricePerUnit, 3)}</td>
                <td className="px-3 py-3 text-gray-900">${formatNumber(grandTotal)}</td>
                <td className="px-3 py-3 text-gray-900">{formatNumber(totalWeightPerUnit, 0)}</td>
                <td className="px-3 py-3 text-gray-900">{formatNumber(totalWeight / 1000, 1)}</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-gray-900">{formatNumber(totalVolumePerKit, 4)}</td>
                <td className="px-3 py-3 text-gray-900">{formatNumber(totalQuantityPerKit, 0)}</td>
                <td className="px-3 py-3 text-gray-900">{formatNumber(totalWeightPerKit, 0)}</td>
                <td className="px-3 py-3 text-gray-900">${formatNumber(totalPricePerKit, 2)}</td>
                <td className="px-3 py-3 text-gray-900 font-bold">{formatNumber(totalVolumeAll, 2)}</td>
                <td className="px-3 py-3 text-gray-900 font-bold">{totalKitAmounts}</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      <Modal
        isOpen={showAddProduct || !!editingProductId}
        onClose={() => { setShowAddProduct(false); setEditingProductId(null); resetProductForm(); }}
        title={editingProductId ? 'עריכת פריט' : 'הוסף פריט'}
      >
        <div className="space-y-4">
          {!editingProductId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מוצר</label>
              <select value={productForm.kitProductId} onChange={(e) => setProductForm({ ...productForm, kitProductId: e.target.value, newProductName: '' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">בחר מוצר קיים...</option>
                {products.map((p) => (<option key={p.kitProductId} value={p.kitProductId}>{p.name}</option>))}
              </select>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">או</span>
                <input type="text" value={productForm.newProductName} onChange={(e) => setProductForm({ ...productForm, newProductName: e.target.value, kitProductId: '' })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="הקלד שם מוצר חדש..." />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ספק <span className="text-gray-400 font-normal">(אופציונלי)</span></label>
            <div className="relative">
              <input type="text" value={productForm.supplierSearch} onChange={(e) => setProductForm({ ...productForm, supplierSearch: e.target.value, supplierId: '' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="חפש ספק..." />
              {productForm.supplierSearch && !productForm.supplierId && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredSupplierSuggestions.map((s) => (
                    <button key={s.supplierId} onClick={() => setProductForm({ ...productForm, supplierId: s.supplierId, supplierSearch: s.name })} className="w-full text-right px-3 py-2 hover:bg-blue-50 text-sm">{s.name}</button>
                  ))}
                </div>
              )}
            </div>
            {productForm.supplierId && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-green-600">נבחר: {getSupplierName(productForm.supplierId)}</p>
                <button onClick={() => setProductForm({ ...productForm, supplierId: '', supplierSearch: '' })} className="text-xs text-red-400 hover:text-red-600">הסר</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Input id="fpQuantity" label="כמות" type="number" value={productForm.quantity} onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })} />
            <Input id="fpQuantityPerKit" label="כמות בערכה" type="number" value={productForm.quantityPerKit} onChange={(e) => setProductForm({ ...productForm, quantityPerKit: e.target.value })} />
            <Input id="fpPricePerUnit" label="מחיר ליחידה ($)" type="number" value={productForm.pricePerUnit} onChange={(e) => setProductForm({ ...productForm, pricePerUnit: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סה"כ ($)</label>
              <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium">
                {productForm.quantity && productForm.pricePerUnit
                  ? `$${formatNumber(parseFloat(productForm.quantity) * parseFloat(productForm.pricePerUnit))}`
                  : '-'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="fpWeight" label="משקל (גרם)" type="number" value={productForm.weight} onChange={(e) => setProductForm({ ...productForm, weight: e.target.value })} />
            <Input id="fpMoq" label="MOQ" type="number" value={productForm.moq} onChange={(e) => setProductForm({ ...productForm, moq: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מידות (מ&quot;מ)</label>
            <div className="grid grid-cols-4 gap-2 items-end">
              <Input id="fpDimH" label="" type="number" value={productForm.dimHeight} onChange={(e) => setProductForm({ ...productForm, dimHeight: e.target.value })} placeholder="גובה" />
              <Input id="fpDimW" label="" type="number" value={productForm.dimWidth} onChange={(e) => setProductForm({ ...productForm, dimWidth: e.target.value })} placeholder="רוחב" />
              <Input id="fpDimL" label="" type="number" value={productForm.dimLength} onChange={(e) => setProductForm({ ...productForm, dimLength: e.target.value })} placeholder="אורך" />
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 text-center">
                {productForm.dimHeight && productForm.dimWidth && productForm.dimLength
                  ? `${formatNumber((parseFloat(productForm.dimHeight) * parseFloat(productForm.dimWidth) * parseFloat(productForm.dimLength)) / 1_000_000_000, 4)} CBM`
                  : '- CBM'}
              </div>
            </div>
          </div>
          <Input id="fpRound" label="Lead Time" value={productForm.productionRound} onChange={(e) => setProductForm({ ...productForm, productionRound: e.target.value })} placeholder="לדוגמה: 25 ימים" />
          <Input id="fpNotes" label="הערות" value={productForm.notes} onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowAddProduct(false); setEditingProductId(null); resetProductForm(); }}>ביטול</Button>
            <Button onClick={editingProductId ? handleUpdateProduct : handleAddProduct} disabled={editingProductId ? false : !canAddProduct}>{editingProductId ? 'עדכן' : 'הוסף'}</Button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Cost Modal */}
      <Modal
        isOpen={showAddCost || !!editingCostId}
        onClose={() => { setShowAddCost(false); setEditingCostId(null); resetCostForm(); }}
        title={editingCostId ? 'עריכת עלות' : 'הוסף עלות נוספת'}
      >
        <div className="space-y-4">
          <Input id="costDesc" label="תיאור" value={costForm.description} onChange={(e) => setCostForm({ ...costForm, description: e.target.value })} placeholder="לדוגמה: משלוח, מכס, אריזה" required />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סוג עלות</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCostForm({ ...costForm, costType: 'fixed' })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${costForm.costType === 'fixed' ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                סכום קבוע ($)
              </button>
              <button
                onClick={() => setCostForm({ ...costForm, costType: 'percentage' })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${costForm.costType === 'percentage' ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                אחוז (%)
              </button>
            </div>
          </div>

          <Input
            id="costAmount"
            label={costForm.costType === 'fixed' ? 'סכום ($)' : 'אחוז (%)'}
            type="number"
            step="0.01"
            value={costForm.amount}
            onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
            placeholder={costForm.costType === 'fixed' ? '500' : '10'}
          />

          {/* Apply to which products */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">חל על</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={costForm.applyToAll} onChange={() => setCostForm({ ...costForm, applyToAll: true, linkedProductIds: [] })} className="text-blue-600" />
                <span className="text-sm">כל המוצרים</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!costForm.applyToAll} onChange={() => setCostForm({ ...costForm, applyToAll: false })} className="text-blue-600" />
                <span className="text-sm">מוצרים נבחרים</span>
              </label>
            </div>
            {!costForm.applyToAll && (
              <div className="border rounded-lg p-3 mt-2 max-h-40 overflow-y-auto space-y-1.5">
                {/* Show unique products from final purchase table */}
                {Array.from(new Set(finalProducts.map((fp) => fp.kitProductId))).map((kpId) => (
                  <label key={kpId} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={costForm.linkedProductIds.includes(kpId)}
                      onChange={() => {
                        const ids = costForm.linkedProductIds.includes(kpId)
                          ? costForm.linkedProductIds.filter((id) => id !== kpId)
                          : [...costForm.linkedProductIds, kpId];
                        setCostForm({ ...costForm, linkedProductIds: ids });
                      }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm">{getProductName(kpId)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          {costForm.amount && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <span className="font-medium">תצוגה מקדימה: </span>
              {costForm.costType === 'fixed'
                ? `$${formatNumber(parseFloat(costForm.amount) || 0)}`
                : `${costForm.amount}% = $${formatNumber(((parseFloat(costForm.amount) || 0) / 100) * (costForm.applyToAll ? productsTotalCost : finalProducts.filter((fp) => costForm.linkedProductIds.includes(fp.kitProductId)).reduce((s, fp) => s + (fp.totalCost || 0), 0)))}`
              }
            </div>
          )}

          <Input id="costLeadTime" label="Lead Time" value={costForm.leadTime} onChange={(e) => setCostForm({ ...costForm, leadTime: e.target.value })} placeholder="לדוגמה: 25 ימים" />
          <Input id="costNotes" label="הערות" value={costForm.notes} onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })} />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowAddCost(false); setEditingCostId(null); resetCostForm(); }}>ביטול</Button>
            <Button onClick={editingCostId ? handleUpdateCost : handleAddCost} disabled={!costForm.description.trim() || !costForm.amount}>{editingCostId ? 'עדכן' : 'הוסף'}</Button>
          </div>
        </div>
      </Modal>
      {ConfirmDialog}

      {/* Alibaba Chat URL Modal */}
      <Modal
        isOpen={!!chatUrlModal}
        onClose={() => setChatUrlModal(null)}
        title="קישור לצ'אט באליבאבא"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">הדבק את הקישור לצ'אט עם הספק באליבאבא</p>
          <Input
            id="alibaba_chat_url"
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

      {/* Lightbox */}
      {lightboxUrl && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setLightboxUrl(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={() => setLightboxUrl(null)}>
            <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden max-w-lg max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
              <img src={lightboxUrl} alt="" className="max-w-full max-h-[65vh] object-contain" />
              <button onClick={() => setLightboxUrl(null)} className="absolute top-2 left-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
