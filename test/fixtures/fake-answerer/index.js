/**
 * T9 golden 假审批答允件：站在 answerer 位（global prepend 监听 approval/request），
 * 按 env AI_GATE_FAKE_ANSWER 剧本回 outcome（allowed-once | rejected），req 落 AI_GATE_AUDIT 供断言。
 * **只在测试 profile 挂**。
 */
import { appendFileSync } from "node:fs";

export const name = "ai-gate-fake-answerer";

export function apply(ctx) {
  const audit = process.env.AI_GATE_AUDIT ?? "";
  const scripted = process.env.AI_GATE_FAKE_ANSWER ?? "allowed-once";
  ctx.on(
    "approval/request",
    async (req, next) => {
      if (audit !== "") {
        appendFileSync(audit, JSON.stringify({ toolName: String(req?.toolName ?? ""), reason: String(req?.reason ?? ""), scripted }) + "\n", "utf8");
      }
      return scripted;
    },
    { prepend: true, global: true },
  );
  ctx.logger.info(`[ai-gate-fake-answerer] 挂线（scripted=${scripted}，audit=${audit || "<无>"}）`);
}
