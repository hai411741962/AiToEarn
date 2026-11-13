import { Buffer } from 'node:buffer'
import * as dns from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import * as cheerio from 'cheerio'

const MAX_BYTES = 2_000_000
const MAX_REDIRECTS = 3

function publicIpv4(value: string) {
  if (isIP(value) !== 4)
    return false
  const [a, b, c] = value.split('.').map(Number)
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113)
  )
}

function validUrl(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(url.hostname) || !url.hostname.includes('.') || url.hostname.endsWith('.local'))
    throw new Error('请输入可公开访问的 HTTPS 文章链接')
  return url
}

async function resolvePublicIp(hostname: string) {
  const addresses = await dns.resolve4(hostname).catch(() => [])
  let publicAddress = addresses.find(publicIpv4)
  // 某些本机网络把公网域名映射到 198.18/15；只在这种情况下使用公共 DNS 查询。
  if (!publicAddress && addresses.some(address => address.startsWith('198.18.') || address.startsWith('198.19.'))) {
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    const data = await response.json() as { Answer?: Array<{ type: number, data: string }> }
    publicAddress = data.Answer?.find(answer => answer.type === 1 && publicIpv4(answer.data))?.data
  }
  if (!publicAddress)
    throw new Error('链接域名无法解析到公网地址')
  return publicAddress
}

async function downloadHtml(url: URL, redirects = 0): Promise<{ html: string, url: URL }> {
  if (redirects > MAX_REDIRECTS)
    throw new Error('文章链接跳转次数过多')
  const address = await resolvePublicIp(url.hostname)
  const response = await new Promise<{ status: number, headers: Record<string, string | string[] | undefined>, html: string }>((resolve, reject) => {
    const req = request(url, {
      lookup: (_hostname, options, callback) => {
        if (options.all)
          callback(null, [{ address, family: 4 }])
        else
          callback(null, address, 4)
      },
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AiToEarnArticleImporter/1.0)',
        'accept': 'text/html,application/xhtml+xml',
        'accept-encoding': 'identity',
      },
      timeout: 12000,
    }, (res) => {
      const chunks: Buffer[] = []
      let total = 0
      res.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > MAX_BYTES) {
          req.destroy(new Error('文章页面超过 2 MB，无法导入'))
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        headers: res.headers,
        html: Buffer.concat(chunks).toString('utf8'),
      }))
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('获取文章超时')))
    req.on('error', reject)
    req.end()
  })
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.location
    if (typeof location !== 'string')
      throw new Error('文章跳转地址无效')
    return downloadHtml(validUrl(new URL(location, url).href), redirects + 1)
  }
  if (response.status !== 200)
    throw new Error(`来源网站拒绝读取文章（${response.status}）`)
  if (!String(response.headers['content-type'] || '').includes('html'))
    throw new Error('该链接不是网页文章')
  return { html: response.html, url }
}

function normalizedText(value: string) {
  return value.replace(/\u00A0/g, ' ').replace(/[\t ]+/g, ' ').replace(/\n\s+/g, '\n').trim()
}

export function extractArticle(html: string, url: URL) {
  const $ = cheerio.load(html)
  const title = normalizedText($('meta[property="og:title"]').attr('content') || $('h1').first().text() || $('title').text())
  $('script, style, nav, header, footer, aside, form, button, .advertisement, .ads').remove()
  const candidates = ['[itemprop="articleBody"]', '#content_views', '.article_content', 'article', 'main']
  const content = candidates.map(selector => $(selector).first()).find(item => normalizedText(item.text()).length >= 30) || $('body')
  const lines: string[] = []
  content.find('h2, h3, h4, p, li, blockquote, pre, img').each((_index, node) => {
    if (node.type !== 'tag')
      return
    if (node.name === 'img') {
      const src = $(node).attr('data-src') || $(node).attr('src')
      if (src) {
        try {
          const absolute = new URL(src, url)
          if (absolute.protocol === 'https:')
            lines.push(`[图片] ${absolute.href}`)
        }
        catch { /* 忽略页面中无效的图片地址。 */ }
      }
    }
    else {
      const text = normalizedText($(node).text())
      if (text)
        lines.push(text)
    }
  })
  const body = normalizedText(lines.join('\n\n') || content.text()).slice(0, 100_000)
  if (!title || body.length < 30)
    throw new Error('未能提取文章正文，请确认链接可公开访问')
  return { title: title.slice(0, 200), body, sourceUrl: url.href }
}

export async function importArticle(raw: string) {
  const url = validUrl(raw)
  const page = await downloadHtml(url)
  return extractArticle(page.html, page.url)
}
