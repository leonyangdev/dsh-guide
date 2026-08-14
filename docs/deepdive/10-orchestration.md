# 10. 编排：子代理 / 工作流 / 目标

这一章覆盖 Agent 之上的编排层：子代理委派、工作流引擎、todo/plan/goal、preset 组合、守卫、运行时自修改、hook 桥。

## subagent（`ctx.subagents`）

`SubagentRuntime extends Service` 是 Service Definition：

- `registerProvider/getProvider/list` 管理命名 provider。
- `start(name, request)`：一次性委托（one-shot），返回 holder-owned `SubagentRun`。
- `startContinuable(spec)`：可续子代理（持久 Session + 进程内唯一 Activation，以 Agent inbox 为唯一 FIFO）。
- `followup(parent, childId, content)`：投递后续轮次；`interrupt`：停止当前轮；`reportFrom`：收子报告；`listChildren/listDescendants`：枚举。
- 事件：`subagent/start`/`subagent/end`（共享 runId）、`subagent/provider-added/removed`；持久描述符事件 `subagent/descriptor`。
- 深度：`delegationDepth` 存 SessionHeader，`assertSubagentMaxDepth` 限深。

**Providers**：

| Provider | 说明 |
|---|---|
| `subagent-spawn-in-process` | fresh child，空会话，共享驱动，具备 outputSchema/depthLimit/toolFilter/persona 四能力 |
| `subagent-fork-in-process` | seed = 截至最后 `turn/end` 的平衡前缀 |
| `subagent-acp` | 子进程 ACP：spawn→initialize→newSession，无本地能力，permission: reject |
| `subagent-codex` | `codex app-server --stdio` + ephemeral thread，取 `final_answer` |
| `subagent-claude-code` | 官方 SDK `query()` |
| `subagent-dsh-sdk` | 完整 harness 运行时走 JSON-RPC |

**委托策略**：`captureDelegatedPolicyOverrides`/`appendDelegatedPolicyOverrides` 把子代理 approval 钉为 `'never'`、固定 sandbox 覆盖。

**Consumers**：`tool-subagent`（subagent 工具，foreground/background one-shot/continuable）、`tool-subagent-control`（send_message/interrupt_agent/list_agents，经 `Agent.followup()`）、`tool-subagent-report`（子作用域 `report` 工具）。

## workflow（`ctx.workflowEngine`）

`abstract class WorkflowEngine extends Service`：

- `start(request): WorkflowRun`；result 永不 reject，`WorkflowResult{value,stopReason,error,agentsStarted}`。
- `WorkflowError` 带 code + fatal（SCRIPT_PARSE/META_INVALID/AGENT_CAP/AGENT_START/CANCELLED 等）。
- 事件 `workflow/start/end/phase/log/agent-start/agent-end`。

`workflow-worker-thread`：每 run 一个 worker 线程，脚本内 `node:vm`（仅塑形 API，**非安全边界**）；hooks `agent/parallel/pipeline/phase/log`；上限 maxConcurrentAgents/maxTotalAgents/maxItemsPerCall，`terminate()` 兜底。

Consumers：`tool-workflow`（meta/script/args + 引导段）、`tool-ralph`（固定 fresh-agent 循环：每轮新子代理收 objective + 结构化 handoff，报告 `continue|complete|blocked`）。

## todo / plan / goal

### todo（tool-todo）

`todo_write` 整表替换，`todo/write` 事件 last-write-wins，`allowParallelInProgress` 部署策略；投影单元 `todos` 在 `turn/start` 清空。

### plan（plan-mode）

`plan/mode{active}` 为 logged state，`ctx.planMode.set/get`；命令 `/plan [msg]`、`/plan off`；`exit_plan_mode` 工具经 `ctx.userQuestions` 走 `plan-review` intent 审批；投影单元 `plan`。

### goal（`ctx.goals`）

- `ctx.goals` 事件源（`goal/change` 快照 + tombstone），`GoalRef{id,revision}` CAS。
- 动词 create/edit/pause/resume/complete/block/clear + `disarm()`（激活仅进程内）。
- `tool-goal`：get_goal/create_goal/update_goal，blockedAfterConsecutiveRounds，需 `{kind:'user'}` 人证。
- `goal-round-driver`：空闲时以 `GoalMessageSource` 排队 `<goal_round>` 轮次并 flush 检查点。

## preset（agent-presets，`ctx.agentPresets`）

- preset = 含 `agent.cordis.yml` 的目录；roster 扫描 roots（含派生 `<dshHome>/.agent-presets` user root）。
- standing mount 每进程一次，会话经 dsh-scope parent 链（agent→preset→global）加入。
- `mount()` 在 agent 工厂 setup hook（未发布时）调用；`composeFrom` 供子代理绑定父 composition；`recompose` 仅限空会话。
- **isolate realm**：preset 行若发布服务必须放入 entry 本地 `isolate` realm，否则两 preset 同名服务在 root realm 冲突。
- `persona` 行以 `deployment:persona` 段 shadow 部署人设（text/complete/includeRuntimeContext）。

## guard（`packages/guard`）

- **repeat-tool-reminder**：`WeakMap<Agent, Chain>` 按 (工具名, canonical args) 计数，`tools/post-execute` 监听，thresholds [3,5,8] 注入 escalating `additionalContexts`。
- **timeout-policy**：`tools/execute` 包装器读 `ToolDefinition.timeoutMs`，超时返回结构化 `TOOL_TIMEOUT` 错误结果（协作式，非硬杀）。

## 运行时自修改（packages/extensions/）

对应 AGENTS.md 里的 `self-modification/`。动态 Cordis 插件机制（本对话运行时的「动态插件」能力）：

- **`tool-cordis`**：`cordis_inspect/define/run/stop/undefine` 五个模型工具。
- **`cordis-host-runner`**（`ctx.dynamicCordisRunner`）：内存定义注册表、Host 半部 `node:vm` 沙箱（vmTimeoutMs=5000，非安全边界）、run 往返——浏览器半部经 `cordis/request-run`→页面审批→`resolveRequestRun`。
- **`cordis-client-runner`**：浏览器半部；**`ui-cordis`**：Slot 面板。

## hooks（`packages/hooks`）

`hook-protocol` 库：`matchesMatcher`（claude 字面或正则 / codex 恒正则）、`runHook`（stdin payload + env，经 `ctx.shell`）、`parseHookOutput`（exit 2 阻塞）、`mergeHookOutputs`（deny>ask>allow）；`hook/invoked` + `hook/result` 会话事件。

- **hooks-claude-code**：映射 SessionStart→`agent/session-start`、UserPromptSubmit→`agent/pre-step`、PreToolUse→`tools/pre-execute`、PostToolUse→`tools/post-execute`、Stop→`agent/turn-stopping`、SubagentStart/Stop→`subagent/start/end`（30 事件支持 7 个）。
- **hooks-codex**：10 事件支持 5 个，snake_case payload，block→deny。

## 下一步

- [策略与交互](/deepdive/11-policy-interaction)
