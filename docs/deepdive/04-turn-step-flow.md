# 4. Agent 回合与步骤生命周期

这是整个框架的「心脏」：装配出来的插件树如何驱动一个 Agent 完成一次对话。

## 三个时间单位

| 单位 | 定义 |
|---|---|
| **turn（回合）** | 一次对已认领输入的排空，在模型和其工具停止、或某个终结策略介入后结束。一个 turn 包含零到多个 step。 |
| **step（步骤）** | 一次模型请求 + 其响应触发的工具执行。 |
| **round（轮）** | 更外层的策略迭代（如 goal round、Ralph round），计数器属于那个策略，不统计每个 turn。 |

## 两种事件域

- **持久的会话事件**（`turn/*`、`step/*`、`user/message`、`assistant/*`、`tool/*`）：追加到日志，跨重载存活。
- **实时的 `agent/*` 事件**：携带活的 `Agent`，用于观察/拦截进行中的工作。

## 回合流程

```
turn/start
  认领 next-step 输入 + 一条排队消息
  装配 prompt 片段 + 工具 schema
  -> agent/pre-step                    reject | enter(messages)
     reject，或首个 enter 被改写成空 -> 不花 step 就关闭回合
     step/start
     追加 enter 的消息为 user/message
     从日志派生模型历史
     agent/request -> llm/stream -> assistant/chunk* -> assistant/message
     tool/call* -> tools/pre-execute -> tools/execute -> tools/post-execute -> tool/result*
     step/end
     工具欠另一次请求，或 next-step 输入到达 -> 认领 -> 下一步
  -> agent/turn-stopping
turn/end
```

### 逐步解释

1. **输入进入 driver**：所有输入通过一个 inbox。有些消息立即唤醒它；注入的上下文在 inbox 里等待，直到另一条消息唤醒。
2. **`agent/pre-step` 决定模型看到什么**：监听器可以改写被认领的消息，或直接拒绝。被拒绝/清空的首个认领仍关闭一个不花 step 的持久回合（日志记录这次尝试）。
3. **每个 step 读取插件注册的 prompt 片段与工具 schema**。
4. **请求走 `agent/request`（waterfall）→ `llm/stream`（waterfall）**，chunk 逐条追加为 `assistant/chunk`，汇总成 `assistant/message`。
5. **工具调用走完整管线**（见[「工具执行管线」](/deepdive/06-tool-pipeline)）。
6. **step 结束**；若工具欠另一次请求（如工具结果需要模型再决策）或 next-step 输入到达，就认领下一步。
7. **`agent/turn-stopping`（serial，无 `next()`）**在自然停止且 next-step inbox 为空时兜底（数据决定：steer 可以再开 step）。
8. **`turn/end`** 记录原因：`completed`/`aborted`/`blocked`/`error`/`max-tokens`/`interrupted`。

## 哪个是 waterfall，哪个是 serial

- `agent/pre-step`、`agent/request`、`llm/stream`、`tools/pre-execute`、`tools/execute`、`tools/post-execute` 是 **waterfall**，监听器必须 `next()`。
- `agent/turn-stopping` 是 **serial**，没有 `next()`。

## 一个 step 内部的细节（来自 dsh-agent-loop）

`step()` 的编排：

1. `buildRequest()` 走 `agent/request` waterfall 取配置。
2. `llm.prepareCall` 物化 adapter 默认（冻结路由 + 重试策略）。
3. 先追加 `request/header`（`initial`/`resume`/`change` 快照，含 system/tools/config）——这让**非历史请求也能精确重建**（见[「会话日志」](/deepdive/05-session-log)）。
4. `llm.stream(request)` 逐 chunk 追加 `assistant/chunk`。
5. `BlockAssembler` 汇总，成功追加 `assistant/message`（`sourceEventSeqs` = chunk seqs，`[]` 表示已知空流）。
6. 有 tool-call 则 `executeToolCalls`，返回 null（有待工具继续）或 completed/max-tokens 结束 step。
7. 失败进 `agent/request-error` waterfall，监听器返回 `{kind:'retry'}` 则 continue 重试。

## 取消与错误恢复

- `Agent.cancel(cause, {keepInbox})` 是取消原语。
- `agent/request-error` 是恢复扩展点：`dsh-compaction-basic` 在此监听 `context-overflow`，先做可选工具结果剪枝，再选摘要；只有剪枝或摘要推进了 surface 替换代际时才开全新重试回合，否则保留原始错误。

## 给插件作者的含义

- **拦截请求/工具/回合**：用 `agent/*` 或 `tools/*` 事件；`agent/turn-stopping` 停一个回合。
- **加模型可见上下文**：调 `agent.inject()`，它会落到下一次被接纳的请求里。
- **可回放 transcript**：消费 `session/event`；`agent/*` 是队列/状态/拦截/steering/继续/错误处理的实时协调接口。
- **steering（中途引导）与注入上下文**：在后续认领取得 next-step 批次后，经过同一个 `agent/pre-step` waterfall。

## 下一步

- [会话日志与持久化](/deepdive/05-session-log)——这些事件如何变成"唯一真相"
- [工具执行管线](/deepdive/06-tool-pipeline)——工具调用如何被策略、守卫、沙箱层层把关
