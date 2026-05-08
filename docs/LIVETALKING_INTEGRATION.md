# LiveTalking Integration

MuseGuide keeps two playback paths:

- `non-live`: existing local MP4 state scheduling plus MuseGuide TTS.
- `live-lipsync`: LiveTalking Wav2Lip WebRTC output driven by MuseGuide LLM `tts_text` and `video_state`.

The first live-lipsync version supports `woman_demo` only. Other personas keep using non-live playback.

## Setup

Use conda for the LiveTalking environment:

```bash
conda env create -f environment.livetalking.yml
conda activate museguide-livetalking
```

If dependency downloads are slow, enable the user's proxy helper first:

```bash
proxy_on
```

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
