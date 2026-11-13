---
name: style-reel
description: Build the "one scene, ten styles" reel - a numbered list of styles with a card that swaps on every spoken style name, a grid of all of them, an optional video of your own in the middle, and a comment-keyword CTA - from the pictures and clips the style-remix skill made, in HyperFrames. Use when someone says "make the styles reel", "10 styles reel", "style switch reel", "put my styles in a reel", or has a folder of styled pictures or clips and a voiceover.
---

# Style reel

The reel: the voice rattles off the styles while each card flips in on its word, the deck deals into a grid, an optional middle video plays in a phone, then "comment WORD" and "save this". Everything is timed to the voice's words.

Needs `<project>/assets/styles/manifest.json` from the `style-remix` skill (made with `remix.mjs make` or `remix.mjs import`). Scripts are in this skill's `scripts/` folder; `<skill>` below means this folder.

## 1. Project and script

```bash
node "<skill>/scripts/new.mjs" <project>
```

Use the same folder the styles went into. Write `<project>/script.txt`. The pattern that works:

1. The style names, one after another, as a single comma-separated line (fast, about 0.7 s each).
2. One line on how: "Ten styles from one scene, one prompt each, right inside Claude."
3. Optional middle line about the video in the middle.
4. The CTA: "Comment WORD and I'll send you ..." and what they get.
5. "Save this so you don't lose it."

The style names in the script must be the `name`s in the manifest, in the same order, so each card lands on its word.

## 2. Voice

```bash
node "<skill>/scripts/voice.mjs" <project> --file my-take.m4a     # their recording or cloned voice (best)
node "<skill>/scripts/voice.mjs" <project> --voice am_michael      # free on-device voice
```

## 3. Config

Copy `<skill>/reel.example.json` to `<project>/reel.json` and change:

- `title` (two lines; the second is italic), `tag`, `brand` (their handle).
- `cues`: the first word of each part, as spoken: `grid` (the "ten styles" line), `middle`, `cta`, `save`. Leave `middle` null to skip the middle video.
- `pills`: three short chips that pop on their words during the grid.
- `middle`: `src` (put the file in `assets/`), `mediaStart` (seconds into it), `tag`, `title`, `sticker` and the word it lands on (`stickerAt`). Any video works: their own reel, a product demo, a screen recording.
- `cta.word` (the comment keyword) and `cta.lines` (what they get, each on its word).
- `music` (optional, a file in `assets/` they have the rights to) and `colors`.

## 4. Build, check, look, render

```bash
node "<skill>/scripts/build.mjs" <project>
cd <project>
npx hyperframes check
npx hyperframes snapshot --at 1,4,9,14,21,26
npx hyperframes render --fps 30 --quality delivery -o out/reel.mp4
```

The build prints when each style lands. If a style time looks wrong, the voice said it differently: add `"say": "<the word as heard>"` to that style in the manifest. `check` must pass with 0 errors; look at the snapshots before rendering.

## Rules

- The comment keyword must match the auto-DM keyword they set up. Remind them.
- The middle video is theirs to use. Do not put someone else's video there.
- Never hand-edit `index.html`: change `reel.json` and build again.
