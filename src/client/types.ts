/**  client 根面类型面的自满足（不并向后拉）。 */
export interface ClientShim {
  locale: {
    register(ns: string, dicts: { zh: unknown; en: unknown }): () => void
    bind(ns: string): (key: string, params?: Record<string, unknown>) => string
  }
  slots: {
    inject(name: string, register: () => unknown): unknown
    register<A, B>(descriptor: {
      name: string
      id?: string
      order?: number
      /** 单槽压位：低 value 赢（scope-slots 实证；压过 ui-chat ApprovalCommand 用 -1）。 */
      priority?: number
      label?: () => string
      inject?: () => A
    }, component: unknown): unknown
  }
  effect(fn: () => (() => void) | void, label?: string): void
}
