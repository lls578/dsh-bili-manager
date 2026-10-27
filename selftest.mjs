/**
 * 自检：只读验证凭据与接口（不写任何东西）。
 * 用法（用 DSH 自带 Node）：
 *   & "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" selftest.mjs
 * 可用环境变量 BILI_MAIN_CRED 指定凭据路径。
 */
import { loadCredential, whoami, creatorStats, defaultCredentialPath } from './lib/bili.mjs'

const path = process.env.BILI_MAIN_CRED || defaultCredentialPath()
console.log('[selftest] 凭据:', path)
let cred
try {
  cred = loadCredential(path)
} catch (e) {
  console.error('[selftest] 凭据读取失败:', e.message)
  process.exit(1)
}
try {
  const me = await whoami(cred)
  console.log('[selftest] whoami:', JSON.stringify(me))
  if (!me.ok) process.exit(2)
  const stats = await creatorStats(cred, 3)
  console.log('[selftest] totals:', JSON.stringify(stats.totals).slice(0, 260))
  console.log('[selftest] play_trend:', JSON.stringify(stats.play_trend))
  console.log('[selftest] ✅ 只读接口全部通过')
} catch (e) {
  console.error('[selftest] 接口失败:', e.message)
  process.exit(3)
}
