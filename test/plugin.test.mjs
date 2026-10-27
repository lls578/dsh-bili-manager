/**
 * 插件级测试：模拟 Cordis 上下文，验证 apply() 注册的工具与写操作守卫。
 * 运行：node test/plugin.test.mjs
 * 说明：有凭据时会顺带跑一次只读 whoami/stats；CI 环境无凭据则跳过网络部分。
 */
import { apply } from '../index.js'
import { defaultCredentialPath } from '../lib/bili.mjs'
import { existsSync } from 'node:fs'

const registered = []
const ctx = {
  tools: { register: (t) => { registered.push(t); return t } },
  logger: { info: () => {} },
}
apply(ctx, { credentialPath: '', enableWrite: false, maxWritesPerSession: 2 })

const names = registered.map((t) => t.name).sort()
const expect = ['bili_manage_danmaku', 'bili_manage_pin', 'bili_manage_reply', 'bili_manage_stats', 'bili_manage_whoami']
console.log('[test] registered tools:', names.join(', '))
for (const n of expect) {
  if (!names.includes(n)) throw new Error(`missing tool: ${n}`)
}
if (names.length !== expect.length) throw new Error(`unexpected tool count: ${names.length}`)

// 写操作守卫：enableWrite=false 时应直接拒绝且不读凭据
const reply = await registered.find((t) => t.name === 'bili_manage_reply').execute({ bvid: 'BV1mnH56rEKJ', text: 'x' })
if (!reply || reply.blocked !== true) throw new Error('write guard failed: reply should be blocked')
console.log('[test] write guard ok:', JSON.stringify(reply).slice(0, 80))

const pin = await registered.find((t) => t.name === 'bili_manage_pin').execute({ bvid: 'BV1mnH56rEKJ', rpid: 1 })
if (!pin.blocked) throw new Error('write guard failed: pin should be blocked')
console.log('[test] pin guard ok')

// 参数 schema 检查（含 additionalProperties: false）
for (const t of registered) {
  const p = t.parameters
  if (!p || p.type !== 'object' || p.additionalProperties !== false) {
    throw new Error(`bad parameters schema for ${t.name}`)
  }
}
console.log('[test] parameters schema ok')

// 只读网络部分（有凭据才跑）
if (existsSync(defaultCredentialPath())) {
  const who = await registered.find((t) => t.name === 'bili_manage_whoami').execute({})
  if (!who.ok) throw new Error('whoami failed: ' + JSON.stringify(who).slice(0, 200))
  console.log('[test] whoami ok:', who.uname)
  const stats = await registered.find((t) => t.name === 'bili_manage_stats').execute({ days: 2 })
  if (!stats.ok) throw new Error('stats failed: ' + JSON.stringify(stats).slice(0, 200))
  console.log('[test] stats ok: totals.total_click =', stats.totals?.total_click)
} else {
  console.log('[test] no credential, skip network checks')
}

console.log('[test] ✅ all passed')
