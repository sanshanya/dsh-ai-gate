/** AI 门禁样式（照抄 better-model-provider 先例：一根 <style> 随 fiber 生灭，全 token，类名 ag- 不撞官方。 */

export const AG_STYLES = `
.ag-section { display: flex; flex-direction: column; gap: 4px; }
.ag-title { margin: 0 0 4px; font-size: 18px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.ag-muted { margin: 0; color: var(--dsw-alias-label-tertiary, rgba(0,0,0,.45)); font-size: 12px; line-height: 18px; }
.ag-row { display: flex; align-items: center; gap: 8px; padding: 14px 0; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); }
.ag-row:last-child { border-bottom: none; }
.ag-rowText { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding-right: 24px; }
.ag-rowTitle { font-size: 14px; font-weight: 400; line-height: 22px; color: var(--dsw-alias-label-primary); }
.ag-rowDesc { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, rgba(0,0,0,.45)); }
.ag-chip { display: inline-block; margin-right: 6px; padding: 2px 10px; border-radius: 12px; font-size: 12px; line-height: 20px; color: #fff; }
.ag-chip-green { background: #16a34a; }
.ag-chip-blue { background: #0284c7; }
.ag-chip-amber { background: #d97706; }
.ag-chip-gray { background: rgba(128,128,128,.55); }
.ag-chip-purple { background: #7c3aed; }
.ag-chip-red { background: #dc2626; }
.ag-verdict { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; line-height: 20px; }
.ag-allow { color: #16a34a; } .ag-deny { color: #dc2626; } .ag-ask { color: #d97706; } .ag-exhausted { color: #7c3aed; }
.ag-input { height: 34px; padding: 0 12px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); border-radius: 8px; background: transparent; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.ag-input-wide { min-width: 400px; }
.ag-input-md { min-width: 240px; }
.ag-btn { display: inline-flex; align-items: center; gap: 10px; height: 34px; padding: 0 16px; border: none; border-radius: 17px; background: var(--dsw-alias-bg-module-platform, rgba(0,0,0,.06)); font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); cursor: pointer; }
.ag-btn:disabled { opacity: .55; cursor: default; }
`;
