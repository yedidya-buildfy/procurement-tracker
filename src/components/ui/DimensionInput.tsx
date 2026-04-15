'use client';

import { computeCbmFromDims } from '../../../convex/helpers';

interface DimensionInputProps {
  dimHeight: string;
  dimWidth: string;
  dimLength: string;
  volume: string;
  weight?: string;
  showWeight?: boolean;
  onDimChange: (field: 'dimHeight' | 'dimWidth' | 'dimLength', value: string) => void;
  onVolumeChange: (value: string) => void;
  onWeightChange?: (value: string) => void;
  disabled?: boolean;
}

export default function DimensionInput({
  dimHeight,
  dimWidth,
  dimLength,
  volume,
  weight,
  showWeight = false,
  onDimChange,
  onVolumeChange,
  onWeightChange,
  disabled = false,
}: DimensionInputProps) {
  const h = parseFloat(dimHeight) || 0;
  const w = parseFloat(dimWidth) || 0;
  const l = parseFloat(dimLength) || 0;
  const hasDims = h > 0 && w > 0 && l > 0;
  const computedCbm = computeCbmFromDims(h, w, l);

  const handleDimChange = (field: 'dimHeight' | 'dimWidth' | 'dimLength', value: string) => {
    onDimChange(field, value);
    // When dims are being filled, clear the direct volume
    // (the computed CBM will be shown instead)
  };

  const handleVolumeChange = (value: string) => {
    // Clear all dims when user types direct CBM
    onDimChange('dimHeight', '');
    onDimChange('dimWidth', '');
    onDimChange('dimLength', '');
    onVolumeChange(value);
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 text-sm';

  return (
    <div className="space-y-3">
      {/* Dimensions Row */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          מידות (מ״מ)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            value={dimHeight}
            onChange={(e) => handleDimChange('dimHeight', e.target.value)}
            placeholder="גובה"
            className={inputClass}
            disabled={disabled}
          />
          <span className="text-gray-400 text-sm flex-shrink-0">x</span>
          <input
            type="number"
            step="0.1"
            value={dimWidth}
            onChange={(e) => handleDimChange('dimWidth', e.target.value)}
            placeholder="רוחב"
            className={inputClass}
            disabled={disabled}
          />
          <span className="text-gray-400 text-sm flex-shrink-0">x</span>
          <input
            type="number"
            step="0.1"
            value={dimLength}
            onChange={(e) => handleDimChange('dimLength', e.target.value)}
            placeholder="אורך"
            className={inputClass}
            disabled={disabled}
          />
        </div>
        {hasDims && computedCbm !== null && (
          <p className="text-xs text-green-600 mt-1">
            = {computedCbm.toFixed(6)} CBM (מחושב)
          </p>
        )}
      </div>

      {/* Direct CBM */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          CBM ליחידה {hasDims ? '(מחושב)' : '(ישיר)'}
        </label>
        <input
          type="number"
          step="0.000001"
          value={hasDims && computedCbm !== null ? computedCbm.toFixed(6) : volume}
          onChange={(e) => handleVolumeChange(e.target.value)}
          className={inputClass}
          disabled={disabled || hasDims}
          readOnly={hasDims}
        />
      </div>

      {/* Weight */}
      {showWeight && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            משקל (גרם)
          </label>
          <input
            type="number"
            step="0.1"
            value={weight || ''}
            onChange={(e) => onWeightChange?.(e.target.value)}
            placeholder="משקל בגרם"
            className={inputClass}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
