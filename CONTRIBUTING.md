# Contributing

## 铁律

1. **唯一守护不泄密**：取消/拒绝/ask 的任何路径都必须带（原本命令块截 480 字 + 工作目录行 + 来源标签 `[gate-source=]`）——把关人手上唯一缺的判据位。
2. **词法预滤位零 AI 成本**：退去预滤+命令不触任何维度 = 直放，永不调模型语义审。
3. **fail-closed 只滤内可达**：评审器断电导致驳回、超时、AbortError 一律不静默重试（K11-RA 损件 #1：超时/中止 = **确定性**信号）、立即 fail-closed ask。
4. **配置质载 = 契约**：「不配=没闸」三重声明位（README 首屏 + boot 行 + forensic 行）。欢迎 PR 带一条新维度实例——这是把本仓推向「通用守门」名号的解锁条件位。
5. **永不为数字拆文件**：token budget 是 ratchet（只减不提）；提前 `.json` 单行 commit + commit message 带「产品契约：X 是交付面」。

## Dev gates

测试件 = `node --test test/*.test.ts`（house 规条：原生 node:test、免真 dsh）。推前本地必过：

```bash
npm ci && npm run typecheck && npm run build && npm run budget && npm test && npm run verify:pack
```

发版前三件必办： ①新维度实例+金件 ②CHANGELOG 行 ③`npm run survey` 读一眼面。

## House differences vs better-model-provider

- **测试目录** `test/`（node:test）——BMP 用 `tests/`（vitest）；rc 双轨历史处不在案。
- **CI**：本项目目前的的 CI 位就位（`.github/workflows/ci.yml`）——BMP 的 `live.yml` real-harness
  频道尚未迁（real-harness 面暂不在案）。
