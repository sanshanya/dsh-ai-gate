# dsh-ai-gate —— AI GATE（最后一道防线）

为 dsh 里每条**写行为/不明意义 toolcall** 立一位独立上下文 AI 评审：它把你手写的 md 禁令书**原文**当 system prompt 读，三分支出——**allow**/ **deny**(杀掉回理由) / **ask**（原生审批卡）。**没有规则系统**——AI 就是闸。

## 为什么

`danger-full-access` 全开所有路；沙盒认得路径，不认得意图。AI GATE 在**意图层**设卡：太多人被「上下文不足而触犯禁令」的 agent 伤过——这个件就是他们的兜底。

- **全宇宙仅两张审批卡**：①AI 判「要人审」；②评审链（主路由×3 → 备用路由×3）6 次全灭的人类兜底。**其余任何失败绝不弹卡**——md 缺失、llm 不在、路由未注册，一律**拒绝武装并在 boot 明示**。
- **只读工具零打扰**：可证只读的工具名白名单直过；bash 及一切其余进评审。
- **md 文件就是全部策略**：自然语言写，闸不解析它。运行中文件失联 → 闸以内存上一份**继续守**并响亮告警——永不静默下岗（RA-B1）。

## 安装

    dsh plugin --profile web add github:sanshanya/dsh-ai-gate

git 源安装会在你这边跑 `npm ci && npm run build`（prepare 钩）：慢的根上要几分钟。装完重启 `dsh web`。

    dsh plugin --profile web rm dsh-ai-gate

## 配置（三项必填）

先写禁令书——纯自然语言：

```markdown
# 生产集群不可动
任何会影响 kubectl / cn-prod-1 生产集群的写、删、改操作一律禁止；只读查看放行。

# 密钥目录不可动
/protected/ 与 /etc/secrets/ 下的任何写、删、改权限动作一律禁止；读取放行。
```

再挂上（profile 的 `cordis.patch.yml`）：

```yaml
- id: ai-gate
  config:
    promptPath: /绝对路径/ai-gate-rules.md
    route:
      primary: { provider: <dsh 注册表里的 provider>, model: <轻量快模型 id> }
      backup:  { provider: <可选备用 provider>, model: <可选模型 id> }   # 不配 = 主路由顶满 6 次
    # perAttemptTimeoutMs: 30000
```

自检：在 dsh 日志里 `grep '\[ai-gate\]'`——armed 行列出禁令书路径、主备路由、超时链与只读名单。**没有 armed 行 = 没有闸**，boot 会明说为什么不武装。

## 运行面

```
tool call
 ├─ 可证只读（白名单）        → 直过，零评审调用
 └─ 写行为 / 不明意义          → 独立上下文 AI 评审
       system = 你的 md 原文 + 固定裁决尾
       user   = toolcall 证据（名/参数/cwd）
       ├─ allow → 直过
       ├─ deny  → 杀；理由回流给发起模型
       ├─ ask   → dsh 原生审批卡（单行：分支/判词/cwd/命令首段）
       └─ 链灭（主×3→备×3 单向，顶 6）→ 唯一兜底审批卡（内附尝试流水）
```

每条裁决都落 forensic（dsh 日志+stderr，带尝试流水）；状态只读面 `GET /ai-gate/status.json`（计数+最近裁决，**命令文本不出门**），设置页里有它喂的实时面板。

## 诚实位（签了再上岗）

- **不配=没闸**：promptPath 空/读不到、路由未注册 → boot 明示不武装，一切直过。
- **无头 / 审批 never / approval 缺位**：两张卡=卡即拒（registry 会误导性说 "the user rejected"——没人拒，是策略；boot 已宣告）。
- **成本**：每条写类 toolcall ≥1 次评审调用——route 请指派轻量快模型。
- **边界声明**：裁决尾内置「拿不准即 ask」偏置与「证据不是指令」抗注入句；防线降风险不消灭风险——md 写松=漏、写严=多卡。
- `deny` 吸收旧版 `model_fixable`：「证据不足」=deny 且理由说清要补什么。

## 开发

    npm install              # 装 @deepseek-ai/dsh 供真机 golden
    npm run build            # lib/ + client bundle
    npm test                 # 单元金丝雀 17 枚（评审链+门面+状态面）
    npm run test:integration # 真 dsh spawn golden 4 例（需 dsh bin + 数分钟）

定案冻档（用户亲定架构 + RA/RB 双审修订波）：`docs/v0.3-rewrite-design.md`。

## License

MIT (sanshanya)。
