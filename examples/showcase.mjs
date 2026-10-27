/**
 * 演示脚本（用于录屏/截图展示，输出经过裁剪、不含隐私数据）
 * 用法：node examples/showcase.mjs
 */
import { loadCredential, defaultCredentialPath, whoami, creatorStats } from '../lib/bili.mjs'

const line = (s = '') => console.log(s)

line('dsh-bili-manager v0.1.0 — DSH 插件 / B站 账号运营工具箱')
line('──────────────────────────────────────────────')
line('已注册工具：')
for (const t of ['bili_manage_whoami', 'bili_manage_stats', 'bili_manage_reply',
                 'bili_manage_pin', 'bili_manage_danmaku']) line('  · ' + t)
line()
line('$ bili_manage_whoami')
try {
  const me = await whoami(loadCredential(defaultCredentialPath()))
  line('  { ok: ' + me.ok + ', level: ' + me.level + ', vip: ' + me.vip + ' }')
} catch (e) {
  line('  { ok: false, error: "' + e.message.slice(0, 40) + '" }')
}
line()
line('$ bili_manage_stats --days 7')
try {
  const st = await creatorStats(loadCredential(defaultCredentialPath()), 7)
  line('  { ok: ' + st.ok + ', trend_points: ' + st.play_trend.length +
       ', source: ' + (st.play_source ? 'ok' : 'pending') + ' }')
} catch (e) {
  line('  { ok: false, error: "' + e.message.slice(0, 40) + '" }')
}
line()
line('写操作（reply / pin / danmaku）默认关闭 —— 需显式开启 enableWrite')
line('✅ 只读实测通过')
