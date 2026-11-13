---
name: style-remix
description: Redraw one scene in ten animation styles (pixel art, claymation, toy bricks, comic book, paper cutout, retro anime, low poly, knitted wool, risograph, miniature diorama) and turn each into a short clip, one prompt per style. Use when someone says "one scene in 10 styles", "redraw this in claymation", "style remix", "animation styles", "make my picture pixel art", or wants the pictures and clips for a style-switch reel.
---

# Style remix

One scene, the same subject and pose, redrawn in many styles, each animated into a 3 to 5 second clip. The styles and their prompts live in `styles.json` next to this file. Keep them word for word unless the person asks for changes: they are tuned so the subject and layout survive every redraw.

## 1. Agree the scene

Ask for three things if the person has not given them, or offer one of these:

- **Subject**: one person, animal or object, with one or two visual details (clothes, colour).
- **Pose**: one action caught mid-move (jumping, skating, waving). Full body.
- **Background**: two or three simple things (a hill, the sea, one kite). Lots of empty sky.

Simple scenes survive the redraws. Crowds, small text, hands holding small objects and busy backgrounds do not. They can also start from their own picture or photo: then skip the scene step and pass it as the reference.

## 2. Pick the route

| Route | Needs | How |
| --- | --- | --- |
| **A. Claude + Higgsfield** (no code) | A Higgsfield account with credits, its connector added in Claude | You paste the prompts in chat, one by one |
| **B. HyperFrames** (automatic) | `npx hyperframes auth login` on a Pro plan | `node scripts/remix.mjs make <dir>` does every picture and clip |
| **C. Any image tool** | ChatGPT, Gemini, Midjourney, Kling... | Paste the prompts there, then `import` the files |

Check which tools you actually have before choosing: a Higgsfield connector shows up as tools named like `Higgsfield__generate_image`. Never guess.

### Route A: in Claude with the Higgsfield connector

Write the prompts first:

```bash
node "<this skill>/scripts/remix.mjs" prompts <project> --subject "..." --pose "..." --background "..."
```

Then, in order, using the connector's image and video tools:

1. Make the scene from prompt 1 (9:16).
2. For each style, make a picture from its prompt **with the scene as the reference image**. Always reference the scene, never the previous style, or the subject drifts.
3. For each styled picture, make a clip from its clip prompt, with that picture as the first frame. Shortest length, still camera.
4. Download everything into one folder and run `import` (below).

Show the person each picture as it lands. Redo one only for a real fault (the subject changed, extra limbs, text in the picture), once.

### Route B: HyperFrames does it all

```bash
node "<this skill>/scripts/remix.mjs" make <project> --plan        # what it costs, nothing made
node "<this skill>/scripts/remix.mjs" make <project>               # scene, 10 pictures, 10 clips
node "<this skill>/scripts/remix.mjs" make <project> --scene-image me.png --styles claymation,pixel-art --no-clips
```

It skips files that already exist, so a second run only fills the gaps. A refusal that says "HyperFrames Pro feature" means the plan does not include generation: tell the person and offer Route A or C. Nothing is charged for a refusal.

### Route C: any other tool

Write the prompts (Route A, first command), make the files anywhere, put them in one folder, then:

```bash
node "<this skill>/scripts/remix.mjs" import <project> <folder>
```

Files are matched to styles by a style word in the file name (`claymation.png`, `03-toy-bricks.mp4`), otherwise by sorted order. A picture named with "scene" or "base" becomes the scene.

## 3. Hand off

Everything ends in `<project>/assets/styles/` with `manifest.json`. To make the reel, use the `style-reel` skill with that project. Pictures without clips are fine: the reel moves them itself.

## Rules

- No text, logos or watermarks in any picture: words get drawn in the video, where they stay sharp.
- Do not name brands in prompts (say "toy bricks", not a brand).
- Do not redraw a real person's face without their consent. The person's own photo is fine.
- Credits are the person's money. Say how many things you are about to make before a batch, and never run the same batch twice.
