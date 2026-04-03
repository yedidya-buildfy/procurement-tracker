'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/useConfirm';
import {
  TrashIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  StarIcon as StarOutline,
  TruckIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { Doc, Id } from '../../../convex/_generated/dataModel';

interface SampleImage {
  _id: string;
  url: string | null;
  caption?: string;
}

interface SampleCardProps {
  sample: Doc<'samples'>;
  milestones: Doc<'sampleMilestones'>[];
  trackingNumbers: Doc<'sampleTrackingNumbers'>[];
  images: SampleImage[];
  supplierName: string;
}

export default function SampleCard({
  sample,
  milestones,
  trackingNumbers,
  images,
  supplierName,
}: SampleCardProps) {
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const updateSampleMutation = useMutation(api.kits.updateSample);
  const deleteSampleMutation = useMutation(api.kits.deleteSample);
  const addMilestoneMutation = useMutation(api.kits.addSampleMilestone);
  const updateMilestoneMutation = useMutation(api.kits.updateSampleMilestone);
  const deleteMilestoneMutation = useMutation(api.kits.deleteSampleMilestone);
  const addTrackingMutation = useMutation(api.kits.addTrackingNumber);
  const deleteTrackingMutation = useMutation(api.kits.deleteTrackingNumber);
  const generateUploadUrlMutation = useMutation(api.kits.generateUploadUrl);
  const addImageMutation = useMutation(api.kits.addSampleImage);
  const deleteImageMutation = useMutation(api.kits.deleteSampleImage);

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ name: '', targetDate: '' });
  const [showAddTracking, setShowAddTracking] = useState(false);
  const [newTracking, setNewTracking] = useState({ leg: '', trackingNumber: '', carrier: '' });
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(sample.rating || 0);
  const [ratingNotes, setRatingNotes] = useState(sample.ratingNotes || '');
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const sortedMilestones = [...milestones].sort((a, b) => {
    const dateA = a.targetDate || a.actualDate || '';
    const dateB = b.targetDate || b.actualDate || '';
    return dateA.localeCompare(dateB);
  });

  const handleToggleRelevant = async () => {
    try {
      await updateSampleMutation({
        sampleId: sample.sampleId,
        isRelevant: sample.isRelevant === true ? false : true,
      });
    } catch (error) {
      console.error('Error updating sample:', error);
      showToast('שגיאה בעדכון דוגמית', 'error');
    }
  };

  const handleDeleteSample = async () => {
    if (!(await confirm('האם למחוק את הדוגמית?'))) return;
    try {
      await deleteSampleMutation({ sampleId: sample.sampleId });
      showToast('דוגמית נמחקה', 'success');
    } catch (error) {
      console.error('Error deleting sample:', error);
      showToast('שגיאה במחיקת דוגמית', 'error');
    }
  };

  const handleAddMilestone = async () => {
    if (!newMilestone.name.trim()) return;
    try {
      await addMilestoneMutation({
        sampleId: sample.sampleId,
        name: newMilestone.name,
        targetDate: newMilestone.targetDate || undefined,
      });
      showToast('מיילסטון נוסף', 'success');
      setShowAddMilestone(false);
      setNewMilestone({ name: '', targetDate: '' });
    } catch (error) {
      console.error('Error adding milestone:', error);
      showToast('שגיאה בהוספת מיילסטון', 'error');
    }
  };

  const handleCompleteMilestone = async (milestoneId: string) => {
    try {
      await updateMilestoneMutation({ milestoneId, actualDate: today });
      showToast('מיילסטון הושלם', 'success');
    } catch (error) {
      console.error('Error updating milestone:', error);
      showToast('שגיאה בעדכון מיילסטון', 'error');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    try {
      await deleteMilestoneMutation({ milestoneId });
      showToast('מיילסטון נמחק', 'success');
    } catch (error) {
      console.error('Error deleting milestone:', error);
      showToast('שגיאה במחיקת מיילסטון', 'error');
    }
  };

  const handleAddTracking = async () => {
    if (!newTracking.leg.trim() || !newTracking.trackingNumber.trim()) return;
    try {
      await addTrackingMutation({
        sampleId: sample.sampleId,
        leg: newTracking.leg,
        trackingNumber: newTracking.trackingNumber,
        carrier: newTracking.carrier || undefined,
      });
      showToast('מספר מעקב נוסף', 'success');
      setShowAddTracking(false);
      setNewTracking({ leg: '', trackingNumber: '', carrier: '' });
    } catch (error) {
      console.error('Error adding tracking:', error);
      showToast('שגיאה בהוספת מספר מעקב', 'error');
    }
  };

  const handleDeleteTracking = async (id: Id<'sampleTrackingNumbers'>) => {
    try {
      await deleteTrackingMutation({ id });
      showToast('מספר מעקב נמחק', 'success');
    } catch (error) {
      console.error('Error deleting tracking:', error);
      showToast('שגיאה במחיקת מספר מעקב', 'error');
    }
  };

  const handleSaveRating = async () => {
    try {
      await updateSampleMutation({
        sampleId: sample.sampleId,
        rating,
        ratingNotes,
      });
      showToast('דירוג נשמר', 'success');
      setShowRating(false);
    } catch (error) {
      console.error('Error saving rating:', error);
      showToast('שגיאה בשמירת דירוג', 'error');
    }
  };

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadUrl = await generateUploadUrlMutation();
        const result = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        const { storageId } = await result.json();
        await addImageMutation({
          sampleId: sample.sampleId,
          storageId,
        });
      }
      showToast(`${files.length} תמונות הועלו`, 'success');
    } catch (error) {
      console.error('Error uploading images:', error);
      showToast('שגיאה בהעלאת תמונות', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await deleteImageMutation({ id: imageId as Id<'sampleImages'> });
      showToast('תמונה נמחקה', 'success');
    } catch (error) {
      console.error('Error deleting image:', error);
      showToast('שגיאה במחיקת תמונה', 'error');
    }
  };

  const relevanceClass =
    sample.isRelevant === true
      ? 'border-green-200 bg-green-50/30'
      : sample.isRelevant === false
      ? 'border-red-200 bg-red-50/30'
      : 'border-gray-200';

  return (
    <div className={`border rounded-lg p-4 ${relevanceClass}`}>
      {/* Sample Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{supplierName}</span>
            {sample.sampleCost !== undefined && sample.sampleCost !== null && (
              <span className="text-sm text-gray-500">${sample.sampleCost}</span>
            )}
            {sample.paid && (
              <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">שולם</span>
            )}
            {!sample.paid && (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">לא שולם</span>
            )}
            {sample.shippingMethod && (
              <span className="text-xs text-gray-400">{sample.shippingMethod}</span>
            )}
          </div>
          {sample.notes && (
            <p className="text-sm text-gray-500 mt-0.5">{sample.notes}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(sample.createdDate)}</p>
        </div>

        {/* Rating display */}
        <button
          onClick={() => {
            setRating(sample.rating || 0);
            setRatingNotes(sample.ratingNotes || '');
            setShowRating(true);
          }}
          className="flex items-center gap-0.5 p-1.5 hover:bg-gray-100 rounded transition-colors"
          title="דירוג"
        >
          {[1, 2, 3, 4, 5].map((star) =>
            star <= (sample.rating || 0) ? (
              <StarSolid key={star} className="w-4 h-4 text-yellow-400" />
            ) : (
              <StarOutline key={star} className="w-4 h-4 text-gray-300" />
            )
          )}
        </button>

        {/* Relevance toggle */}
        <button
          onClick={handleToggleRelevant}
          className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
            sample.isRelevant === true
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : sample.isRelevant === false
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {sample.isRelevant === true
            ? 'רלוונטי'
            : sample.isRelevant === false
            ? 'לא רלוונטי'
            : 'לא דורג'}
        </button>

        <button
          onClick={handleDeleteSample}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Rating notes */}
      {sample.ratingNotes && (
        <p className="text-sm text-gray-600 mb-3 bg-yellow-50 px-3 py-1.5 rounded">
          {sample.ratingNotes}
        </p>
      )}

      {/* Images */}
      {(images.length > 0 || true) && (
        <div className="mb-3">
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {images.map((img) =>
                img.url ? (
                  <div key={img._id} className="relative group">
                    <img
                      src={img.url}
                      alt={img.caption || 'תמונת דוגמית'}
                      className="w-20 h-20 object-cover rounded-lg cursor-pointer border border-gray-200 hover:border-blue-300 transition-colors"
                      onClick={() => setLightboxImage(img.url)}
                    />
                    <button
                      onClick={() => handleDeleteImage(img._id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ) : null
              )}
            </div>
          )}
          <label className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded cursor-pointer transition-colors">
            <PhotoIcon className="w-3.5 h-3.5" />
            {isUploading ? 'מעלה...' : 'הוסף תמונות'}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUploadImages}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Tracking Numbers */}
      {trackingNumbers.length > 0 && (
        <div className="mb-3 space-y-1">
          {trackingNumbers.map((t) => (
            <div
              key={t._id}
              className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-1.5 rounded"
            >
              <TruckIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">{t.leg}:</span>
              <span className="font-mono text-gray-700">{t.trackingNumber}</span>
              {t.carrier && <span className="text-gray-400">({t.carrier})</span>}
              <button
                onClick={() => handleDeleteTracking(t._id)}
                className="p-0.5 text-gray-300 hover:text-red-500 mr-auto"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Milestones Timeline */}
      {sortedMilestones.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {sortedMilestones.map((milestone, index) => {
              const isCompleted = !!milestone.actualDate;
              const isOverdue =
                !isCompleted && milestone.targetDate && milestone.targetDate < today;

              return (
                <div key={milestone.milestoneId} className="flex items-center gap-1">
                  {index > 0 && (
                    <div
                      className={`w-6 h-0.5 ${
                        isCompleted ? 'bg-green-400' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  <div className="group relative">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-medium ${
                        isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : isOverdue
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'bg-white border-gray-300 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircleIcon className="w-5 h-5" />
                      ) : isOverdue ? (
                        <ClockIcon className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                      <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                        <p className="font-medium">{milestone.name}</p>
                        {milestone.actualDate && (
                          <p className="text-green-300">{formatDate(milestone.actualDate)}</p>
                        )}
                        {!milestone.actualDate && milestone.targetDate && (
                          <p className={isOverdue ? 'text-red-300' : 'text-gray-300'}>
                            {formatDate(milestone.targetDate)}
                            {isOverdue && ' - באיחור'}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Actions on hover */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-white shadow-lg rounded p-0.5 border z-20">
                      {!isCompleted && (
                        <button
                          onClick={() => handleCompleteMilestone(milestone.milestoneId)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="סמן כהושלם"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteMilestone(milestone.milestoneId)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="מחק"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowAddMilestone(true)}
          className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
        >
          <span className="flex items-center gap-1">
            <PlusIcon className="w-3 h-3" />
            מיילסטון
          </span>
        </button>
        <button
          onClick={() => setShowAddTracking(true)}
          className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
        >
          <span className="flex items-center gap-1">
            <PlusIcon className="w-3 h-3" />
            מספר מעקב
          </span>
        </button>
      </div>

      {/* Add Milestone Modal */}
      <Modal
        isOpen={showAddMilestone}
        onClose={() => setShowAddMilestone(false)}
        title="הוסף מיילסטון"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            id="milestoneName"
            label="שם"
            value={newMilestone.name}
            onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
            placeholder="לדוגמה: הגיע לסוכן, נשלח אלינו"
            required
          />
          <Input
            id="milestoneDate"
            label="תאריך יעד"
            type="date"
            value={newMilestone.targetDate}
            onChange={(e) => setNewMilestone({ ...newMilestone, targetDate: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAddMilestone(false)}>ביטול</Button>
            <Button onClick={handleAddMilestone} disabled={!newMilestone.name.trim()}>הוסף</Button>
          </div>
        </div>
      </Modal>

      {/* Add Tracking Modal */}
      <Modal
        isOpen={showAddTracking}
        onClose={() => setShowAddTracking(false)}
        title="הוסף מספר מעקב"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">קטע משלוח</label>
            <select
              value={newTracking.leg}
              onChange={(e) => setNewTracking({ ...newTracking, leg: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">בחר...</option>
              <option value="ספק לסוכן">ספק לסוכן</option>
              <option value="סוכן אלינו">סוכן אלינו</option>
              <option value="אחר">אחר</option>
            </select>
          </div>
          <Input
            id="trackingNumber"
            label="מספר מעקב"
            value={newTracking.trackingNumber}
            onChange={(e) => setNewTracking({ ...newTracking, trackingNumber: e.target.value })}
            required
          />
          <Input
            id="carrier"
            label="חברת משלוח"
            value={newTracking.carrier}
            onChange={(e) => setNewTracking({ ...newTracking, carrier: e.target.value })}
            placeholder="לדוגמה: SF Express"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAddTracking(false)}>ביטול</Button>
            <Button
              onClick={handleAddTracking}
              disabled={!newTracking.leg || !newTracking.trackingNumber.trim()}
            >
              הוסף
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rating Modal */}
      <Modal
        isOpen={showRating}
        onClose={() => setShowRating(false)}
        title="דירוג דוגמית"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">דירוג</label>
            <div className="flex items-center gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star === rating ? 0 : star)}
                  className="p-1 transition-colors"
                >
                  {star <= rating ? (
                    <StarSolid className="w-8 h-8 text-yellow-400" />
                  ) : (
                    <StarOutline className="w-8 h-8 text-gray-300 hover:text-yellow-300" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="ratingNotes" className="block text-sm font-medium text-gray-700 mb-1">
              הערות
            </label>
            <textarea
              id="ratingNotes"
              value={ratingNotes}
              onChange={(e) => setRatingNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              placeholder="מה חשבת על הדוגמית?"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowRating(false)}>ביטול</Button>
            <Button onClick={handleSaveRating}>שמור דירוג</Button>
          </div>
        </div>
      </Modal>

      {/* Lightbox */}
      {ConfirmDialog}
      {lightboxImage && (
        <>
          <div
            className="fixed inset-0 bg-black/80 z-40"
            onClick={() => setLightboxImage(null)}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <img
                src={lightboxImage}
                alt="תמונת דוגמית"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute top-2 left-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
