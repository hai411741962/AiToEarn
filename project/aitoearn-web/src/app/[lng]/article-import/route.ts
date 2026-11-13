import { NextResponse } from 'next/server'
import { importArticle } from './article-import'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown }
    if (typeof body.url !== 'string' || body.url.length > 2048)
      return NextResponse.json({ error: '请输入文章链接' }, { status: 400 })
    const article = await importArticle(body.url.trim())
    return NextResponse.json(article, { headers: { 'cache-control': 'no-store' } })
  }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '文章导入失败' }, { status: 422 })
  }
}
