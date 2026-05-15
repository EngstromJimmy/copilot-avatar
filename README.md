# Copilot Avatar Extension

![Copilot Avatar Demo](assets/copilot-avatar-squad-demo.gif)

A 3D animated Copilot avatar that lives in a native window alongside your terminal session. It shows the main Copilot avatar, visualizes sub-agents as a small squad, displays floating messages, and can read final responses aloud with text-to-speech.

## Why?

I love using Copilot CLI, but sometimes the only feedback you get is a bleep. The agent is off doing its thing, and you're just sitting there waiting. I wanted something a bit more human.

So I built this. A little friend that lives on your screen and actually talks to you. When Copilot finishes a task, the avatar reads the response back using text-to-speech. Not every intermediate step, just the final message. The meaningful stuff.

## Features

- **Main avatar + sub-agent squad view**: a large root Copilot avatar with dynamically spawned sub-agent avatars underneath it
- **Optional Squad metadata integration**: when the current workspace has Squad metadata, the avatar shows Squad-ready status, uses Squad member names for labels, and applies role-based accents, motion personas, head tints, and idle badges
- **Per-agent activity states**: writing, reading, running, thinking, and idle states route independently to the correct avatar
- **Responsive squad layout**: sub-agents reflow into centered rows for smaller windows instead of disappearing off-screen
- **Activity FX**
  - Writing: green eyes, typing motion, floating binary glyphs
  - Reading: blue eyes, scanning motion, soft scan beam
  - Running: amber eyes, more energetic motion
  - Thinking: purple eyes, calmer motion, orbiting dots
- **Lifecycle reactions**
  - Sub-agent completion confetti and success pulse
  - Sub-agent failure flash and shake
  - Root avatar success/failure reactions based on turn outcomes
- **Live response display**: final root-agent messages appear as floating text near the avatar
- **Working indicator**: pulsing `● Working…` status with current subtask/intent text
- **Emotion reactions**: emoji-triggered expressions and motion for hearts, laughter, sparkle, raccoon mode, and idle sleep
- **Text-to-Speech**: built-in TTS using the Web Speech API
  - Toggle on/off with the 🔇/🔊 button
  - Choose from available system voices
  - Adjustable speech rate and pitch
  - Markdown formatting is stripped before speech
  - Settings persist in `.tts-settings.json`

## Releases

GitHub Releases are the distribution channel for this extension. Each release publishes a ZIP asset named like `copilot-avatar-v0.1.0.zip` that contains the `copilot-avatar/` folder at the ZIP root, which you can extract and install directly.

## Installation

You need [Node.js](https://nodejs.org) installed.

### Install from a release ZIP

1. Download the latest `copilot-avatar-vX.Y.Z.zip` asset from the GitHub Releases page.
2. Extract the ZIP so you have a `copilot-avatar/` folder.
3. Copy that folder to one of the extension locations below.
4. Run `npm install` inside the copied `copilot-avatar` folder.

### Install from source

Clone or download this repo and copy the `copilot-avatar` folder from `.github/extensions/` to one of the locations below.

**Per-project** (only active when you're inside that repo):

```
your-project/
└── .github/
    └── extensions/
        └── copilot-avatar/
```

**Global** (active in every project on your machine):

| Platform | Path |
| --- | --- |
| Windows | `%USERPROFILE%\.copilot\extensions\copilot-avatar\` |
| macOS / Linux | `~/.copilot/extensions/copilot-avatar/` |

After copying, install dependencies:

```bash
cd <path-to-copilot-avatar>
npm install
```

Then restart Copilot CLI so the extension loads.

> **Important:** do not keep both a **global** and **per-project** copy enabled at the same time. If both exist, disable one so only the copy you want is active.

## Creating a release

Releases are created with the **Release extension** GitHub Actions workflow.

1. Open **Actions** in GitHub and select **Release extension**.
2. Run the workflow with a semantic version like `0.1.0` or `0.2.0`.
3. The workflow updates `.github/extensions/copilot-avatar/package.json` and `package-lock.json`, commits that version bump, creates the matching `vX.Y.Z` tag, builds `copilot-avatar-vX.Y.Z.zip`, and publishes a GitHub Release with GitHub-generated notes.

## Usage

Open the avatar window when you want it, then let it react to the current session:

- Use the `/avatar` command to open it manually
- Use the `copilot_avatar_show` tool (with optional `reload: true`)
- Use the `copilot_avatar_eval` tool to run JavaScript in the webview
- Use the `copilot_avatar_close` tool to close the window

Sub-agents appear automatically when the current session emits sub-agent lifecycle events.

If Squad is detected for the active workspace, the avatar keeps the normal Copilot event flow and passively enriches it with Squad roster and charter metadata. Names come from the Squad roster, while the visual treatment stays role-driven so the overall look remains a balanced mix instead of becoming character-specific. If Squad is not present, the extension behaves exactly as before.

## Activity States

| State | Trigger | Visual |
| --- | --- | --- |
| **Idle** | No active tool/reasoning | White eyes, neutral motion |
| **Writing** | `edit`, `create` | Green eyes, typing motion, floating `0/1` glyphs |
| **Reading** | `view`, `grep`, `glob`, `rg`, `lsp*` | Blue eyes, scanning motion, soft scan beam |
| **Running** | `powershell`, `task` | Amber eyes, more energetic motion |
| **Thinking** | `assistant.reasoning` | Purple eyes, calmer motion, orbiting dots |

The root avatar uses the same activity-state system even when there are no sub-agents active.

## TTS Controls

| Control | Description |
| --- | --- |
| 🔇/🔊 button | Toggle speech on/off |
| ⚙️ button | Open settings dropdown |
| Voice dropdown | Select a system voice |
| Speed slider | Adjust rate from 0.5× to 3.0× |
| Pitch slider | Adjust pitch from 0.5 to 2.0 |

All TTS settings are saved automatically.

## File Structure

```
copilot-avatar/
├── extension.mjs       # Entry point (loads main.mjs)
├── main.mjs            # Extension logic (session hooks, event listeners)
├── package.json        # Dependencies (ws, @webviewjs/webview)
├── lib/
│   ├── copilot-webview.js    # Reusable webview helper class
│   └── webview-child.mjs     # Child process for native window
└── content/
    ├── index.html      # Webview page
    ├── style.css       # Styling for the window and overlays
    ├── main.js         # 3D scene, squad logic, activity effects, TTS
    └── model.glb       # 3D Copilot head model
```

## Dependencies

- `ws`: WebSocket server for bridge communication
- `@webviewjs/webview`: Native webview window
- Three.js (loaded from CDN in the webview)
