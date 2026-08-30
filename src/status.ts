/**
 * GATE 运行状态（W4/I4 面）：host 内存对象 + JSON 快照 + 经 webServer 的只读面。
 *
 * 安全钉：recent 永不带命令文本（只带 tool 名+裁决+耗时）——/ai-gate/status.json 走裸 webServer 路由
 * （webhook-github 先例），不挂连接鉴权：宁可少报，不漏命令。
 * fiber 归属本 fiber（apply 内建、随插件生命周期存活、无跨件共享）。
 *
 * @module dsh-ai-gate/status
 */

export interface GateStatusSnapshot {
  armed: boolean;
  disarmReason?: string;
  promptPath: string;
  routes: string[];
  readonlyCount: number;
  /** md 供给面：fresh=每评读盘成功；cached=文件失联，正以内存份续守（RA-B1）。 */
  mdMode: "fresh" | "cached";
  stats: { reviewed: number; allowed: number; denied: number; asked: number; chainExhausted: number };
  /** 最近裁决环（≤20，无命令文本——安全钉）。 */
  recent: Array<{ ts: string; tool: string; verdict: string; ms: number }>;
}

export class GateStatus {
  private readonly snap: GateStatusSnapshot;

  constructor(init: { promptPath: string; routes: string[]; readonlyCount: number }) {
    this.snap = {
      armed: true,
      promptPath: init.promptPath,
      routes: init.routes,
      readonlyCount: init.readonlyCount,
      mdMode: "fresh",
      stats: { reviewed: 0, allowed: 0, denied: 0, asked: 0, chainExhausted: 0 },
      recent: [],
    };
  }

  setMdMode(mode: "fresh" | "cached"): void {
    this.snap.mdMode = mode;
  }
  /** v0.5 活配置：面板改了配置，快照即跟上。 */
  update(next: { promptPath?: string; routes?: string[]; armed?: boolean }): void {
    if (next.promptPath !== undefined) this.snap.promptPath = next.promptPath;
    if (next.routes !== undefined) this.snap.routes = next.routes;
    if (next.armed !== undefined) this.snap.armed = next.armed;
  }


  record(tool: string, verdict: "allow" | "deny" | "ask" | "chain_exhausted", ms: number): void {
    const s = this.snap.stats;
    s.reviewed += 1;
    if (verdict === "allow") s.allowed += 1;
    else if (verdict === "deny") s.denied += 1;
    else if (verdict === "ask") s.asked += 1;
    else s.chainExhausted += 1;
    this.snap.recent.push({ ts: new Date().toISOString(), tool, verdict, ms });
    if (this.snap.recent.length > 20) this.snap.recent.shift();
  }

  snapshot(): GateStatusSnapshot {
    return { ...this.snap, stats: { ...this.snap.stats }, routes: [...this.snap.routes], recent: [...this.snap.recent] };
  }
}

export const STATUS_ROUTE_PATH = "/ai-gate/status.json";
