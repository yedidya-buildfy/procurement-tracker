'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { formatCurrency } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import ProductsTab from '@/components/order/ProductsTab';
import CostsTab from '@/components/order/CostsTab';
import PaymentsTab from '@/components/order/PaymentsTab';
import SummaryTab from '@/components/order/SummaryTab';
import {
  ArrowRightIcon,
  PencilIcon,
  TrashIcon,
  CubeIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

type TabId = 'summary' | 'products' | 'costs' | 'payments';

export default function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const data = useQuery(api.orders.getOrderFull, { orderId });
  const updateOrderMutation = useMutation(api.orders.updateOrder);
  const deleteOrderMutation = useMutation(api.orders.deleteOrder);

  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [isEditing, setIsEditing] = useState(false);
  const [editedOrder, setEditedOrder] = useState<{
    orderName?: string;
    status?: string;
    notes?: string;
  }>({});

  // Initialize editedOrder when data loads
  if (data && Object.keys(editedOrder).length === 0) {
    setEditedOrder({
      orderName: data.order.orderName,
      status: data.order.status,
      notes: data.order.notes || '',
    });
  }

  const handleUpdateOrder = async () => {
    try {
      await updateOrderMutation({
        orderId,
        orderName: editedOrder.orderName,
        status: editedOrder.status,
        notes: editedOrder.notes,
      });

      showToast('הזמנה עודכנה בהצלחה', 'success');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating order:', error);
      showToast('שגיאה בעדכון הזמנה', 'error');
    }
  };

  const handleDeleteOrder = async () => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את ההזמנה?')) return;

    try {
      await deleteOrderMutation({ orderId });
      showToast('הזמנה נמחקה בהצלחה', 'success');
      router.push('/');
    } catch (error) {
      console.error('Error deleting order:', error);
      showToast('שגיאה במחיקת הזמנה', 'error');
    }
  };

  if (data === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">הזמנה לא נמצאה</p>
      </div>
    );
  }

  const { order, summary } = data;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'summary', label: 'סיכום' },
    { id: 'products', label: `מוצרים (${summary.productCount})` },
    { id: 'costs', label: `עלויות (${data.costs.length})` },
    { id: 'payments', label: `תשלומים (${data.payments.length})` },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowRightIcon className="w-5 h-5 text-gray-600" />
            </Link>

            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editedOrder.orderName || ''}
                  onChange={(e) =>
                    setEditedOrder({ ...editedOrder, orderName: e.target.value })
                  }
                  className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">
                  {order.orderName}
                </h1>
              )}
              <p className="text-sm text-gray-500">{order.orderId}</p>
            </div>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => setIsEditing(false)}>
                    ביטול
                  </Button>
                  <Button onClick={handleUpdateOrder}>שמור</Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <PencilIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteOrder}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CubeIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">עלות מוצרים</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(summary.totalProductsILS)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BanknotesIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">עלויות נוספות</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(summary.totalCostsILS)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CurrencyDollarIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">סה"כ הזמנה</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(summary.totalOrderILS)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="border-b">
            <nav className="flex gap-1 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'summary' && (
              <SummaryTab
                order={order}
                summary={summary}
                milestones={data.orderMilestones}
              />
            )}
            {activeTab === 'products' && (
              <ProductsTab
                orderId={orderId}
                products={data.products}
                productMilestones={data.productMilestones}
              />
            )}
            {activeTab === 'costs' && (
              <CostsTab
                orderId={orderId}
                costs={data.costs}
                products={data.products}
              />
            )}
            {activeTab === 'payments' && (
              <PaymentsTab
                orderId={orderId}
                payments={data.payments}
                products={data.products}
                costs={data.costs}
                paymentProductLinks={data.paymentProductLinks}
                paymentCostLinks={data.paymentCostLinks}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
