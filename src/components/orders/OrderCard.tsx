'use client';

import Link from 'next/link';
import { Order } from '@/lib/sheets';
import { formatCurrency, formatDate } from '@/lib/utils';
import Card from '@/components/ui/Card';
import {
  CubeIcon,
  BanknotesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface OrderCardProps {
  order: Order;
}

export default function OrderCard({ order }: OrderCardProps) {
  const balance = order.balanceILS || 0;
  const isFullyPaid = balance <= 0;

  return (
    <Link href={`/orders/${order.order_id}`}>
      <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer">
        <div className="flex items-center gap-6">
          {/* Order Name & ID */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {order.order_name}
            </h3>
            <p className="text-sm text-gray-500">{order.order_id}</p>
          </div>

          {/* Products */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CubeIcon className="w-4 h-4 text-gray-400" />
            <span>{order.productCount || 0} מוצרים</span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ClockIcon className="w-4 h-4 text-gray-400" />
            <span>{formatDate(order.created_date)}</span>
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
        </div>
      </Card>
    </Link>
  );
}
