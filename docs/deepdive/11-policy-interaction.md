# 11. 策略与交互

这一章覆盖人机协作平面：审批、权限预设、命令、ask-user，以及设置、凭据、身份。

## 审批（approval，`ctx.approval`）

`user-approval`（`ctx.approval`）是**一次性用户审批 seam**：

- `request()` 返回 `allowed-once`/`rejected`/`cancelled`/`unavailable`。
- 瀑布式 `approval/request` 分派；应答者是监听器（ACP 为自身 agent 提供桥），**没有应答者时以 `unavailable` fail-closed**。
- `approval/asked` + `approval/decided` 审计事件。
- `ApprovalPolicy 'ask' | 'never'`：`approval/policy` 事件；`'never'` 在交互派发前确定性拒绝（fail-closed）。

在工具管线里，`ctx.approval` 在**单调守卫之前**处理 ask（见[「工具执行管线」](/deepdive/06-tool-pipeline)）。

## 权限预设（permission-presets，`ctx.permissionPresets`）

面向用户的预设表，把沙箱模式与审批策略组合在一起：

| 预设 | 沙箱模式 + 审批策略 |
|---|---|
| `workspace-write` | workspace-write + ask |
| `danger-full-access` | danger-full-access + never |

一次切换写入一个 `permission/preset` 事件，并贯通到两个选项事件（`sandbox/mode` + `approval/policy`）。本会话运行的权限/审批策略就来自这套机制。

## 命令（commands，`ctx.commands`）

`register/list/find/execute`、`parseCommand()`；`command/run` + `command/done` 成对日志。命令是 `/` 前缀、由人机适配器经 `ctx.commands` 解释执行的指令，**不成为模型消息**，区别于模型工具和 `ctx.shell` 的 shell 执行。`/goal`（`dsh-command-goal`）、`/compact`（`dsh-command-compact`）、`/plan` 都是命令的例子。

## ask-user（user-questions，`ctx.userQuestions`）

- `registerProvider/ask`，`AskUserQuestionRequest{questions, agent?, signal?}`。
- UI 前端提供当前生效的回答 provider；`tool-ask-user` 在 provider 无关的 `ask()` promise 上暂停工具调用。
- `plan-review` 展示 intent，仅接受运行时 root agent。
- `tool-ask-user`：`ask_user_question` 工具，返回 `{answers:[{id,selected,custom?}]}`。

## 设置（settings，`ctx.settings`）

- namespace schema + composition base + user document 三层解析。
- `register/get/update/replace/mutate`，revision CAS（`SettingsConflictError`）。
- `describe({redactSecrets})`；事件 `settings/updated`、`settings/document-updated`。
- `settings-file` provider：原子写 + 跨进程 writer lock + 保留注释的叶子 diff。

分层解析顺序：**默认值 → 组合 base → 用户文档**。

## 凭据（credentials，`ctx.credentials`）

- 配置只存**引用**不存密钥；`credentialRef` 品牌化 POSIX 标识。
- `resolve()` 每操作解析、`describe()` 不含值、`set/unset` 受 shadowing 规则（env 只读胜出）。
- `credentials-local` 四层：env > `.credentials.yaml`(0600) > 项目 `.env` > 用户 `.env`。
- `credentials/updated` 事件。

轮换后的凭据在紧接着的下一次请求生效（因为按操作解析）。

## 身份（identity）

`anonymous-user-id`：`getOrCreateAnonymousUserId()` UUID v4 存 `~/.dsh/.anonymous-user-id`，供遥测 Resource `user.id`、`/feedback`、DeepSeek `x-deepseek-harness-user-id` 头使用，与主机名等无派生关系。

## 反馈（feedback）

`message-feedback`（`ctx.messageFeedback`）拥有本地逐 assistant 消息反馈、生命周期与目标校验、逐条目 compare-and-set 及 Host 一元 Remote 契约，不进入 Session 历史或遥测。

## 下一步

- [平台接入与 SDK](/deepdive/12-platform)
