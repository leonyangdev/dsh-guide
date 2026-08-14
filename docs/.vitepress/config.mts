import { defineConfig } from "vitepress";

// GitHub Pages 项目站的 base 路径（用户/组织根站点则用 '/'）
const base = "/dsh-guide/";

// 教程侧边栏（从入门到精通）
const guide = [
  { text: "1. 认识 DeepSeek Harness", link: "/guide/01-intro" },
  { text: "2. 安装与运行", link: "/guide/02-install" },
  { text: "3. 使用 Web UI", link: "/guide/03-webui" },
  { text: "4. 配置模型与 API Key", link: "/guide/04-models" },
  { text: "5. Cordis 核心概念", link: "/guide/05-cordis-basics" },
  { text: "6. 你的第一个插件", link: "/guide/06-first-plugin" },
  { text: "7. 开发一个工具 Tool", link: "/guide/07-tool" },
  { text: "8. 插件配置", link: "/guide/08-config" },
  { text: "9. 打包与安装插件", link: "/guide/09-package-install" },
  { text: "10. 服务与依赖", link: "/guide/10-services" },
  { text: "11. 事件系统", link: "/guide/11-events" },
  { text: "12. 能力的三层拆分", link: "/guide/12-capability-seam" },
  { text: "13. 编写 LLM 适配器", link: "/guide/13-llm-adapter" },
  { text: "14. 进阶：组合、作用域与动态插件", link: "/guide/14-advanced" },
];

// 项目解读侧边栏（整个项目拆解）
const deepdive = [
  { text: "1. 项目全景", link: "/deepdive/01-overview" },
  { text: "2. 插件化架构与 Cordis", link: "/deepdive/02-plugin-architecture" },
  { text: "3. Profile / Bundle 组合机制", link: "/deepdive/03-profile-bundle" },
  { text: "4. Agent 回合与步骤生命周期", link: "/deepdive/04-turn-step-flow" },
  { text: "5. 会话日志与持久化", link: "/deepdive/05-session-log" },
  { text: "6. 工具执行管线", link: "/deepdive/06-tool-pipeline" },
  { text: "7. 核心包拆解", link: "/deepdive/07-core-packages" },
  { text: "8. LLM、上下文与压缩", link: "/deepdive/08-llm-context" },
  {
    text: "9. 执行层：Shell / 沙箱 / 文件系统",
    link: "/deepdive/09-execution",
  },
  {
    text: "10. 编排：子代理 / 工作流 / 目标",
    link: "/deepdive/10-orchestration",
  },
  { text: "11. 策略与交互", link: "/deepdive/11-policy-interaction" },
  { text: "12. 平台接入与 SDK", link: "/deepdive/12-platform" },
  {
    text: "13. Python / 原生 / Vendor",
    link: "/deepdive/13-python-native-vendor",
  },
  { text: "14. 事件与能力 Seam 全景", link: "/deepdive/14-events-map" },
  { text: "15. 源码导读", link: "/deepdive/15-how-to-read-source" },
];

export default defineConfig({
  lang: "zh-CN",
  title: "DeepSeek Harness 深度指南",
  description:
    "DeepSeek Harness（dsh）从入门到精通教程，以及对整个开源项目的深度拆解解读",
  base,
  head: [["link", { rel: "icon", href: `${base}favicon.svg` }]],
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "首页", link: "/" },
      { text: "教程", link: "/guide/01-intro" },
      { text: "项目解读", link: "/deepdive/01-overview" },
      {
        text: "GitHub",
        link: "https://github.com/deepseek-ai/deepseek-harness",
      },
    ],
    sidebar: {
      "/guide/": [{ text: "从入门到精通", items: guide }],
      "/deepdive/": [{ text: "项目深度解读", items: deepdive }],
    },
    outline: { label: "本页目录", level: [2, 3] },
    docFooter: { prev: "上一篇", next: "下一篇" },
    darkModeSwitchLabel: "外观",
    lightModeSwitchTitle: "切换到浅色主题",
    darkModeSwitchTitle: "切换到深色主题",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "返回顶部",
    lastUpdatedText: "最后更新",
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "搜索文档", buttonAriaLabel: "搜索文档" },
          modal: {
            displayDetails: "显示详细列表",
            resetButtonTitle: "清除搜索",
            backButtonTitle: "关闭搜索",
            noResultsText: "未找到相关结果",
            footer: {
              selectText: "选择",
              navigateText: "切换",
              closeText: "关闭",
            },
          },
        },
      },
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/deepseek-ai/deepseek-harness",
      },
    ],
  },
});
