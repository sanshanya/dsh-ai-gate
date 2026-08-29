/** T9 真机 golden R1-R4：真 dsh spawn+双队列 MockLlm+假答允件。前置 npm install+build。 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { startMockLlm, countLiteral, isReviewRequest, type MockPlan, type MockPlanEntry } from "./mock-llm.ts";
import { installProfile, spawnHeadless, REPO_ROOT } from "./harness.ts";

const BASH_CALL = (command: string): MockPlanEntry => ({ toolCall: { name: "bash", arguments: { command } } });
const GATE = (decision: string, message: string): MockPlanEntry => ({
  toolCall: { name: "submit_gate_decision", arguments: { decision, message } },
});
const DONE: MockPlanEntry = { text: "done." };

interface RunOut {
  stderr: string;
  bodies: Array<Record<string, unknown>>;
  audit: string;
}

async function runCase(plan: MockPlan, fakeAnswer: string): Promise<RunOut> {
  assert.ok(existsSync(join(REPO_ROOT, "lib", "index.js")));
  const dir = await mkdtemp(join(tmpdir(), "gate-t9-"));
  const dshHome = join(dir, "home");
  const promptPath = join(dir, "rules.md");
  const auditPath = join(dir, "audit.jsonl");
  writeFileSync(promptPath, "# 生产面不可动\n/protected/ 与生产集群的任何写操作一律禁止；只读与安全 echo 放行。\n", "utf8");
  const mock = await startMockLlm(plan);
  try {
    installProfile({ dshHome, promptPath, auditPath });
    const { stderr } = await spawnHeadless({
      dshHome, cwd: dir, mockUrl: mock.url,
      task: "按指示执行 bash 工具调用然后总结一句。",
      auditPath, fakeAnswer,
    });
    const bodies = mock.bodies();
    if (process.env.GATE_DEBUG_T9 !== undefined) {
      writeFileSync(`/tmp/t9-debug-${Date.now()}.json`, JSON.stringify({ stderr, bodies, audit: existsSync(auditPath) ? readFileSync(auditPath, "utf8") : "" }, null, 2));
    }
    return { stderr, bodies, audit: existsSync(auditPath) ? readFileSync(auditPath, "utf8") : "" };
  } finally {
    await mock.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("R1 allow 链", async () => {
  const out = await runCase(
    { task: [BASH_CALL("echo AI_GATE_T9_ALLOW"), DONE], review: [GATE("allow", "安全 echo")] },
    "allowed-once",
  );
  assert.match(out.stderr, /\[ai-gate\] armed:/, "boot 武装行在位");
  assert.ok(out.bodies.some(isReviewRequest));
  assert.ok(
    out.bodies.some((b) => !isReviewRequest(b) && countLiteral(b, "AI_GATE_T9_ALLOW") >= 1),
    "工具结果回流含 echo 哨兵",
  );
});

test("R2 deny 链", async () => {
  const out = await runCase(
    { task: [BASH_CALL("mkdir -p /protected/t9 && echo NAIL > /protected/t9/x"), DONE], review: [GATE("deny", "禁令明禁 /protected/ 写")] },
    "allowed-once",
  );
  assert.ok(out.bodies.some(isReviewRequest), "评审请求真发");
  assert.ok(
    out.bodies.some((b) => !isReviewRequest(b) && countLiteral(b, "AI GATE·deny") >= 1),
    "deny 理由回流任务 agent",
  );
});

test("R3 ask→rejected 链", async () => {
  const out = await runCase(
    { task: [BASH_CALL("touch /protected/t9-ask"), DONE], review: [GATE("ask", "目标位于禁令目录边沿，须人类定夺")] },
    "rejected",
  );
  assert.match(out.audit, /"toolName":"bash"/, "假答允件收到审批请求");
  assert.ok(
    out.bodies.some((b) => !isReviewRequest(b) && countLiteral(b, "the user rejected tool") >= 1),
    "registry 拒绝文案回流",
  );
});

test("R4 ask→allowed-once 链", async () => {
  const out = await runCase(
    { task: [BASH_CALL("echo AI_GATE_T9_ASKED"), DONE], review: [GATE("ask", "边缘命令，请人类放行")] },
    "allowed-once",
  );
  assert.match(out.audit, /"toolName":"bash"/);
  assert.ok(
    out.bodies.some((b) => !isReviewRequest(b) && countLiteral(b, "AI_GATE_T9_ASKED") >= 1),
    "审批放行后 echo 输出回流",
  );
});
