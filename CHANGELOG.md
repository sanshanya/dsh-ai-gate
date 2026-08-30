# Changelog

## [unreleased] - 2026-08-30（减重第二波）

- **真机 golden 退役至 git 史**（用户令）：test/integration+fixtures+test:integration 脚本+@deepseek-ai/dsh devDep 全删——T9 四例的真机结论已冻结于 docs/v0.3-rewrite-design.md §4.6，回归证明转由 17 枚单元金丝雀承托。
- **README.zh.md 删**：EN 单语门面。


Notable changes to dsh-ai-gate. Versions track published git tags (npm artifact when it ships).

## [0.3.0] - 2026-08-30（AI GATE 重写——用户亲定架构）

**BREAKING**：配置面全换（dimensions/clustersPath/rulesPath/provider/model/timeoutMs/tools 七键删）——新面 `promptPath`+`route.primary/backup`+`perAttemptTimeoutMs`；路由无默认（0.1–0.2 硬编码私货焚），不配/预验不过=直过+boot 明示。

- 规则系统全灭（881 行）；md=纯 system prompt 原文（每评读盘，失联内存续守）。
- 三分支 allow/deny/ask；**全宇宙仅两张卡**（AI 判 ask、六链主×3→备×3 全灭兜底）。
- 只读名单直过（含嵌套直过只闸 root）；审批卡=原生卡单行判词；状态回升：GET /ai-gate/status.json + 设置页实况面板；forensic 双写消毒。
- 质量：单元 17 + 真机 spawn 4 全绿；冻档 docs/v0.3-rewrite-design.md。

## [unreleased] - 2026-08-29（rules.md AI-first 面）

- **rules.md** 讲位（natural-language rules，任意追加）：# header=维度 id、段=谓语、词导出（反引号/绝对路径/双引号）=滤层 token——「集群保护的 prompt 不上 GitHub」的启动面真正啑=你在本机写一份规则文件;8/8 金（T7 词导出+T8 不可读 fail-closed）全绿。

## [0.1.0-alpha.0] - 2026-08-29

- **Docs fix（同日）**: README 门面示例翻转——从 Kubernetes 集群护照示例改为通用「禁止写入保护目录」起手包（实体=词串本身，零实体清单出站）；Kubernetes 签名包仍在代码面就位（`deriveK8sTokens`），但 clusters.yaml 直通评审模型不再是举荐示例（R4 读出秘产面）。EN+ZH 双语同位。

- **First open release: "one-dimensional gate + BYO dictionary kit".** Standalone
  extraction from an internal Kubernetes-guarded bot project, landing standalone. The "general gate" name is still
  locked behind its unlock clause: ≥2 externally-authored, non-K8s dimensions
  verified on a live host before unpinning.
- **Five-module split** (per K11 §2 freeze): `signature-packs` (kubernetes via
  GA `_KUBECTL_RE` counterpart + `deriveK8sTokens` — no-second-regex covenant) /
  `dimensions` (per-dimension mtime-keyed cache, unreadable = fail-closed) /
  `filter` (command × dimension hits) / `review` (GA `_DECISION_TOOL` contract +
  retry budget: timeout/abort is a **deterministic** signal, never folded into the
  3-flake attempts) / `agent-evidence` (`agent_response` tail-scan) / `forensic`
  (logger + stderr double-write — survives the logger-console-boot window).
- **Cordis face**: `apply` registers one `tools/pre-execute` listener;
  Legacy compat key `clustersPath` maps to a one-dimension Kubernetes registry.
  Honest default: with **no dimension configured** the plugin refuses to register
  anything ("不配=没闸" — deny-no-op), in all three declaration sites (README,
  boot line, forensic rows).
- **Quality**: 6 goldens green on mock llm faces; reset/fail-closed/cluster-compat
  lanes pinned; `npm ci && npm run typecheck && npm run build && npm run budget && npm test && npm run verify:pack` 全绿。
