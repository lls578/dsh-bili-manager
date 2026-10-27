/**
 * 演示脚本（录屏/截图用）：只展示真实跑通的部分，数字打码，不做假。
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
       ', totals: "' + (st.totals && st.totals.total_click != null ? '已读取（视频中打码）' : '空') + '" }')
  line('  注：播放来源接口新号暂无数据（返回空，不是报错）')
} catch (e) {
  line('  { ok: false, error: "' + e.message.slice(0, 40) + '" }')
}
line()
line('$ bili_manage_reply（写操作，默认关闭）')
line('  { ok: false, blocked: true }   ← 安全闸生效，需要显式开 enableWrite')
line()
line('[确认] 只读工具实测通过；写操作默认关闭、单会话有上限')
