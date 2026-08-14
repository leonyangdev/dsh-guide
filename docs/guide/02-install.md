# 2. 安装与运行

本章带你从零把 DeepSeek Harness 跑起来。有两种方式：直接用 `npx` 跑发布版，或从源码构建。

## 环境要求

- **Node.js**：`^22.19.0 || >=24.0.0`（这是 `package.json` 里 `engines` 声明的范围）
- 从源码构建还需要 **pnpm**（仓库用 `pnpm@11.x` 工作区）

检查版本：

```sh
node --version
pnpm --version
```

## 方式一：从 npm 运行（最快）

```sh
npx @deepseek-ai/dsh web
```

`npx` 会临时拉取 `@deepseek-ai/dsh` 包并启动 Web UI，默认监听 `http://127.0.0.1:3080`。第一次运行会自动初始化 `web` profile。

## 方式二：从源码运行

适合想读源码、改插件或二次开发的人：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

说明：

- `pnpm install` 安装所有 workspace 依赖（vendor、packages、native、apps、website）。
- `pnpm run build` 分别构建 Host/Client 侧的 lib（`tsc` + `tsdown`）以及 Web 前端。
- `pnpm dsh` 是源码启动入口：`node --import tsx/esm apps/cli/src/bin.ts`，会把后续参数透传给 profile。

## `dsh` 的几种入口模式

`dsh` 是产品启动器，负责解析自己的 flag，并把后续参数交给选中的 profile。

| 命令 | 作用 |
|---|---|
| `dsh web` | `--profile web` 的别名，启动 Web UI |
| `dsh --profile headless "任务"` | 跑一个全新持久化会话，打印最终答案后退出 |
| `dsh --profile <name>` | 启动 `$DSH_HOME/profiles/<name>` 下的命名 profile |
| `dsh plugin --profile <name> <pnpm 参数>` | 把参数转发给 profile 目录内的 pnpm，用于管理 profile 的插件 |

启动器参数在**最前面**，第一个它不认识的 token 之后都算 app 参数：

```sh
dsh --profile web --port 8080      # --port 属于 web app
dsh --profile headless "run the tests"
dsh --profile web --help            # web app 的 help
dsh --help                          # 启动器自己的 help
```

### 无头模式示例

```sh
# 需要 DEEPSEEK_API_KEY（见第 4 章）
pnpm dsh --profile headless "总结这个仓库，列出主要包"
```

无头模式会创建并持久化一个新会话，把最终回答打印到标准输出后退出，非常适合脚本化与自动化。

## 查看实际启动的插件树

想看你的机器真正会启动什么，用 `--dump-config` 或 `--dump-default-config`：

```sh
dsh --profile web --dump-config          # 组合后的完整树
dsh --profile web --dump-default-config  # 未叠加用户 patch 的默认树
```

打印出来的每一行都可以被你的 patch 覆盖——这就是"一切皆插件、一切可替换"在配置层的体现。

## 目录与数据

- **Harness home**：`$DSH_HOME`，未设置时通常为 `~/.dsh`。profile、用户 patch、凭据、设置等都在这里。
- **profile 目录**：`$DSH_HOME/profiles/<name>/`，含 `package.json`（`dsh.profile` 清单 + 外部插件依赖）和 `cordis.patch.yml`（用户自己的 patch 层）。
- **凭据**：API key 写在 `$DSH_HOME/.credentials.yaml`（权限 `0600`），设置只保存引用，不保存明文密钥。
- **默认工作区**：`dsh` 进程的调用目录是默认工作区根（workspace root）。

## 下一步

跑起来之后，打开 [第 3 章 Web UI](/guide/03-webui) 配置模型和工作区，开始第一个任务。
