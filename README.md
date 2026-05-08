# Copilot Avatar Extension

![Copilot Avatar Demo](assets/avatar-demo.gif)

A 3D animated Copilot avatar that lives in a native window alongside your terminal session. It displays agent responses as floating text and can read them aloud with text-to-speech.

## Why?

I love using Copilot CLI, but sometimes the only feedback you get is a bleep. The agent is off doing its thing, and you're just sitting there waiting. I wanted something a bit more... human.

So I built this. A little friend that lives on your screen and actually talks to you. When Copilot finishes a task, the avatar reads the response back using text-to-speech. Not every intermediate step, just the final message. The meaningful stuff.

It turns out that having a face and a voice makes a surprisingly big difference. Give it a try.

## Features

- **3D Animated Avatar**: A Copilot head model with animated eyes (blinking, winking, head movement)
- **Live Response Display**: Shows agent messages as floating text near the avatar
- **Working Indicator**: Pulsing "● Working…" status when the agent is processing, with subtask info
- **Text-to-Speech**: Built-in TTS using the Web Speech API
  - Toggle on/off with the 🔇/🔊 button
  - Choose from available system voices
  - Adjustable speech rate (0.5× to 3.0×)
  - Settings persist across sessions via localStorage

## Installation

You need [Node.js](https://nodejs.org) installed. Then clone or download this repo and copy the `copilot-avatar` folder from `.github/extensions/` to one of the locations below.

**Per-project** (only active when you're inside that repo):

```
your-project/
└── .github/
    └── extensions/
        └── copilot-avatar/   ← copy here
```

**Global** (active in every project on your machine):

| Platform | Path |
|----------|------|
| Windows | `%USERPROFILE%\.copilot\extensions\copilot-avatar\` |
| macOS / Linux | `~/.copilot/extensions/copilot-avatar/` |

After copying, install dependencies:

```bash
cd <path-to-copilot-avatar>
npm install
```

Then start (or restart) Copilot CLI and the avatar window will appear automatically.

## Usage

The avatar window opens automatically when a session starts. You can also:

- Use the `/avatar` command to open it manually
- Use the `copilot_avatar_show` tool (with optional `reload: true`)
- Use the `copilot_avatar_eval` tool to run JavaScript in the webview
- Use the `copilot_avatar_close` tool to close the window

## TTS Controls

| Control | Description |
|---------|-------------|
| 🔇/🔊 button | Toggle speech on/off |
| ⚙️ button | Open settings dropdown |
| Voice dropdown | Select a system voice |
| Speed slider | Adjust rate from 0.5× to 3.0× |

All TTS settings (enabled state, voice, speed) are saved automatically.

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
    ├── style.css       # Styling
    ├── main.js         # 3D scene, TTS, message display logic
    └── model.glb       # 3D Copilot head model
```

## Dependencies

- `ws`: WebSocket server for bridge communication
- `@webviewjs/webview`: Native webview window
- Three.js (loaded from CDN in the webview)
