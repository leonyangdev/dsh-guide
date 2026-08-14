# 11. 事件系统

事件是 Cordis 插件间通信的核心机制。Harness 大量使用事件作为松耦合的扩展点。

## 基本用法

```ts
// 监听
ctx.on('event-name', (payload) => { /* 处理 */ })

// 触发
ctx.emit('event-name', payload)
```

## 四种事件模式

### emit —— 广播

所有监听器同步执行，返回值被忽略：

```ts
ctx.emit('my-plugin/ready', { id: 'worker-1' })

ctx.on('my-plugin/ready', ({ id }) => console.log(`${id} is ready`))
```

### bail —— 短路

监听器按序执行，第一个非 `null`/`false`/`undefined` 的结果成为最终结果：

```ts
const result = ctx.bail('some-check', input)

ctx.on('some-check', (input) => {
  if (shouldBlock(input)) return 'blocked'
  // 返回 null/false/undefined 继续下一个监听器
})
```

### serial —— 顺序执行

按注册顺序执行并 await 异步结果；第一个非空结果停止后续执行：

```ts
await ctx.serial('setup-phase', context)
```

### waterfall —— 管线

每个监听器可以包装下游结果形成处理链。**必须调用 `next()` 委托下游**；省略就是短路：

```ts
const output = await ctx.waterfall('transform', input, async () => input)

ctx.on('transform', async (_input, next) => {
  const downstream = await next()
  return downstream.trim()
})
```

::: warning
waterfall 监听器**必须调用 `next()`**。省略它按设计短路，用于拦截与网关行为。
:::

## 类型化事件

Harness 用 TypeScript 声明合并做类型安全：

```ts
import '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Events {
    'my-plugin/ready': (payload: { id: string }) => void
    'my-plugin/check': (input: string) => boolean | undefined
    'my-plugin/transform': (input: string, next: () => Promise<string>) => Promise<string>
  }
}
```

之后 `ctx.on('my-plugin/ready', ...)` 和 `ctx.emit('my-plugin/ready', ...)` 就能正确推断类型。

## Cordis 事件 vs 会话记录

- Harness 的 Cordis 事件用 `namespace/action` 命名：`agent/step`、`agent/request`、`agent/request-error`、`tools/result`、`session/event` 等。完整签名与模式在各[子系统页](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/subsystems)生成的 `cordis-surface` 区域。
- `turn/*`、`step/*`、`tool/call`、`tool/result`、`compaction/*` 是**持久的会话事件类型**，不是同名 Cordis 事件。要观察它们，监听 `session/event` 并检查 `event.type`。

## 事件监听器是副作用

用 `ctx.on()` 注册的监听器在插件卸载时自动移除：

```ts
export function apply(ctx: Context) {
  ctx.on('tools/result', handler)  // 插件 dispose 时自动移除
}
```

## 示例：日志插件

记录工具调用与结果：

```ts
import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-tools'

export const name = 'tool-logger'

export function apply(ctx: Context) {
  ctx.on('tools/result', (exec, result) => {
    console.log(`[tool] ${exec.name}(${JSON.stringify(exec.arguments)})`)
    const text = result.content
      .map(block => block.type === 'text' ? block.text : '')
      .join('')
    console.log(`[tool result] ${text.slice(0, 100)}`)
  })
}
```

## 下一步

- [能力三层拆分](/guide/12-capability-seam)——理解事件在能力接口内的作用
- [LLM 适配器](/guide/13-llm-adapter)——实现一个完整 LLM 后端
- [事件与能力 Seam 全景解读](/deepdive/14-events-map)
