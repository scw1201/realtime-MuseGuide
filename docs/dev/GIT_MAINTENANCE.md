# Git Maintenance

This repository tracks MuseGuide source code, scripts, documentation, frontend code, and lightweight sample assets.

## Tracked

- Application source under `museguide/`, `frontend/src/`, scripts, service files, and docs.
- Dependency manifests such as `environment.server.yml`, `requirements.server.txt`, and `frontend/package-lock.json`.
- Example configuration such as `.env.example`.

## Not tracked

- Local secrets: `.env`, `museguide/configs/secrets.yaml`.
- Conda and virtual environments: `.conda/`, `.venv/`, `.venv*/`.
- Runtime data and logs: `museguide/data/`, `museguide/logs/`, tenant logs, preview temp folders.
- Large model/checkpoint artifacts: `*.pth`, `*.pt`, `*.ckpt`, `*.safetensors`, `*.onnx`, model zips, and `wav2lip/`.
- Generated frontend builds: `dist/`, `.vite/`, `build/`.
- The nested `livetalking/` checkout, which is managed as its own upstream Git repository.

## Environment

Prefer conda for environment management. Keep environment definitions in version control and keep the actual conda environment directory out of Git.

## Large Assets

Files larger than GitHub's normal file limits should not be committed directly. Store model weights, large generated media, and release bundles outside Git, or introduce Git LFS intentionally if the project needs versioned binary assets later.
