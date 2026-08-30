/**
 * AI GATE：写/不明 toolcall → 独立上下文 AI 评审 → allow/deny/ask 原生卡。
 * 两张卡以外绝不弹卡（I2）；md 每评读盘失联用内存份续守（RA-B1）；
 * armed=只挂闸、路由首评现验（T9 实证；listProviders 证伪禁采）。
 */
import Schema from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import { BlockAssembler, createUserMessage } from "@deepseek-ai/dsh-llm";
import { effectivePermissionPreset } from "@deepseek-ai/dsh-permission-presets";
import type { SessionEvent } from "@deepseek-ai/dsh-session";
import { readFile } from "node:fs/promises";

import { makeForensic, decisionLine } from "./forensic.ts";
import { GateStatus, STATUS_ROUTE_PATH } from "./status.ts";
import {
  buildReviewSystem,
  reviewWithChain,
  type AttemptRec,
  type ReviewDeps,
  type RouteCfg,
} from "./review.ts";

export interface RouteInput {
  provider: string;
  model: string;
}
export interface AiGateConfig {
  enabled?: boolean;
  /** md 禁令书路径——唯一策略源；空/读不到 = 不武装（「不配=没闸」）。 */
  promptPath?: string;
  /** 评审路由：主 + 可选备；provider+model 须过注册表预验，否则拒绝武装并 boot 明示。 */
  route?: { primary?: RouteInput; backup?: RouteInput };
  perAttemptTimeoutMs?: number;
  reasoningEffort?: string;
}

const routeSchema = Schema.object({
  provider: Schema.string().default("").description("dsh llm 注册表内 provider 名"),
  model: Schema.string().default("").description("模型 id"),
});
const EMPTY_ROUTE = { provider: "", model: "" };

export const Config = Schema.object({
  enabled: Schema.boolean().default(true).description("AI GATE 总开关"),
  promptPath: Schema.string().default("").description("md 禁令书路径（空=没闸）"),
  route: Schema.object({
    primary: routeSchema.default(EMPTY_ROUTE).description("主评审路由"),
    backup: routeSchema.default(EMPTY_ROUTE).description("备用评审路由（空=主路由顶满 6 次）"),
  }).default({ primary: EMPTY_ROUTE, backup: EMPTY_ROUTE }).description("评审路由（首评现验）"),
  perAttemptTimeoutMs: Schema.number().default(30000).description("单次评审尝试超时 ms"),
  reasoningEffort: Schema.string().default("").description("评审推理档（空=默认；候选 low/medium/high）"),
});

/** 只读名单（RB+RA 钉：全枚举，准入=无本地写∧无自由载荷出站；bash/web_fetch 恒进闸）。 */
const KNOWN_READONLY = new Set([
  "read", "glob", "grep", "view_image", "read_image", "web_search",
  "job_output", "job_list", "list_agents", "get_goal",
  "cordis_inspect_list", "cordis_inspect_query", "cordis_inspect_self",
]);



/** v0.4 用户定裁：AI GATE 是一种权限模式（受限 full access）——只在该 preset 生效，其余模式闸冬眠。 */
export const AI_GATE_MODE = "ai-gate";
interface SessionsFoldFace {
  list(): Array<{ id: string; events: readonly SessionEvent[] }>;
}
function currentGatePreset(ctx: Context, agent: { sessionId?: string } | undefined): string | undefined {
  const sid = agent?.sessionId;
  if (sid === undefined) return undefined;
  const sessions = ctx.get("sessions") as SessionsFoldFace | undefined;
  if (!sessions) return undefined;
  const session = sessions.list().find((cand) => cand.id === sid);
  return session === undefined ? undefined : effectivePermissionPreset(session.events);
}interface PreExecuteExec {
  name?: unknown;
  arguments?: unknown;
  callId?: unknown;
  parent?: unknown;
  signal?: AbortSignal;
  /** 活会话身份（RB/T9：agent 与 session 同身份；模式折从这出）。 */
  agent?: { sessionId?: string };
}
type PreExecuteDecision = { kind: "allow" } | { kind: "deny"; reason: string } | { kind: "ask"; reason: string };
type Next = (decision?: PreExecuteDecision) => Promise<PreExecuteDecision>;

interface LlmFace {
  stream(options: Record<string, unknown>): AsyncIterable<unknown>;
  /** RA-M4 + T9 实证：唯一可信的验收尺（registration+resolveModel；llm:711-716）。
   *  listProviders() 已被真机证伪：deepseek-official 流通但名单为空——禁作验收源。 */
  resolveModelInfo?(provider: string, model: string, signal?: AbortSignal): Promise<unknown>;
}
// SDK 面：消费者可自建裁决尾/六链；状态件同面。
export { buildReviewSystem, reviewWithChain, DECISION_TOOL, REVIEW_INSTRUCTION_TAIL } from "./review.ts";
export type { GateDecision, Verdict, RouteCfg as ReviewRouteCfg, ReviewOutcome, AttemptRec } from "./review.ts";
export { GateStatus, STATUS_ROUTE_PATH } from "./status.ts";
export type { GateStatusSnapshot } from "./status.ts";

/** 测试缝：假 llm/组装件注入；不注入 = 真 dsh 件。 */
export interface GateDeps extends Partial<ReviewDeps> {
  llm?: LlmFace;
}

/** 单行文审批卡（C1/RB+RA 钉：纯文本≤240 软预算；分支/cwd/判词/命令首段恒带行内）。 */
function cardLine(branch: "ai_verdict" | "chain_exhausted", detail: string, cwd: string, head: string): string {
  const line = `AI GATE·需人工裁决｜分支:${branch}｜判词|实况:${detail}｜cwd:${cwd}｜命令:${head}`;
  return line.length > 240 ? `${line.slice(0, 240)}…` : line;
}

function summarizeAttempts(attempts: AttemptRec[], lastErr: string): string {
  const seq = attempts.map((a) => `${a.route}#${a.attempt}(${a.kind})`).join("→");
  return `评审链 ${attempts.length} 次全灭（${seq}；最后错误 ${lastErr}）`;
}

export async function apply(ctx: Context, config?: AiGateConfig, deps?: GateDeps) {
  const forensic = makeForensic(ctx.logger);
  if (config?.enabled === false) {
    forensic.line("[ai-gate] 禁用出厂（config.enabled=false）——全部 toolcall 直过");
    return;
  }
  const promptPath = config?.promptPath ?? "";
  if (promptPath === "") {
    forensic.line("[ai-gate] 未配 promptPath——没闸（不配=没闸的诚实声明）：全部 toolcall 直过");
    return;
  }
  // RA-B1 修法·上：arm 时原文入内存——读不到 = 不武装（boot 时缺失仍是「不配=没闸」）。
  let cachedMd: string;
  try {
    cachedMd = await readFile(promptPath, "utf8");
  } catch {
    forensic.line(`[ai-gate] 禁令书读不到（${promptPath}）——不武装：写行为 toolcall 直过直至文件归位（T8 面）`);
    return;
  }
  const primary = config?.route?.primary;
  if (primary === undefined || primary.provider === "" || primary.model === "") {
    forensic.line("[ai-gate] 未配 route.primary{provider,model}——拒绝武装：评审路由无默认（0.1/0.2 硬编码私货已焚）");
    return;
  }
  // T9 真机实证+KS K6 先例定裁：armed = 只挂闸——boot 面绝不碰 llm（boot 窗口注册表空/事件帧服务缺席
  // 都是正常时序）；路由于**首次评审时现验**，验不过 = 直过 + forensic（I2：不产第三张卡）。
  const routes: RouteCfg[] = [primary];
  const backup = config?.route?.backup;
  if (backup !== undefined && backup.provider !== "" && backup.model !== "") routes.push(backup);

  /** 路由惰验：验不过=直过+warn 按因去重；换件窗瞬态缺席下条再验。 */
  let lastRouteWarn = "";
  const routeWarn = (key: string, line: string): void => {
    if (lastRouteWarn !== key) { lastRouteWarn = key; forensic.line(line); }
  };
  const routeOk = new Set<string>();
  const ensureRoutes = async (): Promise<LlmFace | null> => {
    const llmNow = deps?.llm ?? (ctx.get("llm") as LlmFace | undefined);
    if (llmNow === undefined) {
      routeWarn("no-llm", "[ai-gate] llm 服务此刻不在——本条直过（下条再验；I2 不产卡）");
      return null;
    }
    if (llmNow.resolveModelInfo !== undefined) {
      for (const r of routes) {
        const key = `${r.provider}/${r.model}`;
        if (routeOk.has(key)) continue; // 成功一次即钉——换件由调用时 NO_ADAPTER 真相管
        try {
          await llmNow.resolveModelInfo(r.provider, r.model);
          routeOk.add(key);
        } catch (error) {
          routeWarn(
            `resolve:${key}`,
            `[ai-gate] 路由预验失败 ${key}：${String(error instanceof Error ? error.message : error).slice(0, 120)}——本条直过（RA-M4；配错/换件皆走此）`,
          );
          return null;
        }
      }
    }
    lastRouteWarn = "";
    return llmNow;
  };
  const cfg = {
    timeoutMs: config?.perAttemptTimeoutMs ?? 30000,
    reasoningEffort: config?.reasoningEffort ?? "",
  };
  const reviewDeps: ReviewDeps = {
    createUserMessage: deps?.createUserMessage ?? (createUserMessage as unknown as (x: unknown) => unknown),
    makeAssembler: deps?.makeAssembler ?? (() => new BlockAssembler() as unknown as ReturnType<ReviewDeps["makeAssembler"]>),
  };

  forensic.line(
    `[ai-gate] armed: prompt=${promptPath} primary=${primary.provider}/${primary.model}` +
    `（路由=配置面声明，首评现验）` +
    ` backup=${routes[1] === undefined ? "无(主×6)" : `${routes[1].provider}/${routes[1].model}`}` +
    ` timeout=${cfg.timeoutMs}ms×6链 readonly=[${[...KNOWN_READONLY].join(" ")}]`,
  );
  forensic.line(`[ai-gate] 生效域=权限模式「${AI_GATE_MODE}」（其余模式冬眠，零打扰——v0.4 用户定裁）`);
  forensic.line("[ai-gate] 全宇宙仅两张卡：①AI 判 ask ②评审链全灭兜底；其余路径绝不弹卡（I2）");
  forensic.line("[ai-gate] 若本部署审批为无头/never/approval 缺位：卡=隐式拒绝（C4+RA-m11 三条死路宣告）");

  // W4/I4：状态面（recent 无命令文本=安全钉；bare JSON 路由，webhook-github 先例）。
  const status = new GateStatus({
    promptPath,
    routes: routes.map((r) => `${r.provider}/${r.model}`),
    readonlyCount: KNOWN_READONLY.size,
  });
  const webServer = ctx.get("webServer") as
    | { register(route: { kind: "exact"; path: string; handler(req: unknown, res: unknown): void }): () => void }
    | undefined;
  if (webServer !== undefined) {
    ctx.effect(
      () => webServer.register({
        kind: "exact",
        path: STATUS_ROUTE_PATH,
        handler(_req: unknown, res: unknown) {
          const r = res as { writeHead(code: number, headers: Record<string, string>): void; end(body: string): void };
          r.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
          r.end(JSON.stringify(status.snapshot()));
        },
      }),
      "ai-gate: status route",
    );
    forensic.line(`[ai-gate] 状态只读面已挂：GET ${STATUS_ROUTE_PATH}（recent 无命令文本）`);
  } else {
    forensic.line("[ai-gate] webServer 不在——状态 JSON 面未挂，forensic 为唯一状态出口");
  }

  let mdMissingWarned = false; // RA-B1 醒条只响一次（fiber 内态）
  const onWaterfall = ctx.on as unknown as (
    name: string,
    listener: (payload: PreExecuteExec, next: Next) => Promise<PreExecuteDecision | undefined>,
    options?: { prepend?: boolean; global?: boolean },
  ) => unknown;
  onWaterfall(
    "tools/pre-execute",
    async (exec: PreExecuteExec, next: Next) => {
      // v0.4 模式闸：未入 AI GATE preset = 闸冬眠（用户定裁——不入模式不生效）。
      if (currentGatePreset(ctx, exec.agent) !== AI_GATE_MODE) return next();
      const toolName = String(exec?.name ?? "");
      // T1：只读 tool 直过——零评审调用、零打扰（I1：只判身份）。
      if (KNOWN_READONLY.has(toolName)) return next();
      // RA-M5：只闸 root 调用——嵌套子派发直过（一段程序内 N 次写≠N 次评审）。
      if (exec.parent !== undefined) return next();
      const args = (exec.arguments ?? {}) as Record<string, unknown>;
      // RA-M1：cwd 只取 args.workdir（exec 无 cwd 实体）。
      const cwd = typeof args.workdir === "string" && args.workdir !== "" ? args.workdir : "(未声明)";
      const rawCmd = typeof args.command === "string" ? args.command : JSON.stringify(args);
      const head = `${toolName}:${rawCmd.length > 80 ? `${rawCmd.slice(0, 80)}…` : rawCmd}`;

      // RA-B1：每评读盘用新并刷新缓存；读不到用内存份续守——绝不直过。
      let policyMd = cachedMd;
      try {
        policyMd = await readFile(promptPath, "utf8");
        cachedMd = policyMd;
        status.setMdMode("fresh");
        mdMissingWarned = false;
      } catch {
        status.setMdMode("cached");
        if (!mdMissingWarned) {
          mdMissingWarned = true;
          forensic.line(`[ai-gate] ⚠️ 禁令书失联（${promptPath}）——以内存上一份继续守，防线不倒（RA-B1；文件归位自动恢复）`);
        }
      }

      const llmNow = await ensureRoutes();
      if (llmNow === null) {
        forensic.line(decisionLine(toolName, exec.callId, head, "pass", "评审路由此刻不可用——直过+warn（不产第三张卡；I2）"));
        return next();
      }
      const reviewStarted = Date.now();
      const outcome = await reviewWithChain(
        llmNow, reviewDeps, routes, cfg,
        buildReviewSystem(policyMd),
        { tool_call: { name: toolName, arguments: args, cwd } },
        exec.signal,
      ).catch((error: unknown) => {
        if (exec.signal?.aborted) return { kind: "aborted" as const };
        throw error;
      });
      if (outcome.kind === "aborted") return next(); // T7：零卡零 deny
      if (outcome.kind === "exhausted") {
        const detail = summarizeAttempts(outcome.attempts, outcome.lastErr);
        status.record(toolName, "chain_exhausted", Date.now() - reviewStarted);
        forensic.line(decisionLine(toolName, exec.callId, head, "chain_exhausted", detail));
        return { kind: "ask", reason: cardLine("chain_exhausted", detail, cwd, head) };
      }
      const { decision, message } = outcome.verdict;
      status.record(toolName, decision, Date.now() - reviewStarted);
      forensic.line(decisionLine(toolName, exec.callId, head, decision, message));
      if (decision === "allow") return next();
      if (decision === "deny") {
        // RA-m8：deny 理由（进 tool 结果走回模型）总长硬截 2000。
        const reason = `[AI GATE·deny] ${message}`;
        return { kind: "deny", reason: reason.length > 2000 ? `${reason.slice(0, 2000)}…` : reason };
      }
      const short = message.length > 120 ? `${message.slice(0, 120)}…` : message;
      return { kind: "ask", reason: cardLine("ai_verdict", short, cwd, head) };
    },
    { prepend: true, global: true }, // RA-M6 裁：GATE 最外层先判；allow 后内层听者（hooks-*/tool-jobs/沙盒）照旧跑
  );
}