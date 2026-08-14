# 5. Cordis 核心概念

要写 DeepSeek Harness 插件，必须先理解它底层的 [Cordis](https://github.com/cordiverse/cordis) 框架。Harness 以 vendor 方式内置 Cordis（见[「插件化架构与 Cordis」解读](/deepdive/02-plugin-architecture)），所以它的概念就是 Harness 的概念。

## 五个核心概念

### 1. 插件是实现 Service 的对象

一个插件可以是：

- **函数形式**：带可选 `inject` 和 `apply(ctx)` 字段的函数
- **类形式**：一个 `Service` 子类

其生命周期由 Cordis 挂载到当前上下文。

### 2. 上下文是服务的容器

一个服务占据一个稳定的 `ctx.<key>`：

```ts
ctx.tools     // ToolRuntime 服务
ctx.llm       // LLM 服务
ctx.sessions  // 会话存储服务
```

其它插件通过 key 查找服务，**而不是 import 具体实现**——这就是"可替换"的根源。

### 3. 通过 inject 声明服务依赖

插件声明它需要的服务后，Cordis 会**等这些服务就绪才启动它**；加载顺序由服务依赖表达，而非手动编排。

```ts
export const inject = ['tools']

export function apply(ctx: Context) {
  // ctx.tools 在这里一定已就绪
}
```

### 4. 类型化事件用于通信

服务通过 TypeScript 声明合并（declaration merging）注册事件名，再以 `emit` / `waterfall` / `parallel` / `serial` 方式分发。

### 5. 注册是可逆的副作用

提示词片段、工具 schema、适配器、provider、监听器都通过 `ctx.effect()` 或 `ctx.on()` 安装。插件 reload / teardown 时**自动撤销**，你不需要手动 removeListener / clearInterval。

## 四种分发模式

每个事件有且只有一种分发模式，只能通过对应方法分发：

| 模式 | 是否 await？ | 顺序 | 有返回值？ |
|---|---|---|---|
| `emit` | 否 | 按注册顺序观察 | 否 |
| `waterfall` | 否 | 按注册顺序观察 | 是 |
| `parallel` | 是 | 所有监听器并行 | 否 |
| `serial` | 是 | 按注册顺序 | 是 |

事件的分发模式是事件公开契约的一部分。Harness 用 `@mode` 标签记录模式，生成的目录会校验声明与调用点一致。

## Waterfall 语义（重点）

`ctx.waterfall` 是**环绕中间件**：监听器收到 `(...args, next)`。

- 调用 `next()` 会执行下游监听器，下游的返回值通过 `next()` 返回给当前层，当前层可以包装后再向外返回。
- **不调用 `next()` 直接返回，就是短路**。

```ts
// 分发
const output = await ctx.waterfall('transform', input, async () => input)

// 监听：next() 是必须的
ctx.on('transform', async (_input, next) => {
  const downstream = await next()  // 先委托下游
  return downstream.trim()        // 再包装结果
})
```

::: warning 关键规则
**waterfall 监听器必须调用 `next()` 才能委托下游；省略它就是短路。** 这是刻意的设计，用于实现拦截与网关行为。

- 协作式监听器：修改共享的请求/决策对象，然后委托。
- 策略监听器：拥有决策权时可以不调 `next()` 直接返回。
- 只做观察的监听器：必须委托。

只在必须比普通注册更早运行时才用 `prepend: true`。
:::

## Loader 配置与 `!!js`

`cordis.yml` 里的 `!!js` 会被解析为表达式节点（注意是 `!!js`，不是 `!js`）：

```yaml
- name: '@deepseek-ai/dsh-llm-deepseek'
  config:
    apiKey: !!js process.env.MY_API_KEY
```

Loader 在声明的注入激活后、基于插件上下文插值条目的 `config`，在每次挂载决策时基于 loader 上下文插值 `disabled` 字段。其它元数据保持字面值。要按环境选插件时，用 overlay（`--patch`）。

## 实践规则

- **把行为封装为插件**：工具流水线事件属于 `ctx.tools`，模型流式输出属于 `ctx.llm`，实时 agent 协调属于 `ctx.agents`。
- **拦截和策略优先用事件；直接能力调用优先用服务方法**。
- **每个注册都要有对应 disposer**：从 `ctx.effect()` 返回一个，或用 Cordis 提供的辅助方法。需要按特定顺序拆除时，把相关工作放进同一个 effect。

## 深入阅读

- 完整的 Cordis 教程（7 篇，含生命周期、服务、事件、配置、组合与 HMR）：官方仓库 [`docs/cordis-tutorial/`](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/cordis-tutorial)
- 本指南的[「事件系统」](/guide/11-events)与[「服务与依赖」](/guide/10-services)章节
- [Cordis 入门（官方 primer）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md)

## 下一步

概念清楚了，动手写[第一个插件](/guide/06-first-plugin)。
