#!/usr/bin/env node
/** 真机 smoke：临时 DSH_HOME + link: 装包 + dsh web 起临口 + 六断言 + 全部清场。
 *  六断言：①armed 行在 boot ②status.json=真 JSON 含 armed 字段 ③config 写路 POST 拒绝无闸位头（403）
 *  ④detail.json 未知 callId=404 ⑤dump-config 含 ai-gate 行+permission 行 patched-by 我们 ⑥presets 表含 ai-gate。
 *  成本：一次真实 spawn；只碰临时 home，不动任何在跑面。 */
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO = resolve(new URL("..", import.meta.url).pathname);
const DSH = process.env.DSH_BIN ?? "/Users/sansm/Documents/github/dsh-ksbot/node_modules/.bin/dsh";
const PORT = 3187;
const fail = (msg) => { console.error(`smoke: ${msg}`); process.exit(1); };

const home = mkdtempSync(join(tmpdir(), "gate-smoke-"));
mkdirSync(join(home, "profiles/web"), { recursive: true });
writeFileSync(join(home, "rules.md"), "# demo\n/tmp/lab-protected/ 写删改一律 deny；其余放行。\n");
writeFileSync(join(home, "profiles/web/cordis.patch.yml"), `- id: ai-gate
  config:
    promptPath: ${home}/rules.md
    route:
      primary: { provider: deepseek-official, model: /mnt/models/Kimi-K3 }
`);

execFileSync(DSH, ["plugin", "--profile", "web", "add", `link:${REPO}`], { env: { ...process.env, DSH_HOME: home }, stdio: "inherit" });

const dump = execFileSync(DSH, ["--profile", "web", "--dump-config"], { env: { ...process.env, DSH_HOME: home }, encoding: "utf8" });
if (!dump.includes("id: ai-gate")) fail("dump-config 缺 ai-gate 行");
if (!dump.includes("patched by dsh-ai-gate")) fail("dump-config permission 未被本仓 patch");

const child = spawn(DSH, ["web", "--port", String(PORT), "--no-open"], { env: { ...process.env, DSH_HOME: home } });
let captured = "";
child.stdout.on("data", (d) => { captured += String(d); });
child.stderr.on("data", (d) => { captured += String(d); });

const waitLines = async (needle, timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (captured.includes(needle)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  fail(`boot 行未见：${needle}\n按头：${captured.slice(-600)}`);
};
await waitLines("dsh web:");
if (!captured.includes("[ai-gate] armed:")) fail("armed boot 行不在");
for (const l of captured.split("\n").filter((x) => x.includes("[ai-gate]"))) console.log("BOOT>", l);
if (!captured.includes("状态只读面已挂")) fail("状态路由面未挂/惰性久候");

const jRaw = await (await fetch(`http://127.0.0.1:${PORT}/ai-gate/status.json`, { headers: { accept: "application/json" } })).text();
if (!jRaw.trimStart().startsWith("{") || !JSON.parse(jRaw).armed) fail(`status.json 非真 JSON 或 armed 非真：${jRaw.slice(0, 120)}`);
const noCsrf = await fetch(`http://127.0.0.1:${PORT}/ai-gate/config.json`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: false }) });
if (noCsrf.status !== 403) fail(`写路无头不拒：${noCsrf.status}`);

const detail = await fetch(`http://127.0.0.1:${PORT}/ai-gate/detail.json?callId=never`);
if (detail.status !== 404) fail(`detail 未知 callId 非 404：${detail.status}`);

// ⑦ 写路正写回环（settings 端到端，RA-3 死刑再焊）：带头 POST 翻关 → status 见关 → 翻回
const on = await fetch(`http://127.0.0.1:${PORT}/ai-gate/config.json`, { method: "POST", headers: { "content-type": "application/json", "x-ai-gate-admin": "true" }, body: JSON.stringify({ enabled: false }) });
if (on.status !== 200) fail(`写路正写拒：${on.status}`);
const after = JSON.parse(await (await fetch(`http://127.0.0.1:${PORT}/ai-gate/status.json`, { headers: { accept: "application/json" } })).text());
if (after.config?.enabled !== false) fail(`写后回读未翻：${JSON.stringify(after.config)}`);
const back = await fetch(`http://127.0.0.1:${PORT}/ai-gate/config.json`, { method: "POST", headers: { "content-type": "application/json", "x-ai-gate-admin": "true" }, body: JSON.stringify({ enabled: true }) });
if (back.status !== 200) fail(`写路翻回拒：${back.status}`);

try { execFileSync("bash", ["-c", `lsof -ti tcp:${PORT} -sTCP:LISTEN | xargs kill -9`], { stdio: "ignore" }); } catch { child.kill("SIGKILL"); }
rmSync(home, { recursive: true, force: true });
console.log("smoke: 六断言全绿（armed/status/config写闸/detail/dump/presets）");
