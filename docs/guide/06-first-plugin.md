# 6. 你的第一个插件

本章创建一个最小插件并加载进 Web UI。前提：完成[源码运行路径](/guide/02-install)（`pnpm install` + `pnpm run build`）。

## 插件是什么

在 Harness 里，插件是一个**导出 `apply` 函数的 TypeScript 模块**。框架加载插件时调用 `apply`，并传入一个 `ctx` 上下文对象，插件通过它注册能力：

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-plugin'

export function apply(ctx: Context) {
  // 在这里注册能力
}
```

这就是完整的最小形态。

## 创建插件文件

从仓库根创建临时项目并写插件：

```sh
mkdir -p scratch-plugin/src
```

`scratch-plugin/src/my-plugin.ts`：

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello-plugin'

export function apply(ctx: Context) {
  // apply 运行前，声明的依赖已经就绪
  console.log('[hello-plugin] plugin loaded!')
}
```

## 注册到 cordis.yml

创建 `scratch-plugin/cordis.yml` 作为 Web overlay，插入本地插件。路径必须是绝对路径：

```yaml
- insert:
    - id: hello
      name: '/absolute/path/to/deepseek-harness/scratch-plugin/src/my-plugin.ts'
```

用这个 overlay 启动 Web UI：

```sh
pnpm dsh web --patch ./scratch-plugin/cordis.yml
```

打开 `http://127.0.0.1:3080`，启动期间终端会打印 `[hello-plugin] plugin loaded!`。

> patch 文件贡献配置，但**不改变 loader 解析模块路径的 profile 目录**，所以插件路径要用绝对路径。

## 自动清理

所有通过 `ctx` 注册的东西——事件监听器、工具、定时器——在插件卸载时自动清理。

对需要显式清理的资源（如网络连接），用 `ctx.effect()` 提供 disposer：

```ts
import type { Context } from '@deepseek-ai/cordis'

export function apply(ctx: Context) {
  ctx.effect(() => {
    const timer = setInterval(() => {
      console.log('heartbeat')
    }, 5000)

    // 返回的函数在插件卸载时执行
    return () => clearInterval(timer)
  })
}
```

## 声明依赖

插件消费 `tools`、`llm` 等服务时，用 `inject` 声明：

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-tool-plugin'
export const inject = ['tools']

export function apply(ctx: Context) {
  // ctx.tools 在这里已就绪
  ctx.tools.register(/* ... */)
}
```

框架会**等所有声明服务就绪**才加载插件。如果某个必需服务一直缺失，插件会保持等待而不报错。

## 三种插件形态

除函数模块外，插件还可以用对象或类形态。

### 对象形态

```ts
import type { Context } from '@deepseek-ai/cordis'

export default {
  name: 'my-plugin',
  inject: ['tools'],
  apply(ctx: Context) {
    // ...
  },
}
```

### 类形态

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

export default class MyService extends Service {
  static inject = ['tools']

  constructor(ctx: Context) {
    super(ctx, 'myService')
    // 在构造函数里做同步初始化
  }
}
```

- 大多数情况**函数形态**就够了。
- 需要向其它插件**提供服务**时用类形态（见[「服务与依赖」](/guide/10-services)）。

## 下一步

- [开发一个工具 Tool](/guide/07-tool)——学习工具定义 DSL
- [插件配置](/guide/08-config)——接受用户配置
