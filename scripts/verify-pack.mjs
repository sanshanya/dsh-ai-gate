#!/usr/bin/env node
/**
 * verify-pack（lite）——发布 tar basement 完整性（alpha 面：白名单件+build+类型面）：
 *  0. 强制 build（杜绝旧 lib 假通过）+核 lib/index.js、index.d.ts 产存；
 *  1. `npm pack --json` 取 tar 面浦要场围（白名单：lib/ + README/LICENSE/package.json）；
 *  2. 真字净化：裸 importer 里 import 产件必须 exit=0。
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const root = resolve(process.cwd());
const fail = (msg) => { console.error(`verify-pack: ${msg}`); process.exit(1); };

execFileSync(NPM, ['run', 'build'], { cwd: root, stdio: 'inherit' });
for (const f of ['lib/index.js', 'lib/index.d.ts']) {
  if (!existsSync(join(root, f))) fail(`缺 ${f}，build 疑似失败`);
}

let packJson;
try {
  const out = execFileSync(NPM, ['pack', '--json'], { cwd: root, encoding: 'utf8' });
  // prepare 钩会把 build 行打进 stdout——自首个 '[' 起才是 JSON
  packJson = JSON.parse(out.slice(out.indexOf('[')));
} catch (e) {
  fail(`npm pack 失败: ${e.message}`);
}
const pkg = Array.isArray(packJson) ? packJson[0] : packJson;
const tarball = join(root, pkg.filename);
const paths = pkg.files.map((f) => f.path);
const bad = paths.filter((p) => !/^(lib\/.+|README(\.zh)?\.md|CHANGELOG\.md|LICENSE|cordis\.patch\.yml|package\.json)$/.test(p));
const browserHead = readFileSync(join(root, "lib/client.js"), "utf8").slice(0, 200);
if (!browserHead.startsWith("window.__ModuleLoader__.load({")) fail("verify-pack: client.js 缺 __ModuleLoader__.load 装载壳");
if (!browserHead.includes('"dsh-ai-gate"')) fail("verify-pack: client.js 模块 id 必须是包名");

if (bad.length) fail(`白名单外文件入包: ${bad.join(', ')}`);

const probeDir = mkdtempSync(join(tmpdir(), 'ai-gate-verify-'));
try {
  const stage = execFileSync(NPM, ['init', '-y'], { cwd: probeDir, stdio: 'ignore' });
  execFileSync(NPM, ['install', tarball, '--no-audit', '--no-fund'], { cwd: probeDir, stdio: 'inherit' });
  const probeMjs = join(probeDir, 'probe.mjs');
  writeFileSync(probeMjs, `import * as m from 'dsh-ai-gate';\nif (typeof m.apply !== 'function') throw new Error('apply missing');\nif (typeof m.Config !== 'function') throw new Error('Config missing');\nif (typeof m.buildReviewSystem !== 'function') throw new Error('buildReviewSystem missing');\nif (typeof m.reviewWithChain !== 'function') throw new Error('reviewWithChain missing');\nif (m.DECISION_TOOL?.parameters?.properties?.decision?.enum?.join(',') !== 'allow,deny,ask') throw new Error('三分支契约缺位');\nconsole.log('probe ok');\n`, 'utf8');
  execFileSync('node', [probeMjs], { cwd: probeDir, stdio: 'inherit' });
  console.log('verify-pack: 白名单 + 裸 import 两种探测都绿');
} finally {
  rmSync(probeDir, { recursive: true, force: true });
  rmSync(tarball, { force: true });
}
