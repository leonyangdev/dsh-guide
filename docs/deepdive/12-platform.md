# 12. 平台接入与 SDK

这一章覆盖三条进程外接入通道（Web BFF、stdio JSON-RPC、ACP）以及它们的运行时基础。

## 整体格局

```
apps/cli      dsh 产品启动器（@deepseek-ai/dsh）
apps/web      Web shell 的 Vite 入口（薄壳，真正 shell 在 packages/client/web）
packages/api  远程 BFF + Typert RPC 网关
packages/sdk  进程外 JSON-RPC 协议 + server + TypeScript client
packages/acp  automation-only Agent Client Protocol server
packages/host Web GUI 的 Host 半边（API gateway + HTTP 路由）
packages/client Web GUI 的浏览器半边（shell/wire/对象服务/Slots/ui-*）
```

## apps/cli（dsh 启动器）

已在[「Profile / Bundle 组合机制」](/deepdive/03-profile-bundle)介绍。要点：

- `src/args.ts` 拥有命令语法，`src/bin.ts` 只加载所选 runner。
- launcher 只解析自己的旗标，其余交给 booted profile 里的 app 插件（`dsh-cmdline` 的 `ctx.cmdlineArgs` 共享不可变快照）。
- 无效命令/其它模式的选项/配置错误/启动失败都非零退出。

## apps/web（Web shell）

`src/main.ts` 只是"找到 `#root` 然后 `new AppWebEntry(el).run()`"的薄壳。真正 shell 库是 `packages/client/web`：

- `AppWebEntry`、`AppRoot`、`app-shell.ts`、`loader-status.ts`、`seed.ts`（静态模块表）、`platform.ts`。
- `apps/web/tests` 用真实 Chromium 驱动真实 web 组合做 browser e2e。

## Web GUI 的 Host / Client 半边

- **host**：API gateway + HTTP route server。`ctx.apiProxy`（apiproxy）是传输无关的 Host 网关接口：分派浏览器 API 调用，每条打开的 Host 流自行订阅转发事件。
- **client**：`ctx.clientModules`（modules）通过增量 `dsh.client` 扫描组合 `__DSH_BOOT__` 入口图；`ctx.webServer`（webserver）是普通 `node:http` 载体（具名路由注册表 + 静态 dist 回退）。

## packages/api（远程 BFF + Typert RPC 网关）

- **remotes**：Host/Client 双侧 BFF。Host 侧 `createApiRemoteAgentResolver()` 统一 Agent/Session 身份策略（复用活 agent、恢复冷 session、去重并发 resume、保留 subagent 所有权围栏）；Client 侧挂载 Goal Remote 与只读插件清单。`API_REMOTE_FORWARDED_EVENTS` 是唯一转发白名单。
- **gateway**：Typert RPC 端点。Host 侧 `TypertGatewayService`（`ctx.typertGateway.invoke()`，strict 模式读 `InvocationDescriptor`，业务方法标 `@Remote`/`@RemoteScope`），在 Connection 共享 `/api` FetchHandler 上注册 trusted-host 拦截器；Client 侧 `ClientRemote`（`ctx.remote.$mount/$on/$dispatch`）经 `ctx.connection.rpc.call('/api', endpoint, …)` 调用。
- `api-remotes` 是唯一双 tsconfig face 包。

## packages/sdk（JSON-RPC）

进程外驱动协议栈：

- **protocol**：`JsonRpcLineTransport`（换行分隔 JSON-RPC 2.0 单帧）；方法 `initialize/session/prompt/shutdown`，通知 `session.event/session.status/subagent.started/subagent.finished`；`serverInfo.name` 固定 `deepseek-harness-sdk-runtime`，无版本协商。
- **server**：`HarnessSdkJsonRpcServer` 插件（stdio、stdout 纯净、`shutdown`→dispose→exit 0）。
- **client**：TS 客户端——高层 `DeepSeekHarness`（owned-run API：`run()` 从 inbox 回执等到下一个整 agent idle，返回 `RunResult{sessionId,finalResponse,events,notifications}`；`close()` 走 stdin-EOF→SIGTERM→SIGKILL 阶梯）与低层 `HarnessClient`；类型化错误 `JsonRpcResponseError/RequestTimeoutError/SdkProtocolError/TransportClosedError`；被 `subagent-dsh-sdk` 后端复用。

## packages/acp（ACP）

automation-only 的 [Agent Client Protocol](https://agentclientprotocol.com) 服务器：

- `AgentSideConnection` 挂在 stdin/stdout 上驱动 `ctx.agents`。
- `initialize` 只声明 baseline prompts（无 image/audio/embedded/MCP/文件系统能力）；`authenticate` no-op。
- `session/new` 只建全新 agent（绝对 cwd，非空 additionalDirectories/mcpServers 拒绝）。
- `session/prompt` 拼合文本块、每会话单在途请求、等整 agent idle，正常 `end_turn`、取消 `cancelled`。
- `session/request_permission` 提供一次性 allow/reject。
- **刻意只出已提交消息**（不做 token 级流式），无 load/list/resume/fork。

## examples（可运行面）

`packages/examples/` 是 demo/reference bundle：

- **agent-spine-demo**：无执行器、无 UI 的默认 agent 骨架单 bundle 插件，子挂载 timer/llm/session/session-title/system-prompt/tools/skill/agent/goal/agent-loop 等，把 adapter、shell 执行器、LLM 标题提供方、入口点**留在 bundle 外**（三段式落到组合层）。
- `acp-demo`、`jsonrpc-demo`（外部配置的 JSON-RPC 运行时 bin）。
- 仓库根 `examples/` 是可运行 `cordis.yml` 叶子：`headless-agent`、`acp-agent`、`jsonrpc-agent`、`web-cordis`、`web-schedule`。

## 下一步

- [Python / 原生 / Vendor](/deepdive/13-python-native-vendor)
