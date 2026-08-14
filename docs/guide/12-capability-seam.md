# 12. 能力的三层拆分

当一个能力通用到需要可替换的 provider（如 Bash 执行），Harness 把它拆成三个角色：**Service Definition**、**Service Provider**、**Consumer**。三者合起来才是完整的 **seam（能力缝）**；单独一个角色不是 seam。

## 为什么拆分

- **可替换 provider**：一个 Service Definition 可以有多个 provider，通过 `cordis.yml` 选择。
- **独立演进**：定义、实现、消费三者互不阻塞。
- **解耦依赖**：Provider 和 Consumer 都只依赖 Service Definition，彼此不依赖。

## Bash 例子

- **Service Definition**（`dsh-shell`）——定义 Cordis 服务 + Bash 请求/结果类型
- **Service Provider**（`dsh-bash-local`）——在本地机器执行命令
- **Consumer**（`dsh-tool-bash`）——把能力暴露为模型可调用的工具

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  dsh-shell   │────▶│  dsh-bash-local  │     │ dsh-tool-bash│
│(definition) │     │    (provider)     │     │(consumer/tool)│
└─────────────┘     └──────────────────┘     └──────────────┘
       ▲                                            │
       └────────────────────────────────────────────┘
                     inject: ['shell']
```

## 实战：开发一个三层能力

### 第 1 步：写 Service Definition

```ts
// packages/my-cap/my-cap/src/index.ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    myCap: MyCapService
  }
}

export abstract class MyCapService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'myCap')
  }

  /** 执行能力。 */
  abstract execute(request: MyCapRequest): Promise<MyCapResult>
}

export interface MyCapRequest { input: string }
export interface MyCapResult { output: string }
```

### 第 2 步：写 Service Provider

```ts
// packages/my-cap/my-cap-local/src/index.ts
import type { Context } from '@deepseek-ai/cordis'
import { MyCapService, type MyCapRequest, type MyCapResult } from '@deepseek-ai/dsh-my-cap'

class MyCapLocal extends MyCapService {
  async execute(request: MyCapRequest): Promise<MyCapResult> {
    return { output: request.input.toUpperCase() }
  }
}

export const name = 'my-cap-local'

export function apply(ctx: Context) {
  ctx.plugin(MyCapLocal)
}
```

### 第 3 步：写 Consumer

```ts
// packages/my-cap/tool-my-cap/src/index.ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'tool-my-cap'
export const inject = ['tools', 'myCap']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'my_cap',
    description: 'Execute my capability.',
    parameters: { input: { type: 'string', required: true } },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const result = await ctx.myCap.execute({ input: args.input })
      return result.output
    },
  }))
}
```

### 在 cordis.yml 里组合

```yaml
- name: '@deepseek-ai/dsh-my-cap-local'
- name: '@deepseek-ai/dsh-tool-my-cap'
```

## 设计要点

- **不要过早拆分**：只有角色需要独立演进时才分到不同包。一个简单工具插件不需要。
- **Service Definition 拥有 Request/Result 类型**：Provider 和 Consumer 只依赖定义包。
- **显式 > 隐式**：在显式的 `resolve(request): Spec` 步骤里解析默认值，而不是把 `?? default` 藏在 `run()` 内部。

## 内置能力 seam 全景

仓库内置了大量 seam，每个都遵循这套三段式（完整清单见[「事件与能力 Seam 全景」解读](/deepdive/14-events-map)）：

- `ctx.shell`（Bash）、`ctx.subprocess`（子进程）、`ctx.fs`（文件系统）、`ctx.lsp`、`ctx.web`、`ctx.skills`、`ctx.compaction`、`ctx.subagents`、`ctx.workflowEngine`、`ctx.jobs`、`ctx.codeRuntime`、`ctx.sandbox`、`ctx.sessionPersistence`、`ctx.sessionQuery`、`ctx.sessionTitle`、`ctx.credentials`、`ctx.settings`、`ctx.storage`、`ctx.approval` 等。

## 下一步

- [编写 LLM 适配器](/guide/13-llm-adapter)——实现一个 LLM provider
