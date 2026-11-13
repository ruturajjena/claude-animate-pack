# Claude Animate Pack

Free Claude Code skills from [@explainedbyruturaj](https://www.instagram.com/explainedbyruturaj/).

- **One scene, ten styles.** Redraw one picture as pixel art, claymation, toy bricks, comic book, paper cutout, retro anime, low poly, knitted wool, risograph and a miniature diorama. Then animate each one into a short clip.
- **Script to reel.** Turn a script into a finished vertical reel. You get your voice, captions timed to each word, and animated beats. It renders on your own computer with [HyperFrames](https://github.com/heygen-com/hyperframes).

📘 **New here? Open the [setup guide (PDF)](guide/Claude-Animate-Pack-Guide.pdf).** It goes step by step, from nothing installed to your first reel.

## What's inside

| Skill | What it does |
| --- | --- |
| `animate-setup` | Checks your computer (Node, FFmpeg, HyperFrames) and tells you how to fix what's missing |
| `style-remix` | Writes the prompts for your scene in 10 styles. It can also make the pictures and clips itself (HyperFrames Pro), or bring in ones you made elsewhere (Higgsfield, ChatGPT, Gemini…) |
| `style-reel` | Builds the "one scene, ten styles" reel from those pictures, timed to your voice, with your own video in the middle |
| `script-to-reel` | Builds any script into an animated reel: titles, counting numbers, lists, chat bubbles, code, pictures, videos and a comment call to action |

You also get [`prompts/10-styles.md`](prompts/10-styles.md), with all 10 style prompts word for word. You don't need to install anything for those. Paste them into Claude or any image tool.

## Install

You need [Claude Code](https://claude.com/claude-code). It runs in a terminal or in the Code tab of the Claude desktop app. You also need Node.js 22+ and FFmpeg. The guide shows how to install each one.

```bash
claude plugin marketplace add ruturajjena/claude-animate-pack
claude plugin install animate-pack@explainedbyruturaj
```

The HyperFrames skills are recommended, because they teach Claude the video format:

```bash
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
```

Restart Claude Code, then say: **"set up the animate pack"**.

<details>
<summary>Manual install (copy the skills)</summary>

```bash
git clone https://github.com/ruturajjena/claude-animate-pack.git
```

Then copy the folders in `skills/` to `~/.claude/skills/`. On Windows, that's `C:\Users\<you>\.claude\skills\`.
</details>

## Use it

Say any of these to Claude:

- "Set up the animate pack"
- "Redraw my scene in 10 styles: a girl on a red bike with a corgi in the basket"
- "Make the styles reel with my voice, and put my last reel in the middle"
- "Make a reel from this script: …"

Under the hood, each request is a few commands:

```bash
node skills/script-to-reel/scripts/new.mjs my-reel
node skills/script-to-reel/scripts/voice.mjs my-reel --file my-voice.m4a
node skills/script-to-reel/scripts/build.mjs my-reel
cd my-reel && npx hyperframes check && npx hyperframes render -o out/reel.mp4
```

## Costs

The skills, HyperFrames rendering, transcription and the free voice all cost nothing and run on your computer. AI pictures and clips cost credits on whichever tool you use: Higgsfield, a HyperFrames Pro plan, ChatGPT and so on. You choose, and the skill tells you the cost before it makes anything.

## Credits and licences

- This pack: MIT, see [LICENSE](LICENSE).
- [HyperFrames](https://github.com/heygen-com/hyperframes) by HeyGen (Apache-2.0) renders the videos. [GSAP](https://gsap.com) animates them.
- The "one scene, many styles" reel format is a common format on Instagram. The prompts, code and designs here are original.
- Only use music, videos and faces you have the rights to.
