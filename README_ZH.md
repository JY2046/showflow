# ShowFlow · 路演工作台

沿用用户选择的 Stage Console：深石墨色、淡紫强调色、导演台大画面和底部分镜。当前实现由“作品”入口串起导入、参考搜集、AI 改版、样式、导出、彩排和复盘。默认英文界面，可在顶部切换简体中文；界面语言单独保存，不会翻译或重写用户的项目标题、正文、演讲备注和借鉴笔记。

## 操作流程

1. 在“作品”选择自己的 `.pptx`，查看解析预览与逐页提示，确认导入。支持 1–30 页、最大 30MB；旧 `.ppt` 先另存为 `.pptx`。原始文件保留在本浏览器，旧项目先备份。
2. 输入公开的行业或产品描述，点击“自动搜集参考”。默认实时读取公开路演目录，按公司名及中英文行业词匹配，返回至多 6 条来源。可以进入参考库查看、收藏和填写借鉴笔记。
3. 勾选参考与页面，填写改版要求。默认通过 Firebase AI Logic 使用 Chrome 设备模型，每批 1–6 页英文内容；演讲备注默认不参与。可明确选择设备优先/云端模式并确认发送范围，或使用原有 Ollama。当前项目的 Gemini 免费云端请求被 Google 以 403 拒绝，云端成功与自动接力尚未验收。
4. 逐页看原稿与 AI 建议、修改理由、借鉴来源。选择采用哪些页，或继续修改要求。采用后可撤回；改版记录可导出 JSON。
5. 进入样式调整配色、字体、字号、留白、对齐与版式，支持整套或单页调整，应用到导演台并导出可编辑 PPTX。
6. 选择 180 秒或 90 秒节奏，进入实际计时彩排、暂停、切页和备用画面；复盘显示实际停留时间，手卡可下载。

## 保存与内容边界

- 本浏览器 IndexedDB 保存当前页面、项目名、导入信息、原始文件、版本、AI 建议与样式。收藏/笔记/样式另存 localStorage。截图以本机数据保存；刷新恢复项目。彩排中的计时、问答记录仍是本轮会话状态，不提供登录和跨设备同步。
- 原稿保留原始字节，可点击“下载原文件”。网页预览按提取到的文字及图片位置重建，**不是 PowerPoint 的完整渲染**。表格、图表、SmartArt、复杂组合、特殊字体、裁切、动画等会提示需要核对；这些元素仍在原文件中。
- 改版导出为新的 16:9 演示文件：可编辑标题、正文、页脚、保留的讲稿及每页主图。不会声称完整保留原稿的任意图形、全部图片或动画。默认不把原始文件和图片发送到模型；可选云端模式只发送已确认范围的文字。
- 默认搜索来自 [Awesome Pitch Decks 公开目录](https://github.com/midovislam/awesome-pitch-decks)，仅保存元信息与来源链接，不下载或转存第三方整套原稿。目录中的年份与轮次属于原发布信息，尚未逐一独立核实。行业匹配由编辑配置的关键词/公司关联完成；当前未自动通读第三方整套 PPT。AI 只收到来源摘要及用户借鉴笔记，使用参考不等于验证了相应业务事实。
- AI 返回先校验页 ID、引用 ID、版式、新增数字及新出现的参考公司名，业务事实、限定词及中文数字仍需人工复核。本机小模型试跑曾出现扩写原稿及理由不准确，需要逐页筛选；验证通过的是操作流程，未把模型文案质量判为合格。修改时若原稿已变化，过期建议会拒绝应用。失败不产生替代建议。
- 内置“会议行动卡”和 QA 原稿为合成流程样例；其中任务、人物与效果均非用户真实业绩。90/180 秒为模板/文字权重分配，复盘建议与示例问答仍采用规则。

## Firebase 接入与本地运行

需要 Node.js 20.19+ / 22.12+。安装依赖后，按 `firebase.config.example.json` 的结构创建 `.runtime/firebase.local.json`；填写自己的 Firebase 网页配置、云端模型名及已登记的 App Check 本地调试凭证。文件只保存在本机，权限设为 600。配置模板不包含本项目的实际凭证。

```sh
npm install
npm run build
npm start
```

入口为 `http://localhost:4173/`。当前机器已配置免费项目并启动；独立合成稿测试入口为 `http://localhost:4175/`，与原项目分开保存。英文测试稿位于 `qa/firebase/ShowFlow_English_Synthetic_2slides.pptx`。

在“作品”中准备设备模型、验证 App Check、选择页面与处理方式，展开文字范围并确认，再生成。设备模式为 `ONLY_ON_DEVICE`；允许云端接力后使用 `PREFER_ON_DEVICE`；明确云端模式为 `ONLY_IN_CLOUD`。来源从 SDK `response.inferenceSource` 读取，不根据网络状态猜测。每次处理、范围或方式变化后都需重新确认。设备内内容不上传；模型下载、应用证明仍可能联网。

设备内改版当前限定为英文原稿、要求及借鉴笔记。Chrome 支持的语言与设备条件由浏览器决定；下载需用户点击。中文可用云端路径或明确选择原有本机 Ollama。当前 Google 对此项目返回“free tier is not available for this project”，没有升级付费，也没有以其他服务冒充云端成功。

App Check 已在控制台设为基本保护强制执行；本地使用官方调试令牌交换。调试凭证仅由本机、同源配置接口读取，不写入构建资源、文档、源码包或公开网站。线上使用需另配正式证明提供方，例如 reCAPTCHA Enterprise；不能将本机调试接口直接公开。Firebase 网页配置也在运行时提供。

原有 Ollama 与公开目录服务保留。使用 Ollama 时按需运行 `npm run model:start` 和首次 `npm run model:pull`；模型为 `qwen2.5:1.5b`，权重独立保存在 `.runtime/ollama-models`。旧 OpenAI 适配仅在服务端显式配置并选择原有服务时启用，不能代替 Firebase 技术验证。`.env.example` 只是说明，不会自动加载。

当前未公开发布。保留的 Sites 静态打包适配不包含本机 Node 配置接口；完整公开部署仍需要正式 App Check、服务配置和用户隔离。

## 文件与验证

- `src/Workflow.jsx`：作品、导入确认、搜索、改版对比与采用。
- `src/pptx-import.js`：浏览器内 PPTX 文字/图片/备注解析及复杂元素提示。
- `src/App.jsx`、`src/Workspaces.jsx`：项目保存、版本、样式、导演台、彩排与复盘。
- `src/deck.js`、`src/timing.js`：共享排版、可编辑导出、可变页数节奏。
- `server/api.mjs`、`server/local-ai.mjs`、`server/catalog.mjs`：本机接口、实际模型调用、真实目录获取与匹配。
- `server/start.mjs`：构建后的本地页面与 API 服务。
- `src/firebase-ai.js`、`src/firebase-policy.js`、`src/FirebasePanel.jsx`：官方 Firebase 运行时、处理范围及连接面板。
- `src/revision-core.js`：本机服务与浏览器共用的改版验证。
- `server/firebase-config.mjs`：仅本机可访问的运行时配置。
- `qa/firebase/`：真实 ON_DEVICE 记录、App Check 强制执行、云端 403、选择采用及导出证据。
- `qa/pipeline/`：测试原稿、实际搜索/改版/导出记录及浏览器/原生 PowerPoint 核验。
- `design-qa.md`：本轮视觉与交互验收记录。

```sh
npm test
npm run build
```

单元检查覆盖导入顺序/备注/无图页、文件边界、时长分配、引用及数字校验、来源过滤和目录解析；模拟响应只用于单元检查，实际生成另存集成证据。

## 已验证与参赛待办（2026-11-17）

官方 `firebase@13.3.0` 已实际调用：两页英文合成稿的推理来源均为 `ON_DEVICE`，此前耗时约 17 秒及 5 秒；本轮英文全流程再次得到两个真实设备结果，耗时约 28 秒及 4 秒。App Check 真实验证通过，控制台基本保护已强制执行。选择采用第二页、首页保持、刷新恢复、导出两页可编辑 PPTX、进入 180 秒彩排已核验；26 项自动检查及构建通过。

为避免将计划润色成业绩，含“prototype / plan / unverified / 尚未验证 / 计划”等状态的原稿句子在正文中由应用原样保留；这是一组有限规则，不等于完整事实校验。模型仍可能改写不自然、补出价值判断或写错理由，必须人工复核。测试首页建议未采用。新导出完成包内文本核验，未在本轮再次做 PowerPoint 原生外观验收。

云端代码路径已发出真实请求，但被 Google 免费额度限制拒绝，未取得 `IN_CLOUD` 成功结果，也未验证成功的自动接力。Chrome 管理设备模型，SDK 不提供精确模型代际；已证明真实设备执行，Nano 4 的具体版本标识尚未独立核实，未更改 Chrome 诊断设置。

英文导航、导入预览、参考检索与筛选、模型和隐私确认、逐页建议、样式、彩排、复盘、错误与导出说明已补齐。英文合成稿走通导入→实时搜集6条来源→真实设备生成→仅采用第一页→独立换色→英文PPTX/手卡导出→彩排和复盘；中英文往返切换保持标题与正文不变。样例图像内的原始文字和已有用户资料保持原样，不做自动翻译。公开代码仓库与开源许可证、可供评审访问的运行版本、英文演示视频及正式提交仍待完成。英文说明见 `README_EN.md`。赛事规则接受 App Check 调试令牌，但不得公开凭证。不能据当前结果宣称所有参赛条件已完成。

官方参考：
- [赛事规则](https://firebasehybridaihackathon.devpost.com/rules)
- [Firebase Web 端云推理](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started)
- [App Check 设置](https://firebase.google.com/docs/ai-logic/app-check)
- [Chrome Prompt API 语言与设备支持](https://developer.chrome.com/docs/ai/prompt-api)

## 云端403与赛事账户（2026-11-17）

Google官方说明：并非所有项目/账户都有Gemini免费资格，资格在项目级判断，同一项目换密钥不能解除限制。当前错误明确为免费资格不可用，未返回需要手机验证的 `FREE_TIER_VERIFICATION_REQUIRED`，也不同于App Check无效。没有开通Blaze或绑定支付方式，未循环重试403。

已在用户确认后提交[赛事临时账户申请](https://forms.gle/uPcDhaYW3iVo2AYw5)，回执显示“您的回复已记录”；Devpost项目草稿为 [ShowFlow](https://devpost.com/software/showflow)。申请如实说明当前403，如实填写申请信息。审核和Didit身份核验待完成；不能将“申请已提交”等同于“额度已获批”。临时账户约4天，不会直接给原Spark项目充值。

Sprint 2截止为2026-11-18 10:00 PT（北京时间11月19日02:00），官方计划11月19日PT发放。账户到位后应保留原本机配置，另存临时配置，并重新核验App Check、真实 `IN_CLOUD` 结果与 `PREFER_ON_DEVICE` 接力，确认期限。身份照片和自拍由用户本人按官方邮件完成，不写进项目或公开源码。

本轮证据在 `qa/english-quota/`。申请前截图含联系信息，仅用于本机归档，不包含在可分享源码包中。参见 [Gemini官方排障](https://aistudio.google.com/docs/troubleshooting#free-tier-unavailable)。
