/** ContentStartBar - gives creators two clear ways to begin. */
'use client'

import { FileText } from 'lucide-react'
import { useTransClient } from '@/app/i18n/client'

export function ContentStartBar() {
  const { t } = useTransClient('route')
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-4 md:px-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-primary">
          <FileText size={14} />
          01 /
          {' '}
          {t('content')}
        </div>
        <h1 className="mt-1 text-lg font-semibold text-foreground">{t('contentHeadline')}</h1>
        <p className="text-sm text-muted-foreground">{t('contentDescription')}</p>
      </div>
    </div>
  )
}
