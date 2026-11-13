'use client'

import { useEffect, useState } from 'react'
import { useTransClient } from '@/app/i18n/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { confirm } from '@/utils/ui/confirm'

interface CsdnAccount {
  id: string
  label: string
  identity: string | null
}

interface PublishResult {
  accountId: string
  status: 'published' | 'submitted_unverified' | 'failed'
  url?: string
  message?: string
}

const BRIDGE_URL = 'http://127.0.0.1:8787'

async function request<T>(path: string, method = 'GET', data?: object): Promise<T> {
  const response = await fetch(`${BRIDGE_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  })
  const result = await response.json()
  if (!response.ok)
    throw new Error(result.error || 'Request failed')
  return result as T
}

export function CsdnAutoPublishPanel({ title, body }: { title: string, body: string }) {
  const { t } = useTransClient('account')
  const [accounts, setAccounts] = useState<CsdnAccount[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [label, setLabel] = useState('')
  const [online, setOnline] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [results, setResults] = useState<PublishResult[]>([])
  const [verified, setVerified] = useState<Record<string, string>>({})

  const refresh = async () => {
    try {
      const response = await request<{ accounts: CsdnAccount[] }>('/accounts')
      setAccounts(response.accounts)
      setOnline(true)
    }
    catch {
      setOnline(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const addAccount = async () => {
    if (!label.trim())
      return
    setBusy(true)
    try {
      await request('/accounts', 'POST', { label: label.trim() })
      setLabel('')
      setMessage('')
      await refresh()
    }
    catch (error) { setMessage(String(error)) }
    finally { setBusy(false) }
  }

  const login = async (id: string) => {
    setBusy(true)
    try {
      await request(`/accounts/${id}/login`, 'POST')
      setMessage(t('channelManager.csdnAuto.loginOpened'))
    }
    catch (error) { setMessage(String(error)) }
    finally { setBusy(false) }
  }

  const verify = async (id: string) => {
    setBusy(true)
    try {
      const result = await request<{ status: string, identity?: string }>(`/accounts/${id}/verify`, 'POST')
      setVerified(previous => ({ ...previous, [id]: result.status }))
      setMessage(result.status === 'connected'
        ? t('channelManager.csdnAuto.verified', { identity: result.identity })
        : result.status === 'duplicate'
          ? t('channelManager.csdnAuto.duplicateAccount')
          : result.status === 'mismatch'
            ? t('channelManager.csdnAuto.identityMismatch')
            : t('channelManager.csdnAuto.notVerified'))
      await refresh()
    }
    catch (error) { setMessage(String(error)) }
    finally { setBusy(false) }
  }

  const removeAccount = async (id: string) => {
    const accepted = await confirm({
      title: t('channelManager.csdnAuto.removeTitle'),
      content: t('channelManager.csdnAuto.removeDescription'),
      okText: t('channelManager.csdnAuto.remove'),
    })
    if (!accepted)
      return
    setBusy(true)
    try {
      await request(`/accounts/${id}`, 'DELETE')
      setSelected(previous => previous.filter(value => value !== id))
      await refresh()
    }
    catch (error) { setMessage(String(error)) }
    finally { setBusy(false) }
  }

  const publish = async () => {
    if (!selected.length || !title.trim() || !body.trim())
      return
    setBusy(true)
    setResults([])
    setMessage('')
    try {
      const response = await request<{ results: PublishResult[] }>('/publish', 'POST', { accountIds: selected, title, body })
      setResults(response.results)
    }
    catch (error) { setMessage(String(error)) }
    finally { setBusy(false) }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-3" data-testid="csdn-auto-publish-panel">
      <h3 className="text-sm font-semibold">{t('channelManager.csdnAuto.heading')}</h3>
      <p className="text-xs text-muted-foreground">{t('channelManager.csdnAuto.description')}</p>
      {!online && <p className="text-sm text-destructive">{t('channelManager.csdnAuto.bridgeOffline')}</p>}
      {online && (
        <>
          <div className="flex gap-2">
            <Input value={label} onChange={event => setLabel(event.target.value)} placeholder={t('channelManager.csdnAuto.labelPlaceholder')} maxLength={40} disabled={busy} />
            <Button variant="outline" disabled={busy || !label.trim()} onClick={() => void addAccount()}>{t('channelManager.csdnAuto.add')}</Button>
          </div>
          <div className="space-y-2">
            {accounts.map(account => (
              <div key={account.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
                <label className="flex min-w-36 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={!account.identity || busy}
                    checked={selected.includes(account.id)}
                    onChange={(event) => {
                      setSelected(previous => event.target.checked ? [...previous, account.id] : previous.filter(value => value !== account.id))
                    }}
                  />
                  <span>{account.label}</span>
                  <span className="text-xs text-muted-foreground">{account.identity || t('channelManager.csdnAuto.unverified')}</span>
                </label>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void login(account.id)}>{t('channelManager.csdnAuto.login')}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void verify(account.id)}>{t('channelManager.csdnAuto.verify')}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void removeAccount(account.id)}>{t('channelManager.csdnAuto.remove')}</Button>
                {verified[account.id] === 'mismatch' && <span className="w-full text-xs text-destructive">{t('channelManager.csdnAuto.identityMismatch')}</span>}
              </div>
            ))}
          </div>
          <Button disabled={busy || !selected.length || !title.trim() || !body.trim()} onClick={() => void publish()}>
            {busy ? t('channelManager.csdnAuto.working') : t('channelManager.csdnAuto.publish', { count: selected.length })}
          </Button>
          <p className="text-xs text-muted-foreground">{t('channelManager.csdnAuto.resultNote')}</p>
        </>
      )}
      {message && <p className="text-sm" role="status">{message}</p>}
      {results.length > 0 && (
        <ul className="space-y-1 text-sm" role="status">
          {results.map((result) => {
            const account = accounts.find(item => item.id === result.accountId)
            return (
              <li key={result.accountId}>
                {account?.label || result.accountId}
                ：
                {t(`channelManager.csdnAuto.status.${result.status}`)}
                {result.message && ` — ${result.message}`}
                {result.url && <a className="ml-2 text-primary underline" href={result.url} target="_blank" rel="noreferrer">{t('channelManager.csdnAuto.view')}</a>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
