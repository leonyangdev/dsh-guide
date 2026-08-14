# 3. Profile / Bundle 组合机制

一个正在运行的 `dsh` 是一棵**在启动时从有序分层装配出来的插件树**。理解这棵树如何装配，是理解"一切皆可替换"的配置层。

## 两个概念

| 概念 | 是什么 | 清单字段 |
|---|---|---|
| **profile** | Harness home 下的一个命名组合目录，列出它叠加的 bundle、持有的 out-of-tree 插件、以及用户的 `cordis.patch.yml` | `dsh.profile` |
| **bundle** | Cordis 配置行 + 它们挂载代码的发行格式，其插入的内容可被上层 patch | `dsh.bundle` |

- `web` 和 `headless` 是内置模板。
- `dsh-base` 是每个 profile 的第一层：模型适配器、工具、持久化、沙箱与审批策略、设置、凭据、遥测。
- `dsh-web-app` 在其上加浏览器应用；`dsh-headless` 加一个无服务器的 one-shot runner。

## 清单

每个都在自己的 `package.json` 里通过 `dsh` 字段声明：

```json
// bundle 清单
{ "dsh": { "bundle": { "patch": "./cordis.patch.yml" } } }

// profile 清单
{ "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "dsh-hello-plugin"] } } }
```

profile 目录还持有：

- `package.json`（out-of-tree 插件依赖 + `dsh.profile` 清单）
- `cordis.patch.yml`（用户自己的 patch 层）

`dsh plugin --profile <name> <args>` 把参数转发给 profile 目录里的 pnpm，用它管理插件；首次使用会从模板自动初始化 `web`/`headless`，其它 profile 必须通过 `dsh plugin` 创建。

## 分层装配顺序

最终配置在空 entry 列表上按序叠加：

1. `dsh.profile.bundles` 里的每个 bundle（按列表顺序，`dsh-base` 最先）
2. profile 的 `cordis.patch.yml`
3. home 级 `$DSH_HOME/cordis.patch.yml`
4. 每个 `--patch <path>` overlay（按 argv 顺序）

**后层按行取胜，patch 按 `id` 整体替换某行的 `config`（不深合并），或插入新行。**

内置 bundle 名总是从 dsh 安装本身解析；pnpm 只管理 out-of-tree 包。

## 查看真实启动树

```sh
dsh --profile web --dump-config          # 组合后的完整树
dsh --profile web --dump-default-config  # 未叠加用户 patch 的默认树
```

打印出的任何一行都可以被你的 patch 覆盖。

## 三个内置 bundle

### dsh-base

每个 profile 的第一层。`cordis.patch.yml` 插入所有基础行：模型适配器、`agent-default-model`、工具、持久化、策略、settings/credentials、telemetry、host 级 subagent provider。用 `disabled: !!js process.platform === 'win32'` 平台门控 shell 栈（`bash-sandbox`/`tool-bash` vs `pwsh-sandbox`/`tool-pwsh`）。

### dsh-web-app

骑在 base 上，加 coding persona、Web host 行（webserver、API gateway、workspace、projection cache、storage）、浏览器插件名册、常开的 client-plugin HMR 链，以及 `web-runtime` glue 插件（解析 frontend dist、采样 LAN 信任、挂 `frontend-static`、注册 `harness:source`/`app:web-surface` 提示段与 `DSH_WEB_URL` bash 变量）。`web-startup` 解析 `--host/--port/--trusted-host/--help`，并拒绝 `--host 0.0.0.0`。

### dsh-headless

骑在 base 上，提供 persona + tool mode、关 HMR、Code Mode worker。`headless-runner`（任务来自 `headlessStartup`）：建全新持久化 agent → 提交任务 → 等 quiescence → stdout 打印最后一段助手文本 → 经 `ctx.appExit` 退出（`turn/end` completed→0 否则 1）。不开任何端口。

## boot 胶水（packages/boot/app-boot）

`app-boot` 是 `apps/cli` 与示例 bin 共享的启动库，关键导出：

- `boot()`：建 root context、装 Loader、挂 include 树、断言 entries loaded/activated。
- `resolveConfigPath`：snapshotMode=replay 时换用 `cordis.snapshot.yml`。
- `loadLayeredEnv`：继承环境 > 项目 `.env` > `$DSH_HOME/.env`，拒绝 bootstrap-only 文件变量。
- `mountRootInclude`：注册 `cordis:include`/`cordis:group` builtins。
- `watchUserPatches`：HMR 事务性重组 patch 层。
- `renderConfigDump`：`--dump-config` 离线组合。
- `addHarnessSourceSection`：`harness:source` 提示段。

`healProfilesModuleFallback` 维护扁平的 `$DSH_HOME/profiles/node_modules` 符号链接目录，供 Node 父级查找。

## 为什么这个设计重要

分层 patch + bundle 意味着：

- **发行方**：用一个 bundle 打包一组配置行，用户 `dsh plugin add` 即可安装。
- **用户**：不必改包源码，在自己的 `cordis.patch.yml` 里按 `id` 覆盖任何行。
- **产品**：`web`/`headless` 只是模板，一切组合都是数据，不是硬编码。

这正是"一切皆插件、一切可替换"在装配层的落地。

## 下一步

- [Agent 回合与步骤生命周期](/deepdive/04-turn-step-flow)——装配出来的树如何驱动 Agent 工作
