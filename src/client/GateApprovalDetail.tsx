/** W7 审批详情（conversation.approval.detail 单槽·priority -1 压过 ui-chat ApprovalCommand）：
 *  判出 AI GATE 的 payload → 结构化详情；判不出 → 照搬原占有件的行为（命令文本），不偷别人地盘。 */
import { useEffect, useState } from "react";

interface DetailPayload {
  tool: string; raw: string; cwd: string; branch: string; judgment: string;
}
interface ChatCallLike { callId: string; argsRaw: string; kind?: unknown }
interface ChatNodeLike { kind: string; data: { root?: ChatCallLike } }
type UseChat = <T>(sel: (s: { nodes: Map<string, ChatNodeLike> }) => T) => T;

/** 原占有件行为（ui-chat ApprovalCommand）：从 callId 联 command 原文。 */
function CommandFallback({ callId, useChat }: { callId: string; useChat: UseChat }) {
  const command = useChat((snapshot) => {
    for (const node of snapshot.nodes.values()) {
      const root = node.data?.root;
      if (root !== undefined && root.callId === callId && root.kind === undefined) {
        try {
          const args = JSON.parse(root.argsRaw) as Record<string, unknown>;
          if (typeof args.command === "string") return args.command as string;
        } catch { /* 无命令面 */ }
      }
    }
    return undefined as string | undefined;
  });
  return command ?? null;
}

export function GateApprovalDetail({ callId, useChat, t }: { callId: string; useChat: UseChat; t: (k: string) => string }) {
  const [payload, setPayload] = useState<DetailPayload | null | "miss">(null);
  useEffect(() => {
    let live = true;
    fetch(`/ai-gate/detail.json?callId=${encodeURIComponent(callId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: DetailPayload | null) => { if (live) setPayload(p ?? "miss"); })
      .catch(() => { if (live) setPayload("miss"); });
    return () => { live = false; };
  }, [callId]);
  if (payload === null) return null;
  // PB2-★1：必须 JSX——函数调用=hooks 序违规，非本闸审批全崩。
  if (payload === "miss") return <CommandFallback callId={callId} useChat={useChat} />;
  const chip = (text: string, color: string): React.ReactNode =>
    <span style={{ background: color, color: "#fff", borderRadius: 4, padding: "1px 8px", fontSize: 12 }}>{text}</span>;
  const kv = (k: string, v: React.ReactNode): React.ReactNode =>
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      <span style={{ minWidth: 52, opacity: 0.72 }}>{k}</span>
      <span style={{ flex: 1, wordBreak: "break-all" }}>{v}</span>
    </div>;
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8, padding: "10px 12px", border: "1px solid rgba(128,128,128,.35)", borderRadius: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <strong>{t("detail_title")}</strong>
        {payload.branch === "ai_verdict" ? chip(t("detail_branch_ai"), "#d97706") : chip(t("detail_branch_chain"), "#7c3aed")}
      </div>
      {kv(t("detail_judgment"), payload.judgment)}
      {kv(t("detail_tool"), payload.tool)}
      {kv(t("detail_cwd"), payload.cwd)}
      {kv(t("detail_command"), <code style={{ display: "block", whiteSpace: "pre-wrap", fontSize: 12 }}>{payload.raw}</code>)}
    </div>
  );
}
