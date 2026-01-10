'use client';

import { useState } from 'react';
import { Payment, Product, AdditionalCost } from '@/lib/sheets';
import { formatCurrency, formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface PaymentsTabProps {
  orderId: string;
  payments: Payment[];
  products: Product[];
  costs: AdditionalCost[];
  onRefresh: () => void;
}

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'ILS', label: 'ILS (₪)' },
];

type Currency = 'USD' | 'CNY' | 'ILS';

interface PaymentFormData {
  date: string;
  amount: number;
  currency: Currency;
  payee: string;
  description: string;
  reference: string;
  product_id: string;
  cost_id: string;
}

const emptyPayment: PaymentFormData = {
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  currency: 'USD',
  payee: '',
  description: '',
  reference: '',
  product_id: '',
  cost_id: '',
};

export default function PaymentsTab({
  orderId,
  payments,
  products,
  costs,
  onRefresh,
}: PaymentsTabProps) {
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState(emptyPayment);

  const openAddModal = () => {
    setEditingPayment(null);
    setFormData(emptyPayment);
    setShowModal(true);
  };

  const openEditModal = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      date: payment.date,
      amount: payment.amount,
      currency: payment.currency,
      payee: payment.payee,
      description: payment.description,
      reference: payment.reference,
      product_id: payment.product_id || '',
      cost_id: payment.cost_id || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingPayment) {
        const response = await fetch(`/api/payments/${editingPayment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error('Failed to update payment');
        showToast('תשלום עודכן בהצלחה', 'success');
      } else {
        const response = await fetch(`/api/orders/${orderId}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error('Failed to add payment');
        showToast('תשלום נוסף בהצלחה', 'success');
      }

      setShowModal(false);
      onRefresh();
    } catch (error) {
      console.error('Error saving payment:', error);
      showToast('שגיאה בשמירת תשלום', 'error');
    }
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm('האם למחוק את התשלום?')) return;

    try {
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete payment');
      showToast('תשלום נמחק', 'success');
      onRefresh();
    } catch (error) {
      console.error('Error deleting payment:', error);
      showToast('שגיאה במחיקת תשלום', 'error');
    }
  };

  const getLinkLabel = (payment: Payment) => {
    if (payment.product_id) {
      const product = products.find((p) => p.id === payment.product_id);
      return product ? `מוצר: ${product.name}` : 'מוצר';
    }
    if (payment.cost_id) {
      const cost = costs.find((c) => c.id === payment.cost_id);
      return cost ? `עלות: ${cost.description}` : 'עלות';
    }
    return 'הזמנה';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">תשלומים</h3>
        <Button size="sm" onClick={openAddModal}>
          <PlusIcon className="w-4 h-4" />
          הוסף תשלום
        </Button>
      </div>

      {payments.length === 0 ? (
        <p className="text-gray-500 text-center py-8">אין תשלומים</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-right py-3 px-4 font-medium text-gray-600">תאריך</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">נמען</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">תיאור</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">סכום</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">מטבע</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">סכום ₪</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">אסמכתא</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">קישור</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{formatDate(payment.date)}</td>
                  <td className="py-3 px-4 font-medium">{payment.payee}</td>
                  <td className="py-3 px-4">{payment.description}</td>
                  <td className="py-3 px-4">{payment.amount}</td>
                  <td className="py-3 px-4">{payment.currency}</td>
                  <td className="py-3 px-4 font-semibold text-green-600">
                    {formatCurrency(payment.amountILS || 0)}
                  </td>
                  <td className="py-3 px-4 text-gray-500">{payment.reference}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {getLinkLabel(payment)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(payment)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(payment.id)}
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

      {/* Payment Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingPayment ? 'עריכת תשלום' : 'הוסף תשלום'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="date"
              label="תאריך"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <Input
              id="payee"
              label="נמען"
              value={formData.payee}
              onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
              placeholder="למי שולם?"
              required
            />
          </div>

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
            <Input
              id="reference"
              label="אסמכתא"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="מספר העברה"
            />
          </div>

          <Input
            id="description"
            label="תיאור"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="מקדמה, יתרה, וכו'"
          />

          {/* Link to Product/Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              קישור ל:
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Select
                id="product_id"
                label="מוצר (אופציונלי)"
                options={[
                  { value: '', label: '-- ללא --' },
                  ...products.map((p) => ({ value: p.id, label: p.name })),
                ]}
                value={formData.product_id}
                onChange={(e) =>
                  setFormData({ ...formData, product_id: e.target.value, cost_id: '' })
                }
              />
              <Select
                id="cost_id"
                label="עלות נוספת (אופציונלי)"
                options={[
                  { value: '', label: '-- ללא --' },
                  ...costs.map((c) => ({ value: c.id, label: c.description })),
                ]}
                value={formData.cost_id}
                onChange={(e) =>
                  setFormData({ ...formData, cost_id: e.target.value, product_id: '' })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.payee || !formData.amount}>
              {editingPayment ? 'עדכן' : 'הוסף'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
