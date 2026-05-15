# Copilot Avatar Extension

![Copilot Avatar Demo](assets/copilot-avatar-squad-demo.gif)

A 3D animated Copilot avatar that lives in a native window alongside your terminal session. It shows the main Copilot avatar, visualizes sub-agents beneath it, displays floating messages, and can read final responses aloud with text-to-speech.

## Why?

I love using Copilot CLI, but sometimes the only feedback you get is a bleep. The agent is off doing its thing, and you're just sitting there waiting. I wanted something a bit more human.

So I built this. A little friend that lives on your screen and actually talks to you. When Copilot finishes a task, the avatar reads the response back using text-to-speech. Not every intermediate step, just the final message. The meaningful stuff.

## Features

- **Main avatar + sub-agent view**: a large root Copilot avatar with dynamically spawned sub-agent avatars underneath it
- **Per-agent activity states**: writing, reading, running, thinking, and idle states route independently to the correct avatar
- **Responsive sub-agent layout**: sub-agents reflow into centered rows for smaller windows
- **Lifecycle and message reactions**: success/failure reactions, floating responses, working state, and emoji-driven expressions
- **Built-in TTS**: voice, speed, pitch, and persisted settings

## Squad Integration

With optional [Squad](https://github.com/bradygaster/squad) integration, the avatar keeps the normal Copilot flow and enriches the same sub-agents with Squad metadata.

- **Names from Squad**: sub-agents use Squad member names when available
- **Role-based color coding**: labels, accents, glows, and head tints follow Squad roles
- **Extra context**: roster and charter metadata help each sub-agent feel distinct

## Releases

GitHub Releases are the distribution channel. Each release includes a `copilot-avatar-vX.Y.Z.zip` asset with the `copilot-avatar/` folder at the ZIP root.

## Installation

You need [Node.js](https://nodejs.org) installed.

### Install from a release ZIP

1. Download the latest `copilot-avatar-vX.Y.Z.zip` asset from the GitHub Releases page.
2. Extract the ZIP so you have a `copilot-avatar/` folder.
3. Copy that folder to one of the extension locations below.
4. Run `npm install` inside the copied `copilot-avatar` folder.

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

## Usage

Open the avatar window when you want it, then let it react to the current session:

- Use the `/avatar` command to open it manually
- Use the `copilot_avatar_show` tool (with optional `reload: true`)
- Use the `copilot_avatar_eval` tool to run JavaScript in the webview
- Use the `copilot_avatar_close` tool to close the window

Sub-agents appear automatically when the current session emits sub-agent lifecycle events.

If Squad is available for the workspace, the avatar uses that metadata automatically. Without Squad, it works as a normal Copilot avatar.

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
    ├── main.js         # 3D scene, sub-agent logic, activity effects, TTS
    └── model.glb       # 3D Copilot head model
```

## Dependencies

- `ws`: WebSocket server for bridge communication
- `@webviewjs/webview`: Native webview window
- Three.js (loaded from CDN in the webview)
