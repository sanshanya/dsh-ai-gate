/** AI 门禁设置节（v0.5 用户定裁：面板=活配置面，说明书去 README）：状态卡 + 可写配置表单。 */
import { useCallback, useEffect, useState } from "react";
import type { TFn } from "./locales.ts";
export interface GuideSectionInjected { t: TFn }

interface Snapshot {
  armed: boolean;
  mdMode: "fresh" | "cached";
  routes: string[];
  promptPath: string;
  readonlyCount: number;
  stats: { reviewed: number; allowed: number; denied: number; asked: number; chainExhausted: number };
  recent: Array<{ ts: string; tool: string; verdict: string; ms: number }>;
  config?: LiveForm;
}
interface LiveForm {
  enabled: boolean;
  promptPath: string;
  routePrimary: { provider: string; model: string };
  routeBackup: { provider: string; model: string };
  perAttemptTimeoutMs: number;
  reasoningEffort: string;
}


const row: React.CSSProperties = { marginBottom: 8 };
const label: React.CSSProperties = { display: "inline-block", minWidth: 120, fontWeight: 600 };
const input: React.CSSProperties = { width: 420, maxWidth: "60%" };
const card: React.CSSProperties = { border: "1px solid rgba(128,128,128,.35)", borderRadius: 8, padding: 16, marginTop: 16 };
const VERDICT_COLOR: Record<string, string> = { allow: "#16a34a", deny: "#dc2626", ask: "#d97706", chain_exhausted: "#7c3aed" };

function StatusCard(props: { t: GuideSectionInjected["t"]; onConfig: (c: LiveForm) => void }) {
  const { t } = props;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let live = true;
    const pull = (): void => {
      fetch("/ai-gate/status.json", { cache: "no-store" })
        .then((r) => r.json())
        .then((s: Snapshot) => { if (!live) return; setOffline(false); setSnap(s); if (s.config !== undefined) props.onConfig(s.config); })
        .catch(() => { if (live) setOffline(true); });
    };
    pull();
    const timer = setInterval(pull, 5000);
    return () => { live = false; clearInterval(timer); };
  }, []);
  if (snap === null && !offline) return null;
  const badge = (text: string, color: string): React.ReactNode =>
    <span key={text} style={{ background: color, color: "#fff", borderRadius: 10, padding: "2px 10px", fontSize: 12, marginRight: 6 }}>{text}</span>;
  return (
    <div style={card}>
      <h3>{t("status_title")}</h3>
      <p>
        {offline
          ? badge(t("status_off"), "#6b7280")
          : snap !== null && [
              badge(snap.armed ? t("status_armed") : t("status_off"), snap.armed ? "#16a34a" : "#6b7280"),
              badge(snap.mdMode === "fresh" ? t("status_fresh") : t("status_cached"), snap.mdMode === "fresh" ? "#0284c7" : "#d97706"),
          ]}
      </p>
      {snap !== null && <div>
        <div style={row}><span style={label}>{t("status_routes")}</span>{snap.routes.join(" / ") === "" ? "—" : snap.routes.join(" / ")}</div>
        <div style={row}><span style={label}>{t("status_prompt")}</span><code>{snap.promptPath}</code></div>
        <div style={row}><span style={label}>{t("status_readonly")}</span>{snap.readonlyCount}</div>
        <div style={row}><span style={label}>{t("status_stats")}</span>
          {`审 ${snap.stats.reviewed} · 放 ${snap.stats.allowed} · 杀 ${snap.stats.denied} · 卡 ${snap.stats.asked} · 灭 ${snap.stats.chainExhausted}`}</div>
        <h4>{t("status_recent")}</h4>
        {snap.recent.length === 0
          ? <p style={{ opacity: 0.65 }}>{t("status_empty")}</p>
          : [...snap.recent].reverse().map((r) => (
            <div key={r.ts + r.tool} style={{ fontFamily: "monospace", fontSize: 12 }}>
              <strong style={{ color: VERDICT_COLOR[r.verdict] ?? "#666" }}>{r.verdict}</strong>
              {"\u00a0\u00a0"}{r.tool.padEnd(15)}{new Date(r.ts).toLocaleTimeString()}{"\u00a0·\u00a0"}{r.ms}ms
            </div>))}
      </div>}
    </div>
  );
}

function ConfigCard(props: { t: GuideSectionInjected["t"]; form: LiveForm | null; onChange: (f: LiveForm) => void }) {
  const { t, form } = props;
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"idle" | "ok" | "err">("idle");
  const save = useCallback(() => {
    if (form === null) return;
    setSaving(true);
    fetch("/ai-gate/config.json", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) })
      .then((r) => { setSaving(false); setResult(r.ok ? "ok" : "err"); })
      .catch(() => { setSaving(false); setResult("err"); });
  }, [form]);
  if (form === null) return null;
  const set = (patch: Partial<LiveForm>): void => props.onChange({ ...form, ...patch });
  const setRoute = (key: "routePrimary" | "routeBackup", k: "provider" | "model", v: string): void =>
    set({ [key]: { ...form[key], [k]: v } });
  const routePair = (key: "routePrimary" | "routeBackup", titleKey: "config_route_primary" | "config_route_backup"): React.ReactNode => (
    <div style={row}>
      <span style={label}>{t(titleKey)}</span>
      <input style={{ ...input, width: 180 }} value={form[key].provider} placeholder="provider"
        onChange={(e) => setRoute(key, "provider", e.currentTarget.value)} />
      {"\u00a0"}
      <input style={{ ...input, width: 220 }} value={form[key].model} placeholder="model"
        onChange={(e) => setRoute(key, "model", e.currentTarget.value)} />
    </div>);
  return (
    <div style={card}>
      <h3>{t("config_title")}</h3>
      <div style={row}>
        <span style={label}>{t("config_enabled")}</span>
        <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} />
      </div>
      <div style={row}>
        <span style={label}>{t("config_promptPath")}</span>
        <input style={input} value={form.promptPath} placeholder="/abs/path/to/rules.md"
          onChange={(e) => set({ promptPath: e.currentTarget.value })} />
      </div>
      {routePair("routePrimary", "config_route_primary")}
      {routePair("routeBackup", "config_route_backup")}
      <div style={row}>
        <span style={label}>{t("config_timeout")}</span>
        <input type="number" style={{ ...input, width: 120 }} value={form.perAttemptTimeoutMs}
          onChange={(e) => set({ perAttemptTimeoutMs: Number(e.currentTarget.value) || 30000 })} />
      </div>
      <div style={row}>
        <span style={label}>{t("config_effort")}</span>
        <input style={{ ...input, width: 160 }} value={form.reasoningEffort} placeholder="low / medium / high"
          onChange={(e) => set({ reasoningEffort: e.currentTarget.value })} />
      </div>
      <button type="button" disabled={saving} onClick={save}>{saving ? t("config_saving") : t("config_save")}</button>
      {"\u00a0"}{result === "ok" && <span style={{ color: "#16a34a" }}>{t("config_saved")}</span>}
      {result === "err" && <span style={{ color: "#dc2626" }}>{t("config_save_err")}</span>}
      <p style={{ opacity: 0.65, marginTop: 8 }}>{t("config_note")}</p>
    </div>
  );
}

export function GuideSection(props: GuideSectionInjected & { close: () => void }) {
  // 渲染面实证（scoped-slots.tsx:499）：inject 记录**平铺**进 props——本组件收 {t, close}，不是 {inject:{t}}。
  const { t } = props;
  const [form, setForm] = useState<LiveForm | null>(null);
  return (
    <div>
      <h1>{t("title")}</h1>
      <p>{t("subtitle")}</p>
      <StatusCard t={t} onConfig={setForm} />
      <ConfigCard t={t} form={form} onChange={setForm} />
    </div>
  );
}
