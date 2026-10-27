/**
 * lib/bili.mjs —— B站 账号运营 API（纯 Node fetch 实现，无第三方依赖）
 * 凭据文件格式：{ "sessdata": "...", "bili_jct": "...", "buvid3": "...", "dedeuserid": "..." }
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const REFERER = 'https://www.bilibili.com/'

export function defaultCredentialPath() {
  return join(homedir(), '.dsh', 'bili-main', 'credentials.json')
}

export function loadCredential(path) {
  const p = path || defaultCredentialPath()
  if (!existsSync(p)) throw new Error(`凭据文件不存在：${p}（先扫码登录或手动放好 cookie）`)
  const c = JSON.parse(readFileSync(p, 'utf8'))
  if (!c.sessdata) throw new Error('凭据文件缺少 sessdata')
  return {
    sessdata: c.sessdata,
    bili_jct: c.bili_jct || '',
    buvid3: c.buvid3 || '',
    dedeuserid: String(c.dedeuserid || ''),
  }
}

function headers(cred) {
  return {
    'User-Agent': UA,
    Referer: REFERER,
    Origin: 'https://www.bilibili.com',
    Cookie: [
      `SESSDATA=${cred.sessdata}`,
      cred.bili_jct ? `bili_jct=${cred.bili_jct}` : '',
      cred.buvid3 ? `buvid3=${cred.buvid3}` : '',
      cred.dedeuserid ? `DedeUserID=${cred.dedeuserid}` : '',
    ].filter(Boolean).join('; '),
  }
}

async function json(url, opt = {}) {
  const r = await fetch(url, opt)
  const text = await r.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`非 JSON 响应（HTTP ${r.status}）：${text.slice(0, 160)}`)
  }
}

async function form(url, data, cred) {
  return json(url, {
    method: 'POST',
    headers: { ...headers(cred), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
  })
}

/** 当前登录账号 */
export async function whoami(cred) {
  const j = await json('https://api.bilibili.com/x/web-interface/nav', { headers: headers(cred) })
  const d = j.data || {}
  return {
    ok: j.code === 0 && d.isLogin === true,
    code: j.code,
    uname: d.uname,
    mid: d.mid,
    level: d.level_info?.current_level,
    vip: d.vipStatus,
    coins: d.money,
  }
}

/** 视频基础信息（含 aid / cid） */
export async function videoInfo(bvid) {
  const j = await json(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
    headers: { 'User-Agent': UA, Referer: REFERER },
  })
  if (j.code !== 0) throw new Error(`取视频失败：${j.code} ${j.message}`)
  const d = j.data
  return {
    bvid: d.bvid,
    aid: d.aid,
    cid: d.pages?.[0]?.cid,
    title: d.title,
    owner: d.owner?.name,
    duration: d.duration,
    stat: d.stat,
  }
}

/** 创作中心数据（只读） */
export async function creatorStats(cred, days = 7) {
  const get = async (url, params = {}) => {
    const u = new URL(url)
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v))
    return json(u.toString(), { headers: headers(cred) })
  }
  const [stat, playsource, base, survey, pandect] = await Promise.all([
    get('https://member.bilibili.com/x/web/index/stat'),
    get('https://member.bilibili.com/x/web/data/playsource'),
    get('https://member.bilibili.com/x/web/data/base'),
    get('https://member.bilibili.com/x/web/data/survey', { type: 1 }),
    get('https://member.bilibili.com/x/web/data/pandect', { type: 1 }),
  ])
  const trend = (pandect.data || [])
    .slice(-days)
    .map((x) => ({ date: new Date(x.date_key * 1000).toISOString().slice(0, 10), inc: x.total_inc }))
  return {
    ok: stat.code === 0,
    totals: stat.data || {},
    play_source: playsource.data || null,
    viewer_base: base.data?.viewer_base || null,
    latest_archive_inc: survey.data || null,
    play_trend: trend,
    note: '播放来源/粉丝分布由 B站 每日更新，可能滞后 1 天',
  }
}

/** 发评论 / 回复评论（需 bili_jct） */
export async function sendComment(cred, { bvid, text, rpid = 0, root = 0, parent = 0 }) {
  if (!cred.bili_jct) throw new Error('凭据缺少 bili_jct，无法写操作')
  if (!text || !text.trim()) throw new Error('评论内容为空')
  const v = await videoInfo(bvid)
  const data = {
    oid: v.aid,
    type: 1,
    message: text.trim(),
    plat: 1,
    csrf: cred.bili_jct,
  }
  if (rpid) {
    data.root = root || rpid
    data.parent = parent || rpid
  }
  const j = await form('https://api.bilibili.com/x/v2/reply/add', data, cred)
  if (j.code !== 0) throw new Error(`发评论失败：${j.code} ${j.message}`)
  const r = j.data?.rpid || j.data?.rpid_str || null
  return { ok: true, rpid: r }
}

/** 置顶 / 取消置顶 一级评论 */
export async function pinComment(cred, { bvid, rpid, on = true }) {
  if (!cred.bili_jct) throw new Error('凭据缺少 bili_jct，无法写操作')
  const v = await videoInfo(bvid)
  const j = await form('https://api.bilibili.com/x/v2/reply/top', {
    type: 1,
    oid: v.aid,
    rpid,
    action: on ? 1 : 0,
    csrf: cred.bili_jct,
  }, cred)
  if (j.code !== 0) throw new Error(`置顶失败：${j.code} ${j.message}`)
  return { ok: true, pinned: !!on, rpid }
}

/** 发弹幕 */
export async function sendDanmaku(cred, { bvid, msg, progressMs = 5000, color = 16777215, fontSize = 25 }) {
  if (!cred.bili_jct) throw new Error('凭据缺少 bili_jct，无法写操作')
  if (!msg || !msg.trim()) throw new Error('弹幕内容为空')
  const v = await videoInfo(bvid)
  if (!v.cid) throw new Error('取不到 cid')
  const j = await form('https://api.bilibili.com/x/v2/dm/post', {
    type: 1,
    oid: v.cid,
    bvid,
    msg: msg.trim(),
    progress: Math.max(1000, Math.floor(progressMs)),
    mode: 1,
    fontsize: fontSize,
    color,
    pool: 0,
    plat: 1,
    csrf: cred.bili_jct,
  }, cred)
  if (j.code !== 0) throw new Error(`发弹幕失败：${j.code} ${j.message}`)
  return { ok: true, bvid, msg: msg.trim() }
}
