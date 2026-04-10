'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';

import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/useConfirm';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PaperClipIcon,
  PhotoIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

interface Product {
  productId: string;
  orderId: string;
  name: string;
  supplier?: string;
  quantity: number;
  pricePerUnit: number;
  priceTotal: number;
  currency: string;
  cbmPerUnit: number;
  cbmTotal: number;
  kgPerUnit: number;
  kgTotal: number;
  orderDate?: string;
  notes?: string;
  priceILS?: number;
  additionalCostsILS?: number;
  finalCostILS?: number;
  finalCostPerUnitILS?: number;
}

interface ProductsTabProps {
  orderId: string;
  products: Product[];
}

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'JPY', label: 'JPY (¥)', symbol: '¥' },
  { value: 'CNY', label: 'CNY (¥)', symbol: '¥' },
  { value: 'ILS', label: 'ILS (₪)', symbol: '₪' },
  { value: 'AUD', label: 'AUD (A$)', symbol: 'A$' },
  { value: 'CAD', label: 'CAD (C$)', symbol: 'C$' },
  { value: 'CHF', label: 'CHF (Fr)', symbol: 'Fr' },
  { value: 'HKD', label: 'HKD (HK$)', symbol: 'HK$' },
  { value: 'SGD', label: 'SGD (S$)', symbol: 'S$' },
  { value: 'SEK', label: 'SEK (kr)', symbol: 'kr' },
  { value: 'KRW', label: 'KRW (₩)', symbol: '₩' },
  { value: 'NOK', label: 'NOK (kr)', symbol: 'kr' },
  { value: 'NZD', label: 'NZD (NZ$)', symbol: 'NZ$' },
  { value: 'INR', label: 'INR (₹)', symbol: '₹' },
  { value: 'MXN', label: 'MXN ($)', symbol: '$' },
  { value: 'TWD', label: 'TWD (NT$)', symbol: 'NT$' },
  { value: 'ZAR', label: 'ZAR (R)', symbol: 'R' },
  { value: 'BRL', label: 'BRL (R$)', symbol: 'R$' },
  { value: 'DKK', label: 'DKK (kr)', symbol: 'kr' },
  { value: 'PLN', label: 'PLN (zł)', symbol: 'zł' },
  { value: 'THB', label: 'THB (฿)', symbol: '฿' },
  { value: 'IDR', label: 'IDR (Rp)', symbol: 'Rp' },
  { value: 'HUF', label: 'HUF (Ft)', symbol: 'Ft' },
  { value: 'CZK', label: 'CZK (Kč)', symbol: 'Kč' },
  { value: 'AED', label: 'AED (د.إ)', symbol: 'د.إ' },
  { value: 'TRY', label: 'TRY (₺)', symbol: '₺' },
  { value: 'SAR', label: 'SAR (﷼)', symbol: '﷼' },
  { value: 'PHP', label: 'PHP (₱)', symbol: '₱' },
  { value: 'MYR', label: 'MYR (RM)', symbol: 'RM' },
  { value: 'RUB', label: 'RUB (₽)', symbol: '₽' },
];

interface ProductFormData {
  name: string;
  supplier: string;
  quantity: number;
  pricePerUnit: number;
  priceTotal: number;
  currency: string;
  cbmPerUnit: number;
  cbmTotal: number;
  kgPerUnit: number;
  kgTotal: number;
  orderDate: string;
  notes: string;
}

const getEmptyProduct = (): ProductFormData => ({
  name: '',
  supplier: '',
  quantity: 0,
  pricePerUnit: 0,
  priceTotal: 0,
  currency: 'USD',
  cbmPerUnit: 0,
  cbmTotal: 0,
  kgPerUnit: 0,
  kgTotal: 0,
  orderDate: new Date().toISOString().split('T')[0],
  notes: '',
});

export default function ProductsTab({
  orderId,
  products,
}: ProductsTabProps) {
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const addProductMutation = useMutation(api.products.addProduct);
  const updateProductMutation = useMutation(api.products.updateProduct);
  const deleteProductMutation = useMutation(api.products.deleteProduct);
  const generateUploadUrl = useMutation(api.kits.generateUploadUrl);
  const addProductFileMutation = useMutation(api.products.addProductFile);
  const deleteProductFileMutation = useMutation(api.products.deleteProductFile);

  const router = useRouter();

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(getEmptyProduct);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [showCurrencySuggestions, setShowCurrencySuggestions] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [showFinalProductSuggestions, setShowFinalProductSuggestions] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSource, setSelectedSource] = useState<{ kitId: string; kitFinalProductId: string } | null>(null);

  // Get all unique suppliers from all products across all orders
  const allSuppliers = useQuery(api.products.getAllSuppliers) ?? [];

  // Get all final products for autocomplete
  const allFinalProducts = useQuery(api.kits.getAllFinalProductsForAutocomplete) ?? [];

  // Get all product files for this order (for table column)
  const allProductFiles = useQuery(api.products.getProductFilesByOrder, { orderId }) ?? {};

  // Get all registered suppliers (for chat URLs)
  const allRegisteredSuppliers = useQuery(api.suppliers.getAllSuppliers) ?? [];

  // Get files for editing product (in modal)
  const editingProductFiles = useQuery(
    api.products.getProductFiles,
    editingProduct ? { productId: editingProduct.productId } : "skip"
  );

  // Filter final products based on name input
  const filteredFinalProducts = useMemo(() => {
    if (!formData.name.trim()) return allFinalProducts;
    const search = formData.name.toLowerCase();
    return allFinalProducts.filter(
      (fp) =>
        fp.name.toLowerCase().includes(search) ||
        fp.supplierName.toLowerCase().includes(search) ||
        fp.kitName.toLowerCase().includes(search)
    );
  }, [formData.name, allFinalProducts]);

  // Filter suppliers based on current input
  const filteredSuppliers = useMemo(() => {
    if (!formData.supplier.trim()) return allSuppliers;
    return allSuppliers.filter((s) =>
      s.toLowerCase().includes(formData.supplier.toLowerCase())
    );
  }, [formData.supplier, allSuppliers]);

  // Filter currencies based on search input
  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.value.toLowerCase().includes(currencySearch.toLowerCase()) ||
        c.label.toLowerCase().includes(currencySearch.toLowerCase())
    );
  }, [currencySearch]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(getEmptyProduct());
    setCurrencySearch('');
    setPendingFiles([]);
    setSelectedSource(null);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      supplier: product.supplier || '',
      quantity: product.quantity,
      pricePerUnit: product.pricePerUnit,
      priceTotal: product.priceTotal,
      currency: product.currency,
      cbmPerUnit: product.cbmPerUnit,
      cbmTotal: product.cbmTotal,
      kgPerUnit: product.kgPerUnit,
      kgTotal: product.kgTotal,
      orderDate: product.orderDate || new Date().toISOString().split('T')[0],
      notes: product.notes || '',
    });
    setCurrencySearch('');
    setPendingFiles([]);
    setSelectedSource(null);
    setShowModal(true);
  };

  const handleQuantityChange = (qty: number) => {
    setFormData({
      ...formData,
      quantity: qty,
      priceTotal: qty * formData.pricePerUnit,
      cbmTotal: qty * formData.cbmPerUnit,
      kgTotal: qty * formData.kgPerUnit,
    });
  };

  const handlePricePerUnitChange = (price: number) => {
    setFormData({
      ...formData,
      pricePerUnit: price,
      priceTotal: formData.quantity * price,
    });
  };

  const handlePriceTotalChange = (total: number) => {
    setFormData({
      ...formData,
      priceTotal: total,
      pricePerUnit: formData.quantity > 0 ? total / formData.quantity : 0,
    });
  };

  const handleCbmPerUnitChange = (cbm: number) => {
    setFormData({
      ...formData,
      cbmPerUnit: cbm,
      cbmTotal: formData.quantity * cbm,
    });
  };

  const handleCbmTotalChange = (total: number) => {
    setFormData({
      ...formData,
      cbmTotal: total,
      cbmPerUnit: formData.quantity > 0 ? total / formData.quantity : 0,
    });
  };

  const handleKgPerUnitChange = (kg: number) => {
    setFormData({
      ...formData,
      kgPerUnit: kg,
      kgTotal: formData.quantity * kg,
    });
  };

  const handleKgTotalChange = (total: number) => {
    setFormData({
      ...formData,
      kgTotal: total,
      kgPerUnit: formData.quantity > 0 ? total / formData.quantity : 0,
    });
  };

  const handleSelectFinalProduct = (fp: typeof allFinalProducts[number]) => {
    const qty = fp.quantity || 0;
    const price = fp.pricePerUnit || 0;
    const weightKg = (fp.weight || 0) / 1000;
    const volumeM3 = fp.volume || 0;

    setFormData({
      ...formData,
      name: fp.name,
      supplier: fp.supplierName,
      quantity: qty,
      pricePerUnit: price,
      priceTotal: qty * price,
      cbmPerUnit: volumeM3,
      cbmTotal: volumeM3 * qty,
      kgPerUnit: weightKg,
      kgTotal: weightKg * qty,
    });
    setSelectedSource({ kitId: fp.kitId, kitFinalProductId: fp.kitFinalProductId });
    setShowFinalProductSuggestions(false);
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!(await confirm("האם למחוק את הקובץ?"))) return;
    try {
      await deleteProductFileMutation({ id: fileId as any });
      showToast("קובץ נמחק", "success");
    } catch (error) {
      console.error("Error deleting file:", error);
      showToast("שגיאה במחיקת קובץ", "error");
    }
  };

  const handleAddPendingFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files);
    setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddPendingFiles(e.dataTransfer.files);
    }
  }, []);

  const uploadFilesForProduct = async (productId: string, files: File[]) => {
    for (const file of files) {
      try {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await response.json();
        await addProductFileMutation({
          productId,
          storageId,
          fileName: file.name,
          fileType: file.type,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        showToast("שגיאה בהעלאת קובץ", "error");
      }
    }
  };

  const handleSubmit = async () => {
    try {
      let targetProductId: string | undefined;

      if (editingProduct) {
        await updateProductMutation({
          productId: editingProduct.productId,
          name: formData.name,
          supplier: formData.supplier || undefined,
          quantity: formData.quantity,
          pricePerUnit: formData.pricePerUnit,
          priceTotal: formData.priceTotal,
          currency: formData.currency,
          cbmPerUnit: formData.cbmPerUnit,
          cbmTotal: formData.cbmTotal,
          kgPerUnit: formData.kgPerUnit,
          kgTotal: formData.kgTotal,
          orderDate: formData.orderDate || undefined,
          notes: formData.notes || undefined,
        });
        targetProductId = editingProduct.productId;
        showToast('מוצר עודכן בהצלחה', 'success');
      } else {
        const newProductId = await addProductMutation({
          orderId,
          name: formData.name,
          supplier: formData.supplier || undefined,
          quantity: formData.quantity,
          pricePerUnit: formData.pricePerUnit,
          priceTotal: formData.priceTotal,
          currency: formData.currency,
          cbmPerUnit: formData.cbmPerUnit,
          cbmTotal: formData.cbmTotal,
          kgPerUnit: formData.kgPerUnit,
          kgTotal: formData.kgTotal,
          orderDate: formData.orderDate || undefined,
          notes: formData.notes || undefined,
          sourceKitId: selectedSource?.kitId,
          sourceKitFinalProductId: selectedSource?.kitFinalProductId,
        });
        targetProductId = newProductId;
        showToast('מוצר נוסף בהצלחה', 'success');
      }

      // Upload pending files
      if (targetProductId && pendingFiles.length > 0) {
        await uploadFilesForProduct(targetProductId, pendingFiles);
        showToast('קבצים הועלו בהצלחה', 'success');
      }

      setPendingFiles([]);
      setShowModal(false);
    } catch (error) {
      console.error('Error saving product:', error);
      showToast('שגיאה בשמירת מוצר', 'error');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!(await confirm('האם למחוק את המוצר?'))) return;

    try {
      await deleteProductMutation({ productId });
      showToast('מוצר נמחק', 'success');
    } catch (error) {
      console.error('Error deleting product:', error);
      showToast('שגיאה במחיקת מוצר', 'error');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">מוצרים</h3>
        <Button size="sm" onClick={openAddModal}>
          <PlusIcon className="w-4 h-4" />
          הוסף מוצר
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500 text-center py-8">אין מוצרים</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-right py-3 px-4 font-medium text-gray-600 w-10"></th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">שם</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">ספק</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">כמות</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">מחיר/יח</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">סה"כ</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">עלות סופית ₪</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">קבצים</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                return (
                  <tr
                    key={product.productId}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/orders/${orderId}/products/${product.productId}?from=products`)}
                  >
                    <td className="py-3 px-4">
                      <ArrowLeftIcon className="w-4 h-4 text-gray-400" />
                    </td>
                      <td className="py-3 px-4 font-medium">{product.name}</td>
                      <td className="py-3 px-4">
                        {product.supplier ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-600">{product.supplier}</span>
                            {(() => {
                              const sup = allRegisteredSuppliers.find((s) => s.name === product.supplier);
                              if (!sup?.alibabaChatUrl) return null;
                              return (
                                <a
                                  href={sup.alibabaChatUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-0.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                  title="צ'אט עם הספק באליבאבא"
                                >
                                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                                </a>
                              );
                            })()}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">{product.quantity}</td>
                      <td className="py-3 px-4">{formatNumber(product.pricePerUnit)} {product.currency}</td>
                      <td className="py-3 px-4">{formatNumber(product.priceTotal)} {product.currency}</td>
                      <td className="py-3 px-4 font-semibold text-blue-600">
                        {formatCurrency(product.finalCostILS || 0)}
                      </td>
                      <td className="py-3 px-4">
                        {(() => {
                          const files = allProductFiles[product.productId];
                          if (!files || files.length === 0) return <span className="text-gray-300">-</span>;
                          const images = files.filter((f) => f.fileType.startsWith('image/'));
                          const others = files.filter((f) => !f.fileType.startsWith('image/'));
                          return (
                            <div className="flex items-center gap-1.5">
                              {images.length > 0 && (
                                <div className="flex -space-x-1.5">
                                  {images.slice(0, 3).map((img) => (
                                    <img
                                      key={img._id}
                                      src={img.url || ''}
                                      alt={img.fileName}
                                      className="w-7 h-7 rounded border-2 border-white object-cover"
                                    />
                                  ))}
                                  {images.length > 3 && (
                                    <span className="flex items-center justify-center w-7 h-7 rounded border-2 border-white bg-gray-100 text-xs text-gray-500 font-medium">
                                      +{images.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                              {others.length > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-gray-500">
                                  <PaperClipIcon className="w-3.5 h-3.5" />
                                  {others.length}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.productId)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'עריכת מוצר' : 'הוסף מוצר'}
        size="xl"
      >
        <div className="space-y-4">
          {/* Row 1: Basic Info - Name, Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Input
                id="name"
                label="שם המוצר"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (!editingProduct) setShowFinalProductSuggestions(true);
                }}
                onFocus={() => {
                  if (!editingProduct) setShowFinalProductSuggestions(true);
                }}
                onBlur={() => setTimeout(() => setShowFinalProductSuggestions(false), 200)}
                autoComplete="off"
                required
              />
              {showFinalProductSuggestions && !editingProduct && filteredFinalProducts.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <div className="px-3 py-1.5 text-xs text-gray-400 border-b bg-gray-50 rounded-t-lg">
                    מוצרים מרכישה סופית
                  </div>
                  {filteredFinalProducts.map((fp) => (
                    <button
                      key={fp.kitFinalProductId}
                      type="button"
                      className="w-full px-3 py-2 text-right text-sm hover:bg-blue-50 border-b last:border-b-0 last:rounded-b-lg"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectFinalProduct(fp);
                      }}
                    >
                      <div className="font-medium text-gray-900">{fp.name}</div>
                      <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                        {fp.supplierName && <span>ספק: {fp.supplierName}</span>}
                        {fp.kitName && <span>ערכה: {fp.kitName}</span>}
                        {fp.pricePerUnit != null && <span>מחיר: {formatNumber(fp.pricePerUnit)}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <Input
                id="supplier"
                label="ספק"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                onFocus={() => setShowSupplierSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 150)}
                autoComplete="off"
              />
              {showSupplierSuggestions && filteredSuppliers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredSuppliers.map((supplier) => (
                    <button
                      key={supplier}
                      type="button"
                      className="w-full px-3 py-2 text-right text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFormData({ ...formData, supplier });
                        setShowSupplierSuggestions(false);
                      }}
                    >
                      {supplier}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Separator */}
          <hr className="border-gray-200" />

          {/* Quantity - prominent single field */}
          <Input
            id="quantity"
            label="כמות"
            type="number"
            value={formData.quantity}
            onChange={(e) => handleQuantityChange(parseFloat(e.target.value) || 0)}
          />

          {/* Price Row */}
          <div className="flex gap-4">
            {/* Currency - smaller, on the left */}
            <div className="relative w-24 flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">מטבע</label>
              <input
                type="text"
                value={currencySearch || formData.currency}
                onChange={(e) => setCurrencySearch(e.target.value)}
                onFocus={() => {
                  setShowCurrencySuggestions(true);
                  setCurrencySearch('');
                }}
                onBlur={() => setTimeout(() => setShowCurrencySuggestions(false), 150)}
                className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoComplete="off"
              />
              {showCurrencySuggestions && (
                <div className="absolute z-20 w-32 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCurrencies.map((currency) => (
                    <button
                      key={currency.value}
                      type="button"
                      className="w-full px-3 py-2 text-right text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFormData({ ...formData, currency: currency.value });
                        setCurrencySearch('');
                        setShowCurrencySuggestions(false);
                      }}
                    >
                      {currency.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Price per unit */}
            <div className="flex-1">
              <Input
                id="pricePerUnit"
                label="מחיר ליחידה"
                type="number"
                step="0.01"
                value={formData.pricePerUnit}
                onChange={(e) => handlePricePerUnitChange(parseFloat(e.target.value) || 0)}
              />
            </div>
            {/* Price total */}
            <div className="flex-1">
              <Input
                id="priceTotal"
                label="סה״כ מחיר"
                type="number"
                step="0.01"
                value={formData.priceTotal}
                onChange={(e) => handlePriceTotalChange(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* CBM Row */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="cbmPerUnit"
              label="CBM ליחידה"
              type="number"
              step="0.001"
              value={formData.cbmPerUnit}
              onChange={(e) => handleCbmPerUnitChange(parseFloat(e.target.value) || 0)}
            />
            <Input
              id="cbmTotal"
              label="CBM סה״כ"
              type="number"
              step="0.001"
              value={formData.cbmTotal}
              onChange={(e) => handleCbmTotalChange(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* KG Row */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="kgPerUnit"
              label="KG ליחידה"
              type="number"
              step="0.1"
              value={formData.kgPerUnit}
              onChange={(e) => handleKgPerUnitChange(parseFloat(e.target.value) || 0)}
            />
            <Input
              id="kgTotal"
              label="KG סה״כ"
              type="number"
              step="0.1"
              value={formData.kgTotal}
              onChange={(e) => handleKgTotalChange(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Date & Notes Row */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="orderDate"
              label="תאריך הזמנה"
              type="date"
              value={formData.orderDate}
              onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
            />
            <Input
              id="notes"
              label="הערות"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          {/* Files & Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">קבצים ותמונות</label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleAddPendingFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              <PaperClipIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
              <p className="text-sm text-gray-500">
                {isDragging ? 'שחרר כאן להעלאה' : 'גרור קבצים לכאן או לחץ לבחירה'}
              </p>
            </div>

            {/* Existing files (edit mode) */}
            {editingProduct && editingProductFiles && editingProductFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium">קבצים קיימים:</p>
                <div className="flex flex-wrap gap-2">
                  {editingProductFiles.map((file) => {
                    const isImage = file.fileType.startsWith('image/');
                    return (
                      <div
                        key={file._id}
                        className="relative group flex items-center gap-2 bg-gray-50 border rounded-lg px-2 py-1.5"
                      >
                        {isImage && file.url ? (
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                            <img src={file.url} alt={file.fileName} className="w-8 h-8 rounded object-cover" />
                            <span className="text-xs text-gray-700 max-w-[120px] truncate">{file.fileName}</span>
                          </a>
                        ) : (
                          <a href={file.url || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                            <ArrowDownTrayIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-700 max-w-[120px] truncate">{file.fileName}</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file._id);
                          }}
                          className="p-0.5 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending files preview */}
            {pendingFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium">קבצים להעלאה:</p>
                <div className="flex flex-wrap gap-2">
                  {pendingFiles.map((file, index) => {
                    const isImage = file.type.startsWith('image/');
                    return (
                      <div
                        key={`${file.name}-${index}`}
                        className="relative group flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5"
                      >
                        {isImage ? (
                          <PhotoIcon className="w-4 h-4 text-blue-500" />
                        ) : (
                          <PaperClipIcon className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="text-xs text-gray-700 max-w-[120px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePendingFile(index);
                          }}
                          className="p-0.5 text-red-400 hover:text-red-600"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingProduct ? 'עדכן' : 'הוסף'}
            </Button>
          </div>
        </div>
      </Modal>

      {ConfirmDialog}
    </div>
  );
}
