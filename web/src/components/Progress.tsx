'use client';

// Simple progress text. Keep as a server component (no hooks).
export interface ProgressProps {
  current: number; // 1-based
  total?: number;  // optional until API provides total
}

export default function Progress({ current, total }: ProgressProps) {
  return (
    <p className="text-sm text-gray-500">
      {total ? `Question ${current} / ${total}` : `Question ${current}`}
    </p>
  );
}
