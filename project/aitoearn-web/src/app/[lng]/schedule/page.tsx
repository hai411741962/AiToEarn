/** Schedule page - a simple view of upcoming real publishing records. */
'use client'

import type { ChannelPublishRecordItem } from '@/api/channels/channel.types'
import { ArrowRight, CalendarDays, CircleAlert, Loader2, Plus, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getChannelPublishRecordsApi } from '@/api/channels/channel.api'
import { AccountPlatInfoMap } from '@/app/config/platConfig'
import { useTransClient } from '@/app/i18n/client'
import { Button } from '@/components/ui/button'
import { useUserStore } from '@/store/user'
import { navigateToLogin } from '@/utils/auth'
import { formatDate } from '@/utils/format'
import { recordGroup, recordList } from '../workspace/WorkspacePage'

export default function SchedulePage() {
  const { t } = useTransClient('route')
  const { token, hydrated } = useUserStore(useShallow(state => ({ token: state.token, hydrated: state._hasHydrated })))
  const [records, setRecords] = useState<ChannelPublishRecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [authNeeded, setAuthNeeded] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    setAuthNeeded(false)
    try {
      const start = new Date()
      const end = new Date(start)
      end.setDate(start.getDate() + 30)
      const response = await getChannelPublishRecordsApi({ time: [start.toISOString(), end.toISOString()] })
      if (response?.code === 401) {
        setAuthNeeded(true)
        return
      }
      if (response?.code !== 0)
        throw new Error(response?.message || 'Unable to load schedule')
      setRecords(recordList(response.data).sort((a, b) => new Date(a.publishTime).getTime() - new Date(b.publishTime).getTime()))
    }
    catch {
      setError(true)
    }
    finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (!hydrated)
      return
    if (!token) {
      setLoading(false)
      setAuthNeeded(true)
      return
    }
    void load()
  }, [hydrated, load, token])
  const upcoming = useMemo(() => records.filter(record => ['scheduled', 'progress', 'attention'].includes(recordGroup(record.status))), [records])
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
            <CalendarDays size={15} />
            03 /
            {' '}
            {t('schedule')}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{t('scheduleHeadline')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('scheduleDescription')}</p>
        </div>
        <Button asChild className="cursor-pointer rounded-full bg-gradient-back text-gradient-foreground">
          <Link href="/accounts?action=publish">
            <Plus size={16} />
            {t('createPublish')}
          </Link>
        </Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <span className="text-sm text-muted-foreground">{t('next30Days', { count: upcoming.length })}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {t('refresh')}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/accounts">
              {t('viewCalendar')}
              <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      </div>
      {loading ? <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card"><Loader2 className="animate-spin text-muted-foreground" /></div> : authNeeded ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <h2 className="text-sm font-medium text-foreground">{t('signInToStart')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('signInDescription')}</p>
          <Button variant="outline" className="mt-4 cursor-pointer" onClick={() => navigateToLogin()}>{t('signIn')}</Button>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <CircleAlert size={20} className="mb-2" />
          {t('loadFailed')}
          <Button variant="link" className="cursor-pointer" onClick={() => void load()}>{t('retry')}</Button>
        </div>
      ) : upcoming.length ? (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {upcoming.map(record => (
            <div key={record.id} className="flex flex-wrap items-center gap-4 p-4">
              <span className="w-32 shrink-0 text-sm font-medium text-primary">{formatDate(record.publishTime)}</span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-foreground">{record.title || record.desc || t('untitledContent')}</strong>
                <small className="text-xs text-muted-foreground">{AccountPlatInfoMap.get(record.accountType)?.name || record.accountType}</small>
              </span>
              <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{t(`record.${recordGroup(record.status)}`)}</span>
              <Link href="/accounts" className="text-sm text-primary hover:underline">{t('managePlan')}</Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <CalendarDays className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">{t('emptySchedule')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyScheduleDescription')}</p>
          <Button asChild variant="outline" className="mt-4 cursor-pointer"><Link href="/accounts?action=publish">{t('createPublish')}</Link></Button>
        </div>
      )}
    </div>
  )
}
