/**
 * dsh-ai-gate 客户端词表（en+zh）——v0.3：状态面板 + 用法面 + 诚实位三段。
 */

export type AIGateKey =
  | 'nav'
  | 'title'
  | 'subtitle'
  | 'status_title'
  | 'status_off'
  | 'status_armed'
  | 'status_cached'
  | 'status_fresh'
  | 'status_routes'
  | 'status_prompt'
  | 'status_readonly'
  | 'status_stats'
  | 'status_recent'
  | 'status_empty'
  | 'usage_title'
  | 'usage_md'
  | 'usage_cfg_label'
  | 'usage_two_cards'
  | 'honesty_title'
  | 'honesty_li1'
  | 'honesty_li2'
  | 'honesty_li3'
  | 'honesty_li4'

type Dict = Record<AIGateKey, string>

export const zh: Dict = {
  nav: 'AI 门禁',
  title: 'AI GATE（最后一道防线）',
  subtitle: '写行为/不明意义的 toolcall → 独立上下文 AI 评审（dsh 注册模型+你的 md 禁令书）→ allow 直过 / deny 杀掉 / ask 弹原生审批卡。全程无规则系统。',
  status_title: '运行状态（每 5 秒刷新）',
  status_off: '闸不在线：插件未装、未武装（boot 看 [ai-gate] 行），或 webServer 状态面未挂——forensic 是唯一出口。',
  status_armed: '闸在线',
  status_fresh: '禁令书：每评读盘',
  status_cached: '⚠ 禁令书失联——正以内存上一份续守（防线不倒；文件归位自动恢复）',
  status_routes: '评审路由',
  status_prompt: '禁令书',
  status_readonly: '直过名单',
  status_stats: '评审统计',
  status_recent: '最近裁决（不落命令文本）',
  status_empty: '（尚无裁决）',
  usage_title: '怎么用它护你的东西',
  usage_md: '写一份自然语言 md 禁令书——这份文件整段作为评审 AI 的 system prompt，原文不作任何解析。说什么禁什么：',
  usage_cfg_label: '然后装配（三项必填）：',
  usage_two_cards: '全宇宙仅两张审批卡：①AI 亲口要人审 ②评审链主备 6 次全灭的人类兜底。其余任何失败绝不弹卡。',
  honesty_title: '诚实位（签了再上岗）',
  honesty_li1: '不配=没闸：promptPath 空/读不到/路由不在注册表 → boot 明示不武装，写行为全部直过。',
  honesty_li2: '无头/审批 never/approval 缺位的部署：两张卡=卡即拒（registry 文案会写 "the user rejected"——无人拒绝，是策略）。',
  honesty_li3: '成本明示：每条写类 toolcall = 至少一次评审模型调用——给 route 指派轻量快模型；评审间上下文独立。',
  honesty_li4: '防线降风险不消灭风险：md 写松=漏、写严=多卡；恶意提示注入有内置抗句但无绝对保险。',
}

export const en: Dict = {
  nav: 'AI Gate',
  title: 'AI GATE (the last line of defense)',
  subtitle: 'Write/ambiguous tool calls → an isolated-context AI reviewer (a dsh-registered model + your md policy doc) → allow / deny / ask via the native approval card. No rule engine anywhere.',
  status_title: 'Live status (refreshes every 5s)',
  status_off: 'Gate offline: not installed, not armed (grep boot for [ai-gate]), or the webServer status route is absent — forensic is the only outlet.',
  status_armed: 'Gate online',
  status_fresh: 'Policy doc: re-read per review',
  status_cached: '⚠ Policy doc missing — guarding from the last in-memory copy (gate stands; restores on return)',
  status_routes: 'Review routes',
  status_prompt: 'Policy doc',
  status_readonly: 'Read-only pass-through list',
  status_stats: 'Review stats',
  status_recent: 'Recent verdicts (no command text by design)',
  status_empty: '(no verdicts yet)',
  usage_title: 'How to make it guard your stuff',
  usage_md: 'Write a natural-language md policy doc — it lands verbatim as the reviewer\u2019s system prompt (never parsed). Say what is forbidden:',
  usage_cfg_label: 'Then wire it up (three required keys):',
  usage_two_cards: 'Exactly two approval cards exist in the universe: ①the AI asks for a human ②the review chain burned all 6 attempts. No other failure ever prompts.',
  honesty_title: 'Honesty (read before arming)',
  honesty_li1: 'No policy = no gate: empty/unreadable promptPath or unregistered route → boot-declared unarmed, everything passes.',
  honesty_li2: 'Headless / approval-never / approval-absent deployments: either card = implicit reject (the registry will wrongly say "the user rejected").',
  honesty_li3: 'Cost: every write-class tool call spends at least one reviewer call — point route.* at a small fast model; reviews are context-isolated.',
  honesty_li4: 'The gate reduces risk, never erases it: a loose md leaks, a strict md prompts more; prompt-injection phrasings ship built-in but are not absolute.',
}

export type TFn = (key: AIGateKey, params?: Record<string, unknown>) => string
