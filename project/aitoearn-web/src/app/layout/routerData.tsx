/**
 * 路由/导航数据配置
 * 包含开源版保留导航项的图标、路径、翻译键等信息。
 */

import {
  CalendarDays,
  FileText,
  History,
  LayoutDashboard,
  Tv,
} from 'lucide-react'

export interface IRouterDataItem {
  // 导航标题
  name: string
  // 翻译键
  translationKey: string
  // 跳转链接
  path?: string
  // 图标
  icon?: React.ReactNode
  // 子导航
  children?: IRouterDataItem[]
}

export const routerData: IRouterDataItem[] = [
  {
    name: 'Workspace',
    translationKey: 'workspace',
    path: '/',
    icon: <LayoutDashboard size={20} />,
  },
  {
    name: 'Content',
    translationKey: 'content',
    path: '/draft-box',
    icon: <FileText size={20} />,
  },
  {
    name: 'Channels',
    translationKey: 'channels',
    path: '/channels',
    icon: <Tv size={20} />,
  },
  {
    name: 'Schedule',
    translationKey: 'schedule',
    path: '/schedule',
    icon: <CalendarDays size={20} />,
  },
  {
    name: 'Results',
    translationKey: 'results',
    path: '/results',
    icon: <History size={20} />,
  },
]

export const visibleRouterData = routerData
