# 7. 核心包拆解

`packages/core/` 是产品 API 脊柱。这一章把 8 个子包逐个拆开，讲清它们「拥有什么」和「如何连接」。

依赖方向是单向的：`scope` ← `session` ← `system-prompt` ← `tools` ← `agent` ← `agent-loop`。

## dsh-scope（作用域原语，无 ctx 键，纯函数）

作用域是"按 agent 注册"的基础设施。

- `createScope(ctx, key)`：在调用方 fiber 下 `ctx.plugin()` 一个空插件，得到 `Scope { ctx, rawDispose, dispose() }`。通过 `Scope.ctx` 的注册"既可见于该作用域，又随其生命周期销毁"。
- `scopeOf(ctx)`：读标签（derived context 继承，最近标签胜出）。
- `scopeTarget(base, key)`：构造不透明 carrier；事件 admission 沿 `bindScopeParent` 父链**向上**（祖先监听者收到后代事件），注册视图沿链**向下**继承（最近遮蔽最远）。
- `ScopedLayers`/`NamedEntries`/`AnonymousEntries`：供各服务实现 scope-aware registry 的共享存储。

**关键契约**：注册上下文同时决定可见性与所有权；scope 是路由机制，**不是安全/权限边界**。

## dsh-session（`ctx.sessions`：SessionStore）

事件溯源会话日志，已在[「会话日志与持久化」](/deepdive/05-session-log)详述。这里补充类型词汇：

- `Session`、`SessionId`、`SessionEventMap`、`TurnEndReasonMap`。
- 事件词汇：`turn/start|end`、`step/start|end`、`user/message`、`assistant/chunk|message`、`tool/call|result`、`request/header|context`、`todo/write`、`agent/inbox/spliced`（由 dsh-agent 合并）等，`SessionEventMap` 可声明合并扩展。

## dsh-system-prompt（`ctx.systemPrompt`：SystemPrompt）

- 四类有序贡献：`section()`、`context()`（动态上下文，最终渲染成 durable user-role 快照）、`variable()`、`tools()`。
- `assemble(context)` 产出 `PromptAssembly { sections, tools, variables }`。
- `system-prompt/assemble` waterfall 是最终权威（complete section 在 waterfall 后强制恢复为唯一 section）。
- `renderPrompt()` 做严格 `{{var}}` 插值。
- `tools()` 只读注入 `systemPrompt`，注册为 tool provider 自动喂 schema。
- 约定 order：`-100` 是 `harness:identity`，`0` 是 `deployment:persona`，工具指引用 `100–199`。

## dsh-tools（`ctx.tools`：ToolRuntime）

- `register(ToolDefinition)`、`presentAs(mode)`、`restrict(filter)`、`get(name, scope?)`、`schemas(scope?)`、`guard(ToolGuard)`、`execute(exec)`、`executionMode(exec)`。
- `ToolDefinition` = schema + 必填 `output { schema, render, presentationMeta? }` + `execute(args, exec)`，可选 `finalizeContent`/`timeoutMs`/`isConcurrencySafe`/`presentCall`/`presentResult`。
- 事件：`tools/pre-execute`（waterfall）、`tools/execute`（around）、`tools/post-execute`、`tools/code-dispatch-log`、`tools/result`（observe-only）、`tools/change`（非 scope 过滤）。

## dsh-agent（`ctx.agents`：AgentRegistry，接口 `Agent`，`AgentFactory`）

零循环依赖的 Agent 句柄与 `agent/*` 事件词表。

- `register`/`get`/`list`/`roots`/`setFactory`/`create`/`resume`（返回 `AgentHandle { agent, dispose() }`）。
- `currentInitiator`/`requireInitiator`/`withInitiator`/`withoutInitiator`：AsyncLocalStorage 进程内发起人作用域。
- `Agent { id, options, session, inbox, status, ctx, cancel(cause, {keepInbox}), whenIdle(), runMaintenance(task), send(msg, target, wakeup), followup/steer/inject }`。
- 事件：`agent/created|disposed|status|session-start`、`agent/inbox/inserted|claimed|discarded`、waterfall 类 `agent/pre-step`（返回 `PreStepDecision`）、`agent/request`、`agent/request-error`（retry 恢复）、`agent/turn-stopping`（serial）、`agent/error`。

**持久边界仍是 session 事件，`agent/*` 只做实时协调。**

## dsh-agent-loop（`ctx.agentLoop`：AgentLoop，实现 AgentFactory）

唯一具体循环，已在[「回合与步骤生命周期」](/deepdive/04-turn-step-flow)详述。

- `create(id, options, meta)` 与 `ctx.agents.create/resume`（rollback-covered 事务：构造私有 session+agent+scope → 可选 setup → 双 registry enter → 先 `session/created` 后 `agent/created` → `agent/session-start` → 启动 driver）。
- config：`agents[]`（id/provider/model/maxTokens/cwd/sessionId/resumeSessionId）+ `maxParallelToolCalls`（默认 10）。
- 内部 `ReactLoopAgent`、inbox、scheduler 均为包私有。

## 两个薄入口包

- **dsh-agent-default-model**（`ctx.agentDefaultModel`）：`currentSelection()`/`saveSelection()`，给无 session 选择的新 Agent 提供进程级默认（`settings` 分层默认 `ModelSelection`）。
- **dsh-agent-tool-presentation**：preset 里一行，调 `tools.presentAs()` 为该 agent 选 native/code/both，并等待 host 平面 `ctx.codeRuntime`。

## 包间数据流

```
setup 注册（agent.ctx）
  -> pre-step 组装（systemPrompt.assemble -> tools.schemas + sections）
  -> 请求（request/header 快照 + deriveMessages 历史）
  -> 流式响应（chunk 日志）
  -> assistant/message
  -> 工具调度（tool/call 日志 -> 完整管线 -> tool/result 日志 + deferred context 入 inbox）
  -> 下一 step
```

持久化插件订阅 `session/event` 写后读、`session/flush` 屏障；UI 读 `session/event` + `agent/*`。

## 最重要的设计决策

1. **Model-visible ⟺ logged**：`request/header` 快照（system/tools/config）让非历史请求也能精确重建。
2. **Append-only 日志是唯一真相**，surface replace 只遮蔽不删除。
3. **注册即作用域**：可见性与所有权绑定同一 context（`agent.ctx`）。
4. **守卫单调**：`guard()` 只能拒绝不能翻案。
5. **agent-loop 是唯一循环逻辑**，新行为进插件扩展点；`Agent` 接口零循环依赖，loop 可替换。

## 下一步

- [LLM、上下文与压缩](/deepdive/08-llm-context)
