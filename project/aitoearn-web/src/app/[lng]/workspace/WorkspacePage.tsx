/** WorkspacePage - 真实账号与发布记录驱动的工作台。 */
'use client'

import type { ChannelPublishRecordItem, ChannelPublishRecordListVo } from '@/api/channels/channel.types'
import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, FileText, Loader2, Plus, RefreshCw, Sparkles, Tv } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getChannelPublishRecordsApi } from '@/api/channels/channel.api'
import { ChannelPublishStatus } from '@/api/channels/channel.constants'
import { AccountStatus } from '@/app/config/accountConfig'
import { AccountPlatInfoMap } from '@/app/config/platConfig'
import { useTransClient } from '@/app/i18n/client'
import { Button } from '@/components/ui/button'
import { useAccountStore } from '@/store/account'
import { useUserStore } from '@/store/user'
import { navigateToLogin } from '@/utils/auth'
import { cn } from '@/utils/className'
import { formatDate } from '@/utils/format'

export function recordList(data?: ChannelPublishRecordListVo): ChannelPublishRecordItem[] {
  if (Array.isArray(data))
    return data
  return data?.records ?? data?.list ?? data?.items ?? data?.rows ?? []
}

export function recordGroup(status: ChannelPublishStatus) {
  if (status === ChannelPublishStatus.Published)
    return 'published'
  if ([ChannelPublishStatus.WaitingForPublish, ChannelPublishStatus.Queued, ChannelPublishStatus.PlatformScheduled].includes(status))
    return 'scheduled'
  if ([ChannelPublishStatus.Failed, ChannelPublishStatus.UpdatedFailed, ChannelPublishStatus.WaitingForUserAction].includes(status))
    return 'attention'
  return 'progress'
}

function ActionCard({ number, title, detail, href, complete }: { number: string, title: string, detail: string, href: string, complete?: boolean }) {
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/50">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums', complete ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary')}>{complete ? <CheckCircle2 size={19} /> : number}</span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm text-foreground">{title}</strong>
        <small className="mt-1 block truncate text-xs text-muted-foreground">{detail}</small>
      </span>
      <ArrowRight size={17} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  )
}

function RecordRow({ record }: { record: ChannelPublishRecordItem }) {
  const { t } = useTransClient('route')
  const group = recordGroup(record.status)
  const platform = AccountPlatInfoMap.get(record.accountType)?.name ?? record.accountType
  return (
    <Link href="/schedule" className="group flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/40 hover:bg-accent/40">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FileText size={17} /></span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-medium text-foreground">{record.title || record.desc || t('untitledContent')}</strong>
        <small className="block truncate text-xs text-muted-foreground">
          {platform}
          {' '}
          ·
          {' '}
          {formatDate(record.publishTime)}
        </small>
      </span>
      <span className={cn('shrink-0 rounded-full px-2 py-1 text-xs', group === 'attention' ? 'bg-destructive/10 text-destructive' : group === 'published' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary')}>{t(`record.${group}`)}</span>
      <ArrowRight size={16} className="shrink-0 text-muted-foreground group-hover:text-primary" />
    </Link>
  )
}

export function WorkspacePage() {
  const { t } = useTransClient('route')
  const { accountList, accountListInitialized, accountInit } = useAccountStore(useShallow(state => ({ accountList: state.accountList, accountListInitialized: state.accountListInitialized, accountInit: state.accountInit })))
  const [records, setRecords] = useState<ChannelPublishRecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [authNeeded, setAuthNeeded] = useState(false)
  const { token, hydrated } = useUserStore(useShallow(state => ({ token: state.token, hydrated: state._hasHydrated })))
  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    setAuthNeeded(false)
    try {
      const now = new Date()
      const start = new Date(now)
      const end = new Date(now)
      start.setDate(now.getDate() - 30)
      end.setDate(now.getDate() + 30)
      const response = await getChannelPublishRecordsApi({ time: [start.toISOString(), end.toISOString()] })
      if (response?.code === 401) {
        setAuthNeeded(true)
        return
      }
      if (response?.code !== 0)
        throw new Error(response?.message || 'Unable to load records')
      setRecords(recordList(response.data))
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
    void accountInit()
    void load()
  }, [accountInit, hydrated, load, token])
  const connected = accountList.filter(account => account.status === AccountStatus.USABLE).length
  const summary = useMemo(() => ({
    attention: records.filter(record => recordGroup(record.status) === 'attention'),
    scheduled: records.filter(record => recordGroup(record.status) === 'scheduled'),
    published: records.filter(record => recordGroup(record.status) === 'published'),
  }), [records])
  const recent = [...summary.attention, ...summary.scheduled, ...summary.published].slice(0, 5)
  return (
    <div className="mx-auto max-w-7xl space-y-7 px-4 py-6 md:px-8 md:py-8">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 md:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 size-72 rounded-full bg-brand-purple/10 blur-3xl" />
        <div className="pointer-events-none absolute right-24 top-12 size-44 rounded-full bg-brand-cyan/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles size={14} />
              {t('workspaceEyebrow')}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{t('workspaceHeadline')}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{t('workspaceDescription')}</p>
          </div>
          <Button asChild className="w-fit cursor-pointer rounded-full bg-gradient-back px-5 text-gradient-foreground">
            <Link href="/accounts?action=publish">
              <Plus size={17} />
              {t('createPublish')}
            </Link>
          </Button>
        </div>
      </section>
      <section aria-label={t('workspaceSteps')} className="grid gap-3 md:grid-cols-3">
        <ActionCard number="01" title={t('channels')} detail={accountListInitialized ? t('connectedCount', { count: connected }) : t('loading')} href="/channels" complete={connected > 0} />
        <ActionCard number="02" title={t('content')} detail={t('contentStepDescription')} href="/draft-box" />
        <ActionCard number="03" title={t('schedule')} detail={t('scheduledCount', { count: summary.scheduled.length })} href="/schedule" />
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('nextActions')}</h2>
              <p className="text-sm text-muted-foreground">{t('nextActionsDescription')}</p>
            </div>
            <Button variant="ghost" size="icon" className="cursor-pointer" aria-label={t('refresh')} onClick={() => void load()} disabled={loading}><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></Button>
          </div>
          {loading ? <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card"><Loader2 className="animate-spin text-muted-foreground" /></div> : authNeeded ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <Tv className="mx-auto mb-3 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">{t('signInToStart')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('signInDescription')}</p>
              <Button variant="outline" className="mt-4 cursor-pointer" onClick={() => navigateToLogin()}>{t('signIn')}</Button>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <CircleAlert size={20} className="mb-2" />
              {t('loadFailed')}
              <Button variant="link" className="cursor-pointer" onClick={() => void load()}>{t('retry')}</Button>
            </div>
          ) : recent.length ? <div className="space-y-2">{recent.map(record => <RecordRow key={record.id} record={record} />)}</div> : (
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <FileText className="mx-auto mb-3 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">{t('emptyRecords')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('emptyRecordsDescription')}</p>
              <Button asChild variant="outline" className="mt-4 cursor-pointer"><Link href="/accounts?action=publish">{t('createPublish')}</Link></Button>
            </div>
          )}
        </section>
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">{t('publishReadiness')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('publishReadinessDescription')}</p>
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Tv size={18} className={connected ? 'text-success' : 'text-muted-foreground'} />
                <span className="flex-1 text-foreground">{t('channels')}</span>
                <strong className="tabular-nums text-foreground">{connected}</strong>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CalendarDays size={18} className={summary.scheduled.length ? 'text-primary' : 'text-muted-foreground'} />
                <span className="flex-1 text-foreground">{t('schedule')}</span>
                <strong className="tabular-nums text-foreground">{summary.scheduled.length}</strong>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 size={18} className={summary.published.length ? 'text-success' : 'text-muted-foreground'} />
                <span className="flex-1 text-foreground">{t('results')}</span>
                <strong className="tabular-nums text-foreground">{summary.published.length}</strong>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-5 w-full cursor-pointer">
              <Link href={connected ? '/schedule' : '/channels'}>
                {connected ? t('viewSchedule') : t('connectChannel')}
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-5">
            <h3 className="text-sm font-semibold text-foreground">{t('aiTools')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('aiToolsDescription')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm"><Link href="/ai-social">{t('aiSocial')}</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href="/agent-assets">{t('header.agentAssets')}</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href="/tasks-history">{t('tasksHistory')}</Link></Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
