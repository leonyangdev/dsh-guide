# 2. 插件化架构与 Cordis

DeepSeek Harness 的架构根基是：**没有需要打补丁的特权内核**。模型适配器、工具注册表、会话日志、Agent 循环本身，全部都是插件，全部可从配置替换。

## 为什么 vendor Cordis

Cordis 以 vendor 方式内置（`vendor/`），而不是作为普通依赖：

- **完全拥有框架层**：可审计、可打补丁、pin 住版本。
- **发布不 squat 上游名**：9 个 vendored 包全部 rescope 为 `@deepseek-ai/*`（cosmokit 1.8.1、schemastery 3.18.0、cordis 4.0.0-rc.7、loader/include/group/timer/hmr/logger-console）。
- **manifest 记录上游 commit**（`vendor/README.md`），`pnpm-workspace.yaml#linkWorkspacePackages` 让保留的 semver 解析到这些 workspace。

vendor 还维护了 **18 条本地修改日志**，包括：fiber 生命周期硬化（重入 disposal 缺口）、`applyEntryPatches`/`entryListSchema` 导出（供 `--dump-config`）、HMR exact-config 串行化监视、可持久化防抖写入、lazy config 解析、`disabled: !!js` 插值、JSDoc 补全、双 ESM/CJS tsdown 等。sync 流程：记录上游 commit → 拷贝 `src/` → 重放/退役本地修改 → 更新版本与 hash → `pnpm install && test && build`。

## 五个核心概念（回顾）

1. **插件是实现 Service 的对象**：函数形态（`name`/`inject`/`apply`）或 `Service` 子类形态。
2. **上下文是服务的容器**：一个服务占一个稳定 `ctx.<key>`，其它插件按 key 查找而非 import 实现。
3. **通过 `inject` 声明依赖**：等依赖就绪才启动，加载顺序由服务依赖表达。
4. **类型化事件用于通信**：声明合并注册事件名，`emit`/`waterfall`/`parallel`/`serial` 分发。
5. **注册是可逆副作用**：`ctx.effect()`/`ctx.on()` 安装，卸载自动撤销。

## 事件分发模式

| 模式 | await？ | 顺序 | 返回值？ | 用途 |
|---|---|---|---|---|
| `emit` | 否 | 注册顺序观察 | 否 | 广播、通知 |
| `waterfall` | 否 | 注册顺序观察 | 是 | 环绕中间件、拦截 |
| `parallel` | 是 | 全部并行 | 否 | 并行扇出 |
| `serial` | 是 | 注册顺序 | 是 | 按序执行、短路 |

**Waterfall 语义**（Harness 最常用的模式）：监听器收到 `(...args, next)`，调用 `next()` 委托下游并把下游返回值包装后返回；不调 `next()` 直接返回就是短路。这是策略/拦截/网关的实现基础。

Harness 事件用 `namespace/action` 命名。架构里三个关键 waterfall 是 `agent/pre-step`、`agent/request`、`llm/stream`，以及三个 `tools/*`（`pre-execute`/`execute`/`post-execute`）；`agent/turn-stopping` 是 serial 且没有 `next()`。

## Fiber 生命周期

每个插件拥有一个 Fiber 作用域：

```
PENDING → LOADING → ACTIVE
                 ↘ FAILED
ACTIVE → UNLOADING → DISPOSED
```

- `inject` 的服务缺失 → 保持 PENDING。
- 依赖就绪 → LOADING（跑 `apply`）→ ACTIVE。
- `apply` 抛错 → FAILED。
- 服务消失 → 自动 UNLOADING → DISPOSED，服务回来再重载。
- 卸载时 disposer 按注册逆序调用。

## 类型化事件与声明合并

```ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    'my-plugin/ready': (payload: { id: string }) => void
  }
}
```

Harness 用两个 merge-extensible map 支撑整个类型体系：

- `SessionEventMap`：持久的会话事件词汇（可声明合并扩展）。
- `Events`：Cordis 实时事件。

事件 JSDoc 需要 `@mode` 标签，payload 用 `@param` 记录；scoped key 若不在 payload 里需要 `@dshScopeScan unsupported` 标记。这些由 `verify-cordis-catalog` 等 gate 交叉校验。

## 能力 seam：三段式

每个可替换能力由三层组成（详见[「事件与能力 Seam 全景」](/deepdive/14-events-map)）：

- **Service Definition**：拥有 `ctx.<key>` 与词汇类型的 Cordis `Service`（抽象类，如 `ShellExecutor`，或具体注册表，如 `WebRuntime`）。
- **Service Provider**：实现它（`dsh-bash-local` 等）。
- **Consumer**：注入并消费它（`dsh-tool-bash` 等）。

角色通常在独立演进时分到不同包；一个包也可能拥有多个角色（`dsh-llm` 就同时拥有定义和 Consumer）。

## 关键不变量（来自 root AGENTS.md）

这些规则塑造了整棵插件树的行为：

- **注册是副作用**：每个贡献都经 `ctx.effect()`/`ctx.on()`，注册表 `register()` 返回 disposer。
- **运行时不变式断言所属关系**：查权威事件流或可变数据，而非服务/方法存在性。
- **Waterfall 监听器必须 `next()`**。
- **模型可见 ⟺ 已记录**：任何到达模型请求的内容都必须能从会话日志重建。
- **能力 seam 是完整的三段式**，绝不是一个角色。
- **显式 > 隐式**：默认值在实现里走显式 `resolve(request): Spec` 步骤，而非藏在 `run()` 里的 `?? default`。
- **不硬编码可调值**：部署差异都走校验过的 `Config` 字段。

## 下一步

- [Profile / Bundle 组合机制](/deepdive/03-profile-bundle)——插件树如何从配置装配
