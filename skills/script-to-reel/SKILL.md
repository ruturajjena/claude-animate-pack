---
name: script-to-reel
description: Turn a script into a finished vertical reel (1080x1920) with a voiceover, word-timed captions and animated beats (big titles, counting stats, lists, chat bubbles, terminal lines, pictures, phone videos, comment CTA), rendered with HyperFrames. Use when someone says "make a reel from this script", "animate my script", "faceless reel", "turn this into a video", "reel with my voice", or gives a script and wants an animated short.
---

# Script to reel

Anything the voice says lands on screen on the word that says it. Read the `/hyperframes` skill once if it is installed: this skill already follows its render contract, so you only write a script and a `beats.json`.

Scripts live next to this file in `scripts/`. Call them by absolute path; below, `<skill>` means this skill's folder.

## 1. Project

```bash
node "<skill>/scripts/new.mjs" my-reel
```

Then write `my-reel/script.txt`: one spoken line per line. Short sentences. Spell numbers the way they are said ("six thousand"). 20 to 45 seconds suits most reels, about 2.5 words a second.

## 2. Voice

Pick one, in this order of quality:

1. **Their own recording** (phone voice memo is fine): `node "<skill>/scripts/voice.mjs" my-reel --file take.m4a`
2. **A cloned voice** they already have (ElevenLabs, Voicebox): export the audio and use `--file`.
3. **Free on-device voice** (Kokoro, no account): `node "<skill>/scripts/voice.mjs" my-reel --voice am_michael`. Voices: `npx hyperframes tts --list`. Needs Python with `pip install kokoro-onnx soundfile` once.

Either way it writes `assets/voice.wav` and `transcript.json` (word times, transcribed on the device). Read the transcript before going on. If it misheard a word, the captions still use the script's spelling as long as both have the same number of words.

## 3. Beats

Write `my-reel/beats.json`. One beat per idea, usually one per sentence. A beat starts on the first word of its `at` phrase (searched in order through the transcript) and stays until the next beat.

```json
{
  "title": "My reel",
  "look": "paper",
  "brand": "@yourhandle",
  "music": "assets/music.mp3",
  "beats": [
    { "at": "most people", "type": "stat", "kicker": "editing one video", "value": "3 hrs", "label": "is what *most people* spend" },
    { "at": "here is", "type": "title", "text": "The *faster* way.", "kicker": "optional", "sub": "optional" },
    { "at": "write your", "type": "chat", "prompt": "Make this a reel.", "reply": "On it.", "replyAt": "build" },
    { "at": "step one", "type": "list", "heading": "three steps", "items": [{ "text": "Record", "at": "record" }, { "text": "Time", "at": "times" }] },
    { "at": "install", "type": "code", "lines": ["$ npx hyperframes render"], "caption": "one command" },
    { "at": "look at", "type": "image", "src": "assets/shot.png", "caption": "the result" },
    { "at": "like this", "type": "video", "src": "assets/clip.mp4", "mediaStart": 3, "caption": "made in a minute" },
    { "at": "as they say", "type": "quote", "text": "Done is better than *perfect*.", "by": "someone" },
    { "at": "comment", "type": "cta", "small": "comment", "word": "REEL", "lines": [{ "text": "I'll DM you the skill", "at": "send" }] }
  ]
}
```

- `*word*` sets a word in the italic payoff colour. One per beat, on the word that matters.
- `look`: `paper` (ivory, coral, plum), `night` (dark), `mint` (light green). Override any colour with `"colors": {"accent": "#..."}`.
- Items inside a list, a CTA and a chat reply have their own `at` so each lands on its word.
- `music` is optional. Keep it under the voice (`"musicVolume": 0.12`, the default). Only use music they have the rights to.
- Show real things when the script names them: their screenshot, their product, their clip. Draw a beat only when there is nothing real to show.

## 4. Build, check, look, render

```bash
node "<skill>/scripts/build.mjs" my-reel
cd my-reel
npx hyperframes check          # must say "Check passed"; fix every error it lists
npx hyperframes snapshot --at 1,5,10,15   # look at the frames before rendering
npx hyperframes render --fps 30 --quality delivery -o out/reel.mp4
```

`check` warnings about captions being on screen briefly are expected for speech-timed captions. Errors are not: fix them (usually text over text, or text too small) and build again. Look at the snapshots every time; a passing check does not show how it looks.

To change anything, edit `beats.json` or `script.txt` (then redo the voice) and build again. Never hand-edit `index.html`: the next build overwrites it.

## 5. Hand over

Give the path to `out/reel.mp4`. Say what was illustrative (anything drawn, not real) so they can check facts before posting, and offer `npx hyperframes preview` to scrub through it in the browser.
