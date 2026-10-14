# MuseGuide — 数字人导览技术参考

面向博物馆学习场景的对话式具身数字人导览原型，供数字人交互、语音管线和导览状态编排的技术学习与二次实现参考。

**项目状态：原学校演示服务器已回收，目前不提供在线体验或托管服务。** 原演示服务器使用 NVIDIA GeForce RTX 4090（由项目作者确认）；原环境完整软件版本和性能数据未保留，本文不宣称在新机器上已完成复现。

## 毕设演示视频

https://github.com/user-attachments/assets/c688ed39-cae1-4be3-a34b-5fc44310f1b5

历史演示录像，展示数字人导览原型的交互流程；原演示服务器已回收。

## 技术内容

- Vite / TypeScript 前端：多角色导览、字幕、推荐操作、游览进度与内容管理。
- FastAPI 后端：LLM 结构化输出、上下文维护、导览状态更新与下一步建议。
- 火山引擎云端 LLM / 流式 ASR / TTS：需要自行开通服务和配置凭据。
- 默认数字人路径：预生成 MP4 状态切换与 TTS 播放，不需要本地 GPU 推理。
- 可选实时口型路径：LiveTalking + Wav2Lip / WebRTC，现有集成面向 `woman_demo`；需要单独准备 GPU 环境、模型和人物资产。

浏览器输入 → ASR 或文本 → LLM 编排 → 导览状态 / 建议操作 → TTS → 视频状态切换或实时口型输出。

## 服务器与显卡

| 使用方式 | GPU | 建议服务器配置 |
| --- | --- | --- |
| 阅读代码、开发前端、预生成视频 + 云端语音/LLM | 不需要 NVIDIA GPU | 4 核 CPU、8 GB 内存、20 GB 可用磁盘 |
| 单路实时口型参考实现 | NVIDIA RTX 3060 12 GB 或更高 | Ubuntu 22.04、8 核 CPU、16 GB 内存、50 GB 可用 SSD |
| 接近原演示硬件的重建 | **NVIDIA RTX 4090 24 GB** | Ubuntu 22.04、8 核以上 CPU、32 GB 内存、100 GB 可用 SSD |

CPU、内存与磁盘是本项目的规划建议，未在当前仓库重新实测。LiveTalking 上游建议 wav2lip256 使用 RTX 3060 或更高；视频编码也消耗 CPU。多路并发需按分辨率、编码方式与实际模型测量，不能直接用显卡型号推算容量。见 [上游说明](https://github.com/lipku/LiveTalking)。RTX 4090 是原显卡型号，不是运行默认路径的必需条件。

## 软件依赖

| 模块 | 环境 / 依赖 |
| --- | --- |
| 前端 | Node.js 20.19+ 或 22.12+；TypeScript 5.9、Vite 7、GSAP、mouse-follower，精确版本见 `frontend/package-lock.json` |
| API / ASR / TTS | Python 3.10+；FastAPI、Uvicorn、websockets、PyYAML、python-docx、火山引擎 Python SDK，见 `requirements.server.txt` |
| 可选实时口型 | Linux、NVIDIA 驱动、匹配的 PyTorch / torchvision / torchaudio 与 CUDA runtime、FFmpeg、LiveTalking 依赖、Wav2Lip 与人脸检测权重 |
| 外部服务 | 火山引擎 Ark LLM、ASR、TTS 的访问权限、资源 ID 与凭据；浏览器麦克风需要 localhost 或 HTTPS |

开发脚本还使用 Bash 与 `lsof`（Ubuntu 可执行 `sudo apt install lsof`）。`environment.server.yml` 提供 conda 环境。`environment.livetalking.yml` 保留 Python 3.10 / CUDA 12.1 的历史配置参考；它不是最新版 LiveTalking 的兼容性保证。实时口型重建步骤和版本限制见 [集成说明](docs/LIVETALKING_INTEGRATION.md)。

## 本地启动

```bash
conda env create -f environment.server.yml
conda activate museguide
cp museguide/configs/secrets.example.yaml museguide/configs/secrets.yaml
cp .env.example .env
# 填写 secrets.yaml 中的云服务凭据；如使用管理页面，设置 .env 中的管理密码
cd frontend
npm ci
cd ..
./dev.sh
```

也可在已有 Python 环境中执行 `pip install -r requirements.server.txt`。服务端口：API `8000`、ASR `9001`、TTS `8765`、前端 `5173`。打开 `http://localhost:5173/`。开发脚本遇到已占用端口会停止，不会终止其他服务。

管理页面使用 `MUSEGUIDE_ADMIN_PASSWORD` 作为共享管理员凭据。未配置时管理 API 返回 503；缺失或错误凭据返回 401。此实现用于单管理员技术参考，公网部署应额外配置 HTTPS、访问限制和请求限流。默认关闭 LLM 对话调试日志（`llm.yaml` 的 `debug: false`）。对话 API 和语音入口目前没有用户鉴权或配额控制，云服务调用会产生费用。

## 代码导航

```text
frontend/                 UI、录音、语音与数字人播放
museguide/api/            API、管理接口与 WebSocket 代理
museguide/llm/            提示词、结构化响应、上下文与导览编排
museguide/asr/、tts/      火山引擎语音服务接入
museguide/configs/        展品、人设、状态及密钥示例
scripts/                 本地启动与可选集成脚本
deploy/systemd/          通用服务模板
patches/                 LiveTalking 集成补丁
docs/                    技术、设计与历史演示资料
```

新服务器配置见 [部署说明](docs/deployment/MIGRATION.md)。源码不包含模型权重、密钥、运行时人物数据或原服务器环境，历史演示资料可用于理解设计。

## 素材与授权

项目作者确认仓库中的演示图片、音视频素材由其使用 GPT 生成；当前未附逐文件生成记录。详见 [素材及第三方说明](THIRD_PARTY_NOTICES.md)。

**原创代码许可证尚待作者选择，目前没有授予统一的开源许可证。** 第三方代码、模型及其权重遵循各自授权，不会因本仓库公开而自动获得商用许可。技术参考定位也不能替代授权核查。
