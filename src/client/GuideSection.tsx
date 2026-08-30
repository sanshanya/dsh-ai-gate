/** AI 门禁设置节（v0.5 活配置面；视觉归宗 better-model-provider 先例：样式一根 <style>+全 token。 */
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

const CHIP_CLASS: Record<string, string> = { allow: "ag-allow", deny: "ag-deny", ask: "ag-ask", chain_exhausted: "ag-exhausted" };

function StatusCard(props: { t: TFn; onConfig: (c: LiveForm) => void }) {
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
  return (
    <div>
      <div className="ag-row">
        <div className="ag-rowText">
          <div className="ag-rowTitle">{t("status_title")}</div>
          <div className="ag-rowDesc">
            {offline && <span className="ag-chip ag-chip-gray">{t("status_off")}</span>}
            {!offline && snap !== null && (
              <>
                <span className={`ag-chip ${snap.armed ? "ag-chip-green" : "ag-chip-gray"}`}>{snap.armed ? t("status_armed") : t("status_off")}</span>
                <span className={`ag-chip ${snap.mdMode === "fresh" ? "ag-chip-blue" : "ag-chip-amber"}`}>{snap.mdMode === "fresh" ? t("status_fresh") : t("status_cached")}</span>
              </>
            )}
          </div>
        </div>
      </div>
      {snap !== null && (
        <>
          <div className="ag-row">
            <div className="ag-rowText">
              <div className="ag-rowTitle">{t("status_stats")}</div>
              <div className="ag-rowDesc">{t("status_stats_row", { ...snap.stats, exhausted: snap.stats.chainExhausted })}</div>
            </div>
          </div>
          <div className="ag-row">
            <div className="ag-rowText">
              <div className="ag-rowTitle">{t("status_recent")}</div>
              {snap.recent.length === 0 && <div className="ag-rowDesc">{t("status_empty")}</div>}
              {[...snap.recent].reverse().map((r) => (
                <div key={r.ts + r.tool} className="ag-verdict">
                  <strong className={CHIP_CLASS[r.verdict] ?? ""}>{r.verdict}</strong>
                  {"\u00a0\u00a0"}{r.tool.padEnd(15)}{new Date(r.ts).toLocaleTimeString()}{"\u00a0·\u00a0"}{r.ms}ms
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CfgRow(props: { label: string; hint?: string; control: React.ReactNode }) {
  return (
    <div className="ag-row">
      <div className="ag-rowText">
        <div className="ag-rowTitle">{props.label}</div>
        {props.hint !== undefined && <div className="ag-rowDesc">{props.hint}</div>}
      </div>
      {props.control}
    </div>
  );
}

function ConfigCard(props: { t: TFn; form: LiveForm | null; onChange: (f: LiveForm) => void }) {
  const { t, form } = props;
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"idle" | "ok" | "err">("idle");
  const save = useCallback(() => {
    if (form === null) return;
    setSaving(true);
    fetch("/ai-gate/config.json", { method: "POST", headers: { "content-type": "application/json", "x-ai-gate-admin": "true" }, body: JSON.stringify(form) })
      .then((r) => { setSaving(false); setResult(r.ok ? "ok" : "err"); })
      .catch(() => { setSaving(false); setResult("err"); });
  }, [form]);
  if (form === null) return null;
  const set = (patch: Partial<LiveForm>): void => { setResult("idle"); props.onChange({ ...form, ...patch }); };
  const pair = (key: "routePrimary" | "routeBackup", label: string, hint?: string): React.ReactNode => (
    <CfgRow label={label} hint={hint} control={
      <span style={{ display: "inline-flex", gap: 8 }}>
        <input className="ag-input ag-input-md" value={form[key].provider} placeholder="provider" onChange={(e) => set({ [key]: { ...form[key], provider: e.currentTarget.value } })} />
        <input className="ag-input ag-input-md" value={form[key].model} placeholder="model" onChange={(e) => set({ [key]: { ...form[key], model: e.currentTarget.value } })} />
      </span>} />
  );
  return (
    <div>
      <CfgRow label={t("config_title")} hint={t("config_note")} control={null} />
      <CfgRow label={t("config_enabled")} control={<input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} />} />
      <CfgRow label={t("config_promptPath")} control={<input className="ag-input ag-input-wide" value={form.promptPath} placeholder="/abs/path/to/rules.md" onChange={(e) => set({ promptPath: e.currentTarget.value })} />} />
      {pair("routePrimary", t("config_route_primary"))}
      {pair("routeBackup", t("config_route_backup"))}
      <CfgRow label={t("config_timeout")} control={<input type="number" className="ag-input" style={{ minWidth: 140 }} value={form.perAttemptTimeoutMs} onChange={(e) => set({ perAttemptTimeoutMs: Number(e.currentTarget.value) || 30000 })} />} />
      <CfgRow label={t("config_effort")} control={<input className="ag-input ag-input-md" value={form.reasoningEffort} placeholder="low / medium / high" onChange={(e) => set({ reasoningEffort: e.currentTarget.value })} />} />
      <div className="ag-row">
        <div className="ag-rowText" />
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          <button type="button" className="ag-btn" disabled={saving} onClick={save}>{saving ? t("config_saving") : t("config_save")}</button>
          {result === "ok" && <span className="ag-chip ag-chip-green">{t("config_saved")}</span>}
          {result === "err" && <span className="ag-chip ag-chip-amber">{t("config_save_err")}</span>}
        </span>
      </div>
    </div>
  );
}

export function GuideSection(props: GuideSectionInjected & { close: () => void }) {
  // 渲染面实证（scoped-slots.tsx:499）：inject 记录**平铺**进 props——本组件收 {t, close}，不是 {inject:{t}}。
  const { t } = props;
  const [form, setForm] = useState<LiveForm | null>(null);
  return (
    <div className="ag-section">
      <h2 className="ag-title">{t("title")}</h2>
      <p className="ag-muted">{t("subtitle")}</p>
      <StatusCard t={t} onConfig={setForm} />
      <ConfigCard t={t} form={form} onChange={setForm} />
    </div>
  );
}
