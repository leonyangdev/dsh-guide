# 4. 配置模型与 API Key

DeepSeek Harness 通过「凭据引用 + 设置分层」管理模型。**模型配置的修改在下一次请求生效，无需重启服务器**。本章覆盖 DeepSeek 官方、目录 provider、自定义端点，以及直接编辑配置文件的进阶用法。

## 配置 DeepSeek 官方

打开 **Settings → Models**，DeepSeek 卡片只有一个 API key 字段：输入 key，保存即可。

- key 是**只写**的：保存后页面只收到脱敏描述符，不会回传明文。
- 明文密钥存在 `$DSH_HOME/.credentials.yaml`（权限 `0600`），设置里只保存 credential 引用（见[「策略与交互」解读](/deepdive/11-policy-interaction)）。
- 环境变量方式：直接设置 `DEEPSEEK_API_KEY`（可选 `DEEPSEEK_BASE_URL` 指向代理），或放在项目根 `.env`。

## 添加目录里的 provider

点 **Add provider**，选择 Anthropic、OpenAI 等目录 provider，输入 key 保存。已安装的目录提供了 endpoint、协议和模型列表，无需手动填。

注意：有些 provider 用**原生鉴权**而非 API key：

- **Bedrock / Vertex / Azure / Codex** 分别用 AWS 凭据 + region、ADC 项目、`api-version`、OAuth。只填 API key 字段配置不了它们。

## 添加自定义 provider

公司网关、自托管服务、目录里没有的 provider 用 **Add a custom provider**。需要：

- 小写的 **Provider ID**（永久，请求/会话/模型默认值/凭据引用都依赖它，不能改）
- display name、base URL、API 协议、凭据、至少一个模型

**Provider ID 一经创建不可改名**——要改名就新建一个、删掉旧的。display name、base URL、协议、凭据、模型列表仍可编辑。

在 **Model catalog** 下点 **Fetch available models** 会查询表单当前填的 base URL + 凭据（调用 OpenAI 兼容的 `GET /models`）。

## 模型与图片输入

手填的模型默认按**纯文本**处理（因为无法向端点查询它支持哪些模态）。要让自定义 provider 的某个模型支持图片，在 `$DSH_HOME/settings.yaml` 里加一行：

```yaml
llm-pi-ai:
  providers:
    my-gateway:
      apiKeyEnv: GATEWAY_API_KEY
      api: openai-completions
      baseURL: https://gateway.example/v1
      models:
        - id: legacy-chat
        - id: vision-preview
          input: [text, image]
```

- `input` 接受 `text` 和 `image`，只作用于该模型，所以一条路由可以同时服务文本和视觉模型。
- 给路由整体设 `defaultInput: [text, image]` 是**回退**（不是覆盖），默认 `[text]`。
- 目录模型的覆盖要写在 `modelOverrides` 下，按模型 id 键控。

## 选择模型

配置好的 provider 出现在模型选择器里，选中后成为新会话默认模型。**已经发过请求的会话会保留自己日志里记录的模型**。如果保存的默认 provider 被删除，输入区会显示 **Select model** 并阻塞输入直到重新选模型。

## 常见问题

| 症状 | 原因与处理 |
|---|---|
| `MISSING_CREDENTIAL` | 在 Models 页存 key，或提供引用的环境变量 |
| `UNKNOWN_MODEL` | 选择已配置的模型，或给自定义 provider 补上该模型 |
| Fetch models 返回 401 | 检查 key；`GET /models` 是 OpenAI 兼容端点，不支持的端点请手动填模型 |
| 图片在发送前被拒 | 模型未声明 image 模态；给自定义 provider 的模型加 `input: [text, image]` |

## 进阶：直接配置 settings.yaml

高级用户可以直接编辑 `$DSH_HOME/settings.yaml`。所有可配字段见生成的[配置目录](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/config-catalog.md)，LLM 适配器的直接配置见 [`dsh-llm-pi-ai`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/llm/llm-pi-ai) 与 [`dsh-llm-deepseek`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/llm/llm-deepseek) 的 README。

设置分层解析的顺序是：**默认值 → 组合 base → 用户文档**（`settings.yaml`）。模型默认值、凭据引用、catalog 解析、推理控制、适配器错误码都由这些命名空间管理。

## 下一步

模型能用了，接下来进入插件开发的核心：先吃透 [Cordis 框架](/guide/05-cordis-basics)，再写[第一个插件](/guide/06-first-plugin)。
