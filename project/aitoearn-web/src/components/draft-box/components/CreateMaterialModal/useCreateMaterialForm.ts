import type { MaterialValidationIssue } from './useMaterialValidation'
import type { MaterialMedia } from '@/api/_shared/material.types'
import type { PromotionMaterial } from '@/api/materials/material.types'
/**
 * useCreateMaterialForm - 创建/编辑素材表单逻辑 Hook
 * 从 CreateMaterialModalContent 中提取的共享表单逻辑，供桌面端和移动端组件复用
 */
import type { PlatType } from '@/app/config/platConfig'
import type { IImgFile, IVideoFile } from '@/components/PublishDialog/publishDialog.type'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { apiCreateMaterial, apiUpdateMaterial } from '@/api/materials/material.api'
import { PubType } from '@/app/config/publishConfig'
import { UploadTaskStatusEnum } from '@/components/PublishDialog/compoents/PublishManageUpload/publishManageUpload.enum'
import { usePublishManageUpload } from '@/components/PublishDialog/compoents/PublishManageUpload/usePublishManageUpload'
import { isPublishTitleSupported } from '@/components/PublishDialog/PublishDialog.util'
import { usePlatformMetadata } from '@/hooks/usePlatformMetadata'
import { getTaskPlatformInfos } from '@/store/platformMetadata/utils'
import { toast } from '@/utils/ui/toast'
import { UNLIMITED_PLATFORM_MAX_USE_COUNT } from '../../utils/materialUseCount'
import { getMaterialValidationIssues } from './useMaterialValidation'
import { appendMaterialTopicsToDescription } from './utils'

export interface FormParams {
  title: string
  des: string
  images: IImgFile[]
  video?: IVideoFile
  selectedPlatforms: PlatType[]
}

export interface UseCreateMaterialFormProps {
  groupId: string | null
  contentFirst?: boolean
  editingMaterial?: PromotionMaterial | null
  isSubmitting?: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function useCreateMaterialForm({
  groupId,
  editingMaterial,
  isSubmitting: externalSubmitting,
  contentFirst = false,
  onClose,
  onSuccess,
}: UseCreateMaterialFormProps) {
  const { t } = useTranslation('brandPromotion')
  const [submitting, setSubmitting] = useState(false)
  const [validationIssues, setValidationIssues] = useState<MaterialValidationIssue[]>([])
  const { list: platformList } = usePlatformMetadata()

  // 获取上传任务状态
  const { tasks, md5Cache, cancelUpload } = usePublishManageUpload(
    useShallow(state => ({
      tasks: state.tasks,
      md5Cache: state.md5Cache,
      cancelUpload: state.cancelUpload,
    })),
  )

  // 默认全选平台
  const defaultPlatforms = useMemo(
    () => contentFirst ? [] : getTaskPlatformInfos(platformList).map(platform => platform.type),
    [contentFirst, platformList],
  )
  const defaultPlatformsAppliedRef = useRef(false)
  const initializedMaterialIdRef = useRef<string | null | undefined>(undefined)

  // 表单参数
  const [params, setParams] = useState<FormParams>({
    title: '',
    des: '',
    images: [],
    video: undefined,
    selectedPlatforms: defaultPlatforms,
  })

  const isEditing = !!editingMaterial

  useEffect(() => {
    if (defaultPlatformsAppliedRef.current || defaultPlatforms.length === 0)
      return

    defaultPlatformsAppliedRef.current = true
    setParams((prev) => {
      if (prev.selectedPlatforms.length > 0)
        return prev
      return { ...prev, selectedPlatforms: defaultPlatforms }
    })
  }, [defaultPlatforms])

  // 初始化 - 如果是编辑模式，填充已有数据
  useEffect(() => {
    const materialId = editingMaterial?.id ?? null
    if (initializedMaterialIdRef.current === materialId)
      return
    initializedMaterialIdRef.current = materialId

    if (editingMaterial) {
      const images: IImgFile[]
        = editingMaterial.mediaList
          ?.filter(m => m.type === 'img')
          .map((m, index) => ({
            id: `edit-img-${index}`,
            size: 0,
            file: new File([], ''),
            imgUrl: m.url,
            filename: '',
            imgPath: '',
            width: 0,
            height: 0,
            ossUrl: m.url,
          })) || []

      const videoMedia = editingMaterial.mediaList?.find(m => m.type === 'video')
      const video: IVideoFile | undefined = videoMedia
        ? {
            size: 0,
            file: new Blob(),
            videoUrl: videoMedia.url,
            ossUrl: videoMedia.url,
            filename: '',
            width: 0,
            height: 0,
            duration: 0,
            cover: {
              id: 'edit-cover',
              size: 0,
              file: new File([], ''),
              imgUrl: editingMaterial.coverUrl || videoMedia.url,
              filename: '',
              imgPath: '',
              width: 0,
              height: 0,
              ossUrl: editingMaterial.coverUrl,
            },
          }
        : undefined

      setParams({
        title: editingMaterial.title || '',
        des: appendMaterialTopicsToDescription(editingMaterial.desc || '', editingMaterial.topics),
        video,
        images,
        selectedPlatforms: contentFirst ? [] : editingMaterial.accountTypes?.length
          ? (editingMaterial.accountTypes as PlatType[])
          : defaultPlatforms,
      })
    }
    else {
      setParams({
        title: '',
        des: '',
        images: [],
        video: undefined,
        selectedPlatforms: defaultPlatforms,
      })
    }
  }, [contentFirst, editingMaterial, defaultPlatforms])

  // 更新参数
  const updateParams = useCallback((updates: Partial<FormParams>) => {
    setParams(prev => ({ ...prev, ...updates }))
    setValidationIssues([])
  }, [])

  // 函数式更新图片列表（避免闭包陷值）
  const updateImages = useCallback((updater: (prev: IImgFile[]) => IImgFile[]) => {
    setParams(prev => ({ ...prev, images: updater(prev.images) }))
    setValidationIssues([])
  }, [])

  // 函数式更新视频（避免闭包陷值）
  const updateVideo = useCallback(
    (updater: (prev: IVideoFile | undefined) => IVideoFile | undefined) => {
      setParams(prev => ({ ...prev, video: updater(prev.video) }))
      setValidationIssues([])
    },
    [],
  )

  // 同步上传结果到 params
  useEffect(() => {
    // 上传状态变化可能与用户继续编辑或删除视频同时发生。只基于最新表单状态
    // 补齐当前任务的 URL，避免旧 render 的快照把新视频覆盖掉。
    setParams((prev) => {
      let hasChanges = false
      const images = prev.images.map((img) => {
        if (!img.ossUrl && img.uploadTaskId) {
          const task = tasks[img.uploadTaskId]
          const ossUrl = task?.md5 ? md5Cache[task.md5]?.ossUrl : undefined
          if (ossUrl) {
            hasChanges = true
            return { ...img, ossUrl }
          }
        }
        return img
      })

      let video = prev.video
      if (video?.uploadTaskIds?.video && !video.ossUrl) {
        const task = tasks[video.uploadTaskIds.video]
        const ossUrl = task?.md5 ? md5Cache[task.md5]?.ossUrl : undefined
        if (ossUrl) {
          hasChanges = true
          video = { ...video, ossUrl }
        }
      }
      if (video?.uploadTaskIds?.cover && !video.cover?.ossUrl) {
        const task = tasks[video.uploadTaskIds.cover]
        const ossUrl = task?.md5 ? md5Cache[task.md5]?.ossUrl : undefined
        if (ossUrl) {
          hasChanges = true
          video = { ...video, cover: { ...video.cover, ossUrl } }
        }
      }

      return hasChanges ? { ...prev, images, video } : prev
    })
  }, [tasks, md5Cache, params.images, params.video])

  // 检查是否有正在上传的任务
  const isUploading = useMemo(() => {
    const uploadingStatuses = [
      UploadTaskStatusEnum.Hashing,
      UploadTaskStatusEnum.Pending,
      UploadTaskStatusEnum.Uploading,
    ]

    for (const img of params.images) {
      if (img.uploadTaskId && tasks[img.uploadTaskId]) {
        if (uploadingStatuses.includes(tasks[img.uploadTaskId].status)) {
          return true
        }
      }
    }

    if (params.video?.uploadTaskIds) {
      const { video, cover } = params.video.uploadTaskIds
      if (video && tasks[video] && uploadingStatuses.includes(tasks[video].status)) {
        return true
      }
      if (cover && tasks[cover] && uploadingStatuses.includes(tasks[cover].status)) {
        return true
      }
    }

    return false
  }, [params.images, params.video, tasks])

  // 提交处理
  const handleSubmit = useCallback(async () => {
    if (!groupId) {
      toast.error(t('createMaterial.selectPlanFirst'))
      return
    }

    if ((contentFirst || params.selectedPlatforms.some(isPublishTitleSupported)) && !params.title.trim()) {
      toast.error(t('createMaterial.titleRequired'))
      return
    }

    if (!params.des.trim()) {
      toast.error(t('createMaterial.descRequired'))
      return
    }

    const hasVideo = !!params.video?.ossUrl
    const hasImages
      = params.images && params.images.length > 0 && params.images.some(img => img.ossUrl)

    if (contentFirst && !hasVideo) {
      toast.error(t('createMaterial.pleaseUploadMedia'))
      return
    }

    if (!hasVideo && !hasImages) {
      toast.error(t('createMaterial.pleaseUploadMedia'))
      return
    }

    const issues = getMaterialValidationIssues(params, params.selectedPlatforms, t)

    if (issues.length > 0) {
      setValidationIssues(issues)
      return
    }

    setValidationIssues([])

    setSubmitting(true)

    try {
      const mediaList: MaterialMedia[] = []

      if (hasVideo && params.video?.ossUrl) {
        mediaList.push({ url: params.video.ossUrl, type: 'video' })
      }

      if (hasImages && params.images) {
        params.images.forEach((img) => {
          if (img.ossUrl) {
            mediaList.push({ url: img.ossUrl, type: 'img' })
          }
        })
      }

      let coverUrl: string | undefined
      if (hasVideo && params.video?.cover?.ossUrl) {
        coverUrl = params.video.cover.ossUrl
      }
      else if (hasImages && params.images?.[0]?.ossUrl) {
        coverUrl = params.images[0].ossUrl
      }

      const type = hasVideo ? PubType.VIDEO : PubType.ImageText
      const maxUseCountByAccountType = params.selectedPlatforms.reduce<
        Partial<Record<PlatType, number>>
      >((result, platform) => {
        result[platform] = UNLIMITED_PLATFORM_MAX_USE_COUNT
        return result
      }, {})

      const materialData = {
        groupId,
        coverUrl,
        mediaList,
        title: params.title.trim(),
        desc: params.des.trim(),
        type,
        accountTypes: params.selectedPlatforms,
        maxUseCountByAccountType,
      }

      if (isEditing && editingMaterial?.id) {
        const res = await apiUpdateMaterial(editingMaterial.id, {
          coverUrl: materialData.coverUrl,
          mediaList: materialData.mediaList,
          title: materialData.title,
          desc: materialData.desc,
          topics: [],
          accountTypes: materialData.accountTypes,
          maxUseCountByAccountType: materialData.maxUseCountByAccountType,
        })
        if (res?.code !== 0) {
          toast.error(res?.message || t('createMaterial.createFailed'))
          return
        }
        toast.success(t('createMaterial.createSuccess'))
      }
      else {
        const res = await apiCreateMaterial(materialData)
        if (res?.code !== 0) {
          toast.error(res?.message || t('createMaterial.createFailed'))
          return
        }
        toast.success(t('createMaterial.createSuccess'))
      }

      onSuccess?.()
      onClose()
    }
    catch {
      toast.error(t('createMaterial.createFailed'))
    }
    finally {
      setSubmitting(false)
    }
  }, [groupId, params, isEditing, editingMaterial, onSuccess, onClose, t])

  const isFormSubmitting = submitting || externalSubmitting || isUploading

  return {
    params,
    updateParams,
    updateImages,
    updateVideo,
    validationIssues,
    isSubmitting: isFormSubmitting,
    handleSubmit,
    cancelUpload,
  }
}
