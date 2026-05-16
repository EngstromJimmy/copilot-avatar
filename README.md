# Copilot Avatar Extension

![Copilot Avatar Demo](assets/copilot-avatar-squad-demo.gif)

A 3D animated Copilot avatar that lives in a native window alongside your terminal session. It shows the main Copilot avatar, visualizes sub-agents as a small squad, displays floating messages, and can read final responses aloud with text-to-speech.

## Why?

I love using Copilot CLI, but sometimes the only feedback you get is a bleep. The agent is off doing its thing, and you're just sitting there waiting. I wanted something a bit more human.

So I built this. A little friend that lives on your screen and actually talks to you. When Copilot finishes a task, the avatar reads the response back using text-to-speech. Not every intermediate step, just the final message. The meaningful stuff.

## Features

- **Main avatar + sub-agent squad view**: a large root Copilot avatar with dynamically spawned sub-agent avatars underneath it
- **Optional Clippy mode**: swap the root avatar for an animated paperclip-style assistant on a transparent background
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
- **Text-to-Speech**: built-in TTS using the Web Speech API or Voxtral TTS
  - Toggle on/off with the 🔇/🔊 button
  - Choose from available system voices
  - Use Voxtral with Mistral Cloud or a local vLLM server
  - Record or import a prerecorded voice sample for Voxtral reference audio
  - Adjustable speech rate and pitch
  - Markdown formatting is stripped before speech
  - Settings persist in `.tts-settings.json`

## Installation

You need [Node.js](https://nodejs.org) installed. Then clone or download this repo and copy the `copilot-avatar` folder from `.github/extensions/` to one of the locations below.

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

Select **Avatar → Clippy** in settings to show the animated grey `clippy.glb` paperclip on a transparent background. Clippy mode prefers Voxtral speech with the more animated `Paul - Excited` preset, hides response/status overlays, and speaks a short Clippy-style summary of the final Copilot response instead of reading the message verbatim. Import or record a Voxtral reference clip while Clippy is selected to save it as the default Clippy voice. You can also use **Generate retro Clippy sample** to fetch a short pitched-up Microsoft Sam-style SAPI4 reference WAV at setup time instead of bundling an audio file.

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
| Avatar dropdown | Choose Copilot or Clippy |
| Engine dropdown | Choose Web Speech or Voxtral |
| Voice dropdown | Select a system voice |
| Voxtral backend | Choose Mistral Cloud or local vLLM |
| Generate retro Clippy sample | Fetch and save a pitched-up Microsoft Sam-style Voxtral reference clip for Clippy |
| Import prerecorded voice | Save reference audio for Voxtral voice cloning |
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
    ├── model.glb       # 3D Copilot head model
    └── clippy.glb      # 3D animated Clippy model
```

## Dependencies

- `ws`: WebSocket server for bridge communication
- `@webviewjs/webview`: Native webview window
- Three.js (loaded from CDN in the webview)
