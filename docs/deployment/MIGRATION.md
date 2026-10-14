# 新服务器部署参考

本仓库提供数字人技术参考与新服务器部署指引，当前不提供在线托管服务。作者确认原 GPU 是 NVIDIA RTX 4090，其他硬件及完整依赖版本未保留。

先在新机器验证 README 的默认 MP4 + 云端 API 路径，再按 `docs/LIVETALKING_INTEGRATION.md` 准备实时口型环境。配置密钥、域名、HTTPS 和访问控制后，使用 `deploy/systemd/` 的模板，将所有占位符替换为自己的路径和环境。旧服务器专用配置已移除。

可选上传源码：

```bash
REMOTE_HOST=user@new-server \
REMOTE_DIR=/home/user/museguide \
./scripts/deploy_remote.sh
```

上传源码不等于完成部署。另行安装 Python / Node 依赖、填写本地 `.env` 和 `secrets.yaml`、执行 `npm ci && npm run build`，并准备所选模型和人物资产。不要将凭据或用户对话日志提交到 Git。

验证顺序：API 启动 → 文本对话 → ASR → TTS → 前端播放 → 可选实时口型。检查无凭据管理请求被拒绝，确认公网访问使用 HTTPS，并为公开对话和语音入口增加用户鉴权、限流及云服务预算控制。
