# Copilot Avatar Extension

![Copilot Avatar Demo](assets/copilot-avatar-squad-demo.gif)

A cheerful 3D Copilot sidekick that lives in a native window beside your terminal. It shows the main avatar, brings sub-agents on stage underneath it, tosses out floating messages, and can read final responses aloud with text-to-speech.

## Why this exists

I love using Copilot CLI, but sometimes the only sign of life is a bleep and a lot of faith. The agent is off doing clever things, and you're left staring at the terminal like it's supposed to wink back.

So I built this: a little screen buddy with some personality. It makes Copilot feel more alive, more visible, and a lot more fun to keep around. When Copilot finishes something meaningful, the avatar can read the final response out loud. Not every little intermediate thought. Just the good part.

## Features

- **Main avatar + sub-agent squad view**: a large root Copilot avatar with dynamically spawned sub-agent avatars underneath it
- **Optional Clippy mode**: swap the root avatar for an animated paperclip-style assistant on a transparent background
- **Per-agent activity states**: writing, reading, running, thinking, and idle route independently to the right avatar
- **Responsive squad layout**: sub-agents reflow into centered rows as the window changes size
- **Activity and lifecycle reactions**: working states, success/failure moments, floating responses, and emoji-driven expressions keep things lively
- **Optional avatar badges**: show or hide the full name/status card under each avatar
- **Optional model badges**: show the current model for the main agent and sub-agents when you want the extra context
- **RoboDuck variant**: some agents can show up in full RoboDuck mode with the classic avatar head and a snap-on GLB duckbill
- **Live response and working text**: final root-agent messages and current work status can stay visible beside the avatar
- **Built-in TTS**: voice, speed, pitch, and saved settings so your desktop buddy can actually talk back
  - Use the Web Speech API, Voxtral, or ElevenLabs TTS
  - Point Voxtral at Mistral Cloud or a local vLLM server
  - Record, import, or generate a retro Clippy reference clip for Voxtral reference audio
  - Load ElevenLabs account voices directly from your ElevenLabs account
  - Strip markdown before speaking and persist settings in `.tts-settings.json`

## Squad Integration

If [Squad](https://github.com/bradygaster/squad) is available in the workspace, the avatar gets even more personality without changing the normal Copilot flow.

- **Names from Squad**: sub-agents can use Squad member names when available
- **Role-based color coding**: labels, accents, glows, and head tints follow Squad roles
- **Extra flavor**: roster and charter metadata help each sub-agent feel like its own little specialist

## Releases

GitHub Releases are the easiest way to grab it. Each release includes a `copilot-avatar-vX.Y.Z.zip` asset with the `copilot-avatar/` folder at the ZIP root, ready to drop into your extensions folder.

## Installation

You need [Node.js](https://nodejs.org) installed.

### Install from a release ZIP

1. Download the latest `copilot-avatar-vX.Y.Z.zip` asset from the GitHub Releases page.
2. Extract the ZIP so you have a `copilot-avatar/` folder.
3. Copy that folder to one of the extension locations below.
4. Run `npm install` inside the copied `copilot-avatar` folder.

If you'd rather use the repo directly, clone or download it and copy the `copilot-avatar` folder from `.github/extensions/` to one of the locations below.

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

Then restart Copilot CLI and your new desk buddy should be ready to show up.

> **Important:** do not keep both a **global** and **per-project** copy enabled at the same time. If both exist, disable one so only the copy you want is active.

## Usage

Open the avatar window, keep coding, and let it react to the session in real time:

- Use the `/avatar` command to open it manually
- Use the `copilot_avatar_show` tool (with optional `reload: true`)
- Use the `copilot_avatar_eval` tool to run JavaScript in the webview
- Use the `copilot_avatar_close` tool to close the window

Sub-agents appear automatically when the current session emits sub-agent lifecycle events, so the whole scene fills out as work gets delegated.

Select **Avatar → Clippy** in settings to show the animated grey `clippy.glb` paperclip on a transparent background. Clippy mode prefers an AI voice engine, hides response/status overlays, and speaks a short Clippy-style summary of the final Copilot response instead of reading the message verbatim. Import or record a reference clip while Clippy is selected to save it as the default Voxtral voice source. You can also use **Generate retro Clippy sample** to fetch a short pitched-up Microsoft Sam-style SAPI4 reference WAV at setup time instead of bundling an audio file. With ElevenLabs selected, choose one of your account voices instead.

If Squad is available for the workspace, the avatar picks up that metadata automatically. Without Squad, it still works great as a plain Copilot companion.

## RoboDuck Asset Notes

- The duckbill is loaded from `content/duck-bill.glb`.
- The current setup keeps the normal avatar head and snaps on a separate duckbill mesh when it is time for RoboDuck to make an entrance.
- If you replace `duck-bill.glb`, aim for a clean beak-shaped mesh centered for face attachment. Large mask-like or heavily quantized exports may need placement or import adjustments in `content/main.js`.

## Activity States

| State | Trigger | Visual |
| --- | --- | --- |
| **Idle** | No active tool/reasoning | White eyes, neutral motion |
| **Writing** | `edit`, `create` | Green eyes, typing motion, floating `0/1` glyphs |
| **Reading** | `view`, `grep`, `glob`, `rg`, `lsp*` | Blue eyes, scanning motion, soft scan beam |
| **Running** | `powershell`, `task` | Amber eyes, more energetic motion |
| **Thinking** | `assistant.reasoning` | Purple eyes, calmer motion, orbiting dots |

The root avatar uses the same activity-state system even when there are no sub-agents active, so it never feels like a static prop.

## TTS Controls

| Control | Description |
| --- | --- |
| 🔇/🔊 button | Toggle speech on/off |
| ⚙️ button | Open settings dropdown |
| General / Speech tabs | Switch between avatar/window controls and TTS controls |
| Avatar dropdown | Choose Copilot or Clippy |
| Engine dropdown | Choose Web Speech, Voxtral, or ElevenLabs |
| Show avatar badges | Show or hide the full badge card under each avatar |
| Show model badges | Show or hide the model line inside each badge card |
| Voice dropdown | Select a system voice |
| Test selected voice | Preview the currently selected Web Speech, Voxtral, or ElevenLabs voice |
| Voxtral backend | Choose Mistral Cloud or local vLLM |
| ElevenLabs API key | Load voices from your ElevenLabs account |
| Generate retro Clippy sample | Fetch and save a pitched-up Microsoft Sam-style reference clip for Clippy |
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
    ├── clippy.glb      # 3D animated Clippy model
    └── duck-bill.glb   # Optional RoboDuck beak asset
```

## Dependencies

- `ws`: WebSocket server for bridge communication
- `@webviewjs/webview`: Native webview window
- Three.js (loaded from CDN in the webview)
