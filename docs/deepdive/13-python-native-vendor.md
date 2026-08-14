# 13. Python / 原生 / Vendor

这一章覆盖发行载体、原生沙箱、框架 pin 与文档/脚本基建。

## python/

### python/sdk（dist `deepseek-harness-sdk`，模块 `deepseek_harness`）

- `DeepSeekHarness`（高层，context manager）与 `HarnessClient`（低层），经 stdio JSON-RPC 驱动 subprocess。
- `Session.run()` 返回 `RunResult(session_id, final_response, finish_reason, events, notifications, session_root)`。
- `finish_reason` 取区间内最后一个 root `turn/end` 的 reason kind。
- 默认注入 bundled config 经 `DSH_CORDIS_CONFIG`。

### python/sdk-runtime（`deepseek-harness-runtime-bin`）

两个 carrier：

- **exe**（生产）：单文件 Node 可执行 `dsh-jsonrpc-agent-pkg-<platform>-<arch>`，目标机无需 Node；固定 wheel 标签 `py3-none-manylinux_2_28_x86_64/aarch64`、`py3-none-macosx_14_0_arm64`。
- **node**（仅开发）：完整 `runtime/node/` 闭包。

零配置 = 客户端显式注入 checked-in 的 `runtime/cordis.yml`（JSON-RPC server、agent core、预载 DeepSeek adapter、JSONL 持久化 + 显式 checkpoint policy、local bash、fs provider）。runtime 坚持"无显式配置即拒绝启动"。构建脚本 `scripts/build-exe-for-python-sdk.ts`。

## native/（原生沙箱）

`native/landlock-run` 维护 **`@deepseek-ai/node-addon-landlock-run`** 家族（入口包 + 平台包三件套）：

- Landlock"先自限再 exec"的启动器，harness 沙箱链（`dsh-sandbox-local` 等）消费它。
- `Landlock Run`/`Landlock Run Release` 两个 GitHub workflow 负责构建/发布各架构产物。

这是 Linux 沙箱的兜底机制：bwrap 不可用时回退到 Landlock（见[「执行层」](/deepdive/09-execution)的沙箱小节）。

## vendor/（vendored Cordis）

已在[「插件化架构与 Cordis」](/deepdive/02-plugin-architecture)详述。要点回顾：

- 9 个包 rescope 为 `@deepseek-ai/*`，manifest 记录上游 commit。
- 18 条本地修改日志。
- sync 流程：记录上游 commit → 拷贝 `src/` → 重放/退役本地修改 → 更新版本与 hash → `pnpm install && test && build`。

## scripts/（gate 与生成器）

`run-gates.ts` 编排 doc-sync 全家桶。生成器：

- `gen-tool-catalog`、`gen-config-catalog`、`gen-client-catalog`、`gen-persistence-catalog`、`gen-cordis-catalog`（统一 Typert 化目录）。
- `gen-doc-graphs`、`gen-module-graph`、`gen-cordis-inspect-catalog`、`gen-scoped-events`。
- `build-exe-for-python-sdk.ts`、`publication-payload.ts`、翻译配对工具链。

每个生成器都有 `--check` 变体做新鲜度门禁——**生成目录永远不手改**。

## website/（VitePress 投影）

`website/` 是**投影适配器，不是内容源**：

- `website/docs.ts` 是权威发布清单（`DocsPage{locale, source, route, label, sidebar, section, order, outline, sourceAliases}`）。
- `scripts/project-doc-site.ts` 构建期把规范 Markdown 投影到被忽略的 `website/.generated/`（重写跨源链接、把图片随页搬运）。
- `mirroredPages`/`pairedPages` 负责中英路由投影（翻译缺失时两路由都投影可用源）。
- 源文件永远留在各 `docs/` 层，`website/` 树内不保存任何规范文档内容。

> 本教程站是独立的 VitePress 项目，与官方 `website/` 投影机制不同：官方以仓库 Markdown 为唯一内容源，通过清单投影；本教程是面向学习者的独立中文站。

## 小结：整棵树的发行面

- `python/` 承担非 Node 环境的发行载体。
- `native/` 承担 Linux 原生沙箱。
- `vendor/` 承担框架 pin 与可审计性。
- `scripts/` + `website/` 以 gate 与生成器保证文档/组合/目录的单一事实来源。

## 下一步

- [事件与能力 Seam 全景](/deepdive/14-events-map)
- [源码导读](/deepdive/15-how-to-read-source)
