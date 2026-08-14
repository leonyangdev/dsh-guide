# 14. 事件与能力 Seam 全景

这一章把整个项目的**服务地图**一次性摊开：每个 `ctx` 服务是什么角色、由哪个包拥有、有哪些实现与消费方。这是理解"一切皆插件"的最直接索引。

> 完整机器生成图见官方 [`docs/capability-seams.md`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/capability-seams.md)（含 Mermaid 依赖图 + 完整表格）。

## 角色分类

- **core**：主干服务（不实现 provider，是注册表/协调者）。
- **seam**：可替换能力（Service Definition + Provider + Consumer 三段式）。
- **bundle**：组合点。

## 核心主干服务（core）

| ctx 键 | 拥有包 | 说明 |
|---|---|---|
| `ctx.sessions` | `session`（core） | 只追加 Session 实例 + 持久会话事件流 |
| `ctx.systemPrompt` | `system-prompt`（core） | 每步收集 prompt 片段与工具 schema |
| `ctx.tools` | `tools`（core） | 工具注册表 + 守卫执行管线 |
| `ctx.agents` | `agent`（core） | 活 Agent 句柄、创建/恢复工厂、发起人传播 |
| `ctx.agentLoop` | `agent-loop`（core） | 唯一具体循环插件 |
| `ctx.agentDefaultModel` | `agent-default-model` | 进程级默认模型选择 |
| `ctx.goals` | `goal` | 同会话目标域 |
| `ctx.invariants` | `invariants` | 包所属运行时不变式注册表 |
| `ctx.typert` | `typert-registry` | 运行时类型注册表 |
| `ctx.typertGateway` | `api-gateway` | Typert Host 调用网关 |
| `ctx.commands` | `commands` | 人类命令注册表 |
| `ctx.planMode` | `plan-mode` | 计划协作状态 |
| `ctx.agentPresets` | `agent-presets` | 每会话 agent 组合 |
| `ctx.sessionProjections` | `session-projection` | 会话投影单元 |
| `ctx.sessionProjectionCache` | `session-projection-cache` | 持久化投影缓存 |
| `ctx.tokenMeter` | `token-meter` | 回放 token 计量 |
| `ctx.toolResultPruner` | `compaction-tool-result-pruner` | 无模型工具结果剪枝 |
| `ctx.permissionPresets` | `permission-presets` | 权限预设表 |
| `ctx.sandboxPolicy` | `sandbox-policy` | 沙箱策略 home |
| `ctx.shellEnv` | `shell-env` | 受管 bash 环境注册表 |
| `ctx.storage` / `ctx.storageDomain` | `storage` / `storage-domain` | 非会话存储 hub / 领域数据 |
| `ctx.workspaceRegistry` | `workspace` | 工作区实体注册表 |
| `ctx.messageFeedback` | `message-feedback` | 逐消息反馈 |
| `ctx.webServer` | `webserver` | HTTP 路由注册 |
| `ctx.clientModules` | `modules` | 客户端插件图 host |
| `ctx.apiProxy` | `apiproxy` | 传输无关 Host 网关 |
| `ctx.dynamicCordisRunner` / `ctx.cordisInspect` | `cordis-host-runner` | 动态插件 runner / inspect 注册表 |

## 能力 seam（seam）

| ctx 键 | 定义包 | 实现（provider） | 消费方 |
|---|---|---|---|
| `ctx.llm` | `llm` | `llm-deepseek`、`llm-pi-ai`、`llm-replay` | `agent-loop`、`compaction-basic` |
| `ctx.sessionPersistence` | `session-persistence` | `-jsonl`、`-sqlite` | `agent-loop`、`tool-bash`、hooks、query |
| `ctx.sessionQuery` | `session-query` | `session-query-sqlite` | `session-reference`、`tool-session-query` |
| `ctx.sessionTitle` | `session-title` | `first-prompt-llm`、`all-prompts-llm` | — |
| `ctx.sessionTelemetry` | `session-telemetry` | `session-telemetry-otel` | — |
| `ctx.settings` | `settings` | `settings-file` | LLM 适配器、apiproxy |
| `ctx.credentials` | `credentials` | `credentials-local` | LLM 适配器、apiproxy |
| `ctx.storage` | `storage` | `storage-json`、`storage-sqlite` | `storage-domain` |
| `ctx.skills` | `skill` | `skill-badge`、`skill-filesystem` | `tool-skill` |
| `ctx.subprocess` | `subprocess` | `subprocess-local`、`subprocess-e2b` | bash/terminal/lsp/subagent providers |
| `ctx.shell` | `shell` | `bash-local`、`bash-sandbox`、`pwsh-local` | `tool-bash`、`tool-pwsh`、hooks |
| `ctx.terminals` | `terminal` | `terminal-bash` | `tool-terminal` |
| `ctx.sandbox` | `sandbox` | `sandbox-local` | `bash-sandbox`、`terminal-bash` |
| `ctx.codeRuntime` | `code-runtime` | `code-runtime-worker` | `tools`（Code Mode） |
| `ctx.fs` | `fs` | `fs-local`、`fs-sandbox`、`fs-e2b` | `tool-fs`、`fs-observation-policy` |
| `ctx.compaction` | `compaction` | `compaction-basic` | `compaction-basic` |
| `ctx.subagents` | `subagent` | spawn/fork/acp/codex/claude-code/dsh-sdk | `tool-subagent`、`tool-subagent-control`、`tool-ralph` |
| `ctx.jobs` | `jobs` | `jobs-local` | `tool-bash`、`tool-terminal`、`tool-subagent`、`tool-jobs` |
| `ctx.web` | `web` | exa/perplexity/deepseek search + http fetch | `tool-web` |
| `ctx.spillStore` | `spill` | `spill-local` | `spill-policy` |
| `ctx.workflowEngine` | `workflow` | `workflow-worker-thread` | `tool-workflow`、`tool-ralph` |
| `ctx.lsp` | `lsp` | `lsp-local`（stdio 宿主） | `tool-lsp` |
| `ctx.approval` | `approval` | `acp` | `tools`、`tool-bash` |
| `ctx.userQuestions` | `user-questions` | — | `tool-ask-user` |
| `ctx.attachments` | `attachment` | `attachment-local` | `host-runtime`、`llm-pi-ai` |
| `ctx.directoryPicker` | `directory-picker` | `-native`、`-browse` | `apiproxy` |
| `ctx.e2b` | `e2b` | — | `fs-e2b`、`subprocess-e2b` |

## 事件域

三类事件（详见[「回合与步骤生命周期」](/deepdive/04-turn-step-flow)）：

1. **会话事件**：`turn/*`、`step/*`、`user/message`、`assistant/chunk|message`、`tool/call|result`、`request/header|context`、`todo/write`、`compaction/*`、`hook/invoked|result`、`fs/observed`、`permission/preset`、`plan/mode`、`goal/change`、`session/title` 等——持久、跨重载。
2. **Agent 事件**（`agent/*`）：`inbox/*`、`status`、`pre-step`（waterfall）、`request`（waterfall）、`request-error`（waterfall）、`turn-stopping`（serial）、`error` 等——实时协调。
3. **能力事件**：`fs/*`、`tools/*`、`telemetry/*` 等——给 seam 附加策略/适配器。

## 读这张地图的方式

- 想知道"怎么加一个模型 provider" → `ctx.llm` 注册适配器。
- "怎么加一个能力" → 设计三段式 seam，Consumer 注册到 `ctx.tools`。
- "怎么拦截" → 找对应 `agent/*` 或 `tools/*` waterfall。
- "怎么持久化" → 扩展 `SessionEventMap` + 订阅 `session/event`。

这张地图就是官方 architecture.md 的"Where new behavior goes"表的展开。

## 下一步

- [源码导读](/deepdive/15-how-to-read-source)——从这张地图回到具体文件
