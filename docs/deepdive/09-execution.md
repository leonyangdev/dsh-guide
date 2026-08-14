# 9. 执行层：Shell / 沙箱 / 文件系统

执行层由一组 capability seam 构成，全部挂在一个共享的 **execution world（执行世界）** 上。

## 共享执行世界

subprocess 的 cwd/可执行解析与 fs 的 `processPath`/`fileUrl`/`contains` 必须属于同一世界。消费方（bash-local、terminal-bash、lsp-stdio、tool-fs-search）只依赖 `ctx.fs` + `ctx.subprocess`，因此**把两个 provider 一并换成 `fs-e2b` + `subprocess-e2b`，整个执行层就整体切到远程沙箱**——无需 E2B 专用 fork。边界不移动宿主进程、Cordis 对象、模型调用与会话状态。

## subprocess（`ctx.subprocess`）

Service Definition 为抽象类 `SubprocessRuntime`：

- `resolveExecutable(command, env?, signal?)`：绝对路径验证，或按 scrubbed PATH 找裸名；含分隔符的相对路径直接拒绝。
- `spawn(spec): SubprocessHandle`、`spawnTerminal(spec)`（唯一"深"原语）。
- `SubprocessSpawnSpec` 完全显式（argv/cwd/stdio/graceMs/signal/env），**argv 永不经 shell 解释**。
- stdio 三态：`'pipe'`（原始流给 LSP 做协议帧）、`'inherit'`、`SubprocessCollect{maxBytes, spill?}`（保尾收集 + 可选全量 spill）。
- `SubprocessOutputReader.readFrom(fromByte)`：按整流字节偏移返回增量，offset 滑出内存尾窗报 `lossy` 并指到 `spillPath`。
- `SubprocessHandle.done`（`SubprocessOutcome{exitCode, signal}`，不含输出）、唯一终止动词 `terminate()`（SIGTERM→grace→SIGKILL，树级）、`waitForExit(signal?)`。
- 环境策略单源：`scrubbedParentEnv()` 用 `SENSITIVE_ENV_PATTERN`（KEY/PASSWORD/SECRET/TOKEN）剥掉凭据形变量和全部 `DSH_*`，显式 env 在 scrub 后合并。

`LocalSubprocessRuntime`：POSIX 以 `detached` 起独立进程组、负 pgid 发信号；Windows 走 `taskkill /PID <pid> /T /F`。spill 文件 0600 放在 0700 随机 per-process 临时目录。dispose 是 terminate-and-join，另挂 Node `exit` 同步监听器兜底宿主退出。

## shell（Bash 能力族）

Service Definition 为抽象类 `ShellExecutor`（`ctx.shell`）：

- `resolve(request): ShellExecSpec`（显式默认，无隐藏 `?? default`）。
- `run(spec)`：仅基础设施失败 reject；超时/中止/非零退出都 resolve 成 `ShellRunResult`。
- `start(spec): ShellProcess`：无超时的后台句柄，交给通用 `ctx.jobs`。
- `parseExitStatus`：`[exit code: N]` 标记的唯一渲染契约。

Provider：

- **bash-local**（`LocalBashExecutor`）：每次调用 spawn 全新非登录 `bash -c`；预算 maxTimeoutMs/maxOutputBytes(64KB)/maxSpillBytes(64MB)/graceMs；注入 `ENV_OVERRIDES`（NO_COLOR=1 TERM=dumb PAGER=cat GIT_PAGER=cat）。
- **pwsh-local**（`PwshLocalExecutor`，Windows 对称）：`pwsh -NoLogo -NoProfile -NonInteractive -Command`，命令作为单个 argv 元素（无中间 shell 转义层）。
- **bash-sandbox**（`SandboxBashExecutor`）：`confine(command, policy)` 调 `ctx.sandbox.confine(['bash','-c',command], policy)` 拿 `ConfinedArgv` 后直接 spawn；`danger-full-access` 放行；拒绝归类为结果事实。
- **tool-bash**（Consumer）：workdir 默认取 `agent.session.header.cwd`；`run_in_background` 先 `ctx.jobs.start()` 预检再适配 `ShellProcess`；仅当执行器 sandboxMode 为 confining 时才暴露 `sandbox_permissions`/`justification` 升级字段。
- **shell-env**（`ctx.shellEnv`）：收集可信 `DSH_*`（DSH_HOME、DSH_SHELL=1、DSH_SESSION_ID、DSH_SESSION_JSONL），执行器先删继承的 `DSH_*` 再合并，防嵌套 harness 泄漏。

## terminal（持久化 PTY）

`TerminalSessionService`（`ctx.terminals`）：

- `registerBackend(type)`、`spawn(owner: Agent, request, signal?)` 铸造品牌化 `TerminalSessionId`（'pty-N'）。
- **精确 Agent 所有权**围栏（`FOREIGN_SESSION`/`OWNER_NOT_LIVE`）；每会话同时最多一个 send。
- `terminal-bash` 后端基于 `ctx.subprocess.spawnTerminal`：就绪 = 受控 PS1 提示符标记 + 前台 stdin-wait 事实 + 静默回退 + 绝对超时；send 取消向当前前台进程组发真 `SIGINT`（绝不写 `\x03`）。
- `tool-terminal` 暴露 `terminal_open/send/read/signal/close/list` 六个工具。

## 文件系统（`ctx.fs`）

Service Definition 抽象类 `FileSystem`，12 个原语：`resolve(path,{cwd,signal})→FsTarget`、`processPath`、`fileUrl`、`contains`、`stat/lstat`、`readText/streamText`（UTF-8、拒二进制 `FS_NOT_TEXT`）、`readBytes`（必带 maxBytes 上界）、`listDir`、`writeText/editText`（原子；可选 `FsWriteIntent` 守卫或 `{version}` CAS）。

- **fs-local**（`LocalFileSystem`）：原始 IO 在 Cordis-free 的 `fsio.ts`；原子写 = 目标旁 0700 staging 目录中 `wx 0600` 临时文件 + fsync 发布；`version` 由 bigint dev:ino:size:mtimeNs:ctimeNs 派生；Windows 用 `ReplaceFileW` 保留 DACL。
- **fs-sandbox**（`SandboxedFileSystem`）：只给 writeText/editText 加**每调用 mode 围栏**（读永远放行）：read-only 一律 `FS_SANDBOX_DENIED`；workspace-write 仅当目标在 workspaceRoot + 平台临时目录内。
- **fs-observation-policy**（`ObservedStateGate`）：记录观测并翻译成守卫——未见→edit 抛 `FS_NOT_OBSERVED`、确认 absent→仅允许 createIfAbsent。
- **tool-fs**：read/read_image/write/edit + 执行器，`fs/write-intent` waterfall 取守卫、`fs/observed` 记录观测。
- **tool-fs-search**：glob/grep 用包内 `@vscode/ripgrep` 经 `ctx.subprocess.spawn`（**非** ctx.fs、非 ctx.shell），解析 `--json`。

## LSP（`ctx.lsp`）

`LspService`：`registerProvider` 原子保留品牌化 id + 独占扩展名集合；`query(request, signal?)` 按 `finalExtension` 路由；**只有** goToDefinition/findReferences/goToImplementation/hover 四个语义操作，无 JSON-RPC 逃生口。

- `lsp-stdio` 通用宿主：经 `ctx.fs` 解析 + 包含校验 + 流式读源，经 `ctx.subprocess` 拉进程；按 (serverId, workspace) 惰性单飞池化；每次查询 **transient-open**（didOpen 全量 v1 → 请求 → didClose）。
- `tool-lsp`：单工具四操作，1-based UTF-16 光标。

## 代码运行时（code-runtime）

`ctx.codeRuntime`（`code-runtime`）：`CodeRunRequest`/`CodeRunResult`、绑定命名空间、捕获日志、`CodeRunFailure` 分类。`code-runtime-worker` 后端在 worker 线程里 `run()`。工具注册表在 Code Mode 下消费该服务。

## 沙箱（`ctx.sandbox`）

`ctx.sandbox.confine(argv, policy)` 返回 `ConfinedArgv`。runner 选择在 `sandbox-local`：Linux bwrap（mount profile）→ landlock（`node-addon-landlock-run`），macOS seatbelt（sandbox-exec）。无可用 runner 时 **fail-closed** 抛 `SANDBOX_UNAVAILABLE`。

- 拒绝以结果事实上报（`denied: true`），绝不静默放行。
- `fs-sandbox` 是进程内围栏，与 bash runner 共享 `writableRoots()`。
- 三种 mode（read-only/workspace-write/danger-full-access）经 `sandbox-policy` 的 `sandbox/mode` 事件 + `effectiveSandboxMode` 折叠统一会话级覆盖。

**威胁模型是"可信代码查模型可控路径"，非内核边界。**

## e2b（POC）

`E2BRuntime`（`ctx.e2b`）共享所有者：构造即建沙箱，dispose/超时必删。`fs-e2b` 实现 FileSystem（远程 `realpath -mz` 规范身份、base64+NUL 帧传输、版本=元数据 hash+`dsh-version` xattr）；`subprocess-e2b` 实现 SubprocessRuntime（`exec setsid --wait` 包装脚本记录真实 pgid 与状态文件）。二者让 Bash、PTY、LSP 一起切到远程 Linux 运行时。

## 下一步

- [编排：子代理 / 工作流 / 目标](/deepdive/10-orchestration)
