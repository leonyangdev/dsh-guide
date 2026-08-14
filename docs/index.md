---
layout: home

hero:
  name: "DeepSeek Harness"
  text: "深度指南"
  tagline: 从入门到精通的完整教程，以及对整个开源项目的逐层拆解解读
  actions:
    - theme: brand
      text: 开始学习
      link: /guide/01-intro
    - theme: alt
      text: 项目深度解读
      link: /deepdive/01-overview
    - theme: alt
      text: GitHub 仓库
      link: https://github.com/deepseek-ai/deepseek-harness

features:
  - icon: 🧩
    title: Everything is a plugin
    details: DeepSeek Harness 建立在 vendored Cordis 之上，模型适配器、工具注册表、会话日志、甚至 Agent 循环本身都是插件，一切皆可从配置替换。
  - icon: 🚀
    title: 从入门到精通
    details: 14 篇循序渐进的中文教程，从安装运行、第一个插件、开发工具，到服务/事件/能力拆分与 LLM 适配器，带你走完整条学习曲线。
  - icon: 🔍
    title: 全项目深度解读
    details: 15 篇源码级拆解，覆盖 monorepo 布局、插件化架构、回合流程、会话日志、工具管线、执行层、编排、策略、平台接入等全部子系统。
  - icon: 🧠
    title: 基于真实源码
    details: 所有内容基于 deepseek-ai/deepseek-harness 源码（0.1.0-rc.5）与官方文档精读整理，术语与官方一致，代码标识符可直接回源码核对。
---

## 这套文档讲什么

这是一套面向中文开发者的 DeepSeek Harness 深度学习资料，由两部分组成：

- **[教程（从入门到精通）](/guide/01-intro)**：假设你第一次接触这个项目，从"它是什么"开始，逐步带你安装运行、上手 Web UI、理解底层插件框架 Cordis、写出第一个插件与工具，最后进阶到服务、事件、能力拆分和 LLM 适配器。
- **[项目解读（整个项目拆解）](/deepdive/01-overview)**：从仓库布局到每一组包，逐层拆解这个大型 monorepo 的架构、核心机制与设计决策，适合想要深入理解或二次开发的人。

## 项目速览

DeepSeek Harness（命令行工具名 `dsh`）是 DeepSeek AI 开源的 Agent Harness，采用"**一切皆插件**"的架构，底层是 [Cordis](https://github.com/cordiverse/cordis) 插件框架。它用**能力 seam**（Service Definition / Service Provider / Consumer 三层）组织可替换能力，用**会话日志**作为模型可见上下文的唯一事实来源，用**事件**作为扩展点。

- 版本：`0.1.0-rc.5`（开发者预览，兼容性破坏性变更仍会频繁发生）
- 运行：`npx @deepseek-ai/dsh web`（Web UI，默认 `http://127.0.0.1:3080`）
- 语言：TypeScript（ESM），Node `^22.19 || >=24`
- 许可：[MIT](https://github.com/deepseek-ai/deepseek-harness/blob/master/LICENSE)

::: tip 开始之前
建议按顺序阅读「教程」部分；「项目解读」可以随时查阅，但最好先掌握第 5 章（Cordis 核心概念）再深入。
:::
