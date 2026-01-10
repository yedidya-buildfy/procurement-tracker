'use client';

import { useState, useEffect } from 'react';
import { Order } from '@/lib/sheets';
import { formatCurrency } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import OrderCard from '@/components/orders/OrderCard';
import NewOrderModal from '@/components/orders/NewOrderModal';
import { useToast } from '@/components/ui/Toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      showToast('שגיאה בטעינת הזמנות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (data: {
    order_name: string;
    usd_rate: number;
    cny_rate: number;
    notes: string;
  }) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to create order');

      showToast('הזמנה נוצרה בהצלחה', 'success');
      loadOrders();
    } catch (error) {
      console.error('Error creating order:', error);
      showToast('שגיאה ביצירת הזמנה', 'error');
      throw error;
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    return (
      !search ||
      order.order_name.toLowerCase().includes(search.toLowerCase()) ||
      order.order_id.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Calculate totals
  const totalOrders = orders.length;
  const totalProducts = orders.reduce((sum, o) => sum + (o.productCount || 0), 0);
  const totalValue = orders.reduce((sum, o) => sum + (o.totalOrderILS || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">מעקב רכש בינלאומי</h1>
            <Button onClick={() => setShowNewOrderModal(true)}>
              <PlusIcon className="w-5 h-5" />
              הזמנה חדשה
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CubeIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">הזמנות</p>
                <p className="text-xl font-bold text-gray-900">{totalOrders}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CubeIcon className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">מוצרים</p>
                <p className="text-xl font-bold text-gray-900">{totalProducts}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BanknotesIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">סה"כ הזמנות</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(totalValue)}
                </p>
              </div>
            </div>
          </Card>

        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש הזמנה..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Orders Grid */}
        {filteredOrders.length === 0 ? (
          <Card className="text-center py-12">
            <CubeIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {orders.length === 0 ? 'אין הזמנות עדיין' : 'לא נמצאו הזמנות'}
            </p>
            {orders.length === 0 && (
              <Button
                className="mt-4"
                onClick={() => setShowNewOrderModal(true)}
              >
                <PlusIcon className="w-5 h-5" />
                צור הזמנה ראשונה
              </Button>
            )}
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredOrders.map((order) => (
              <OrderCard key={order.order_id} order={order} />
            ))}
          </div>
        )}
      </main>

      <NewOrderModal
        isOpen={showNewOrderModal}
        onClose={() => setShowNewOrderModal(false)}
        onSubmit={handleCreateOrder}
      />
    </div>
  );
}
