/** T9 真机 golden 的 MockLlm：OpenAI 兼容 SSE 流面（端口 KS 先例，自养单行本）。
 *  双队列按请求内容分路：body.tools 带 submit_gate_decision = 评审请求 → 吃 review 队列；
 *  其余 = 任务 agent → 吃 task 队列。title 旁路不消费任何队列。
 *  每请求完整 body 存档（哨兵断言面）。 */
import { createServer, type Server } from "node:http";

export interface MockPlanEntry {
  text?: string;
  toolCall?: { id?: string; name: string; arguments: Record<string, unknown> };
}
export interface MockPlan {
  task: MockPlanEntry[];
  review: MockPlanEntry[];
}
export interface MockLlm {
  url: string;
  bodies(): Array<Record<string, unknown>>;
  close(): Promise<void>;
}

const isReviewBody = (body: Record<string, unknown>): boolean => {
  const tools = body.tools as Array<{ function?: { name?: string }; name?: string }> | undefined;
  return (tools ?? []).some((t) => (t.function?.name ?? t.name) === "submit_gate_decision");
};

export async function startMockLlm(plan: MockPlan): Promise<MockLlm> {
  const bodies: Array<Record<string, unknown>> = [];
  let taskIdx = 0;
  let reviewIdx = 0;
  const server: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    const messages = (body as { messages?: Array<{ content?: unknown }> }).messages ?? [];
    const isTitleRequest = messages.some((m) => String(m?.content ?? "").includes("Generate the session title"));
    if (!isTitleRequest) bodies.push(body);
    let entry: MockPlanEntry;
    if (isTitleRequest) entry = { text: "golden-title" };
    else if (isReviewBody(body)) entry = plan.review[Math.min(reviewIdx++, plan.review.length - 1)] ?? { text: "OK." };
    else entry = plan.task[Math.min(taskIdx++, plan.task.length - 1)] ?? { text: "OK." };
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const send = (delta: Record<string, unknown>, finishReason?: string): void => {
      res.write(
        `data: ${JSON.stringify({ object: "chat.completion.chunk", id: "chatcmpl-mock", choices: [{ index: 0, delta, ...(finishReason ? { finish_reason: finishReason } : {}) }] })}\n\n`,
      );
    };
    if (entry.toolCall) {
      if (entry.text !== undefined) send({ content: entry.text });
      send({
        tool_calls: [{
          index: 0,
          id: entry.toolCall.id ?? `call_mock_${bodies.length}`,
          type: "function",
          function: { name: entry.toolCall.name, arguments: JSON.stringify(entry.toolCall.arguments) },
        }],
      });
      send({}, "stop");
    } else {
      send({ content: entry.text ?? "OK." });
      send({}, "stop");
    }
    res.write("data: [DONE]\n\n");
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("mock llm: no listen address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    bodies: () => bodies,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** 哨兵计数：在 body 的完整 JSON 里数字面量出现次数。 */
export function countLiteral(body: unknown, literal: string): number {
  const text = JSON.stringify(body);
  return text.split(literal).length - 1;
}

/** 判定某 archived 请求是否为评审调用（body.tools 面——请求级真相，不吃响应假绿）。 */
export function isReviewRequest(body: Record<string, unknown>): boolean {
  return isReviewBody(body);
}
