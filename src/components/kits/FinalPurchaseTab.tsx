'use client';

import { useState } from 'react';
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
} from '@heroicons/react/24/outline';
import { Doc, Id } from '../../../convex/_generated/dataModel';

interface FinalProductFile {
  _id: string;
  kitFinalProductId: string;
  url: string | null;
  fileName: string;
  fileType: string;
}

interface FinalPurchaseTabProps {
  kitId: string;
  products: Doc<'kitProducts'>[];
  finalProducts: Doc<'kitFinalProducts'>[];
  finalProductFiles: FinalProductFile[];
  costs: Doc<'kitAdditionalCosts'>[];
  suppliers: Doc<'suppliers'>[];
  allSuppliers: Doc<'suppliers'>[];
}

export default function FinalPurchaseTab({
  kitId,
  products,
  finalProducts,
  finalProductFiles,
  costs,
  suppliers,
  allSuppliers,
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
  const generateUploadUrlMutation = useMutation(api.kits.generateUploadUrl);
  const addFileMutation = useMutation(api.kits.addFinalProductFile);
  const deleteFileMutation = useMutation(api.kits.deleteFinalProductFile);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Product form
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    kitProductId: '',
    newProductName: '',
    supplierId: '',
    supplierSearch: '',
    quantity: '',
    pricePerUnit: '',
    weight: '',
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
    notes: '',
  });

  const getSupplierName = (supplierId: string | undefined) => {
    if (!supplierId) return '-';
    const allSups = [...suppliers, ...allSuppliers];
    return allSups.find((s) => s.supplierId === supplierId)?.name || '-';
  };

  const getProductName = (kitProductId: string) => {
    return products.find((p) => p.kitProductId === kitProductId)?.name || kitProductId;
  };

  const filteredSupplierSuggestions = allSuppliers.filter((s) =>
    s.name.toLowerCase().includes(productForm.supplierSearch.toLowerCase())
  );

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
  const totalPricePerUnit = finalProducts.reduce((sum, fp) => sum + (fp.pricePerUnit || 0), 0);

  // Product handlers
  const resetProductForm = () => setProductForm({ kitProductId: '', newProductName: '', supplierId: '', supplierSearch: '', quantity: '', pricePerUnit: '', weight: '', moq: '', productionRound: '', notes: '' });

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
        pricePerUnit: ppu,
        weight: productForm.weight ? parseFloat(productForm.weight) : undefined,
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
        pricePerUnit: ppu,
        weight: productForm.weight ? parseFloat(productForm.weight) : undefined,
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
      pricePerUnit: fp.pricePerUnit?.toString() || '',
      weight: fp.weight?.toString() || '',
      moq: fp.moq?.toString() || '',
      productionRound: fp.productionRound || '',
      notes: fp.notes || '',
    });
  };

  // Cost handlers
  const resetCostForm = () => setCostForm({ description: '', costType: 'fixed', amount: '', linkedProductIds: [], applyToAll: true, notes: '' });

  const handleAddCost = async () => {
    if (!costForm.description.trim() || !costForm.amount) return;
    try {
      await addCostMutation({
        kitId,
        description: costForm.description,
        costType: costForm.costType,
        amount: parseFloat(costForm.amount),
        linkedProductIds: costForm.applyToAll ? undefined : costForm.linkedProductIds,
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

  const isImage = (fileType: string) => fileType.startsWith('image/');

  const handleExportCSV = () => {
    const headers = ['שם פריט', 'כמות', 'ספק', 'מחיר/יח ($)', 'סה"כ ($)', 'משקל/יח (ג)', 'משקל כולל (ג)', 'MOQ', 'סבב ייצור'];
    const rows = finalProducts.map((fp) => {
      const total = getRowTotal(fp);
      const totalWt = (fp.weight || 0) * (fp.quantity || 0);
      return [
        getProductName(fp.kitProductId),
        fp.quantity ?? '',
        getSupplierName(fp.supplierId),
        fp.pricePerUnit ?? '',
        total || '',
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
      rows.push([label, '', '', '', calculated, '', '', '', cost.notes || '']);
    }
    // Totals
    rows.push(['סה"כ', '', '', totalPricePerUnit, grandTotal, '', totalWeight, '', '']);

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
        <h3 className="text-lg font-semibold text-gray-900">קנייה סופית</h3>
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
                <th className="px-3 py-3 text-right font-medium text-gray-600">משקל כולל (ג)</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">MOQ</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">סבב ייצור</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">קבצים</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600 w-[80px]">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {/* Product rows */}
              {finalProducts.map((fp) => {
                const rowTotal = getRowTotal(fp);
                const belowMoq = fp.quantity != null && fp.moq != null && fp.quantity < fp.moq;
                return (
                <tr key={fp.kitFinalProductId} className={`border-b border-gray-100 hover:bg-gray-50 ${belowMoq ? 'bg-red-50' : ''}`}>
                  <td className={`px-3 py-3 font-medium ${belowMoq ? 'text-red-700' : 'text-gray-900'}`}>{getProductName(fp.kitProductId)}</td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={fp.quantity ?? ''}
                      onChange={async (e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        const val = raw ? parseInt(raw) : undefined;
                        const newTotal = val && fp.pricePerUnit ? val * fp.pricePerUnit : undefined;
                        await updateFinalProductMutation({
                          kitFinalProductId: fp.kitFinalProductId,
                          quantity: val,
                          totalCost: newTotal,
                        });
                      }}
                      className={`w-full px-2 py-1.5 border rounded-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        belowMoq
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-900'
                      }`}
                      placeholder="-"
                    />
                  </td>
                  <td className="px-3 py-3 text-gray-600">{getSupplierName(fp.supplierId)}</td>
                  <td className="px-3 py-3 text-gray-900">{fp.pricePerUnit != null ? `$${formatNumber(fp.pricePerUnit, 3)}` : '-'}</td>
                  <td className={`px-3 py-3 font-medium ${belowMoq ? 'text-red-700' : 'text-gray-900'}`}>{rowTotal > 0 ? `$${formatNumber(rowTotal)}` : '-'}</td>
                  <td className="px-3 py-3 text-gray-600">{fp.weight != null ? formatNumber(fp.weight, 0) : '-'}</td>
                  <td className="px-3 py-3 text-gray-600">{fp.weight != null && fp.quantity != null ? formatNumber(fp.weight * fp.quantity, 0) : '-'}</td>
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
                  <td className="px-3 py-2 text-gray-500 font-medium">סה"כ מוצרים</td>
                  <td colSpan={3} className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-gray-700 font-medium">${formatNumber(productsTotalCost)}</td>
                  <td colSpan={6} className="px-3 py-2"></td>
                </tr>
              )}

              {/* Cost rows */}
              {costs.map((cost) => {
                const calculated = getCostCalculatedAmount(cost);
                const label = cost.costType === 'percentage'
                  ? `${cost.description} (${cost.amount}%)`
                  : cost.description;
                const scope = cost.linkedProductIds && cost.linkedProductIds.length > 0
                  ? `${cost.linkedProductIds.length} מוצרים`
                  : 'כל המוצרים';

                return (
                  <tr key={cost.costId} className="border-b border-gray-100 hover:bg-orange-50/30 bg-orange-50/20">
                    <td className="px-3 py-3 font-medium text-orange-800">{label}</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-xs text-orange-600">{scope}</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 font-medium text-orange-800">${formatNumber(calculated)}</td>
                    <td colSpan={5} className="px-3 py-3 text-gray-500 text-xs">{cost.notes || ''}</td>
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
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-gray-900">{formatNumber(totalWeight, 0)}</td>
                <td colSpan={3} className="px-3 py-3"></td>
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
          <div className="grid grid-cols-3 gap-4">
            <Input id="fpQuantity" label="כמות" type="number" value={productForm.quantity} onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })} />
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
          <Input id="fpRound" label="סבב ייצור" value={productForm.productionRound} onChange={(e) => setProductForm({ ...productForm, productionRound: e.target.value })} placeholder="לדוגמה: סבב ראשון" />
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

          <Input id="costNotes" label="הערות" value={costForm.notes} onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })} />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowAddCost(false); setEditingCostId(null); resetCostForm(); }}>ביטול</Button>
            <Button onClick={editingCostId ? handleUpdateCost : handleAddCost} disabled={!costForm.description.trim() || !costForm.amount}>{editingCostId ? 'עדכן' : 'הוסף'}</Button>
          </div>
        </div>
      </Modal>
      {ConfirmDialog}

      {/* Lightbox */}
      {lightboxUrl && (
        <>
          <div className="fixed inset-0 bg-black/80 z-40" onClick={() => setLightboxUrl(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
            <div className="relative max-w-4xl max-h-[90vh]">
              <img src={lightboxUrl} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
              <button onClick={() => setLightboxUrl(null)} className="absolute top-2 left-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
