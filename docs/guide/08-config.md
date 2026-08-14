# 8. 插件配置

让插件通过 `cordis.yml` 接受配置。

## 定义 Config 类型

导出一个 `Config` 类型和一个同名的 Schemastery schema。默认值直接写在 schema 字段上：

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export const name = 'my-plugin'

export interface Config {
  greeting: string
  maxRetries: number
  verbose?: boolean
}

export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  maxRetries: Schema.number().default(3),
  verbose: Schema.boolean().default(false),
})

export function apply(ctx: Context, config: Config) {
  console.log(config.greeting)  // 用户值或 schema 默认值
}
```

在 `scratch-plugin/cordis.yml` 给插入的本地插件行加配置：

```yaml
- insert:
    - id: hello
      name: './src/my-plugin.ts'
      config:
        greeting: 'Hi there'
        maxRetries: 5
```

加载插件时，Cordis 用导出的 schema 校验配置并填充默认值。

::: warning
**不要导出普通对象作为 `Config`**——它不实现 Cordis 需要的 Standard Schema 接口，必须用 Schemastery schema。
:::

## Schema 校验

用 Schemastery 表达更严格的校验：

```ts
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  apiKey: string
  timeout: number
  mode: 'fast' | 'accurate'
}

export const Config = Schema.object({
  apiKey: Schema.string().required(),
  timeout: Schema.number().default(30000),
  mode: Schema.union(['fast', 'accurate']).default('fast'),
})
```

schema 在插件加载时运行；无效配置会导致加载失败并给出可操作的错误。

## 设计原则

### 不硬编码可调值

Harness 要求**任何两个部署可能想设得不同的值都必须是配置字段**：

```ts
// 错误：硬编码超时
const TIMEOUT = 30000

// 正确：可配置
export interface Config {
  timeoutMs: number  // 默认 30000
}
```

检验标准：`cordis.yml` 能否在不改代码的情况下改变这个值。

### 配置错误要响亮地失败

把自包含的约束写进 schema，让无效配置在加载期失败。引用服务或已注册资源的约束用依赖注入（见[「服务与依赖」](/guide/10-services)）。

## 与 HMR 配合

配置变更会热替换插件：框架卸载旧实例、加载新实例。因为注册都是可逆副作用，替换不会残留旧实例的注册。

## 下一步

- [打包与安装插件](/guide/09-package-install)——把插件做成可安装的包
- [服务与依赖](/guide/10-services)——向其它插件提供服务
