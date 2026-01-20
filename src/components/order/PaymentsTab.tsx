'use client';

import { useState, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface Payment {
  paymentId: string;
  orderId: string;
  date: string;
  amount: number;
  currency: 'USD' | 'CNY' | 'ILS';
  payee?: string;
  description?: string;
  reference?: string;
  amountILS?: number;
  status: 'pending' | 'approved';
}

interface Product {
  productId: string;
  name: string;
}

interface Cost {
  costId: string;
  description: string;
}

interface PaymentProductLink {
  paymentId: string;
  productId: string;
}

interface PaymentCostLink {
  paymentId: string;
  costId: string;
}

interface PaymentsTabProps {
  orderId: string;
  payments: Payment[];
  products: Product[];
  costs: Cost[];
  paymentProductLinks: PaymentProductLink[];
  paymentCostLinks: PaymentCostLink[];
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
  linkedProductIds: string[];
  linkedCostIds: string[];
  status: 'pending' | 'approved';
}

const emptyPayment: PaymentFormData = {
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  currency: 'USD',
  payee: '',
  description: '',
  reference: '',
  linkedProductIds: [],
  linkedCostIds: [],
  status: 'approved',
};

export default function PaymentsTab({
  orderId,
  payments,
  products,
  costs,
  paymentProductLinks,
  paymentCostLinks,
}: PaymentsTabProps) {
  const { showToast } = useToast();
  const addPaymentMutation = useMutation(api.payments.addPayment);
  const updatePaymentMutation = useMutation(api.payments.updatePayment);
  const updatePaymentLinksMutation = useMutation(api.payments.updatePaymentLinks);
  const deletePaymentMutation = useMutation(api.payments.deletePayment);
  const approvePaymentMutation = useMutation(api.payments.approvePayment);
  const dismissPaymentMutation = useMutation(api.payments.dismissPayment);

  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState(emptyPayment);

  // Split payments into pending and approved
  const pendingPayments = useMemo(
    () => payments.filter((p) => p.status === 'pending'),
    [payments]
  );
  const approvedPayments = useMemo(
    () => payments.filter((p) => p.status === 'approved'),
    [payments]
  );

  // Get linked products/costs for a payment
  const getLinkedProductIds = (paymentId: string) =>
    paymentProductLinks.filter((l) => l.paymentId === paymentId).map((l) => l.productId);

  const getLinkedCostIds = (paymentId: string) =>
    paymentCostLinks.filter((l) => l.paymentId === paymentId).map((l) => l.costId);

  // Get linked names for display
  const getLinkedNames = (paymentId: string) => {
    const productIds = getLinkedProductIds(paymentId);
    const costIds = getLinkedCostIds(paymentId);
    const names: string[] = [];

    for (const productId of productIds) {
      const product = products.find((p) => p.productId === productId);
      if (product) names.push(product.name);
    }

    for (const costId of costIds) {
      const cost = costs.find((c) => c.costId === costId);
      if (cost) names.push(cost.description);
    }

    return names.length > 0 ? names.join(', ') : '-';
  };

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
      payee: payment.payee || '',
      description: payment.description || '',
      reference: payment.reference || '',
      linkedProductIds: getLinkedProductIds(payment.paymentId),
      linkedCostIds: getLinkedCostIds(payment.paymentId),
      status: payment.status,
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

  const toggleCost = (costId: string) => {
    setFormData((prev) => ({
      ...prev,
      linkedCostIds: prev.linkedCostIds.includes(costId)
        ? prev.linkedCostIds.filter((id) => id !== costId)
        : [...prev.linkedCostIds, costId],
    }));
  };

  const handleSubmit = async () => {
    try {
      if (editingPayment) {
        await updatePaymentMutation({
          paymentId: editingPayment.paymentId,
          date: formData.date,
          amount: formData.amount,
          currency: formData.currency,
          payee: formData.payee || undefined,
          description: formData.description || undefined,
          reference: formData.reference || undefined,
          status: formData.status,
        });

        await updatePaymentLinksMutation({
          paymentId: editingPayment.paymentId,
          linkedProductIds: formData.linkedProductIds,
          linkedCostIds: formData.linkedCostIds,
        });

        showToast('תשלום עודכן בהצלחה', 'success');
      } else {
        await addPaymentMutation({
          orderId,
          date: formData.date,
          amount: formData.amount,
          currency: formData.currency,
          payee: formData.payee || undefined,
          description: formData.description || undefined,
          reference: formData.reference || undefined,
          status: formData.status,
          linkedProductIds: formData.linkedProductIds,
          linkedCostIds: formData.linkedCostIds,
        });
        showToast('תשלום נוסף בהצלחה', 'success');
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving payment:', error);
      showToast('שגיאה בשמירת תשלום', 'error');
    }
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm('האם למחוק את התשלום?')) return;

    try {
      await deletePaymentMutation({ paymentId });
      showToast('תשלום נמחק', 'success');
    } catch (error) {
      console.error('Error deleting payment:', error);
      showToast('שגיאה במחיקת תשלום', 'error');
    }
  };

  const handleApprove = async (paymentId: string) => {
    try {
      await approvePaymentMutation({ paymentId });
      showToast('תשלום אושר', 'success');
    } catch (error) {
      console.error('Error approving payment:', error);
      showToast('שגיאה באישור תשלום', 'error');
    }
  };

  const handleDismiss = async (paymentId: string) => {
    if (!confirm('האם לבטל את התשלום הממתין?')) return;

    try {
      await dismissPaymentMutation({ paymentId });
      showToast('תשלום ממתין בוטל', 'success');
    } catch (error) {
      console.error('Error dismissing payment:', error);
      showToast('שגיאה בביטול תשלום', 'error');
    }
  };

  const PaymentTable = ({
    paymentsList,
    isPending,
  }: {
    paymentsList: Payment[];
    isPending: boolean;
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b ${isPending ? 'bg-amber-50' : 'bg-gray-50'}`}>
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
          {paymentsList.map((payment) => (
            <tr
              key={payment.paymentId}
              className={`border-b hover:bg-gray-50 cursor-pointer ${
                isPending ? 'bg-amber-50/50 border-r-4 border-r-amber-400' : ''
              }`}
              onClick={() => openEditModal(payment)}
            >
              <td className="py-3 px-4">{formatDate(payment.date)}</td>
              <td className="py-3 px-4 font-medium">{payment.payee || '-'}</td>
              <td className="py-3 px-4">{payment.description || '-'}</td>
              <td className="py-3 px-4">{payment.amount}</td>
              <td className="py-3 px-4">{payment.currency}</td>
              <td className="py-3 px-4 font-semibold text-green-600">
                {formatCurrency(payment.amountILS || 0)}
              </td>
              <td className="py-3 px-4 text-gray-500">{payment.reference || '-'}</td>
              <td className="py-3 px-4">
                <span className="text-xs bg-gray-100 px-2 py-1 rounded max-w-[150px] truncate block">
                  {getLinkedNames(payment.paymentId)}
                </span>
              </td>
              <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-1">
                  {isPending && (
                    <>
                      <button
                        onClick={() => handleApprove(payment.paymentId)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                        title="אשר תשלום"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDismiss(payment.paymentId)}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                        title="בטל תשלום ממתין"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => openEditModal(payment)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(payment.paymentId)}
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
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">תשלומים</h3>
        <Button size="sm" onClick={openAddModal}>
          <PlusIcon className="w-4 h-4" />
          הוסף תשלום
        </Button>
      </div>

      {/* Pending Payments Section */}
      {pendingPayments.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            <h4 className="text-sm font-medium text-amber-700">
              תשלומים ממתינים ({pendingPayments.length})
            </h4>
          </div>
          <div className="border border-amber-200 rounded-lg overflow-hidden">
            <PaymentTable paymentsList={pendingPayments} isPending={true} />
          </div>
        </div>
      )}

      {/* Approved Payments Section */}
      {approvedPayments.length > 0 ? (
        <div>
          {pendingPayments.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <h4 className="text-sm font-medium text-green-700">
                תשלומים מאושרים ({approvedPayments.length})
              </h4>
            </div>
          )}
          <div className="border rounded-lg overflow-hidden">
            <PaymentTable paymentsList={approvedPayments} isPending={false} />
          </div>
        </div>
      ) : (
        pendingPayments.length === 0 && (
          <p className="text-gray-500 text-center py-8">אין תשלומים</p>
        )
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

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">סטטוס</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={formData.status === 'approved'}
                  onChange={() => setFormData({ ...formData, status: 'approved' })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">מאושר</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={formData.status === 'pending'}
                  onChange={() => setFormData({ ...formData, status: 'pending' })}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm">ממתין</span>
              </label>
            </div>
          </div>

          {/* Link to Products */}
          {products.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                מוצרים מקושרים
              </label>
              <div className="border rounded-lg p-3 max-h-32 overflow-y-auto space-y-2">
                {products.map((product) => (
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
                    <span className="text-sm">{product.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Link to Costs */}
          {costs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                עלויות מקושרות
              </label>
              <div className="border rounded-lg p-3 max-h-32 overflow-y-auto space-y-2">
                {costs.map((cost) => (
                  <label key={cost.costId} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.linkedCostIds.includes(cost.costId)}
                      onChange={() => toggleCost(cost.costId)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{cost.description}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.amount}>
              {editingPayment ? 'עדכן' : 'הוסף'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
