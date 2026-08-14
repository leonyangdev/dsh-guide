# 6. 工具执行管线

工具调用是 Agent 与外部世界交互的通道，也是最需要把关的地方。DeepSeek Harness 把策略、钩子、沙箱、文件系统守卫、结果重写、最终结果观察和 UI 渲染**全部放进一条不改动循环的管线**里。

## 完整链路

```
模型消息含 tool-call 块
  -> 会话事件 tool/call（执行前记录）
  -> tools/pre-execute waterfall（钩子、权限、沙箱）
  -> 已注册的单调守卫（monotonic guards，只能 deny 或 abstain）
  -> tools/execute waterfall（超时、重试、指标 —— around dispatch）
  -> 工具 execute() 本体
       -> fs/write-intent 或 fs/edit-intent（仅 tool-fs 的变更）
  -> tools/post-execute waterfall（accept/block/replace/add context）
  -> 注册表外层规范化（管线/结果快照抛错 -> isError）
  -> ToolDefinition.finalizeContent（最后的纯内容不变量）
  -> tools/result（同步通知，冻结的权威结果）
  -> 会话事件 tool/result（单一模型可见结果）
```

## 三阶段调度器

loop 把模型的 tool-call blocks 解析为 `ToolExecutionInput{callId, name, arguments, agent, signal, parent?}`，按 `executionMode()` 分组：

- **exclusive**：barrier，一个接一个。
- **parallel**：只有 `isConcurrencySafe` 精确返回 `true` 才并行，进 `maxParallelToolCalls`（默认 10）滚动池。

每个调用先 `session.append('tool/call')` 记录 seq（结果需回引），然后：

1. **prepare**：`tools/pre-execute` waterfall（`PreToolDecision` allow/deny/ask，ask 经可选 `ctx.approval` 否则降级 deny）→ `guard()` 单调检查（任何 guard 返回 reason 即终局拒绝）→ 取消检查。
2. **dispatch**：`tools/execute` around-wrapper 可替换 signal（registry 保留原始 caller signal 并在 body 前重新熔合）→ body 返回规范 JSON 值（按 `output.schema` 校验，失败 `ToolOutputError`）。
3. **finalize**：`tools/post-execute`（可换 content 或 value 之一、block、附加 `additionalContexts`）→ 定义方 `finalizeContent`（恰好一次、只改 content、同步全量）→ 物化 lossless 冻结结果 → `tools/result` observe → loop `append('tool/result', {message, error?, meta?}, {surfaceOp:'append', sourceEventSeqs:[callSeq]})`。

`additionalContexts` 经 `deferContext` 放进 next-step inbox（post-result FIFO），以 `user/message` 形式注入到已记录的工具结果之后。

## 各环节的语义

### tools/pre-execute（waterfall）

策略前置。可以 allow / deny / ask。钩子（hooks）、权限（permission）、沙箱（sandbox）都在这层。

### 单调守卫（monotonic guards）

`ctx.tools.guard(ToolGuard)` 注册的守卫**只能拒绝、不能翻案**（deny 或 abstain），身份受保护。所有者的不可重排策略作为已注册守卫。文件系统的"先读后编辑"检查在 `tool-fs` 之下通过 `fs/*` 事件实现。

### ctx.approval

一次性审批：`pre-execute` 返回 ask 时走 `ctx.approval`；**没有应答者或应答不了就 deny**（fail-closed）。它处理询问，在单调守卫**之前**（见[「策略与交互」](/deepdive/11-policy-interaction)）。

### tools/execute（around wrapper）

超时、重试、指标等**环绕分发**关注点。守卫绕过（`dsh-guard` 的 timeout-policy）读 `ToolDefinition.timeoutMs`，用 `deadline(signal, ms, 'TOOL_TIMEOUT')` 合入信号——超时返回结构化 `TOOL_TIMEOUT` 结果（协作式，非硬杀）。

### 规范化与 finalizeContent

注册表对候选结果做 lossless 快照；快照失败则先把失败规范化（`isError`）。随后 `finalizeContent` 执行其同步、仅限内容的最后不变量（它已在快照中固定，不能改 value）。

### tools/result

观察不可变的、可 lossless JSON 的结果。这样钩子能跨工具族复用，而工具不必与某个策略服务耦合。

## 取消语义

- body 未启动 → `ABORTED_BEFORE_DISPATCH`。
- 已启动 → 成功结果可被 `ABORTED` 替换。
- 跳过的调用补合成 tool/call + tool/result 对，保证日志完整可重放。

## 工具/结果配对不变量

`tool/result.sourceEventSeqs` 回引 `tool/call` seq。工具调用与结果必须同 step 配对。工具规范值（canonical value）在执行期私有、**永不进日志**；只有 presentation content/meta 持久化。这是"模型可见 ⟺ 可重建"在工具维度的体现。

## Code Mode

`run_code` 保留传输及其序列化子调用也进这条管线：子调用携带父 token、记录 `tool/code-dispatch`、把拒绝呈现为有约束力的驳回、省略 `additionalContexts` 以保持调用与结果相邻。

## 下一步

- [核心包拆解](/deepdive/07-core-packages)——管线背后的 service 实现
