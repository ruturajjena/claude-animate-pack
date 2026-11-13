---
name: animate-setup
description: Check and set up everything the animate pack needs (Node.js 22+, FFmpeg, Git, the HyperFrames CLI and skills, optional sign-ins and the free voice), explain each missing piece in plain words, and point to the right next skill. Use when someone just installed the pack, says "set up the animate pack", "is everything installed", "it doesn't work", or "where do I start".
---

# Animate pack setup

Run the check first and read it to the person in plain words:

```bash
node "<this skill>/scripts/doctor.mjs"
```

For every `MISS` line, give the one fix it prints, for their operating system, and wait for them to say it is done. Installing programs on their computer is their step: offer the command, do not run installers yourself unless they ask you to. After any install they need to open a new terminal (and restart Claude) so the new program is found. Then run the check again.

## What each piece is for

| Piece | Why | Needed for |
| --- | --- | --- |
| Node.js 22+ | Runs the HyperFrames CLI and the pack's scripts | Everything |
| FFmpeg | Encodes the video, converts recordings | Everything |
| Git | Downloads the pack | Installing |
| HyperFrames skills | Teach Claude the video format | Recommended: `claude plugin marketplace add heygen-com/hyperframes` then `claude plugin install hyperframes@hyperframes` |
| HyperFrames sign-in | Free account; Pro plan makes pictures and clips | Only `style-remix` Route B |
| Higgsfield connector | Makes pictures and clips inside Claude chat | Only `style-remix` Route A |
| kokoro-onnx (Python) | Free on-device voice | Only if they don't record their own voice |

## Where to go next

- Has a script, wants a reel: the `script-to-reel` skill.
- Wants one scene in ten styles: the `style-remix` skill, then the `style-reel` skill for the reel.
- Everything is explained step by step in the PDF guide in the pack's `guide/` folder.
