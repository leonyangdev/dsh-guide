# 9. 打包与安装插件

前面的教程用 `--patch` overlay 加载本地插件。本章把插件打包成可安装的 **bundle**，用 `dsh plugin add` 装进 **profile**，并解释决定最终组合的分层顺序。

## 两个概念，两份清单

安装建立在两个概念上，都由 `package.json` 描述，但 `dsh` 键下携带不同的清单：

| 概念 | 清单字段 | 回答的问题 |
|---|---|---|
| **bundle** | `dsh.bundle` | 这个包贡献什么？（一个插入/覆盖插件行的 patch 文件） |
| **profile** | `dsh.profile` | 哪些 bundle 组成这个 setup，按什么顺序？ |

- **bundle** 是你编写和分发的；**profile** 是用户用 `dsh --profile <name>` 启动的。二者不重叠。

## 编写 bundle

目录结构：

```
hello-plugin/
├── package.json       # 声明 dsh.bundle
├── cordis.patch.yml   # profile 列出此 bundle 时应用的分层
└── index.js           # patch 行引用的插件模块
```

`hello-plugin/package.json`：

```json
{
  "name": "dsh-hello-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "files": ["index.js", "cordis.patch.yml"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

`hello-plugin/index.js`：

```js
export const name = 'hello-plugin'

export function apply() {
  console.log('[hello-plugin] plugin loaded!')
}
```

`hello-plugin/cordis.patch.yml`——插件行按**包名**引用（而不是相对源码路径），这样 Node 才能解析到已安装的代码：

```yaml
- insert:
    - id: hello
      name: dsh-hello-plugin
```

> 没有 `dsh.bundle` 声明的包也能安装，但只是普通依赖：`dsh plugin` 会警告且不激活任何层。这种格式用于库（供插件 import）而非用户启用的插件。

## 装进 profile

`dsh plugin --profile <name> <args...>` 会把参数转发给 profile 目录里的 pnpm，所以所有 pnpm 动词都可用：

```sh
dsh plugin --profile demo add ./hello-plugin
```

首次使用会初始化 profile（首个 bundle 是 `@deepseek-ai/dsh-base`），pnpm link 本地包，因为包声明了 `dsh.bundle`，`dsh` 会把它追加到 `dsh.profile.bundles`：

```json
{
  "name": "dsh-profile-demo",
  "private": true,
  "dependencies": { "dsh-hello-plugin": "link:/path/to/hello-plugin" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "dsh-hello-plugin"] } }
}
```

验证分层（不启动）再启动：

```sh
dsh --profile demo --dump-config   # 会显示 "# == dsh-hello-plugin" 层
dsh --profile demo
```

`dsh plugin --profile demo remove dsh-hello-plugin` 同时移除依赖和分层。

## 加载顺序

最终配置在空根之上按顺序叠加：

1. `dsh.profile.bundles` 里列出的每个 bundle patch（按列表顺序，`dsh-base` 最先）
2. profile 自己的 `cordis.patch.yml`
3. home 级 `$DSH_HOME/cordis.patch.yml`（所有 profile 共享的机器级偏好）
4. 每个 `--patch <path>` overlay（按 argv 顺序）

**后层按行取胜，patch 会整体替换某行的 `config` 值，而非深合并键。** 两个推论：

- 你的 patch 可以按 `id` 覆盖前层的行（就像 `dsh-web-app` bundle 覆盖 `dsh-base` 的行），但必须**重述该行需要的每个键**，而不是只写改动的那一个。
- 用户可以在自己 profile 的 `cordis.patch.yml` 里覆盖你的行而不用动你的包。

内置 bundle 名总是从 dsh 安装本身解析；pnpm 只管理 out-of-tree 包。

## 给 surface bundle 加自己的命令行

定义可运行 app 的 bundle 挂一个普通 provider 插件（`inject: ['cmdlineArgs']`），用 `@deepseek-ai/dsh-cmdline` 的 `parseCmdline` 解析自己的 commander 程序。启动器把同一份不可变参数交给每个插件，所以 app 专属 flag 无需改启动器。

## 从 GitHub 安装：构建脚本的坑

```sh
dsh plugin --profile demo add github:you/hello-plugin
```

git 安装拉的是**源码而非构建产物**，不会跑你的 `build` 脚本。TypeScript 包会缺 `lib/` 而加载失败。两侧各需做一件事：

- **作者**：加一个 `prepare` 脚本（pnpm 在 git 安装后运行它）从源码构建发布入口，必须自包含（不能假设 monorepo checkout 等 dev 环境）。
- **用户**：pnpm ≥10 拒绝运行 git 依赖的 `prepare`，需要在 profile 的 `pnpm-workspace.yaml` 里 allowlist：

  ```yaml
  allowBuilds:
    dsh-hello-plugin: true
  ```

> 把这种 allow 当作**安装时在你机器上执行该包代码的许可**（在 Agent 的任何沙箱之外）。只允许你信任来源的包，并 pin 到 commit（`github:you/hello-plugin#<sha>`）。

不想让用户 allow 构建，就发布构建产物：**发布到 npm**（`pnpm publish` 时带 `lib/`）或**打 tarball**（`pnpm pack`，用户 `dsh plugin add ./pkg.tgz`），两种都不需要构建许可。

## 下一步

- [服务与依赖](/guide/10-services)——向其它插件提供服务
- [Profile / Bundle 组合机制解读](/deepdive/03-profile-bundle)
