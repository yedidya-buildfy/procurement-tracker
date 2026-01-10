'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    order_name: string;
    usd_rate: number;
    cny_rate: number;
    estimated_arrival: string;
    notes: string;
  }) => Promise<void>;
}

export default function NewOrderModal({
  isOpen,
  onClose,
  onSubmit,
}: NewOrderModalProps) {
  const today = new Date();
  const defaultName = `משלוח סין ${today.toLocaleDateString('he-IL', {
    month: 'long',
    year: 'numeric',
  })}`;

  const [formData, setFormData] = useState({
    order_name: defaultName,
    usd_rate: 3.76,
    cny_rate: 0.52,
    estimated_arrival: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [ratesLive, setRatesLive] = useState(false);

  // Fetch live rates when modal opens
  useEffect(() => {
    if (isOpen) {
      fetch('/api/rates')
        .then((res) => res.json())
        .then((rates) => {
          setFormData((prev) => ({
            ...prev,
            usd_rate: rates.USD,
            cny_rate: rates.CNY,
          }));
          setRatesLive(rates.live);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
      setFormData({
        order_name: defaultName,
        usd_rate: 3.76,
        cny_rate: 0.52,
        estimated_arrival: '',
        notes: '',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="הזמנה חדשה" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="order_name"
          label="שם ההזמנה"
          value={formData.order_name}
          onChange={(e) =>
            setFormData({ ...formData, order_name: e.target.value })
          }
          required
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">שערי מטבע</span>
            {ratesLive && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                שערים חיים מבנק ישראל
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="usd_rate"
              label="שער דולר"
              type="number"
              step="0.01"
              value={formData.usd_rate}
              onChange={(e) =>
                setFormData({ ...formData, usd_rate: parseFloat(e.target.value) })
              }
              required
            />

            <Input
              id="cny_rate"
              label="שער יואן"
              type="number"
              step="0.01"
              value={formData.cny_rate}
              onChange={(e) =>
                setFormData({ ...formData, cny_rate: parseFloat(e.target.value) })
              }
              required
            />
          </div>
        </div>

        <Input
          id="estimated_arrival"
          label="הגעה משוערת"
          type="date"
          value={formData.estimated_arrival}
          onChange={(e) =>
            setFormData({ ...formData, estimated_arrival: e.target.value })
          }
        />

        <Input
          id="notes"
          label="הערות"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'יוצר...' : 'צור הזמנה'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
