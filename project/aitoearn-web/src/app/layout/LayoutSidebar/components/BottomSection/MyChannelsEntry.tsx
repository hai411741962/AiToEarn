/**
 * MyChannelsEntry - 我的频道入口组件
 */

'use client'

import type { SidebarCommonProps } from '../../types'
import { Tv } from 'lucide-react'
import { useTransClient } from '@/app/i18n/client'
import { useChannelManagerStore } from '@/components/ChannelManager'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/utils/className'

export function MyChannelsEntry({ collapsed }: SidebarCommonProps) {
  const { t } = useTransClient('account')
  const openModal = useChannelManagerStore(state => state.openModal)

  const handleClick = () => {
    openModal()
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            data-testid="sidebar-my-channels"
            className={cn(
              'flex w-full cursor-pointer items-center rounded-xl text-muted-foreground transition-colors hover:bg-brand-cyan/10 hover:text-brand-cyan',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
            )}
          >
            <Tv size={20} className="shrink-0 text-brand-cyan" />
            {!collapsed && (
              <>
                <span className="shrink-0 tabular-nums text-xs" aria-hidden="true">01</span>
                <span className="truncate text-sm font-medium">{t('channelManager.myChannels')}</span>
              </>
            )}
          </button>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent side="right">
            <p>{`01 · ${t('channelManager.myChannels')}`}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}
