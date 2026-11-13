/**
 * BaijiahaoManualDialog - 百家号文章和视频的手动发布工作区。
 * 在未取得百家号接口发文权限时，保留稿件并引导用户到官方后台完成提交。
 */

'use client'

import { Copy, ExternalLink, FileImage, FileVideo2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTransClient } from '@/app/i18n/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/utils/ui/toast'

type ContentMode = 'article' | 'video'

interface ManualDraft {
  title: string
  body: string
}

type ManualDrafts = Record<ContentMode, ManualDraft>

function emptyDrafts(): ManualDrafts {
  return {
    article: { title: '', body: '' },
    video: { title: '', body: '' },
  }
}

const DRAFT_STORAGE_KEY = 'aitoearn:baijiahao-manual-draft'
const BAIJIAHAO_URL = 'https://baijiahao.baidu.com/'

interface BaijiahaoManualDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BaijiahaoManualDialog({ open, onOpenChange }: BaijiahaoManualDialogProps) {
  const { t } = useTransClient('account')
  const [mode, setMode] = useState<ContentMode>('article')
  const [drafts, setDrafts] = useState<ManualDrafts>(emptyDrafts)
  const [files, setFiles] = useState<File[]>([])
  const [ready, setReady] = useState(false)
  const { title, body } = drafts[mode]

  const updateDraft = (field: keyof ManualDraft, value: string) => {
    setDrafts(previous => ({
      ...previous,
      [mode]: { ...previous[mode], [field]: value },
    }))
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY)
      if (saved) {
        const savedDraft: { mode?: ContentMode, drafts?: Partial<ManualDrafts> } = JSON.parse(saved)
        if (savedDraft.mode === 'article' || savedDraft.mode === 'video') {
          setMode(savedDraft.mode)
        }
        if (savedDraft.drafts) {
          setDrafts({
            article: {
              title: typeof savedDraft.drafts.article?.title === 'string' ? savedDraft.drafts.article.title : '',
              body: typeof savedDraft.drafts.article?.body === 'string' ? savedDraft.drafts.article.body : '',
            },
            video: {
              title: typeof savedDraft.drafts.video?.title === 'string' ? savedDraft.drafts.video.title : '',
              body: typeof savedDraft.drafts.video?.body === 'string' ? savedDraft.drafts.video.body : '',
            },
          })
        }
      }
    }
    catch {
      // 浏览器禁用本地存储时仍允许编辑当前稿件。
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) {
      return
    }
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ mode, drafts }))
    }
    catch {
      // 存储不可用时不影响复制与手动发布。
    }
  }, [ready, mode, drafts])

  const copyText = async (value: string) => {
    if (!value.trim()) {
      toast.warning(t('channelManager.baijiahao.emptyContent'))
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t('channelManager.baijiahao.copied'))
    }
    catch {
      toast.error(t('channelManager.baijiahao.copyFailed'))
    }
  }

  const clearDraft = () => {
    setDrafts(previous => ({ ...previous, [mode]: { title: '', body: '' } }))
    setFiles([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-24px)] flex-col overflow-hidden sm:max-h-[90vh] sm:w-[min(680px,95vw)]" data-testid="baijiahao-manual-dialog">
        <DialogHeader>
          <DialogTitle>{t('channelManager.baijiahao.title')}</DialogTitle>
          <DialogDescription>{t('channelManager.baijiahao.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {t('channelManager.baijiahao.manualNotice')}
          </div>

          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as ContentMode)
              setFiles([])
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="article" className="flex-1 cursor-pointer">
                <FileImage className="mr-2 h-4 w-4" />
                {t('channelManager.baijiahao.article')}
              </TabsTrigger>
              <TabsTrigger value="video" className="flex-1 cursor-pointer">
                <FileVideo2 className="mr-2 h-4 w-4" />
                {t('channelManager.baijiahao.video')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <label htmlFor="baijiahao-title" className="text-sm font-medium text-foreground">
              {t('channelManager.baijiahao.titleLabel')}
            </label>
            <Input
              id="baijiahao-title"
              value={title}
              onChange={event => updateDraft('title', event.target.value)}
              placeholder={t('channelManager.baijiahao.titlePlaceholder')}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="baijiahao-body" className="text-sm font-medium text-foreground">
              {t(mode === 'article' ? 'channelManager.baijiahao.bodyLabel' : 'channelManager.baijiahao.videoDescriptionLabel')}
            </label>
            <Textarea
              id="baijiahao-body"
              value={body}
              onChange={event => updateDraft('body', event.target.value)}
              placeholder={t('channelManager.baijiahao.bodyPlaceholder')}
              className="min-h-36 resize-y"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="baijiahao-media" className="text-sm font-medium text-foreground">
              {t(mode === 'article' ? 'channelManager.baijiahao.images' : 'channelManager.baijiahao.videoFile')}
            </label>
            <Input
              key={mode}
              id="baijiahao-media"
              type="file"
              accept={mode === 'article' ? 'image/*' : 'video/*'}
              multiple={mode === 'article'}
              onChange={event => setFiles(Array.from(event.target.files || []))}
              className="cursor-pointer file:cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              {t('channelManager.baijiahao.mediaNotice')}
            </p>
            {files.length > 0 && (
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {files.map(file => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}
              </ul>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {t('channelManager.baijiahao.steps')}
          </p>
        </DialogBody>

        <DialogFooter className="flex-wrap sm:justify-between">
          <Button variant="ghost" className="cursor-pointer" onClick={clearDraft}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('channelManager.baijiahao.clear')}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => void copyText(title)}>
              <Copy className="mr-2 h-4 w-4" />
              {t('channelManager.baijiahao.copyTitle')}
            </Button>
            <Button variant="outline" className="cursor-pointer" onClick={() => void copyText(body)}>
              <Copy className="mr-2 h-4 w-4" />
              {t('channelManager.baijiahao.copyBody')}
            </Button>
            <Button className="cursor-pointer" onClick={() => window.open(BAIJIAHAO_URL, '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('channelManager.baijiahao.openOfficial')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
