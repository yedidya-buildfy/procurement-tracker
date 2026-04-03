'use client';

import { useState, useCallback, ReactNode } from 'react';
import Button from './Button';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ message, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  const ConfirmDialog: ReactNode = state ? (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={handleCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="p-6">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <ExclamationTriangleIcon className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">אישור</h3>
            <p className="text-gray-600 text-center leading-relaxed">{state.message}</p>
          </div>
          <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-center">
            <Button variant="secondary" onClick={handleCancel} className="min-w-[100px]">ביטול</Button>
            <Button variant="danger" onClick={handleConfirm} className="min-w-[100px]">אישור</Button>
          </div>
        </div>
      </div>
    </>
  ) : null;

  return { confirm, ConfirmDialog };
}
