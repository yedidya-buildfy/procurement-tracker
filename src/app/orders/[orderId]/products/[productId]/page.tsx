'use client';

import { useState, use, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../../convex/_generated/api';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/useConfirm';
import {
  ArrowRightIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  PaperClipIcon,
  PhotoIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  LinkIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

export default function ProductPage({
  params,
}: {
  params: Promise<{ orderId: string; productId: string }>;
}) {
  const { orderId, productId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromTab = searchParams.get('from') || 'products';
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const data = useQuery(api.orders.getOrderFull, { orderId });
  const productFiles = useQuery(api.products.getProductFiles, { productId });
  const allRegisteredSuppliers = useQuery(api.suppliers.getAllSuppliers) ?? [];
  const deleteProductMutation = useMutation(api.products.deleteProduct);
  const generateUploadUrl = useMutation(api.kits.generateUploadUrl);
  const addProductFileMutation = useMutation(api.products.addProductFile);
  const deleteProductFileMutation = useMutation(api.products.deleteProductFile);
  const addMilestoneMutation = useMutation(api.milestones.addProductMilestone);
  const updateMilestoneMutation = useMutation(api.milestones.updateProductMilestone);
  const deleteMilestoneMutation = useMutation(api.milestones.deleteProductMilestone);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ description: '', targetDate: '', notes: '' });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files);
    }
  }, []);

  const uploadFiles = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        const { storageId } = await response.json();
        await addProductFileMutation({
          productId,
          storageId,
          fileName: file.name,
          fileType: file.type,
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        showToast('שגיאה בהעלאת קובץ', 'error');
      }
    }
    showToast('קבצים הועלו בהצלחה', 'success');
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!(await confirm('האם למחוק את הקובץ?'))) return;
    try {
      await deleteProductFileMutation({ id: fileId as any });
      showToast('קובץ נמחק', 'success');
    } catch (error) {
      console.error('Error deleting file:', error);
      showToast('שגיאה במחיקת קובץ', 'error');
    }
  };

  const handleDeleteProduct = async () => {
    if (!(await confirm('האם אתה בטוח שברצונך למחוק את המוצר?'))) return;
    try {
      await deleteProductMutation({ productId });
      showToast('מוצר נמחק בהצלחה', 'success');
      router.push(`/orders/${orderId}?tab=${fromTab}`);
    } catch (error) {
      console.error('Error deleting product:', error);
      showToast('שגיאה במחיקת מוצר', 'error');
    }
  };

  const handleAddMilestone = async () => {
    try {
      await addMilestoneMutation({
        productId,
        milestoneTypeId: 'custom',
        targetDate: newMilestone.targetDate || undefined,
        status: newMilestone.description,
        notes: newMilestone.notes || undefined,
      });
      showToast('מיילסטון נוסף בהצלחה', 'success');
      setShowMilestoneModal(false);
      setNewMilestone({ description: '', targetDate: '', notes: '' });
    } catch (error) {
      console.error('Error adding milestone:', error);
      showToast('שגיאה בהוספת מיילסטון', 'error');
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, actualDate: string) => {
    try {
      await updateMilestoneMutation({ milestoneId, actualDate });
      showToast('מיילסטון עודכן', 'success');
    } catch (error) {
      console.error('Error updating milestone:', error);
      showToast('שגיאה בעדכון מיילסטון', 'error');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!(await confirm('האם למחוק את המיילסטון?'))) return;
    try {
      await deleteMilestoneMutation({ milestoneId });
      showToast('מיילסטון נמחק', 'success');
    } catch (error) {
      console.error('Error deleting milestone:', error);
      showToast('שגיאה במחיקת מיילסטון', 'error');
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

  const product = data.products.find((p) => p.productId === productId);
  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">מוצר לא נמצא</p>
      </div>
    );
  }

  const milestones = data.productMilestones.filter((m) => m.productId === productId);
  const files = productFiles ?? [];
  const supplierRecord = product.supplier
    ? allRegisteredSuppliers.find((s) => s.name === product.supplier)
    : undefined;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/orders/${orderId}?tab=${fromTab}`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowRightIcon className="w-5 h-5 text-gray-600" />
            </Link>

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              <p className="text-sm text-gray-500">
                {data.order.orderName} &middot; {product.productId}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteProduct}
                className="text-red-600 hover:bg-red-50"
              >
                <TrashIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <CubeIcon className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">כמות</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(product.quantity)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">סה"כ מחיר</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatNumber(product.priceTotal)} {product.currency}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BanknotesIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">עלות סופית</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(product.finalCostILS || 0)}
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
                <p className="text-xs text-gray-500">עלות ליחידה</p>
                <p className="text-lg font-bold text-purple-600">
                  {formatCurrency(product.finalCostPerUnitILS || 0)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Source Link */}
        {product.sourceKitId && (
          <Link
            href={`/kits/${product.sourceKitId}`}
            className="block bg-indigo-50 border border-indigo-200 rounded-xl p-4 hover:bg-indigo-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <LinkIcon className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-900">מקושר מרכישה סופית</p>
                <p className="text-xs text-indigo-600">לחץ לצפייה בערכה המקורית</p>
              </div>
              <ArrowRightIcon className="w-4 h-4 text-indigo-400 mr-auto rotate-180" />
            </div>
          </Link>
        )}

        {/* Product Details + Cost Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Details */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b">פרטי מוצר</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ספק</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{product.supplier || '-'}</span>
                  {supplierRecord?.alibabaChatUrl && (
                    <a
                      href={supplierRecord.alibabaChatUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-0.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                      title="צ'אט עם הספק באליבאבא"
                    >
                      <ChatBubbleLeftRightIcon className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">מטבע</span>
                <span className="font-medium">{product.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">מחיר ליחידה</span>
                <span className="font-medium">{formatNumber(product.pricePerUnit)} {product.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">תאריך הזמנה</span>
                <span className="font-medium">{product.orderDate ? formatDate(product.orderDate) : '-'}</span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="text-gray-500">CBM ליחידה</span>
                <span className="font-medium">{formatNumber(product.cbmPerUnit, 3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">CBM סה"כ</span>
                <span className="font-medium">{formatNumber(product.cbmTotal, 3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">KG ליחידה</span>
                <span className="font-medium">{formatNumber(product.kgPerUnit, 1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">KG סה"כ</span>
                <span className="font-medium">{formatNumber(product.kgTotal, 1)}</span>
              </div>
              {product.notes && (
                <>
                  <hr />
                  <div>
                    <span className="text-gray-500 block mb-1">הערות</span>
                    <span className="font-medium">{product.notes}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b">פירוט עלויות</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">עלות מקורית (₪)</span>
                <span className="font-medium">{formatCurrency(product.priceILS || 0)}</span>
              </div>
              <div className="flex justify-between text-orange-600">
                <span>עלויות נוספות</span>
                <span className="font-medium">+ {formatCurrency(product.additionalCostsILS || 0)}</span>
              </div>
              <hr />
              <div className="flex justify-between text-lg font-semibold">
                <span className="text-gray-800">עלות סופית</span>
                <span className="text-blue-600">{formatCurrency(product.finalCostILS || 0)}</span>
              </div>
              <div className="flex justify-between text-blue-600 font-medium">
                <span>עלות סופית ליחידה</span>
                <span>{formatCurrency(product.finalCostPerUnitILS || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Files & Photos */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">קבצים ותמונות</h3>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-4 ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  uploadFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <PaperClipIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              {isDragging ? 'שחרר כאן להעלאה' : 'גרור קבצים לכאן או לחץ לבחירה'}
            </p>
          </div>

          {/* Files Grid */}
          {files.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {files.map((file) => {
                const isImage = file.fileType.startsWith('image/');
                return (
                  <div
                    key={file._id}
                    className="relative group border rounded-lg overflow-hidden bg-gray-50"
                  >
                    {isImage && file.url ? (
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={file.url}
                          alt={file.fileName}
                          className="w-full h-32 object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        href={file.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center h-32 p-3 hover:bg-gray-100 transition-colors"
                      >
                        <ArrowDownTrayIcon className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-xs text-gray-600 text-center truncate w-full">
                          {file.fileName}
                        </span>
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteFile(file._id)}
                      className="absolute top-1.5 left-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="מחק קובץ"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                    <div className="px-2 py-1.5 text-xs text-gray-500 truncate border-t bg-white">
                      {file.fileName}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">אין קבצים</p>
          )}
        </div>

        {/* Milestones */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">מיילסטונים</h3>
            <Button size="sm" onClick={() => setShowMilestoneModal(true)}>
              <PlusIcon className="w-4 h-4" />
              הוסף מיילסטון
            </Button>
          </div>

          {milestones.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              אין מיילסטונים - הוסף מיילסטון ראשון למעקב התקדמות
            </p>
          ) : (
            <div className="py-4" dir="ltr">
              <div className="relative">
                {/* Background line */}
                <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200" />

                {/* Progress line */}
                {(() => {
                  const sorted = [...milestones].sort((a, b) => {
                    const dateA = a.targetDate || a.actualDate || '';
                    const dateB = b.targetDate || b.actualDate || '';
                    return dateA.localeCompare(dateB);
                  });
                  const today = new Date().toISOString().split('T')[0];
                  let lastCompletedIndex = -1;
                  let lastOverdueIndex = -1;
                  sorted.forEach((m, i) => {
                    if (m.actualDate) lastCompletedIndex = i;
                    else if (m.targetDate && m.targetDate < today) lastOverdueIndex = i;
                  });

                  return (
                    <>
                      {lastCompletedIndex >= 0 && (
                        <div
                          className="absolute top-5 left-0 h-1 bg-green-500 transition-all"
                          style={{ width: `${((lastCompletedIndex + 0.5) / sorted.length) * 100}%` }}
                        />
                      )}
                      {lastOverdueIndex > lastCompletedIndex && (
                        <div
                          className="absolute top-5 h-1 bg-red-500 transition-all"
                          style={{
                            left: `${((lastCompletedIndex + 0.5) / sorted.length) * 100}%`,
                            width: `${((lastOverdueIndex - lastCompletedIndex) / sorted.length) * 100}%`,
                          }}
                        />
                      )}
                    </>
                  );
                })()}

                {/* Milestone nodes */}
                <div className="relative flex justify-between">
                  {[...milestones]
                    .sort((a, b) => {
                      const dateA = a.targetDate || a.actualDate || '';
                      const dateB = b.targetDate || b.actualDate || '';
                      return dateA.localeCompare(dateB);
                    })
                    .map((milestone, index, arr) => {
                      const isCompleted = !!milestone.actualDate;
                      const today = new Date().toISOString().split('T')[0];
                      const isOverdue =
                        !isCompleted && milestone.targetDate && milestone.targetDate < today;

                      const getCircleClasses = () => {
                        if (isCompleted) return 'bg-green-500 border-green-500 text-white';
                        if (isOverdue) return 'bg-red-500 border-red-500 text-white';
                        return 'bg-white border-gray-300 text-gray-400';
                      };

                      return (
                        <div
                          key={milestone.milestoneId}
                          className="flex flex-col items-center group relative"
                          style={{ width: `${100 / arr.length}%` }}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-4 transition-all z-10 ${getCircleClasses()}`}
                          >
                            {isCompleted ? (
                              <CheckCircleIcon className="w-6 h-6" />
                            ) : isOverdue ? (
                              <ClockIcon className="w-5 h-5" />
                            ) : (
                              <span className="text-sm font-bold">{index + 1}</span>
                            )}
                          </div>

                          <div className="text-center mt-2">
                            <p
                              className={`text-sm font-medium ${
                                isCompleted
                                  ? 'text-green-700'
                                  : isOverdue
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}
                            >
                              {milestone.status}
                            </p>
                            <p
                              className={`text-xs mt-0.5 ${
                                isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'
                              }`}
                            >
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
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white shadow-lg rounded-lg p-1 border z-20">
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
                                <CheckCircleIcon className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteMilestone(milestone.milestoneId)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              title="מחק"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Milestone Modal */}
      <Modal
        isOpen={showMilestoneModal}
        onClose={() => setShowMilestoneModal(false)}
        title="הוסף מיילסטון למוצר"
      >
        <div className="space-y-4">
          <Input
            id="milestone_description"
            label="תיאור"
            value={newMilestone.description}
            onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
            placeholder="לדוגמה: יצא מסין, הגיע לנמל"
            required
          />
          <Input
            id="milestone_target_date"
            label="תאריך יעד"
            type="date"
            value={newMilestone.targetDate}
            onChange={(e) => setNewMilestone({ ...newMilestone, targetDate: e.target.value })}
          />
          <Input
            id="milestone_notes"
            label="הערות"
            value={newMilestone.notes}
            onChange={(e) => setNewMilestone({ ...newMilestone, notes: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowMilestoneModal(false)}>
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
