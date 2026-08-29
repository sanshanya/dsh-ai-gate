/** T9 真机夹具（端口 KS 先例，自养单行本）：真 dsh spawn + 临时 DSH_HOME profile + link 本件与假答允件。 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ANSWERER_DIR = join(REPO_ROOT, "test", "fixtures", "fake-answerer");

export function requireDshBin(): string {
  const bin = process.env.DSH_BIN ?? join(REPO_ROOT, "node_modules", ".bin", "dsh");
  const probe = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 30_000 });
  if (probe.status !== 0) {
    throw new Error(
      "dsh bin 不在——golden 必须在真 dsh 上跑：先 `npm install`（@deepseek-ai/dsh 在 devDependencies），或设 DSH_BIN 指位",
    );
  }
  return bin;
}

/** 建 headless profile：link 本仓插件 + 假答允件 + patch config（promptPath/routes/审计 env 位）。 */
export function installProfile(input: { dshHome: string; promptPath: string; auditPath: string }): void {
  const bin = requireDshBin();
  rmSync(input.dshHome, { recursive: true, force: true });
  mkdirSync(input.dshHome, { recursive: true });
  const env = { ...process.env, DSH_HOME: input.dshHome };
  for (const dir of [REPO_ROOT, ANSWERER_DIR]) {
    const add = spawnSync(bin, ["plugin", "--profile", "headless", "add", `link:${dir}`], {
      env, encoding: "utf8", timeout: 300_000,
    });
    if (add.status !== 0) {
      throw new Error(`plugin add ${dir} failed:\n${add.stdout ?? ""}\n${add.stderr ?? ""}`);
    }
  }
  writeFileSync(
    join(input.dshHome, "profiles", "headless", "cordis.patch.yml"),
    [
      "- id: ai-gate",
      "  config:",
      `    promptPath: ${input.promptPath}`,
      "    route:",
      "      primary: { provider: deepseek-official, model: /mnt/models/Kimi-K3 }",
      "    perAttemptTimeoutMs: 60000",
      "",
    ].join("\n"),
    "utf8",
  );
}

export interface SpawnHeadlessInput {
  dshHome: string;
  cwd: string;
  mockUrl: string;
  task: string;
  auditPath: string;
  fakeAnswer?: string;
  timeoutMs?: number;
}

export async function spawnHeadless(input: SpawnHeadlessInput): Promise<{ stdout: string; stderr: string }> {
  const bin = requireDshBin();
  const child = spawn(bin, ["--profile", "headless", input.task], {
    env: {
      ...process.env,
      DSH_HOME: input.dshHome,
      DEEPSEEK_API_KEY: "mock_key",
      DEEPSEEK_BASE_URL: input.mockUrl,
      AI_GATE_AUDIT: input.auditPath,
      AI_GATE_FAKE_ANSWER: input.fakeAnswer ?? "allowed-once",
    },
    cwd: input.cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (d: Buffer) => { stdout += d.toString("utf8"); });
  child.stderr?.on("data", (d: Buffer) => { stderr += d.toString("utf8"); });
  const timeout = input.timeoutMs ?? 240_000;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`headless spawn timeout after ${timeout}ms`));
    }, timeout);
    child.once("exit", (code: number | null) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`headless spawn exited ${code}\n--- stderr ---\n${stderr.slice(-4000)}\n--- stdout ---\n${stdout.slice(-2000)}`));
    });
  });
  return { stdout, stderr };
}
