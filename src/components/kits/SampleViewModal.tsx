'use client';

import { useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { SAMPLE_STAGES } from '@/lib/sampleStages';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export interface SampleViewFilters {
  stages?: number[];
  hasImage?: boolean;
}

interface SampleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  kitId: string;
  // If editing existing view, pass these
  viewId?: string;
  initialName?: string;
  initialFilters?: SampleViewFilters;
  onSaved?: (viewId: string) => void;
}

const NOT_ORDERED_STAGE = -1;

export default function SampleViewModal({
  isOpen,
  onClose,
  kitId,
  viewId,
  initialName = '',
  initialFilters,
  onSaved,
}: SampleViewModalProps) {
  const { showToast } = useToast();
  const createView = useMutation(api.kitSampleViews.createView);
  const updateView = useMutation(api.kitSampleViews.updateView);

  const [name, setName] = useState(initialName);
  const [stages, setStages] = useState<number[]>(initialFilters?.stages ?? []);
  // tri-state: undefined | true | false
  const [hasImage, setHasImage] = useState<boolean | undefined>(initialFilters?.hasImage);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setStages(initialFilters?.stages ?? []);
      setHasImage(initialFilters?.hasImage);
    }
  }, [isOpen, initialName, initialFilters]);

  const toggleStage = (id: number) => {
    setStages((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const filters: SampleViewFilters = {};
      if (stages.length > 0) filters.stages = stages;
      if (hasImage !== undefined) filters.hasImage = hasImage;

      if (viewId) {
        await updateView({ viewId, name: trimmed, filters });
        showToast('התצוגה עודכנה', 'success');
        onSaved?.(viewId);
      } else {
        const newId = await createView({ kitId, name: trimmed, filters });
        showToast('התצוגה נוצרה', 'success');
        onSaved?.(newId);
      }
      onClose();
    } catch (err) {
      console.error('Error saving view:', err);
      showToast('שגיאה בשמירת התצוגה', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={viewId ? 'עריכת תצוגה' : 'תצוגה חדשה'} size="md">
      <div className="space-y-4">
        <Input
          id="viewName"
          label="שם תצוגה"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="לדוגמה: לא הגיע, ללא תמונה"
          required
        />

        {/* Stage filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">איפה הדוגמית</label>
          <p className="text-xs text-gray-400 mb-2">בחר שלב אחד או יותר. ריק = הכל.</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => toggleStage(NOT_ORDERED_STAGE)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                stages.includes(NOT_ORDERED_STAGE)
                  ? 'bg-gray-200 text-gray-700 font-medium'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              לא הוזמן
            </button>
            {SAMPLE_STAGES.map((stage) => {
              const active = stages.includes(stage.id);
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => toggleStage(stage.id)}
                  className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                    active ? `${stage.bg} ${stage.text} font-medium` : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {stage.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Image filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">תמונה</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setHasImage(undefined)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                hasImage === undefined ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              הכל
            </button>
            <button
              type="button"
              onClick={() => setHasImage(true)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                hasImage === true ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              עם תמונה
            </button>
            <button
              type="button"
              onClick={() => setHasImage(false)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                hasImage === false ? 'bg-amber-100 text-amber-700 font-medium' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              ללא תמונה
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>ביטול</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {viewId ? 'שמור' : 'צור'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
