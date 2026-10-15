#!/usr/bin/env python3
"""transcribe.py — turn a meeting recording into a timestamped transcript, locally.

    .venv/bin/python transcribe.py inbox/meeting.m4a --out projects/{p}/log/artifacts/L040/

Nothing leaves this machine: the model runs on the CPU (or a GPU if present)
through faster-whisper. The first run downloads the model once into the
Hugging Face cache; after that no network is needed.

Writes, in --out:
    transcript.{lang}.txt   one line per segment: [mm:ss] text
                            segments the model was unsure of start with [?]
    transcript.{lang}.json  the segments with start, end, text and confidence

The transcript stays in the spoken language. Translation happens when the
report is written, so the original remains the record to check against.

Setup, once:  .venv/bin/pip install faster-whisper
Exit 1 if the audio cannot be read, 2 on usage errors.
"""

import argparse
import json
import sys
import time
from pathlib import Path

# Below these the model's own scores say the segment may be misheard.
LOW_LOGPROB = -1.0
HIGH_NO_SPEECH = 0.6


def stamp(seconds):
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def main():
    p = argparse.ArgumentParser(description="Transcribe a meeting recording locally.")
    p.add_argument("audio", type=Path)
    p.add_argument("--out", type=Path, required=True, help="folder for transcript.{lang}.txt/.json")
    p.add_argument("--language", default="it", help="spoken language (default: it)")
    p.add_argument("--model", default="large-v3-turbo", help="faster-whisper model (default: large-v3-turbo)")
    p.add_argument("--threads", type=int, default=0, help="CPU threads (default: all)")
    args = p.parse_args()

    if not args.audio.is_file():
        p.error(f"{args.audio} does not exist")
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper is not installed: .venv/bin/pip install faster-whisper")

    try:
        import ctranslate2
        device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
    except Exception:
        device = "cpu"
    model = WhisperModel(args.model, device=device, compute_type="int8" if device == "cpu" else "float16", cpu_threads=args.threads)

    try:
        segments, info = model.transcribe(str(args.audio), language=args.language, vad_filter=True, beam_size=5)
    except Exception as e:  # unreadable or unsupported audio
        print(f"cannot read {args.audio}: {e}", file=sys.stderr)
        sys.exit(1)

    args.out.mkdir(parents=True, exist_ok=True)
    lines, rows = [], []
    began = time.time()
    for seg in segments:
        unsure = seg.avg_logprob < LOW_LOGPROB or seg.no_speech_prob > HIGH_NO_SPEECH
        text = seg.text.strip()
        lines.append(f"{'[?] ' if unsure else ''}[{stamp(seg.start)}] {text}")
        rows.append({
            "start": round(seg.start, 2), "end": round(seg.end, 2), "text": text,
            "avg_logprob": round(seg.avg_logprob, 3), "no_speech_prob": round(seg.no_speech_prob, 3), "unsure": unsure,
        })
        done = seg.end / info.duration if info.duration else 0
        print(f"\r{stamp(seg.end)} / {stamp(info.duration)}  ({done:.0%}, {time.time() - began:.0f}s elapsed)", end="", file=sys.stderr, flush=True)
    print(file=sys.stderr)

    txt = args.out / f"transcript.{args.language}.txt"
    js = args.out / f"transcript.{args.language}.json"
    txt.write_text("\n".join(lines) + "\n", encoding="utf-8")
    js.write_text(json.dumps({
        "audio": args.audio.name, "language": args.language, "model": args.model,
        "duration": round(info.duration, 1), "segments": rows,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    unsure = sum(r["unsure"] for r in rows)
    print(f"{len(rows)} segments, {stamp(info.duration)} of audio, {unsure} marked [?]. Wrote {txt} and {js.name}")


if __name__ == "__main__":
    main()
