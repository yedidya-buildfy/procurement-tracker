'use client';

import { useState } from 'react';
import { Order, Milestone } from '@/lib/sheets';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

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
  onRefresh: () => void;
}

export default function SummaryTab({
  order,
  summary,
  milestones,
  onRefresh,
}: SummaryTabProps) {
  const { showToast } = useToast();
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    description: '',
    target_date: '',
    actual_date: '',
    notes: '',
  });

  const handleAddMilestone = async () => {
    try {
      const response = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.order_id,
          ...newMilestone,
        }),
      });

      if (!response.ok) throw new Error('Failed to add milestone');

      showToast('מיילסטון נוסף בהצלחה', 'success');
      setShowAddMilestone(false);
      setNewMilestone({ description: '', target_date: '', actual_date: '', notes: '' });
      onRefresh();
    } catch (error) {
      console.error('Error adding milestone:', error);
      showToast('שגיאה בהוספת מיילסטון', 'error');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('האם למחוק את המיילסטון?')) return;

    try {
      const response = await fetch(`/api/milestones/${milestoneId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete milestone');

      showToast('מיילסטון נמחק', 'success');
      onRefresh();
    } catch (error) {
      console.error('Error deleting milestone:', error);
      showToast('שגיאה במחיקת מיילסטון', 'error');
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, actualDate: string) => {
    try {
      const response = await fetch(`/api/milestones/${milestoneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_date: actualDate }),
      });

      if (!response.ok) throw new Error('Failed to update milestone');

      showToast('מיילסטון עודכן', 'success');
      onRefresh();
    } catch (error) {
      console.error('Error updating milestone:', error);
      showToast('שגיאה בעדכון מיילסטון', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Order Details */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">פרטי הזמנה</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">מזהה</p>
            <p className="font-medium">{order.order_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">תאריך יצירה</p>
            <p className="font-medium">{formatDate(order.created_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">שער דולר</p>
            <p className="font-medium">{formatNumber(order.usd_rate, 2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">שער יואן</p>
            <p className="font-medium">{formatNumber(order.cny_rate, 2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">הגעה משוערת</p>
            <p className="font-medium">{order.estimated_arrival ? formatDate(order.estimated_arrival) : '-'}</p>
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
                const dateA = a.target_date || a.actual_date || '';
                const dateB = b.target_date || b.actual_date || '';
                return dateA.localeCompare(dateB);
              });

              // Calculate date range
              const startDate = order.created_date ? new Date(order.created_date) : new Date();
              const endDate = order.estimated_arrival
                ? new Date(order.estimated_arrival)
                : sorted.length > 0
                ? new Date(sorted[sorted.length - 1].target_date || sorted[sorted.length - 1].actual_date || new Date())
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
                    <span>{formatDate(order.created_date)}</span>
                    <span>{order.estimated_arrival ? formatDate(order.estimated_arrival) : ''}</span>
                  </div>

                  {/* Background line */}
                  <div className="relative h-32 mt-16">
                    <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 rounded-full" />

                    {/* Progress lines */}
                    {sorted.map((milestone, index) => {
                      const isCompleted = !!milestone.actual_date;
                      const isOverdue = !isCompleted && milestone.target_date && milestone.target_date < today;
                      const pos = getPosition(milestone.target_date || milestone.actual_date);
                      const prevPos = index > 0
                        ? getPosition(sorted[index - 1].target_date || sorted[index - 1].actual_date)
                        : 0;
                      const prevCompleted = index > 0 && !!sorted[index - 1].actual_date;

                      return (
                        <div
                          key={`line-${milestone.id}`}
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
                      const isCompleted = !!milestone.actual_date;
                      const isOverdue = !isCompleted && milestone.target_date && milestone.target_date < today;
                      const pos = getPosition(milestone.target_date || milestone.actual_date);

                      const getCircleClasses = () => {
                        if (isCompleted) return 'bg-green-500 border-green-500 text-white';
                        if (isOverdue) return 'bg-red-500 border-red-500 text-white';
                        return 'bg-white border-gray-300 text-gray-400';
                      };

                      return (
                        <div
                          key={milestone.id}
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
                            <p
                              className={`font-medium text-sm ${
                                isCompleted ? 'text-green-700' : isOverdue ? 'text-red-600' : 'text-gray-600'
                              }`}
                            >
                              {milestone.description}
                            </p>
                            <p className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                              {milestone.actual_date
                                ? formatDate(milestone.actual_date)
                                : milestone.target_date
                                ? formatDate(milestone.target_date)
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
                                    milestone.id,
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
                              onClick={() => handleDeleteMilestone(milestone.id)}
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
            id="target_date"
            label="תאריך יעד"
            type="date"
            value={newMilestone.target_date}
            onChange={(e) =>
              setNewMilestone({ ...newMilestone, target_date: e.target.value })
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
    </div>
  );
}
