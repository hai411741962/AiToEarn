/**
 * ManualPublishDialog - 各平台文章和视频的手动发布工作区。
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
import { CsdnAutoPublishPanel } from './CsdnAutoPublishPanel'

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

export const MANUAL_CHANNELS = {
  baijiahao: { url: 'https://baijiahao.baidu.com/' },
  csdn: { url: 'https://mp.csdn.net/' },
  zhihu: { url: 'https://www.zhihu.com/creator' },
} as const

export type ManualChannel = keyof typeof MANUAL_CHANNELS

interface ManualPublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: ManualChannel
}

export function ManualPublishDialog({ open, onOpenChange, platform }: ManualPublishDialogProps) {
  const { t } = useTransClient('account')
  const platformName = t(`channelManager.manualChannels.${platform}`)
  const storageKey = `aitoearn:${platform}-manual-draft`
  const common = (key: string) => t(`channelManager.manualPublish.${key}`, { platform: platformName })
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
      const saved = window.localStorage.getItem(storageKey)
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
  }, [storageKey])

  useEffect(() => {
    if (!ready) {
      return
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ mode, drafts }))
    }
    catch {
      // 存储不可用时不影响复制与手动发布。
    }
  }, [ready, mode, drafts, storageKey])

  const copyText = async (value: string) => {
    if (!value.trim()) {
      toast.warning(common('emptyContent'))
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      toast.success(common('copied'))
    }
    catch {
      toast.error(common('copyFailed'))
    }
  }

  const clearDraft = () => {
    setDrafts(previous => ({ ...previous, [mode]: { title: '', body: '' } }))
    setFiles([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-24px)] flex-col overflow-hidden sm:max-h-[90vh] sm:w-[min(680px,95vw)]" data-testid={`${platform}-manual-dialog`}>
        <DialogHeader>
          <DialogTitle>{common('title')}</DialogTitle>
          <DialogDescription>{common('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {platform === 'csdn' ? t('channelManager.csdnAuto.manualNotice') : common('manualNotice')}
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
                {common('article')}
              </TabsTrigger>
              <TabsTrigger value="video" className="flex-1 cursor-pointer">
                <FileVideo2 className="mr-2 h-4 w-4" />
                {common('video')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <label htmlFor={`${platform}-title`} className="text-sm font-medium text-foreground">
              {common('titleLabel')}
            </label>
            <Input
              id={`${platform}-title`}
              value={title}
              onChange={event => updateDraft('title', event.target.value)}
              placeholder={common('titlePlaceholder')}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={`${platform}-body`} className="text-sm font-medium text-foreground">
              {common(mode === 'article' ? 'bodyLabel' : 'videoDescriptionLabel')}
            </label>
            <Textarea
              id={`${platform}-body`}
              value={body}
              onChange={event => updateDraft('body', event.target.value)}
              placeholder={common('bodyPlaceholder')}
              className="min-h-36 resize-y"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={`${platform}-media`} className="text-sm font-medium text-foreground">
              {common(mode === 'article' ? 'images' : 'videoFile')}
            </label>
            <Input
              key={mode}
              id={`${platform}-media`}
              type="file"
              accept={mode === 'article' ? 'image/*' : 'video/*'}
              multiple={mode === 'article'}
              onChange={event => setFiles(Array.from(event.target.files || []))}
              className="cursor-pointer file:cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              {common('mediaNotice')}
            </p>
            {files.length > 0 && (
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {files.map(file => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}
              </ul>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {common('steps')}
          </p>
          {platform === 'csdn' && mode === 'article' && <CsdnAutoPublishPanel title={title} body={body} />}
        </DialogBody>

        <DialogFooter className="flex-wrap sm:justify-between">
          <Button variant="ghost" className="cursor-pointer" onClick={clearDraft}>
            <Trash2 className="mr-2 h-4 w-4" />
            {common('clear')}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => void copyText(title)}>
              <Copy className="mr-2 h-4 w-4" />
              {common('copyTitle')}
            </Button>
            <Button variant="outline" className="cursor-pointer" onClick={() => void copyText(body)}>
              <Copy className="mr-2 h-4 w-4" />
              {common('copyBody')}
            </Button>
            <Button className="cursor-pointer" onClick={() => window.open(MANUAL_CHANNELS[platform].url, '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {common('openOfficial')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
