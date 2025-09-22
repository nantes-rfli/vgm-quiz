// Error banner
// Path: web/src/components/ErrorBanner.tsx
'use client';

type Props = { message: string };

export default function ErrorBanner({ message }: Props) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-3">
      {message}
    </div>
  );
}
