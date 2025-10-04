// Simple progress indicator
// Path: web/src/components/Progress.tsx
'use client';

import { useI18n } from '@/src/lib/i18n';

type Props = { index?: number; total?: number };

export default function Progress({ index, total }: Props) {
  const { t } = useI18n();
  if (index == null || total == null) return null;
  return (
    <div className="text-sm text-muted-foreground mb-2 text-center">
      {t('play.question', { index: String(index), total: String(total) })}
    </div>
  );
}
