'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatCurrency } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Cost {
  costId: string;
  orderId: string;
  description: string;
  amount: number;
  currency: 'USD' | 'CNY' | 'ILS';
  allocationMethod: 'שווה' | 'נפח' | 'משקל' | 'עלות' | 'כמות';
  notes?: string;
  amountILS?: number;
  linkedProductCount?: number;
}

interface Product {
  productId: string;
  name: string;
  supplier?: string;
}

interface CostsTabProps {
  orderId: string;
  costs: Cost[];
  products: Product[];
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
  allocationMethod: AllocationMethod;
  notes: string;
  linkedProductIds: string[];
}

const emptyCost: CostFormData = {
  description: '',
  amount: 0,
  currency: 'USD',
  allocationMethod: 'שווה',
  notes: '',
  linkedProductIds: [],
};

export default function CostsTab({
  orderId,
  costs,
  products,
}: CostsTabProps) {
  const { showToast } = useToast();
  const addCostMutation = useMutation(api.costs.addCost);
  const updateCostMutation = useMutation(api.costs.updateCost);
  const deleteCostMutation = useMutation(api.costs.deleteCost);
  const updateCostProductLinksMutation = useMutation(api.costs.updateCostProductLinks);

  const [showModal, setShowModal] = useState(false);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);
  const [formData, setFormData] = useState(emptyCost);

  const openAddModal = () => {
    setEditingCost(null);
    setFormData({
      ...emptyCost,
      linkedProductIds: products.map((p) => p.productId),
    });
    setShowModal(true);
  };

  const openEditModal = (cost: Cost) => {
    setEditingCost(cost);
    setFormData({
      description: cost.description,
      amount: cost.amount,
      currency: cost.currency,
      allocationMethod: cost.allocationMethod,
      notes: cost.notes || '',
      linkedProductIds: products.map((p) => p.productId),
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
        await updateCostMutation({
          costId: editingCost.costId,
          description: formData.description,
          amount: formData.amount,
          currency: formData.currency,
          allocationMethod: formData.allocationMethod,
          notes: formData.notes || undefined,
        });

        await updateCostProductLinksMutation({
          costId: editingCost.costId,
          linkedProductIds: formData.linkedProductIds,
        });

        showToast('עלות עודכנה בהצלחה', 'success');
      } else {
        const costId = await addCostMutation({
          orderId,
          description: formData.description,
          amount: formData.amount,
          currency: formData.currency,
          allocationMethod: formData.allocationMethod,
          notes: formData.notes || undefined,
        });

        await updateCostProductLinksMutation({
          costId,
          linkedProductIds: formData.linkedProductIds,
        });

        showToast('עלות נוספה בהצלחה', 'success');
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving cost:', error);
      showToast('שגיאה בשמירת עלות', 'error');
    }
  };

  const handleDelete = async (costId: string) => {
    if (!confirm('האם למחוק את העלות?')) return;

    try {
      await deleteCostMutation({ costId });
      showToast('עלות נמחקה', 'success');
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
                <tr key={cost.costId} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{cost.description}</td>
                  <td className="py-3 px-4">{cost.amount}</td>
                  <td className="py-3 px-4">{cost.currency}</td>
                  <td className="py-3 px-4">{formatCurrency(cost.amountILS || 0)}</td>
                  <td className="py-3 px-4">{cost.allocationMethod}</td>
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
                        onClick={() => handleDelete(cost.costId)}
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
              id="allocationMethod"
              label="שיטת חלוקה"
              options={ALLOCATION_METHODS}
              value={formData.allocationMethod}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  allocationMethod: e.target.value as typeof formData.allocationMethod,
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
                    key={product.productId}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.linkedProductIds.includes(product.productId)}
                      onChange={() => toggleProduct(product.productId)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">
                      {product.name} ({product.supplier || 'ללא ספק'})
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
