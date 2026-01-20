'use client';

import { useState, Fragment, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import {
  PlusIcon,
  MinusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
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

interface Milestone {
  milestoneId: string;
  productId: string;
  milestoneTypeId: string;
  targetDate?: string;
  actualDate?: string;
  status?: string;
  notes?: string;
}

interface ProductsTabProps {
  orderId: string;
  products: Product[];
  productMilestones: Milestone[];
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
  productMilestones,
}: ProductsTabProps) {
  const { showToast } = useToast();
  const addProductMutation = useMutation(api.products.addProduct);
  const updateProductMutation = useMutation(api.products.updateProduct);
  const deleteProductMutation = useMutation(api.products.deleteProduct);
  const addProductMilestoneMutation = useMutation(api.milestones.addProductMilestone);
  const updateProductMilestoneMutation = useMutation(api.milestones.updateProductMilestone);
  const deleteProductMilestoneMutation = useMutation(api.milestones.deleteProductMilestone);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(getEmptyProduct);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [milestoneProductId, setMilestoneProductId] = useState<string | null>(null);
  const [newMilestone, setNewMilestone] = useState({
    description: '',
    targetDate: '',
    notes: '',
  });
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [showCurrencySuggestions, setShowCurrencySuggestions] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  // Get all unique suppliers from all products across all orders
  const allSuppliers = useQuery(api.products.getAllSuppliers) ?? [];

  // Filter suppliers based on current input (max 3)
  const filteredSuppliers = useMemo(() => {
    if (!formData.supplier.trim()) return allSuppliers.slice(0, 3);
    return allSuppliers
      .filter((s) => s.toLowerCase().includes(formData.supplier.toLowerCase()))
      .slice(0, 3);
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

  const getMilestonesForProduct = (productId: string) => {
    return productMilestones.filter((m) => m.productId === productId);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(getEmptyProduct());
    setCurrencySearch('');
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

  const handleSubmit = async () => {
    try {
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
        showToast('מוצר עודכן בהצלחה', 'success');
      } else {
        await addProductMutation({
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
        });
        showToast('מוצר נוסף בהצלחה', 'success');
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving product:', error);
      showToast('שגיאה בשמירת מוצר', 'error');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('האם למחוק את המוצר?')) return;

    try {
      await deleteProductMutation({ productId });
      showToast('מוצר נמחק', 'success');
    } catch (error) {
      console.error('Error deleting product:', error);
      showToast('שגיאה במחיקת מוצר', 'error');
    }
  };

  const openMilestoneModal = (productId: string) => {
    setMilestoneProductId(productId);
    setNewMilestone({ description: '', targetDate: '', notes: '' });
    setShowMilestoneModal(true);
  };

  const handleAddMilestone = async () => {
    if (!milestoneProductId) return;

    try {
      await addProductMilestoneMutation({
        productId: milestoneProductId,
        milestoneTypeId: 'custom',
        targetDate: newMilestone.targetDate || undefined,
        status: newMilestone.description,
        notes: newMilestone.notes || undefined,
      });

      showToast('מיילסטון נוסף בהצלחה', 'success');
      setShowMilestoneModal(false);
    } catch (error) {
      console.error('Error adding milestone:', error);
      showToast('שגיאה בהוספת מיילסטון', 'error');
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, actualDate: string) => {
    try {
      await updateProductMilestoneMutation({
        milestoneId,
        actualDate,
      });

      showToast('מיילסטון עודכן', 'success');
    } catch (error) {
      console.error('Error updating milestone:', error);
      showToast('שגיאה בעדכון מיילסטון', 'error');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('האם למחוק את המיילסטון?')) return;

    try {
      await deleteProductMilestoneMutation({ milestoneId });
      showToast('מיילסטון נמחק', 'success');
    } catch (error) {
      console.error('Error deleting milestone:', error);
      showToast('שגיאה במחיקת מיילסטון', 'error');
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
                <th className="text-right py-3 px-4 font-medium text-gray-600">כמות</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">מחיר/יח</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">סה"כ</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">עלות סופית ₪</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const milestones = getMilestonesForProduct(product.productId);
                const isExpanded = expandedProductId === product.productId;

                return (
                  <Fragment key={product.productId}>
                    <tr
                      className={`border-b hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                      onClick={() => setExpandedProductId(isExpanded ? null : product.productId)}
                    >
                      <td className="py-3 px-4">
                        <button
                          className="p-1 rounded hover:bg-gray-200 transition-colors"
                        >
                          {isExpanded ? (
                            <MinusIcon className="w-4 h-4 text-gray-600" />
                          ) : (
                            <PlusIcon className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-medium">{product.name}</td>
                      <td className="py-3 px-4">{product.quantity}</td>
                      <td className="py-3 px-4">{formatNumber(product.pricePerUnit)} {product.currency}</td>
                      <td className="py-3 px-4">{formatNumber(product.priceTotal)} {product.currency}</td>
                      <td className="py-3 px-4 font-semibold text-blue-600">
                        {formatCurrency(product.finalCostILS || 0)}
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
                    {isExpanded && (
                      <tr key={`${product.productId}-details`}>
                        <td colSpan={7} className="bg-gray-50 px-6 py-4">
                          {/* Product Details Section */}
                          <div className="grid grid-cols-2 gap-6 mb-6">
                            {/* Right Column - Basic Info */}
                            <div className="bg-white rounded-lg p-4 border">
                              <h4 className="text-sm font-semibold text-gray-800 mb-3 border-b pb-2">פרטי מוצר</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">ספק:</span>
                                  <span className="font-medium">{product.supplier || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">תאריך הזמנה:</span>
                                  <span className="font-medium">{product.orderDate ? formatDate(product.orderDate) : '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">CBM ליחידה:</span>
                                  <span className="font-medium">{formatNumber(product.cbmPerUnit, 3)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">CBM סה"כ:</span>
                                  <span className="font-medium">{formatNumber(product.cbmTotal, 3)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">KG ליחידה:</span>
                                  <span className="font-medium">{formatNumber(product.kgPerUnit, 1)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">KG סה"כ:</span>
                                  <span className="font-medium">{formatNumber(product.kgTotal, 1)}</span>
                                </div>
                                {product.notes && (
                                  <div className="flex justify-between border-t pt-2">
                                    <span className="text-gray-500">הערות:</span>
                                    <span className="font-medium">{product.notes}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Left Column - Cost Breakdown */}
                            <div className="bg-white rounded-lg p-4 border">
                              <h4 className="text-sm font-semibold text-gray-800 mb-3 border-b pb-2">פירוט עלויות</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">עלות מקורית:</span>
                                  <span className="font-medium">{formatCurrency(product.priceILS || 0)}</span>
                                </div>
                                <div className="flex justify-between text-orange-600">
                                  <span>עלויות נוספות:</span>
                                  <span className="font-medium">+ {formatCurrency(product.additionalCostsILS || 0)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-2 font-semibold">
                                  <span className="text-gray-700">עלות סופית:</span>
                                  <span className="text-blue-600">{formatCurrency(product.finalCostILS || 0)}</span>
                                </div>
                                <div className="flex justify-between text-blue-600">
                                  <span>עלות סופית ליחידה:</span>
                                  <span className="font-semibold">{formatCurrency(product.finalCostPerUnitILS || 0)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Milestones Section */}
                          <div className="bg-white rounded-lg p-4 border">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-semibold text-gray-800">מיילסטונים</h4>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openMilestoneModal(product.productId);
                                }}
                              >
                                <PlusIcon className="w-3 h-3" />
                                הוסף מיילסטון
                              </Button>
                            </div>
                            {milestones.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-4">
                                אין מיילסטונים - הוסף מיילסטון ראשון למעקב התקדמות
                              </p>
                            ) : (
                            <div className="py-4" dir="ltr">
                              {/* Progress Steps */}
                              <div className="relative">
                                {/* Background line */}
                                <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200" />

                                {/* Progress line */}
                                {(() => {
                                  const sorted = [...milestones].sort((a, b) => {
                                    const dateA = a.targetDate || a.actualDate || '';
                                    const dateB = b.targetDate || b.actualDate || '';
                                    return dateA.localeCompare(dateB);
                                  });
                                  const today = new Date().toISOString().split('T')[0];
                                  let lastCompletedIndex = -1;
                                  let lastOverdueIndex = -1;
                                  sorted.forEach((m, i) => {
                                    if (m.actualDate) lastCompletedIndex = i;
                                    else if (m.targetDate && m.targetDate < today) lastOverdueIndex = i;
                                  });

                                  return (
                                    <>
                                      {lastCompletedIndex >= 0 && (
                                        <div
                                          className="absolute top-5 left-0 h-1 bg-green-500 transition-all"
                                          style={{ width: `${((lastCompletedIndex + 0.5) / sorted.length) * 100}%` }}
                                        />
                                      )}
                                      {lastOverdueIndex > lastCompletedIndex && (
                                        <div
                                          className="absolute top-5 h-1 bg-red-500 transition-all"
                                          style={{
                                            left: `${((lastCompletedIndex + 0.5) / sorted.length) * 100}%`,
                                            width: `${((lastOverdueIndex - lastCompletedIndex) / sorted.length) * 100}%`
                                          }}
                                        />
                                      )}
                                    </>
                                  );
                                })()}

                                {/* Milestones */}
                                <div className="relative flex justify-between">
                                  {milestones
                                    .sort((a, b) => {
                                      const dateA = a.targetDate || a.actualDate || '';
                                      const dateB = b.targetDate || b.actualDate || '';
                                      return dateA.localeCompare(dateB);
                                    })
                                    .map((milestone, index, arr) => {
                                      const isCompleted = !!milestone.actualDate;
                                      const today = new Date().toISOString().split('T')[0];
                                      const isOverdue = !isCompleted && milestone.targetDate && milestone.targetDate < today;

                                      const getCircleClasses = () => {
                                        if (isCompleted) return 'bg-green-500 border-green-500 text-white';
                                        if (isOverdue) return 'bg-red-500 border-red-500 text-white';
                                        return 'bg-white border-gray-300 text-gray-400';
                                      };

                                      return (
                                        <div
                                          key={milestone.milestoneId}
                                          className="flex flex-col items-center group relative"
                                          style={{ width: `${100 / arr.length}%` }}
                                        >
                                          {/* Circle */}
                                          <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-4 transition-all z-10 ${getCircleClasses()}`}
                                          >
                                            {isCompleted ? (
                                              <CheckCircleIcon className="w-6 h-6" />
                                            ) : isOverdue ? (
                                              <ClockIcon className="w-5 h-5" />
                                            ) : (
                                              <span className="text-sm font-bold">{index + 1}</span>
                                            )}
                                          </div>

                                          {/* Label */}
                                          <div className="text-center mt-2">
                                            <p
                                              className={`text-sm font-medium ${
                                                isCompleted ? 'text-green-700' : isOverdue ? 'text-red-600' : 'text-gray-600'
                                              }`}
                                            >
                                              {milestone.status}
                                            </p>
                                            <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                              {milestone.actualDate
                                                ? formatDate(milestone.actualDate)
                                                : milestone.targetDate
                                                ? formatDate(milestone.targetDate)
                                                : ''}
                                            </p>
                                            {isOverdue && (
                                              <p className="text-xs text-red-500 font-medium">באיחור</p>
                                            )}
                                          </div>

                                          {/* Actions on hover */}
                                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white shadow-lg rounded-lg p-1 border z-20">
                                            {!isCompleted && (
                                              <button
                                                onClick={() =>
                                                  handleUpdateMilestone(
                                                    milestone.milestoneId,
                                                    new Date().toISOString().split('T')[0]
                                                  )
                                                }
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                                title="סמן כהושלם"
                                              >
                                                <CheckCircleIcon className="w-4 h-4" />
                                              </button>
                                            )}
                                            <button
                                              onClick={() => handleDeleteMilestone(milestone.milestoneId)}
                                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                              title="מחק"
                                            >
                                              <TrashIcon className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
            <Input
              id="name"
              label="שם המוצר"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
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
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
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

      {/* Milestone Modal */}
      <Modal
        isOpen={showMilestoneModal}
        onClose={() => setShowMilestoneModal(false)}
        title="הוסף מיילסטון למוצר"
      >
        <div className="space-y-4">
          <Input
            id="milestone_description"
            label="תיאור"
            value={newMilestone.description}
            onChange={(e) =>
              setNewMilestone({ ...newMilestone, description: e.target.value })
            }
            placeholder="לדוגמה: יצא מסין, הגיע לנמל"
            required
          />

          <Input
            id="milestone_target_date"
            label="תאריך יעד"
            type="date"
            value={newMilestone.targetDate}
            onChange={(e) =>
              setNewMilestone({ ...newMilestone, targetDate: e.target.value })
            }
          />

          <Input
            id="milestone_notes"
            label="הערות"
            value={newMilestone.notes}
            onChange={(e) =>
              setNewMilestone({ ...newMilestone, notes: e.target.value })
            }
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowMilestoneModal(false)}>
              ביטול
            </Button>
            <Button onClick={handleAddMilestone} disabled={!newMilestone.description}>
              הוסף
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
