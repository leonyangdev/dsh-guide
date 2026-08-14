# 8. LLM、上下文与压缩

这一章覆盖模型调用、流式协议、系统提示词、上下文压缩、Web 访问、技能、类型图（Typert）。

## LLM 能力 seam（packages/llm）

`dsh-llm` 独占 Service Definition + Consumer 角色：**只定义词汇，不实现 provider**。核心是 `LlmRuntime`（`ctx.llm`）。

### 注册面

- `registerAdapter(providers, adapter)`：全有或全无（冲突抛 `LlmError('DUPLICATE_ADAPTER')`），返回 `AdapterRegistrationHandle`（带 `replace()` 原子换路由）。
- `registerConfigurableProviders()`：声明可配置 provider 目录。
- `registerModelDiscovery(ns, discover)`：端点探测。
- `listProviders()/listModels()/resolveModelInfo()/resolveCallConfig()/prepareCall()`：元数据与一次性调用绑定。
- 拓扑变更后发 `llm/adapters-updated`（emit）。

### 调用面

- `stream(options): AsyncIterable<StreamChunk>` 是唯一流式入口。
- `llm/stream` 是 waterfall 事件，可拦截/包装（缓存、日志、路由），监听者必须 `next()`。

### 消息词汇

- `Message`：不可变值（`MessageId` 品牌 + role + 内容块 + 类型化 `source`），构造器 `createMessage`/`createUserMessage`/`createAssistantMessage`/`createToolResultMessage`/`freezeMessage`。
- `ContentBlockMap`（merge-extensible）：`text/reasoning/image/tool-call/tool-result`。
- `MessageSourceMap`：`user/plugin/model/tool`；`ContextForm` 有 `instructions/catalog/snapshot/notice/relay/recall`。

### 流式 chunk 协议

`StreamChunk` 联合：`block-start / text-delta / reasoning-delta / tool-call-delta / block-end / usage / finish`。

- `finish` 是唯一终态；`FinishReasonMap` 为 `stop/tool-calls/max-tokens/aborted/error`。
- `TokenUsage` 的 input/cacheRead/cacheWrite 计数互斥。
- `BlockAssembler` 是唯一 chunk→block 组装器，产出带 `ModelMessageSource` 的冻结 assistant 消息。

### 适配器接口与错误

- `LlmAdapter` 抽象基类只需实现 `stream()`，可覆写 `providerRetryPolicy()/providerInfo()/listModels()/resolveModel()`。
- 错误体系 `HarnessError→LlmError`（稳定 `code` + 可序列化 `failure`），常量 `CONTEXT_WINDOW_EXCEEDED_CODE`/`QUOTA_EXCEEDED_CODE`/`EMPTY_RESPONSE_CODE`/`INVALID_CREDENTIAL_CODE`。

### 两个内置适配器

- **llm-deepseek**：注册唯一路由 `deepseek-official`，直连 fetch + `eventsource-parser` SSE；`reasoning_content→reasoning-delta`、`tool_calls→tool-call-delta`（参数保持原始 JSON 串）；`resolveAdapterOptions()` 每次调用经 thunk 重读（settings/credentials 动态生效）；错误码 `AUTH/QUOTA/RATE_LIMIT/CONTEXT_WINDOW_EXCEEDED/TRANSPORT/ABORTED/STREAM_CLOSED/MALFORMED_RESPONSE/EMPTY_RESPONSE`；请求带 attribution header 与 `x-deepseek-harness-compact`。
- **llm-pi-ai**：Pi AI 适配器（不同 API 格式）。

## 系统提示词（core/system-prompt）

基于 `ScopedLayers`（global + per-scope 链，同名就近遮蔽），已在[「核心包拆解」](/deepdive/07-core-packages)介绍。`renderContextSnapshot()` 生成 "Current runtime context. This snapshot supersedes earlier runtime-context snapshots." 快照。

## 上下文压缩（compaction）

### 抽象层（dsh-compaction）

- `CompactionEngine`（`ctx.compaction`）：`compactIfNeeded(agent, trigger: 'pressure'|'context-overflow', signal)`、`compactNow`、`compactRegion(start,end)`。
- `CompactionResult`：`compactionId/shadowedRange/shadowedSeqs/shadowedTokenCount`。
- `toolPairingBalancedBefore/After()`：保证切口不跨未闭合的 tool-call/result 对。
- 会话事件（log-only、无 surfaceOp）：`compaction/start`（持锁）、`compaction/summary`、`compaction/end`（放锁）、`compaction/prune`。
- surface 上唯一变更是一条带 `surfaceOp:{op:'replace',start,end}` 的 `user/message`；`deriveMessages()` 把摘要渲染为用户角色消息。

### 基本实现（dsh-compaction-basic）

- 压力策略：`agent/pre-step` 监听做 token 压力检查（`ctx.tokenMeter` 计价），`agent/request-error` 监听做 context-overflow 恢复。
- `thresholdRatio` 0.8、保留尾部 `retainRatio` 0.16。
- `summarize()` 是唯一子类钩子：一次直达 `ctx.llm.stream()`（`purpose:'compaction'`），逐字重放系统提示 + 工具 + 被遮蔽消息以复用 KV cache，只取文本块，输出包 `<compacted-summary>` 标签。
- 可选 `ctx.toolResultPruner` 无模型预剪枝；`command-compact` 暴露 `/compact` 人类命令。

## Token 计量（token-meter）

`ctx.tokenMeter` 拥有按会话隔离的回放折叠区，压力消费方共享不可变且带修订版本的测量结果。

## Web 能力（packages/web）

`WebRuntime`（`ctx.web`）是 search + fetch 双操作单 seam：

- `registerSearchProvider/registerFetchProvider`（重复 id 抛 `WebError('WEB_DUPLICATE_PROVIDER')`）。
- `search(request, signal)`/`fetch(request, signal)` 执行期选择 provider（显式 id 或唯一可用者自动）。
- 词汇：`WebSearchRequest{query,maxResults}→WebSearchResult{content,sources[],truncated}`、`WebFetchRequest{url}→WebFetchResult{url,statusCode,body,truncated}`。
- Provider：exa/perplexity/deepseek 搜索 + `web-fetch-http`。
- **tool-web** 是唯一模型消费方：注册 `web_search`/`web_fetch`（snake_case 参数、并发安全），同时 `ctx.systemPrompt.section({name:'tool:web_search', order:110})` 注入指引；从不 import 具体 provider。

## Skill 能力（packages/skill）

- `SkillRegistry`（`ctx.skills`）：`registerProvider(create)`（同步工厂）、`snapshot({cwd,signal,scope})→{skills, complete}`、`list()/get(name)`、`register()`（运行时内嵌技能，rank 250）。
- 调用策略 `invocation:{modelInvocable, userInvocable}` 双轴独立。
- `renderSkillContent()` 是 `<skill_content>` 渲染的唯一真源。
- **skill-filesystem**：按 rank 扫描项目/自定义/用户根（`.dsh/skills`、`.agents/skills`、`$DSH_HOME/skills` 等），解析 `SKILL.md` frontmatter，Chokidar watch + `fs/observed` 快速失效。
- **tool-skill**：`agent/pre-step` 渲染 durable `<system-reminder>` 技能目录，注册 `skill` 工具，支持用户 `/name` 手势注入 `skill_content`。

## Typert（packages/typert）

四件套分离「源码分析 / 运行时 / 发现 / 协议」：

- **generator**（构建期）：`WorkspaceAnalyzer` 从 tsconfig 建 `ts.Program`，产出 `FaceModel/TypeGraph`，`FaceModelEmitter` 生成含 Zod schema 的 `TYPERT` 清单（`lib/typert.host.{js,d.ts}`）。
- **registry**（`ctx.typert`）：`TypertRegistry.register(contribution)` 原子登记 `<package>#<face>` 反射与 `<package>#<name>` 活 schema。
- **loader**：消费 `ctx.loader`+`ctx.typert`，扫描 Loader 条目、import `./typert` 导出并校验清单。
- **protocol**：`@Remote/@RemoteScope` 装饰器、`TypertRemoteService`、`InvocationDescriptor`，供 api/gateway 的 Remote RPC 网关使用。

## 与 core 的对接

- `ctx.llm`：agent-loop 每步先 `systemPrompt.assemble()`，经 `agent/request` waterfall 定 provider/model，再 `prepareCall()` → `llm.stream()`；`request/header` 会话事件记录有效配置。
- `ctx.tools`：tool-web/tool-skill 等 Consumer 经 `ToolRuntime.register` 注册模型工具。
- `ctx.systemPrompt`：指引 section 与 `tools()` 汇入 `GenerateOptions.system/tools`。
- `Message` 词汇同时被 dsh-session 持久化日志与 dsh-llm 请求共用，保证「模型可见 ⟺ 可重建」。

## 下一步

- [执行层：Shell / 沙箱 / 文件系统](/deepdive/09-execution)
