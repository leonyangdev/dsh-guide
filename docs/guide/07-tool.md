# 7. 开发一个工具 Tool

本章给 Web UI 加一个 `greet` 工具。先完成[「第一个插件」](/guide/06-first-plugin)，保留 `scratch-plugin` 目录。

## 创建工具插件

把 `scratch-plugin/src/my-plugin.ts` 替换为：

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'greet-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: {
      name: { type: 'string', required: true, description: 'The name to greet' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      return `Hello, ${args.name}!`
    },
  }))
}
```

各字段的含义：

- `inject: ['tools']`：让 Cordis 等工具注册表就绪。
- `defineTool`：从 `parameters` 推断并校验 `args` 类型。
- `output.schema`：声明工具返回的**规范值**（canonical value）类型。
- `output.render`：把规范值转换成模型可见的内容块。
- `execute`：真正执行逻辑，返回规范值。

## 运行并调用工具

若开发命令没在跑就重启：

```sh
pnpm dsh web --patch ./scratch-plugin/cordis.yml
```

打开 `http://127.0.0.1:3080`，问：`Use the greet tool to greet Ada.` 模型会调用 `greet` 工具，并收到 `Hello, Ada!` 作为工具结果。

## 工具定义的关键设计

工具定义（`ToolDefinition`）的完整字段远比这个例子丰富，核心要点：

- **规范值 vs 展示内容分离**：`execute` 返回的规范值按 `output.schema` 校验，绝不进日志；只有 `output.render` 产出的展示内容才持久化。这保证了"模型可见 ⟺ 可重建"。
- **并发安全**：只有 `isConcurrencySafe` 精确返回 `true` 的工具才会并行执行，否则串行（见[「工具执行管线」解读](/deepdive/06-tool-pipeline)）。
- **可选字段**：`finalizeContent`（最后的纯内容不变量）、`timeoutMs`、`presentCall` / `presentResult`（UI 卡片）、`presentationMeta` 等。

## 深入阅读

- [工具编写参考](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md)：嵌套 schema、规范值、后台任务、策略钩子、Code Mode、UI 卡片。
- [能力三层拆分](/guide/12-capability-seam)：把可替换能力拆成 Service Definition / Provider / Consumer。
- [工具执行管线解读](/deepdive/06-tool-pipeline)：`tools/pre-execute → guard → tools/execute → tools/post-execute → finalizeContent → tools/result` 完整链路。

## 下一步

- [插件配置](/guide/08-config)——让问候语可配置
