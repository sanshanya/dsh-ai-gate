/**
 * dsh-ai-gate 客户端半件：一个 settings.section 的指导页（用法+触发 demo+诚实位三道位）。
 * 金刚队：纯虑型（无服务面），0.2.0 再补 live-status 窗。
 *
 * @module dsh-ai-gate/client
 */
import type { ClientShim } from './types.ts'
import { en, zh, type TFn } from './locales.ts'
import { GuideSection, type GuideSectionInjected } from './GuideSection.tsx'

/** 稳定插件 id——对位 cordis.patch.yml row+package name。 */
export const name = 'dsh-ai-gate'

const NS = 'dsh-ai-gate'

/** Cordis fiber dependencies（browser half）。 */
export const inject = ['slots', 'locale', 'remote']

export function apply(ctx: ClientShim): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-ai-gate: dictionaries')
  const bound = ctx.locale.bind(NS)
  const t: TFn = (key, params) => bound(key, params)
  const injectFace = (): GuideSectionInjected => ({ t })
  ctx.slots.inject('settings.section', () => ctx.slots.register<GuideSectionInjected, { close: () => void }>({
    name: 'settings.section',
    id: NS,
    order: 12,
    label: () => t('nav'),
    inject: injectFace,
  }, GuideSection))
}

export { GuideSection }
export type { GuideSectionInjected }
export type { AIGateKey, TFn } from './locales.ts'
