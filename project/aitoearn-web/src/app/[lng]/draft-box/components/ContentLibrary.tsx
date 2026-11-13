'use client'

import type { PromotionMaterial } from '@/api/materials/material.types'
import { FileText, Link2, Loader2, Pencil, Plus, Search, Send, Trash2, Video } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiCreateMaterial, apiDeleteMaterial, apiGetMaterialList, apiUpdateMaterial } from '@/api/materials/material.api'
import { PubType } from '@/app/config/publishConfig'
import { useTransClient } from '@/app/i18n/client'
import { CreateMaterialModal } from '@/components/draft-box/components/CreateMaterialModal'
import PublishDialog from '@/components/PublishDialog'
import { buildPublishParamsFromDraft } from '@/components/PublishDialog/PublishDialog.util'
import { usePublishDialog } from '@/components/PublishDialog/usePublishDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAccountStore } from '@/store/account'
import { useUserStore } from '@/store/user'
import { confirm } from '@/utils/ui/confirm'
import { toast } from '@/utils/ui/toast'

interface ImportedArticle {
  title: string
  body: string
  sourceUrl: string
}

interface ContentLibraryProps {
  planId: string
}

function isVideo(material: PromotionMaterial) {
  return material.type === PubType.VIDEO || material.mediaList?.some(media => media.type === 'video')
}

export function ContentLibrary({ planId }: ContentLibraryProps) {
  const { t } = useTransClient('route')
  const { lng } = useParams<{ lng: string }>()
  const label = (key: string) => t(`contentLibrary.${key}`)
  const [tab, setTab] = useState<'article' | 'video'>('article')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PromotionMaterial[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [articleOpen, setArticleOpen] = useState(false)
  const [editing, setEditing] = useState<PromotionMaterial | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const [videoEditing, setVideoEditing] = useState<PromotionMaterial | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [imported, setImported] = useState<ImportedArticle | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [publishing, setPublishing] = useState<PromotionMaterial | null>(null)
  const prefilledDraftId = useRef<string | null>(null)
  const selectedAccountCount = usePublishDialog(state => state.pubListChoosed.length)
  const accounts = useAccountStore(state => state.accountList)
  const accountInit = useAccountStore(state => state.accountInit)
  const token = useUserStore(state => state.token)

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true)
    try {
      const response = await apiGetMaterialList(planId, nextPage, 40)
      if (response?.code !== 0)
        throw new Error(response?.message || label('loadFailed'))
      const data = response.data
      setItems(previous => nextPage === 1 ? data.list || [] : [...previous, ...(data.list || [])])
      setTotal(data.total || 0)
      setPage(nextPage)
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : label('loadFailed'))
    }
    finally { setLoading(false) }
  }, [planId, t])

  useEffect(() => { void load(1) }, [load])
  useEffect(() => {
    if (token)
      void accountInit()
  }, [accountInit, token])

  const visibleItems = useMemo(() => items.filter(item => isVideo(item) === (tab === 'video') && (!query.trim() || `${item.title} ${item.desc || ''}`.toLowerCase().includes(query.trim().toLowerCase()))), [items, query, tab])

  const openArticle = (material: PromotionMaterial | null = null) => {
    setEditing(material)
    setTitle(material?.title || '')
    setBody(material?.desc || '')
    setArticleOpen(true)
  }

  const saveArticle = async () => {
    if (!title.trim() || !body.trim()) { toast.warning(label('titleBodyRequired')); return }
    setSaving(true)
    try {
      const response = editing
        ? await apiUpdateMaterial(editing.id, { title: title.trim(), desc: body.trim(), mediaList: editing.mediaList || [], option: editing.option })
        : await apiCreateMaterial({ groupId: planId, title: title.trim(), desc: body.trim(), mediaList: [], type: PubType.ImageText, accountTypes: [] })
      if (response?.code !== 0)
        throw new Error(response?.message || label('saveFailed'))
      setArticleOpen(false)
      toast.success(label('saved'))
      await load(1)
    }
    catch (error) { toast.error(error instanceof Error ? error.message : label('saveFailed')) }
    finally { setSaving(false) }
  }

  const extract = async () => {
    setImportError('')
    setImported(null)
    setImporting(true)
    try {
      const response = await fetch(`/${lng}/article-import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: importUrl.trim() }) })
      const result = await response.json() as ImportedArticle & { error?: string }
      if (!response.ok)
        throw new Error(result.error || label('extractFailed'))
      setImported(result)
    }
    catch (error) { setImportError(error instanceof Error ? error.message : label('extractFailed')) }
    finally { setImporting(false) }
  }

  const saveImported = async () => {
    if (!imported)
      return
    setSaving(true)
    try {
      const response = await apiCreateMaterial({
        groupId: planId,
        title: imported.title,
        desc: imported.body,
        mediaList: [],
        type: PubType.ImageText,
        accountTypes: [],
        option: { sourceUrl: imported.sourceUrl },
      })
      if (response?.code !== 0)
        throw new Error(response?.message || label('saveFailed'))
      setImportOpen(false)
      setImported(null)
      setImportUrl('')
      toast.success(label('importSaved'))
      await load(1)
    }
    catch (error) { toast.error(error instanceof Error ? error.message : label('saveFailed')) }
    finally { setSaving(false) }
  }

  const remove = async (material: PromotionMaterial) => {
    if (!await confirm({ title: label('deleteTitle'), content: material.title, okText: label('delete'), okType: 'destructive' }))
      return
    try {
      const response = await apiDeleteMaterial(material.id)
      if (response?.code !== 0)
        throw new Error(response?.message || label('deleteFailed'))
      toast.success(label('deleted'))
      await load(1)
    }
    catch (error) { toast.error(error instanceof Error ? error.message : label('deleteFailed')) }
  }

  useEffect(() => {
    if (!publishing)
      prefilledDraftId.current = null
  }, [publishing])

  useEffect(() => {
    if (!publishing || selectedAccountCount === 0 || prefilledDraftId.current === publishing.id)
      return
    const timer = setTimeout(async () => {
      const store = usePublishDialog.getState()
      if (!store.pubListChoosed?.length)
        return
      store.setPrefillLoading(true)
      try {
        store.setAccountAllParams(await buildPublishParamsFromDraft(publishing))
        prefilledDraftId.current = publishing.id
      }
      finally { store.setPrefillLoading(false) }
    }, 500)
    return () => { clearTimeout(timer); usePublishDialog.getState().setPrefillLoading(false) }
  }, [publishing, selectedAccountCount])

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6" data-testid="content-library">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={value => setTab(value as 'article' | 'video')}>
          <TabsList>
            <TabsTrigger value="article">
              <FileText size={15} className="mr-1.5" />
              {label('articles')}
            </TabsTrigger>
            <TabsTrigger value="video">
              <Video size={15} className="mr-1.5" />
              {label('videos')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          {tab === 'article' && (
            <Button variant="outline" onClick={() => { setImportOpen(true); setImportError('') }}>
              <Link2 size={16} />
              {label('importLink')}
            </Button>
          )}
          <Button onClick={() => tab === 'article' ? openArticle() : (setVideoEditing(null), setVideoOpen(true))}>
            <Plus size={16} />
            {tab === 'article' ? label('newArticle') : label('newVideo')}
          </Button>
        </div>
      </div>

      <div className="flex max-w-sm items-center gap-2 rounded-md border border-border bg-background px-3">
        <Search size={16} className="shrink-0 text-muted-foreground" />
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={label('search')} className="border-0 px-0 shadow-none focus-visible:ring-0" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_140px_170px_210px] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground md:grid">
          <span>{label('title')}</span>
          <span>{label('source')}</span>
          <span>{label('createdAt')}</span>
          <span>{label('actions')}</span>
        </div>
        {loading && items.length === 0 ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div> : visibleItems.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText className="mx-auto mb-3 text-muted-foreground" size={30} />
            <p className="text-sm font-medium">{query ? label('noSearchResults') : tab === 'article' ? label('noArticles') : label('noVideos')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tab === 'article' ? label('articleHint') : label('videoHint')}</p>
          </div>
        ) : visibleItems.map(material => (
          <div key={material.id} className="grid gap-2 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_140px_170px_210px] md:items-center md:gap-3">
            <div className="min-w-0">
              <strong className="block truncate text-sm font-medium">{material.title || label('untitled')}</strong>
              <p className="mt-1 truncate text-xs text-muted-foreground">{material.desc || label('noDescription')}</p>
            </div>
            <span className="truncate text-xs text-muted-foreground">{typeof material.option?.sourceUrl === 'string' ? label('linkImport') : label('manual')}</span>
            <span className="text-xs text-muted-foreground">{material.createdAt ? new Date(material.createdAt).toLocaleDateString() : '—'}</span>
            <div className="flex flex-wrap items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => isVideo(material) ? (setVideoEditing(material), setVideoOpen(true)) : openArticle(material)}>
                <Pencil size={14} />
                {label('edit')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPublishing(material)}>
                <Send size={14} />
                {label('publish')}
              </Button>
              <Button size="sm" variant="ghost" aria-label={`${label('delete')} ${material.title}`} onClick={() => void remove(material)}><Trash2 size={14} /></Button>
            </div>
          </div>
        ))}
      </div>
      {items.length < total && <div className="text-center"><Button variant="outline" disabled={loading} onClick={() => void load(page + 1)}>{label('loadMore')}</Button></div>}

      <Dialog open={articleOpen} onOpenChange={setArticleOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? label('editArticle') : label('newArticle')}</DialogTitle>
            <DialogDescription>{label('editDescription')}</DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-sm font-medium">
            {label('title')}
            <Input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            {label('body')}
            <Textarea value={body} onChange={event => setBody(event.target.value)} rows={14} className="resize-y" />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleOpen(false)}>{label('cancel')}</Button>
            <Button disabled={saving} onClick={() => void saveArticle()}>{saving ? label('saving') : label('saveDraft')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label('importLink')}</DialogTitle>
            <DialogDescription>{label('importDescription')}</DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-sm font-medium">
            {label('articleUrl')}
            <Input type="url" value={importUrl} onChange={(event) => { setImportUrl(event.target.value); setImported(null); setImportError('') }} placeholder="https://" />
          </label>
          <div className="flex justify-end"><Button variant="outline" disabled={!importUrl.trim() || importing} onClick={() => void extract()}>{importing ? label('extracting') : label('extractPreview')}</Button></div>
          {importError && <p role="alert" className="text-sm text-destructive">{importError}</p>}
          {imported && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <strong className="block text-sm">{imported.title}</strong>
              <p className="break-all text-xs text-muted-foreground">{imported.sourceUrl}</p>
              <p className="max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-6">{imported.body}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{label('rightsNote')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>{label('cancel')}</Button>
            <Button disabled={!imported || saving} onClick={() => void saveImported()}>{saving ? label('saving') : label('saveDraft')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateMaterialModal open={videoOpen} contentFirst groupId={planId} editingMaterial={videoEditing} onClose={() => setVideoOpen(false)} onSuccess={() => void load(1)} />

      {publishing && accounts.length === 0 && (
        <Dialog open onOpenChange={() => setPublishing(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{label('connectToPublish')}</DialogTitle>
              <DialogDescription>{label('connectDescription')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishing(null)}>{label('cancel')}</Button>
              <Button asChild><Link href="/channels">{label('connectChannel')}</Link></Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <PublishDialog open={!!publishing && accounts.length > 0} onClose={() => setPublishing(null)} accounts={accounts} defaultAccountIds={[]} materialGroupIdForPublish={planId} materialIdForPublish={publishing?.id} onPubSuccess={() => { setPublishing(null); void load(1) }} />
    </div>
  )
}
