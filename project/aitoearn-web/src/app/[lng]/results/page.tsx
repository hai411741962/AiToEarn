/** Results page - actual channel publish records with status filters. */
'use client'

import type { ChannelPublishRecordItem } from '@/api/channels/channel.types'
import { ArrowRight, CheckCircle2, CircleAlert, Loader2, RefreshCw } from 'lucide-react'
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

export default function ResultsPage() {
  const { t } = useTransClient('route')
  const [records, setRecords] = useState<ChannelPublishRecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [authNeeded, setAuthNeeded] = useState(false)
  const { token, hydrated } = useUserStore(useShallow(state => ({ token: state.token, hydrated: state._hasHydrated })))
  const [filter, setFilter] = useState('all')
  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    setAuthNeeded(false)
    try {
      const end = new Date()
      const start = new Date(end)
      start.setDate(end.getDate() - 90)
      const response = await getChannelPublishRecordsApi({ time: [start.toISOString(), end.toISOString()] })
      if (response?.code === 401) {
        setAuthNeeded(true)
        return
      }
      if (response?.code !== 0)
        throw new Error(response?.message || 'Unable to load records')
      setRecords(recordList(response.data).sort((a, b) => new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime()))
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
  const visible = useMemo(() => records.filter(record => filter === 'all' || recordGroup(record.status) === filter), [filter, records])
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
            <CheckCircle2 size={15} />
            04 /
            {' '}
            {t('results')}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{t('resultsHeadline')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('resultsDescription')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="cursor-pointer">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {t('refresh')}
        </Button>
      </header>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('filterResults')}>{['all', 'attention', 'scheduled', 'published'].map(value => <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)} className="cursor-pointer">{t(`filter.${value}`)}</Button>)}</div>
      {loading ? <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card"><Loader2 className="animate-spin text-muted-foreground" /></div> : authNeeded ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <h2 className="text-sm font-medium text-foreground">{t('signInToStart')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('signInDescription')}</p>
          <Button variant="outline" className="mt-4 cursor-pointer" onClick={() => navigateToLogin()}>{t('signIn')}</Button>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <CircleAlert size={20} />
          {t('loadFailed')}
          <Button variant="link" onClick={() => void load()}>{t('retry')}</Button>
        </div>
      ) : visible.length ? (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {visible.map(record => (
            <div key={record.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-foreground">{record.title || record.desc || t('untitledContent')}</strong>
                <small className="mt-1 block text-xs text-muted-foreground">
                  {AccountPlatInfoMap.get(record.accountType)?.name || record.accountType}
                  {' '}
                  ·
                  {' '}
                  {formatDate(record.publishTime)}
                </small>
              </span>
              <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{t(`record.${recordGroup(record.status)}`)}</span>
              {record.workLink ? (
                <a href={record.workLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  {t('viewPublishedWork')}
                  <ArrowRight size={14} />
                </a>
              ) : (
                <Link href="/schedule" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  {t('viewSchedule')}
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">{t('emptyResults')}</div>}
    </div>
  )
}
