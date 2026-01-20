'use client';

import { Fragment } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Button from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'אישור',
  cancelText = 'ביטול',
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const iconBgColor = variant === 'danger' ? 'bg-red-100' : 'bg-yellow-100';
  const iconColor = variant === 'danger' ? 'text-red-600' : 'text-yellow-600';

  return (
    <Fragment>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* Icon */}
            <div className={`mx-auto w-14 h-14 rounded-full ${iconBgColor} flex items-center justify-center mb-4`}>
              <ExclamationTriangleIcon className={`w-7 h-7 ${iconColor}`} />
            </div>

            {/* Title */}
            <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
              {title}
            </h3>

            {/* Message */}
            <p className="text-gray-600 text-center leading-relaxed">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              className="min-w-[100px]"
            >
              {cancelText}
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              disabled={isLoading}
              className="min-w-[100px]"
            >
              {isLoading ? 'מוחק...' : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
