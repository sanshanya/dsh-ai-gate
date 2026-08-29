/**
 * 取证双写位——唯一守护不能只有审批 asked/decided 事件，直通/回修面也必须留痕。
 *  - ctx.logger.info：logger-console 挂钩后进合并日志面。
 *  - stderr：logger-console 挂钩前的无声期（K11-RA 损件 #2：21 份轮转本行零命中——排障盲位）。
 *
 * @module dsh-ai-gate/forensic
 */

/** 取证双写——每一行都同时进 ctx.logger 和 stderr。 */
export function makeForensic(logger: { info(msg: string, ...args: unknown[]): unknown }): {
  line: (message: string) => void;
} {
  return {
    line: (message: string) => {
      logger.info(message);
      process.stderr.write(`${message}\n`);
    },
  };
}

/** RA-m3 消毒：\\s+ 归一成空格——命令带换行不能伪造决策行/破坏 stderr 单行书。 */
function sanitize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** 按决策行（逐决策证词句）：cmd 消毒后截 120 字，detail 消毒后截 400 字（RA-m3）。 */
export function decisionLine(
  toolName: string,
  callId: unknown,
  command: string,
  verdict: string,
  detail: string,
): string {
  const flat = sanitize(command);
  const cmd = flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
  const flatDetail = sanitize(detail);
  const d = flatDetail.length > 400 ? `${flatDetail.slice(0, 400)}…` : flatDetail;
  return `[ai-gate] decision tool=${toolName} callId=${String(callId ?? "-")} verdict=${verdict} cmd=${cmd}${d === "" ? "" : ` detail=${d}`}`;
}
