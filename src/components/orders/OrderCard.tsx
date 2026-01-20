'use client';

import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import Card from '@/components/ui/Card';
import {
  CubeIcon,
  BanknotesIcon,
  ClockIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface OrderCardProps {
  order: {
    orderId: string;
    orderName: string;
    createdDate: string;
    productCount?: number;
    totalOrderILS?: number;
    totalPaidILS?: number;
    balanceILS?: number;
  };
  onDelete?: (orderId: string) => void;
}

export default function OrderCard({ order, onDelete }: OrderCardProps) {
  const balance = order.balanceILS || 0;
  const isFullyPaid = balance <= 0;

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(order.orderId);
    }
  };

  return (
    <Link href={`/orders/${order.orderId}`}>
      <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer">
        <div className="flex items-center gap-6">
          {/* Order Name & ID */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {order.orderName}
            </h3>
            <p className="text-sm text-gray-500">{order.orderId}</p>
          </div>

          {/* Products */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CubeIcon className="w-4 h-4 text-gray-400" />
            <span>{order.productCount || 0} מוצרים</span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ClockIcon className="w-4 h-4 text-gray-400" />
            <span>{formatDate(order.createdDate)}</span>
          </div>

          {/* Total */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <BanknotesIcon className="w-4 h-4 text-gray-400" />
            <span>{formatCurrency(order.totalOrderILS || 0)}</span>
          </div>

          {/* Paid */}
          <div className="text-sm">
            <span className="text-gray-500">שולם: </span>
            <span className="font-medium text-gray-700">
              {formatCurrency(order.totalPaidILS || 0)}
            </span>
          </div>

          {/* Balance */}
          <div className="text-sm">
            <span className="text-gray-500">יתרה: </span>
            <span
              className={`font-semibold ${
                isFullyPaid ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(balance)}
            </span>
          </div>

          {/* Delete Button */}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="מחק הזמנה"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </Card>
    </Link>
  );
}
