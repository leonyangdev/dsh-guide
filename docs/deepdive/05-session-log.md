# 5. 会话日志与持久化

会话日志是整个产品的**唯一事实来源**。fork、resume、transcript、遥测、持久化全部从这条流派生。理解它，就理解了"模型可见 ⟺ 可重建"这条核心不变量。

## 核心不变量：模型可见 ⟺ 已记录

> 任何到达模型请求的内容都必须能从日志重建；运行时不变式会断言这一点。

这就是为什么新增一个模型可见输入必须配一个新的会话事件：扩展 `SessionEventMap`，并从日志渲染。

## 内存层：Session 与 SessionStore（core/session）

`ctx.sessions`（`SessionStore`）持有只追加的 Session 实例，并发出持久会话事件流。

- `Session`：append-only 日志（`log: SessionEvent[]`）+ 增量 surface + 派生态。
- `SessionStore.create(id?, {seed, meta})`（或 `prepare→enter→announce` 分离版，供 agent-loop 有序拆除）、`flush(session)`（`session/flush` parallel 持久化屏障）、`fork(source, boundary?)`（在 completed turn 边界切种子）、`get/list`。
- `Session.append(type, data, surfaceIntent?)`：同步提交 + 通知。

### append 的校验链

`append()` 先做 `snapshotJsonValue(data)` 单遍校验 + 复制（拒绝 BigInt/循环引用/`-0`/稀疏数组等非 lossless JSON），构造 `{type, seq: log.length, time, data}` 并深冻结，经 `SurfaceManager.validateNext` 校验 surfaceOp 形状、`sourceEventSeqs` 唯一且早于当前、replace 区间必须命中现有节点且覆盖全部被遮蔽 seq（`tool/result` 重写只能改 content），然后 push 并逐个 invoke carrier 过滤的 `session/event` 监听器——**每个监听器独立容错**（同步抛/异步 reject 只记日志，不阻塞）。

### 几个硬约定

- `seq = log.length` 连续契约。
- 事件进入日志即提交；热路径不阻塞 I/O。
- 接受即深冻结 + 仅 lossless JSON。
- `SESSION_FORMAT_VERSION = 0`：未知事件类型默认拒绝重建，除非事件带 `ignorable: true`。

## deriveMessages：从日志投影模型历史

只有三类 surface 事件参与：`user/message`、`assistant/message`、`tool/result`。

- `deriveEventMessage` 逐节点直通返回事件内已冻结的 Message；assistant 空 content 返回 null（不进历史，但持久事件仍保留 usage 与 `sourceEventSeqs`）。
- `Session.deriveMessages()` 缓存投影，`surface.replaceGeneration` 变化即整体重建。
- chunk/boundary/usage 等 log-only 事件不进历史。

关键点：**surface 的 replace（压缩）只遮蔽不删除**。原始日志保留，但未来请求不再发送被遮蔽消息（KV cache 从首个被遮蔽消息起失效）。人类 transcript 必须读 append-origin 事件，而非 surface。

## 持久化 seam（session/session-persistence）

`ctx.sessionPersistence`（`SessionPersistence`）是持久化 seam，方法含 `create/append/load/prepare/inspect/readFrom/list/listSnapshots/locate/readRaw`。

- `PersistenceCoordinator`：write-behind 批量（`DEFAULT_WRITE_BATCH_MAX_DELAY_MS`/`MAX_WRITE_BATCH_DELAY_MS`）、prepared-session 缓存、不透明 `SessionPersistenceRevision` 变更令牌。
- `sessionFormatVersionRefusal` 拒绝非 v0 日志并指明方向。
- `session-checkpoint-policy` 包装 `ctx.llm`/`ctx.tools` 施加语义化 checkpoint。

### 两个后端

**SQLite**（`session-persistence-sqlite`，用 `node:sqlite` 的 `DatabaseSync`）：

- `SCHEMA_VERSION = 15` 只针对表结构，与事件词汇版本正交。
- `APPLICATION_ID = 0x44534850`（`DSHP`）。
- 三张 STRICT 表：`persistence_state`（单行）、`sessions`（SessionHeader 元数据，**懒物化**——首次 append 才落行）、`events`（每事件一行，`data` JSON + `source_event_seqs`/`surface_op`/`ignorable`）。
- 打开时在 `BEGIN IMMEDIATE` 内校验 `user_version`/`application_id`，不兼容即拒绝而非原地迁移。
- `scanRows` 实现与 JSONL 相同的 crash-tail-on-load 语义：保留最后一个 `turn/end` 前的连续前缀，torn 尾巴截掉。

**JSONL**（`session-persistence-jsonl`）：SessionId 路径消毒、`type:'session'` 头行、截断修复偏移；压缩可选 `zstd`（`.jsonl.zstd`）或 `none`。

## 投影（projection）

`SessionProjectionRegistry`（`ctx.sessionProjections`）驱动 merge-extensible 的 `SessionProjectionMap`。

- 领域贡献纯函数 `ProjectionDefinition{key, schema, init/apply/view, stateVersion}`，遵守"whole-value event"规则（事件携带完整状态），eager 订阅 `session/event`。
- `snapshot/checkpoint/restoreFloor/viewCheckpoint/restore` 构成冷读阶梯。
- `session-projection-cache` 把 checkpoint 持久化（`session_projcache` domain），按 `writeEveryEvents/writeIntervalMs` 节流 write-behind，`turn/end` 与 session 销毁为强制写点，全 fail-soft。
- `sessionStats` 单元折叠 `step/end` 等事件得到 turns/steps、llmMs/toolMs/ttftMs/decodeMs/decodeTokens。

投影让列表读取**永远不需要加载完整日志**：缓存行 + 持久化尾部回放。

## 标题与遥测

- **标题**：`ctx.sessionTitle` 以日志事件 `session/title`（含 title、messageSeqs、source=fallback/provider/user；用户改名即固定）驱动。确定性回退 + 可选异步 LLM 提供方（`first-prompt-llm`/`all-prompts-llm` 二选一注册）。
- **遥测**：`ctx.sessionTelemetry` 只做捕获侧，`session-telemetry/record` waterfall 是脱敏扩展点（fail-closed）；`session-telemetry-otel` 经 OpenTelemetry logs 按 `FULL/FEEDBACK_ONLY/DISABLED` 三种模式投递。

## Spill 存储

超大工具输出不直接进日志：`packages/spill/` 定义 `ctx.spillStore`（`SaveTextSpill`/`SpillRef` 品牌定位符），`spill-local` 存为 session 作用域文件，`spill-policy` 监听 `ctx.tools` post-execute——超大输出落盘、内联只留预览 + 取回提示（如 grep/glob 的 "Full result stored at: …"）。

## 下一步

- [工具执行管线](/deepdive/06-tool-pipeline)——`tool/call` 与 `tool/result` 事件之间的完整链路
