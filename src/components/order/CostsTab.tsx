'use client';

import { useState } from 'react';
import { AdditionalCost, Product } from '@/lib/sheets';
import { formatCurrency } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface CostsTabProps {
  orderId: string;
  costs: AdditionalCost[];
  products: Product[];
  onRefresh: () => void;
}

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'ILS', label: 'ILS (₪)' },
];

const ALLOCATION_METHODS = [
  { value: 'שווה', label: 'שווה - לפי מספר מוצרים' },
  { value: 'נפח', label: 'נפח - לפי CBM' },
  { value: 'משקל', label: 'משקל - לפי KG' },
  { value: 'עלות', label: 'עלות - לפי עלות המוצר' },
  { value: 'כמות', label: 'כמות - לפי מספר יחידות' },
];

type Currency = 'USD' | 'CNY' | 'ILS';
type AllocationMethod = 'נפח' | 'משקל' | 'עלות' | 'כמות' | 'שווה';

interface CostFormData {
  description: string;
  amount: number;
  currency: Currency;
  allocation_method: AllocationMethod;
  notes: string;
  linkedProductIds: string[];
}

const emptyCost: CostFormData = {
  description: '',
  amount: 0,
  currency: 'USD',
  allocation_method: 'שווה',
  notes: '',
  linkedProductIds: [],
};

export default function CostsTab({
  orderId,
  costs,
  products,
  onRefresh,
}: CostsTabProps) {
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingCost, setEditingCost] = useState<AdditionalCost | null>(null);
  const [formData, setFormData] = useState(emptyCost);

  const openAddModal = () => {
    setEditingCost(null);
    setFormData({
      ...emptyCost,
      linkedProductIds: products.map((p) => p.id), // Default: all products
    });
    setShowModal(true);
  };

  const openEditModal = (cost: AdditionalCost) => {
    setEditingCost(cost);
    setFormData({
      description: cost.description,
      amount: cost.amount,
      currency: cost.currency,
      allocation_method: cost.allocation_method,
      notes: cost.notes,
      linkedProductIds: products.map((p) => p.id), // TODO: Load actual links
    });
    setShowModal(true);
  };

  const toggleProduct = (productId: string) => {
    setFormData((prev) => ({
      ...prev,
      linkedProductIds: prev.linkedProductIds.includes(productId)
        ? prev.linkedProductIds.filter((id) => id !== productId)
        : [...prev.linkedProductIds, productId],
    }));
  };

  const handleSubmit = async () => {
    try {
      if (editingCost) {
        const response = await fetch(`/api/costs/${editingCost.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error('Failed to update cost');
        showToast('עלות עודכנה בהצלחה', 'success');
      } else {
        const response = await fetch(`/api/orders/${orderId}/costs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error('Failed to add cost');
        showToast('עלות נוספה בהצלחה', 'success');
      }

      setShowModal(false);
      onRefresh();
    } catch (error) {
      console.error('Error saving cost:', error);
      showToast('שגיאה בשמירת עלות', 'error');
    }
  };

  const handleDelete = async (costId: string) => {
    if (!confirm('האם למחוק את העלות?')) return;

    try {
      const response = await fetch(`/api/costs/${costId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete cost');
      showToast('עלות נמחקה', 'success');
      onRefresh();
    } catch (error) {
      console.error('Error deleting cost:', error);
      showToast('שגיאה במחיקת עלות', 'error');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">עלויות נוספות</h3>
        <Button size="sm" onClick={openAddModal}>
          <PlusIcon className="w-4 h-4" />
          הוסף עלות
        </Button>
      </div>

      {costs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">אין עלויות נוספות</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-right py-3 px-4 font-medium text-gray-600">תיאור</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">סכום</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">מטבע</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">סכום ₪</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">שיטת חלוקה</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">מוצרים</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">הערות</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((cost) => (
                <tr key={cost.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{cost.description}</td>
                  <td className="py-3 px-4">{cost.amount}</td>
                  <td className="py-3 px-4">{cost.currency}</td>
                  <td className="py-3 px-4">{formatCurrency(cost.amountILS || 0)}</td>
                  <td className="py-3 px-4">{cost.allocation_method}</td>
                  <td className="py-3 px-4">
                    {cost.linkedProductCount || products.length}/{products.length}
                  </td>
                  <td className="py-3 px-4 text-gray-500">{cost.notes}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(cost)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cost.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cost Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCost ? 'עריכת עלות' : 'הוסף עלות'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            id="description"
            label="תיאור"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="לדוגמה: משלוח ימי, מכס"
            required
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              id="amount"
              label="סכום"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
              }
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
            <Select
              id="allocation_method"
              label="שיטת חלוקה"
              options={ALLOCATION_METHODS}
              value={formData.allocation_method}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  allocation_method: e.target.value as typeof formData.allocation_method,
                })
              }
            />
          </div>

          <Input
            id="notes"
            label="הערות"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              מוצרים מקושרים
            </label>
            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
              {products.length === 0 ? (
                <p className="text-gray-500 text-sm">אין מוצרים בהזמנה</p>
              ) : (
                products.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.linkedProductIds.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">
                      {product.name} ({product.supplier})
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.description}>
              {editingCost ? 'עדכן' : 'הוסף'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
