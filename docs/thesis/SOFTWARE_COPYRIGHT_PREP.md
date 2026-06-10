# MuseGuide 软著申报准备建议

## 1. 项目是否适合申报

适合。

`MuseGuide` 不是单一脚本或纯静态展示，而是一个较完整的软件系统，包含：

- 前端交互层：`frontend/src/*`
- 后端接口层：`museguide/api/server.py`
- 语音识别链路：`museguide/asr/*`
- 语音合成链路：`museguide/tts/*`
- LLM 导览编排与状态管理：`museguide/llm/*`
- 业务配置与人物设定：`museguide/configs/*`

按软著口径，更适合定义为“面向博物馆场景的对话式数字人导览系统”。

## 2. 建议软件名称

优先推荐以下 3 个名称：

1. `MuseGuide 博物馆对话式数字人导览系统 V1.0`
2. `MuseGuide 智能博物馆导览系统 V1.0`
3. `MuseGuide 具身数字人导览软件 V1.0`

建议：

- 如果你后续偏论文/研究展示，选第 1 个。
- 如果你后续偏产品化、报项目、投标，选第 2 个。
- 如果你想突出数字人特征，选第 3 个。

最稳妥的首选是：

`MuseGuide 博物馆对话式数字人导览系统 V1.0`

## 3. 建议权利人申报口径

如果该项目由你个人独立完成，建议优先按：

- `自然人独立开发`

这样材料最简单。

如果存在以下情况，要额外准备权属文件：

- 学校/实验室项目：看是否属于职务开发
- 和同学合作：要明确合作开发关系
- 导师或单位要求挂单位：要确认代码著作权归属
- 基于他人完整项目二次开发：要确认是否有许可及实质性改进

## 4. 项目核心功能概括

申报时可概括为以下功能模块：

1. 多人物数字导览员管理
2. 博物馆展区与展品知识配置管理
3. 用户语音输入与实时语音识别
4. 基于上下文的导览对话生成
5. 导览阶段状态机与进度维护
6. 推荐动作与连续交互承接
7. 语音合成播报与数字人视频状态联动
8. 展厅路线与展品信息可视化展示

## 5. 建议作为“核心代码材料”的文件

软著交存代码通常建议突出“你自己的核心逻辑”，不要把大量第三方库、媒体资源、缓存文件塞进去。

### 推荐优先纳入的 Python 代码

- `museguide/api/server.py`
- `museguide/llm/orchestrator.py`
- `museguide/llm/prompt_builder.py`
- `museguide/llm/response_parser.py`
- `museguide/llm/tour_state_manager.py`
- `museguide/llm/initiative.py`
- `museguide/llm/context_store.py`
- `museguide/llm/guide_stage.py`
- `museguide/asr/ws_server.py`
- `museguide/asr/v3_bigmodel_client.py`
- `museguide/tts/worker_v3.py`
- `museguide/tts/service.py`

### 可选纳入的前端代码

- `frontend/src/main.ts`
- `frontend/src/app/controller.ts`
- `frontend/src/app/ui.ts`
- `frontend/src/net/ASRClient.ts`
- `frontend/src/net/TTSClient.ts`
- `frontend/src/net/PCMRecorder.ts`
- `frontend/src/audio/AudioEngine.ts`
- `frontend/src/video/VideoEngine.ts`

### 不建议作为主体代码交存的内容

- `frontend/public/*` 下的大量图片、视频、音频素材
- `docs/assets/source-images/*`
- `docs/assets/*`
- `package-lock.json`
- 日志文件：`museguide/logs/*`
- 演示目录：`volcengine_binary_demo/*`

原因：

- 这些内容会抬高材料体积
- 对“软件原创性”证明帮助有限
- 容易让交存材料看起来像资源包而不是程序

## 6. 代码页怎么抽更稳

官方通常要求源程序前后各连续 30 页；不足 60 页则交全部。

对本项目，更建议先整理出一份“用于交存的源代码汇编版 PDF/Word”，把核心文件拼接成连续页，再导出。

建议顺序：

1. `museguide/api/server.py`
2. `museguide/llm/orchestrator.py`
3. `museguide/llm/prompt_builder.py`
4. `museguide/llm/tour_state_manager.py`
5. `museguide/llm/initiative.py`
6. `museguide/asr/ws_server.py`
7. `museguide/asr/v3_bigmodel_client.py`
8. `museguide/tts/worker_v3.py`
9. `frontend/src/app/controller.ts`
10. `frontend/src/net/ASRClient.ts`
11. `frontend/src/net/TTSClient.ts`

这样拼出来的代码更能体现：

- 前后端联动
- 语音识别/语音合成
- 导览状态机
- 基于上下文的交互编排

## 7. 说明书建议写法

最省事的是做一份 `用户操作说明书` 或 `软件设计说明书`。

建议目录：

1. 软件名称
2. 开发背景与目标
3. 运行环境
4. 系统总体架构
5. 功能模块说明
6. 操作流程说明
7. 关键界面截图
8. 数据与配置说明
9. 主要创新点

### 可直接复用的项目素材

- 项目介绍：`README.md`
- 技术路径：`TECH-README.md`
- 架构图素材：`docs/assets/opening/system-architecture-clean.png`
- 界面素材：`docs/assets/opening/prototype-ui.png`
- 功能图示：`docs/assets/readme/*`

### 说明书里建议强调的创新点

1. 多角色人格化导览机制
2. 基于导览阶段的状态机控制
3. 会话级展区/展品进度维护
4. 连续确认式交互承接
5. ASR + LLM + TTS + 视频状态联动的一体化导览链路

## 8. 软著申请表里的“软件简介”可参考

`MuseGuide 博物馆对话式数字人导览系统是一款面向博物馆参观场景的智能导览软件。系统集成语音识别、对话生成、语音合成、导览状态管理与数字人视频联动等功能，可根据用户输入、当前展区、展品进度及导览角色设定生成个性化讲解内容，并实现展厅导览、展品讲解、路线引导和连续交互推荐。该软件适用于博物馆数字导览、文化展陈互动展示及教育讲解等应用场景。`

## 9. 你现在就该准备的材料

### 必备

- 软件名称
- 版本号
- 开发完成日期
- 身份证或主体证明
- 源代码交存材料
- 软件说明文档

### 视情况补充

- 合作开发协议
- 委托开发协议
- 职务开发证明
- 项目任务书

## 10. 对这个项目的实际建议

这套项目当前最适合按下面这个方向提交：

- 名称：`MuseGuide 博物馆对话式数字人导览系统 V1.0`
- 申请人：你个人
- 开发方式：独立开发
- 材料重心：后端导览编排 + 前端交互链路 + 说明书

不建议把它写成：

- 单纯“网站”
- 单纯“数字人视频播放器”
- 单纯“语音识别 demo”

因为从代码结构看，它真正的价值在于：

- 导览业务逻辑
- 会话状态推进
- 多角色导览机制
- 语音与视频联动

## 11. 后续可继续做的两件事

1. 生成一份可直接提交的《软件说明书》初稿
2. 自动整理一份“软著交存代码汇编版”
