'use client';

export interface ErrorBannerProps {
  title?: string;
  message: string;
  showRetry?: boolean;
  onRetry?: () => void;
}

export default function ErrorBanner({
  title = 'Error',
  message,
  showRetry = false,
  onRetry,
}: ErrorBannerProps) {
  return (
    <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">
      <p className="font-semibold">{title}</p>
      <p className="text-sm">{message}</p>
      {showRetry && onRetry && (
        <div className="mt-2">
          <button onClick={onRetry} className="rounded-xl border px-3 py-1">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
