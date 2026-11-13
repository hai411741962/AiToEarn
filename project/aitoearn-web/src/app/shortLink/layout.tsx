import { WechatBrowserOverlay } from '@/components/common/WechatBrowserOverlay'

export const metadata = {
  title: '一稿通',
  description: '一稿通 · 内容创作与多平台发布',
  icons: { icon: brandLogo.src },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WechatBrowserOverlay variant="standalone" />
        {children}
      </body>
    </html>
  )
}
import brandLogo from '@/assets/images/onegaotong-logo.png'
