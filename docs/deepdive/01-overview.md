# 1. 项目全景

这一章把整个仓库的骨架摊开，建立导航地图。后续每一章都是这棵树上的一根枝。

## 一句话定位

`deepseek-harness` 是一个 **TypeScript monorepo**，npm scope 统一为 `@deepseek-ai/dsh-*`，当前版本 `0.1.0-rc.5`（开发者预览，破坏性变更会频繁发生）。核心口号是 **everything is a plugin**，底层是 vendored Cordis。

## 顶层布局

```
deepseek-harness/
├── vendor/        vendored Cordis 源码（manifest + 同步流程）
├── packages/      @deepseek-ai/dsh-<pkg> 工作区，位于 packages/<group>/<pkg>/
├── native/        @deepseek-ai/node-addon-landlock-run（Landlock 沙箱原生插件）
├── apps/          CLI（apps/cli）与 Web shell（apps/web）
├── python/        Python SDK 与 bundled runtime
├── examples/      可运行的 cordis.yml 叶子（agent-spine + CLI/ACP/JSON-RPC bins）
├── docs/          架构、生成目录、postmortem、cookbook、用户指南（双语文档）
├── website/       VitePress 投影适配器（非内容源）
├── scripts/       仓库 gate 与生成器
├── .agents/       Agent 工作流与 Agent Notes
├── AGENTS.md       仓库级规则（root 指令）
└── package.json    根工作区（scripts 全在这里）
```

## 工作区与工程

根 `package.json` 声明：

- `packageManager: pnpm@11.7.0`
- `engines.node: ^22.19.0 || >=24.0.0`
- workspaces：`vendor/*`、`packages/*/*`、`native/landlock-run/*`、`apps/*`、`website`

关键工程约定：

- **ESM 处处皆是**（`"type": "module"`）。跨包用包名 import，包内相对导入用 `.ts`。
- **双编译面（face）**：Host 与 Client 各有一个 tsconfig（`tsconfig.host.json` / `tsconfig.client.json`），构建用 `tsc` 出 `lib/types` + `tsdown` 打包运行时。
- **源码面 vs 产物面**：静态 gate 和测试通过 tsconfig `paths` 解析到 `src`；消费 `lib/` 的 gate 显式声明依赖。
- **严格类型**：`strict: true` + `noImplicitAny`，每个残留 `any` 都要说明为何无法收窄。

## 包组（packages 的分组）

`packages/` 按「组/包」两级组织，包名保持 `@deepseek-ai/dsh-<pkg>`。组 README 拥有「包 ↔ ctx 键」映射。完整分组（来自 `packages/README.md`）：

| 组 | 职责 | 稳定性 |
|---|---|---|
| `core/` | 产品 API 脊柱：session、prompt、tools、agent、具体循环 | 产品 — 稳定 |
| `api/` | 远程 BFF 组装 + Typert RPC 网关 | 产品 — 稳定 |
| `typert/` | 类型图生成、产物加载、运行时注册表 | 产品 — 稳定 |
| `goal/` `schedule/` `feedback/` `identity/` | 目标 / 定时提醒 / 反馈 / 匿名身份 | 产品 — 稳定 |
| `llm/` | LLM 能力族：抽象服务 + provider 适配器 | 产品 — 稳定 |
| `e2b/` | E2B providers | POC |
| `subprocess/` `shell/` `terminal/` `code-runtime/` | 子进程 / Bash / PTY / 代码执行 | 产品 — 稳定 |
| `sandbox/` | 进程隔离 seam（bwrap/Landlock/Seatbelt） | 产品 — 稳定 |
| `fs/` `lsp/` | 文件系统 / LSP 导航 | 产品 — 稳定 |
| `skill/` `compaction/` `context/` | 技能 / 压缩 / 请求上下文 | 产品 — 稳定 |
| `subagent/` `jobs/` `workflow/` | 子代理 / 后台任务 / 工作流 | 产品 — 稳定 |
| `web/` `attachment/` `spill/` | Web 访问 / 附件 / spill 存储 | 产品 — 稳定 |
| `todo/` `plan/` `preset/` `guard/` | todo / 计划 / preset / 守卫 | 产品 — 稳定 |
| `bundle/` `extensions/` `hooks/` | 发行分层 / 运行时自修改 / hook 桥 | 产品 — 稳定 |
| `session/` `session-query/` | 会话数据面 / 会话检索 | 产品 — 稳定 |
| `settings/` `credentials/` `storage/` `workspace/` | 设置 / 凭据 / 存储 / 工作区 | 产品 — 稳定 |
| `sdk/` `acp/` | JSON-RPC SDK / ACP 服务器 | 产品 — 稳定 |
| `interaction/` | 审批 / 权限 / 命令 / ask-user | 产品 — 稳定 |
| `boot/` | app-bin 启动胶水 | 产品 — 稳定 |
| `host/` `client/` | Web GUI 的 Host/浏览器半边 | 产品 — 稳定 |
| `examples/` `test-support/` `util/` | 示例 / 测试基建 / 零依赖工具 | 支持 |

## 依赖方向

`packages/README.md` 明确：**扩展插件依赖 Service Definition，绝不依赖具体 provider**。`dsh-agent-loop` 可替换；UI、hook、工具插件都用 `dsh-agent`。组合 bundle（如 `dsh-agent-spine-demo`）可以依赖脊柱插件。

依赖图是生成的：`docs/module-graph.md`（`pnpm run gen-module-graph`）。

## 工程 gate 一览

根 `package.json` 的 scripts 暴露了完整的质量门禁体系：

- **构建**：`build`（lib host/client + web 前端）
- **测试**：`test`（vitest 单测）、`test:coverage`（CI 覆盖率门禁，每文件 100%）、`test:e2e`（真 API，无 key 自动跳过）、`test:snapshot`（keyless ACP/headless 回放）
- **类型/风格**：`typecheck`、`lint`（oxlint）、`duplication`（jscpd 克隆检测）
- **hygiene**：knip + publint + workspace 约束 + NodeNext 消费者检查
- **doc-sync**：文档全家桶（`verify-cordis-config`、`verify-package-invariants`、`verify-doc-refs`、`verify-doc-budgets`、`verify-export-jsdoc`、`verify-md-links`、`verify-translation-pairing` 等）
- **生成器**：`gen-tool-catalog`、`gen-config-catalog`、`gen-cordis-catalog`、`gen-persistence-catalog`、`gen-doc-graphs`、`gen-module-graph`、`gen-cordis-inspect-catalog`、`gen-scoped-events` 等，每个都有 `--check` 变体做新鲜度门禁。

## 如何继续读

建议按「从骨架到能力」的顺序：先[插件化架构](/deepdive/02-plugin-architecture)，再[组合机制](/deepdive/03-profile-bundle)，然后[回合流程](/deepdive/04-turn-step-flow)与[会话日志](/deepdive/05-session-log)，之后按需跳到各能力族。最后的[源码导读](/deepdive/15-how-to-read-source)给出从文件到源码的具体路径。
