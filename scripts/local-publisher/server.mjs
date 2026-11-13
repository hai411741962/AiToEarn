import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from 'playwright'

const host = '127.0.0.1'
const port = Number(process.env.LOCAL_PUBLISHER_PORT || 8787)
const dataDir = resolve(process.env.LOCAL_PUBLISHER_DATA_DIR || join(process.cwd(), '.local-data'))
const accountsFile = join(dataDir, 'accounts.json')
const allowedOrigins = new Set(['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:8081', 'http://127.0.0.1:8081'])
const loginContexts = new Map()
const accountLocks = new Set()

async function readAccounts() {
  try {
    return JSON.parse(await readFile(accountsFile, 'utf8'))
  }
  catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function saveAccounts(accounts) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 })
  await writeFile(accountsFile, JSON.stringify(accounts, null, 2), { mode: 0o600 })
}

function profileDir(accountId) {
  return join(dataDir, 'profiles', accountId)
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function bodyJson(req) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 1_000_000) throw new Error('请求内容过大')
  }
  return JSON.parse(raw || '{}')
}

async function withAccountBrowser(accountId, headed, action) {
  if (accountLocks.has(accountId)) throw new Error('此账号正在执行另一项操作')
  accountLocks.add(accountId)
  try {
    const loginContext = loginContexts.get(accountId)
    if (loginContext) {
      await loginContext.close().catch(() => {})
      loginContexts.delete(accountId)
    }
    await mkdir(profileDir(accountId), { recursive: true, mode: 0o700 })
    const context = await chromium.launchPersistentContext(profileDir(accountId), {
      headless: !headed,
      executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
      viewport: { width: 1280, height: 900 },
      args: ['--no-sandbox'],
    })
    try {
      return await action(context)
    }
    finally {
      await context.close()
    }
  }
  finally {
    accountLocks.delete(accountId)
  }
}

async function getCsdnIdentity(page) {
  await page.goto('https://mp.csdn.net/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  if (!page.url().startsWith('https://mp.csdn.net/')) return null
  const body = await page.locator('body').innerText().catch(() => '')
  if (/登录后|请先登录|立即登录/.test(body)) return null
  const cookies = await page.context().cookies('https://www.csdn.net')
  return cookies.find(cookie => cookie.name === 'UserName')?.value || null
}

async function verifyAccount(account) {
  return withAccountBrowser(account.id, false, async (context) => {
    const page = context.pages()[0] || await context.newPage()
    const identity = await getCsdnIdentity(page)
    if (!identity) return { status: 'unverified' }
    if (account.identity && account.identity !== identity) return { status: 'mismatch', identity }
    const accounts = await readAccounts()
    if (accounts.some(item => item.id !== account.id && item.identity === identity)) return { status: 'duplicate', identity }
    const current = accounts.find(item => item.id === account.id)
    if (current) {
      current.identity = identity
      await saveAccounts(accounts)
    }
    return { status: 'connected', identity }
  })
}

async function publishToCsdn(account, title, body) {
  return withAccountBrowser(account.id, false, async (context) => {
    const page = context.pages()[0] || await context.newPage()
    const identity = await getCsdnIdentity(page)
    if (!identity || !account.identity || identity !== account.identity) {
      return { accountId: account.id, status: 'failed', message: '登录已失效或账号身份不匹配，请重新连接' }
    }
    await page.goto('https://mp.csdn.net/mp_blog/creation/editor', { waitUntil: 'domcontentloaded', timeout: 60000 })
    if (/passport\.csdn\.net\/login/.test(page.url())) return { accountId: account.id, status: 'failed', message: '登录已失效' }
    const titleField = page.locator('textarea#txtTitle, textarea[placeholder*="标题"], input[placeholder*="标题"]').first()
    await titleField.waitFor({ state: 'visible', timeout: 30000 })
    await titleField.fill(title)
    const editor = page.locator('[contenteditable="true"]:visible').first()
    if (await editor.count()) {
      await editor.fill(body)
    }
    else {
      await page.waitForFunction(() => Boolean(window.CKEDITOR?.instances?.editor), undefined, { timeout: 20000 })
      await page.evaluate((value) => {
        const escaped = value.split('\n').map(line => `<p>${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') || '<br>'}</p>`).join('')
        window.CKEDITOR.instances.editor.setData(escaped)
      }, body)
    }
    const submit = page.getByRole('button', { name: /^(发布|发表)(文章|博客)?$/ }).first()
    await submit.waitFor({ state: 'visible', timeout: 20000 })
    await submit.click()
    const confirm = page.getByRole('button', { name: /^(确认发布|确定发布|立即发布)$/ }).first()
    if (await confirm.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) await confirm.click()
    const successVisible = await page.getByText(/发布成功|发表成功/).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
    const articleLink = successVisible
      ? await page.locator('a[href*="blog.csdn.net/"][href*="/article/details/"]').first().getAttribute('href').catch(() => null)
      : null
    const currentUrl = page.url()
    const publishedUrl = articleLink || (/blog\.csdn\.net\/[^/]+\/article\/details\/\d+/.test(currentUrl) ? currentUrl : null)
    if (publishedUrl) return { accountId: account.id, status: 'published', url: new URL(publishedUrl, currentUrl).href }
    const visibleError = await page.locator('[role="alert"], .el-message--error').first().innerText().catch(() => '')
    if (visibleError) return { accountId: account.id, status: 'failed', message: visibleError.slice(0, 200) }
    return { accountId: account.id, status: 'submitted_unverified', message: '已点击提交，平台尚未返回可确认的文章链接，请在 CSDN 后台核实' }
  })
}

createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && !allowedOrigins.has(origin)) return send(res, 403, { error: '不允许的来源' })
  if (origin) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('access-control-allow-headers', 'content-type')
  }
  if (req.method === 'OPTIONS') return send(res, 200, {})
  try {
    const url = new URL(req.url, `http://${host}:${port}`)
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true })
    if (req.method === 'GET' && url.pathname === '/accounts') return send(res, 200, { accounts: await readAccounts() })
    if (req.method === 'POST' && url.pathname === '/accounts') {
      const { label } = await bodyJson(req)
      if (typeof label !== 'string' || !label.trim() || label.length > 40) return send(res, 400, { error: '账号备注需为 1–40 个字符' })
      const accounts = await readAccounts()
      if (accounts.some(item => item.label.toLowerCase() === label.trim().toLowerCase())) return send(res, 409, { error: '账号备注已存在' })
      const account = { id: randomUUID(), label: label.trim(), identity: null }
      accounts.push(account)
      await saveAccounts(accounts)
      return send(res, 201, { account })
    }
    const accountPath = url.pathname.match(/^\/accounts\/([a-f0-9-]{36})(?:\/(login|verify))?$/)
    if (accountPath) {
      const [, id, action] = accountPath
      const accounts = await readAccounts()
      const account = accounts.find(item => item.id === id)
      if (!account) return send(res, 404, { error: '账号不存在' })
      if (req.method === 'DELETE' && !action) {
        if (accountLocks.has(id)) return send(res, 409, { error: '账号正在使用' })
        const context = loginContexts.get(id)
        if (context) await context.close()
        loginContexts.delete(id)
        await rm(profileDir(id), { recursive: true, force: true })
        await saveAccounts(accounts.filter(item => item.id !== id))
        return send(res, 200, { ok: true })
      }
      if (req.method === 'POST' && action === 'login') {
        if (accountLocks.has(id)) return send(res, 409, { error: '账号正在使用' })
        const previous = loginContexts.get(id)
        if (previous) await previous.close()
        await mkdir(profileDir(id), { recursive: true, mode: 0o700 })
        const context = await chromium.launchPersistentContext(profileDir(id), {
          headless: false,
          executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
          args: ['--no-sandbox'],
        })
        loginContexts.set(id, context)
        const page = context.pages()[0] || await context.newPage()
        try {
          await page.goto('https://passport.csdn.net/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
        }
        catch (error) {
          await context.close()
          loginContexts.delete(id)
          throw error
        }
        return send(res, 200, { status: 'login_window_opened' })
      }
      if (req.method === 'POST' && action === 'verify') return send(res, 200, await verifyAccount(account))
    }
    if (req.method === 'POST' && url.pathname === '/publish') {
      const { accountIds, title, body } = await bodyJson(req)
      if (!Array.isArray(accountIds) || !accountIds.length || accountIds.length > 10 || new Set(accountIds).size !== accountIds.length) return send(res, 400, { error: '请选择 1–10 个不同账号' })
      if (typeof title !== 'string' || !title.trim() || title.length > 100 || typeof body !== 'string' || !body.trim() || body.length > 200000) return send(res, 400, { error: '请填写标题和正文' })
      const accounts = await readAccounts()
      const results = []
      const seenIdentities = new Set()
      for (const id of accountIds) {
        const account = accounts.find(item => item.id === id)
        if (!account) { results.push({ accountId: id, status: 'failed', message: '账号不存在' }); continue }
        if (!account.identity) { results.push({ accountId: id, status: 'failed', message: '请先登录并验证账号' }); continue }
        if (seenIdentities.has(account.identity)) { results.push({ accountId: id, status: 'failed', message: '同一 CSDN 账号不能重复发布' }); continue }
        seenIdentities.add(account.identity)
        try { results.push(await publishToCsdn(account, title, body)) }
        catch (error) { results.push({ accountId: id, status: 'failed', message: error.message }) }
      }
      return send(res, 200, { results })
    }
    return send(res, 404, { error: '接口不存在' })
  }
  catch (error) {
    return send(res, 500, { error: error.message || '服务错误' })
  }
}).listen(port, host, () => {
  process.stdout.write(`Local publisher listening on http://${host}:${port}\n`)
})
