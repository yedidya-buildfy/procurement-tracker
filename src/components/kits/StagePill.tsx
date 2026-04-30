'use client';

import { useState, useRef, useEffect } from 'react';
import { SAMPLE_STAGES, getStageStyle } from '@/lib/sampleStages';
import { CheckCircleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface StagePillProps {
  currentStage: number | undefined | null;
  onStageChange: (stageId: number) => void;
}

export default function StagePill({ currentStage, onStageChange }: StagePillProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const style = getStageStyle(currentStage);
  const currentName = currentStage != null ? SAMPLE_STAGES[currentStage]?.name : null;

  return (
    <div ref={ref} className="relative inline-block">
      {/* The single pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="לחץ לשינוי שלב"
        className={`inline-flex items-center gap-1.5 pr-3 pl-2 py-1 rounded-full text-xs font-medium transition-all ${style.bg} ${style.text} hover:shadow-sm hover:scale-105`}
      >
        {currentStage != null && (
          <span className={`w-2 h-2 rounded-full ${SAMPLE_STAGES[currentStage]?.activeBg || 'bg-gray-400'}`} />
        )}
        {currentName || 'לא הוזמן'}
        <ChevronDownIcon className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-1.5 right-0 z-30 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150">
          {SAMPLE_STAGES.map((stage) => {
            const isPast = currentStage != null && stage.id < currentStage;
            const isCurrent = stage.id === currentStage;
            const isFuture = currentStage == null || stage.id > currentStage;

            return (
              <button
                key={stage.id}
                onClick={() => {
                  onStageChange(stage.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors ${
                  isCurrent
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Stage indicator */}
                <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                  {isPast ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  ) : isCurrent ? (
                    <span className={`w-3 h-3 rounded-full ${stage.activeBg} ring-2 ring-offset-1 ring-blue-300`} />
                  ) : (
                    <span className="w-3 h-3 rounded-full border-2 border-gray-300" />
                  )}
                </div>

                {/* Stage name */}
                <span className={`flex-1 text-right ${
                  isPast ? 'text-gray-400' : isCurrent ? 'font-semibold text-gray-900' : 'text-gray-600'
                }`}>
                  {stage.name}
                </span>

                {/* Current indicator */}
                {isCurrent && (
                  <span className="text-xs text-blue-600 font-medium">כאן</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
