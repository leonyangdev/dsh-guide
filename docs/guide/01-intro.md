# 1. 认识 DeepSeek Harness

DeepSeek Harness（命令行工具名 `dsh`）是 [DeepSeek AI](https://deepseek.com) 开源的 Agent Harness（智能体框架）。它的核心设计可以用一句话概括：

> **Everything is a plugin —— 一切皆插件。**

它建立在 [Cordis](https://github.com/cordiverse/cordis) 插件框架之上。Cordis 的设计思想描述在论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper) 中，其要义是：**可组合、可逆副作用、按时空组合的插件系统**。

## 它是什么

Harness（挽具/框架）这个词的意思是：它为「Agent」提供了一套可插拔的运行时骨架。在这个骨架里，模型适配器、工具注册表、会话日志、权限审批、沙箱，甚至 **Agent 循环本身**，全部都是插件，全部都可以通过配置文件替换或扩展。

换句话说，DeepSeek Harness **没有需要打补丁的"特权内核"**。你要扩展它，就是在其它插件旁边再挂载一个插件；而所有注册都是"可逆的副作用"（effect），插件卸载时会自动回滚。

## 它能做什么

一个跑起来的 DeepSeek Harness Agent 可以：

- **读写工作区文件**：通过文件系统能力（`ctx.fs`）读取、写入、编辑代码与文档。
- **执行命令**：通过 Bash / PowerShell 执行器（`ctx.shell`）、子进程（`ctx.subprocess`）、持久化 PTY 终端（`ctx.terminals`）。
- **联网检索**：通过 Web 能力（`ctx.web`）搜索网页、抓取 URL 内容。
- **委派子代理**：通过子代理能力（`ctx.subagents`）把任务拆给 fresh child / fork / 进程外 ACP / Codex / Claude Code 等后端。
- **维护计划与清单**：通过 plan mode（计划模式）、`todo_write` 工具、same-session goal（目标）进行长期任务管理。
- **加载技能（Skill）**：通过 skill 能力（`ctx.skills`）按需加载领域知识。
- **动态修改自身运行时**：甚至能通过动态 Cordis 插件检查、挂载、卸载自己的插件。

它默认以 **Web UI**（`http://127.0.0.1:3080`）运行，也提供无头（headless）、ACP（自动化协议）、Python SDK 等接入方式。

## 几个必须先认识的名词

| 名词 | 含义 |
|---|---|
| **harness** | 一套让 Agent 跑起来的可插拔运行时框架 |
| **`dsh`** | 产品启动器命令，也是这个项目的代称 |
| **Cordis** | 底层插件框架（本项目以 vendor 方式内置） |
| **plugin（插件）** | 一个实现服务、注册工具、监听事件的可组合单元 |
| **profile** | 一个命名的运行组合（`web`、`headless` 是内置模板） |
| **bundle** | 一组 Cordis 配置行的发行格式，profile 由 bundle 叠加而成 |
| **seam（能力缝）** | 一个可替换能力的三层组合：Service Definition / Service Provider / Consumer |
| **turn / step** | 回合 / 步骤：一个 turn 包含零到多个 step，一个 step 是一次模型请求 + 它触发的工具执行 |
| **session log（会话日志）** | 只追加的事件流，是模型可见上下文的唯一事实来源 |

这些概念在后面的章节会逐一展开。现在只需记住：**这是一个"插件即一切"、用事件与作用域组织扩展点的框架**。

## 与其它 Agent 框架的对比

- 类似 [Claude Code](https://claude.com/claude-code)、[Codex](https://openai.com/codex)、[Cline](https://cline.bot) 等编码 Agent，但 DeepSeek Harness 强调**框架的彻底可组合性**：每个部件都是插件，都有官方扩展点。
- 与直接写一个"提示词 + 工具循环"的脚本不同，Harness 提供了**会话日志、持久化、审批、沙箱、投影、遥测、子代理、工作流**等一整套生产级基础设施，并强制"模型可见 ⟺ 可重建"这一不变量（任何到达模型请求的内容都必须能从会话日志重建）。

## 当前状态

项目处于 **developer preview（开发者预览）** 阶段，版本 `0.1.0-rc.5`，迭代很快，**会有破坏兼容性的变更**。这意味着文档和 API 都可能变化，学习时应以源码和官方文档为准。

## 本教程会带你走完什么

1. 安装与运行（`npx` 或源码）
2. 使用 Web UI、配置模型
3. 理解底层 Cordis 框架
4. 写出第一个插件、第一个工具、接受配置
5. 打包安装插件
6. 服务与依赖、事件系统
7. 能力三层拆分、编写 LLM 适配器
8. 进阶：组合、作用域、动态插件

学完「教程」后，可以进入[「项目解读」](/deepdive/01-overview)部分，把整个仓库逐层拆开。

::: tip 阅读提示
如果只想"先用起来"，直接看第 2–4 章；如果想"写插件"，第 5 章是分水岭，务必吃透 Cordis 的五个核心概念。
:::
