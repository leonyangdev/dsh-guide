# 15. 源码导读

前面 14 章是"地图"，这一章是"从地图回到源码"的路径指南。目标是让你能独立在 `deepseek-harness` 仓库里找到任何实现。

## 推荐阅读顺序

按依赖方向自底向上读，每一步都建立在上一层之上：

```
1. vendor/cordis*          —— 框架本身（可选，进阶再读）
2. docs/cordis-primer.md   —— 框架概念
3. docs/architecture.md    —— 有序地图（先读这个）
4. packages/core/scope     —— 作用域原语
5. packages/core/session   —— 会话日志
6. packages/core/system-prompt
7. packages/core/tools     —— 工具注册与管线
8. packages/core/agent     —— Agent 接口
9. packages/core/agent-loop —— 循环驱动
10. packages/llm/*          —— 模型 seam + 适配器
11. packages/fs|shell|subprocess|sandbox  —— 执行层
12. packages/subagent|workflow|goal|preset —— 编排层
```

## 每个包的入口在哪

- **包 README**：`packages/<group>/<pkg>/README.md`——每个包的契约（purpose、API、扩展点、Model Experience、Known Limitations）。
- **Service Definition**：通常 `packages/<group>/<pkg>/src/index.ts` 或 `src/*.ts` 里的 `export default class Xxx extends Service`（或 `abstract class`）。
- **函数插件**：命名导出 `name`/`inject`/`Config`/`apply`，无 default export。
- **类型**：`src/types.ts` 只放类型，无运行时代码。

## 关键文件索引

| 想看什么 | 去这里 |
|---|---|
| 会话事件词汇 | `packages/core/session/src/types.ts`（`SessionEventMap`、`SESSION_FORMAT_VERSION`） |
| 消息投影 | `packages/core/session/src/derive.ts`（`deriveMessages`） |
| 工具定义 | `packages/core/tools/src/`（`ToolDefinition`、管线三阶段） |
| 循环驱动 | `packages/core/agent-loop/src/agent.ts`（`ReactLoopAgent`）、`tool-calls.ts`（调度器） |
| LLM 词汇/协议 | `packages/llm/llm/src/message.ts`、`types.ts`（`Message`、`StreamChunk`） |
| DeepSeek 适配器 | `packages/llm/llm-deepseek/src/` |
| 压缩策略 | `packages/compaction/compaction-basic/src/` |
| 持久化后端 | `packages/session/session-persistence-sqlite/src/`（`SCHEMA_VERSION`） |
| 沙箱 confine | `packages/sandbox/sandbox/src/`、`packages/sandbox/sandbox-local/src/` |
| profile/bundle | `packages/boot/app-boot/src/profile.ts` |
| CLI 语法 | `apps/cli/src/args.ts` |
| JSON-RPC 协议 | `packages/sdk/protocol/src/` |
| ACP 服务器 | `packages/acp/acp/src/` |
| 动态插件 | `packages/extensions/cordis-host-runner/src/`、`tool-cordis/src/` |

## 三个"只看一眼就懂"的约定

1. **服务 = 抽象类 + ctx 键**：找服务，搜 `extends Service`，看构造函数里的 `super(ctx, 'xxx')`。
2. **事件 = 声明合并**：找事件，搜 `interface Events {` 或 `interface SessionEventMap {` 的 `declare module` 块。
3. **能力 = 三段式**：找 `Definition`（抽象类）+ `*-local`/`*-sandbox`/`*-e2b`（provider）+ `tool-*`（consumer）。

## 精读建议：从 agent-loop 读起

`packages/core/agent-loop/` 是理解整个运行时的最佳起点——它把 session、system-prompt、tools、agent、llm 全部串起来。读它时对照[「回合与步骤生命周期」](/deepdive/04-turn-step-flow)的流程图。

再读 `packages/core/tools/src/` 的工具管线，对照[「工具执行管线」](/deepdive/06-tool-pipeline)。

最后读 `packages/fs/` + `packages/shell/` + `packages/sandbox/`，体会"共享执行世界"如何让一次 provider 切换改变整个产品（[「执行层」](/deepdive/09-execution)）。

## 借助工具读代码

仓库本身强烈推荐"用 agent 探索代码库"。你可以在 Web UI 里让 DeepSeek Harness 自己去读它自己的源码——这也正是这个项目的自我指涉魅力（`packages/extensions/` 让它能动态检查、挂载自己的插件）。

## 官方资源索引

- [README](https://github.com/deepseek-ai/deepseek-harness) / [architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) / [glossary](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/glossary.md)
- [capability-seams](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/capability-seams.md)（服务全景图）
- [cordis-tutorial](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/cordis-tutorial)（7 篇框架教程）
- [cookbook](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/cookbook)（扩展模式）
- [subsystems](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/subsystems)（每子系统一个参考页）
- [AGENTS.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/AGENTS.md)（仓库级规则，贡献必读）

## 结语

DeepSeek Harness 的深度在于：**它把"可组合性"做到了产品级**——会话日志作为唯一真相、能力 seam 作为替换单元、事件作为扩展点、profile/bundle 作为装配层、投影/遥测/沙箱/审批作为生产基础设施。掌握[核心概念](/guide/05-cordis-basics)后，这套体系是高度自洽、可以举一反三的。

本套文档到此结束。教程部分让你会用、会写；解读部分让你理解、会拆。剩下的就是打开源码，自己动手。
