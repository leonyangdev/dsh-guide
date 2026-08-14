# 14. 进阶：组合、作用域与动态插件

学完基础后，这一章补齐三个进阶主题：**嵌套组合与 HMR**、**作用域（scope）与 preset**、**动态插件（运行时自修改）**。

## 嵌套上下文与 HMR

### `ctx.plugin()` 嵌套

`ctx.plugin()` 创建一个继承父上下文的子 Fiber，但拥有独立生命周期：

```ts
export function apply(ctx: Context) {
  ctx.plugin(childPlugin)  // 子插件有自己的 Fiber，随父插件一起卸载
}
```

### 热替换（HMR）

在 `cordis.yml` 里加载 `@deepseek-ai/cordis-plugin-hmr` 后，编辑插件源文件会触发：

1. 卸载旧插件、清理注册。
2. 加载新代码。
3. 运行新的 `apply`。

因为注册会自我清理，热替换不会残留旧实例的注册。

## 作用域（scope）

作用域是**按 agent 的注册单位**。一个贡献（工具、提示词片段、变量、限制、监听器）要么是**全局**（对所有 agent 可见），要么是**作用域化**（只属于一个 scope key）。

关键术语：

- **scope key**：作用域的不透明身份，按对象身份比较。Harness 约定：**一个活 agent 就是它自己作用域的 key**。
- **agent context（`agent.ctx`）**：agent 的作用域上下文。通过它注册，既"作用域可见"又"作用域生命周期"——一个事实同时驱动两者。
- **shadowing（遮蔽）**：最具体者胜出的名字解析。一个作用域化的工具/片段/变量会为那个作用域替换同名全局项。这就是"按 agent 的人设（persona）"和"按 agent 的工具变体"机制。
- **restriction（限制）**：`tools.restrict` 过滤某个作用域的全局工具集（按交集组合）。

实际含义：

```ts
// 给某个 agent 注册一个只属于它的工具
agent.ctx.tools.register(defineTool({ /* ... */ }))
```

这个工具只对该 agent 可见，且随 agent dispose 拆除。

### isolate realm 与 preset

- **preset** 是含 `agent.cordis.yml` 的目录，为每个会话组合出 agent 的插件集。
- preset 行若**发布服务**，必须放进 entry 本地的 `isolate` realm，否则两个 preset 的同名服务会在 root realm 冲突。
- `persona` 行用 `deployment:persona` 片段遮蔽部署默认人设。

更完整的 preset/作用域机制见[「编排：子代理 / 工作流 / 目标」解读](/deepdive/10-orchestration)。

## 动态插件：运行时自修改

Harness 的一个独特能力是**agent 能检查、挂载、卸载自己的插件**（即本对话运行时的「动态 Cordis 插件」机制）。

相关概念：

- **Plugin**：一个可随时间修改的插件实例（`pluginId`）。
- **Package**：Plugin 下一个不可变的 Host/Client 源码版本（`packageId`）。
- **Run**：一次激活尝试（`pluginRunId`），连接审批、Host/Client 加载、私有 RPC、错误。

工作流：

1. `define`：定义第一个 Package（只校验、记录源码，不执行）。
2. `run`：激活某个 Package（首个激活、重启、回滚用 `run`；切换版本用 `update`）。
3. `stop` / `undefine`：停止（保留定义）/ 永久删除。

服务端暴露的能力由 `ctx.dynamicCordisRunner`（内存定义注册表、Host 半部 `node:vm` 沙箱、request-run 往返）与 `ctx.cordisInspect`（Host inspect provider 注册、镜像 Client manifest、路由 Client 查询）承载；模型侧通过 `tool-cordis` 的 `cordis_inspect/define/run/stop/undefine` 工具访问。

这套机制对应源码里的 `packages/extensions/`（`tool-cordis`、`cordis-host-runner`、`cordis-client-runner`、`ui-cordis`），详细拆解见[「编排」解读](/deepdive/10-orchestration)的 self-modification 小节。

## 进阶学习路径

到这里，教程部分完成。接下来：

- 进入[「项目解读」](/deepdive/01-overview)，把整个仓库逐层拆开。
- 推荐精读官方 [`docs/architecture.md`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)、[`docs/capability-seams.md`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/capability-seams.md)、[`docs/cordis-tutorial/`](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/cordis-tutorial)。
