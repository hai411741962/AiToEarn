/** Channels page - connected account overview and real authorization entry. */
'use client'

import { ArrowRight, CheckCircle2, Loader2, Plus, Tv } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AccountStatus } from '@/app/config/accountConfig'
import { AccountPlatInfoMap } from '@/app/config/platConfig'
import { useTransClient } from '@/app/i18n/client'
import { useChannelManagerStore } from '@/components/ChannelManager'
import { Button } from '@/components/ui/button'
import { useAccountStore } from '@/store/account'
import { useUserStore } from '@/store/user'
import { navigateToLogin } from '@/utils/auth'

export default function ChannelsPage() {
  const { t } = useTransClient('route')
  const { accounts, initialized, accountInit } = useAccountStore(useShallow(state => ({ accounts: state.accountList, initialized: state.accountListInitialized, accountInit: state.accountInit })))
  const openConnectList = useChannelManagerStore(state => state.openConnectList)
  const { token, hydrated } = useUserStore(useShallow(state => ({ token: state.token, hydrated: state._hasHydrated })))
  useEffect(() => {
    if (hydrated && token)
      void accountInit()
  }, [accountInit, hydrated, token])
  const connected = accounts.filter(account => account.status === AccountStatus.USABLE).length
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
            <Tv size={15} />
            02 /
            {' '}
            {t('channels')}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{t('channelsHeadline')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('channelsDescription')}</p>
        </div>
        <Button onClick={() => token ? openConnectList() : navigateToLogin()} className="cursor-pointer rounded-full bg-gradient-back text-gradient-foreground">
          <Plus size={16} />
          {t('connectChannel')}
        </Button>
      </header>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} className="text-success" />
          <span className="text-sm text-muted-foreground">{t('connectedCount', { count: connected })}</span>
        </div>
      </div>
      {!hydrated || (token && !initialized) ? <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card"><Loader2 className="animate-spin text-muted-foreground" /></div> : accounts.length ? (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {accounts.map(account => (
            <div key={account.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground">{account.nickname?.slice(0, 1) || '·'}</div>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-foreground">{account.nickname || AccountPlatInfoMap.get(account.type)?.name || account.type}</strong>
                <span className="text-xs text-muted-foreground">{AccountPlatInfoMap.get(account.type)?.name || account.type}</span>
              </div>
              <span className={account.status === AccountStatus.USABLE ? 'text-xs text-success' : 'text-xs text-destructive'}>{account.status === AccountStatus.USABLE ? t('connected') : t('needsReconnect')}</span>
              {account.status !== AccountStatus.USABLE && <Button variant="outline" size="sm" onClick={() => openConnectList()} className="cursor-pointer">{t('reconnect')}</Button>}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <Tv className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('noChannels')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('noChannelsDescription')}</p>
          <Button variant="outline" className="mt-4 cursor-pointer" onClick={() => token ? openConnectList() : navigateToLogin()}>{token ? t('connectChannel') : t('signIn')}</Button>
        </div>
      )}
      <Link href="/draft-box" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
        {t('nextCreateContent')}
        <ArrowRight size={16} />
      </Link>
    </div>
  )
}
