# 13. 编写 LLM 适配器

本章给 Harness 接入一个新的 LLM provider。适配器继承 `LlmAdapter` 并实现 `stream()`，把 Harness 的 provider 无关请求翻译成 provider API 调用，再把响应翻译回 Harness 的 chunk。

## 最小实现

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'

class MyAdapter extends LlmAdapter {
  private apiKey: string

  constructor(apiKey: string) {
    super()
    this.apiKey = apiKey
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // 1. 把 options.messages 转成 provider 格式
    // 2. 调用流式 API
    // 3. 把响应转成 StreamChunk 序列
  }
}

export interface Config {
  apiKey: string
  providers: string[]
}

export const Config: Schema<Config> = Schema.object({
  apiKey: Schema.string().required(),
  providers: Schema.array(Schema.string()).required(),
})

export const name = 'my-llm-adapter'
export const inject = ['llm']

export function apply(ctx: Context, config: Config) {
  const adapter = new MyAdapter(config.apiKey)
  ctx.llm.registerAdapter(config.providers, adapter)
}
```

## StreamChunk 协议

`stream()` 用如下协议产出 chunk：

```ts
import { CallId, type StreamChunk } from '@deepseek-ai/dsh-llm'

async function* exampleChunks(): AsyncIterable<StreamChunk> {
  // 1. 每个内容块以 block-start 开始
  yield { type: 'block-start', index: 0, blockType: 'text' }

  // 2. 文本通过 text-delta 流式输出
  yield { type: 'text-delta', index: 0, text: 'Hello' }
  yield { type: 'text-delta', index: 0, text: ' world' }

  // 3. 每个内容块以 block-end + 完整块结束
  yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Hello world' } }

  // 4. 工具调用块
  yield { type: 'block-start', index: 1, blockType: 'tool-call' }
  yield { type: 'tool-call-delta', index: 1, id: CallId('call-123'), name: 'bash', argumentsDelta: '{"command":"ls"}' }
  yield { type: 'block-end', index: 1, block: { type: 'tool-call', id: CallId('call-123'), name: 'bash', arguments: '{"command":"ls"}' } }

  // 5. Token 用量（在 finish 之前）
  yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 50 } }

  // 6. 结束原因
  yield { type: 'finish', reason: { kind: 'stop' } }
  // 或者 { kind: 'tool-calls' } 请求工具执行
}
```

### 关键规则

- 每个 `block-start` 都有配对的 `block-end`。
- `index` 从 0 递增，标识内容块顺序。
- `tool-call-delta` 在 `argumentsDelta` 里携带原始 JSON 文本（可一次给全，也可分多块）。
- `finish` 是最终 chunk。
- `usage` 在 `finish` 之前发出。

## GenerateOptions

`stream()` 收到导出的 `GenerateOptions` 类型，包含：model、adapter 持有的 reasoning-effort id、对话历史、系统提示词、工具 schema、生成参数、停止序列、abort signal。以 `@deepseek-ai/dsh-llm` 导出的 TS 类型为准。provider 无法满足某字段时，**抛带稳定 code 的 `LlmError`，而不是静默丢弃**。

## 注册适配器

```ts
ctx.llm.registerAdapter(['my-provider'], adapter)
```

- 第一个参数列出适配器处理的 provider 路由。`GenerateOptions.provider` 选择注册的适配器，`GenerateOptions.model` 传递适配器持有的 model id（不做生命周期注册）。
- 覆写 `listModels()` 可向选择器广告可选模型。

## 从 cordis.yml 使用

```yaml
- id: my-llm
  name: './src/my-llm-adapter.ts'
  config:
    apiKey: !!js process.env.MY_API_KEY
    providers:
      - my-provider

- id: agent-loop
  name: '@deepseek-ai/dsh-agent-loop'
  config:
    agents:
      - id: main
        provider: my-provider
        model: my-model-v1
```

## 错误处理

适配器把传输/协议失败抛成带稳定 code 的 `LlmError`；agent loop 保留错误与 code 供诊断和策略使用，**不会自动把普通 `Error` 转成 `LlmError`**。每个 provider HTTP 请求还要合并 `attributionHeaders()` 并转发 `options.signal`：

```ts
import { attributionHeaders, LlmAdapter, LlmError, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'

class HttpAdapter extends LlmAdapter {
  constructor(private readonly endpoint: string) { super() }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...attributionHeaders() },
      body: JSON.stringify({ model: options.model, messages: options.messages }),
      ...options.signal ? { signal: options.signal } : {},
    })
    if (!response.ok) {
      throw new LlmError(`Provider API error: ${response.status}`, 'PROVIDER_HTTP_ERROR')
    }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
```

## 参考实现

仓库里有完整实现：

- `packages/llm/llm-deepseek/`——DeepSeek API 适配器（OpenAI 兼容格式，`fetch` + SSE 解析）
- `packages/llm/llm-pi-ai/`——Pi AI 适配器（不同的 API 格式）

对比两个内置适配器，可以看到同一个 Harness 契约如何在不同 provider SDK 上实现。

## 下一步

- [进阶：组合、作用域与动态插件](/guide/14-advanced)
- [LLM、上下文与压缩解读](/deepdive/08-llm-context)
