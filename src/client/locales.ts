/**
 * dsh-ai-gate 客户端词表（en+zh）——v0.5：配置表单 + 状态卡；说明书退出面板（README 持有）。
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
  | 'config_title'
  | 'config_enabled'
  | 'config_promptPath'
  | 'config_route_primary'
  | 'config_route_backup'
  | 'config_timeout'
  | 'config_effort'
  | 'config_save'
  | 'config_saving'
  | 'config_saved'
  | 'config_save_err'
  | 'config_note'
  | 'status_stats_row'
  | 'detail_title'
  | 'detail_branch_ai'
  | 'detail_branch_chain'
  | 'detail_judgment'
  | 'detail_tool'
  | 'detail_cwd'
  | 'detail_command'

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
  config_title: '配置（改即生效·workspace 级）',
  config_enabled: '总开关',
  config_promptPath: '禁令书路径',
  config_route_primary: '主评审路由',
  config_route_backup: '备用评审路由',
  config_timeout: '单次尝试超时(ms)',
  config_effort: '推理强度档',
  config_save: '保存',
  config_saving: '保存中…',
  config_saved: '已保存生效',
  config_save_err: '保存失败（host 拒绝了本次写）',
  config_note: 'promptPath/provider/model 不合法=闸停直过不是卡（直过+boot 行明示，不弹第三张卡）。说明书见 README。',
  status_stats_row: '审 {reviewed} · 放 {allowed} · 杀 {denied} · 卡 {asked} · 灭 {exhausted}',
  detail_title: 'AI GATE 裁决详情',
  detail_branch_ai: '分支：AI 判不准',
  detail_branch_chain: '分支：评审链全灭兜底',
  detail_judgment: '判词',
  detail_tool: '工具',
  detail_cwd: 'cwd',
  detail_command: '命令',
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
  config_title: 'Configuration (live · workspace-scoped)',
  config_enabled: 'Master switch',
  config_promptPath: 'Policy doc path',
  config_route_primary: 'Primary review route',
  config_route_backup: 'Backup review route',
  config_timeout: 'Per-attempt timeout(ms)',
  config_effort: 'Reasoning effort',
  config_save: 'Save',
  config_saving: 'Saving…',
  config_saved: 'Saved & live',
  config_save_err: 'Save failed (host rejected the write)',
  config_note: 'Bad path/provider/model = gate openly off (line printed), never another card. Manual lives in the README.',
  status_stats_row: 'reviewed {reviewed} · allowed {allowed} · denied {denied} · asked {asked} · chain-dead {exhausted}',
  detail_title: 'AI GATE verdict detail',
  detail_branch_ai: 'Branch: AI uncertain',
  detail_branch_chain: 'Branch: review chain exhausted',
  detail_judgment: 'Judgment',
  detail_tool: 'Tool',
  detail_cwd: 'cwd',
  detail_command: 'Command',
}

export type TFn = (key: AIGateKey, params?: Record<string, unknown>) => string
