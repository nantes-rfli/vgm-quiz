'use client';

import React from 'react';

export type ToastProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  duration?: number;
  variant?: 'info' | 'error';
  closeLabel?: string;
};

export default function Toast({
  message,
  actionLabel,
  onAction,
  onClose,
  duration = 5000,
  variant = 'info',
  closeLabel = 'Close',
}: ToastProps) {
  React.useEffect(() => {
    if (!duration) return;
    const timer = window.setTimeout(() => {
      onClose?.();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose, message]);

  const baseClasses =
    'pointer-events-auto flex items-center gap-3 rounded-xl shadow-lg px-4 py-3 text-sm border transition';
  const palette =
    variant === 'error'
      ? 'bg-red-600 text-white border-red-500'
      : 'bg-gray-900 text-white border-gray-800';

  return (
    <div
      role="status"
      className={`${baseClasses} ${palette}`}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
      }}
    >
      <span className="flex-1 leading-snug">{message}</span>
      {actionLabel ? (
        <button
          type="button"
          onClick={() => {
            onAction?.();
            onClose?.();
          }}
          className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20"
        >
          {actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
      >
        ×
      </button>
    </div>
  );
}
