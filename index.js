/**
 * dsh-bili-manager —— DSH 插件：B站 账号运营工具箱
 * ============================================================================
 * 给「养鱼号/UP 主」用的 host 半端插件（无前端）：
 *   · bili_manage_whoami   看当前登录账号
 *   · bili_manage_stats    读创作中心数据（总览/播放来源/粉丝分布/趋势）
 *   · bili_manage_reply    发评论 / 回复评论
 *   · bili_manage_pin      置顶 / 取消置顶评论
 *   · bili_manage_danmaku  发弹幕
 *
 * 设计原则：
 *   1. 凭据只从本地文件读（默认 ~/.dsh/bili-main/credentials.json），不写任何日志
 *   2. 写操作必须显式开启 enableWrite（默认关）—— 防止模型误操作账号
 *   3. 所有工具输出可无损 JSON，失败返回结构化错误
 * ============================================================================
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defaultCredentialPath, loadCredential } from './lib/bili.mjs'

// ───── 宿主依赖（schemastery / dsh-tools），拿不到就降级 ─────
let z = null
let defineTool = null
try {
  const zm = await import('@deepseek-ai/schemastery')
  z = zm.default ?? zm
} catch { /* 没有 Config 也能跑 */ }
try {
  const dt = await import('@deepseek-ai/dsh-tools')
  defineTool = dt.defineTool
} catch { /* 用本地等价实现 */ }
if (!defineTool) defineTool = (o) => o

export const name = 'bili-manager'
export const inject = ['tools']

export const Config = !z ? undefined : z.object({
  /** 凭据文件路径（留空用默认 ~/.dsh/bili-main/credentials.json） */
  credentialPath: z.string().default('').extra('volatile', true),
  /** 允许写操作（发评论/弹幕/动态）。默认关：关着时写工具直接拒绝 */
  enableWrite: z.boolean().default(false).extra('volatile', true),
  /** 单次会话写操作上限（防误触刷屏） */
  maxWritesPerSession: z.natural().default(10).extra('volatile', true),
})

const SAFE = (v) => {
  if (v === undefined || v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  try { return JSON.parse(JSON.stringify(v)) } catch { return String(v) }
}

const TEXT_OUTPUT = {
  schema: { type: 'object', properties: {}, additionalProperties: true },
  render: (_args, value) => [{
    type: 'text',
    text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  }],
}

export function apply(ctx, config) {
  const credPath = () => (config && config.credentialPath) || defaultCredentialPath()
  let writes = 0

  const writeGuard = () => {
    if (config && config.enableWrite !== true) {
      return { ok: false, blocked: true, hint: '写操作没开：在插件设置里打开「enableWrite」，或 profile patch 里写 config.enableWrite: true' }
    }
    const max = (config && config.maxWritesPerSession) || 10
    if (writes >= max) {
      return { ok: false, blocked: true, hint: `本次会话写操作已达上限 ${max} 条，重启会话或调大 maxWritesPerSession` }
    }
    writes += 1
    return null
  }

  const tool = (spec) => ctx.tools.register(defineTool({
    ...spec,
    output: TEXT_OUTPUT,
    async execute(args, exec) {
      try {
        return SAFE(await spec.execute(args || {}, exec))
      } catch (e) {
        return { ok: false, error: `${e?.name || 'Error'}: ${String(e?.message || e).slice(0, 300)}` }
      }
    },
  }))

  const withCred = (fn) => {
    const cred = loadCredential(credPath())
    return fn(cred)
  }

  tool({
    name: 'bili_manage_whoami',
    description: '看 B站 当前登录的是谁（校验凭据是否有效）。只读。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    async execute() {
      const { whoami } = await import('./lib/bili.mjs')
      return withCred((cred) => whoami(cred))
    },
  })

  tool({
    name: 'bili_manage_stats',
    description: '读 B站 创作中心数据：账号总览、播放来源、粉丝/路人分布、稿件增量、玩法趋势。只读。',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: '趋势取多少天（默认 7，最大 30）' },
      },
      additionalProperties: false,
    },
    async execute(args) {
      const { creatorStats } = await import('./lib/bili.mjs')
      const days = Math.min(30, Math.max(1, Number(args.days) || 7))
      return withCred((cred) => creatorStats(cred, days))
    },
  })

  tool({
    name: 'bili_manage_reply',
    description: '以当前账号发评论，或回复某条评论（需 enableWrite）。回复时传 rpid。',
    parameters: {
      type: 'object',
      properties: {
        bvid: { type: 'string', description: '视频 BV 号' },
        text: { type: 'string', description: '评论内容' },
        rpid: { type: 'number', description: '要回复的评论 rpid（发新评论不传）' },
      },
      required: ['bvid', 'text'],
      additionalProperties: false,
    },
    async execute(args) {
      const blocked = writeGuard()
      if (blocked) return blocked
      const { sendComment } = await import('./lib/bili.mjs')
      return withCred((cred) => sendComment(cred, {
        bvid: String(args.bvid || ''),
        text: String(args.text || ''),
        rpid: Number(args.rpid) || 0,
      }))
    },
  })

  tool({
    name: 'bili_manage_pin',
    description: '置顶 / 取消置顶一条一级评论（需 enableWrite）。',
    parameters: {
      type: 'object',
      properties: {
        bvid: { type: 'string', description: '视频 BV 号' },
        rpid: { type: 'number', description: '评论 rpid' },
        on: { type: 'boolean', description: 'true=置顶（默认），false=取消' },
      },
      required: ['bvid', 'rpid'],
      additionalProperties: false,
    },
    async execute(args) {
      const blocked = writeGuard()
      if (blocked) return blocked
      const { pinComment } = await import('./lib/bili.mjs')
      return withCred((cred) => pinComment(cred, {
        bvid: String(args.bvid || ''),
        rpid: Number(args.rpid),
        on: args.on !== false,
      }))
    },
  })

  tool({
    name: 'bili_manage_danmaku',
    description: '发弹幕（需 enableWrite）。progress 单位毫秒，默认第 5 秒。',
    parameters: {
      type: 'object',
      properties: {
        bvid: { type: 'string', description: '视频 BV 号' },
        msg: { type: 'string', description: '弹幕内容（短一点）' },
        progressMs: { type: 'number', description: '出现时间（毫秒，默认 5000）' },
      },
      required: ['bvid', 'msg'],
      additionalProperties: false,
    },
    async execute(args) {
      const blocked = writeGuard()
      if (blocked) return blocked
      const { sendDanmaku } = await import('./lib/bili.mjs')
      return withCred((cred) => sendDanmaku(cred, {
        bvid: String(args.bvid || ''),
        msg: String(args.msg || ''),
        progressMs: Number(args.progressMs) || 5000,
      }))
    },
  })

  // 启动时打印一条提示（凭据缺失不阻塞插件加载）
  try {
    if (!existsSync(credPath())) {
      ctx.logger?.info?.(`[bili-manager] 凭据还没放：${credPath()}（放好 cookie 后即可用）`)
    }
  } catch { /* 忽略 */ }
}
