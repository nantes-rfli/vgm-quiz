// Simple progress indicator
// Path: web/src/components/Progress.tsx
'use client';

type Props = { index?: number; total?: number };

export default function Progress({ index, total }: Props) {
  if (index == null || total == null) return null;
  return (
    <div className="text-sm text-gray-600 mb-2 text-center">
      Question {index} / {total}
    </div>
  );
}
