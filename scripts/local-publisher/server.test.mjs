import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('isolates account records and rejects unverified publishing', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'aitoearn-publisher-test-'))
  const port = 20000 + Math.floor(Math.random() * 30000)
  const base = `http://127.0.0.1:${port}`
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: import.meta.dirname,
    env: { ...process.env, LOCAL_PUBLISHER_PORT: String(port), LOCAL_PUBLISHER_DATA_DIR: dataDir },
    stdio: 'ignore',
  })
  try {
    let ready = false
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const response = await fetch(`${base}/health`)
        ready = response.ok
        if (ready) break
      }
      catch { /* Service is starting. */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(ready, true)

    const headers = { origin: 'http://localhost:8080', 'content-type': 'application/json' }
    const create = label => fetch(`${base}/accounts`, { method: 'POST', headers, body: JSON.stringify({ label }) })
    const first = await (await create('Account A')).json()
    const second = await (await create('Account B')).json()
    assert.notEqual(first.account.id, second.account.id)
    assert.equal((await create('ACCOUNT A')).status, 409)
    assert.equal((await fetch(`${base}/accounts`, { headers: { origin: 'https://example.com' } })).status, 403)

    const published = await (await fetch(`${base}/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountIds: [first.account.id, second.account.id], title: 'Test', body: 'Body' }),
    })).json()
    assert.deepEqual(published.results.map(result => result.status), ['failed', 'failed'])

    assert.equal((await fetch(`${base}/accounts/${first.account.id}`, { method: 'DELETE', headers })).status, 200)
    const remaining = await (await fetch(`${base}/accounts`, { headers })).json()
    assert.deepEqual(remaining.accounts.map(account => account.id), [second.account.id])
  }
  finally {
    server.kill('SIGTERM')
    await rm(dataDir, { recursive: true, force: true })
  }
})
