# LiveTalking Integration

MuseGuide keeps two playback paths:

- `non-live`: existing local MP4 state scheduling plus MuseGuide TTS.
- `live-lipsync`: LiveTalking Wav2Lip WebRTC output driven by MuseGuide LLM `tts_text` and `video_state`.

The first live-lipsync version supports `woman_demo` only. Other personas keep using non-live playback.

## Setup and version status

The reference demo environment used an RTX 4090 GPU. The original LiveTalking commit was not preserved, so the patch and runtime have not been revalidated against the latest upstream release.

Clone the runtime separately before installing its dependencies:

```bash
git clone https://github.com/lipku/LiveTalking.git livetalking
# Select a compatible upstream revision, then record it for your deployment:
git -C livetalking rev-parse HEAD
```

Follow the selected revision's installation instructions. The current upstream README lists Ubuntu 22.04, Python 3.12, PyTorch 2.9.1 and CUDA 12.8; the local `environment.livetalking.yml` describes an older Python 3.10 / CUDA 12.1 configuration and is retained only as a historical reference. Do not mix the two dependency sets. See [upstream](https://github.com/lipku/LiveTalking).

Before running, check that the integration patch applies with `git -C livetalking apply --check ../patches/livetalking_museguide.patch`, then use the patch script below. A failure means that revision needs adaptation; do not force the patch.

Obtain the selected upstream's model files under their own license. The preparation script expects `wav2lip/wav2lip256.pth` and `wav2lip/s3fd.pth`, and links them into the runtime. Neither weights nor the historical avatar runtime are included in this repository. By default it reads the existing state videos from `frontend/public/videos/woman_demo`.

Prepare Wav2Lip assets from the existing woman state videos:

```bash
bash scripts/prepare_livetalking_woman_wav2lip.sh
```

The generated `livetalking/data/avatars/woman_demo_*` directories are runtime artifacts and should not be committed.

## Running

Start LiveTalking:

```bash
conda activate museguide-livetalking
bash scripts/run_livetalking.sh
```

Start MuseGuide normally:

```bash
conda activate museguide
bash dev.sh
```

Or start both from `dev.sh`:

```bash
ENABLE_LIVETALKING=1 LIVETALKING_PY_BIN=/path/to/museguide-livetalking/bin/python bash dev.sh
```

The frontend defaults to non-live playback. Click `接入实时口型` to switch `woman_demo` into LiveTalking WebRTC playback.

## LiveTalking Patch

The upstream `livetalking/` directory is intentionally managed as its own Git checkout and is ignored by the outer MuseGuide repo. MuseGuide-specific LiveTalking changes are versioned as:

```bash
patches/livetalking_museguide.patch
```

Apply it after refreshing or recloning LiveTalking:

```bash
bash scripts/apply_livetalking_museguide_patch.sh
```
