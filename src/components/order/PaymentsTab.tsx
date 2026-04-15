'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/useConfirm';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
  FunnelIcon,
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
  summary: {
    totalOrderILS: number;
    totalPaidILS: number;
    balanceILS: number;
  };
}

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'ILS', label: 'ILS (₪)' },
];

type Currency = 'USD' | 'CNY' | 'ILS';
type StatusFilter = 'all' | 'approved' | 'pending';

const currencySymbol: Record<Currency, string> = {
  USD: '$',
  CNY: '¥',
  ILS: '₪',
};

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
  summary,
}: PaymentsTabProps) {
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const addPaymentMutation = useMutation(api.payments.addPayment);
  const updatePaymentMutation = useMutation(api.payments.updatePayment);
  const updatePaymentLinksMutation = useMutation(api.payments.updatePaymentLinks);
  const deletePaymentMutation = useMutation(api.payments.deletePayment);
  const approvePaymentMutation = useMutation(api.payments.approvePayment);
  const dismissPaymentMutation = useMutation(api.payments.dismissPayment);

  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState(emptyPayment);
  const [showPayeeSuggestions, setShowPayeeSuggestions] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const allSuppliers = useQuery(api.products.getAllSuppliers) ?? [];

  const payeeRecency = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of payments) {
      if (p.payee && p.payee.trim()) {
        const existing = map.get(p.payee);
        if (!existing || p.date > existing) {
          map.set(p.payee, p.date);
        }
      }
    }
    return map;
  }, [payments]);

  const filteredSuppliers = useMemo(() => {
    const list = formData.payee.trim()
      ? allSuppliers.filter((s) =>
          s.toLowerCase().includes(formData.payee.toLowerCase())
        )
      : [...allSuppliers];

    return list.sort((a, b) => {
      const dateA = payeeRecency.get(a);
      const dateB = payeeRecency.get(b);
      if (dateA && dateB) return dateB.localeCompare(dateA);
      if (dateA) return -1;
      if (dateB) return 1;
      return a.localeCompare(b);
    });
  }, [formData.payee, allSuppliers, payeeRecency]);

  // Filtered + sorted payments: newest first, pending always on top
  const displayPayments = useMemo(() => {
    let list = [...payments];
    if (statusFilter !== 'all') {
      list = list.filter((p) => p.status === statusFilter);
    }
    return list.sort((a, b) => {
      // Pending on top
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      // Then by date descending
      return b.date.localeCompare(a.date);
    });
  }, [payments, statusFilter]);

  const pendingCount = payments.filter((p) => p.status === 'pending').length;
  const approvedCount = payments.filter((p) => p.status === 'approved').length;

  const getLinkedProductIds = (paymentId: string) =>
    paymentProductLinks.filter((l) => l.paymentId === paymentId).map((l) => l.productId);

  const getLinkedCostIds = (paymentId: string) =>
    paymentCostLinks.filter((l) => l.paymentId === paymentId).map((l) => l.costId);

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
    return names.length > 0 ? names.join(', ') : '';
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
    if (!(await confirm('האם למחוק את התשלום?'))) return;
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
    if (!(await confirm('האם לבטל את התשלום הממתין?'))) return;
    try {
      await dismissPaymentMutation({ paymentId });
      showToast('תשלום ממתין בוטל', 'success');
    } catch (error) {
      console.error('Error dismissing payment:', error);
      showToast('שגיאה בביטול תשלום', 'error');
    }
  };

  const paidPercent =
    summary.totalOrderILS > 0
      ? Math.min(100, (summary.totalPaidILS / summary.totalOrderILS) * 100)
      : 0;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">תשלומים</h3>
        <Button size="sm" onClick={openAddModal}>
          <PlusIcon className="w-4 h-4" />
          הוסף תשלום
        </Button>
      </div>

      {/* Summary bar */}
      <div className="bg-gray-50 rounded-xl border p-4 mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-gray-500">סה"כ הזמנה</span>
              <span className="font-semibold text-gray-900 mr-1.5">
                {formatCurrency(summary.totalOrderILS)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">שולם</span>
              <span className="font-semibold text-green-600 mr-1.5">
                {formatCurrency(summary.totalPaidILS)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">יתרה</span>
              <span
                className={`font-semibold mr-1.5 ${
                  summary.balanceILS > 0 ? 'text-red-600' : 'text-gray-900'
                }`}
              >
                {formatCurrency(summary.balanceILS)}
              </span>
            </div>
          </div>
          <span className="text-xs text-gray-400">{paidPercent.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${paidPercent}%` }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-3">
        <FunnelIcon className="w-4 h-4 text-gray-400 ml-1" />
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            statusFilter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          הכל ({payments.length})
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            statusFilter === 'approved'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          מאושר ({approvedCount})
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            statusFilter === 'pending'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ממתין ({pendingCount})
        </button>
      </div>

      {/* Payments table */}
      {displayPayments.length === 0 ? (
        <p className="text-gray-500 text-center py-8">אין תשלומים</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 text-xs">סטטוס</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 text-xs">תאריך</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 text-xs">נמען</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 text-xs">תיאור</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 text-xs">סכום</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 text-xs">סכום ₪</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 text-xs">אסמכתא</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 text-xs w-24">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {displayPayments.map((payment) => {
                const isPending = payment.status === 'pending';
                const linked = getLinkedNames(payment.paymentId);
                return (
                  <tr
                    key={payment.paymentId}
                    className={`border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors ${
                      isPending ? 'bg-amber-50/40' : ''
                    }`}
                    onClick={() => openEditModal(payment)}
                  >
                    {/* Status */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                          isPending
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {isPending ? 'ממתין' : 'מאושר'}
                      </span>
                    </td>
                    {/* Date */}
                    <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                      {formatDate(payment.date)}
                    </td>
                    {/* Payee */}
                    <td className="py-2.5 px-3 font-medium text-gray-900">
                      {payment.payee || '-'}
                    </td>
                    {/* Description + linked items */}
                    <td className="py-2.5 px-3 max-w-[200px]">
                      <span className="text-gray-700 truncate block">
                        {payment.description || '-'}
                      </span>
                      {linked && (
                        <span className="text-[11px] text-gray-400 truncate block">
                          {linked}
                        </span>
                      )}
                    </td>
                    {/* Amount in original currency */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-gray-700">
                      {currencySymbol[payment.currency]}
                      {payment.amount.toLocaleString()}
                    </td>
                    {/* Amount ILS */}
                    <td className="py-2.5 px-3 font-semibold text-green-600 whitespace-nowrap">
                      {formatCurrency(payment.amountILS || 0)}
                    </td>
                    {/* Reference */}
                    <td className="py-2.5 px-3 text-gray-400 text-xs">
                      {payment.reference || '-'}
                    </td>
                    {/* Actions */}
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleApprove(payment.paymentId)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="אשר"
                            >
                              <CheckCircleIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDismiss(payment.paymentId)}
                              className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                              title="בטל"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openEditModal(payment)}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                          title="ערוך"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(payment.paymentId)}
                          className="p-1 text-red-400 hover:bg-red-50 rounded"
                          title="מחק"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
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
            <div className="relative">
              <Input
                id="payee"
                label="נמען"
                value={formData.payee}
                onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                onFocus={() => setShowPayeeSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPayeeSuggestions(false), 150)}
                placeholder="למי שולם?"
                autoComplete="off"
              />
              {showPayeeSuggestions && filteredSuppliers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredSuppliers.map((supplier) => (
                    <button
                      key={supplier}
                      type="button"
                      className="w-full px-3 py-2 text-right text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFormData({ ...formData, payee: supplier });
                        setShowPayeeSuggestions(false);
                      }}
                    >
                      {supplier}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                setFormData({ ...formData, currency: e.target.value as Currency })
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
      {ConfirmDialog}
    </div>
  );
}
