# 10. 服务与依赖

服务（Service）是一个插件暴露给其它插件的能力。`inject` 声明插件需要的服务。

## 什么是服务

Harness 里的 `tools`、`llm`、`agents` 都是服务，每个都是挂载在 `ctx` 上的命名能力：

```ts
ctx.tools    // ToolRuntime 服务
ctx.llm      // LLM 服务
ctx.agents   // Agent 服务
```

任何插件都可以提供一个服务供其它插件消费。

## 消费服务

用 `inject` 声明来使用已有服务：

```ts
export const inject = ['tools']

export function apply(ctx: Context) {
  // ctx.tools 在这里存在且就绪
  ctx.tools.register(/* ... */)
}
```

`apply` 运行时，`inject` 声明的每个服务都已就绪；未就绪则插件等待而不是运行。

## 提供服务

### 继承 Service

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

export default class MetricsService extends Service {
  static inject = ['llm']  // 服务也可以依赖其它服务

  constructor(ctx: Context) {
    super(ctx, 'metrics')  // 'metrics' 是服务名
  }

  // 公开的服务方法
  record(event: string, value: number) {
    // ...
  }
}
```

加载后，消费方通过 `ctx.metrics` 访问：

```ts
export const inject = ['metrics']

export function apply(ctx: Context) {
  ctx.metrics.record('tool_call', 1)
}
```

### 声明它的类型

用 TypeScript 声明合并给 `ctx.metrics` 加类型：

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    metrics: MetricsService
  }
}

export default class MetricsService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'metrics')
  }

  record(event: string, value: number) { /* ... */ }
}
```

## 依赖行为

### 必需 vs 可选依赖

```ts
// 必需：服务缺失时插件不加载
export const inject = ['tools']

// 可选：不写 inject，在使用处用 ctx.get() 查询
export function apply(ctx: Context) {
  const metrics = ctx.get('metrics')
  metrics?.record('plugin_loaded', 1)
}
```

::: warning
可选服务用 `ctx.get(name)`。`ctx.<name>` 属性代理是拓扑敏感的，严格的 `ctx.get` 读全局服务存储。**不要访问未在 `inject` 里声明的 `ctx.<name>`。**
:::

### 服务消失时

如果必需服务在运行时消失（例如 provider 卸载）：

1. 依赖它的插件自动 dispose。
2. 服务回来时它们重新加载。

这防止插件调用一个已不存在的服务。

## 服务隔离（isolate）

`cordis.yml` 可以隔离服务，让不同的插件组看到同一服务的不同实例：

```yaml
- id: group-a
  name: '@deepseek-ai/cordis-plugin-group'
  group: true
  isolate:
    shell: true
  config:
    - name: '@deepseek-ai/dsh-bash-local'
      config: { timeoutMs: 5000 }
    - name: './src/plugin-a.ts'

- id: group-b
  name: '@deepseek-ai/cordis-plugin-group'
  group: true
  isolate:
    shell: true
  config:
    - name: '@deepseek-ai/dsh-bash-local'
      config: { timeoutMs: 60000 }
    - name: './src/plugin-b.ts'
```

`plugin-a` 和 `plugin-b` 各自看到自己组里的 Bash 实例，互不影响。

## 插件生命周期状态机

每个加载的插件拥有一个 **Fiber** 作用域，状态机：

```
PENDING → LOADING → ACTIVE
                 ↘ FAILED
ACTIVE → UNLOADING → DISPOSED
```

| 状态 | 含义 |
|---|---|
| PENDING | 已声明，但必需依赖未就绪 |
| LOADING | 依赖就绪，`apply` 运行中 |
| ACTIVE | 插件运行中 |
| FAILED | `apply` 抛错 |
| UNLOADING | 卸载中，正在释放资源 |
| DISPOSED | 完全卸载 |

卸载时 disposer 按**注册逆序**调用；多个异步 disposer 并发执行、无串行完成保证。需要按顺序拆除时，放进单个 `ctx.effect()` 返回的一个 disposer 里串行 await。

## 下一步

- [事件系统](/guide/11-events)——插件间松耦合通信
- [能力三层拆分](/guide/12-capability-seam)——把服务用作能力接口
