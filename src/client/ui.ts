/** 面板样式=官方 token 照抄面（values 实考古 ui-permission-presets/PermissionRow.module.css；token 全壳在位）。 */
export const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "16px 0", borderBottom: "1px solid var(--dsw-alias-border-l2)" };
export const rowText: React.CSSProperties = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, paddingRight: 48 };
export const title: React.CSSProperties = { fontSize: 14, fontWeight: 400, lineHeight: "22px", color: "var(--dsw-alias-label-primary)" };
export const desc: React.CSSProperties = { fontSize: 12, fontWeight: 400, lineHeight: "18px", color: "var(--dsw-alias-label-tertiary)" };
export const pillBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 12, height: 36, padding: "0 14px", border: "none", borderRadius: 18, background: "var(--dsw-alias-bg-module-platform)", fontSize: 14, lineHeight: "22px", color: "var(--dsw-alias-label-primary)", cursor: "pointer" };
export const inputBox: React.CSSProperties = { height: 36, padding: "0 12px", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, background: "transparent", fontSize: 14, lineHeight: "22px", color: "var(--dsw-alias-label-primary)", minWidth: 260 };
export const chip = (color: "green" | "blue" | "amber" | "gray" | "purple"): React.CSSProperties => {
  const map: Record<string, string> = {
    green: "#16a34a", blue: "#0284c7", amber: "#d97706", gray: "rgba(128,128,128,.5)", purple: "#7c3aed",
  };
  return { background: map[color], color: "#fff", borderRadius: 12, padding: "2px 12px", fontSize: 12, lineHeight: "20px", display: "inline-block", marginRight: 8 };
};
export const codeFont: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 12, lineHeight: "19px" };
