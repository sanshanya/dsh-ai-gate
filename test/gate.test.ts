/** 门面金丝雀 T1-T13。 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { apply } from "../src/index.ts";
import { DECISION_TOOL } from "../src/review.ts";

type Decision = { kind: string; reason?: string } | undefined;

const DEFAULT_GATE_SESSIONS = { list() { return [{ id: "s-gate", events: [{ type: "permission/preset", data: { preset: "ai-gate" } }] }]; } };
function makeCtx(llm?: unknown, webRoutes?: Array<{ path: string; handler(req: unknown, res: unknown): void }>, sessions: unknown = DEFAULT_GATE_SESSIONS) {
  const lines: string[] = [];
  const listeners: Array<{ name: string; fn: (exec: unknown, next: unknown) => Promise<Decision> }> = [];
  const ctx = {
    logger: { info: (m: string) => { lines.push(m); } },
    get: (n: string) => {
      if (n === "llm") return llm;
      if (n === "sessions") return sessions;
      if (n === "webServer" && webRoutes !== undefined) {
        return { register: (r: { path: string; handler(req: unknown, res: unknown): void }) => { webRoutes.push(r); return () => {}; } };
      }
      return undefined;
    },
    on: (name: string, fn: (exec: unknown, next: unknown) => Promise<Decision>) => { listeners.push({ name, fn }); },
    /** 真 ctx.effect 立即执行并收 disposer——假件同样即刻执行。 */
    effect: (d: () => unknown) => { d(); },
  };
  return { ctx, lines, listeners };
}

const CUM = (x: unknown) => x;
const ASM = () => {
  const blocks: Array<{ type: string; name?: string; arguments?: unknown }> = [];
  return { push(c: unknown) { blocks.push(c as (typeof blocks)[number]); }, assembled() { return { blocks }; } };
};

type Step = { ok: string; msg: string } | { err: Error };
function fakeLlm(steps: Step[], providers: string[] = ["p1", "p2"]) {
  const calls: Array<Record<string, unknown>> = [];
  const queue = [...steps];
  return {
    calls,
    listProviders() { return providers.map((provider) => ({ provider })); },
    async resolveModelInfo() { return {}; },
    stream(options: Record<string, unknown>) {
      calls.push(options);
      const step = queue.shift();
      return (async function* () {
        if (step === undefined) throw new Error("script exhausted");
        if ("err" in step) throw step.err;
        yield { type: "tool-call", name: DECISION_TOOL.name, arguments: JSON.stringify({ decision: step.ok, message: step.msg }) };
      })();
    },
  };
}

const next = async (d?: Decision): Promise<Decision> => d ?? { kind: "allow" };
function exec(tool: string, args: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  // 默认携带入模式 agent（与 DEFAULT_GATE_SESSIONS 对位）；冬眠面测试显式覆盖 sessions/agent。
  return { name: tool, arguments: args, callId: "c-1", agent: { id: "s-gate" }, ...extra };
}

async function armed(llm: unknown, dirExtra = "") {
  const dir = await mkdtemp(join(tmpdir(), `gate-w3${dirExtra}-`));
  const md = join(dir, "rules.md");
  await writeFile(md, "# 禁令书：不许碰 /protected/。\n", "utf8");
  const { ctx, lines, listeners } = makeCtx(llm);
  await apply(ctx as never, {
    promptPath: md,
    route: { primary: { provider: "p1", model: "m1" }, backup: { provider: "p2", model: "m2" } },
  }, { llm: llm as never, createUserMessage: CUM, makeAssembler: ASM });
  return { dir, md, lines, listener: listeners[0]?.fn };
}

test("T1 只读直过零评审+web_fetch 送审", async () => {
  const llm = fakeLlm([{ ok: "allow", msg: "ok" }]);
  const { listener } = await armed(llm);
  const d = await listener!(exec("read", { file_path: "/etc/hosts" }), next);
  assert.equal(d?.kind, "allow");
  assert.equal((llm as { calls: unknown[] }).calls.length, 0);
  const d2 = await listener!(exec("web_fetch", { url: "https://x" }), next);
  assert.equal((llm as { calls: unknown[] }).calls.length, 1);
  assert.equal(d2?.kind, "allow");
});

test("T2/T3 allow 直通 / deny 传导+硬截", async () => {
  const llm = fakeLlm([{ ok: "allow", msg: "ok" }, { ok: "deny", msg: `禁令明禁 ${"x".repeat(3000)}` }]);
  const { listener } = await armed(llm);
  const d1 = await listener!(exec("bash", { command: "ls /protected" }), next);
  assert.equal(d1?.kind, "allow");
  const d2 = await listener!(exec("bash", { command: "rm -rf /protected" }), next);
  assert.equal(d2?.kind, "deny");
  assert.match(d2?.reason ?? "", /^\[AI GATE·deny\] 禁令明禁/);
  assert.ok((d2?.reason ?? "").length <= 2001);
});

test("T4 ask 单行文卡四段恒带", async () => {
  const llm = fakeLlm([{ ok: "ask", msg: "目标的集群语义我拿不准" }]);
  const { listener } = await armed(llm);
  const d = await listener!(exec("bash", { command: "kubectl delete ns prod", workdir: "/srv/app" }), next);
  assert.equal(d?.kind, "ask");
  const r = d?.reason ?? "";
  assert.ok(!r.includes("\n"), "单行：无换行");
  assert.ok(r.length <= 240);
  for (const frag of ["AI GATE", "分支:ai_verdict", "拿不准", "cwd:/srv/app", "bash:kubectl delete ns prod"]) {
    assert.ok(r.includes(frag), `缺段：${frag}——卡文全量：${r}`);
  }
});

test("T6 链灭→兜底卡含流水", async () => {
  const boom = { err: new Error("expected one gate tool call, got 0") };
  const llm = fakeLlm([boom, boom, boom, boom, boom, boom]);
  const { listener } = await armed(llm);
  const d = await listener!(exec("bash", { command: "rm -rf /protected" }), next);
  assert.equal(d?.kind, "ask");
  assert.match(d?.reason ?? "", /分支:chain_exhausted/);
  assert.match(d?.reason ?? "", /6 次全灭/);
  assert.match(d?.reason ?? "", /p1#3\(flake\)→p2#1/);
});

test("T7 abort 直通零调用", async () => {
  const llm = fakeLlm([{ ok: "allow", msg: "ok" }]);
  const { listener } = await armed(llm);
  const ac = new AbortController();
  ac.abort();
  const d = await listener!(exec("bash", { command: "rm -rf /protected" }, { signal: ac.signal }), next);
  assert.equal(d?.kind, "allow");
  assert.equal((llm as { calls: unknown[] }).calls.length, 0);
});

test("T8 缺 md（无缓存份）：挂闸但呼叫位直过（v0.5 语义）", async () => {
  const llm = fakeLlm([]);
  const { ctx, lines, listeners } = makeCtx(llm);
  await apply(ctx as never, { promptPath: "/no/such/rules.md", route: { primary: { provider: "p1", model: "m1" } } }, { llm: llm as never });
  assert.equal(listeners.length, 1, "v0.5：listener 恒挂，armed 是呼叫位判断");
  const d = await listeners[0]!.fn(exec("bash", { command: "rm -rf /protected" }), next);
  assert.equal(d?.kind, "allow", "缺 md 且无内存份=直过");
  assert.equal((llm as { calls: unknown[] }).calls.length, 0, "零评审");
  assert.ok(lines.some((l) => l.includes("禁令书读不到且无内存份")));
});

test("T10 惰验三面：直过+warn 去重", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gate-t10-"));
  const md = join(dir, "r.md");
  await writeFile(md, "# x\n", "utf8");
  // 面 A：NO_ADAPTER
  const llmA = fakeLlm([]);
  (llmA as { resolveModelInfo(): Promise<unknown> }).resolveModelInfo =
    () => Promise.reject(new Error('no adapter registered for provider "p1"'));
  const a = makeCtx(llmA);
  await apply(a.ctx as never, { promptPath: md, route: { primary: { provider: "p1", model: "m1" } } }, { llm: llmA as never, createUserMessage: CUM, makeAssembler: ASM });
  const listenerA = a.listeners.find((l) => l.name === "tools/pre-execute");
  assert.ok(listenerA !== undefined);
  const dA1 = await listenerA!.fn(exec("bash", { command: "rm -rf /protected" }), next);
  assert.equal(dA1?.kind, "allow");
  assert.equal((llmA as { calls: unknown[] }).calls.length, 0, "零评审调用");
  assert.ok(a.lines.some((l) => l.includes("路由预验失败 p1/m1") && l.includes("no adapter registered")), "warn 落位");
  const warnsBefore = a.lines.filter((l) => l.includes("路由预验失败")).length;
  await listenerA!.fn(exec("bash", { command: "rm -rf /protected/again" }), next);
  assert.equal(a.lines.filter((l) => l.includes("路由预验失败")).length, warnsBefore);
  // 面 B：预验炸
  const llmB = fakeLlm([]);
  (llmB as { resolveModelInfo(): Promise<unknown> }).resolveModelInfo = () => Promise.reject(new Error("model not found"));
  const b = makeCtx(llmB);
  await apply(b.ctx as never, { promptPath: md, route: { primary: { provider: "p1", model: "m1" } } }, { llm: llmB as never, createUserMessage: CUM, makeAssembler: ASM });
  const listenerB = b.listeners.find((l) => l.name === "tools/pre-execute");
  const dB = await listenerB!.fn(exec("bash", { command: "rm -rf /protected" }), next);
  assert.equal(dB?.kind, "allow");
  assert.ok(b.lines.some((l) => l.includes("路由预验失败")));
  // 面 C：llm 缺席
  const c = makeCtx(undefined);
  await apply(c.ctx as never, { promptPath: md, route: { primary: { provider: "p1", model: "m1" } } });
  const listenerC = c.listeners.find((l) => l.name === "tools/pre-execute");
  const dC = await listenerC!.fn(exec("bash", { command: "rm -rf /protected" }), next);
  assert.equal(dC?.kind, "allow");
  assert.ok(c.lines.some((l) => l.includes("llm 服务此刻不在")));
  await rm(dir, { recursive: true, force: true });
});

test("T11 删 md 仍守内存份（RA-B1）", async () => {
  const llm = fakeLlm([{ ok: "allow", msg: "ok" }, { ok: "deny", msg: "禁令在内存里仍然有效" }]);
  const { md, lines, listener, dir } = await armed(llm);
  await listener!(exec("bash", { command: "ls /protected" }), next); // 读盘成功，刷新缓存
  await rm(md);
  const d = await listener!(exec("bash", { command: "rm -rf /protected" }), next);
  assert.equal(d?.kind, "deny");
  assert.ok(lines.some((l) => l.includes("禁令书失联") && l.includes("继续守")));
  assert.equal((llm as { calls: unknown[] }).calls.length, 2, "评审照跑");
  await rm(dir, { recursive: true, force: true });
});

test("T13 状态面：注册+五数+recent 无命令", async () => {
  const llm = fakeLlm([{ ok: "deny", msg: "禁令在内存里仍然有效" }]);
  const dir = await mkdtemp(join(tmpdir(), "gate-t13-"));
  const md = join(dir, "r.md");
  await writeFile(md, "# x\n", "utf8");
  const routes: Array<{ path: string; handler(req: unknown, res: unknown): void }> = [];
  const { ctx, listeners } = makeCtx(llm, routes);
  await apply(ctx as never, { promptPath: md, route: { primary: { provider: "p1", model: "m1" } } }, { llm: llm as never, createUserMessage: CUM, makeAssembler: ASM });
  assert.equal(routes.length, 2, "状态+详情两路由注册");
  const statusRoute = routes.find((rr) => rr.path === "/ai-gate/status.json");
  assert.ok(statusRoute !== undefined, "状态路由在位");
  const d = await listeners[0]!.fn(exec("bash", { command: "rm -rf /protected && echo 别看我" }), next);
  assert.equal(d?.kind, "deny");
  let body = "";
  statusRoute!.handler({}, {
    writeHead() {}, end(b: string) { body = b; },
  });
  const snap = JSON.parse(body) as { armed: boolean; stats: Record<string, number>; recent: Array<Record<string, unknown>>; routes: string[] };
  assert.equal(snap.armed, true);
  assert.equal(snap.stats.reviewed, 1);
  assert.equal(snap.stats.denied, 1);
  assert.equal(snap.routes[0], "p1/m1");
  assert.equal(snap.recent.length, 1);
  assert.deepEqual(Object.keys(snap.recent[0]!).sort(), ["ms", "tool", "ts", "verdict"]);
  assert.ok(!body.includes("别看我"), "快照全串不得含命令片段");
  await rm(dir, { recursive: true, force: true });
});

test("T12 嵌套直过只闸 root（RA-M5）", async () => {
  const llm = fakeLlm([]);
  const { listener } = await armed(llm);
  const d = await listener!(exec("bash", { command: "echo nested" }, { parent: {} }), next);
  assert.equal(d?.kind, "allow");
  assert.equal((llm as { calls: unknown[] }).calls.length, 0);
});


// T14-T16：v0.4 模式闸——AI GATE 是一种权限模式，不入模式=冬眠
const GATE_AGENT = { id: "s-gate" };
function fakeSessions(preset?: string) {
  return {
    list() {
      if (preset === undefined) return [];
      return [{ id: "s-gate", events: [{ type: "permission/preset", data: { preset } }] }];
    },
  };
}

test("T14 入模式(preset=ai-gate)：闸醒，正常评审", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gate-t14-"));
  try {
    const md = join(dir, "rules.md");
    await writeFile(md, "禁令书\n", "utf8");
    const llm = fakeLlm([{ ok: "deny", msg: "禁地" }]);
    const a = makeCtx(llm, undefined, fakeSessions("ai-gate"));
    await apply(a.ctx as never, { promptPath: md, route: { primary: { provider: "p1", model: "m1" } } }, { llm: llm as never, createUserMessage: CUM, makeAssembler: ASM });
    const listener = a.listeners.find((l) => l.name === "tools/pre-execute");
    assert.ok(listener !== undefined);
    const d = await listener!.fn(exec("bash", { command: "rm -rf /protected" }, { agent: GATE_AGENT }), next);
    assert.equal(d?.kind, "deny");
    assert.equal((llm as { calls: unknown[] }).calls.length, 1, "评审真跑");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("T15 其他模式：冬眠直过零评审", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gate-t15-"));
  try {
    const md = join(dir, "rules.md");
    await writeFile(md, "禁令书\n", "utf8");
    const llm = fakeLlm([{ ok: "deny", msg: "不该到" }]);
    const a = makeCtx(llm, undefined, fakeSessions("workspace-write"));
    await apply(a.ctx as never, { promptPath: md, route: { primary: { provider: "p1", model: "m1" } } }, { llm: llm as never, createUserMessage: CUM, makeAssembler: ASM });
    const listener = a.listeners.find((l) => l.name === "tools/pre-execute");
    const d = await listener!.fn(exec("bash", { command: "rm -rf /protected" }, { agent: GATE_AGENT }), next);
    assert.equal(d?.kind, "allow", "冬眠=直过");
    assert.equal((llm as { calls: unknown[] }).calls.length, 0, "零评审");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("T16 sessions 缺席/无 agent：仍冬眠直过", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gate-t16-"));
  try {
    const md = join(dir, "rules.md");
    await writeFile(md, "禁令书\n", "utf8");
    // 无 sessions 服务
    const llmA = fakeLlm([{ ok: "deny", msg: "不该到" }]);
    const a = makeCtx(llmA, undefined, null);
    await apply(a.ctx as never, { promptPath: md, route: { primary: { provider: "p1", model: "m1" } } }, { llm: llmA as never, createUserMessage: CUM, makeAssembler: ASM });
    const listener = a.listeners.find((l) => l.name === "tools/pre-execute");
    const dA = await listener!.fn(exec("bash", { command: "rm -rf /protected" }, { agent: GATE_AGENT }), next);
    assert.equal(dA?.kind, "allow");
    assert.equal((llmA as { calls: unknown[] }).calls.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});


test("T17 无 id 的 agent：sessions 在位仍冬眠（RA-1 对偶）", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gate-t17-"));
  try {
    const md = join(dir, "rules.md");
    await writeFile(md, "禁令书\n", "utf8");
    const llm = fakeLlm([{ ok: "deny", msg: "不该到" }]);
    const a = makeCtx(llm);
    await apply(a.ctx as never, { promptPath: md, route: { primary: { provider: "p1", model: "m1" } } }, { llm: llm as never, createUserMessage: CUM, makeAssembler: ASM });
    const listener = a.listeners.find((l) => l.name === "tools/pre-execute");
    const d = await listener!.fn(exec("bash", { command: "rm -rf /protected" }, { agent: {} }), next);
    assert.equal(d?.kind, "allow", "id 缺=冬眠不审");
    assert.equal((llm as { calls: unknown[] }).calls.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
