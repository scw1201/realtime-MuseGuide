# Server Migration Guide

MuseGuide can be moved away from the original 718 demo server. The application code is portable; the parts that need migration attention are credentials, Python/Node dependencies, LiveTalking assets, and any large model/avatar files that are not committed to Git.

## What Is Portable

- Frontend source and static demo media in `frontend/`
- FastAPI backend and guide logic in `museguide/`
- ASR/TTS workers
- Generic systemd templates in `deploy/systemd/`
- Remote deployment helper `scripts/deploy_remote.sh`

## What Is Not Committed

These files must be provisioned on the new server:

- `.env`
- `museguide/configs/secrets.yaml`
- `.conda/` or any other local Python environment
- model checkpoints such as `.pth`, `.pt`, `.ckpt`, `.safetensors`, `.onnx`
- nested LiveTalking runtime repository/data if used directly
- runtime logs and generated tenant data

## Recommended New Server Layout

Use a normal user account with SSH access:

```text
/home/<user>/museguide
```

The deploy script will create:

```text
/home/<user>/museguide/.conda
/home/<user>/.config/systemd/user/museguide-*.service
```

## Deploy To A New Server

From your local checkout:

```bash
REMOTE_HOST=user@new-server \
REMOTE_DIR=/home/user/museguide \
./scripts/deploy_remote.sh
```

Optional ports:

```bash
API_PORT=8000 ASR_PORT=9001 TTS_PORT=8765 \
REMOTE_HOST=user@new-server \
REMOTE_DIR=/home/user/museguide \
./scripts/deploy_remote.sh
```

`REMOTE_DIR` must be an absolute path on the new server. `REMOTE_USER_DIR` defaults to `.config/systemd/user` under the remote login user's home directory.

## Copy Secrets

After the repository is synced, create these files on the new server:

```bash
ssh user@new-server
cd /home/user/museguide
cp .env.example .env
mkdir -p museguide/configs
$EDITOR museguide/configs/secrets.yaml
```

The secrets file should contain the production ASR/TTS/LLM credentials used by your deployment.

## LiveTalking And Avatar Runtime

If you need the live avatar path, provision the LiveTalking runtime and model/avatar assets on the new server. The repository keeps only integration scripts and patches, not all runtime model files.

Useful scripts:

```bash
./scripts/apply_livetalking_museguide_patch.sh
./scripts/prepare_livetalking_woman_wav2lip.sh
./scripts/run_livetalking.sh
```

For a first migration pass, verify the regular frontend/API/ASR/TTS path before enabling LiveTalking.

## Verify Services

On the new server:

```bash
systemctl --user status museguide-api.service
systemctl --user status museguide-asr.service
systemctl --user status museguide-tts.service
```

From your local machine:

```bash
curl http://new-server:8000/healthz
```

If the frontend is served through Vite during development, use an SSH tunnel:

```bash
ssh -N \
  -L 127.0.0.1:5173:127.0.0.1:5173 \
  -L 127.0.0.1:8000:127.0.0.1:8000 \
  -L 127.0.0.1:8010:127.0.0.1:8010 \
  user@new-server
```

## 718-Specific Files

`deploy/718-linux/` and historical notes may still mention:

```text
/media/lenovo/aigo/data/my_museguide
```

Those files are preserved as a record of the graduation demo server. For new machines, prefer `deploy/systemd/` plus `scripts/deploy_remote.sh`.
