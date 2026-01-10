'use client';

import { useState } from 'react';
import { Product, Milestone } from '@/lib/sheets';
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

interface ProductsTabProps {
  orderId: string;
  products: Product[];
  productMilestones: Milestone[];
  onRefresh: () => void;
}

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'ILS', label: 'ILS (₪)' },
];

type Currency = 'USD' | 'CNY' | 'ILS';

interface ProductFormData {
  name: string;
  supplier: string;
  quantity: number;
  price_per_unit: number;
  price_total: number;
  currency: Currency;
  cbm_per_unit: number;
  cbm_total: number;
  kg_per_unit: number;
  kg_total: number;
  order_date: string;
  notes: string;
}

const emptyProduct: ProductFormData = {
  name: '',
  supplier: '',
  quantity: 0,
  price_per_unit: 0,
  price_total: 0,
  currency: 'USD',
  cbm_per_unit: 0,
  cbm_total: 0,
  kg_per_unit: 0,
  kg_total: 0,
  order_date: '',
  notes: '',
};

export default function ProductsTab({
  orderId,
  products,
  productMilestones,
  onRefresh,
}: ProductsTabProps) {
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [milestoneProductId, setMilestoneProductId] = useState<string | null>(null);
  const [newMilestone, setNewMilestone] = useState({
    description: '',
    target_date: '',
    notes: '',
  });

  const getMilestonesForProduct = (productId: string) => {
    return productMilestones.filter((m) => m.product_id === productId);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(emptyProduct);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      supplier: product.supplier,
      quantity: product.quantity,
      price_per_unit: product.price_per_unit,
      price_total: product.price_total,
      currency: product.currency,
      cbm_per_unit: product.cbm_per_unit,
      cbm_total: product.cbm_total,
      kg_per_unit: product.kg_per_unit,
      kg_total: product.kg_total,
      order_date: product.order_date,
      notes: product.notes,
    });
    setShowModal(true);
  };

  const handleQuantityChange = (qty: number) => {
    setFormData({
      ...formData,
      quantity: qty,
      price_total: qty * formData.price_per_unit,
      cbm_total: qty * formData.cbm_per_unit,
      kg_total: qty * formData.kg_per_unit,
    });
  };

  const handlePricePerUnitChange = (price: number) => {
    setFormData({
      ...formData,
      price_per_unit: price,
      price_total: formData.quantity * price,
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingProduct) {
        const response = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error('Failed to update product');
        showToast('מוצר עודכן בהצלחה', 'success');
      } else {
        const response = await fetch(`/api/orders/${orderId}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error('Failed to add product');
        showToast('מוצר נוסף בהצלחה', 'success');
      }

      setShowModal(false);
      onRefresh();
    } catch (error) {
      console.error('Error saving product:', error);
      showToast('שגיאה בשמירת מוצר', 'error');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('האם למחוק את המוצר?')) return;

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete product');
      showToast('מוצר נמחק', 'success');
      onRefresh();
    } catch (error) {
      console.error('Error deleting product:', error);
      showToast('שגיאה במחיקת מוצר', 'error');
    }
  };

  const openMilestoneModal = (productId: string) => {
    setMilestoneProductId(productId);
    setNewMilestone({ description: '', target_date: '', notes: '' });
    setShowMilestoneModal(true);
  };

  const handleAddMilestone = async () => {
    if (!milestoneProductId) return;

    try {
      const product = products.find((p) => p.id === milestoneProductId);
      const response = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          product_id: milestoneProductId,
          ...newMilestone,
        }),
      });

      if (!response.ok) throw new Error('Failed to add milestone');

      showToast('מיילסטון נוסף בהצלחה', 'success');
      setShowMilestoneModal(false);
      onRefresh();
    } catch (error) {
      console.error('Error adding milestone:', error);
      showToast('שגיאה בהוספת מיילסטון', 'error');
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, actualDate: string) => {
    try {
      const response = await fetch(`/api/milestones/${milestoneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_date: actualDate }),
      });

      if (!response.ok) throw new Error('Failed to update milestone');

      showToast('מיילסטון עודכן', 'success');
      onRefresh();
    } catch (error) {
      console.error('Error updating milestone:', error);
      showToast('שגיאה בעדכון מיילסטון', 'error');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('האם למחוק את המיילסטון?')) return;

    try {
      const response = await fetch(`/api/milestones/${milestoneId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete milestone');

      showToast('מיילסטון נמחק', 'success');
      onRefresh();
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
                const milestones = getMilestonesForProduct(product.id);
                const isExpanded = expandedProductId === product.id;

                return (
                  <>
                    <tr
                      key={product.id}
                      className={`border-b hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                      onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
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
                      <td className="py-3 px-4">{formatNumber(product.price_per_unit)} {product.currency}</td>
                      <td className="py-3 px-4">{formatNumber(product.price_total)} {product.currency}</td>
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
                            onClick={() => handleDelete(product.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${product.id}-details`}>
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
                                  <span className="font-medium">{product.order_date ? formatDate(product.order_date) : '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">CBM ליחידה:</span>
                                  <span className="font-medium">{formatNumber(product.cbm_per_unit, 3)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">CBM סה"כ:</span>
                                  <span className="font-medium">{formatNumber(product.cbm_total, 3)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">KG ליחידה:</span>
                                  <span className="font-medium">{formatNumber(product.kg_per_unit, 1)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">KG סה"כ:</span>
                                  <span className="font-medium">{formatNumber(product.kg_total, 1)}</span>
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
                                  openMilestoneModal(product.id);
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
                                    const dateA = a.target_date || a.actual_date || '';
                                    const dateB = b.target_date || b.actual_date || '';
                                    return dateA.localeCompare(dateB);
                                  });
                                  const today = new Date().toISOString().split('T')[0];
                                  let lastCompletedIndex = -1;
                                  let lastOverdueIndex = -1;
                                  sorted.forEach((m, i) => {
                                    if (m.actual_date) lastCompletedIndex = i;
                                    else if (m.target_date && m.target_date < today) lastOverdueIndex = i;
                                  });
                                  const progressPercent = sorted.length > 1
                                    ? ((Math.max(lastCompletedIndex, lastOverdueIndex) + 1) / sorted.length) * 100
                                    : 0;
                                  const hasOverdue = lastOverdueIndex > lastCompletedIndex;

                                  return (
                                    <>
                                      {lastCompletedIndex >= 0 && (
                                        <div
                                          className="absolute top-5 left-0 h-1 bg-green-500 transition-all"
                                          style={{ width: `${((lastCompletedIndex + 0.5) / sorted.length) * 100}%` }}
                                        />
                                      )}
                                      {hasOverdue && (
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
                                      const dateA = a.target_date || a.actual_date || '';
                                      const dateB = b.target_date || b.actual_date || '';
                                      return dateA.localeCompare(dateB);
                                    })
                                    .map((milestone, index, arr) => {
                                      const isCompleted = !!milestone.actual_date;
                                      const today = new Date().toISOString().split('T')[0];
                                      const isOverdue = !isCompleted && milestone.target_date && milestone.target_date < today;

                                      const getCircleClasses = () => {
                                        if (isCompleted) return 'bg-green-500 border-green-500 text-white';
                                        if (isOverdue) return 'bg-red-500 border-red-500 text-white';
                                        return 'bg-white border-gray-300 text-gray-400';
                                      };

                                      return (
                                        <div
                                          key={milestone.id}
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
                                              {milestone.description}
                                            </p>
                                            <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                              {milestone.actual_date
                                                ? formatDate(milestone.actual_date)
                                                : milestone.target_date
                                                ? formatDate(milestone.target_date)
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
                                                    milestone.id,
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
                                              onClick={() => handleDeleteMilestone(milestone.id)}
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
                  </>
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
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="name"
              label="שם המוצר"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              id="supplier"
              label="ספק"
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Input
              id="quantity"
              label="כמות"
              type="number"
              value={formData.quantity}
              onChange={(e) => handleQuantityChange(parseFloat(e.target.value) || 0)}
            />
            <Input
              id="price_per_unit"
              label="מחיר ליחידה"
              type="number"
              step="0.01"
              value={formData.price_per_unit}
              onChange={(e) => handlePricePerUnitChange(parseFloat(e.target.value) || 0)}
            />
            <Select
              id="currency"
              label="מטבע"
              options={CURRENCIES}
              value={formData.currency}
              onChange={(e) =>
                setFormData({ ...formData, currency: e.target.value as 'USD' | 'CNY' | 'ILS' })
              }
            />
            <Input
              id="price_total"
              label="סה״כ מחיר"
              type="number"
              step="0.01"
              value={formData.price_total}
              onChange={(e) =>
                setFormData({ ...formData, price_total: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Input
              id="cbm_per_unit"
              label="CBM ליחידה"
              type="number"
              step="0.001"
              value={formData.cbm_per_unit}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setFormData({
                  ...formData,
                  cbm_per_unit: val,
                  cbm_total: formData.quantity * val,
                });
              }}
            />
            <Input
              id="cbm_total"
              label="CBM סה״כ"
              type="number"
              step="0.001"
              value={formData.cbm_total}
              onChange={(e) =>
                setFormData({ ...formData, cbm_total: parseFloat(e.target.value) || 0 })
              }
            />
            <Input
              id="kg_per_unit"
              label="KG ליחידה"
              type="number"
              step="0.1"
              value={formData.kg_per_unit}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setFormData({
                  ...formData,
                  kg_per_unit: val,
                  kg_total: formData.quantity * val,
                });
              }}
            />
            <Input
              id="kg_total"
              label="KG סה״כ"
              type="number"
              step="0.1"
              value={formData.kg_total}
              onChange={(e) =>
                setFormData({ ...formData, kg_total: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="order_date"
              label="תאריך הזמנה"
              type="date"
              value={formData.order_date}
              onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
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
            value={newMilestone.target_date}
            onChange={(e) =>
              setNewMilestone({ ...newMilestone, target_date: e.target.value })
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
