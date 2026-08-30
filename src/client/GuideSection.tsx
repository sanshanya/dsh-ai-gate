/**
 * v0.3 面板：运行状态（fetch /ai-gate/status.json 轮询；recent 无命令文本——host 侧安全钉）
 * + 用法面（md 禁令书+三项配置）+ 诚实位。无服务面，零依赖宿主目录。
 */
import { useEffect, useState } from 'react'
import type { TFn } from './locales.ts'

export interface GuideSectionInjected { t: TFn }

interface StatusSnap {
  armed: boolean
  promptPath: string
  routes: string[]
  readonlyCount: number
  mdMode: 'fresh' | 'cached'
  stats: { reviewed: number; allowed: number; denied: number; asked: number; chainExhausted: number }
  recent: Array<{ ts: string; tool: string; verdict: string; ms: number }>
}

const card: React.CSSProperties = { padding: '16px 18px', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12 }
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, monospace', background: '#f4f5f7', padding: '10px 12px', borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto' }
const li: React.CSSProperties = { marginBottom: 6 }
const badge = (color: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: color, color: '#fff', fontSize: 12, marginRight: 8 })

const VERDICT_COLOR: Record<string, string> = { allow: '#16a34a', deny: '#dc2626', ask: '#d97706', chain_exhausted: '#7c3aed' }

function StatusCard({ t }: { t: TFn }) {
  const [snap, setSnap] = useState<StatusSnap | null>(null)
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    let alive = true
    const pull = async () => {
      try {
        const r = await fetch('/ai-gate/status.json', { cache: 'no-store' })
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as StatusSnap
        if (alive) { setSnap(j); setOffline(false) }
      } catch {
        if (alive) { setSnap(null); setOffline(true) }
      }
    }
    void pull()
    const id = setInterval(() => { void pull() }, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  if (offline) return <div style={card}><h3 style={{ marginTop: 0 }}>{t('status_title')}</h3><p style={{ color: '#b45309' }}>{t('status_off')}</p></div>
  if (snap === null) return null
  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>{t('status_title')}</h3>
      <p>
        <span style={badge(snap.armed ? '#16a34a' : '#6b7280')}>{snap.armed ? t('status_armed') : 'OFF'}</span>
        <span style={badge(snap.mdMode === 'fresh' ? '#0ea5e9' : '#d97706')}>{snap.mdMode === 'fresh' ? t('status_fresh') : t('status_cached')}</span>
      </p>
      <p style={li}><b>{t('status_routes')}</b>：{snap.routes.join('  →  ') || '—'}</p>
      <p style={li}><b>{t('status_prompt')}</b>：<code>{snap.promptPath}</code></p>
      <p style={li}><b>{t('status_readonly')}</b>：{snap.readonlyCount} 件</p>
      <p style={li}><b>{t('status_stats')}</b>：
        审 {snap.stats.reviewed} · 放 {snap.stats.allowed} · 杀 {snap.stats.denied} · 卡 {snap.stats.asked} · 灭链 {snap.stats.chainExhausted}
      </p>
      <p style={{ marginBottom: 4 }}><b>{t('status_recent')}</b></p>
      {snap.recent.length === 0 ? <p style={{ color: '#888' }}>{t('status_empty')}</p> : (
        <div style={mono}>
          {[...snap.recent].reverse().map((r, i) => (
            <div key={i}>
              <span style={{ color: VERDICT_COLOR[r.verdict] ?? '#555', fontWeight: 600 }}>{r.verdict.padEnd(15)}</span>
              <span>{r.tool.padEnd(10)}</span>
              <span style={{ color: '#888' }}>{r.ts.slice(11, 19)} · {r.ms}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function GuideSection(props: GuideSectionInjected & { close: () => void }) {
  // 渲染面实证（scoped-slots.tsx:499）：inject 记录**平铺**进 props——本组件收 {t, close}，不是 {inject:{t}}。
  const { t } = props
  const mdExample = `# 生产集群不可动
任何会影响 kubectl / cn-prod-1 生产集群的写、删、改操作一律禁止；只读查看放行。

# 密钥目录不可动
/protected/ 与 /etc/secrets/ 下的任何写、删、改权限动作一律禁止；读取放行。`
  const cfgExample = `{
  "promptPath": "${'~/.dsh/profiles/<你的profile>/ai-gate-rules.md'}",
  "route": {
    "primary": { "provider": "<你的 provider>", "model": "<轻量快模型>" },
    "backup":  { "provider": "<备用 provider>", "model": "<备用模型>" }
  }
}`
  return (
    <div style={{ maxWidth: 720, padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{t('title')}</h2>
      <p style={{ color: '#555', lineHeight: 1.7 }}>{t('subtitle')}</p>
      <StatusCard t={t} />
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{t('usage_title')}</h3>
        <p>{t('usage_md')}</p>
        <pre style={mono}>{mdExample}</pre>
        <p>{t('usage_cfg_label')}</p>
        <pre style={mono}>{cfgExample}</pre>
        <p style={{ color: '#666' }}>{t('usage_two_cards')}</p>
      </div>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{t('honesty_title')}</h3>
        <ul style={{ paddingLeft: 18, marginBottom: 6 }}>
          <li style={li}>{t('honesty_li1')}</li>
          <li style={li}>{t('honesty_li2')}</li>
          <li style={li}>{t('honesty_li3')}</li>
          <li style={li}>{t('honesty_li4')}</li>
        </ul>
      </div>
    </div>
  )
}
