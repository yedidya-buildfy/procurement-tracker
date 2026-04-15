'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import { exportToCSV, exportToXLSX, ProductCostRow } from '@/lib/exportUtils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/useConfirm';
import {
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  TrashIcon,
  DocumentTextIcon,
  TableCellsIcon,
  PencilIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface Order {
  orderId: string;
  orderName: string;
  createdDate: string;
  usdRate: number;
  cnyRate: number;
  estimatedArrival?: string;
  notes?: string;
}

interface Milestone {
  milestoneId: string;
  orderId: string;
  milestoneTypeId: string;
  targetDate?: string;
  actualDate?: string;
  status?: string;
  notes?: string;
}

interface ProductMilestone {
  milestoneId: string;
  productId: string;
  milestoneTypeId: string;
  targetDate?: string;
  actualDate?: string;
  status?: string;
  notes?: string;
}

interface ProductWithCosts {
  productId: string;
  name: string;
  supplier?: string;
  quantity: number;
  pricePerUnit: number;
  priceTotal: number;
  currency: string;
  priceILS: number;
  additionalCostsILS: number;
  finalCostILS: number;
  finalCostPerUnitILS: number;
}

interface SummaryTabProps {
  order: Order;
  summary: {
    productCount: number;
    totalProductsILS: number;
    totalCostsILS: number;
    totalOrderILS: number;
    totalPaidILS: number;
    balanceILS: number;
    totalCBM: number;
    totalKG: number;
  };
  milestones: Milestone[];
  productMilestones: ProductMilestone[];
  products: ProductWithCosts[];
}

export default function SummaryTab({
  order,
  summary,
  milestones,
  productMilestones,
  products,
}: SummaryTabProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const addOrderMilestoneMutation = useMutation(api.milestones.addOrderMilestone);
  const updateOrderMilestoneMutation = useMutation(api.milestones.updateOrderMilestone);
  const deleteOrderMilestoneMutation = useMutation(api.milestones.deleteOrderMilestone);
  const updateOrderMutation = useMutation(api.orders.updateOrder);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleSaveField = async (field: 'usdRate' | 'cnyRate' | 'estimatedArrival') => {
    try {
      const updateArgs: Record<string, unknown> = { orderId: order.orderId };
      if (field === 'estimatedArrival') {
        updateArgs[field] = editValue;
      } else {
        updateArgs[field] = parseFloat(editValue);
      }
      await updateOrderMutation(updateArgs as any);
      showToast('עודכן בהצלחה', 'success');
      setEditingField(null);
    } catch (error) {
      console.error('Error updating order:', error);
      showToast('שגיאה בעדכון', 'error');
    }
  };

  const [editingMilestoneStatus, setEditingMilestoneStatus] = useState<{ milestoneId: string; status: string } | null>(null);

  const handleSaveMilestoneStatus = async () => {
    if (!editingMilestoneStatus) return;
    try {
      await updateOrderMilestoneMutation({
        milestoneId: editingMilestoneStatus.milestoneId,
        status: editingMilestoneStatus.status,
      });
      showToast('מיילסטון עודכן', 'success');
      setEditingMilestoneStatus(null);
    } catch (error) {
      console.error('Error updating milestone:', error);
      showToast('שגיאה בעדכון מיילסטון', 'error');
    }
  };

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    description: '',
    targetDate: '',
    notes: '',
  });

  const handleAddMilestone = async () => {
    try {
      await addOrderMilestoneMutation({
        orderId: order.orderId,
        milestoneTypeId: 'custom',
        targetDate: newMilestone.targetDate || undefined,
        status: newMilestone.description,
        notes: newMilestone.notes || undefined,
      });

      showToast('מיילסטון נוסף בהצלחה', 'success');
      setShowAddMilestone(false);
      setNewMilestone({ description: '', targetDate: '', notes: '' });
    } catch (error) {
      console.error('Error adding milestone:', error);
      showToast('שגיאה בהוספת מיילסטון', 'error');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!(await confirm('האם למחוק את המיילסטון?'))) return;

    try {
      await deleteOrderMilestoneMutation({ milestoneId });
      showToast('מיילסטון נמחק', 'success');
    } catch (error) {
      console.error('Error deleting milestone:', error);
      showToast('שגיאה במחיקת מיילסטון', 'error');
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, actualDate: string) => {
    try {
      await updateOrderMilestoneMutation({
        milestoneId,
        actualDate,
      });

      showToast('מיילסטון עודכן', 'success');
    } catch (error) {
      console.error('Error updating milestone:', error);
      showToast('שגיאה בעדכון מיילסטון', 'error');
    }
  };

  const prepareExportData = (products: ProductWithCosts[], totalOrderILS: number): ProductCostRow[] => {
    return products.map((product) => {
      const unitPriceILS = product.quantity > 0 ? product.priceILS / product.quantity : 0;
      const percentOfOrder = totalOrderILS > 0
        ? (product.finalCostILS / totalOrderILS) * 100
        : 0;

      const currencySymbols: Record<string, string> = {
        USD: '$',
        CNY: '¥',
        ILS: '₪',
      };
      const symbol = currencySymbols[product.currency] || product.currency;

      return {
        productName: product.name,
        supplier: product.supplier || '',
        quantity: product.quantity,
        unitPrice: `${symbol}${product.pricePerUnit.toFixed(2)}`,
        productCostILS: product.priceILS,
        unitPriceILS,
        additionalCostsILS: product.additionalCostsILS,
        totalCostILS: product.finalCostILS,
        landedUnitCostILS: product.finalCostPerUnitILS,
        percentOfOrder,
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Order Details */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">פרטי הזמנה</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">מזהה</p>
            <p className="font-medium">{order.orderId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">תאריך יצירה</p>
            <p className="font-medium">{formatDate(order.createdDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">שער דולר</p>
            {editingField === 'usdRate' ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveField('usdRate');
                    if (e.key === 'Escape') setEditingField(null);
                  }}
                  className="w-24 border rounded px-2 py-1 text-sm"
                  autoFocus
                />
                <button onClick={() => handleSaveField('usdRate')} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                  <CheckCircleIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingField(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p
                className="font-medium group flex items-center gap-1 cursor-pointer"
                onClick={() => { setEditingField('usdRate'); setEditValue(String(order.usdRate)); }}
              >
                {formatNumber(order.usdRate, 2)}
                <PencilIcon className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">שער יואן</p>
            {editingField === 'cnyRate' ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveField('cnyRate');
                    if (e.key === 'Escape') setEditingField(null);
                  }}
                  className="w-24 border rounded px-2 py-1 text-sm"
                  autoFocus
                />
                <button onClick={() => handleSaveField('cnyRate')} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                  <CheckCircleIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingField(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p
                className="font-medium group flex items-center gap-1 cursor-pointer"
                onClick={() => { setEditingField('cnyRate'); setEditValue(String(order.cnyRate)); }}
              >
                {formatNumber(order.cnyRate, 2)}
                <PencilIcon className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">הגעה משוערת</p>
            {editingField === 'estimatedArrival' ? (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveField('estimatedArrival');
                    if (e.key === 'Escape') setEditingField(null);
                  }}
                  className="w-36 border rounded px-2 py-1 text-sm"
                  autoFocus
                />
                <button onClick={() => handleSaveField('estimatedArrival')} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                  <CheckCircleIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingField(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p
                className="font-medium group flex items-center gap-1 cursor-pointer"
                onClick={() => { setEditingField('estimatedArrival'); setEditValue(order.estimatedArrival || ''); }}
              >
                {order.estimatedArrival ? formatDate(order.estimatedArrival) : '-'}
                <PencilIcon className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">סה"כ CBM</p>
            <p className="font-medium">{formatNumber(summary.totalCBM, 3)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">סה"כ KG</p>
            <p className="font-medium">{formatNumber(summary.totalKG, 1)}</p>
          </div>
          {order.notes && (
            <div className="col-span-2 md:col-span-4">
              <p className="text-sm text-gray-500">הערות</p>
              <p className="font-medium">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">מיילסטונים</h3>
          <Button size="sm" onClick={() => setShowAddMilestone(true)}>
            <PlusIcon className="w-4 h-4" />
            הוסף מיילסטון
          </Button>
        </div>

        {milestones.length === 0 ? (
          <p className="text-gray-500 text-center py-8">אין מיילסטונים</p>
        ) : (
          <div className="py-6 px-4" dir="ltr">
            {/* Timeline with date range */}
            {(() => {
              const sorted = [...milestones].sort((a, b) => {
                const dateA = a.targetDate || a.actualDate || '';
                const dateB = b.targetDate || b.actualDate || '';
                return dateA.localeCompare(dateB);
              });

              // Calculate date range
              const startDate = order.createdDate ? new Date(order.createdDate) : new Date();
              const endDate = order.estimatedArrival
                ? new Date(order.estimatedArrival)
                : sorted.length > 0
                ? new Date(sorted[sorted.length - 1].targetDate || sorted[sorted.length - 1].actualDate || new Date())
                : new Date();

              const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
              const today = new Date().toISOString().split('T')[0];

              const getPosition = (dateStr: string) => {
                if (!dateStr) return 50;
                const date = new Date(dateStr);
                const daysFromStart = (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                return Math.min(100, Math.max(0, (daysFromStart / totalDays) * 100));
              };

              return (
                <div className="relative">
                  {/* Date labels */}
                  <div className="flex justify-between text-xs text-gray-400 mb-2">
                    <span>{formatDate(order.createdDate)}</span>
                    <span>{order.estimatedArrival ? formatDate(order.estimatedArrival) : ''}</span>
                  </div>

                  {/* Background line */}
                  <div className="relative h-32 mt-16">
                    <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 rounded-full" />

                    {/* Progress lines */}
                    {sorted.map((milestone, index) => {
                      const isCompleted = !!milestone.actualDate;
                      const isOverdue = !isCompleted && milestone.targetDate && milestone.targetDate < today;
                      const pos = getPosition(milestone.targetDate || milestone.actualDate || '');
                      const prevPos = index > 0
                        ? getPosition(sorted[index - 1].targetDate || sorted[index - 1].actualDate || '')
                        : 0;

                      return (
                        <div
                          key={`line-${milestone.milestoneId}`}
                          className={`absolute top-6 h-1 transition-all ${
                            isCompleted ? 'bg-green-500' : isOverdue ? 'bg-red-500' : 'bg-gray-200'
                          }`}
                          style={{
                            left: `${prevPos}%`,
                            width: `${pos - prevPos}%`
                          }}
                        />
                      );
                    })}

                    {/* Milestone dots */}
                    {sorted.map((milestone, index) => {
                      const isCompleted = !!milestone.actualDate;
                      const isOverdue = !isCompleted && milestone.targetDate && milestone.targetDate < today;
                      const pos = getPosition(milestone.targetDate || milestone.actualDate || '');

                      const getCircleClasses = () => {
                        if (isCompleted) return 'bg-green-500 border-green-500 text-white';
                        if (isOverdue) return 'bg-red-500 border-red-500 text-white';
                        return 'bg-white border-gray-300 text-gray-400';
                      };

                      return (
                        <div
                          key={milestone.milestoneId}
                          className="absolute group"
                          style={{ left: `${pos}%`, top: 0, transform: 'translateX(-50%)' }}
                        >
                          {/* Circle */}
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getCircleClasses()}`}
                          >
                            {isCompleted ? (
                              <CheckCircleIcon className="w-7 h-7" />
                            ) : isOverdue ? (
                              <ClockIcon className="w-6 h-6" />
                            ) : (
                              <span className="text-base font-bold">{index + 1}</span>
                            )}
                          </div>

                          {/* Label - alternating above/below */}
                          <div
                            className={`absolute left-1/2 -translate-x-1/2 text-center whitespace-nowrap ${
                              index % 2 === 0 ? 'top-14' : '-top-16'
                            }`}
                          >
                            {editingMilestoneStatus?.milestoneId === milestone.milestoneId ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editingMilestoneStatus.status}
                                  onChange={(e) => setEditingMilestoneStatus({ ...editingMilestoneStatus, status: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveMilestoneStatus();
                                    if (e.key === 'Escape') setEditingMilestoneStatus(null);
                                  }}
                                  className="w-32 border rounded px-2 py-0.5 text-sm"
                                  autoFocus
                                />
                                <button onClick={handleSaveMilestoneStatus} className="p-0.5 text-green-600">
                                  <CheckCircleIcon className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingMilestoneStatus(null)} className="p-0.5 text-gray-400">
                                  <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <p
                                className={`font-medium text-sm ${
                                  isCompleted ? 'text-green-700' : isOverdue ? 'text-red-600' : 'text-gray-600'
                                }`}
                              >
                                {milestone.status}
                              </p>
                            )}
                            <p className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                              {milestone.actualDate
                                ? formatDate(milestone.actualDate)
                                : milestone.targetDate
                                ? formatDate(milestone.targetDate)
                                : ''}
                            </p>
                            {isOverdue && (
                              <p className="text-xs text-red-500 font-medium">באיחור</p>
                            )}
                          </div>

                          {/* Actions on hover */}
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white shadow-lg rounded-lg p-1.5 border z-20">
                            {!isCompleted && (
                              <button
                                onClick={() =>
                                  handleUpdateMilestone(
                                    milestone.milestoneId,
                                    new Date().toISOString().split('T')[0]
                                  )
                                }
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                title="סמן כהושלם"
                              >
                                <CheckCircleIcon className="w-5 h-5" />
                              </button>
                            )}
                            <button
                              onClick={() => setEditingMilestoneStatus({ milestoneId: milestone.milestoneId, status: milestone.status || '' })}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="ערוך תיאור"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMilestone(milestone.milestoneId)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              title="מחק"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Product Milestones Timeline */}
      {productMilestones.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">מיילסטונים לפי מוצר</h3>
          <div className="space-y-4">
            {products
              .filter((p) => productMilestones.some((m) => m.productId === p.productId))
              .map((product) => {
                const pMilestones = productMilestones
                  .filter((m) => m.productId === product.productId)
                  .sort((a, b) => {
                    const dateA = a.targetDate || a.actualDate || '';
                    const dateB = b.targetDate || b.actualDate || '';
                    return dateA.localeCompare(dateB);
                  });
                const today = new Date().toISOString().split('T')[0];

                return (
                  <div key={product.productId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{product.name}</h4>
                      {product.supplier && (
                        <span className="text-sm text-gray-500">{product.supplier}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 overflow-x-auto pb-2">
                      {pMilestones.map((milestone, idx) => {
                        const isCompleted = !!milestone.actualDate;
                        const isOverdue = !isCompleted && milestone.targetDate && milestone.targetDate < today;
                        const isAutoMilestone = milestone.milestoneTypeId === 'products_ready';

                        return (
                          <div key={milestone.milestoneId} className="flex items-center gap-3 flex-shrink-0">
                            {idx > 0 && (
                              <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-400' : 'bg-gray-200'}`} />
                            )}
                            <div className="flex flex-col items-center min-w-[80px]">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                  isCompleted
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : isOverdue
                                    ? 'bg-red-500 border-red-500 text-white'
                                    : isAutoMilestone
                                    ? 'bg-amber-50 border-amber-400 text-amber-600'
                                    : 'bg-white border-gray-300 text-gray-400'
                                }`}
                              >
                                {isCompleted ? (
                                  <CheckCircleIcon className="w-5 h-5" />
                                ) : isOverdue ? (
                                  <ClockIcon className="w-4 h-4" />
                                ) : (
                                  <span className="text-xs font-bold">{idx + 1}</span>
                                )}
                              </div>
                              <p className={`text-xs font-medium mt-1 text-center ${
                                isCompleted ? 'text-green-700' : isOverdue ? 'text-red-600' : isAutoMilestone ? 'text-amber-600' : 'text-gray-600'
                              }`}>
                                {milestone.status}
                              </p>
                              <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                                {milestone.actualDate
                                  ? formatDate(milestone.actualDate)
                                  : milestone.targetDate
                                  ? formatDate(milestone.targetDate)
                                  : ''}
                              </p>
                              {isOverdue && (
                                <p className="text-xs text-red-500 font-medium">באיחור</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Product Cost Breakdown Table */}
      {products.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">פירוט עלויות מוצרים</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const exportData = prepareExportData(products, summary.totalOrderILS);
                  exportToCSV(exportData, `${order.orderName}-עלויות`);
                }}
              >
                <DocumentTextIcon className="w-4 h-4" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const exportData = prepareExportData(products, summary.totalOrderILS);
                  exportToXLSX(exportData, `${order.orderName}-עלויות`);
                }}
              >
                <TableCellsIcon className="w-4 h-4" />
                Excel
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-3 text-right font-medium text-gray-600">שם מוצר</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">ספק</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">כמות</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">מחיר/יח</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">עלות מוצר ₪</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">מחיר/יח ₪</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">עלויות נוספות ₪</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">עלות כוללת ₪</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">עלות/יח ₪</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">% מההזמנה</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const unitPriceILS = product.quantity > 0 ? product.priceILS / product.quantity : 0;
                  const percentOfOrder = summary.totalOrderILS > 0
                    ? (product.finalCostILS / summary.totalOrderILS) * 100
                    : 0;

                  return (
                    <tr
                      key={product.productId}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/orders/${order.orderId}/products/${product.productId}?from=summary`)}
                    >
                      <td className="px-3 py-3 font-medium text-gray-900">{product.name}</td>
                      <td className="px-3 py-3 text-gray-600">{product.supplier || '-'}</td>
                      <td className="px-3 py-3 text-gray-900">{formatNumber(product.quantity, 0)}</td>
                      <td className="px-3 py-3 text-gray-600">
                        {formatCurrency(product.pricePerUnit, product.currency)}
                      </td>
                      <td className="px-3 py-3 text-gray-900">{formatNumber(product.priceILS)}</td>
                      <td className="px-3 py-3 text-gray-600">{formatNumber(unitPriceILS)}</td>
                      <td className="px-3 py-3 text-gray-600">{formatNumber(product.additionalCostsILS)}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">{formatNumber(product.finalCostILS)}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">{formatNumber(product.finalCostPerUnitILS)}</td>
                      <td className="px-3 py-3 text-gray-600">{formatNumber(percentOfOrder, 1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-3 py-3 text-gray-900">סה"כ</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-gray-900">
                    {formatNumber(products.reduce((sum, p) => sum + p.quantity, 0), 0)}
                  </td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-gray-900">
                    {formatNumber(products.reduce((sum, p) => sum + p.priceILS, 0))}
                  </td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-gray-900">
                    {formatNumber(products.reduce((sum, p) => sum + p.additionalCostsILS, 0))}
                  </td>
                  <td className="px-3 py-3 text-gray-900">
                    {formatNumber(products.reduce((sum, p) => sum + p.finalCostILS, 0))}
                  </td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-gray-900">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      <Modal
        isOpen={showAddMilestone}
        onClose={() => setShowAddMilestone(false)}
        title="הוסף מיילסטון"
      >
        <div className="space-y-4">
          <Input
            id="description"
            label="תיאור"
            value={newMilestone.description}
            onChange={(e) =>
              setNewMilestone({ ...newMilestone, description: e.target.value })
            }
            placeholder="לדוגמה: יצא מסין"
            required
          />

          <Input
            id="targetDate"
            label="תאריך יעד"
            type="date"
            value={newMilestone.targetDate}
            onChange={(e) =>
              setNewMilestone({ ...newMilestone, targetDate: e.target.value })
            }
          />

          <Input
            id="notes"
            label="הערות"
            value={newMilestone.notes}
            onChange={(e) =>
              setNewMilestone({ ...newMilestone, notes: e.target.value })
            }
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAddMilestone(false)}>
              ביטול
            </Button>
            <Button onClick={handleAddMilestone} disabled={!newMilestone.description}>
              הוסף
            </Button>
          </div>
        </div>
      </Modal>
      {ConfirmDialog}
    </div>
  );
}
