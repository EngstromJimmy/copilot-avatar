import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const ROOT_AGENT_ID = 'root';
const ROOT_SCALE = 1;
const SUBAGENT_SCALE = 0.38;
const MESSAGE_FADE_MS = 6000;
const DEMO_START_DELAY_MS = 700;
const IDLE_SLEEP_MS = 5 * 60 * 1000;
const EMOTION_HOLD_MS = 9000;
const THINKING_HOLD_MS = 1800;
const INTENT_HOLD_MS = 2600;
const COMPLETION_HOLD_MS = 2000;
const FAILURE_HOLD_MS = 1100;
const CLIPPY_MODEL_URL = 'clippy.glb';
const CLIPPY_TARGET_HEIGHT = 1.55;
const CLIPPY_SUBAGENT_DROP_FACTOR = 0.2;
const CLIPPY_GAZE_MAX_X = 0.014;
const CLIPPY_GAZE_MAX_Y = 0.009;
const CLIPPY_EYE_ROTATION_X = 2.4;
const CLIPPY_EYE_ROTATION_Y = 0.45;
const CLIPPY_EYE_ROTATION_Z = 2.1;
const CLIPPY_BROW_TRACK_Y = -0.22;
const CLIPPY_BROW_IDLE_LIFT = 0.0034;
const CLIPPY_BROW_ROTATION_X = 1.05;
const CLIPPY_BROW_ROTATION_Z = 0.9;
const CLIPPY_BROW_IDLE_TILT = 0.008;
const CLIPPY_DEFAULT_VOXTRAL_VOICE = 'en_paul_excited';
const CLIPPY_LEGACY_DEFAULT_VOXTRAL_VOICE = 'en_paul_cheerful';
const ACTIVITY_COLORS = {
    idle: new THREE.Color(0xffffff),
    writing: new THREE.Color(0x3fb950),
    reading: new THREE.Color(0x58a6ff),
    running: new THREE.Color(0xd29922),
    thinking: new THREE.Color(0xbc8cff),
    success: new THREE.Color(0x7ee787),
    failed: new THREE.Color(0xff7b72),
};
const ACTIVITY_BADGES = {
    idle: { icon: '•', text: 'Idle' },
    writing: { icon: '{ }', text: 'Writing code' },
    reading: { icon: '👁', text: 'Reading code' },
    running: { icon: '>_', text: 'Running commands' },
    thinking: { icon: '🧠', text: 'Thinking' },
    success: { icon: '✓', text: 'Completed' },
    failed: { icon: '⚠', text: 'Failed' },
};
const GENERIC_AGENT_LABELS = new Set([
    'agent',
    'assistant',
    'coding agent',
    'general purpose',
    'general purpose agent',
    'general-purpose',
    'general-purpose agent',
    'subagent',
    'task agent',
]);
const SUPPRESSED_ROOT_CHROME_TEXT = new Set([
    'agent',
    'runsubagent',
    'run subagent',
    'squad ready',
    'task',
]);
const SUPPRESSED_ROOT_TOOL_NAMES = new Set([
    'agent',
    'runSubagent',
    'task',
]);
const ROLE_STYLES = {
    default: {
        token: 'default',
        icon: '•',
        accent: '#8b949e',
        accentSoft: 'rgba(139, 148, 158, 0.28)',
        accentGlow: 'rgba(139, 148, 158, 0.16)',
        accentPanel: 'rgba(110, 118, 129, 0.12)',
    },
    coordinator: {
        token: 'coordinator',
        icon: '★',
        accent: '#e3b341',
        accentSoft: 'rgba(227, 179, 65, 0.36)',
        accentGlow: 'rgba(227, 179, 65, 0.18)',
        accentPanel: 'rgba(227, 179, 65, 0.12)',
    },
    backend: {
        token: 'backend',
        icon: '⚙',
        accent: '#58a6ff',
        accentSoft: 'rgba(88, 166, 255, 0.34)',
        accentGlow: 'rgba(88, 166, 255, 0.18)',
        accentPanel: 'rgba(56, 139, 253, 0.12)',
    },
    frontend: {
        token: 'frontend',
        icon: '◧',
        accent: '#f778ba',
        accentSoft: 'rgba(247, 120, 186, 0.34)',
        accentGlow: 'rgba(247, 120, 186, 0.17)',
        accentPanel: 'rgba(247, 120, 186, 0.12)',
    },
    tester: {
        token: 'tester',
        icon: '🧪',
        accent: '#3fb950',
        accentSoft: 'rgba(63, 185, 80, 0.34)',
        accentGlow: 'rgba(63, 185, 80, 0.18)',
        accentPanel: 'rgba(63, 185, 80, 0.12)',
    },
    docs: {
        token: 'docs',
        icon: '✍',
        accent: '#bc8cff',
        accentSoft: 'rgba(188, 140, 255, 0.34)',
        accentGlow: 'rgba(188, 140, 255, 0.18)',
        accentPanel: 'rgba(188, 140, 255, 0.12)',
    },
    copilot: {
        token: 'copilot',
        icon: '🤖',
        accent: '#f0f6fc',
        accentSoft: 'rgba(240, 246, 252, 0.28)',
        accentGlow: 'rgba(240, 246, 252, 0.16)',
        accentPanel: 'rgba(240, 246, 252, 0.1)',
    },
};
const MOTION_PERSONAS = {
    steady: {
        token: 'steady',
        blinkInterval: [3.2, 5.4],
        winkInterval: [10, 14],
        wanderInterval: [3.1, 4.8],
        blinkRate: 0.92,
        winkRate: 0.9,
        bobScale: 0.82,
        rotationScale: 0.72,
        motionEase: 0.88,
        eyeEase: 0.94,
        writingFx: 0.9,
        readingFx: 0.92,
        thinkingFx: 0.96,
        pulseScale: 0.92,
        shakeScale: 0.82,
        wanderScale: 0.72,
        glyphScale: 0.94,
        readingSweep: 0.9,
        thinkingOrbit: 0.94,
    },
    eager: {
        token: 'eager',
        blinkInterval: [1.7, 3.1],
        winkInterval: [6.4, 9.2],
        wanderInterval: [1.9, 3.1],
        blinkRate: 1.18,
        winkRate: 1.2,
        bobScale: 1.16,
        rotationScale: 1.18,
        motionEase: 1.12,
        eyeEase: 1.08,
        writingFx: 1.14,
        readingFx: 1,
        thinkingFx: 1,
        pulseScale: 1.14,
        shakeScale: 1.08,
        wanderScale: 1.14,
        glyphScale: 1.08,
        readingSweep: 1.04,
        thinkingOrbit: 1,
    },
    analytical: {
        token: 'analytical',
        blinkInterval: [2.4, 4],
        winkInterval: [8.2, 11.4],
        wanderInterval: [2.6, 3.8],
        blinkRate: 1.02,
        winkRate: 0.98,
        bobScale: 0.92,
        rotationScale: 1.08,
        motionEase: 1.02,
        eyeEase: 1.02,
        writingFx: 0.96,
        readingFx: 1.16,
        thinkingFx: 1.18,
        pulseScale: 0.98,
        shakeScale: 0.92,
        wanderScale: 0.88,
        glyphScale: 0.94,
        readingSweep: 1.18,
        thinkingOrbit: 1.14,
    },
    mellow: {
        token: 'mellow',
        blinkInterval: [3.8, 6],
        winkInterval: [12, 16],
        wanderInterval: [3.6, 5.2],
        blinkRate: 0.82,
        winkRate: 0.82,
        bobScale: 0.74,
        rotationScale: 0.66,
        motionEase: 0.8,
        eyeEase: 0.86,
        writingFx: 0.88,
        readingFx: 0.9,
        thinkingFx: 0.94,
        pulseScale: 0.88,
        shakeScale: 0.76,
        wanderScale: 0.64,
        glyphScale: 0.88,
        readingSweep: 0.88,
        thinkingOrbit: 0.92,
    },
};
const PARTICLE_COLORS = [0x3fb950, 0x58a6ff, 0xbc8cff, 0xd29922, 0xffffff];
const PARTY_EMOJIS = ['🎉', '🥳', '🎊'];
const THINK_EMOJIS = ['🤔', '💭'];
const SUCCESS_EMOJIS = ['✅', '✔️', '✔', '☑️', '👍', '🙌'];
const WARNING_EMOJIS = ['⚠️', '⚠', '🚨'];
const ERROR_EMOJIS = ['❌', '✖️', '✖', '🐛'];
const SPARKLE_EMOJIS = ['✨', '🌟', '💫'];
const HEART_EMOJIS = ['❤️', '❤', '💖', '💗', '💓', '💕', '💞', '💘', '💝', '😍', '🥰'];
const LAUGH_EMOJIS = ['😂', '🤣', '😆', '😹'];
const RACCOON_EMOJIS = ['🦝'];
const SLEEP_EMOJIS = ['😴', '💤'];
const CLIPPY_ANIMATION_KEYWORDS = {
    idle: ['idle', 'stand', 'loop'],
    speaking: ['talk', 'speak', 'explain', 'gesture', 'wave', 'idle'],
    writing: ['write', 'type', 'work', 'gesture', 'idle'],
    reading: ['read', 'look', 'search', 'idle'],
    running: ['run', 'work', 'process', 'thinking', 'idle'],
    thinking: ['think', 'ponder', 'idle'],
    think: ['think', 'ponder', 'idle'],
    success: ['happy', 'success', 'celebrate', 'wave', 'idle'],
    sparkle: ['happy', 'success', 'celebrate', 'wave', 'idle'],
    party: ['happy', 'success', 'celebrate', 'wave', 'idle'],
    failed: ['sad', 'error', 'confused', 'no', 'idle'],
    error: ['sad', 'error', 'confused', 'no', 'idle'],
    warning: ['warning', 'confused', 'no', 'idle'],
    sleep: ['sleep', 'idle'],
};

const ROLE_HEAD_TINT_STRENGTH = {
    default: 0.12,
    copilot: 0.16,
    coordinator: 0.4,
    backend: 0.46,
    frontend: 0.52,
    tester: 0.6,
    docs: 0.56,
};
const DUCK_BEAK_UPPER_COLOR = 0xffb347;
const DUCK_BEAK_LOWER_COLOR = 0xff972f;
const DUCK_BEAK_BRIDGE_COLOR = 0xffc95c;
const DUCK_WATER_COLOR = 0x69b8ff;

const container = document.getElementById('avatar-container');
const overlayContainer = document.getElementById('subagent-overlays');
// Full window drag — click on Clippy opens settings
document.body.style.webkitAppRegion = 'drag';
const messageContainerEl = document.getElementById('message-container');
const messageEl = document.getElementById('message-text');
const statusEl = document.getElementById('status-indicator');
const rootModelEl = document.getElementById('root-model');
const rootModelNameEl = document.getElementById('root-model-name');
const rootModelModelEl = document.getElementById('root-model-model');
const rootModelBadgeEl = document.getElementById('root-model-badge');
const rootModelBadgeIconEl = document.getElementById('root-model-badge-icon');
const rootModelBadgeTextEl = document.getElementById('root-model-badge-text');
const subtasksEl = document.getElementById('subtasks');
const emotionBubbleEl = document.getElementById('emotion-bubble');
const clippyAvatarEl = document.getElementById('clippy-avatar');

const ttsToggleBtn = document.getElementById('tts-toggle');
const ttsSettingsBtn = document.getElementById('tts-settings-btn');
const ttsControls = document.getElementById('tts-controls');
const ttsDropdown = document.getElementById('tts-dropdown');
const settingsGeneralTabBtn = document.getElementById('settings-general-tab');
const settingsSpeechTabBtn = document.getElementById('settings-speech-tab');
const settingsGeneralPanel = document.getElementById('settings-general-panel');
const settingsSpeechPanel = document.getElementById('settings-speech-panel');
const avatarStyleSelect = document.getElementById('avatar-style-select');
const ttsEngineSelect = document.getElementById('tts-engine-select');
const ttsWebspeechSection = document.getElementById('tts-webspeech-section');
const ttsVoxtralSection = document.getElementById('tts-voxtral-section');
const ttsElevenlabsSection = document.getElementById('tts-elevenlabs-section');
const ttsSamSection = document.getElementById('tts-sam-section');
const samVoiceSelect = document.getElementById('sam-voice-select');
const ttsSamTestBtn = document.getElementById('tts-sam-test-btn');
const ttsAiVoiceSection = document.getElementById('tts-ai-voice-section');
const ttsAiVoiceSourceLabel = document.getElementById('tts-ai-voice-source-label');
const ttsAiPresetSection = document.getElementById('tts-ai-preset-section');
const ttsAiRecordSection = document.getElementById('tts-ai-record-section');
const runDemoBtn = document.getElementById('run-demo-btn');
const ttsVoiceSelect = document.getElementById('tts-voice-select');
const ttsWebspeechTestBtn = document.getElementById('tts-webspeech-test-btn');
const ttsAiTestBtn = document.getElementById('tts-ai-test-btn');
const ttsRateInput = document.getElementById('tts-rate-input');
const ttsRateValue = document.getElementById('tts-rate-value');
const ttsPitchInput = document.getElementById('tts-pitch-input');
const ttsPitchValue = document.getElementById('tts-pitch-value');
const ttsPitchRow = document.getElementById('tts-pitch-row');
const voxtralUrlInput = document.getElementById('voxtral-url-input');
const voxtralApikeyInput = document.getElementById('voxtral-apikey-input');
const voxtralRefreshBtn = document.getElementById('voxtral-refresh-btn');
const voxtralCloudSection = document.getElementById('voxtral-cloud-section');
const voxtralLocalSection = document.getElementById('voxtral-local-section');
const voxtralVoiceSelect = document.getElementById('voxtral-voice-select');
const elevenlabsApikeyInput = document.getElementById('elevenlabs-apikey-input');
const elevenlabsVoiceSelect = document.getElementById('elevenlabs-voice-select');
const elevenlabsRefreshBtn = document.getElementById('elevenlabs-refresh-btn');
const elevenlabsPresetSection = document.getElementById('elevenlabs-preset-section');
const elevenlabsCloneControls = document.getElementById('elevenlabs-clone-controls');
const elevenlabsCloneBtn = document.getElementById('elevenlabs-clone-btn');
const elevenlabsDeleteBtn = document.getElementById('elevenlabs-delete-btn');
const elevenlabsCloneStatus = document.getElementById('elevenlabs-clone-status');
const voxtralRecordBtn = document.getElementById('voxtral-record-btn');
const voxtralRecordTimer = document.getElementById('voxtral-record-timer');
const voxtralStopBtn = document.getElementById('voxtral-stop-btn');
const clippyRetroVoiceBtn = document.getElementById('clippy-retro-voice-btn');
const voxtralAudioPreview = document.getElementById('voxtral-audio-preview');
const voxtralFileInput = document.getElementById('voxtral-file-input');
const voxtralRerecordBtn = document.getElementById('voxtral-rerecord-btn');
const messageVisibilityToggle = document.getElementById('message-visibility-toggle');
const badgeVisibilityToggle = document.getElementById('badge-visibility-toggle');
const modelVisibilityToggle = document.getElementById('model-visibility-toggle');
const transparentWindowToggle = document.getElementById('transparent-window-toggle');

const avatars = new Map();
const pendingSubagents = [];
const pendingAgentModels = new Map();
const pendingAgentActivities = new Map();
const pendingAgentIntents = new Map();
const pendingAgentThinking = new Set();
const particles = [];
const DEMO_AGENT_IDS = ['demo-planner', 'demo-coder', 'demo-reviewer', 'demo-tester', 'demo-docs'];

let rootWorking = false;
let idleStatusText = '';
let idleSubtaskText = '';
let activeSubtaskText = '';
let squadRootMicActive = false;
let rootLastActivityAt = performance.now();
let rootEmotion = { name: 'default', until: 0 };
let fadeTimeout = null;
let activeSettingsTab = 'general';
let pendingClippyMessage = '';
let lastSpokenClippySummary = '';
let lastSpokenClippySummaryAt = 0;
let demoTimers = [];
let demoSequenceRunId = 0;
let animationStarted = false;
let lastFrameTime = performance.now();
let baseAsset = null;
let duckBeakAsset = null;
let clippyRoot = null;
let clippyMixer = null;

window.__copilotAvatarReady = false;
window.__copilotAvatarState = {
    rootAvatarReady: false,
    squadRootMicActive: false,
    rootMicVisible: false,
};
let clippyActions = [];
let clippyActiveAction = null;
let clippyCurrentAnimationKey = '';
let clippyVisualMode = 'idle';
let clippySpeaking = false;
let clippyBaseY = 0;
let clippyBaseScale = 1;
let clippyBrowsMesh = null;
let clippyEyesMesh = null;
let clippyIrisMesh = null;
let clippyInnerClipDeform = null;
let clippyTalkEnvelope = 0;
let clippyGazeState = {
    currentX: 0,
    currentY: 0,
    targetX: 0,
    targetY: 0,
    timer: 0,
};
let layoutState = {
    columns: 1,
    rows: 0,
    slotWidthPx: 180,
    overlayScale: 1,
    rootScale: ROOT_SCALE,
    rootY: 0.55,
    subScale: SUBAGENT_SCALE,
    spacingX: 0.9,
    rowGap: 0.42,
    stackCenterY: -0.8,
    cameraDistance: 3.2,
    cameraLookAtY: 0.05,
    cameraY: 0.05,
};

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.65);
keyLight.position.set(3.5, 5.5, 4.5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x7f8cff, 0.42);
fillLight.position.set(-3, 2.2, -1.8);
scene.add(fillLight);
scene.add(new THREE.HemisphereLight(0x9966ff, 0x1c2230, 0.68));

const eyeVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const eyeFragmentShader = `
  uniform float uTime;
  uniform float uBlink;
  uniform float uMode;
  uniform vec3 uColor;
  varying vec2 vUv;

  float capsuleMask(vec2 uv) {
    float capsule = length(max(abs(uv) - vec2(0.2, 0.45), 0.0)) - 0.35;
    return 1.0 - smoothstep(-0.05, 0.02, capsule);
  }

  float laughMask(vec2 uv) {
    float curve = abs(uv.y + 0.16 + 0.28 * cos(uv.x * 2.6));
    float band = 1.0 - smoothstep(0.02, 0.08, curve);
    float width = 1.0 - smoothstep(0.42, 0.78, abs(uv.x));
    return band * width;
  }

  float sleepMask(vec2 uv) {
    float curve = abs(uv.y + 0.02 * sin(uv.x * 8.0));
    float band = 1.0 - smoothstep(0.018, 0.055, curve);
    float width = 1.0 - smoothstep(0.35, 0.82, abs(uv.x));
    return band * width;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float mode = floor(uMode + 0.5);
    float mask = capsuleMask(uv);
    float alpha = mask;
    float scanline = sin(vUv.y * 40.0 + uTime * 2.0) * 0.5 + 0.5;
    scanline = smoothstep(0.3, 0.7, scanline);
    float brightness = 0.7 + scanline * 0.3;

    if (mode > 0.5 && mode < 1.5) {
      mask = laughMask(uv);
      alpha = mask;
      brightness = 0.95;
    } else if (mode >= 1.5) {
      mask = sleepMask(uv);
      alpha = mask;
      brightness = 0.85;
    } else {
      float blinkMask = smoothstep(1.0 - uBlink, 1.0 - uBlink + 0.05, 1.0 - abs(uv.y));
      alpha = mask * blinkMask;
    }

    vec3 color = uColor * brightness;
    color += uColor * pow(max(alpha, 0.0), 0.75) * 0.28;
    gl_FragColor = vec4(color, alpha);
  }
`;

const eyeGeometry = new THREE.PlaneGeometry(0.12, 0.18);
const maskGeometry = new THREE.PlaneGeometry(1, 1);
const duckRippleGeometry = new THREE.RingGeometry(0.58, 1, 48);
const particleTexture = createParticleTexture();
const readingBeamTexture = createReadingBeamTexture();
const heartGeometry = createHeartGeometry();
const binaryGlyphTextures = {
    0: createBinaryGlyphTexture('0'),
    1: createBinaryGlyphTexture('1'),
};
const overlayVector = new THREE.Vector3();
const worldVector = new THREE.Vector3();
const rightEyeVector = new THREE.Vector3();
const confettiOriginVector = new THREE.Vector3();
const layoutRayVector = new THREE.Vector3();
const layoutDirectionVector = new THREE.Vector3();
const roleTintColor = new THREE.Color();

function createParticleTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

function createReadingBeamTexture() {
    const width = 96;
    const height = 384;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(88,166,255,0)');
    gradient.addColorStop(0.32, 'rgba(88,166,255,0.08)');
    gradient.addColorStop(0.5, 'rgba(180,224,255,0.78)');
    gradient.addColorStop(0.68, 'rgba(88,166,255,0.08)');
    gradient.addColorStop(1, 'rgba(88,166,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createBinaryGlyphTexture(character) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.font = '700 88px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(63, 185, 80, 0.55)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#d2f8da';
    ctx.fillText(character, size / 2, size / 2 + 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createHeartGeometry() {
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0.5, 0.5);
    heartShape.bezierCurveTo(0.5, 0.5, 0.4, 0.0, 0.0, 0.0);
    heartShape.bezierCurveTo(-0.6, 0.0, -0.6, 0.7, -0.6, 0.7);
    heartShape.bezierCurveTo(-0.6, 1.1, -0.3, 1.54, 0.5, 1.9);
    heartShape.bezierCurveTo(1.2, 1.54, 1.6, 1.1, 1.6, 0.7);
    heartShape.bezierCurveTo(1.6, 0.7, 1.6, 0.0, 1.0, 0.0);
    heartShape.bezierCurveTo(0.7, 0.0, 0.5, 0.5, 0.5, 0.5);

    const geometry = new THREE.ShapeGeometry(heartShape, 24);
    geometry.center();
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    const maxDim = Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
    geometry.scale(1 / maxDim, 1 / maxDim, 1);
    return geometry;
}

function createEyeMaterial() {
    return new THREE.ShaderMaterial({
        vertexShader: eyeVertexShader,
        fragmentShader: eyeFragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uBlink: { value: 1 },
            uMode: { value: 0 },
            uColor: { value: new THREE.Color(0xffffff) },
        },
    });
}

function createHeartEye() {
    const glow = new THREE.Mesh(heartGeometry, new THREE.MeshBasicMaterial({
        color: 0xff5ca8,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide,
    }));
    const core = new THREE.Mesh(heartGeometry, new THREE.MeshBasicMaterial({
        color: 0xff8fc7,
        depthWrite: false,
        side: THREE.DoubleSide,
    }));

    glow.scale.setScalar(1.22);
    glow.position.z = -0.001;
    glow.renderOrder = 3;
    core.position.z = 0.001;
    core.renderOrder = 4;

    const heart = new THREE.Group();
    heart.visible = false;
    heart.add(glow, core);
    heart.userData.glow = glow;
    heart.userData.core = core;
    return heart;
}

function createDuckBeak() {
    const beak = new THREE.Group();
    beak.visible = false;
    beak.userData.materials = [];
    beak.userData.geometries = [];

    if (!duckBeakAsset?.geometries?.length) {
        return beak;
    }

    const importedBeak = new THREE.Group();
    const materials = [];
    const geometries = [];

    for (const sourceGeometry of duckBeakAsset.geometries) {
        const geometry = sourceGeometry.clone();
        const material = new THREE.MeshPhongMaterial({
            color: DUCK_BEAK_UPPER_COLOR,
            emissive: new THREE.Color(DUCK_BEAK_BRIDGE_COLOR),
            emissiveIntensity: 0.1,
            shininess: 22,
            specular: new THREE.Color(0xffe28a),
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 3;
        importedBeak.add(mesh);
        materials.push(material);
        geometries.push(geometry);
    }

    beak.add(importedBeak);
    beak.userData.materials = materials;
    beak.userData.geometries = geometries;
    beak.userData.isImported = true;
    return beak;
}

function positionDuckBeak(beak) {
    if (!beak) return;

    beak.position.set(0, baseAsset.eyeY - baseAsset.size.y * 0.145, baseAsset.eyeZ - baseAsset.size.z * 0.055);
    beak.rotation.set(0.14, 0.003, 0);
    beak.scale.setScalar(Math.max(baseAsset.size.x, baseAsset.size.y, baseAsset.size.z) * 0.31);
    beak.userData.baseScale = beak.scale.clone();
}

function disposeDuckBeak(beak) {
    if (!beak) return;
    for (const material of beak.userData.materials || []) {
        material.dispose();
    }
    for (const geometry of beak.userData.geometries || []) {
        geometry.dispose();
    }
}

function replaceAvatarDuckBeak(avatar) {
    if (!avatar?.modelRoot) return;

    const nextBeak = createDuckBeak();
    positionDuckBeak(nextBeak);
    nextBeak.visible = avatar.isDuck;

    if (avatar.duckBeak) {
        avatar.modelRoot.remove(avatar.duckBeak);
        disposeDuckBeak(avatar.duckBeak);
    }

    avatar.duckBeak = nextBeak;
    avatar.modelRoot.add(nextBeak);
}

function createDuckRipple() {
    const ripple = new THREE.Mesh(duckRippleGeometry, new THREE.MeshBasicMaterial({
        color: DUCK_WATER_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
    }));
    ripple.visible = false;
    ripple.renderOrder = 0;
    ripple.rotation.x = -Math.PI / 2;
    return ripple;
}

function placeHeartEye(heartEye, x, y, z, scale = 0.1) {
    heartEye.position.set(x, y, z + 0.003);
    heartEye.userData.baseScale = scale;
    heartEye.scale.setScalar(scale);
}

function createActivityEffects() {
    const readingBeamMaterial = new THREE.MeshBasicMaterial({
        map: readingBeamTexture,
        color: 0x7fc8ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
    });
    const readingBeam = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1), readingBeamMaterial);
    readingBeam.visible = false;
    readingBeam.renderOrder = 3;

    const thinkingDots = Array.from({ length: 3 }, (_, index) => {
        const material = new THREE.SpriteMaterial({
            map: particleTexture,
            color: 0xbc8cff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const sprite = new THREE.Sprite(material);
        sprite.visible = false;
        sprite.renderOrder = 4;
        return {
            sprite,
            material,
            phase: (index / 3) * Math.PI * 2,
            orbitRadius: 0.11 + index * 0.02,
            size: 1 - index * 0.12,
        };
    });

    return { readingBeam, readingBeamMaterial, thinkingDots };
}

function createSquadMicBoom() {
    const micBoom = new THREE.Group();
    micBoom.visible = false;
    micBoom.userData.materials = [];
    micBoom.userData.geometries = [];

    const darkGraphite = 0x1c1c1c;
    const boomMaterial = new THREE.MeshPhongMaterial({
        color: darkGraphite,
        emissive: new THREE.Color(0x0a0a0a),
        emissiveIntensity: 1.0,
        shininess: 22,
        specular: new THREE.Color(0x3a3a3a),
    });
    const capsuleMaterial = new THREE.MeshBasicMaterial({
        color: darkGraphite,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
    });
    micBoom.userData.materials.push(boomMaterial, capsuleMaterial);

    // Boom runs from ear region (temple) around the cheek down to the mouth capsule.
    const boomCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(baseAsset.size.x * 0.268, baseAsset.eyeY + baseAsset.size.y * 0.04, baseAsset.eyeZ - baseAsset.size.z * 0.01),
        new THREE.Vector3(baseAsset.size.x * 0.258, baseAsset.eyeY,                            baseAsset.eyeZ + baseAsset.size.z * 0.03),
        new THREE.Vector3(baseAsset.size.x * 0.215, baseAsset.eyeY - baseAsset.size.y * 0.055, baseAsset.eyeZ + baseAsset.size.z * 0.05),
        new THREE.Vector3(baseAsset.size.x * 0.195, baseAsset.eyeY - baseAsset.size.y * 0.11,  baseAsset.eyeZ + baseAsset.size.z * 0.085),
        new THREE.Vector3(baseAsset.size.x * 0.145, baseAsset.eyeY - baseAsset.size.y * 0.155, baseAsset.eyeZ + baseAsset.size.z * 0.13),
        new THREE.Vector3(baseAsset.size.x * 0.082, baseAsset.eyeY - baseAsset.size.y * 0.178, baseAsset.eyeZ + baseAsset.size.z * 0.156),
    ]);
    const boomGeometry = new THREE.TubeGeometry(boomCurve, 28, baseAsset.size.x * 0.0055, 8, false);
    const micGeometry = new THREE.CapsuleGeometry(baseAsset.size.x * 0.024, baseAsset.size.x * 0.052, 4, 10);
    micBoom.userData.geometries.push(boomGeometry, micGeometry);

    const boom = new THREE.Mesh(boomGeometry, boomMaterial);
    boom.renderOrder = 3;
    micBoom.add(boom);

    const mic = new THREE.Mesh(micGeometry, capsuleMaterial);
    mic.position.set(baseAsset.size.x * 0.075, baseAsset.eyeY - baseAsset.size.y * 0.18, baseAsset.eyeZ + baseAsset.size.z * 0.158);
    mic.rotation.z = Math.PI * 0.38;
    mic.rotation.y = -0.18;
    mic.renderOrder = 4;
    micBoom.add(mic);

    return micBoom;
}

function disposeSquadMicBoom(micBoom) {
    if (!micBoom) return;
    for (const material of micBoom.userData.materials || []) {
        material.dispose();
    }
    for (const geometry of micBoom.userData.geometries || []) {
        geometry.dispose();
    }
}

function createWritingGlyphs() {
    return Array.from({ length: 6 }, (_, index) => {
        const character = index % 2 === 0 ? '1' : '0';
        const material = new THREE.SpriteMaterial({
            map: binaryGlyphTextures[character],
            color: 0x7ee787,
            transparent: true,
            opacity: 0,
            depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.visible = false;
        sprite.renderOrder = 5;
        sprite.center.set(0.5, 0.5);
        return {
            sprite,
            material,
            orbitRadius: 0.12 + index * 0.032,
            verticalOffset: 0.22 + index * 0.036,
            phase: (index / 6) * Math.PI * 2,
            speed: 0.9 + index * 0.12,
            drift: index % 2 === 0 ? 1 : -1,
            size: 0.085 + (index % 3) * 0.014,
        };
    });
}

function containsAny(text, emojis) {
    return emojis.some((emoji) => text.includes(emoji));
}

function detectEmotion(text) {
    if (!text) return null;
    if (containsAny(text, PARTY_EMOJIS)) return 'party';
    if (containsAny(text, HEART_EMOJIS)) return 'heart';
    if (containsAny(text, LAUGH_EMOJIS)) return 'laugh';
    if (containsAny(text, SUCCESS_EMOJIS)) return 'success';
    if (containsAny(text, WARNING_EMOJIS)) return 'warning';
    if (containsAny(text, ERROR_EMOJIS)) return 'error';
    if (containsAny(text, THINK_EMOJIS)) return 'think';
    if (containsAny(text, SPARKLE_EMOJIS)) return 'sparkle';
    if (containsAny(text, RACCOON_EMOJIS)) return 'raccoon';
    if (containsAny(text, SLEEP_EMOJIS)) return 'sleep';
    return null;
}

function classifyTool(toolName) {
    if (!toolName) return 'idle';
    if (toolName === 'edit' || toolName === 'create') return 'writing';
    if (toolName === 'view' || toolName === 'grep' || toolName === 'glob' || toolName === 'rg' || toolName.startsWith('lsp')) return 'reading';
    if (toolName === 'powershell' || toolName === 'task') return 'running';
    return 'idle';
}

function formatToolLabel(toolName) {
    return String(toolName || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function describeToolActivity(toolName) {
    const normalized = String(toolName || '').trim().toLowerCase();
    if (!normalized) return '';

    if (normalized === 'edit') return 'Editing code';
    if (normalized === 'create') return 'Creating files';
    if (normalized === 'apply_patch') return 'Patching code';
    if (normalized === 'view') return 'Reading files';
    if (normalized === 'rg' || normalized === 'grep') return 'Searching code';
    if (normalized === 'glob') return 'Scanning files';
    if (normalized.startsWith('lsp')) return 'Inspecting code';
    if (normalized === 'powershell' || normalized === 'bash') return 'Running commands';
    if (normalized === 'task') return 'Running tasks';
    if (normalized === 'read_powershell') return 'Reading command output';
    if (normalized === 'write_powershell') return 'Driving command flow';
    if (normalized === 'sql') return 'Querying data';
    if (normalized === 'web_fetch') return 'Fetching docs';

    return `Using ${formatToolLabel(toolName)}`;
}

function getLiveIntentText(avatar, now = performance.now()) {
    return avatar.intentText && avatar.intentUntil > now ? avatar.intentText : '';
}

function isCopilotSummaryIntent(value) {
    const cleaned = cleanAgentLabel(value);
    if (!cleaned) return false;
    return /^it looks like\b/i.test(cleaned)
        || /^you(?:'re| are| seem to be)\s+all set\b/i.test(cleaned)
        || /^there(?:'s| is)\s+an update\b/i.test(cleaned)
        || /^we hit a snag\b/i.test(cleaned);
}

function getRenderableIntentText(avatar, now = performance.now()) {
    const liveIntent = getLiveIntentText(avatar, now);
    if (!liveIntent) return '';
    if (!avatar?.isRoot && isCopilotSummaryIntent(liveIntent)) {
        return '';
    }
    return liveIntent;
}

function normalizeComparisonText(value) {
    return cleanAgentLabel(value)
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .toLowerCase();
}

function normalizeRootChromeText(value) {
    return cleanAgentLabel(value)
        .replace(/^[•●▪◦]+\s*/u, '')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase();
}

function shouldSuppressRootChromeText(value) {
    const normalized = normalizeRootChromeText(value);
    return !!normalized && SUPPRESSED_ROOT_CHROME_TEXT.has(normalized);
}

function shouldSuppressRootToolName(toolName) {
    return SUPPRESSED_ROOT_TOOL_NAMES.has(String(toolName || '').trim());
}

function isRoleLikeDetailText(value, role = '') {
    const normalizedValue = normalizeComparisonText(value);
    const normalizedRole = normalizeComparisonText(role);
    if (!normalizedValue || !normalizedRole) return false;
    return normalizedValue === normalizedRole || normalizedValue.startsWith(`${normalizedRole} `);
}

function getAvatarTaskSummary(avatar) {
    const workDescription = cleanAgentLabel(avatar?.workDescription || '');
    if (workDescription) {
        return workDescription;
    }

    const detailText = cleanAgentLabel(avatar?.detailText || '');
    if (detailText) {
        return detailText;
    }

    const taskSummary = cleanAgentLabel(avatar?.taskSummary || '');
    if (taskSummary) {
        return taskSummary;
    }

    const description = cleanAgentLabel(avatar?.description || '');
    if (!description || isRoleLikeDetailText(description, avatar?.role || '')) {
        return '';
    }

    return description;
}

function joinDistinctDetailParts(parts) {
    const seen = new Set();
    const joined = [];
    for (const part of parts) {
        const cleaned = cleanAgentLabel(part);
        if (!cleaned) continue;
        const normalized = normalizeComparisonText(cleaned);
        if (normalized && seen.has(normalized)) continue;
        if (normalized) seen.add(normalized);
        joined.push(cleaned);
    }
    return joined.join(' • ');
}

function getAvatarBadgeText(avatar, activity, now = performance.now()) {
    const badge = ACTIVITY_BADGES[activity] || ACTIVITY_BADGES.idle;
    return badge.text;
}

function getAvatarDetailText(avatar, activity, now = performance.now()) {
    const liveIntent = getRenderableIntentText(avatar, now);
    const latestTool = getLatestToolEntry(avatar);
    const activeWorkTool = hasWorkToolEntry(latestTool) ? latestTool : null;
    const explicitToolDetail = latestTool?.explicitActivityLabel ? latestTool.activityLabel : '';
    const fallbackToolDetail = latestTool?.activityLabel || describeToolActivity(latestTool?.toolName);
    const taskSummary = getAvatarTaskSummary(avatar);
    const modelThinkingDetail = avatar.modelLabel ? `Thinking with ${avatar.modelLabel}` : '';

    if (!avatar?.isRoot) {
        if (avatar.effectState === 'success' || avatar.effectState === 'failed') {
            return liveIntent || taskSummary || '';
        }

        if (taskSummary) {
            return taskSummary;
        }

        if (latestTool) {
            return explicitToolDetail || fallbackToolDetail || liveIntent || '';
        }

        if (activity === 'thinking') {
            return liveIntent || modelThinkingDetail || '';
        }

        return liveIntent || '';
    }

    if (avatar.effectState === 'success' || avatar.effectState === 'failed') {
        return liveIntent || '';
    }

    if (activeWorkTool) {
        return joinDistinctDetailParts([liveIntent || taskSummary, explicitToolDetail || fallbackToolDetail])
            || liveIntent
            || taskSummary
            || fallbackToolDetail
            || '';
    }

    if (activity === 'thinking') {
        return joinDistinctDetailParts([liveIntent || taskSummary, modelThinkingDetail])
            || liveIntent
            || taskSummary
            || modelThinkingDetail
            || '';
    }

    return liveIntent || taskSummary || '';
}

function getRoleStyle(data = {}) {
    const roleText = `${data.role || ''} ${data.displayName || ''} ${data.agentName || ''}`.toLowerCase();
    if (!roleText.trim()) return ROLE_STYLES.default;
    if (roleText.includes('@copilot') || roleText.includes('coding agent')) return ROLE_STYLES.copilot;
    if (roleText.includes('coordinator') || roleText.includes('lead')) return ROLE_STYLES.coordinator;
    if (roleText.includes('test') || roleText.includes('qa') || roleText.includes('quality')) return ROLE_STYLES.tester;
    if (roleText.includes('scribe') || roleText.includes('doc') || roleText.includes('writer') || roleText.includes('logger') || roleText.includes('prompt')) return ROLE_STYLES.docs;
    if (roleText.includes('front') || roleText.includes('ui') || roleText.includes('ux')) return ROLE_STYLES.frontend;
    if (roleText.includes('back') || roleText.includes('api') || roleText.includes('infra') || roleText.includes('platform') || roleText.includes('database') || roleText.includes('data')) return ROLE_STYLES.backend;
    return ROLE_STYLES.default;
}

function hashString(value) {
    let hash = 0;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
}

function randomFromRange([min, max]) {
    return min + Math.random() * (max - min);
}

function getMotionPersona(data = {}) {
    const roleStyle = data.roleStyle || getRoleStyle(data);
    if (data.isRoot || data.agentId === ROOT_AGENT_ID) return MOTION_PERSONAS.steady;
    switch (roleStyle.token) {
        case 'coordinator':
            return MOTION_PERSONAS.steady;
        case 'tester':
        case 'backend':
            return MOTION_PERSONAS.analytical;
        case 'frontend':
        case 'copilot':
            return MOTION_PERSONAS.eager;
        case 'docs':
            return MOTION_PERSONAS.mellow;
        default: {
            const tokens = [MOTION_PERSONAS.steady, MOTION_PERSONAS.eager, MOTION_PERSONAS.analytical, MOTION_PERSONAS.mellow];
            const hash = hashString(`${data.agentId || ''}:${data.displayName || ''}:${data.agentName || ''}`);
            return tokens[hash % tokens.length];
        }
    }
}

function applyMotionPersona(avatar) {
    const motionPersona = getMotionPersona(avatar);
    const changed = !avatar.motionPersona || avatar.motionPersona.token !== motionPersona.token;
    avatar.motionPersona = motionPersona;
    if (!changed || !avatar.anim) return;

    avatar.anim.blinkTimer = randomFromRange(motionPersona.blinkInterval);
    avatar.anim.winkTimer = randomFromRange(motionPersona.winkInterval);
    avatar.anim.wanderTimer = randomFromRange(motionPersona.wanderInterval);
    avatar.anim.targetRotX = 0;
    avatar.anim.targetRotY = 0;
}

function applyRoleStyle(avatar) {
    if (!avatar?.overlay) return;

    const roleStyle = avatar.roleStyle || ROLE_STYLES.default;
    avatar.overlay.labelEl.dataset.roleStyle = roleStyle.token;
    avatar.overlay.nameEl.dataset.roleIcon = roleStyle.icon || '';
    avatar.overlay.labelEl.style.setProperty('--role-accent', roleStyle.accent);
    avatar.overlay.labelEl.style.setProperty('--role-accent-soft', roleStyle.accentSoft);
    avatar.overlay.labelEl.style.setProperty('--role-accent-glow', roleStyle.accentGlow);
    avatar.overlay.labelEl.style.setProperty('--role-accent-panel', roleStyle.accentPanel);
}

function applyOverlayRoleStyle(labelEl, nameEl, roleStyle) {
    if (!labelEl || !nameEl) return;

    labelEl.dataset.roleStyle = roleStyle.token;
    nameEl.dataset.roleIcon = roleStyle.icon || '';
    labelEl.style.setProperty('--role-accent', roleStyle.accent);
    labelEl.style.setProperty('--role-accent-soft', roleStyle.accentSoft);
    labelEl.style.setProperty('--role-accent-glow', roleStyle.accentGlow);
    labelEl.style.setProperty('--role-accent-panel', roleStyle.accentPanel);
}

function cloneAvatarHeadMaterials(modelRoot) {
    const headMaterials = [];

    modelRoot.traverse((node) => {
        if (!node.isMesh || !node.material) return;

        const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
        const clonedMaterials = sourceMaterials.map((material) => {
            const clonedMaterial = material.clone();
            if (clonedMaterial.color) {
                headMaterials.push({
                    material: clonedMaterial,
                    baseColor: clonedMaterial.color.clone(),
                    baseEmissive: clonedMaterial.emissive ? clonedMaterial.emissive.clone() : null,
                    baseEmissiveIntensity: clonedMaterial.emissiveIntensity ?? 1,
                });
            }
            return clonedMaterial;
        });

        node.material = Array.isArray(node.material) ? clonedMaterials : clonedMaterials[0];
    });

    return headMaterials;
}

function applyRoleHeadTint(avatar) {
    if (!avatar?.headMaterials?.length) return;

    const roleStyle = avatar.roleStyle || ROLE_STYLES.default;
    const tintStrength = ROLE_HEAD_TINT_STRENGTH[roleStyle.token] ?? ROLE_HEAD_TINT_STRENGTH.default;
    roleTintColor.set(roleStyle.accent || ROLE_STYLES.default.accent);
    const accentHsl = {};
    roleTintColor.getHSL(accentHsl);

    for (const entry of avatar.headMaterials) {
        const baseHsl = {};
        entry.baseColor.getHSL(baseHsl);
        const targetHue = THREE.MathUtils.lerp(baseHsl.h, accentHsl.h, tintStrength * 0.96);
        const targetSat = THREE.MathUtils.clamp(Math.max(baseHsl.s * 0.58, accentHsl.s * 0.98), 0, 1);
        const targetLight = THREE.MathUtils.clamp(baseHsl.l * 0.74 + accentHsl.l * 0.26, 0, 1);
        entry.material.color.setHSL(
            targetHue,
            THREE.MathUtils.clamp(THREE.MathUtils.lerp(baseHsl.s, targetSat, tintStrength), 0, 1),
            THREE.MathUtils.clamp(THREE.MathUtils.lerp(baseHsl.l, targetLight, tintStrength * 0.82), 0, 1),
        );

        if (entry.baseEmissive && entry.material.emissive) {
            entry.material.emissive.copy(entry.baseEmissive).lerp(roleTintColor, tintStrength * 0.2);
            entry.material.emissiveIntensity = entry.baseEmissiveIntensity + tintStrength * 0.18;
        }
    }
}

function registerRootActivity() {
    rootLastActivityAt = performance.now();
}

function setRootEmotion(name, durationMs = EMOTION_HOLD_MS) {
    rootEmotion = {
        name,
        until: performance.now() + durationMs,
    };
}

function getActiveRootEmotion(now = performance.now()) {
    if (rootEmotion.until > now) return rootEmotion.name;
    return 'default';
}

function updateEmotionBubble(emotion) {
    const text = ({
        party: '🎉',
        heart: '❤',
        laugh: '😂',
        think: '🤔',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        sparkle: '✨',
        raccoon: '🦝',
        sleep: 'zzz',
    })[emotion] || '';

    emotionBubbleEl.textContent = text;
    emotionBubbleEl.className = text ? `visible ${emotion}` : '';
}

function updateStatusIndicator() {
    statusEl.textContent = idleStatusText;
    statusEl.classList.toggle('active', !!idleStatusText);
}

function updateTtsButton() {
    ttsToggleBtn.textContent = ttsEnabled ? '🔊' : '🔇';
}

function setTtsSettingsOpen(open) {
    ttsDropdown.classList.toggle('hidden', !open);
    ttsControls.classList.toggle('settings-open', open);
}

function toggleTtsSettings() {
    setTtsSettingsOpen(ttsDropdown.classList.contains('hidden'));
}


function clearMessageOverlay() {
    if (fadeTimeout) {
        clearTimeout(fadeTimeout);
        fadeTimeout = null;
    }
    messageEl.classList.remove('visible');
    messageEl.classList.remove('fading');
    messageEl.textContent = '';
}

function isClippyAvatar() {
    return avatarStyle === 'clippy';
}

function setRadioGroupValue(name, value) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
        radio.checked = radio.value === value;
    });
}

function setClippySpeaking(active) {
    clippySpeaking = !!active;
    clippyAvatarEl.dataset.speaking = clippySpeaking ? 'true' : 'false';
    updateClippyAnimationState();
}

function updateClippyVisual(mode = 'idle') {
    const normalized = mode === 'running' && rootWorking ? 'running' : (mode || 'idle');
    clippyVisualMode = normalized;
    clippyAvatarEl.dataset.mode = normalized;
    updateClippyAnimationState();
}

function getClippyAnimationKey() {
    return clippySpeaking ? 'speaking' : clippyVisualMode || 'idle';
}

function findClippyAction(mode) {
    if (!clippyActions.length) return null;
    const keywords = CLIPPY_ANIMATION_KEYWORDS[mode] || CLIPPY_ANIMATION_KEYWORDS.idle;

    for (const keyword of keywords) {
        const action = clippyActions.find((candidate) => candidate.getClip().name.toLowerCase().includes(keyword));
        if (action) return action;
    }

    return clippyActions[0];
}

function updateClippyAnimationState() {
    if (!clippyMixer || !clippyActions.length) return;
    const key = getClippyAnimationKey();
    if (key === clippyCurrentAnimationKey && clippyActiveAction) return;

    const nextAction = findClippyAction(key);
    if (!nextAction) return;

    nextAction.enabled = true;
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.clampWhenFinished = false;
    if (nextAction !== clippyActiveAction) {
        nextAction.reset().fadeIn(0.18).play();
        if (clippyActiveAction) {
            clippyActiveAction.fadeOut(0.18);
        }
        clippyActiveAction = nextAction;
    }

    clippyCurrentAnimationKey = key;
}

function updateSceneModeVisibility() {
    const clippyActive = isClippyAvatar();
    const clippyWithSubagents = clippyActive && [...avatars.values()].some((avatar) => !avatar.isRoot && avatar.inLayout);
    if (clippyRoot) {
        clippyRoot.visible = clippyActive;
    }

    for (const avatar of avatars.values()) {
        avatar.group.visible = !clippyActive || (!avatar.isRoot && clippyWithSubagents);
    }

    for (const particle of particles) {
        particle.sprite.visible = !clippyActive || clippyWithSubagents;
    }
}

function getObjectMaterialNames(object) {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    return materials.map((material) => material?.name?.toLowerCase() || '');
}

function smoothStep(edge0, edge1, value) {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function rangeInfluence(value, min, max, fade = 0.18) {
    return smoothStep(min, min + fade, value) * (1 - smoothStep(max - fade, max, value));
}

function prepareClippyInnerClipDeform(mesh) {
    console.log('[JAW] prepareClippyInnerClipDeform called for mesh:', mesh.name, 'verts:', mesh.geometry?.attributes?.position?.count);
    window.__jawMeshNames = (window.__jawMeshNames || []);
    window.__jawMeshNames.push({ name: mesh.name, verts: mesh.geometry?.attributes?.position?.count });
    const position = mesh.geometry?.attributes?.position;
    if (!position?.array || !position.count) return;

    const base = new Float32Array(position.array);
    const weights = new Float32Array(position.count);
    let maxWeight = 0;

    let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity,zMin=Infinity,zMax=-Infinity;
    for (let index = 0; index < position.count; index += 1) {
        const offset = index * 3;
        xMin=Math.min(xMin,base[offset]); xMax=Math.max(xMax,base[offset]);
        yMin=Math.min(yMin,base[offset+1]); yMax=Math.max(yMax,base[offset+1]);
        zMin=Math.min(zMin,base[offset+2]); zMax=Math.max(zMax,base[offset+2]);
    }
    console.log('[JAW] vertex ranges x:', xMin.toFixed(3), xMax.toFixed(3), 'y:', yMin.toFixed(3), yMax.toFixed(3), 'z:', zMin.toFixed(3), zMax.toFixed(3));
    window.__jawRanges = { x:[xMin,xMax], y:[yMin,yMax], z:[zMin,zMax] };

    // Store signed jaw direction per vertex: +1 = upper jaw (move up), -1 = lower jaw (move down)
    const jawDir = new Float32Array(position.count);
    const mouthCenterZ = 0.85; // center of z range 0.25..1.45

    for (let index = 0; index < position.count; index += 1) {
        const offset = index * 3;
        const x = base[offset];
        const y = base[offset + 1];
        const z = base[offset + 2];
        // Only inner/edge vertices (not the outer flat faces at |y| ≈ 0.07)
        const absY = Math.abs(y);
        const yWeight = absY < 0.05 ? 1.0 : smoothStep(0.07, 0.045, absY);
        const xWeight = rangeInfluence(x, -0.55, 0.18, 0.14);
        const zWeight = rangeInfluence(z, 0.25, 1.45, 0.22);
        const lowerJawWeight = smoothStep(0.45, 1.35, z);
        const weight = yWeight * xWeight * zWeight * (0.35 + lowerJawWeight * 0.65);
        weights[index] = weight;
        jawDir[index] = z < mouthCenterZ ? -1 : 1; // lower half goes down, upper half goes up
        maxWeight = Math.max(maxWeight, weight);
    }
    console.log('[JAW] maxWeight:', maxWeight.toFixed(6), 'verts:', position.count);

    if (maxWeight <= 0) return;
    position.setUsage(THREE.DynamicDrawUsage);
    clippyInnerClipDeform = { mesh, position, base, weights, jawDir };
    window.__clippyDeform = clippyInnerClipDeform;
}

function rememberClippyFaceNode(object, type) {
    if (!object?.isMesh) return;

    if (!object.userData.baseScale) {
        object.userData.baseScale = object.scale.clone();
    }
    if (!object.userData.basePosition) {
        object.userData.basePosition = object.position.clone();
    }
    if (!object.userData.baseRotation) {
        object.userData.baseRotation = object.rotation.clone();
    }

    if (type === 'brows') {
        clippyBrowsMesh = object;
    } else if (type === 'eyes') {
        clippyEyesMesh = object;
    } else if (type === 'iris') {
        clippyIrisMesh = object;
    }
}

function styleClippyMesh(object) {
    if (!object.isMesh) return;
    window.__allMeshes = window.__allMeshes || [];
    const mats = getObjectMaterialNames(object);
    window.__allMeshes.push({ name: object.name, mats });

    const objectName = object.name.toLowerCase();
    const materialNames = getObjectMaterialNames(object);
    if (objectName.includes('brows') || materialNames.some((name) => name.includes('brows'))) {
        rememberClippyFaceNode(object, 'brows');
    } else if (objectName.includes('iris') || materialNames.some((name) => name.includes('iris'))) {
        rememberClippyFaceNode(object, 'iris');
    } else if (objectName.includes('eyes') || materialNames.some((name) => name.includes('eyes'))) {
        rememberClippyFaceNode(object, 'eyes');
    }

    if (objectName.includes('paper') || materialNames.some((name) => name.includes('paper'))) {
        object.visible = false;
        return;
    }

    object.frustumCulled = false;
    if (objectName.includes('clip') || materialNames.some((name) => name.includes('clippy'))) {
        object.material = new THREE.MeshStandardMaterial({
            color: 0x8f9492,
            metalness: 0.32,
            roughness: 0.26,
            envMapIntensity: 0.9,
        });
        prepareClippyInnerClipDeform(object);
    } else if (object.material) {
        object.material.needsUpdate = true;
    }
}

function normalizeClippyModel(model, root) {
    const box = new THREE.Box3();
    const objectBox = new THREE.Box3();
    model.updateWorldMatrix(true, true);
    model.traverse((object) => {
        if (!object.isMesh || !object.visible) return;
        objectBox.setFromObject(object);
        box.union(objectBox);
    });
    if (box.isEmpty()) {
        box.setFromObject(model);
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const height = size.y || Math.max(size.x, size.z, 1);

    model.position.sub(center);
    clippyBaseScale = CLIPPY_TARGET_HEIGHT / height;
    clippyBaseY = 0.02;
    root.scale.setScalar(clippyBaseScale);
    root.position.set(0, clippyBaseY, 0);
}

async function loadClippyModel(loader) {
    try {
        const gltf = await loader.loadAsync(CLIPPY_MODEL_URL);
        clippyRoot = new THREE.Group();
        clippyRoot.name = 'Clippy';
        clippyRoot.visible = false;
        clippyBrowsMesh = null;
        clippyEyesMesh = null;
        clippyIrisMesh = null;

        const model = gltf.scene;
        const modelWrapper = new THREE.Group();
        modelWrapper.add(model);
        model.traverse(styleClippyMesh);
        normalizeClippyModel(modelWrapper, clippyRoot);
        applyClippyBlink(1);

        clippyRoot.add(modelWrapper);
        scene.add(clippyRoot);

        if (gltf.animations?.length) {
            clippyMixer = new THREE.AnimationMixer(model);
            clippyActions = gltf.animations.map((clip) => clippyMixer.clipAction(clip));
            updateClippyAnimationState();
        }

        updateSceneModeVisibility();
    } catch (error) {
        console.warn('Unable to load Clippy GLB:', error);
    }
}

function getClippyMotionConfig(mode, time) {
    const config = { bobY: Math.sin(time * 1.45) * 0.025, rotX: 0, rotY: Math.sin(time * 0.8) * 0.05, rotZ: Math.sin(time * 1.1) * 0.025, scale: 1, timeScale: 1 };

    switch (mode) {
        case 'speaking':
            config.bobY = Math.sin(time * 8.2) * 0.035;
            config.rotY = Math.sin(time * 5.1) * 0.08;
            config.rotZ = Math.sin(time * 6.4) * 0.04;
            config.scale = 1.02 + Math.sin(time * 8.2) * 0.012;
            config.timeScale = 1.25;
            break;
        case 'writing':
        case 'running':
            config.bobY = Math.sin(time * 7.4) * 0.028;
            config.rotX = Math.sin(time * 6.2) * 0.04;
            config.rotY = Math.sin(time * 4.4) * 0.1;
            config.rotZ = Math.sin(time * 8.1) * 0.04;
            config.timeScale = 1.18;
            break;
        case 'reading':
            config.bobY = Math.sin(time * 1.7) * 0.018;
            config.rotY = Math.sin(time * 1.4) * 0.16;
            config.rotZ = Math.sin(time * 0.8) * 0.018;
            config.timeScale = 0.92;
            break;
        case 'thinking':
        case 'think':
            config.bobY = Math.sin(time * 1.2) * 0.016;
            config.rotX = -0.06 + Math.sin(time * 0.9) * 0.025;
            config.rotY = 0.11 + Math.sin(time * 0.7) * 0.045;
            config.rotZ = -0.025 + Math.sin(time * 0.6) * 0.018;
            config.timeScale = 0.78;
            break;
        case 'success':
        case 'sparkle':
        case 'party':
            config.bobY = Math.sin(time * 5.8) * 0.04;
            config.rotY = Math.sin(time * 4.8) * 0.11;
            config.rotZ = Math.sin(time * 7.2) * 0.06;
            config.scale = 1.04 + Math.sin(time * 5.8) * 0.018;
            config.timeScale = 1.24;
            break;
        case 'failed':
        case 'error':
        case 'warning':
            config.bobY = Math.sin(time * 3.4) * 0.014;
            config.rotX = -0.08 + Math.sin(time * 2.8) * 0.025;
            config.rotY = Math.sin(time * 4.8) * 0.09;
            config.rotZ = Math.sin(time * 9.5) * 0.035;
            config.timeScale = 0.9;
            break;
        case 'sleep':
            config.bobY = Math.sin(time * 0.75) * 0.012;
            config.rotX = -0.08;
            config.rotY = Math.sin(time * 0.45) * 0.035;
            config.rotZ = -0.035 + Math.sin(time * 0.5) * 0.015;
            config.timeScale = 0.45;
            break;
    }

    return config;
}

function updateClippyInnerClipDeform(dt, time) {
    const target = clippySpeaking ? 1 : 0;
    const ease = 1 - Math.exp(-dt * (target ? 14 : 8));
    clippyTalkEnvelope += (target - clippyTalkEnvelope) * ease;

    if (!clippyInnerClipDeform) return;
    const { mesh, position, base, weights } = clippyInnerClipDeform;
    const values = position.array;

    // Layered sines for natural speech cadence
    const syllable = Math.max(0, Math.sin(time * 14) + Math.sin(time * 23) * 0.5 + Math.sin(time * 37) * 0.25) / 1.75;
    const open = clippyTalkEnvelope * syllable;

    // Push all mouth-area vertices in +Z only (opens upward, never exposes interior)
    for (let i = 0; i < position.count; i++) {
        const o = i * 3;
        values[o]     = base[o];
        values[o + 1] = base[o + 1];
        values[o + 2] = base[o + 2] + open * weights[i] * 0.18;
    }
    position.needsUpdate = true;
}

function updateClippyFaceState(patch = {}) {
    window.__clippyFaceState = {
        ...(window.__clippyFaceState || {}),
        ...patch,
        hasBrows: !!clippyBrowsMesh,
        hasEyes: !!clippyEyesMesh,
        hasIris: !!clippyIrisMesh,
    };
}

function applyClippyBlink(openness = 1) {
    if (clippyEyesMesh?.userData?.baseScale) {
        const baseScale = clippyEyesMesh.userData.baseScale;
        clippyEyesMesh.scale.set(baseScale.x, baseScale.y, baseScale.z);
    }

    if (clippyIrisMesh?.userData?.baseScale) {
        const baseScale = clippyIrisMesh.userData.baseScale;
        clippyIrisMesh.scale.set(baseScale.x, baseScale.y, baseScale.z);
        clippyIrisMesh.visible = true;
    }

    updateClippyFaceState({
        blink: 1,
    });
}

function getClippyGazeConfig(mode = 'idle', motionPersona = MOTION_PERSONAS.steady) {
    const timerRange = [
        Math.max(1.15, motionPersona.wanderInterval[0] * 0.44),
        Math.max(2.1, motionPersona.wanderInterval[1] * 0.5),
    ];

    switch (mode) {
        case 'reading':
            return {
                enabled: true,
                restX: -CLIPPY_GAZE_MAX_X * 0.08,
                restY: -CLIPPY_GAZE_MAX_Y * 0.18,
                rangeX: CLIPPY_GAZE_MAX_X * 0.24,
                rangeY: CLIPPY_GAZE_MAX_Y * 0.12,
                timerRange,
            };
        case 'thinking':
        case 'think':
            return {
                enabled: true,
                restX: CLIPPY_GAZE_MAX_X * 0.1,
                restY: CLIPPY_GAZE_MAX_Y * 0.08,
                rangeX: CLIPPY_GAZE_MAX_X * 0.18,
                rangeY: CLIPPY_GAZE_MAX_Y * 0.12,
                timerRange,
            };
        case 'sleep':
            return {
                enabled: false,
                restX: 0,
                restY: -CLIPPY_GAZE_MAX_Y * 0.12,
                rangeX: 0,
                rangeY: 0,
                timerRange,
            };
        default:
            return {
                enabled: true,
                restX: 0,
                restY: 0,
                rangeX: CLIPPY_GAZE_MAX_X,
                rangeY: CLIPPY_GAZE_MAX_Y,
                timerRange,
            };
    }
}

function getClippyBrowLift(mode = 'idle') {
    switch (mode) {
        case 'thinking':
        case 'think':
            return CLIPPY_BROW_IDLE_LIFT * 1.4;
        case 'reading':
            return CLIPPY_BROW_IDLE_LIFT * 0.45;
        case 'failed':
        case 'error':
        case 'warning':
            return -CLIPPY_BROW_IDLE_LIFT * 0.6;
        case 'sleep':
            return -CLIPPY_BROW_IDLE_LIFT * 0.4;
        default:
            return CLIPPY_BROW_IDLE_LIFT;
    }
}

function applyClippyGaze(offsetX = 0, offsetY = 0, { mode = 'idle', time = 0 } = {}) {
    if (clippyEyesMesh?.userData?.basePosition && clippyEyesMesh?.userData?.baseRotation) {
        const basePosition = clippyEyesMesh.userData.basePosition;
        const baseRotation = clippyEyesMesh.userData.baseRotation;
        clippyEyesMesh.position.set(
            basePosition.x,
            basePosition.y,
            basePosition.z,
        );
        clippyEyesMesh.rotation.set(
            baseRotation.x - offsetY * CLIPPY_EYE_ROTATION_X,
            baseRotation.y + offsetX * CLIPPY_EYE_ROTATION_Y,
            baseRotation.z - offsetX * CLIPPY_EYE_ROTATION_Z,
        );
    }

    if (clippyIrisMesh?.userData?.basePosition && clippyIrisMesh?.userData?.baseRotation) {
        const basePosition = clippyIrisMesh.userData.basePosition;
        const baseRotation = clippyIrisMesh.userData.baseRotation;
        clippyIrisMesh.position.set(
            basePosition.x,
            basePosition.y,
            basePosition.z,
        );
        clippyIrisMesh.rotation.set(
            baseRotation.x - offsetY * CLIPPY_EYE_ROTATION_X,
            baseRotation.y + offsetX * CLIPPY_EYE_ROTATION_Y,
            baseRotation.z - offsetX * CLIPPY_EYE_ROTATION_Z,
        );
    }

    let browY = getClippyBrowLift(mode);
    let browRotateX = 0;
    let browRotateZ = 0;
    if (clippyBrowsMesh?.userData?.basePosition) {
        const basePosition = clippyBrowsMesh.userData.basePosition;
        const baseRotation = clippyBrowsMesh.userData.baseRotation;
        const idleWave = Math.sin(time * 1.05) * CLIPPY_BROW_IDLE_LIFT * 0.26;
        const idleTilt = Math.sin(time * 0.9) * CLIPPY_BROW_IDLE_TILT;
        browY += idleWave + (offsetY * CLIPPY_BROW_TRACK_Y);
        browRotateX = -offsetY * CLIPPY_BROW_ROTATION_X + idleTilt * 0.34;
        browRotateZ = -offsetX * CLIPPY_BROW_ROTATION_Z + idleTilt;
        clippyBrowsMesh.position.set(
            basePosition.x,
            basePosition.y,
            basePosition.z + browY,
        );
        if (baseRotation) {
            clippyBrowsMesh.rotation.set(
                baseRotation.x + browRotateX,
                baseRotation.y,
                baseRotation.z + browRotateZ,
            );
        }
    }

    updateClippyFaceState({
        gazeX: offsetX,
        gazeY: offsetY,
        browY,
        browRotateX,
        browRotateZ,
    });
}

function updateClippyGaze(rootAvatar, dt, now) {
    const motionPersona = rootAvatar?.motionPersona || MOTION_PERSONAS.steady;
    const visualMode = rootAvatar ? getVisualMode(rootAvatar, now) : clippyVisualMode;
    const config = getClippyGazeConfig(visualMode, motionPersona);

    if (!clippyIrisMesh?.userData?.basePosition) {
        return;
    }

    if (!config.enabled) {
        clippyGazeState.currentX = config.restX;
        clippyGazeState.currentY = config.restY;
        clippyGazeState.targetX = config.restX;
        clippyGazeState.targetY = config.restY;
        clippyGazeState.timer = randomFromRange(config.timerRange);
        applyClippyGaze(config.restX, config.restY, { mode: visualMode, time: now / 1000 });
        return;
    }

    clippyGazeState.timer -= dt;
    if (clippyGazeState.timer <= 0) {
        if (Math.random() < 0.3) {
            clippyGazeState.targetX = config.restX;
            clippyGazeState.targetY = config.restY;
        } else {
            clippyGazeState.targetX = config.restX + randomFromRange([-config.rangeX, config.rangeX]);
            clippyGazeState.targetY = config.restY + randomFromRange([-config.rangeY, config.rangeY]);
        }
        clippyGazeState.timer = randomFromRange(config.timerRange);
    }

    const ease = 1 - Math.exp(-dt * (1.65 + motionPersona.eyeEase * 0.85));
    clippyGazeState.currentX += (clippyGazeState.targetX - clippyGazeState.currentX) * ease;
    clippyGazeState.currentY += (clippyGazeState.targetY - clippyGazeState.currentY) * ease;
    applyClippyGaze(clippyGazeState.currentX, clippyGazeState.currentY, { mode: visualMode, time: now / 1000 });
}

function updateClippyModel(dt, now) {
    if (!clippyRoot || !isClippyAvatar()) return;

    const time = now / 1000;
    const mode = getClippyAnimationKey();
    const motion = getClippyMotionConfig(mode, time);
    const rootAvatar = avatars.get(ROOT_AGENT_ID);
    applyClippyBlink(1);
    updateClippyGaze(rootAvatar, dt, now);
    const clippyWithSubagents = rootAvatar && [...avatars.values()].some((avatar) => !avatar.isRoot && avatar.inLayout);
    if (clippyWithSubagents) {
        const subagentDrop = CLIPPY_TARGET_HEIGHT * rootAvatar.currentScale * CLIPPY_SUBAGENT_DROP_FACTOR;
        clippyRoot.position.x = rootAvatar.group.position.x;
        clippyRoot.position.y = rootAvatar.group.position.y - subagentDrop;
        clippyRoot.position.z = rootAvatar.group.position.z;
        clippyRoot.rotation.set(motion.rotX, motion.rotY, motion.rotZ);
        clippyRoot.scale.setScalar(clippyBaseScale * rootAvatar.currentScale * motion.scale);
        updateClippyInnerClipDeform(dt, time);

        if (clippyMixer) {
            clippyMixer.timeScale = motion.timeScale;
            clippyMixer.update(dt);
        }
        return;
    }

    clippyRoot.position.x = 0;
    clippyRoot.position.y = clippyBaseY + motion.bobY;
    clippyRoot.position.z = 0;
    clippyRoot.rotation.set(motion.rotX, motion.rotY, motion.rotZ);
    clippyRoot.scale.setScalar(clippyBaseScale * motion.scale);
    updateClippyInnerClipDeform(dt, time);

    if (clippyMixer) {
        clippyMixer.timeScale = motion.timeScale;
        clippyMixer.update(dt);
    }
}

function setVoxtralRefAudio(dataUrl, { rememberForClippy = isClippyAvatar(), save = true } = {}) {
    voxtralRefAudio = dataUrl || null;
    if (rememberForClippy) {
        clippyRefAudio = voxtralRefAudio;
    }

    if (voxtralRefAudio) {
        voxtralAudioPreview.src = voxtralRefAudio;
        voxtralAudioPreview.classList.remove('hidden');
        voxtralRerecordBtn.classList.remove('hidden');
        voxtralRecordBtn.classList.add('hidden');
    } else {
        voxtralAudioPreview.removeAttribute('src');
        voxtralAudioPreview.classList.add('hidden');
        voxtralRerecordBtn.classList.add('hidden');
        voxtralRecordBtn.classList.remove('hidden', 'recording');
    }

    updateElevenLabsCloneUI();
    updateVoicePreviewButtons();
    if (save) saveTtsSettings();
}

function getActiveReferenceAudio({ clippy = isClippyAvatar() } = {}) {
    return clippy ? (clippyRefAudio || voxtralRefAudio) : voxtralRefAudio;
}

function getElevenLabsCloneState({ clippy = false } = {}) {
    if (clippy) {
        return {
            voiceId: clippyElevenlabsVoiceId,
            voiceName: clippyElevenlabsVoiceName,
            sourceHash: clippyElevenlabsCloneSourceHash,
        };
    }
    return {
        voiceId: elevenlabsClonedVoiceId,
        voiceName: elevenlabsClonedVoiceName,
        sourceHash: elevenlabsCloneSourceHash,
    };
}

function setElevenLabsCloneState(
    { voiceId = '', voiceName = '', sourceHash = '' } = {},
    { clippy = false, save = true } = {},
) {
    if (clippy) {
        clippyElevenlabsVoiceId = voiceId;
        clippyElevenlabsVoiceName = voiceName;
        clippyElevenlabsCloneSourceHash = sourceHash;
    } else {
        elevenlabsClonedVoiceId = voiceId;
        elevenlabsClonedVoiceName = voiceName;
        elevenlabsCloneSourceHash = sourceHash;
    }
    updateElevenLabsCloneUI();
    updateVoicePreviewButtons();
    if (save) saveTtsSettings();
}

function getActiveElevenLabsVoiceId({ clippy = false } = {}) {
    return elevenlabsVoice;
}

function setElevenLabsCloneStatus(message = '') {
    const text = String(message || '').trim();
    elevenlabsCloneStatus.textContent = text;
    elevenlabsCloneStatus.classList.toggle('hidden', !text);
}

function setSettingsTab(tab) {
    activeSettingsTab = tab === 'speech' ? 'speech' : 'general';
    const showingSpeech = activeSettingsTab === 'speech';
    settingsGeneralTabBtn.classList.toggle('active', !showingSpeech);
    settingsGeneralTabBtn.setAttribute('aria-selected', String(!showingSpeech));
    settingsSpeechTabBtn.classList.toggle('active', showingSpeech);
    settingsSpeechTabBtn.setAttribute('aria-selected', String(showingSpeech));
    settingsGeneralPanel.classList.toggle('hidden', showingSpeech);
    settingsSpeechPanel.classList.toggle('hidden', !showingSpeech);
}

function beginSpeechRequest() {
    speechRequestId += 1;
    return speechRequestId;
}

function isCurrentSpeechRequest(requestId) {
    return requestId === speechRequestId;
}

function stopGeneratedSpeechPlayback() {
    if (ttsAudioPlayer) {
        ttsAudioPlayer.pause();
        ttsAudioPlayer = null;
    }
    releaseGeneratedAudioUrl();
}

function getVoicePreviewText() {
    return isClippyAvatar()
        ? "It looks like this voice is ready to help."
        : "Hello! This is a preview of the selected voice.";
}

function canPreviewCurrentVoice(engine = ttsEngine) {
    if (engine === 'webspeech') {
        return ttsVoiceSelect.options.length > 0;
    }
    if (engine === 'voxtral') {
        if (voxtralVoiceSource === 'myvoice') {
            return !!getActiveReferenceAudio({ clippy: isClippyAvatar() });
        }
        return !!voxtralVoiceSelect.value;
    }
    if (engine === 'elevenlabs') {
        return !!elevenlabsApiKey && !!elevenlabsVoiceSelect.value;
    }
    if (engine === 'sam') {
        return samVoiceSelect.options.length > 0;
    }
    return false;
}

function updateVoicePreviewButtons() {
    const webspeechReady = canPreviewCurrentVoice('webspeech');
    const aiReady = canPreviewCurrentVoice(ttsEngine);
    const busyLabel = voicePreviewBusy ? 'Testing...' : 'Test selected voice';
    ttsWebspeechTestBtn.textContent = busyLabel;
    ttsAiTestBtn.textContent = busyLabel;
    ttsSamTestBtn.textContent = busyLabel;
    ttsWebspeechTestBtn.disabled = voicePreviewBusy || !webspeechReady;
    ttsAiTestBtn.disabled = voicePreviewBusy || !aiReady;
    ttsSamTestBtn.disabled = voicePreviewBusy || !canPreviewCurrentVoice('sam');
}

async function previewCurrentVoice(engine = ttsEngine) {
    if (!canPreviewCurrentVoice(engine)) {
        return false;
    }

    voicePreviewBusy = true;
    updateVoicePreviewButtons();
    stopAllSpeech();
    const text = getVoicePreviewText();
    const clippy = isClippyAvatar();

    try {
        if (engine === 'webspeech') {
            speakWebSpeech(text, { clippy });
            return true;
        }
        if (engine === 'voxtral') {
            await speakVoxtral(text, { clippy });
            return true;
        }
        if (engine === 'elevenlabs') {
            await speakElevenLabs(text, { clippy });
            return true;
        }
        if (engine === 'sam') {
            await speakSam(text, { clippy });
            return true;
        }
        return false;
    } finally {
        voicePreviewBusy = false;
        updateVoicePreviewButtons();
    }
}

function updateElevenLabsCloneUI() {
    elevenlabsCloneControls.classList.add('hidden');
    elevenlabsDeleteBtn.classList.add('hidden');
    elevenlabsCloneBtn.disabled = true;
    elevenlabsDeleteBtn.disabled = true;
    setElevenLabsCloneStatus('');
    updateVoicePreviewButtons();
}

function applyAvatarStyle({ enforceVoiceDefaults = false } = {}) {
    document.body.classList.toggle('avatar-clippy', isClippyAvatar());
    avatarStyleSelect.value = avatarStyle;
    updateSceneModeVisibility();
    updateCamera();
    if (!isClippyAvatar()) {
        applyClippyBlink(1);
        applyClippyGaze(0, 0);
        setClippySpeaking(false);
        updateClippyVisual('idle');
        return;
    }

    if (enforceVoiceDefaults) {
        ttsEnabled = true;
        ttsEngineSelect.value = ttsEngine;
        if (ttsEngine === 'voxtral') {
            voxtralVoice = clippyVoxtralVoice || CLIPPY_DEFAULT_VOXTRAL_VOICE;
            voxtralVoiceSource = 'myvoice';
            setRadioGroupValue('ai-voice-source', voxtralVoiceSource);
            if (clippyRefAudio) {
                setVoxtralRefAudio(clippyRefAudio, { rememberForClippy: false, save: false });
            } else if (voxtralRefAudio) {
                clippyRefAudio = voxtralRefAudio;
            }
        }
    }

    updateTtsButton();
    updateEngineUI();
    updateVoicePreviewButtons();
}

function updateMessageVisibility() {
    messageContainerEl.classList.toggle('hidden', !showSpokenText);
    messageVisibilityToggle.checked = showSpokenText;
    if (!showSpokenText) {
        clearMessageOverlay();
    }
}

function updateWindowTransparency() {
    document.body.classList.toggle('window-transparent', transparentWindow);
    transparentWindowToggle.checked = transparentWindow;
}


function createBaseAsset(modelScene) {
    if (!modelScene) {
        return {
            sourceScene: null,
            size: new THREE.Vector3(1, 1, 1),
            maxDim: 1,
            eyeY: 0,
            eyeZ: 0.5,
            eyeSpacing: 0.15,
            heartScale: 0.1,
            overlayOffset: new THREE.Vector3(0, -0.35, 0.3),
            bubbleOffset: new THREE.Vector3(0.2, 0.16, 0.45),
            readingBeamY: 0,
            readingBeamZ: 0.56,
            readingBeamHeight: 0.78,
            readingBeamWidth: 0.18,
            thinkingCenterY: 0.34,
            thinkingOrbitRadius: 0.12,
            thinkingDotSize: 0.05,
            rowSpacing: 0.9,
            rootY: 0.55,
            subY: -0.8,
        };
    }

    const centeredScene = SkeletonUtils.clone(modelScene);
    const box = new THREE.Box3().setFromObject(centeredScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    centeredScene.position.sub(center);

    return {
        sourceScene: centeredScene,
        size,
        maxDim: Math.max(size.x, size.y, size.z),
        eyeY: size.y * 0.28,
        eyeZ: size.z * 0.39,
        eyeSpacing: size.x * 0.11,
        heartScale: 0.1,
        overlayOffset: new THREE.Vector3(0, -size.y * 0.58, size.z * 0.14),
        bubbleOffset: new THREE.Vector3(size.x * 0.18, size.y * 0.36, size.z * 0.42),
        readingBeamY: size.y * 0.2,
        readingBeamZ: size.z * 0.5,
        readingBeamHeight: size.y * 0.8,
        readingBeamWidth: Math.max(size.x * 0.18, 0.12),
        thinkingCenterY: size.y * 0.54,
        thinkingOrbitRadius: Math.max(size.x * 0.19, 0.11),
        thinkingDotSize: Math.max(size.x * 0.07, 0.045),
        rowSpacing: Math.max(size.x * 0.78, 0.72),
        rootY: size.y * 0.6,
        subY: -size.y * 0.9,
    };
}

function createDuckBeakAsset(modelScene) {
    if (!modelScene) return null;

    const toFloatAttribute = (attribute) => {
        if (!attribute || !('count' in attribute) || !attribute.itemSize) return attribute;
        if (attribute.array instanceof Float32Array && !attribute.normalized) return attribute;

        const values = new Float32Array(attribute.count * attribute.itemSize);
        for (let i = 0; i < attribute.count; i++) {
            const base = i * attribute.itemSize;
            values[base] = attribute.getX(i);
            if (attribute.itemSize > 1) values[base + 1] = attribute.getY(i);
            if (attribute.itemSize > 2) values[base + 2] = attribute.getZ(i);
            if (attribute.itemSize > 3) values[base + 3] = attribute.getW(i);
        }

        return new THREE.BufferAttribute(values, attribute.itemSize, false);
    };

    const dequantizeGeometry = (geometry) => {
        const position = geometry.getAttribute('position');
        if (position) geometry.setAttribute('position', toFloatAttribute(position));

        const normal = geometry.getAttribute('normal');
        if (normal) geometry.setAttribute('normal', toFloatAttribute(normal));

        const uv = geometry.getAttribute('uv');
        if (uv) geometry.setAttribute('uv', toFloatAttribute(uv));
    };

    const geometries = [];
    const box = new THREE.Box3();
    const partBox = new THREE.Box3();

    modelScene.updateWorldMatrix(true, true);
    modelScene.traverse((node) => {
        if (!node.isMesh || !node.geometry) return;

        const geometry = node.geometry.clone();
        dequantizeGeometry(geometry);
        geometry.applyMatrix4(node.matrixWorld);
        geometry.computeBoundingBox();
        if (!geometry.boundingBox) {
            geometry.dispose();
            return;
        }

        geometries.push(geometry);
        partBox.copy(geometry.boundingBox);
        box.union(partBox);
    });

    if (!geometries.length || box.isEmpty()) return null;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (!Number.isFinite(maxDim) || maxDim <= 0) return null;

    const translate = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -box.min.z);
    const scale = new THREE.Matrix4().makeScale(1 / maxDim, 1 / maxDim, 1 / maxDim);

    for (const geometry of geometries) {
        geometry.applyMatrix4(translate);
        geometry.applyMatrix4(scale);
        if (!geometry.getAttribute('normal')) {
            geometry.computeVertexNormals();
        }
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
    }

    return {
        geometries,
        size,
        maxDim,
    };
}

function createOverlay(agentId) {
    const labelEl = document.createElement('div');
    labelEl.className = 'subagent-label';
    labelEl.dataset.agentId = agentId;

    const headerEl = document.createElement('div');
    headerEl.className = 'agent-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'agent-name';

    const roleEl = document.createElement('span');
    roleEl.className = 'agent-role';

    const modelEl = document.createElement('span');
    modelEl.className = 'agent-model';

    const badgeEl = document.createElement('span');
    badgeEl.className = 'agent-badge idle';

    const badgeIconEl = document.createElement('span');
    badgeIconEl.className = 'agent-badge-icon';

    const badgeTextEl = document.createElement('span');
    badgeTextEl.className = 'agent-badge-text';

    const detailEl = document.createElement('div');
    detailEl.className = 'agent-detail';

    headerEl.append(nameEl, roleEl);
    badgeEl.append(badgeIconEl, badgeTextEl);
    labelEl.append(headerEl, modelEl, badgeEl, detailEl);
    overlayContainer.appendChild(labelEl);

    return { labelEl, headerEl, nameEl, roleEl, modelEl, badgeEl, badgeIconEl, badgeTextEl, detailEl };
}

function cleanAgentLabel(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeAgentLabel(value) {
    return cleanAgentLabel(value)
        .replace(/[_-]+/g, ' ')
        .toLowerCase();
}

function isPlaceholderAgentLabel(value) {
    const normalized = normalizeAgentLabel(value);
    return !!normalized && GENERIC_AGENT_LABELS.has(normalized);
}

function defaultDisplayName(agentId) {
    if (!agentId) return 'Agent';
    return agentId.length > 12 ? `agent-${agentId.slice(0, 6)}` : agentId;
}

function isLowConfidenceDisplayName(value, agentId) {
    const normalized = normalizeAgentLabel(value);
    if (!normalized) return false;

    if (isPlaceholderAgentLabel(value)) {
        return true;
    }

    const normalizedAgentId = normalizeAgentLabel(agentId);
    if (normalizedAgentId && normalized === normalizedAgentId) {
        return true;
    }

    const fallbackLabel = normalizeAgentLabel(defaultDisplayName(agentId));
    return !!fallbackLabel && normalized === fallbackLabel;
}

function getDisplayIdentityCandidate(agentId, value, source = 'fallback') {
    const label = cleanAgentLabel(value);
    if (!label) return null;

    const strong = !isLowConfidenceDisplayName(label, agentId);
    const normalizedSource = source === 'displayName' || source === 'agentName' ? source : 'fallback';
    const rank = strong
        ? normalizedSource === 'displayName'
            ? 4
            : normalizedSource === 'agentName'
                ? 3
                : 2
        : 1;

    return { label, source: normalizedSource, rank };
}

function resolveAvatarDisplayIdentity(agentId, data = {}, currentDisplayName = '', currentSource = 'fallback') {
    const candidates = [
        getDisplayIdentityCandidate(agentId, data.displayName, 'displayName'),
        getDisplayIdentityCandidate(agentId, data.agentName, 'agentName'),
        getDisplayIdentityCandidate(agentId, currentDisplayName, currentSource),
    ].filter(Boolean);

    if (!candidates.length) {
        return {
            displayName: defaultDisplayName(agentId),
            displayNameSource: 'fallback',
        };
    }

    const best = candidates.reduce((selected, candidate) => {
        if (!selected || candidate.rank > selected.rank) {
            return candidate;
        }
        return selected;
    }, null);

    return {
        displayName: best?.label || defaultDisplayName(agentId),
        displayNameSource: best?.source || 'fallback',
    };
}

function isDuckAgent(data = {}) {
    if (data.isDuck === true) return true;

    const text = [
        data.agentId,
        data.agentName,
        data.displayName,
        data.description,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return text.includes('rubber-duck')
        || text.includes('rubber duck')
        || text.includes('rubberducky')
        || text.includes('duck');
}

function formatModelLabel(model) {
    const value = String(model || '').trim();
    if (!value) return '';

    if (/^gpt-/i.test(value)) {
        return `GPT-${value.slice(4)}`
            .replace(/-mini\b/ig, ' mini')
            .replace(/-codex\b/ig, ' codex');
    }

    if (/^claude-/i.test(value)) {
        return `Claude ${value.slice(7).replace(/-/g, ' ')}`;
    }

    return value.replace(/-/g, ' ');
}

function updateAvatarModelDisplay(avatar) {
    if (!avatar?.overlay?.modelEl) return;

    avatar.overlay.modelEl.textContent = avatar.modelLabel || '';
    avatar.overlay.modelEl.classList.toggle('visible', showAvatarBadges && !!avatar.modelLabel);
}

function getLatestToolEntry(avatar) {
    if (!avatar?.activeTools?.size) return null;

    let latest = null;
    for (const entry of avatar.activeTools.values()) {
        if (!latest || entry.startedAt > latest.startedAt) {
            latest = entry;
        }
    }
    return latest;
}

function hasWorkToolEntry(entry) {
    return !!entry && !!entry.activity && entry.activity !== 'idle';
}

function getToolActivityKey(payload = {}) {
    if (payload.toolCallId) return payload.toolCallId;
    const toolName = String(payload.toolName || '').trim().toLowerCase() || 'tool';
    return `anonymous:${toolName}`;
}

function clearAvatarToolActivity(avatar, payload = {}) {
    if (!avatar?.activeTools?.size) return;

    if (payload.toolCallId && avatar.activeTools.has(payload.toolCallId)) {
        avatar.activeTools.delete(payload.toolCallId);
        return;
    }

    const toolName = String(payload.toolName || '').trim();
    const anonymousKey = getToolActivityKey(payload);
    for (const [key, value] of avatar.activeTools.entries()) {
        if ((toolName && value.toolName === toolName) || key === anonymousKey) {
            avatar.activeTools.delete(key);
        }
    }
}

function clearRootTransientActivity({ clearIntent = false } = {}) {
    const rootAvatar = avatars.get(ROOT_AGENT_ID);
    if (!rootAvatar) return;

    rootAvatar.activeTools.clear();
    rootAvatar.thinkingUntil = 0;
    rootAvatar.effectState = 'idle';
    if (clearIntent) {
        rootAvatar.intentText = '';
        rootAvatar.intentUntil = 0;
    }
}

function getRootBadgeToolLabel() {
    const rootAvatar = avatars.get(ROOT_AGENT_ID);
    const latestTool = getLatestToolEntry(rootAvatar);
    return latestTool?.activityLabel || formatToolLabel(latestTool?.toolName || '');
}

function updateSubtaskDisplay() {
    const fallbackText = activeSubtaskText || (rootWorking ? '' : idleSubtaskText);
    const rootAvatar = avatars.get(ROOT_AGENT_ID);
    const rootBadgeVisible = showAvatarBadges && !!rootAvatar;
    const rootToolLabel = getRootBadgeToolLabel();

    subtasksEl.textContent = rootBadgeVisible && fallbackText && rootToolLabel && fallbackText === rootToolLabel
        ? ''
        : fallbackText;
}

function updateRootModelIndicator() {
    const rootAvatar = avatars.get(ROOT_AGENT_ID);
    const visible = showAvatarBadges && !!rootAvatar;
    const showModelLine = visible && showModelBadges && !!rootAvatar?.modelLabel;
    const activity = rootAvatar ? getResolvedActivity(rootAvatar) : 'idle';
    const toolLabel = rootAvatar ? getRootBadgeToolLabel() : '';
    const badge = ACTIVITY_BADGES[activity] || ACTIVITY_BADGES.idle;
    const roleStyle = rootAvatar?.roleStyle || ROLE_STYLES.copilot;
    const badgeText = toolLabel
        || (rootAvatar?.intentText && rootAvatar.intentUntil > performance.now() ? rootAvatar.intentText : badge.text);

    rootModelEl.className = 'subagent-label';
    rootModelEl.classList.toggle('visible', visible);
    applyOverlayRoleStyle(rootModelEl, rootModelNameEl, roleStyle);
    rootModelNameEl.textContent = rootAvatar?.displayName || 'Copilot';
    rootModelModelEl.textContent = showModelLine ? rootAvatar.modelLabel : '';
    rootModelModelEl.classList.toggle('visible', showModelLine);
    rootModelBadgeEl.className = `agent-badge ${activity}`;
    rootModelBadgeIconEl.textContent = activity === 'idle'
        ? rootAvatar?.isDuck
            ? '🦆'
            : roleStyle.icon || badge.icon
        : badge.icon;
    rootModelBadgeTextEl.textContent = badgeText;
    rootModelEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
    rootModelEl.style.opacity = visible ? '1' : '0';
}

function setRootModelPosition() {
    const rootAvatar = avatars.get(ROOT_AGENT_ID);
    if (!showAvatarBadges || !rootAvatar) {
        rootModelEl.classList.remove('visible');
        rootModelEl.style.opacity = '0';
        return;
    }

    rootAvatar.group.updateWorldMatrix(true, true);
    rootAvatar.group.localToWorld(worldVector.set(0, -baseAsset.size.y * 0.58, 0));
    overlayVector.copy(worldVector).project(camera);

    const onScreen = overlayVector.z > -1 && overlayVector.z < 1
        && overlayVector.x > -1.45 && overlayVector.x < 1.45
        && overlayVector.y > -1.45 && overlayVector.y < 1.45
        && rootAvatar.presence > 0.05;

    if (!onScreen) {
        rootModelEl.classList.remove('visible');
        rootModelEl.style.opacity = '0';
        return;
    }

    const scale = layoutState.overlayScale * 1.02;
    const rawX = (overlayVector.x * 0.5 + 0.5) * container.clientWidth;
    const rawY = (-overlayVector.y * 0.5 + 0.5) * container.clientHeight + 10;
    const labelWidth = (rootModelEl.offsetWidth || 120) * scale;
    const labelHeight = (rootModelEl.offsetHeight || 22) * scale;
    const minX = labelWidth * 0.5 + 8;
    const maxX = container.clientWidth - labelWidth * 0.5 - 8;
    const minY = 8;
    const maxY = container.clientHeight - labelHeight - 10;
    const clampedX = THREE.MathUtils.clamp(rawX, Math.min(minX, maxX), Math.max(minX, maxX));
    const clampedY = THREE.MathUtils.clamp(rawY, Math.min(minY, maxY), Math.max(minY, maxY));
    rootModelEl.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0) translate(-50%, 0) scale(${scale})`;
    rootModelEl.classList.add('visible');
    rootModelEl.style.opacity = `${Math.max(0, Math.min(1, rootAvatar.presence))}`;
}

function updateBadgeVisibility() {
    badgeVisibilityToggle.checked = showAvatarBadges;
    modelVisibilityToggle.checked = showModelBadges;
    for (const avatar of avatars.values()) {
        updateAvatarModelDisplay(avatar);
        updateAvatarBadge(avatar);
    }
    updateRootModelIndicator();
    updateSubtaskDisplay();
}

function applyAvatarModel(avatar, model) {
    const modelName = String(model || '').trim();
    const modelLabel = formatModelLabel(modelName);
    if (!modelLabel) return;

    avatar.modelName = modelName;
    avatar.modelLabel = modelLabel;
    updateAvatarModelDisplay(avatar);

    if (avatar.isRoot) {
        updateRootModelIndicator();
        updateSubtaskDisplay();
    }
}

function updateRootSquadMicBoom(avatar = avatars.get(ROOT_AGENT_ID)) {
    if (!avatar?.isRoot || !avatar.squadMicBoom) {
        window.__copilotAvatarState = {
            ...(window.__copilotAvatarState || {}),
            rootAvatarReady: !!avatars.get(ROOT_AGENT_ID),
            squadRootMicActive,
            rootMicVisible: false,
        };
        return;
    }

    avatar.squadMicBoom.visible = squadRootMicActive;
    window.__copilotAvatarState = {
        ...(window.__copilotAvatarState || {}),
        rootAvatarReady: true,
        squadRootMicActive,
        rootMicVisible: !!avatar.squadMicBoom.visible,
    };
}

function createAvatarInstance(agentId, data = {}) {
    const isRoot = agentId === ROOT_AGENT_ID;
    const group = new THREE.Group();
    const modelRoot = baseAsset.sourceScene ? SkeletonUtils.clone(baseAsset.sourceScene) : new THREE.Group();
    const headMaterials = cloneAvatarHeadMaterials(modelRoot);
    group.add(modelRoot);

    const eyeMatL = createEyeMaterial();
    const eyeMatR = createEyeMaterial();
    const eyeL = new THREE.Mesh(eyeGeometry, eyeMatL);
    const eyeR = new THREE.Mesh(eyeGeometry, eyeMatR);
    eyeL.renderOrder = 2;
    eyeR.renderOrder = 2;

    const heartEyeL = createHeartEye();
    const heartEyeR = createHeartEye();
    heartEyeL.rotation.z = Math.PI - 0.16;
    heartEyeR.rotation.z = Math.PI + 0.16;
    const duckBeak = createDuckBeak();
    const duckRipple = createDuckRipple();
    const squadMicBoom = isRoot ? createSquadMicBoom() : null;

    const raccoonMask = new THREE.Mesh(maskGeometry, new THREE.MeshBasicMaterial({
        color: 0x05070c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
    }));
    raccoonMask.visible = false;
    raccoonMask.renderOrder = 1;

    raccoonMask.scale.set(baseAsset.size.x * 0.44, baseAsset.size.y * 0.13, 1);
    raccoonMask.position.set(0, baseAsset.eyeY, baseAsset.eyeZ - 0.01);
    eyeL.position.set(-baseAsset.eyeSpacing, baseAsset.eyeY, baseAsset.eyeZ);
    eyeR.position.set(baseAsset.eyeSpacing, baseAsset.eyeY, baseAsset.eyeZ);
    placeHeartEye(heartEyeL, -baseAsset.eyeSpacing * 0.98, baseAsset.eyeY, baseAsset.eyeZ, baseAsset.heartScale);
    placeHeartEye(heartEyeR, baseAsset.eyeSpacing * 0.98, baseAsset.eyeY, baseAsset.eyeZ, baseAsset.heartScale);
    positionDuckBeak(duckBeak);
    duckRipple.position.set(0, -baseAsset.size.y * 0.54, baseAsset.size.z * 0.02);
    duckRipple.scale.set(baseAsset.size.x * 0.42, baseAsset.size.x * 0.42, 1);
    duckRipple.userData.baseScale = duckRipple.scale.clone();
    modelRoot.add(duckRipple, raccoonMask, eyeL, eyeR, heartEyeL, heartEyeR, duckBeak);
    if (squadMicBoom) {
        modelRoot.add(squadMicBoom);
    }
    const writingGlyphs = createWritingGlyphs();
    for (const glyph of writingGlyphs) {
        modelRoot.add(glyph.sprite);
    }
    const activityEffects = createActivityEffects();
    activityEffects.readingBeam.position.set(0, baseAsset.readingBeamY, baseAsset.readingBeamZ);
    activityEffects.readingBeam.scale.set(baseAsset.readingBeamWidth, baseAsset.readingBeamHeight, 1);
    modelRoot.add(activityEffects.readingBeam);
    for (const dot of activityEffects.thinkingDots) {
        modelRoot.add(dot.sprite);
    }

    const overlay = isRoot ? null : createOverlay(agentId);
    const targetPosition = new THREE.Vector3(0, isRoot ? baseAsset.rootY : baseAsset.subY, 0);
    const currentPosition = targetPosition.clone();
    const baseScale = isRoot ? ROOT_SCALE : SUBAGENT_SCALE;
    const currentEyeColor = ACTIVITY_COLORS.idle.clone();

    const displayIdentity = resolveAvatarDisplayIdentity(agentId, data);
    const avatar = {
        agentId,
        agentName: data.agentName || '',
        displayName: displayIdentity.displayName,
        displayNameSource: displayIdentity.displayNameSource,
        description: data.description || '',
        workDescription: cleanAgentLabel(data.workDescription || data.detailText || data.taskSummary || ''),
        detailText: cleanAgentLabel(data.detailText || data.taskSummary || ''),
        taskSummary: cleanAgentLabel(data.taskSummary || ''),
        role: data.role || '',
        modelName: '',
        modelLabel: '',
        isDuck: isDuckAgent({ agentId, ...data }),
        roleStyle: getRoleStyle(data),
        motionPersona: getMotionPersona({ ...data, agentId, isRoot }),
        isRoot,
        group,
        modelRoot,
        headMaterials,
        eyeL,
        eyeR,
        eyeMatL,
        eyeMatR,
        heartEyeL,
        heartEyeR,
        duckBeak,
        duckRipple,
        squadMicBoom,
        raccoonMask,
        writingGlyphs,
        activityEffects,
        overlay,
        activeTools: new Map(),
        thinkingUntil: 0,
        intentText: '',
        intentUntil: 0,
        expressionName: 'default',
        expressionUntil: 0,
        effectState: 'idle',
        leaveAt: 0,
        leaving: false,
        inLayout: !isRoot,
        createdAt: performance.now(),
        targetPosition,
        currentPosition,
        baseScale,
        currentScale: isRoot ? baseScale : 0.01,
        targetPresence: 1,
        presence: isRoot ? 1 : 0.01,
        scalePulseUntil: 0,
        flashUntil: 0,
        shakeUntil: 0,
        happyBlinkUntil: 0,
        currentEyeColor,
        currentEyeMode: 0,
        currentEyeScaleX: 1,
        currentEyeScaleY: 1,
        currentHeartPulse: 1,
        currentMaskOpacity: 0,
        currentDuckRippleOpacity: 0,
        currentBobY: 0,
        currentRotX: 0,
        currentRotY: 0,
        currentRotZ: 0,
        currentWritingFx: 0,
        currentReadingFx: 0,
        currentThinkingFx: 0,
        anim: {
            idleTime: 0,
            blinkTimer: randomFromRange((getMotionPersona({ ...data, agentId, isRoot })).blinkInterval),
            winkTimer: randomFromRange((getMotionPersona({ ...data, agentId, isRoot })).winkInterval),
            isBlinking: false,
            isWinking: false,
            blinkProgress: 0,
            blinkPhase: 0,
            targetRotX: 0,
            targetRotY: 0,
            wanderTimer: randomFromRange((getMotionPersona({ ...data, agentId, isRoot })).wanderInterval),
        },
    };

    scene.add(group);
    avatars.set(agentId, avatar);
    updateAvatarMetadata(avatar, data);
    if (data.model) {
        applyAvatarModel(avatar, data.model);
    }
    updateAvatarBadge(avatar);
    return avatar;
}

function disposeAvatar(avatar) {
    scene.remove(avatar.group);

    for (const entry of avatar.headMaterials || []) {
        entry.material.dispose();
    }
    avatar.eyeMatL.dispose();
    avatar.eyeMatR.dispose();
    avatar.raccoonMask.material.dispose();
    avatar.heartEyeL.userData.glow.material.dispose();
    avatar.heartEyeL.userData.core.material.dispose();
    avatar.heartEyeR.userData.glow.material.dispose();
    avatar.heartEyeR.userData.core.material.dispose();
    disposeDuckBeak(avatar.duckBeak);
    avatar.duckRipple.material.dispose();
    disposeSquadMicBoom(avatar.squadMicBoom);
    for (const glyph of avatar.writingGlyphs) {
        glyph.material.dispose();
    }
    avatar.activityEffects.readingBeam.geometry.dispose();
    avatar.activityEffects.readingBeamMaterial.dispose();
    for (const dot of avatar.activityEffects.thinkingDots) {
        dot.material.dispose();
    }

    if (avatar.overlay) {
        avatar.overlay.labelEl.remove();
    }
}

function updateAvatarMetadata(avatar, data = {}) {
    const wasDuck = avatar.isDuck;
    const hasWorkDescription = Object.prototype.hasOwnProperty.call(data, 'workDescription');
    const hasDetailText = Object.prototype.hasOwnProperty.call(data, 'detailText');
    const hasTaskSummary = Object.prototype.hasOwnProperty.call(data, 'taskSummary');

    if (data.agentName) avatar.agentName = data.agentName;
    const displayIdentity = resolveAvatarDisplayIdentity(avatar.agentId, {
        ...data,
        agentName: data.agentName || avatar.agentName,
    }, avatar.displayName, avatar.displayNameSource);
    avatar.displayName = displayIdentity.displayName;
    avatar.displayNameSource = displayIdentity.displayNameSource;
    if (data.description) avatar.description = data.description;
    if (hasWorkDescription) avatar.workDescription = cleanAgentLabel(data.workDescription);
    if (hasDetailText) avatar.detailText = cleanAgentLabel(data.detailText);
    if (hasTaskSummary) avatar.taskSummary = cleanAgentLabel(data.taskSummary);
    if (data.role) avatar.role = data.role;
    avatar.isDuck = avatar.isDuck || isDuckAgent({
        isDuck: data.isDuck,
        agentId: avatar.agentId,
        agentName: data.agentName || avatar.agentName,
        displayName: data.displayName || avatar.displayName,
        description: data.description || avatar.description,
    });
    avatar.roleStyle = getRoleStyle(avatar);
    applyMotionPersona(avatar);
    applyRoleHeadTint(avatar);

    if (!avatar.displayName) {
        avatar.displayName = defaultDisplayName(avatar.agentId);
    }

    if (avatar.overlay) {
        avatar.overlay.nameEl.textContent = avatar.displayName;
        avatar.overlay.roleEl.textContent = avatar.role;
        avatar.overlay.roleEl.classList.toggle('visible', !!avatar.role);
        avatar.overlay.roleEl.title = avatar.role || '';
        applyRoleStyle(avatar);
        updateAvatarModelDisplay(avatar);
        updateAvatarBadge(avatar);
    }

    if (avatar.isDuck && (!wasDuck || !avatar.duckBeak?.userData.isImported) && duckBeakAsset?.geometries?.length) {
        replaceAvatarDuckBeak(avatar);
    }

    avatar.duckBeak.visible = avatar.isDuck;
    avatar.duckRipple.visible = false;

    if (avatar.isRoot) {
        updateRootSquadMicBoom(avatar);
        updateRootModelIndicator();
    }
}

function consumePendingSubagent(payload = {}) {
    if (!pendingSubagents.length) return payload;

    const index = payload.toolCallId
        ? pendingSubagents.findIndex((item) => item.toolCallId && item.toolCallId === payload.toolCallId)
        : 0;
    const pending = index >= 0 ? pendingSubagents.splice(index, 1)[0] : pendingSubagents.shift();
    return { ...pending, ...payload };
}

function queuePendingAgentActivity(agentId, payload = {}) {
    if (!agentId) return;
    const key = getToolActivityKey(payload);
    const pending = pendingAgentActivities.get(agentId) || new Map();
    const existing = pending.get(key);
    pending.set(key, {
        ...payload,
        startedAt: existing?.startedAt ?? performance.now(),
    });
    pendingAgentActivities.set(agentId, pending);
}

function clearPendingAgentActivity(agentId, payload = {}) {
    if (!agentId || !pendingAgentActivities.has(agentId)) return;
    const pending = pendingAgentActivities.get(agentId);

    if (payload.toolCallId && pending.has(payload.toolCallId)) {
        pending.delete(payload.toolCallId);
    } else {
        const toolName = String(payload.toolName || '').trim();
        const anonymousKey = getToolActivityKey(payload);
        for (const [key, value] of pending.entries()) {
            if ((toolName && value.toolName === toolName) || key === anonymousKey) {
                pending.delete(key);
            }
        }
    }

    if (!pending.size) {
        pendingAgentActivities.delete(agentId);
    }
}

function clearPendingAgentState(agentId, { preserveModel = false } = {}) {
    if (!agentId || agentId === ROOT_AGENT_ID) return;
    if (!preserveModel) {
        pendingAgentModels.delete(agentId);
    }
    pendingAgentActivities.delete(agentId);
    pendingAgentIntents.delete(agentId);
    pendingAgentThinking.delete(agentId);
}

function hasStrongAgentIdentity(agentId, payload = {}) {
    const displayName = cleanAgentLabel(payload.displayName || '');
    if (displayName && !isLowConfidenceDisplayName(displayName, agentId)) {
        return true;
    }

    const agentName = cleanAgentLabel(payload.agentName || '');
    if (agentName && !isLowConfidenceDisplayName(agentName, agentId)) {
        return true;
    }

    return false;
}

function applyPendingAgentState(avatar) {
    if (!avatar || avatar.isRoot) return;

    const pendingIntent = pendingAgentIntents.get(avatar.agentId);
    if (pendingIntent) {
        avatar.intentText = pendingIntent.intent || '';
        avatar.intentUntil = performance.now() + INTENT_HOLD_MS;
        pendingAgentIntents.delete(avatar.agentId);
    }

    if (pendingAgentThinking.has(avatar.agentId)) {
        avatar.thinkingUntil = performance.now() + THINKING_HOLD_MS;
        pendingAgentThinking.delete(avatar.agentId);
    }

    const pendingActivities = pendingAgentActivities.get(avatar.agentId);
    if (pendingActivities?.size) {
        for (const pending of pendingActivities.values()) {
            const key = getToolActivityKey(pending);
            avatar.activeTools.set(key, {
                toolName: pending.toolName || '',
                activityLabel: pending.activityLabel || describeToolActivity(pending.toolName || '') || formatToolLabel(pending.toolName || ''),
                explicitActivityLabel: !!pending.activityLabel,
                activity: classifyTool(pending.toolName || ''),
                startedAt: pending.startedAt ?? performance.now(),
            });
        }
        avatar.effectState = 'idle';
        pendingAgentActivities.delete(avatar.agentId);
    }
}

function ensureAvatar(agentId, payload = {}) {
    const resolvedId = agentId || ROOT_AGENT_ID;
    if (avatars.has(resolvedId)) {
        const avatar = avatars.get(resolvedId);
        updateAvatarMetadata(avatar, payload);
        if (payload.model) {
            applyAvatarModel(avatar, payload.model);
        }
        updateAvatarBadge(avatar);
        return avatar;
    }

    const data = resolvedId === ROOT_AGENT_ID ? payload : consumePendingSubagent(payload);
    const avatar = createAvatarInstance(resolvedId, data);
    if (!payload.model && pendingAgentModels.has(resolvedId)) {
        applyAvatarModel(avatar, pendingAgentModels.get(resolvedId));
        pendingAgentModels.delete(resolvedId);
    }
    applyPendingAgentState(avatar);
    updateAvatarBadge(avatar);
    if (!avatar.isRoot) {
        layoutSubagents();
    }
    return avatar;
}

function computeLayoutState(subagentCount) {
    const width = Math.max(container.clientWidth || 0, 320);
    const height = Math.max(container.clientHeight || 0, 360);
    const aspect = width / height;

    if (subagentCount === 0) {
        const heroScale = THREE.MathUtils.clamp(1.92 + Math.min(width / 1400, height / 1200) * 0.58, 1.92, 2.48);
        const rootScale = ROOT_SCALE * heroScale;
        const rootY = baseAsset.rootY + 0.12;
        const horizontalSpan = baseAsset.size.x * rootScale * 1.9;
        const topExtent = rootY + baseAsset.size.y * rootScale * 0.98;
        const bottomExtent = rootY - baseAsset.size.y * rootScale * 0.92;
        const verticalSpan = topExtent - bottomExtent;
        const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const distanceForWidth = horizontalSpan / Math.max(0.25, 2 * aspect * Math.tan(halfFov));
        const distanceForHeight = verticalSpan / Math.max(0.25, 2 * Math.tan(halfFov));
        const cameraDistance = Math.max(baseAsset.maxDim * 1.58, distanceForWidth * 0.78, distanceForHeight * 0.82);

        return {
            columns: 1,
            rows: 0,
            slotWidthPx: width - 32,
            overlayScale: 1,
            rootScale,
            rootY,
            subScale: SUBAGENT_SCALE,
            spacingX: baseAsset.rowSpacing,
            rowGap: 0.24,
            stackCenterY: baseAsset.subY,
            cameraDistance,
            cameraLookAtY: THREE.MathUtils.lerp(0.08, rootY * 0.5, 0.84),
            cameraY: rootY + baseAsset.size.y * rootScale * 0.08,
        };
    }

    if (subagentCount === 1) {
        const slotWidthPx = width - 24;
        const overlayScale = THREE.MathUtils.clamp(slotWidthPx / 320, 0.92, 1.06);
        const subScale = THREE.MathUtils.clamp(
            SUBAGENT_SCALE * (height < 760 ? 1.72 : 1.92),
            0.58,
            0.72,
        );
        const rootScale = THREE.MathUtils.clamp(ROOT_SCALE * 0.5, 0.46, 0.56);
        const rootY = baseAsset.rootY + 0.8;
        const topExtent = rootY + baseAsset.size.y * rootScale * 1.02;
        const bottomExtent = -baseAsset.size.y * subScale * 2.28;
        const horizontalSpan = baseAsset.size.x * subScale * 2.86;
        const verticalSpan = topExtent - bottomExtent;
        const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const distanceForWidth = horizontalSpan / Math.max(0.25, 2 * aspect * Math.tan(halfFov));
        const distanceForHeight = verticalSpan / Math.max(0.25, 2 * Math.tan(halfFov));
        const cameraDistance = Math.max(baseAsset.maxDim * 2.84, distanceForWidth * 0.92, distanceForHeight * 0.98);
        const contentCenterY = (topExtent + bottomExtent) / 2;

        return {
            mode: 'grid-1',
            columns: 1,
            rows: 1,
            rowPattern: [1],
            slotWidthPx,
            overlayScale,
            rootScale,
            rootY,
            subScale,
            spacingX: baseAsset.rowSpacing * 1.64,
            rowGap: baseAsset.size.y * subScale * 1.96,
            stackCenterY: baseAsset.subY,
            cameraDistance,
            cameraLookAtY: THREE.MathUtils.lerp(0.12, contentCenterY, 0.56),
            cameraY: contentCenterY + baseAsset.size.y * 0.08,
            gridTopMin: 0.24,
            gridTopGapPx: 12,
            gridHeadYFactor: 0.34,
            gridLabelStartFactor: 0.48,
        };
    }

    if (subagentCount === 2) {
        const slotWidthPx = (width - 24) / 2;
        const overlayScale = THREE.MathUtils.clamp(slotWidthPx / 220, 0.8, 1);
        const subScale = THREE.MathUtils.clamp(
            SUBAGENT_SCALE * (height < 760 ? 1.34 : 1.52),
            0.46,
            0.58,
        );
        const rootScale = THREE.MathUtils.clamp(ROOT_SCALE * 0.52, 0.48, 0.58);
        const rootY = baseAsset.rootY + 0.82;
        const topExtent = rootY + baseAsset.size.y * rootScale * 1.02;
        const bottomExtent = -baseAsset.size.y * subScale * 2.54;
        const horizontalSpan = baseAsset.size.x * subScale * 4.26;
        const verticalSpan = topExtent - bottomExtent;
        const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const distanceForWidth = horizontalSpan / Math.max(0.25, 2 * aspect * Math.tan(halfFov));
        const distanceForHeight = verticalSpan / Math.max(0.25, 2 * Math.tan(halfFov));
        const cameraDistance = Math.max(baseAsset.maxDim * 2.96, distanceForWidth * 0.93, distanceForHeight * 0.98);
        const contentCenterY = (topExtent + bottomExtent) / 2;

        return {
            mode: 'grid-2',
            columns: 2,
            rows: 1,
            rowPattern: [2],
            slotWidthPx,
            overlayScale,
            rootScale,
            rootY,
            subScale,
            spacingX: baseAsset.rowSpacing * 1.56,
            rowGap: baseAsset.size.y * subScale * 2.02,
            stackCenterY: baseAsset.subY,
            cameraDistance,
            cameraLookAtY: THREE.MathUtils.lerp(0.12, contentCenterY, 0.56),
            cameraY: contentCenterY + baseAsset.size.y * 0.08,
            gridTopMin: 0.24,
            gridTopGapPx: 12,
            gridHeadYFactor: 0.32,
            gridLabelStartFactor: 0.5,
        };
    }

    if (subagentCount === 4) {
        const slotWidthPx = (width - 24) / 2;
        const overlayScale = THREE.MathUtils.clamp(slotWidthPx / 214, 0.76, 0.98);
        const subScale = THREE.MathUtils.clamp(
            SUBAGENT_SCALE * (height < 760 ? 1.12 : 1.22),
            0.4,
            0.48,
        );
        const rootScale = THREE.MathUtils.clamp(ROOT_SCALE * 0.62, 0.58, 0.66);
        const rootY = baseAsset.rootY + 0.88;
        const topExtent = rootY + baseAsset.size.y * rootScale * 1.02;
        const bottomExtent = -baseAsset.size.y * subScale * 3.16;
        const horizontalSpan = baseAsset.size.x * subScale * 4.48;
        const verticalSpan = topExtent - bottomExtent;
        const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const distanceForWidth = horizontalSpan / Math.max(0.25, 2 * aspect * Math.tan(halfFov));
        const distanceForHeight = verticalSpan / Math.max(0.25, 2 * Math.tan(halfFov));
        const cameraDistance = Math.max(baseAsset.maxDim * 3.1, distanceForWidth * 0.95, distanceForHeight * 0.98);
        const contentCenterY = (topExtent + bottomExtent) / 2;

        return {
            mode: 'grid-2x2',
            columns: 2,
            rows: 2,
            slotWidthPx,
            overlayScale,
            rootScale,
            rootY,
            subScale,
            spacingX: baseAsset.rowSpacing * 1.48,
            rowGap: baseAsset.size.y * subScale * 2.18,
            stackCenterY: baseAsset.subY,
            cameraDistance,
            cameraLookAtY: THREE.MathUtils.lerp(0.08, contentCenterY, 0.58),
            cameraY: contentCenterY + baseAsset.size.y * 0.08,
            gridTopMin: 0.25,
            gridTopGapPx: 10,
            gridHeadYFactor: 0.28,
            gridLabelStartFactor: 0.66,
        };
    }

    if (subagentCount === 3) {
        const slotWidthPx = (width - 24) / 2;
        const overlayScale = THREE.MathUtils.clamp(slotWidthPx / 214, 0.78, 1);
        const subScale = THREE.MathUtils.clamp(
            SUBAGENT_SCALE * (height < 760 ? 1.16 : 1.28),
            0.4,
            0.48,
        );
        const rootScale = THREE.MathUtils.clamp(ROOT_SCALE * 0.54, 0.5, 0.6);
        const rootY = baseAsset.rootY + 0.82;
        const topExtent = rootY + baseAsset.size.y * rootScale * 1.02;
        const bottomExtent = -baseAsset.size.y * subScale * 3.32;
        const horizontalSpan = baseAsset.size.x * subScale * 4.52;
        const verticalSpan = topExtent - bottomExtent;
        const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const distanceForWidth = horizontalSpan / Math.max(0.25, 2 * aspect * Math.tan(halfFov));
        const distanceForHeight = verticalSpan / Math.max(0.25, 2 * Math.tan(halfFov));
        const cameraDistance = Math.max(baseAsset.maxDim * 3.16, distanceForWidth * 0.94, distanceForHeight * 1.0);
        const contentCenterY = (topExtent + bottomExtent) / 2;

        return {
            mode: 'grid-3',
            columns: 2,
            rows: 2,
            rowPattern: [2, 1],
            slotWidthPx,
            overlayScale,
            rootScale,
            rootY,
            subScale,
            spacingX: baseAsset.rowSpacing * 1.5,
            rowGap: baseAsset.size.y * subScale * 2.14,
            stackCenterY: baseAsset.subY,
            cameraDistance,
            cameraLookAtY: THREE.MathUtils.lerp(0.08, contentCenterY, 0.58),
            cameraY: contentCenterY + baseAsset.size.y * 0.08,
            gridTopMin: 0.24,
            gridTopGapPx: 10,
            gridHeadYFactor: 0.27,
            gridLabelStartFactor: 0.56,
        };
    }

    if (subagentCount === 5) {
        const slotWidthPx = (width - 24) / 2;
        const overlayScale = THREE.MathUtils.clamp(slotWidthPx / 214, 0.76, 0.98);
        const subScale = THREE.MathUtils.clamp(
            SUBAGENT_SCALE * (height < 760 ? 1.02 : 1.1),
            0.35,
            0.43,
        );
        const rootScale = THREE.MathUtils.clamp(ROOT_SCALE * 0.5, 0.46, 0.54);
        const rootY = baseAsset.rootY + 0.78;
        const topExtent = rootY + baseAsset.size.y * rootScale * 1.02;
        const bottomExtent = -baseAsset.size.y * subScale * 3.92;
        const horizontalSpan = baseAsset.size.x * subScale * 4.36;
        const verticalSpan = topExtent - bottomExtent;
        const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const distanceForWidth = horizontalSpan / Math.max(0.25, 2 * aspect * Math.tan(halfFov));
        const distanceForHeight = verticalSpan / Math.max(0.25, 2 * Math.tan(halfFov));
        const cameraDistance = Math.max(baseAsset.maxDim * 3.48, distanceForWidth * 0.96, distanceForHeight * 1.0);
        const contentCenterY = (topExtent + bottomExtent) / 2;

        return {
            mode: 'grid-5',
            columns: 2,
            rows: 3,
            rowPattern: [2, 2, 1],
            slotWidthPx,
            overlayScale,
            rootScale,
            rootY,
            subScale,
            spacingX: baseAsset.rowSpacing * 1.44,
            rowGap: baseAsset.size.y * subScale * 1.94,
            stackCenterY: baseAsset.subY,
            cameraDistance,
            cameraLookAtY: THREE.MathUtils.lerp(0.04, contentCenterY, 0.56),
            cameraY: contentCenterY + baseAsset.size.y * 0.08,
            gridTopMin: 0.2,
            gridTopGapPx: 8,
            gridHeadYFactor: 0.22,
            gridLabelStartFactor: 0.58,
        };
    }

    if (subagentCount === 6) {
        const slotWidthPx = (width - 24) / 2;
        const overlayScale = THREE.MathUtils.clamp(slotWidthPx / 214, 0.76, 0.96);
        const subScale = THREE.MathUtils.clamp(
            SUBAGENT_SCALE * (height < 760 ? 0.96 : 1.04),
            0.32,
            0.4,
        );
        const rootScale = THREE.MathUtils.clamp(ROOT_SCALE * 0.52, 0.48, 0.56);
        const rootY = baseAsset.rootY + 0.82;
        const topExtent = rootY + baseAsset.size.y * rootScale * 1.02;
        const bottomExtent = -baseAsset.size.y * subScale * 4.18;
        const horizontalSpan = baseAsset.size.x * subScale * 4.44;
        const verticalSpan = topExtent - bottomExtent;
        const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const distanceForWidth = horizontalSpan / Math.max(0.25, 2 * aspect * Math.tan(halfFov));
        const distanceForHeight = verticalSpan / Math.max(0.25, 2 * Math.tan(halfFov));
        const cameraDistance = Math.max(baseAsset.maxDim * 3.72, distanceForWidth * 0.98, distanceForHeight * 1.02);
        const contentCenterY = (topExtent + bottomExtent) / 2;

        return {
            mode: 'grid-2x3',
            columns: 2,
            rows: 3,
            slotWidthPx,
            overlayScale,
            rootScale,
            rootY,
            subScale,
            spacingX: baseAsset.rowSpacing * 1.42,
            rowGap: baseAsset.size.y * subScale * 1.84,
            stackCenterY: baseAsset.subY,
            cameraDistance,
            cameraLookAtY: THREE.MathUtils.lerp(0.02, contentCenterY, 0.56),
            cameraY: contentCenterY + baseAsset.size.y * 0.08,
            gridTopMin: 0.2,
            gridTopGapPx: 6,
            gridHeadYFactor: 0.2,
            gridLabelStartFactor: 0.56,
        };
    }

    const widthColumns = Math.max(1, Math.floor((width - 32) / 168));
    let preferredMaxColumns = (height < 740 || width < 760 || aspect < 0.9)
        ? 2
        : height < 940
            ? 3
            : 4;
    if (subagentCount >= 4 && (height < 880 || width < 840 || aspect < 0.96)) {
        preferredMaxColumns = Math.min(preferredMaxColumns, 2);
    }
    const maxColumns = Math.max(1, Math.min(widthColumns, preferredMaxColumns));
    const columns = subagentCount > 0 ? Math.min(subagentCount, maxColumns) : 1;
    const rows = subagentCount > 0 ? Math.ceil(subagentCount / columns) : 0;
    const slotWidthPx = subagentCount > 0 ? Math.max(118, (width - 32) / columns) : width - 32;
    const widthCompactness = THREE.MathUtils.clamp((760 - width) / 360, 0, 1);
    const heightCompactness = THREE.MathUtils.clamp((920 - height) / 380, 0, 1);
    const widthScale = THREE.MathUtils.clamp(slotWidthPx / 194, 0.58, 1);
    const heightScale = THREE.MathUtils.clamp((height - 210) / 640, 0.6, 1);
    const rowScale = rows >= 3 ? 0.62 : rows === 2 ? 0.74 : 1;
    const compactness = THREE.MathUtils.clamp(Math.max((560 - width) / 260, (760 - height) / 260), 0, 1);
    let subScale = THREE.MathUtils.clamp(
        SUBAGENT_SCALE * widthScale * heightScale * rowScale * (1 - compactness * 0.08),
        0.145,
        SUBAGENT_SCALE,
    );
    let spacingX = Math.max(
        baseAsset.rowSpacing * widthScale * (0.94 - widthCompactness * 0.12),
        baseAsset.size.x * subScale * (1.26 - widthCompactness * 0.12),
    );
    let baseRowGap = Math.max(baseAsset.size.y * subScale * (0.86 - heightCompactness * 0.04), 0.18);
    let labelReserve = rows > 1
        ? Math.max(baseAsset.size.y * subScale * (1.45 + heightCompactness * 0.24), 0.28)
        : 0;
    let rowGap = baseRowGap + labelReserve;
    if (rows === 1) {
        subScale = THREE.MathUtils.clamp(subScale * 1.22, 0.22, SUBAGENT_SCALE);
        spacingX *= 1.08;
    } else if (rows === 2) {
        subScale = THREE.MathUtils.clamp(subScale * 1.18, 0.18, SUBAGENT_SCALE * 0.94);
        spacingX *= 1.1;
        baseRowGap = Math.max(baseAsset.size.y * subScale * 0.96, 0.2);
        labelReserve = Math.max(baseAsset.size.y * subScale * (2.0 + heightCompactness * 0.28), 0.42);
        rowGap = baseRowGap + labelReserve;
    }
    const activeRootOffset = 0.48 + Math.min(0.26, subagentCount * 0.035);
    let stackCenterY = baseAsset.subY
        + compactness * 0.48
        + heightCompactness * 0.1
        - 0.02
        + Math.max(0, rows - 1) * 0.02;
    let rootScale = THREE.MathUtils.clamp(
        ROOT_SCALE
            * 0.62
            * (1 - compactness * 0.2)
            * (rows >= 2 ? 0.84 : 1)
            * (rows >= 3 ? 0.92 : 1),
        0.48,
        ROOT_SCALE,
    );
    let rootY = baseAsset.rootY
        + compactness * 0.66
        + activeRootOffset
        + Math.max(0, rows - 1) * 0.36;
    if (rows === 1) {
        rootScale = THREE.MathUtils.clamp(rootScale * 1.18, 0.66, ROOT_SCALE * 0.9);
        rootY += 0.1;
        stackCenterY += 0.12;
    } else if (rows === 2) {
        rootScale = THREE.MathUtils.clamp(rootScale * 1.14, 0.6, ROOT_SCALE * 0.82);
        rootY += 0.08;
        stackCenterY += 0.08;
    }
    const topRowY = stackCenterY + ((rows - 1) * rowGap) / 2;
    const bottomRowY = stackCenterY - ((rows - 1) * rowGap) / 2;
    const horizontalSpan = columns > 0
        ? ((columns - 1) * spacingX) + baseAsset.size.x * subScale * 2.05
        : baseAsset.size.x * rootScale * 1.4;
    const topExtent = Math.max(rootY + baseAsset.size.y * rootScale * 0.92, topRowY + baseAsset.size.y * subScale * 0.85);
    const bottomExtent = rows > 0
        ? bottomRowY - baseAsset.size.y * subScale * 2.45
        : rootY - baseAsset.size.y * rootScale * 0.82;
    const verticalSpan = topExtent - bottomExtent;
    const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const distanceForWidth = horizontalSpan / Math.max(0.25, 2 * aspect * Math.tan(halfFov));
    const distanceForHeight = verticalSpan / Math.max(0.25, 2 * Math.tan(halfFov));
    const baseDistance = baseAsset.maxDim * (3.32 + compactness * 0.92 + Math.max(0, rows - 1) * 0.48 + 0.18);
    const cameraDistance = Math.max(baseDistance, distanceForWidth * 0.98, distanceForHeight * 1.0);
    const contentCenterY = (topExtent + bottomExtent) / 2;
    const cameraLookAtY = THREE.MathUtils.lerp(0.04, contentCenterY, 0.76);
    const cameraY = contentCenterY + baseAsset.size.y * (0.1 + compactness * 0.04);
    const overlayScale = THREE.MathUtils.clamp(slotWidthPx / 186, 0.66, 1);

    return {
        columns,
        rows,
        slotWidthPx,
        overlayScale,
        rootScale,
        rootY,
        subScale,
        spacingX,
        rowGap,
        stackCenterY,
        cameraDistance,
        cameraLookAtY,
        cameraY,
    };
}

function projectScreenPointToPlane(screenX, screenY, target, targetZ = 0) {
    const width = Math.max(container.clientWidth || 0, 1);
    const height = Math.max(container.clientHeight || 0, 1);
    const ndcX = (screenX / width) * 2 - 1;
    const ndcY = 1 - (screenY / height) * 2;

    layoutRayVector.set(ndcX, ndcY, 0.5).unproject(camera);
    layoutDirectionVector.copy(layoutRayVector).sub(camera.position).normalize();

    const distance = (targetZ - camera.position.z) / layoutDirectionVector.z;
    return target.copy(camera.position).addScaledVector(layoutDirectionVector, distance);
}

function layoutSubagents() {
    if (!baseAsset) return;

    const active = [...avatars.values()]
        .filter((avatar) => !avatar.isRoot && avatar.inLayout)
        .sort((a, b) => a.createdAt - b.createdAt);

    layoutState = computeLayoutState(active.length);
    document.body.classList.toggle('compact-layout', layoutState.slotWidthPx < 156);
    document.body.classList.toggle('tiny-layout', layoutState.slotWidthPx < 136);

    const rootAvatar = avatars.get(ROOT_AGENT_ID);
    if (rootAvatar) {
        rootAvatar.baseScale = layoutState.rootScale;
        rootAvatar.targetPosition.set(0, layoutState.rootY, 0);
    }

    if (layoutState.mode === 'grid-1' || layoutState.mode === 'grid-2' || layoutState.mode === 'grid-3' || layoutState.mode === 'grid-2x2' || layoutState.mode === 'grid-2x3' || layoutState.mode === 'grid-5') {
        updateCamera(layoutState);

        const width = Math.max(container.clientWidth || 0, 320);
        const height = Math.max(container.clientHeight || 0, 360);
        worldVector.set(0, layoutState.rootY - baseAsset.size.y * layoutState.rootScale * 0.56, 0);
        overlayVector.copy(worldVector).project(camera);

        const rootBottomPx = (-overlayVector.y * 0.5 + 0.5) * height;
        const gridTop = THREE.MathUtils.clamp(
            Math.max(rootBottomPx + (layoutState.gridTopGapPx || 10), height * (layoutState.gridTopMin || 0.25)),
            0,
            height - 180,
        );
        const gridBottom = height - 12;
        const gridLeft = 12;
        const gridWidth = width - 24;
        const gridHeight = Math.max(140, gridBottom - gridTop);
        const cellHeight = gridHeight / layoutState.rows;
        const rowPattern = layoutState.rowPattern || Array.from({ length: layoutState.rows }, () => layoutState.columns);

        active.forEach((avatar, index) => {
            let row = 0;
            let rowStart = 0;
            while (row < rowPattern.length && index >= rowStart + rowPattern[row]) {
                rowStart += rowPattern[row];
                row += 1;
            }
            const itemsInRow = rowPattern[Math.min(row, rowPattern.length - 1)] || layoutState.columns;
            const column = index - rowStart;
            const cellWidth = gridWidth / itemsInRow;
            const cellLeft = gridLeft + column * cellWidth;
            const cellTop = gridTop + row * cellHeight;
            const cellRight = cellLeft + cellWidth;
            const cellBottom = cellTop + cellHeight;
            const headX = cellLeft + cellWidth * 0.5;
            const headY = cellTop + cellHeight * (layoutState.gridHeadYFactor || 0.28);

            avatar.baseScale = layoutState.subScale;
            projectScreenPointToPlane(headX, headY, avatar.targetPosition);
            avatar.overlayBounds = {
                minX: cellLeft + 8,
                maxX: cellRight - 8,
                minY: cellTop + cellHeight * (layoutState.gridLabelStartFactor || 0.66),
                maxY: cellBottom - 10,
            };
        });

        return;
    }

    const topRowY = layoutState.stackCenterY + ((layoutState.rows - 1) * layoutState.rowGap) / 2;

    active.forEach((avatar, index) => {
        const row = Math.floor(index / layoutState.columns);
        const rowStart = row * layoutState.columns;
        const itemsInRow = Math.min(layoutState.columns, active.length - rowStart);
        const column = index - rowStart;
        const centerOffset = (itemsInRow - 1) / 2;

        avatar.baseScale = layoutState.subScale;
        avatar.overlayBounds = null;
        avatar.targetPosition.set(
            (column - centerOffset) * layoutState.spacingX,
            topRowY - row * layoutState.rowGap,
            0,
        );
    });

    updateCamera(layoutState);
}

function getResolvedActivity(avatar, now = performance.now()) {
    const latestTool = getLatestToolEntry(avatar);
    if (hasWorkToolEntry(latestTool)) return latestTool.activity || 'idle';

    if (avatar.thinkingUntil > now) {
        return 'thinking';
    }

    if (avatar.isRoot && rootWorking) {
        return 'running';
    }

    return 'idle';
}

function getVisualMode(avatar, now = performance.now()) {
    if (avatar.expressionUntil > now) {
        return avatar.expressionName;
    }

    if (avatar.isRoot) {
        const rootMode = getActiveRootEmotion(now);
        if (rootMode !== 'default') {
            return rootMode;
        }
    }

    return getResolvedActivity(avatar, now);
}

function updateAvatarBadge(avatar, now = performance.now()) {
    if (!avatar.overlay) return;

    const activity = avatar.effectState === 'failed'
        ? 'failed'
        : avatar.effectState === 'success'
            ? 'success'
            : getResolvedActivity(avatar, now);

    const badge = ACTIVITY_BADGES[activity] || ACTIVITY_BADGES.idle;
    const badgeText = getAvatarBadgeText(avatar, activity, now);
    const detailText = getAvatarDetailText(avatar, activity, now);
    avatar.overlay.badgeEl.className = `agent-badge ${activity}`;
    avatar.overlay.badgeIconEl.textContent = activity === 'idle'
        ? avatar.isDuck
            ? '🦆'
            : badge.icon
        : badge.icon;
    avatar.overlay.badgeTextEl.textContent = badgeText;
    avatar.overlay.detailEl.textContent = detailText;
    avatar.overlay.detailEl.classList.toggle('visible', showAvatarBadges && !!detailText);
    avatar.overlay.detailEl.title = detailText || '';
}

function beginAvatarRemoval(avatar) {
    avatar.inLayout = false;
    avatar.leaving = true;
    avatar.targetPresence = 0;
    layoutSubagents();
}

function finalizeAvatar(agentId) {
    const avatar = avatars.get(agentId);
    if (!avatar || avatar.isRoot) return;
    disposeAvatar(avatar);
    avatars.delete(agentId);
    clearPendingAgentState(agentId);
}

function spawnParticleBurst(avatar, count = 34) {
    avatar.group.localToWorld(confettiOriginVector.set(0, 0.16, baseAsset.eyeZ * 0.75));

    for (let index = 0; index < count; index += 1) {
        const material = new THREE.SpriteMaterial({
            map: particleTexture,
            color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
            transparent: true,
            opacity: 1,
            depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        const scale = 0.032 + Math.random() * 0.034;
        sprite.position.copy(confettiOriginVector);
        sprite.scale.set(scale, scale, scale);
        scene.add(sprite);

        particles.push({
            sprite,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 1.2,
                0.55 + Math.random() * 1.05,
                (Math.random() - 0.5) * 0.5,
            ),
            gravity: 1.65 + Math.random() * 0.55,
            life: 0,
            ttl: 1.1 + Math.random() * 0.45,
            spin: (Math.random() - 0.5) * 8,
        });
    }
}

function updateParticles(dt) {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.life += dt;

        if (particle.life >= particle.ttl) {
            scene.remove(particle.sprite);
            particle.sprite.material.dispose();
            particles.splice(index, 1);
            continue;
        }

        particle.velocity.y -= particle.gravity * dt;
        particle.sprite.position.addScaledVector(particle.velocity, dt);
        particle.sprite.material.opacity = 1 - particle.life / particle.ttl;
        particle.sprite.material.rotation += particle.spin * dt;
    }
}

function triggerRootBurst(kind) {
    const rootAvatar = avatars.get(ROOT_AGENT_ID);
    if (!rootAvatar) return;
    const count = kind === 'sparkle' ? 22 : 40;
    spawnParticleBurst(rootAvatar, count);
    if (kind === 'party') {
        setTimeout(() => {
            if (avatars.has(ROOT_AGENT_ID)) spawnParticleBurst(rootAvatar, 28);
        }, 180);
        setTimeout(() => {
            if (avatars.has(ROOT_AGENT_ID)) spawnParticleBurst(rootAvatar, 24);
        }, 360);
    }
}

function setAvatarExpression(avatar, name, durationMs) {
    avatar.expressionName = name;
    avatar.expressionUntil = performance.now() + durationMs;
}

function humanizeError(error) {
    if (!error) return 'Failed';
    return String(error).split('\n')[0].trim() || 'Failed';
}

function setOverlayPosition(avatar) {
    if (!avatar.overlay) return;

    if (!showAvatarBadges) {
        avatar.overlay.labelEl.classList.remove('visible');
        avatar.overlay.labelEl.style.opacity = '0';
        return;
    }

    avatar.group.updateWorldMatrix(true, true);
    avatar.group.localToWorld(worldVector.copy(baseAsset.overlayOffset));
    overlayVector.copy(worldVector).project(camera);

    const onScreen = overlayVector.z > -1 && overlayVector.z < 1
        && overlayVector.x > -1.45 && overlayVector.x < 1.45
        && overlayVector.y > -1.45 && overlayVector.y < 1.45
        && avatar.presence > 0.05;

    if (!onScreen) {
        avatar.overlay.labelEl.classList.remove('visible');
        avatar.overlay.labelEl.style.opacity = '0';
        return;
    }

    const scale = layoutState.overlayScale * (0.92 + avatar.presence * 0.08);
    const rawX = (overlayVector.x * 0.5 + 0.5) * container.clientWidth;
    const rawY = (-overlayVector.y * 0.5 + 0.5) * container.clientHeight + 6;
    const labelWidth = (avatar.overlay.labelEl.offsetWidth || 132) * scale;
    const labelHeight = (avatar.overlay.labelEl.offsetHeight || 52) * scale;
    const labelBounds = avatar.overlayBounds;
    const minX = labelBounds ? labelBounds.minX + labelWidth * 0.5 : labelWidth * 0.5 + 8;
    const maxX = labelBounds ? labelBounds.maxX - labelWidth * 0.5 : container.clientWidth - labelWidth * 0.5 - 8;
    const minY = labelBounds ? labelBounds.minY : 8;
    const maxY = labelBounds ? labelBounds.maxY - labelHeight : container.clientHeight - labelHeight - 10;
    const clampedX = THREE.MathUtils.clamp(rawX, Math.min(minX, maxX), Math.max(minX, maxX));
    const clampedY = THREE.MathUtils.clamp(rawY, Math.min(minY, maxY), Math.max(minY, maxY));
    avatar.overlay.labelEl.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0) translate(-50%, 0) scale(${scale})`;
    avatar.overlay.labelEl.style.opacity = `${Math.max(0, Math.min(1, avatar.presence))}`;
    avatar.overlay.labelEl.classList.add('visible');
}

function updateEmotionBubblePosition() {
    if (!emotionBubbleEl.classList.contains('visible')) return;
    const rootAvatar = avatars.get(ROOT_AGENT_ID);
    if (!rootAvatar) return;

    rootAvatar.group.updateWorldMatrix(true, true);
    rootAvatar.eyeR.getWorldPosition(rightEyeVector);
    rightEyeVector.project(camera);
    const x = (rightEyeVector.x * 0.5 + 0.5) * container.clientWidth + 44;
    const y = (-rightEyeVector.y * 0.5 + 0.5) * container.clientHeight - 64;
    emotionBubbleEl.style.left = `${x}px`;
    emotionBubbleEl.style.top = `${y}px`;
}

function updateBlinkState(avatar, visual, dt, now) {
    const motionPersona = avatar.motionPersona || MOTION_PERSONAS.steady;
    const restBlink = visual.restBlink ?? 1;
    let leftBlink = restBlink;
    let rightBlink = restBlink;

    if (avatar.happyBlinkUntil > now) {
        const phase = 1 - (avatar.happyBlinkUntil - now) / 420;
        const blink = Math.max(0.02, Math.abs(Math.cos(phase * Math.PI * 1.8)));
        avatar.eyeMatL.uniforms.uBlink.value = blink;
        avatar.eyeMatR.uniforms.uBlink.value = blink;
        return;
    }

    if (!visual.blinkEnabled) {
        avatar.anim.isBlinking = false;
        avatar.anim.blinkTimer = randomFromRange(motionPersona.blinkInterval);
    } else {
        avatar.anim.blinkTimer -= dt;
        if (avatar.anim.blinkTimer <= 0 && !avatar.anim.isBlinking && !avatar.anim.isWinking) {
            avatar.anim.isBlinking = true;
            avatar.anim.blinkPhase = 1;
            avatar.anim.blinkProgress = 0;
            avatar.anim.blinkTimer = randomFromRange(motionPersona.blinkInterval);
        }
    }

    if (avatar.anim.isBlinking) {
        avatar.anim.blinkProgress += dt * 12 * motionPersona.blinkRate;
        if (avatar.anim.blinkPhase === 1) {
            const blink = Math.max(0, restBlink * (1 - avatar.anim.blinkProgress * 1.5));
            leftBlink = blink;
            rightBlink = blink;
            if (blink <= 0.02) {
                avatar.anim.blinkPhase = 2;
                avatar.anim.blinkProgress = 0;
            }
        } else {
            const blink = Math.min(restBlink, avatar.anim.blinkProgress * restBlink * 1.5);
            leftBlink = blink;
            rightBlink = blink;
            if (blink >= restBlink) {
                avatar.anim.isBlinking = false;
            }
        }
    }

    if (!visual.winkEnabled) {
        avatar.anim.isWinking = false;
        avatar.anim.winkTimer = randomFromRange(motionPersona.winkInterval);
    } else {
        avatar.anim.winkTimer -= dt;
        if (avatar.anim.winkTimer <= 0 && !avatar.anim.isBlinking && !avatar.anim.isWinking) {
            avatar.anim.isWinking = true;
            avatar.anim.blinkPhase = 1;
            avatar.anim.blinkProgress = 0;
            avatar.anim.winkTimer = randomFromRange(motionPersona.winkInterval);
        }
    }

    if (avatar.anim.isWinking) {
        avatar.anim.blinkProgress += dt * 10 * motionPersona.winkRate;
        if (avatar.anim.blinkPhase === 1) {
            leftBlink = Math.max(0, restBlink * (1 - avatar.anim.blinkProgress * 1.5));
            if (leftBlink <= 0.02) {
                avatar.anim.blinkPhase = 2;
                avatar.anim.blinkProgress = 0;
            }
        } else {
            leftBlink = Math.min(restBlink, avatar.anim.blinkProgress * restBlink * 1.2);
            if (leftBlink >= restBlink) {
                avatar.anim.isWinking = false;
            }
        }
    }

    avatar.eyeMatL.uniforms.uBlink.value = leftBlink;
    avatar.eyeMatR.uniforms.uBlink.value = rightBlink;
}

function getVisualConfig(avatar, mode, dt) {
    const motionPersona = avatar.motionPersona || MOTION_PERSONAS.steady;
    const base = {
        color: ACTIVITY_COLORS[getResolvedActivity(avatar)] || ACTIVITY_COLORS.idle,
        eyeMode: 0,
        eyeScaleX: 1,
        eyeScaleY: 1,
        showHeartEyes: false,
        heartPulse: 1,
        maskOpacity: 0,
        blinkEnabled: true,
        winkEnabled: mode === 'idle',
        restBlink: 1,
        bobY: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        duckRippleOpacity: 0,
        duckRippleScale: 1,
    };

    switch (mode) {
        case 'writing':
            base.color = ACTIVITY_COLORS.writing;
            base.bobY = Math.sin(avatar.anim.idleTime * 7.8) * 0.012;
            base.rotX = 0.05 + Math.sin(avatar.anim.idleTime * 9.2) * 0.09;
            base.rotY = Math.sin(avatar.anim.idleTime * 1.9) * 0.03;
            base.rotZ = Math.sin(avatar.anim.idleTime * 8.6) * 0.01;
            base.winkEnabled = false;
            break;
        case 'reading':
            base.color = ACTIVITY_COLORS.reading;
            base.bobY = Math.sin(avatar.anim.idleTime * 2.1) * 0.008;
            base.rotX = -0.03 + Math.cos(avatar.anim.idleTime * 1.8) * 0.02;
            base.rotY = Math.sin(avatar.anim.idleTime * 1.7) * 0.18;
            base.rotZ = Math.sin(avatar.anim.idleTime * 1.1) * 0.01;
            base.winkEnabled = false;
            break;
        case 'running':
            base.color = ACTIVITY_COLORS.running;
            base.bobY = Math.sin(avatar.anim.idleTime * 5.6) * 0.017;
            base.rotX = Math.cos(avatar.anim.idleTime * 5.8) * 0.035;
            base.rotY = Math.sin(avatar.anim.idleTime * 3.2) * 0.08;
            base.rotZ = Math.sin(avatar.anim.idleTime * 6.1) * 0.02;
            base.winkEnabled = false;
            break;
        case 'thinking':
        case 'think':
            base.color = ACTIVITY_COLORS.thinking;
            base.bobY = Math.sin(avatar.anim.idleTime * 1.1) * 0.012;
            base.rotX = -0.09 + Math.cos(avatar.anim.idleTime * 1.1) * 0.02;
            base.rotY = 0.12 + Math.sin(avatar.anim.idleTime * 0.9) * 0.04;
            base.rotZ = -0.015 + Math.sin(avatar.anim.idleTime * 0.7) * 0.012;
            base.restBlink = 0.62;
            base.winkEnabled = false;
            break;
        case 'success':
            base.color = ACTIVITY_COLORS.success;
            base.bobY = Math.sin(avatar.anim.idleTime * 4.6) * 0.018;
            base.rotX = 0.04 + Math.sin(avatar.anim.idleTime * 8.8) * 0.08;
            base.rotY = Math.sin(avatar.anim.idleTime * 2.4) * 0.05;
            base.rotZ = Math.sin(avatar.anim.idleTime * 4.5) * 0.02;
            base.winkEnabled = false;
            break;
        case 'failed':
        case 'error':
            base.color = ACTIVITY_COLORS.failed;
            base.bobY = -0.01 + Math.sin(avatar.anim.idleTime * 2.4) * 0.005;
            base.rotX = -0.12 + Math.cos(avatar.anim.idleTime * 1.3) * 0.02;
            base.rotY = Math.sin(avatar.anim.idleTime * 1.4) * 0.05;
            base.rotZ = -0.04 + Math.sin(avatar.anim.idleTime * 0.9) * 0.015;
            base.winkEnabled = false;
            break;
        case 'party':
            base.color = new THREE.Color(0xfff08f);
            base.eyeMode = 1;
            base.eyeScaleX = 1.12;
            base.eyeScaleY = 0.76;
            base.bobY = Math.sin(avatar.anim.idleTime * 9.2) * 0.028;
            base.rotX = Math.cos(avatar.anim.idleTime * 5.0) * 0.04;
            base.rotY = Math.sin(avatar.anim.idleTime * 7.2) * 0.08;
            base.rotZ = 0.02 + Math.sin(avatar.anim.idleTime * 13.5) * 0.055;
            base.winkEnabled = false;
            break;
        case 'laugh':
            base.color = new THREE.Color(0xffe38a);
            base.eyeMode = 1;
            base.eyeScaleX = 1.08;
            base.eyeScaleY = 0.72;
            base.bobY = Math.sin(avatar.anim.idleTime * 8.5) * 0.025;
            base.rotX = Math.cos(avatar.anim.idleTime * 4.5) * 0.03;
            base.rotY = Math.sin(avatar.anim.idleTime * 6.4) * 0.07;
            base.rotZ = Math.sin(avatar.anim.idleTime * 12.5) * 0.04;
            base.winkEnabled = false;
            break;
        case 'heart':
            base.color = new THREE.Color(0xff8fc7);
            base.showHeartEyes = true;
            base.heartPulse = 1 + Math.sin(avatar.anim.idleTime * 5.5) * 0.06;
            base.bobY = Math.sin(avatar.anim.idleTime * 2.2) * 0.03;
            base.rotX = -0.04 + Math.cos(avatar.anim.idleTime * 1.8) * 0.02;
            base.rotY = Math.sin(avatar.anim.idleTime * 1.4) * 0.16;
            base.rotZ = Math.sin(avatar.anim.idleTime * 2.6) * 0.05;
            base.blinkEnabled = false;
            base.winkEnabled = false;
            break;
        case 'warning':
            base.color = new THREE.Color(0xffb86b);
            base.eyeScaleX = 1.03;
            base.eyeScaleY = 0.82;
            base.bobY = Math.sin(avatar.anim.idleTime * 3.0) * 0.01;
            base.rotX = -0.02 + Math.cos(avatar.anim.idleTime * 3.2) * 0.03;
            base.rotY = Math.sin(avatar.anim.idleTime * 3.4) * 0.08;
            base.rotZ = Math.sin(avatar.anim.idleTime * 6.0) * 0.02;
            break;
        case 'sparkle':
            base.color = new THREE.Color(0xfff0a8);
            base.eyeScaleX = 1.05 + Math.sin(avatar.anim.idleTime * 4.6) * 0.03;
            base.eyeScaleY = base.eyeScaleX;
            base.bobY = Math.sin(avatar.anim.idleTime * 2.6) * 0.02;
            base.rotX = Math.cos(avatar.anim.idleTime * 1.8) * 0.03;
            base.rotY = Math.sin(avatar.anim.idleTime * 2.2) * 0.06;
            base.rotZ = Math.sin(avatar.anim.idleTime * 4.0) * 0.025;
            break;
        case 'sleep':
            base.color = new THREE.Color(0x9fb5ff);
            base.eyeMode = 2;
            base.eyeScaleX = 1.04;
            base.eyeScaleY = 0.72;
            base.bobY = Math.sin(avatar.anim.idleTime * 0.9) * 0.01;
            base.rotX = -0.1 + Math.sin(avatar.anim.idleTime * 0.6) * 0.03;
            base.rotY = Math.sin(avatar.anim.idleTime * 0.35) * 0.04;
            base.rotZ = -0.03 + Math.sin(avatar.anim.idleTime * 0.45) * 0.015;
            base.blinkEnabled = false;
            base.winkEnabled = false;
            break;
        case 'raccoon':
            base.color = new THREE.Color(0xf3f7ff);
            base.maskOpacity = 0.82;
            base.bobY = Math.sin(avatar.anim.idleTime * 1.8) * 0.015;
            base.rotX = Math.cos(avatar.anim.idleTime * 1.5) * 0.03;
            base.rotY = Math.sin(avatar.anim.idleTime * 1.9) * 0.25;
            base.rotZ = Math.sin(avatar.anim.idleTime * 2.3) * 0.035;
            break;
        default:
            base.color = ACTIVITY_COLORS.idle;
            avatar.anim.wanderTimer -= dt;
            if (avatar.anim.wanderTimer <= 0) {
                avatar.anim.targetRotY = (Math.random() - 0.5) * 0.3 * motionPersona.wanderScale;
                avatar.anim.targetRotX = (Math.random() - 0.5) * 0.1 * motionPersona.wanderScale;
                avatar.anim.wanderTimer = randomFromRange(motionPersona.wanderInterval);
            }
            base.bobY = Math.sin(avatar.anim.idleTime * 1.2) * 0.02;
            base.rotX = avatar.anim.targetRotX;
            base.rotY = avatar.anim.targetRotY;
            base.rotZ = Math.sin(avatar.anim.idleTime * 0.6) * 0.015;
            break;
    }

    if (avatar.flashUntil > performance.now()) {
        base.color = ACTIVITY_COLORS.failed;
    }

    if (avatar.isDuck) {
        base.bobY += Math.sin(avatar.anim.idleTime * 1.6) * 0.013 + Math.sin(avatar.anim.idleTime * 0.9 + 0.8) * 0.008;
        base.rotX += -0.012 + Math.cos(avatar.anim.idleTime * 1.1) * 0.012;
        base.rotY += Math.sin(avatar.anim.idleTime * 0.95) * 0.03;
        base.rotZ += Math.sin(avatar.anim.idleTime * 1.45 + 0.6) * 0.07;
    }

    base.bobY *= motionPersona.bobScale;
    base.rotX *= motionPersona.rotationScale;
    base.rotY *= motionPersona.rotationScale;
    base.rotZ *= motionPersona.rotationScale;
    base.heartPulse = 1 + ((base.heartPulse || 1) - 1) * motionPersona.pulseScale;

    return base;
}

function updateAvatar(avatar, dt, now) {
    const motionPersona = avatar.motionPersona || MOTION_PERSONAS.steady;
    avatar.anim.idleTime += dt;

    if (avatar.intentUntil <= now && avatar.intentText) {
        avatar.intentText = '';
    }

    if (!avatar.isRoot && avatar.leaveAt > 0 && now >= avatar.leaveAt && avatar.inLayout) {
        beginAvatarRemoval(avatar);
    }

    avatar.currentPosition.lerp(avatar.targetPosition, 1 - Math.exp(-dt * 8));
    avatar.presence += (avatar.targetPresence - avatar.presence) * (1 - Math.exp(-dt * 10));

    if (!avatar.isRoot && avatar.leaving && avatar.presence <= 0.03) {
        finalizeAvatar(avatar.agentId);
        return;
    }

    const visualMode = getVisualMode(avatar, now);
    const resolvedActivity = getResolvedActivity(avatar, now);
    const visual = getVisualConfig(avatar, visualMode, dt);
    const scalePulse = avatar.scalePulseUntil > now ? 1 + Math.sin((now / 1000) * 20) * 0.08 * motionPersona.pulseScale : 1;
    const motionEase = 1 - Math.exp(-dt * (avatar.isRoot ? 7 : 9) * motionPersona.motionEase);
    const eyeEase = 1 - Math.exp(-dt * 12 * motionPersona.eyeEase);
    avatar.currentScale += ((avatar.baseScale * avatar.presence) - avatar.currentScale) * (1 - Math.exp(-dt * 10));
    avatar.currentEyeColor.lerp(visual.color, 1 - Math.exp(-dt * 9));
    avatar.currentBobY += (visual.bobY - avatar.currentBobY) * motionEase;
    avatar.currentRotX += (visual.rotX - avatar.currentRotX) * motionEase;
    avatar.currentRotY += (visual.rotY - avatar.currentRotY) * motionEase;
    avatar.currentRotZ += (visual.rotZ - avatar.currentRotZ) * motionEase;
    avatar.currentEyeScaleX += (visual.eyeScaleX - avatar.currentEyeScaleX) * eyeEase;
    avatar.currentEyeScaleY += (visual.eyeScaleY - avatar.currentEyeScaleY) * eyeEase;
    avatar.currentHeartPulse += (visual.heartPulse - avatar.currentHeartPulse) * eyeEase;
    avatar.currentWritingFx += ((resolvedActivity === 'writing' ? motionPersona.writingFx : 0) - avatar.currentWritingFx) * eyeEase;
    avatar.currentReadingFx += ((resolvedActivity === 'reading' ? motionPersona.readingFx : 0) - avatar.currentReadingFx) * eyeEase;
    avatar.currentThinkingFx += ((resolvedActivity === 'thinking' ? motionPersona.thinkingFx : 0) - avatar.currentThinkingFx) * eyeEase;

    let shakeX = 0;
    if (avatar.shakeUntil > now) {
        shakeX = Math.sin(now * 0.08) * 0.04 * motionPersona.shakeScale;
    }

    avatar.group.position.set(
        avatar.currentPosition.x + shakeX,
        avatar.currentPosition.y + avatar.currentBobY,
        avatar.currentPosition.z,
    );
    avatar.group.rotation.set(avatar.currentRotX, avatar.currentRotY, avatar.currentRotZ);
    avatar.group.scale.setScalar(Math.max(0.0001, avatar.currentScale * scalePulse));

    avatar.eyeMatL.uniforms.uTime.value = avatar.anim.idleTime;
    avatar.eyeMatR.uniforms.uTime.value = avatar.anim.idleTime;
    avatar.eyeMatL.uniforms.uMode.value = visual.eyeMode;
    avatar.eyeMatR.uniforms.uMode.value = visual.eyeMode;
    avatar.eyeMatL.uniforms.uColor.value.copy(avatar.currentEyeColor);
    avatar.eyeMatR.uniforms.uColor.value.copy(avatar.currentEyeColor);

    avatar.eyeL.visible = !visual.showHeartEyes;
    avatar.eyeR.visible = !visual.showHeartEyes;
    avatar.heartEyeL.visible = visual.showHeartEyes;
    avatar.heartEyeR.visible = visual.showHeartEyes;
    avatar.heartEyeL.scale.setScalar((avatar.heartEyeL.userData.baseScale || baseAsset.heartScale) * avatar.currentHeartPulse);
    avatar.heartEyeR.scale.setScalar((avatar.heartEyeR.userData.baseScale || baseAsset.heartScale) * avatar.currentHeartPulse);
    avatar.eyeL.scale.set(avatar.currentEyeScaleX, avatar.currentEyeScaleY, 1);
    avatar.eyeR.scale.set(avatar.currentEyeScaleX, avatar.currentEyeScaleY, 1);

    avatar.currentMaskOpacity += (visual.maskOpacity - avatar.currentMaskOpacity) * (1 - Math.exp(-dt * 10));
    avatar.raccoonMask.visible = avatar.currentMaskOpacity > 0.01;
    avatar.raccoonMask.material.opacity = avatar.currentMaskOpacity;
    avatar.currentDuckRippleOpacity += (0 - avatar.currentDuckRippleOpacity) * (1 - Math.exp(-dt * 8));
    avatar.duckBeak.visible = avatar.isDuck;
    for (const material of avatar.duckBeak.userData.materials || []) {
        material.opacity = avatar.isDuck ? Math.max(0.48, avatar.presence) : 0;
    }
    if (avatar.isDuck) {
        const beakScale = avatar.duckBeak.userData.baseScale;
        const beakPulse = 1 + Math.sin(avatar.anim.idleTime * 2.2) * 0.025;
        avatar.duckBeak.scale.set(beakScale.x * beakPulse, beakScale.y, beakScale.z * (1 + Math.sin(avatar.anim.idleTime * 1.7 + 0.4) * 0.03));
    }
    avatar.duckRipple.visible = false;
    avatar.duckRipple.material.opacity = 0;
    for (const glyph of avatar.writingGlyphs) {
        const writingOpacity = avatar.currentWritingFx * (0.38 + (Math.sin(avatar.anim.idleTime * 4.6 * glyph.speed + glyph.phase) + 1) * 0.18);
        glyph.sprite.visible = writingOpacity > 0.03;
        glyph.material.opacity = writingOpacity;
        glyph.material.rotation = Math.sin(avatar.anim.idleTime * 1.8 + glyph.phase) * 0.08;
        glyph.sprite.position.set(
            Math.cos(avatar.anim.idleTime * glyph.speed * motionPersona.glyphScale + glyph.phase) * glyph.orbitRadius * motionPersona.glyphScale,
            glyph.verticalOffset + Math.sin(avatar.anim.idleTime * 2.2 + glyph.phase * 1.7) * 0.05,
            baseAsset.eyeZ + 0.12 + Math.sin(avatar.anim.idleTime * 1.9 + glyph.phase) * 0.04 * glyph.drift,
        );
        const glyphScale = glyph.size * (0.92 + Math.sin(avatar.anim.idleTime * 3.1 + glyph.phase) * 0.08);
        glyph.sprite.scale.setScalar(glyphScale);
    }
    const readingBeam = avatar.activityEffects.readingBeam;
    const readingBeamMaterial = avatar.activityEffects.readingBeamMaterial;
    readingBeam.visible = avatar.currentReadingFx > 0.04;
    readingBeamMaterial.opacity = avatar.currentReadingFx * 0.42;
    readingBeam.position.x = Math.sin(avatar.anim.idleTime * 1.7 * motionPersona.readingSweep) * baseAsset.eyeSpacing * 1.45;
    readingBeam.scale.x = baseAsset.readingBeamWidth * (0.82 + (Math.sin(avatar.anim.idleTime * 2.5) + 1) * 0.1);
    readingBeam.scale.y = baseAsset.readingBeamHeight;

    for (const dot of avatar.activityEffects.thinkingDots) {
        const orbitAngle = avatar.anim.idleTime * 0.85 * motionPersona.thinkingOrbit + dot.phase;
        const bob = Math.sin(avatar.anim.idleTime * 1.6 + dot.phase * 1.5) * 0.03;
        dot.sprite.visible = avatar.currentThinkingFx > 0.04;
        dot.material.opacity = avatar.currentThinkingFx * (0.22 + (Math.sin(avatar.anim.idleTime * 2 + dot.phase) + 1) * 0.08);
        dot.sprite.position.set(
            Math.cos(orbitAngle) * (baseAsset.thinkingOrbitRadius + dot.orbitRadius * 0.4) * motionPersona.thinkingOrbit,
            baseAsset.thinkingCenterY + bob,
            baseAsset.eyeZ + 0.08 + Math.sin(orbitAngle) * 0.05,
        );
        const dotScale = baseAsset.thinkingDotSize * dot.size * (0.9 + (Math.sin(avatar.anim.idleTime * 2.2 + dot.phase) + 1) * 0.08);
        dot.sprite.scale.setScalar(dotScale);
    }

    updateBlinkState(avatar, visual, dt, now);
    updateAvatarBadge(avatar, now);
    if (avatar.isRoot) {
        setRootModelPosition();
    } else {
        setOverlayPosition(avatar);
    }
}

function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000 || 1 / 60);
    lastFrameTime = now;

    updateParticles(dt);
    for (const avatar of [...avatars.values()]) {
        updateAvatar(avatar, dt, now);
    }

    scene.updateMatrixWorld(true);
    updateEmotionBubble(getActiveRootEmotion(now));
    updateEmotionBubblePosition();
    if (isClippyAvatar()) {
        const rootAvatar = avatars.get(ROOT_AGENT_ID);
        updateClippyVisual(rootAvatar ? getVisualMode(rootAvatar, now) : 'idle');
        updateClippyModel(dt, now);
    }
    updateSceneModeVisibility();
    renderer.render(scene, camera);
}

function startAnimation() {
    if (animationStarted) return;
    animationStarted = true;
    requestAnimationFrame((now) => {
        lastFrameTime = now;
        animate(now);
    });
}

function updateCamera(layout = layoutState) {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    camera.aspect = width / height;
    const clippyWithSubagents = isClippyAvatar() && [...avatars.values()].some((avatar) => !avatar.isRoot && avatar.inLayout);
    if (isClippyAvatar() && !clippyWithSubagents) {
        const compactness = THREE.MathUtils.clamp(Math.max((520 - width) / 260, (640 - height) / 260), 0, 1);
        camera.position.set(0, 0.08 + compactness * 0.06, 4.65 + compactness * 0.5);
        camera.lookAt(0, 0.02, 0);
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        return;
    }

    camera.position.set(
        0,
        baseAsset ? layout.cameraY : 0.05,
        baseAsset ? layout.cameraDistance : 3.2,
    );
    camera.lookAt(0, layout.cameraLookAtY, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function initializeRootAvatar() {
    const rootAvatar = ensureAvatar(ROOT_AGENT_ID, { displayName: 'Copilot', agentName: '@copilot' });
    updateRootSquadMicBoom(rootAvatar);
}

function clearDemoAgents() {
    for (let index = pendingSubagents.length - 1; index >= 0; index -= 1) {
        if (DEMO_AGENT_IDS.includes(pendingSubagents[index].agentId)) {
            pendingSubagents.splice(index, 1);
        }
    }

    for (const agentId of DEMO_AGENT_IDS) {
        if (avatars.has(agentId)) {
            finalizeAvatar(agentId);
        }
    }

    layoutSubagents();
}

function clearSubagents({ preserveRoot = true } = {}) {
    pendingSubagents.length = 0;

    for (const avatar of [...avatars.values()]) {
        if (preserveRoot && avatar.isRoot) {
            continue;
        }
        finalizeAvatar(avatar.agentId);
    }

    for (const agentId of [...pendingAgentModels.keys()]) {
        if (preserveRoot && agentId === ROOT_AGENT_ID) {
            continue;
        }
        pendingAgentModels.delete(agentId);
    }

    for (const agentId of [...pendingAgentActivities.keys()]) {
        if (preserveRoot && agentId === ROOT_AGENT_ID) {
            continue;
        }
        clearPendingAgentState(agentId, { preserveModel: true });
    }

    for (const agentId of [...pendingAgentIntents.keys()]) {
        if (preserveRoot && agentId === ROOT_AGENT_ID) {
            continue;
        }
        clearPendingAgentState(agentId, { preserveModel: true });
    }

    for (const agentId of [...pendingAgentThinking.values()]) {
        if (preserveRoot && agentId === ROOT_AGENT_ID) {
            continue;
        }
        clearPendingAgentState(agentId, { preserveModel: true });
    }

    layoutSubagents();
    updateRootModelIndicator();
    updateSubtaskDisplay();
}

function resetDemoSequence() {
    demoSequenceRunId += 1;
    for (const timerId of demoTimers) {
        clearTimeout(timerId);
    }
    demoTimers = [];
    clearDemoAgents();
    clearMessageOverlay();
    speechSynthesis.cancel();
    rootEmotion = { name: 'default', until: 0 };
    updateEmotionBubble('');
    window.setWorking(false);
    window.setSubtask('');
    return demoSequenceRunId;
}

function scheduleDemoStep(runId, delayMs, action) {
    const timerId = setTimeout(() => {
        if (demoSequenceRunId !== runId) return;
        action();
    }, delayMs);
    demoTimers.push(timerId);
}

function runDemoSequence() {
    const runId = resetDemoSequence();
    const startAt = DEMO_START_DELAY_MS;

    scheduleDemoStep(runId, startAt, () => {
        window.setWorking(true);
        setRootEmotion('sparkle', 1200);
    });

    scheduleDemoStep(runId, startAt + 180, () => {
        window.addSubagent({ agentId: 'demo-planner', displayName: 'Planner', role: 'Coordinator' });
        window.addSubagent({ agentId: 'demo-coder', displayName: 'Coder', role: 'Developer' });
        window.addSubagent({ agentId: 'demo-reviewer', displayName: 'Reviewer', role: 'Reviewer' });
        window.setAgentModel({ agentId: 'demo-planner', model: 'gpt-5.4' });
        window.setAgentModel({ agentId: 'demo-coder', model: 'gpt-5.3-codex' });
        window.setAgentModel({ agentId: 'demo-reviewer', model: 'claude-sonnet-4.5' });
    });

    scheduleDemoStep(runId, startAt + 900, () => {
        window.addSubagent({ agentId: 'demo-tester', displayName: 'Tester', role: 'Tester' });
        window.setAgentModel({ agentId: 'demo-tester', model: 'gpt-5-mini' });
    });

    scheduleDemoStep(runId, startAt + 1700, () => {
        window.setAgentActivity({ agentId: 'demo-planner', toolName: 'view' });
        window.setAgentIntent({ agentId: 'demo-planner', intent: 'Mapping the codebase' });
        window.setAgentActivity({ agentId: 'demo-coder', toolName: 'edit' });
        window.setAgentIntent({ agentId: 'demo-coder', intent: 'Implementing the fix' });
        window.setAgentThinking('demo-reviewer');
        window.setAgentIntent({ agentId: 'demo-reviewer', intent: 'Reviewing the approach' });
        window.setAgentActivity({ agentId: 'demo-tester', toolName: 'powershell' });
        window.setAgentIntent({ agentId: 'demo-tester', intent: 'Running checks' });
    });

    scheduleDemoStep(runId, startAt + 4200, () => {
        setRootEmotion('heart', 1700);
        window.setAgentExpression({ agentId: 'demo-coder', expression: 'heart', durationMs: 2200 });
    });

    scheduleDemoStep(runId, startAt + 6200, () => {
        window.clearAgentActivity({ agentId: 'demo-planner', toolName: 'view' });
        window.completeSubagent({ agentId: 'demo-planner', totalToolCalls: 3 });
    });

    scheduleDemoStep(runId, startAt + 7200, () => {
        setRootEmotion('party', 1800);
        triggerRootBurst('party');
    });

    scheduleDemoStep(runId, startAt + 8200, () => {
        window.addSubagent({ agentId: 'demo-docs', displayName: 'Docs', role: 'Writer' });
        window.setAgentActivity({ agentId: 'demo-docs', toolName: 'edit' });
        window.setAgentIntent({ agentId: 'demo-docs', intent: 'Writing release notes' });
    });

    scheduleDemoStep(runId, startAt + 10400, () => {
        window.clearAgentActivity({ agentId: 'demo-tester', toolName: 'powershell' });
        window.failSubagent({ agentId: 'demo-tester', error: 'Smoke test failed' });
    });

    scheduleDemoStep(runId, startAt + 12200, () => {
        window.completeSubagent({ agentId: 'demo-reviewer', totalToolCalls: 2 });
    });

    scheduleDemoStep(runId, startAt + 14000, () => {
        window.clearAgentActivity({ agentId: 'demo-docs', toolName: 'edit' });
        window.completeSubagent({ agentId: 'demo-docs', totalToolCalls: 1 });
    });

    scheduleDemoStep(runId, startAt + 15600, () => {
        window.clearAgentActivity({ agentId: 'demo-coder', toolName: 'edit' });
        window.setAgentExpression({ agentId: 'demo-coder', expression: 'sparkle', durationMs: 1600 });
        window.completeSubagent({ agentId: 'demo-coder', totalToolCalls: 4 });
    });

    scheduleDemoStep(runId, startAt + 17600, () => {
        window.setWorking(false);
        window.setSubtask('');
        setRootEmotion('success', 1600);
    });

    return 'queued';
}

window.showMessage = (text) => {
    if (fadeTimeout) clearTimeout(fadeTimeout);
    registerRootActivity();

    const emotion = detectEmotion(text);
    if (emotion) {
        setRootEmotion(emotion, emotion === 'party' ? 5200 : EMOTION_HOLD_MS);
        if (emotion === 'party' || emotion === 'sparkle') {
            triggerRootBurst(emotion);
        }
    }

    if (isClippyAvatar()) {
        clearMessageOverlay();
        pendingClippyMessage = text || '';
        return;
    }

    speak(text);
    if (!showSpokenText || !text) {
        clearMessageOverlay();
        return;
    }

    messageEl.classList.remove('fading');
    messageEl.classList.add('visible');
    messageEl.textContent = text;

    fadeTimeout = setTimeout(() => {
        messageEl.classList.add('fading');
        messageEl.classList.remove('visible');
    }, MESSAGE_FADE_MS);
};

window.setWorking = (active) => {
    if (active) {
        if (!rootWorking) {
            clearRootTransientActivity();
        }
        registerRootActivity();
    } else {
        activeSubtaskText = '';
        clearRootTransientActivity();
    }
    rootWorking = !!active;
    updateStatusIndicator();
    updateSubtaskDisplay();
    updateRootModelIndicator();
};

window.setSubtask = (text) => {
    const nextText = shouldSuppressRootChromeText(text) ? '' : (text || '');
    if (nextText) registerRootActivity();
    activeSubtaskText = nextText;
    updateSubtaskDisplay();
};

window.setSquadContext = (payload = {}) => {
    squadRootMicActive = !!payload.active;
    idleStatusText = '';
    idleSubtaskText = '';
    updateRootSquadMicBoom();
    if (!rootWorking) {
        updateSubtaskDisplay();
    }
    updateStatusIndicator();
};

window.resetRootActivity = (payload = {}) => {
    rootWorking = false;
    activeSubtaskText = '';
    clearRootTransientActivity({ clearIntent: !!payload.clearIntent });
    updateStatusIndicator();
    updateSubtaskDisplay();
    updateRootModelIndicator();
};

window.addSubagent = (payload = {}) => {
    if (!payload.agentId) {
        pendingSubagents.push(payload);
        return;
    }

    const avatar = ensureAvatar(payload.agentId, payload);
    avatar.targetPresence = 1;
    avatar.presence = Math.max(avatar.presence, 0.01);
    avatar.leaving = false;
    avatar.inLayout = true;
    avatar.effectState = 'idle';
    avatar.leaveAt = 0;
    layoutSubagents();
};

window.clearSubagents = (payload = {}) => {
    clearSubagents(payload);
};

window.removeSubagent = (payload = {}) => {
    if (!payload.agentId) return;
    if (!avatars.has(payload.agentId)) {
        clearPendingAgentState(payload.agentId);
        return;
    }

    const avatar = avatars.get(payload.agentId);
    if (!avatar || avatar.isRoot) return;
    avatar.activeTools.clear();
    avatar.thinkingUntil = 0;
    avatar.intentText = '';
    avatar.intentUntil = 0;
    avatar.effectState = 'idle';
    avatar.leaveAt = performance.now();
    beginAvatarRemoval(avatar);
};

window.completeSubagent = (payload = {}) => {
    if (!payload.agentId) return;
    if (!avatars.has(payload.agentId)) {
        clearPendingAgentState(payload.agentId);
        return;
    }
    const avatar = ensureAvatar(payload.agentId, payload);
    avatar.activeTools.clear();
    avatar.thinkingUntil = 0;
    avatar.effectState = 'success';
    avatar.leaveAt = performance.now() + COMPLETION_HOLD_MS;
    avatar.scalePulseUntil = performance.now() + 700;
    avatar.happyBlinkUntil = performance.now() + 420;
    avatar.intentText = payload.totalToolCalls != null ? `${payload.totalToolCalls} tool calls` : 'Completed';
    avatar.intentUntil = performance.now() + COMPLETION_HOLD_MS;
    setAvatarExpression(avatar, 'success', COMPLETION_HOLD_MS);
    spawnParticleBurst(avatar, 42);
};

window.failSubagent = (payload = {}) => {
    if (!payload.agentId) return;
    if (!avatars.has(payload.agentId)) {
        clearPendingAgentState(payload.agentId);
        return;
    }
    const avatar = ensureAvatar(payload.agentId, payload);
    avatar.activeTools.clear();
    avatar.thinkingUntil = 0;
    avatar.effectState = 'failed';
    avatar.leaveAt = performance.now() + FAILURE_HOLD_MS;
    avatar.flashUntil = performance.now() + 360;
    avatar.shakeUntil = performance.now() + 720;
    avatar.intentText = humanizeError(payload.error);
    avatar.intentUntil = performance.now() + FAILURE_HOLD_MS;
    setAvatarExpression(avatar, 'failed', FAILURE_HOLD_MS);
};

window.setAgentActivity = (payload = {}) => {
    const resolvedId = payload.agentId || ROOT_AGENT_ID;
    if (resolvedId !== ROOT_AGENT_ID && !avatars.has(resolvedId)) {
        if (!hasStrongAgentIdentity(resolvedId, payload)) {
            queuePendingAgentActivity(resolvedId, payload);
            return;
        }
    }
    const avatar = ensureAvatar(resolvedId, payload);
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;
    if (avatar.isRoot && shouldSuppressRootToolName(payload.toolName)) {
        clearAvatarToolActivity(avatar, payload);
        updateRootModelIndicator();
        updateSubtaskDisplay();
        return;
    }
    const key = getToolActivityKey(payload);
    const existingEntry = avatar.activeTools.get(key);
    avatar.activeTools.set(key, {
        toolName: payload.toolName || '',
        activityLabel: payload.activityLabel || describeToolActivity(payload.toolName || '') || formatToolLabel(payload.toolName || ''),
        explicitActivityLabel: !!payload.activityLabel,
        activity: classifyTool(payload.toolName || ''),
        startedAt: existingEntry?.startedAt ?? performance.now(),
    });
    avatar.effectState = 'idle';
    if (avatar.isRoot) {
        registerRootActivity();
        updateRootModelIndicator();
        updateSubtaskDisplay();
    }
};

window.clearAgentActivity = (payload = {}) => {
    const resolvedId = payload.agentId || ROOT_AGENT_ID;
    const avatar = avatars.get(resolvedId);
    if (!avatar && resolvedId !== ROOT_AGENT_ID) {
        clearPendingAgentActivity(resolvedId, payload);
        return;
    }
    if (!avatar) return;
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;

    clearAvatarToolActivity(avatar, payload);

    if (avatar.isRoot) {
        updateRootModelIndicator();
        updateSubtaskDisplay();
    }
};

window.setAgentThinking = (payload = {}) => {
    const data = typeof payload === 'object' && payload !== null ? payload : { agentId: payload };
    const resolvedId = data.agentId || ROOT_AGENT_ID;
    if (resolvedId !== ROOT_AGENT_ID && !avatars.has(resolvedId)) {
        if (!hasStrongAgentIdentity(resolvedId, data)) {
            pendingAgentThinking.add(resolvedId);
            return;
        }
    }
    const avatar = ensureAvatar(resolvedId, data);
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;
    avatar.thinkingUntil = performance.now() + THINKING_HOLD_MS;
    if (avatar.isRoot) {
        registerRootActivity();
        updateRootModelIndicator();
    }
};

window.setAgentIntent = (payload = {}) => {
    const resolvedId = payload.agentId || ROOT_AGENT_ID;
    if (resolvedId !== ROOT_AGENT_ID && !avatars.has(resolvedId)) {
        if (!hasStrongAgentIdentity(resolvedId, payload)) {
            pendingAgentIntents.set(resolvedId, payload);
            return;
        }
    }
    const avatar = ensureAvatar(resolvedId, payload);
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;
    avatar.intentText = avatar.isRoot && shouldSuppressRootChromeText(payload.intent)
        ? ''
        : (payload.intent || '');
    avatar.intentUntil = performance.now() + INTENT_HOLD_MS;
    if (avatar.isRoot) {
        registerRootActivity();
        updateRootModelIndicator();
    }
};

window.setAgentExpression = (payload = {}) => {
    const avatar = ensureAvatar(payload.agentId || ROOT_AGENT_ID, payload);
    const expression = payload.expression || 'default';
    const durationMs = Math.max(100, Number(payload.durationMs) || 4000);
    setAvatarExpression(avatar, expression, durationMs);
};

const VOXTRAL_VOICES_FALLBACK = [
    { slug: 'en_paul_neutral',    name: 'Paul - Neutral'    },
    { slug: 'en_paul_happy',      name: 'Paul - Happy'      },
    { slug: 'en_paul_confident',  name: 'Paul - Confident'  },
    { slug: 'en_paul_cheerful',   name: 'Paul - Cheerful'   },
    { slug: 'en_paul_excited',    name: 'Paul - Excited'    },
    { slug: 'en_paul_sad',        name: 'Paul - Sad'        },
    { slug: 'en_paul_frustrated', name: 'Paul - Frustrated' },
    { slug: 'en_paul_angry',      name: 'Paul - Angry'      },
    { slug: 'gb_oliver_neutral',  name: 'Oliver - Neutral'  },
    { slug: 'gb_jane_sarcasm',    name: 'Jane - Sarcasm'    },
];

// Voice presets: pitch = fundamental frequency (Hz), formantShift = F1/F2 multiplier,
// rate = duration compression factor (>1 = faster).
const SAM_VOICES = [
    { id: 'sam',     name: 'SAM (Default)', pitch: 120, formantShift: 1.00, rate: 1.00 },
    { id: 'elf',     name: 'Elf',           pitch: 240, formantShift: 1.45, rate: 1.20 },
    { id: 'cylon',   name: 'Cylon',         pitch:  78, formantShift: 0.68, rate: 0.82 },
    { id: 'vader',   name: 'Darth Vader',   pitch:  58, formantShift: 0.60, rate: 0.72 },
    { id: 'stuffy',  name: 'Stuffy',        pitch: 102, formantShift: 0.90, rate: 0.86 },
    { id: 'gruff',   name: 'Gruff',         pitch:  68, formantShift: 0.62, rate: 0.78 },
];

let ttsEnabled = false;
let ttsRate = 1.1;
let ttsPitch = 1.0;
let ttsVoiceName = null;
let avatarStyle = 'copilot';
let ttsEngine = 'webspeech';
let voxtralBackend = 'cloud';
let voxtralUrl = 'http://localhost:18000';
let voxtralApiKey = '';
let voxtralVoice = 'en_paul_neutral';
let voxtralVoiceSource = 'preset';
let voxtralRefAudio = null;
let clippyVoxtralVoice = CLIPPY_DEFAULT_VOXTRAL_VOICE;
let elevenlabsApiKey = '';
let elevenlabsVoice = '';
let elevenlabsClonedVoiceId = '';
let elevenlabsClonedVoiceName = '';
let elevenlabsCloneSourceHash = '';
let clippyElevenlabsVoiceId = '';
let clippyElevenlabsVoiceName = '';
let clippyElevenlabsCloneSourceHash = '';
let clippyRefAudio = null;
let samVoice = 'sam';
let ttsAudioPlayer = null;
let voxtralAudioCtx = null;
let activeGeneratedAudioUrl = null;
let speechRequestId = 0;
let elevenlabsVoicesRequestId = 0;
let elevenlabsCloneBusy = false;
let voicePreviewBusy = false;
let showSpokenText = true;
let showAvatarBadges = true;
let showModelBadges = false;
let transparentWindow = true;

function getVoxtralAudioCtx() {
    if (!voxtralAudioCtx || voxtralAudioCtx.state === 'closed') {
        voxtralAudioCtx = new AudioContext();
    }
    return voxtralAudioCtx;
}

function applyVoiceWarming(audio) {
    try {
        const ctx = getVoxtralAudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
        const src = ctx.createMediaElementSource(audio);

        // Warmth: boost low-mids for a fuller, less tinny sound
        const warmth = ctx.createBiquadFilter();
        warmth.type = 'lowshelf';
        warmth.frequency.value = 320;
        warmth.gain.value = 8;

        // Presence: slight mid boost for clarity
        const presence = ctx.createBiquadFilter();
        presence.type = 'peaking';
        presence.frequency.value = 2400;
        presence.Q.value = 0.7;
        presence.gain.value = 2;

        // De-harsh: cut the sibilant/robotic highs
        const deharsh = ctx.createBiquadFilter();
        deharsh.type = 'highshelf';
        deharsh.frequency.value = 5500;
        deharsh.gain.value = -8;

        // Compression: even out the voice dynamics
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.knee.value = 10;
        comp.ratio.value = 3;
        comp.attack.value = 0.004;
        comp.release.value = 0.2;

        src.connect(warmth);
        warmth.connect(presence);
        presence.connect(deharsh);
        deharsh.connect(comp);
        comp.connect(ctx.destination);
    } catch (e) {
        // If Web Audio fails (e.g. element already sourced), play unprocessed
        console.warn('Voice warming unavailable:', e.message);
    }
}

// Recording state
let mediaRecorder = null;
let recordingChunks = [];
let recordingTimerInterval = null;
let recordingStartTime = 0;

let savedTts = {};
try {
    savedTts = await copilot.loadSettings() || {};
} catch {
    savedTts = {};
}

let suppressAutoWindowSizeSaveUntil = 0;

if (savedTts.windowWidth && savedTts.windowHeight && savedTts.windowSizeUnits !== 'physical') {
    const scale = Math.max(1, Number(window.devicePixelRatio) || 1);
    savedTts.windowWidth = Math.max(320, Math.round(savedTts.windowWidth * scale));
    savedTts.windowHeight = Math.max(360, Math.round(savedTts.windowHeight * scale));
    savedTts.windowSizeUnits = 'physical';
    suppressAutoWindowSizeSaveUntil = performance.now() + 1500;
    copilot.saveSettings({
        windowWidth: savedTts.windowWidth,
        windowHeight: savedTts.windowHeight,
        windowSizeUnits: savedTts.windowSizeUnits,
    }).catch(() => {});
}

function readWindowSize() {
    const scale = Math.max(1, Number(window.devicePixelRatio) || 1);
    return {
        windowWidth: Math.max(320, Math.round((window.outerWidth || window.innerWidth || container.clientWidth || 600) * scale)),
        windowHeight: Math.max(360, Math.round((window.outerHeight || window.innerHeight || container.clientHeight || 800) * scale)),
        windowSizeUnits: 'physical',
    };
}

let saveWindowSizeTimer = null;

function scheduleWindowSizeSave() {
    if (performance.now() < suppressAutoWindowSizeSaveUntil) {
        return;
    }

    if (saveWindowSizeTimer) {
        clearTimeout(saveWindowSizeTimer);
    }

    saveWindowSizeTimer = setTimeout(() => {
        saveWindowSizeTimer = null;
        copilot.saveSettings(readWindowSize()).catch(() => {});
    }, 220);
}

if (savedTts.rate) {
    ttsRate = savedTts.rate;
    ttsRateInput.value = ttsRate;
    ttsRateValue.textContent = `${ttsRate.toFixed(1)}×`;
}
if (savedTts.pitch != null) {
    ttsPitch = savedTts.pitch;
    ttsPitchInput.value = ttsPitch;
    ttsPitchValue.textContent = ttsPitch.toFixed(1);
}
if (savedTts.voice) {
    ttsVoiceName = savedTts.voice;
}
if (savedTts.enabled) {
    ttsEnabled = true;
}
if (savedTts.avatarStyle) {
    avatarStyle = savedTts.avatarStyle;
    avatarStyleSelect.value = avatarStyle;
}
if (savedTts.engine) {
    ttsEngine = savedTts.engine;
    ttsEngineSelect.value = ttsEngine;
}
if (savedTts.voxtralBackend) {
    voxtralBackend = savedTts.voxtralBackend;
    document.querySelectorAll('input[name="voxtral-backend"]').forEach((r) => {
        r.checked = r.value === voxtralBackend;
    });
}
if (savedTts.voxtralUrl) {
    voxtralUrl = savedTts.voxtralUrl;
    voxtralUrlInput.value = voxtralUrl;
}
if (savedTts.voxtralApiKey) {
    voxtralApiKey = savedTts.voxtralApiKey;
    voxtralApikeyInput.value = voxtralApiKey;
}
if (savedTts.voxtralVoice) {
    voxtralVoice = savedTts.voxtralVoice;
}
if (savedTts.clippyVoxtralVoice && savedTts.clippyVoxtralVoice !== CLIPPY_LEGACY_DEFAULT_VOXTRAL_VOICE) {
    clippyVoxtralVoice = savedTts.clippyVoxtralVoice;
}
if (savedTts.voxtralVoiceSource) {
    voxtralVoiceSource = savedTts.voxtralVoiceSource;
    document.querySelectorAll('input[name="ai-voice-source"]').forEach((radio) => {
        radio.checked = radio.value === voxtralVoiceSource;
    });
}
if (savedTts.elevenlabsApiKey) {
    elevenlabsApiKey = savedTts.elevenlabsApiKey;
    elevenlabsApikeyInput.value = elevenlabsApiKey;
}
if (savedTts.elevenlabsVoice) {
    elevenlabsVoice = savedTts.elevenlabsVoice;
}
if (savedTts.elevenlabsClonedVoiceId) {
    elevenlabsClonedVoiceId = savedTts.elevenlabsClonedVoiceId;
}
if (savedTts.elevenlabsClonedVoiceName) {
    elevenlabsClonedVoiceName = savedTts.elevenlabsClonedVoiceName;
}
if (savedTts.elevenlabsCloneSourceHash) {
    elevenlabsCloneSourceHash = savedTts.elevenlabsCloneSourceHash;
}
if (savedTts.clippyElevenlabsVoiceId) {
    clippyElevenlabsVoiceId = savedTts.clippyElevenlabsVoiceId;
}
if (savedTts.clippyElevenlabsVoiceName) {
    clippyElevenlabsVoiceName = savedTts.clippyElevenlabsVoiceName;
}
if (savedTts.clippyElevenlabsCloneSourceHash) {
    clippyElevenlabsCloneSourceHash = savedTts.clippyElevenlabsCloneSourceHash;
}
if (savedTts.clippyRefAudio) {
    clippyRefAudio = savedTts.clippyRefAudio;
}
if (savedTts.voxtralRefAudio) {
    setVoxtralRefAudio(savedTts.voxtralRefAudio, { rememberForClippy: false, save: false });
}
if (savedTts.samVoice) {
    samVoice = savedTts.samVoice;
}
if (savedTts.showSpokenText != null) {
    showSpokenText = !!savedTts.showSpokenText;
}
if (savedTts.showAvatarBadges != null) {
    showAvatarBadges = !!savedTts.showAvatarBadges;
}
if (savedTts.showModelBadges != null) {
    showModelBadges = !!savedTts.showModelBadges;
}
if (savedTts.transparentWindow != null) {
    transparentWindow = !!savedTts.transparentWindow;
}
setSettingsTab('general');
applyAvatarStyle({ enforceVoiceDefaults: avatarStyle === 'clippy' });
updateTtsButton();
updateEngineUI();
updateMessageVisibility();
updateBadgeVisibility();
updateWindowTransparency();
updateVoicePreviewButtons();

function saveTtsSettings() {
    copilot.saveSettings({
        enabled: ttsEnabled,
        rate: ttsRate,
        pitch: ttsPitch,
        voice: ttsVoiceName,
        avatarStyle,
        engine: ttsEngine,
        voxtralBackend,
        voxtralUrl,
        voxtralApiKey,
        voxtralVoice,
        voxtralVoiceSource,
        voxtralRefAudio,
        clippyVoxtralVoice,
        elevenlabsApiKey,
        elevenlabsVoice,
        elevenlabsClonedVoiceId,
        elevenlabsClonedVoiceName,
        elevenlabsCloneSourceHash,
        clippyElevenlabsVoiceId,
        clippyElevenlabsVoiceName,
        clippyElevenlabsCloneSourceHash,
        clippyRefAudio,
        samVoice,
        showSpokenText,
        showAvatarBadges,
        showModelBadges,
        transparentWindow,
        ...readWindowSize(),
    }).catch(() => {});
}

function updateBackendUI() {
    const isCloud = voxtralBackend === 'cloud';
    voxtralCloudSection.classList.toggle('hidden', !isCloud);
    voxtralLocalSection.classList.toggle('hidden', isCloud);
    fetchVoxtralVoices();
}

function updateEngineUI() {
    const isVoxtral = ttsEngine === 'voxtral';
    const isElevenLabs = ttsEngine === 'elevenlabs';
    const isSam = ttsEngine === 'sam';
    const isAiEngine = isVoxtral || isElevenLabs;
    const isMyVoice = voxtralVoiceSource === 'myvoice';
    ttsWebspeechSection.classList.toggle('hidden', isAiEngine || isSam);
    ttsVoxtralSection.classList.toggle('hidden', !isVoxtral);
    ttsElevenlabsSection.classList.toggle('hidden', !isElevenLabs);
    ttsSamSection.classList.toggle('hidden', !isSam);
    ttsAiVoiceSection.classList.toggle('hidden', !isAiEngine);
    ttsAiVoiceSourceLabel.classList.toggle('hidden', !isVoxtral);
    ttsAiPresetSection.classList.toggle('hidden', !isElevenLabs && (!isVoxtral || isMyVoice));
    ttsAiRecordSection.classList.toggle('hidden', !isVoxtral || !isMyVoice);
    voxtralVoiceSelect.parentElement.classList.toggle('hidden', !isVoxtral);
    elevenlabsPresetSection.classList.toggle('hidden', !isElevenLabs);
    if (isVoxtral) {
        updateBackendUI();
    }
    if (isElevenLabs) {
        fetchElevenLabsVoices();
    }
    updateElevenLabsCloneUI();
    updateVoicePreviewButtons();
}

function populateVoices() {
    const voices = speechSynthesis.getVoices();
    ttsVoiceSelect.innerHTML = '';
    voices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        option.selected = voice.name === ttsVoiceName;
        ttsVoiceSelect.appendChild(option);
    });
    updateVoicePreviewButtons();
}

function populateVoxtralVoices(voices) {
    voxtralVoiceSelect.innerHTML = '';
    voices.forEach((v) => {
        const slug = typeof v === 'string' ? v : v.slug;
        const label = typeof v === 'string' ? v.replace(/_/g, ' ') : v.name;
        const option = document.createElement('option');
        option.value = slug;
        option.textContent = label;
        option.selected = slug === voxtralVoice;
        voxtralVoiceSelect.appendChild(option);
    });
    // Sync state var to actual selected value — saved voice may no longer be valid
    voxtralVoice = voxtralVoiceSelect.value;
    updateVoicePreviewButtons();
    saveTtsSettings();
}

function populateElevenLabsVoices(voices, { placeholder = 'Select a voice', preserveSelection = true } = {}) {
    const previousVoice = elevenlabsVoice;
    elevenlabsVoiceSelect.innerHTML = '';
    if (!voices.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = placeholder;
        option.selected = true;
        elevenlabsVoiceSelect.appendChild(option);
        if (!preserveSelection) {
            elevenlabsVoice = '';
        }
        updateVoicePreviewButtons();
        return;
    }
    voices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.voice_id;
        option.textContent = voice.name || voice.voice_id;
        option.selected = voice.voice_id === previousVoice;
        elevenlabsVoiceSelect.appendChild(option);
    });
    if (previousVoice && voices.some((voice) => voice.voice_id === previousVoice)) {
        elevenlabsVoiceSelect.value = previousVoice;
        elevenlabsVoice = previousVoice;
    } else {
        elevenlabsVoiceSelect.selectedIndex = 0;
        elevenlabsVoice = elevenlabsVoiceSelect.value;
    }
    updateVoicePreviewButtons();
}

async function readErrorDetail(res) {
    try {
        const data = await res.clone().json();
        return data.detail?.message || data.detail || data.message || JSON.stringify(data);
    } catch {
        try {
            return await res.text();
        } catch {
            return `HTTP ${res.status}`;
        }
    }
}

async function fetchVoxtralVoices() {
    try {
        const isCloud = voxtralBackend === 'cloud';
        const url = isCloud
            ? 'https://api.mistral.ai/v1/audio/voices'
            : `${voxtralUrl}/v1/audio/voices`;
        const headers = { 'Content-Type': 'application/json' };
        if (voxtralApiKey) headers['Authorization'] = `Bearer ${voxtralApiKey}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
            const data = await res.json();
            // Mistral cloud: { items: [{slug, name}] }
            // vllm-omni local: plain array or { voices: [...] }
            const list = data.items ?? (Array.isArray(data) ? data : data.voices);
            if (list && list.length) {
                populateVoxtralVoices(list);
                return;
            }
        }
    } catch {
        // fall through to defaults
    }
    populateVoxtralVoices(VOXTRAL_VOICES_FALLBACK);
}

async function fetchElevenLabsVoices({ force = false } = {}) {
    if (!elevenlabsApiKey) {
        populateElevenLabsVoices([], { placeholder: 'Enter API key to load voices' });
        updateElevenLabsCloneUI();
        return;
    }
    if (!force && elevenlabsVoiceSelect.options.length > 1) {
        updateElevenLabsCloneUI();
        return;
    }
    const requestId = ++elevenlabsVoicesRequestId;
    populateElevenLabsVoices([], { placeholder: 'Loading ElevenLabs voices...' });
    try {
        const res = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': elevenlabsApiKey },
        });
        if (!res.ok) {
            throw new Error(await readErrorDetail(res));
        }
        const data = await res.json();
        if (requestId !== elevenlabsVoicesRequestId) {
            return;
        }
        const voices = Array.isArray(data?.voices) ? data.voices : [];
        populateElevenLabsVoices(voices, { placeholder: 'No voices available' });
        saveTtsSettings();
    } catch (error) {
        console.error('ElevenLabs voice fetch failed:', error);
        if (requestId !== elevenlabsVoicesRequestId) {
            return;
        }
        populateElevenLabsVoices([], { placeholder: 'Unable to load voices' });
    } finally {
        updateElevenLabsCloneUI();
    }
}

populateVoxtralVoices(VOXTRAL_VOICES_FALLBACK);
speechSynthesis.onvoiceschanged = populateVoices;
populateVoices();

function populateSamVoices() {
    samVoiceSelect.innerHTML = '';
    SAM_VOICES.forEach(({ id, name }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        option.selected = id === samVoice;
        samVoiceSelect.appendChild(option);
    });
    if (!SAM_VOICES.some(v => v.id === samVoice)) {
        samVoiceSelect.selectedIndex = 0;
        samVoice = samVoiceSelect.value;
    }
    updateVoicePreviewButtons();
}

populateSamVoices();

// ── Recording ─────────────────────────────────────────────────────────────────

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
}

async function hashReferenceAudio(dataUrl) {
    const blob = await dataUrlToBlob(dataUrl);
    const buffer = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function extensionForMimeType(type = '') {
    if (/wav/i.test(type)) return 'wav';
    if (/mpeg|mp3/i.test(type)) return 'mp3';
    if (/ogg/i.test(type)) return 'ogg';
    if (/webm/i.test(type)) return 'webm';
    return 'wav';
}

/** Convert an AudioBuffer to a WAV data URL (PCM 16-bit little-endian) */
function audioBufferToWavDataUrl(audioBuffer) {
    const numChannels = 1; // mono
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.getChannelData(0);
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const dataLen = pcm.byteLength;
    const buffer = new ArrayBuffer(44 + dataLen);
    const view = new DataView(buffer);
    const write = (off, val, len) => {
        if (len === 4) view.setUint32(off, val, true);
        else view.setUint16(off, val, true);
    };
    const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    write(4, 36 + dataLen, 4);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    write(16, 16, 4);       // PCM chunk size
    write(20, 1, 2);        // PCM format
    write(22, numChannels, 2);
    write(24, sampleRate, 4);
    write(28, sampleRate * numChannels * 2, 4); // byte rate
    write(32, numChannels * 2, 2);              // block align
    write(34, 16, 2);       // bits per sample
    writeStr(36, 'data');
    write(40, dataLen, 4);
    new Uint8Array(buffer, 44).set(new Uint8Array(pcm.buffer));
    // Encode as base64 data URL
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(binary);
}

async function audioFileToVoxtralRefAudio(file) {
    const originalDataUrl = await blobToBase64(file);
    if (/audio\/(wav|mpeg|mp3)/i.test(file.type)) {
        return originalDataUrl;
    }

    try {
        const arrayBuf = await file.arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        return audioBufferToWavDataUrl(decoded);
    } catch {
        return originalDataUrl;
    }
}

async function deleteElevenLabsVoice(voiceId) {
    if (!voiceId || !elevenlabsApiKey) return;
    const res = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': elevenlabsApiKey },
    });
    if (!res.ok && res.status !== 404) {
        throw new Error(await readErrorDetail(res));
    }
}

async function createOrReplaceElevenLabsClone({ clippy = isClippyAvatar() } = {}) {
    const activeRefAudio = getActiveReferenceAudio({ clippy });
    if (!elevenlabsApiKey) {
        setElevenLabsCloneStatus('Enter your ElevenLabs API key first.');
        return;
    }
    if (!activeRefAudio) {
        setElevenLabsCloneStatus('Record, import, or generate a sample before creating a cloned voice.');
        return;
    }

    elevenlabsCloneBusy = true;
    updateElevenLabsCloneUI();
    try {
        const sourceHash = await hashReferenceAudio(activeRefAudio);
        const existingClone = getElevenLabsCloneState({ clippy });
        if (existingClone.voiceId && existingClone.sourceHash === sourceHash) {
            setElevenLabsCloneStatus(`Using cloned ElevenLabs voice: ${existingClone.voiceName || existingClone.voiceId}`);
            return;
        }
        if (existingClone.voiceId) {
            await deleteElevenLabsVoice(existingClone.voiceId);
            setElevenLabsCloneState({}, { clippy, save: false });
        }

        const blob = await dataUrlToBlob(activeRefAudio);
        const filename = clippy
            ? `clippy-reference.${extensionForMimeType(blob.type)}`
            : `avatar-reference.${extensionForMimeType(blob.type)}`;
        const form = new FormData();
        form.append('name', clippy ? 'Copilot Avatar Clippy' : 'Copilot Avatar Voice');
        form.append(
            'description',
            clippy
                ? 'Clippy reference voice created from Copilot Avatar settings.'
                : 'Custom reference voice created from Copilot Avatar settings.',
        );
        form.append('files', new File([blob], filename, { type: blob.type || 'audio/wav' }));

        const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
            method: 'POST',
            headers: { 'xi-api-key': elevenlabsApiKey },
            body: form,
        });
        if (!res.ok) {
            throw new Error(await readErrorDetail(res));
        }

        const data = await res.json();
        setElevenLabsCloneState(
            {
                voiceId: data.voice_id || '',
                voiceName: data.name || '',
                sourceHash,
            },
            { clippy, save: false },
        );
        setElevenLabsCloneStatus(`Created ElevenLabs voice: ${data.name || data.voice_id}`);
        await fetchElevenLabsVoices({ force: true });
        saveTtsSettings();
    } catch (error) {
        console.error('ElevenLabs clone creation failed:', error);
        setElevenLabsCloneStatus(`ElevenLabs clone failed: ${error?.message || error}`);
    } finally {
        elevenlabsCloneBusy = false;
        updateElevenLabsCloneUI();
    }
}

async function deleteActiveElevenLabsClone({ clippy = isClippyAvatar() } = {}) {
    const existingClone = getElevenLabsCloneState({ clippy });
    if (!existingClone.voiceId) {
        setElevenLabsCloneStatus('');
        return;
    }

    elevenlabsCloneBusy = true;
    updateElevenLabsCloneUI();
    try {
        await deleteElevenLabsVoice(existingClone.voiceId);
        setElevenLabsCloneState({}, { clippy, save: false });
        setElevenLabsCloneStatus('Deleted cloned ElevenLabs voice.');
        await fetchElevenLabsVoices({ force: true });
        saveTtsSettings();
    } catch (error) {
        console.error('ElevenLabs clone deletion failed:', error);
        setElevenLabsCloneStatus(`Unable to delete cloned voice: ${error?.message || error}`);
    } finally {
        elevenlabsCloneBusy = false;
        updateElevenLabsCloneUI();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordingChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordingChunks.push(e.data);
        };
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            const webmBlob = new Blob(recordingChunks, { type: 'audio/webm' });
            // Convert webm → WAV so Mistral ref_audio accepts it
            try {
                const arrayBuf = await webmBlob.arrayBuffer();
                const ctx = new AudioContext();
                const decoded = await ctx.decodeAudioData(arrayBuf);
                const wavDataUrl = audioBufferToWavDataUrl(decoded);
                setVoxtralRefAudio(wavDataUrl, { save: false });
            } catch {
                // Fallback: store webm (may not work with Mistral but at least saves)
                const dataUrl = await blobToBase64(webmBlob);
                setVoxtralRefAudio(dataUrl, { save: false });
            }
            voxtralAudioPreview.classList.remove('hidden');
            voxtralRerecordBtn.classList.remove('hidden');
            voxtralRecordBtn.classList.add('hidden');
            voxtralRecordBtn.classList.remove('recording');
            voxtralStopBtn.classList.add('hidden');
            voxtralRecordTimer.classList.add('hidden');
            clearInterval(recordingTimerInterval);
            saveTtsSettings();
        };
        mediaRecorder.start();
        recordingStartTime = Date.now();
        voxtralRecordBtn.classList.add('recording');
        voxtralRecordTimer.textContent = '0s';
        voxtralRecordTimer.classList.remove('hidden');
        voxtralStopBtn.classList.remove('hidden');
        voxtralAudioPreview.classList.add('hidden');
        voxtralRerecordBtn.classList.add('hidden');
        recordingTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            voxtralRecordTimer.textContent = `${elapsed}s`;
        }, 500);
    } catch (err) {
        console.error('Microphone access denied:', err);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

async function generateRetroClippyVoice() {
    const previousText = clippyRetroVoiceBtn.textContent;
    clippyRetroVoiceBtn.disabled = true;
    clippyRetroVoiceBtn.textContent = 'Generating...';
    try {
        const dataUrl = await copilot.generateRetroClippyVoice();
        avatarStyle = 'clippy';
        ttsEnabled = true;
        if (ttsEngine !== 'voxtral' && ttsEngine !== 'elevenlabs') {
            ttsEngine = 'voxtral';
        }
        avatarStyleSelect.value = avatarStyle;
        ttsEngineSelect.value = ttsEngine;
        if (ttsEngine === 'voxtral') {
            voxtralVoiceSource = 'myvoice';
            setRadioGroupValue('ai-voice-source', voxtralVoiceSource);
        }
        setVoxtralRefAudio(dataUrl, { rememberForClippy: true, save: false });
        applyAvatarStyle({ enforceVoiceDefaults: true });
        saveTtsSettings();
    } catch (err) {
        console.error('Retro Clippy voice generation failed:', err);
        clippyRetroVoiceBtn.title = 'Not available: remote SAM server removed';
    } finally {
        clippyRetroVoiceBtn.disabled = false;
        clippyRetroVoiceBtn.textContent = previousText;
    }
}

// ── TTS engines ───────────────────────────────────────────────────────────────

function speakWebSpeech(text, { clippy = false } = {}) {
    const requestId = beginSpeechRequest();
    speechSynthesis.cancel();
    stopGeneratedSpeechPlayback();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = ttsRate;
    utterance.pitch = ttsPitch;
    if (ttsVoiceName) {
        const voice = speechSynthesis.getVoices().find((item) => item.name === ttsVoiceName);
        if (voice) utterance.voice = voice;
    }
    if (clippy) {
        setClippySpeaking(true);
        utterance.onend = () => {
            if (isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
        };
        utterance.onerror = () => {
            if (isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
        };
    }
    speechSynthesis.speak(utterance);
}

function releaseGeneratedAudioUrl() {
    if (activeGeneratedAudioUrl) {
        URL.revokeObjectURL(activeGeneratedAudioUrl);
        activeGeneratedAudioUrl = null;
    }
}

function fallbackClippySpeech(text) {
    if (ttsEngine === 'elevenlabs') {
        console.warn('Clippy ElevenLabs speech failed; falling back to Web Speech.');
    } else if (ttsEngine === 'sam') {
        console.warn('Clippy SAM speech failed; falling back to Web Speech.');
    } else if (!clippyRefAudio && !voxtralRefAudio) {
        console.warn('Clippy Voxtral speech failed; falling back to Web Speech. Add a Voxtral API key or local server in settings for Clippy voice cloning.');
    }
    speakWebSpeech(text, { clippy: true });
}

async function speakVoxtral(text, { clippy = false } = {}) {
    const requestId = beginSpeechRequest();
    try {
        speechSynthesis.cancel();
        stopGeneratedSpeechPlayback();
        const isCloud = voxtralBackend === 'cloud';
        const apiUrl = isCloud ? 'https://api.mistral.ai' : voxtralUrl;
        const model = isCloud ? 'voxtral-mini-tts-latest' : 'mistralai/Voxtral-4B-TTS-2603';
        const activeRefAudio = clippy ? (clippyRefAudio || voxtralRefAudio) : voxtralRefAudio;
        const activeVoice = clippy ? (clippyVoxtralVoice || voxtralVoice || CLIPPY_DEFAULT_VOXTRAL_VOICE) : voxtralVoice;
        const body = {
            input: text,
            model,
            response_format: 'wav',
        };
        if ((clippy || voxtralVoiceSource === 'myvoice') && activeRefAudio) {
            // Strip the data URL prefix to get raw base64
            body.ref_audio = activeRefAudio.includes(',')
                ? activeRefAudio.split(',')[1]
                : activeRefAudio;
        } else {
            body.voice_id = activeVoice;
            body.voice = activeVoice;
        }
        const reqHeaders = { 'Content-Type': 'application/json' };
        if (voxtralApiKey) reqHeaders['Authorization'] = `Bearer ${voxtralApiKey}`;
        const res = await fetch(`${apiUrl}/v1/audio/speech`, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(body),
        });
        if (!isCurrentSpeechRequest(requestId)) {
            return;
        }
        if (!res.ok) {
            console.error('Voxtral TTS error:', res.status, await res.text());
            if (clippy && isCurrentSpeechRequest(requestId)) fallbackClippySpeech(text);
            return;
        }
        // Mistral cloud returns { audio_data: "<base64 WAV>" }
        // vllm-omni local returns raw binary audio
        let audioSrc;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await res.json();
            audioSrc = `data:audio/wav;base64,${data.audio_data}`;
        } else {
            const buf = await res.arrayBuffer();
            const binary = String.fromCharCode(...new Uint8Array(buf));
            audioSrc = `data:audio/wav;base64,${btoa(binary)}`;
        }
        if (!isCurrentSpeechRequest(requestId)) {
            return;
        }
        const audio = new Audio(audioSrc);
        applyVoiceWarming(audio);
        ttsAudioPlayer = audio;
        if (clippy) {
            setClippySpeaking(true);
            audio.addEventListener('ended', () => {
                if (isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
            }, { once: true });
            audio.addEventListener('error', () => {
                if (isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
            }, { once: true });
        }
        await audio.play();
    } catch (err) {
        if (clippy && isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
        console.error('Voxtral TTS failed:', err);
        if (clippy && isCurrentSpeechRequest(requestId)) fallbackClippySpeech(text);
    }
}

async function speakElevenLabs(text, { clippy = false } = {}) {
    const requestId = beginSpeechRequest();
    const voiceId = getActiveElevenLabsVoiceId({ clippy });
    if (!elevenlabsApiKey || !voiceId) {
        if (clippy) fallbackClippySpeech(text);
        return;
    }

    try {
        speechSynthesis.cancel();
        stopGeneratedSpeechPlayback();

        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
            method: 'POST',
            headers: {
                'xi-api-key': elevenlabsApiKey,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
            }),
        });
        if (!isCurrentSpeechRequest(requestId)) {
            return;
        }
        if (!res.ok) {
            console.error('ElevenLabs TTS error:', res.status, await readErrorDetail(res));
            if (clippy && isCurrentSpeechRequest(requestId)) fallbackClippySpeech(text);
            return;
        }

        const blob = await res.blob();
        if (!isCurrentSpeechRequest(requestId)) {
            return;
        }
        activeGeneratedAudioUrl = URL.createObjectURL(blob);
        const audio = new Audio(activeGeneratedAudioUrl);
        applyVoiceWarming(audio);
        ttsAudioPlayer = audio;
        if (clippy) {
            setClippySpeaking(true);
            audio.addEventListener('ended', () => {
                if (isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
            }, { once: true });
            audio.addEventListener('error', () => {
                if (isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
            }, { once: true });
        }
        await audio.play();
    } catch (error) {
        if (clippy && isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
        console.error('ElevenLabs TTS failed:', error);
        if (clippy && isCurrentSpeechRequest(requestId)) fallbackClippySpeech(text);
    }
}

function stopAllSpeech() {
    beginSpeechRequest();
    speechSynthesis.cancel();
    stopGeneratedSpeechPlayback();
    setClippySpeaking(false);
}

// ── SAM retro formant synthesizer ─────────────────────────────────────────────
// Original implementation using the Web Audio API OfflineAudioContext.
// Phoneme formant frequencies (F1, F2 in Hz) are empirically measured acoustic
// data from Peterson & Barney (1952) and Hillenbrand et al. (1995) — published
// scientific measurements, not derived from any proprietary codebase.
//
// Each entry: [F1_Hz, F2_Hz, base_duration_ms, voiced]

const SAM_PHONEME_DATA = {
    // Vowels
    AA: [730, 1090, 110, true],   // 'hot'
    AE: [660, 1720, 110, true],   // 'hat'
    AH: [640, 1190,  90, true],   // 'hut'
    AO: [570,  840, 110, true],   // 'hall'
    AW: [650,  800, 180, true],   // 'how'  (diphthong simplified)
    AY: [700, 2200, 180, true],   // 'high' (diphthong simplified)
    EH: [530, 1840,  95, true],   // 'head'
    ER: [490, 1350, 110, true],   // 'bird'
    EY: [420, 2280, 140, true],   // 'hey'  (diphthong simplified)
    IH: [390, 1990,  85, true],   // 'hit'
    IY: [270, 2290,  95, true],   // 'heat'
    OW: [450,  760, 140, true],   // 'hoe'  (diphthong simplified)
    OY: [450, 1840, 180, true],   // 'boy'  (diphthong simplified)
    UH: [440, 1020,  90, true],   // 'hook'
    UW: [300,  870, 100, true],   // 'who'
    // Sonorant consonants (voiced)
    L:  [360, 1000,  55, true],
    M:  [280,  900,  70, true],
    N:  [280, 1700,  65, true],
    NG: [280,  800,  75, true],
    R:  [490, 1350,  55, true],
    W:  [300,  610,  50, true],
    Y:  [270, 2290,  45, true],
    // Voiced stops / fricatives
    B:  [200,  800,  55, true],
    D:  [200, 1700,  50, true],
    DH: [200, 1200,  55, true],
    G:  [200,  800,  65, true],
    JH: [200, 2500,  85, true],
    V:  [200,  900,  65, true],
    Z:  [ 80, 3800,  70, true],
    ZH: [ 80, 2000,  65, true],
    // Unvoiced fricatives / stops (noise-based)
    CH: [  0, 2500,  75, false],
    F:  [  0,  800,  70, false],
    HH: [  0, 1500,  45, false],
    K:  [  0, 1500,  65, false],
    P:  [  0, 1000,  55, false],
    S:  [  0, 4000,  75, false],
    SH: [  0, 2000,  70, false],
    T:  [  0, 1700,  50, false],
    TH: [  0, 1500,  55, false],
};

// Simplified English grapheme-to-phoneme conversion (rule-based, original code).
// Returns an array of ARPAbet-style phoneme tokens plus '_' word-boundary pauses.
function samG2P(text) {
    const phonemes = [];
    const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
    for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi];
        let i = 0;
        while (i < w.length) {
            const c3 = w.slice(i, i + 3);
            const c2 = w.slice(i, i + 2);
            const c  = w[i];
            // Trigraphs
            if (c3 === 'tch') { phonemes.push('CH'); i += 3; continue; }
            if (c3 === 'igh') { phonemes.push('AY'); i += 3; continue; }
            // Digraphs
            if (c2 === 'th') { phonemes.push('TH'); i += 2; continue; }
            if (c2 === 'sh') { phonemes.push('SH'); i += 2; continue; }
            if (c2 === 'ch') { phonemes.push('CH'); i += 2; continue; }
            if (c2 === 'wh') { phonemes.push('W');  i += 2; continue; }
            if (c2 === 'ph') { phonemes.push('F');  i += 2; continue; }
            if (c2 === 'ng') { phonemes.push('NG'); i += 2; continue; }
            if (c2 === 'ck') { phonemes.push('K');  i += 2; continue; }
            if (c2 === 'qu') { phonemes.push('K'); phonemes.push('W'); i += 2; continue; }
            if (c2 === 'ai' || c2 === 'ay') { phonemes.push('EY'); i += 2; continue; }
            if (c2 === 'au' || c2 === 'aw') { phonemes.push('AO'); i += 2; continue; }
            if (c2 === 'ee' || c2 === 'ea') { phonemes.push('IY'); i += 2; continue; }
            if (c2 === 'er') { phonemes.push('ER'); i += 2; continue; }
            if (c2 === 'ew') { phonemes.push('UW'); i += 2; continue; }
            if (c2 === 'ie') { phonemes.push('IY'); i += 2; continue; }
            if (c2 === 'oo') { phonemes.push('UW'); i += 2; continue; }
            if (c2 === 'ou' || c2 === 'ow') { phonemes.push('AW'); i += 2; continue; }
            if (c2 === 'oi' || c2 === 'oy') { phonemes.push('OY'); i += 2; continue; }
            if (c2 === 'or') { phonemes.push('AO'); phonemes.push('R'); i += 2; continue; }
            if (c2 === 'ar') { phonemes.push('AA'); phonemes.push('R'); i += 2; continue; }
            if (c2 === 'ir' || c2 === 'ur') { phonemes.push('ER'); i += 2; continue; }
            // Single characters
            const map = {
                a:'AE', e:'EH', i:'IH', o:'AO', u:'AH',
                b:'B',  c:'K',  d:'D',  f:'F',  g:'G',
                h:'HH', j:'JH', k:'K',  l:'L',  m:'M',
                n:'N',  p:'P',  q:'K',  r:'R',  s:'S',
                t:'T',  v:'V',  w:'W',  x:'K',  y:'IH', z:'Z',
            };
            if (map[c]) phonemes.push(map[c]);
            i++;
        }
        if (wi < words.length - 1) phonemes.push('_');
    }
    return phonemes;
}

// Render phoneme sequence to an AudioBuffer using Web Audio API OfflineAudioContext.
async function synthesizeSamAudio(text, { pitch = 120, formantShift = 1.0, rate = 1.0 } = {}) {
    const sampleRate = 22050;
    const phonemes = samG2P(text);

    // Pre-calculate total duration so we can size the offline context upfront.
    let totalMs = 100;
    for (const ph of phonemes) {
        if (ph === '_') { totalMs += 80; continue; }
        const d = SAM_PHONEME_DATA[ph];
        if (d) totalMs += d[2] / rate;
    }
    totalMs += 200;

    const totalSamples = Math.ceil((totalMs / 1000) * sampleRate);
    const ctx = new OfflineAudioContext(1, totalSamples, sampleRate);

    // Light compression prevents clipping when many phonemes overlap in gain ramps.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.1;
    comp.connect(ctx.destination);

    let t = 0.1;

    for (const ph of phonemes) {
        if (ph === '_') { t += 0.08; continue; }
        const phData = SAM_PHONEME_DATA[ph];
        if (!phData) continue;

        const [f1Base, f2Base, durMs, voiced] = phData;
        const dur = (durMs / 1000) / rate;
        const f1 = f1Base * formantShift;
        const f2 = f2Base * formantShift;

        const env = ctx.createGain();
        const rampUp = Math.min(0.008, dur * 0.15);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.35, t + rampUp);
        env.gain.setValueAtTime(0.35, t + dur * 0.75);
        env.gain.linearRampToValueAtTime(0, t + dur);
        env.connect(comp);

        if (voiced && f1Base > 0) {
            // Sawtooth oscillator through two resonant bandpass formant filters.
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = pitch;

            const bpf1 = ctx.createBiquadFilter();
            bpf1.type = 'bandpass';
            bpf1.frequency.value = f1;
            bpf1.Q.value = 3.5;

            const bpf2 = ctx.createBiquadFilter();
            bpf2.type = 'bandpass';
            bpf2.frequency.value = f2;
            bpf2.Q.value = 5.0;

            osc.connect(bpf1); bpf1.connect(env);
            osc.connect(bpf2); bpf2.connect(env);
            osc.start(t);
            osc.stop(t + dur);
        } else {
            // White noise through a bandpass filter for fricatives and stops.
            const bufLen = Math.ceil(dur * sampleRate) + 64;
            const noiseBuf = ctx.createBuffer(1, bufLen, sampleRate);
            const nd = noiseBuf.getChannelData(0);
            for (let j = 0; j < bufLen; j++) nd[j] = Math.random() * 2 - 1;

            const noiseNode = ctx.createBufferSource();
            noiseNode.buffer = noiseBuf;

            const noiseFreq = f2Base > 0 ? f2Base * formantShift : 2000 * formantShift;
            const bpf = ctx.createBiquadFilter();
            bpf.type = 'bandpass';
            bpf.frequency.value = noiseFreq;
            bpf.Q.value = 2.5;

            noiseNode.connect(bpf); bpf.connect(env);
            noiseNode.start(t);
            noiseNode.stop(t + dur + 0.01);
        }

        t += dur;
    }

    return ctx.startRendering();
}

async function speakSam(text, { clippy = false } = {}) {
    const requestId = beginSpeechRequest();
    try {
        speechSynthesis.cancel();
        stopGeneratedSpeechPlayback();
        const preset = SAM_VOICES.find(v => v.id === samVoice) || SAM_VOICES[0];
        const audioBuffer = await synthesizeSamAudio(text, preset);
        if (!isCurrentSpeechRequest(requestId)) return;
        const audioSrc = audioBufferToWavDataUrl(audioBuffer);
        const audio = new Audio(audioSrc);
        ttsAudioPlayer = audio;
        if (clippy) {
            setClippySpeaking(true);
            audio.addEventListener('ended', () => {
                if (isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
            }, { once: true });
            audio.addEventListener('error', () => {
                if (isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
            }, { once: true });
        }
        await audio.play();
    } catch (err) {
        if (clippy && isCurrentSpeechRequest(requestId)) setClippySpeaking(false);
        console.error('SAM TTS failed:', err);
        if (clippy) fallbackClippySpeech(text);
    }
}

// ── Event handlers ────────────────────────────────────────────────────────────

ttsToggleBtn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    updateTtsButton();
    if (!ttsEnabled) stopAllSpeech();
    saveTtsSettings();
});

ttsSettingsBtn.addEventListener('click', () => {
    toggleTtsSettings();
});

settingsGeneralTabBtn.addEventListener('click', () => {
    setSettingsTab('general');
});

settingsSpeechTabBtn.addEventListener('click', () => {
    setSettingsTab('speech');
});

container.addEventListener('contextmenu', (event) => {
    if (!isClippyAvatar()) return;
    event.preventDefault();
    setTtsSettingsOpen(true);
});

// Single click on the avatar scene toggles settings in both modes.
container.addEventListener('click', (event) => {
    if (ttsControls.contains(event.target)) return;
    toggleTtsSettings();
});

// Close TTS controls when clicking outside
document.addEventListener('pointerdown', (e) => {
    if (!ttsControls.contains(e.target)) {
        setTtsSettingsOpen(false);
    }
});

avatarStyleSelect.addEventListener('change', () => {
    avatarStyle = avatarStyleSelect.value;
    applyAvatarStyle({ enforceVoiceDefaults: avatarStyle === 'clippy' });
    saveTtsSettings();
});

ttsEngineSelect.addEventListener('change', () => {
    ttsEngine = ttsEngineSelect.value;
    updateEngineUI();
    saveTtsSettings();
});

runDemoBtn.addEventListener('click', () => {
    ttsDropdown.classList.add('hidden');
    runDemoSequence();
});

messageVisibilityToggle.addEventListener('change', () => {
    showSpokenText = messageVisibilityToggle.checked;
    if (fadeTimeout) clearTimeout(fadeTimeout);
    updateMessageVisibility();
    saveTtsSettings();
});

badgeVisibilityToggle.addEventListener('change', () => {
    showAvatarBadges = badgeVisibilityToggle.checked;
    updateBadgeVisibility();
    saveTtsSettings();
});

modelVisibilityToggle.addEventListener('change', () => {
    showModelBadges = modelVisibilityToggle.checked;
    updateBadgeVisibility();
    saveTtsSettings();
});

transparentWindowToggle.addEventListener('change', () => {
    transparentWindow = transparentWindowToggle.checked;
    updateWindowTransparency();
    saveTtsSettings();
});

ttsVoiceSelect.addEventListener('change', () => {
    ttsVoiceName = ttsVoiceSelect.value;
    updateVoicePreviewButtons();
    saveTtsSettings();
});

ttsWebspeechTestBtn.addEventListener('click', () => {
    previewCurrentVoice('webspeech');
});

ttsRateInput.addEventListener('input', () => {
    ttsRate = parseFloat(ttsRateInput.value);
    ttsRateValue.textContent = `${ttsRate.toFixed(1)}×`;
    saveTtsSettings();
});

ttsPitchInput.addEventListener('input', () => {
    ttsPitch = parseFloat(ttsPitchInput.value);
    ttsPitchValue.textContent = ttsPitch.toFixed(1);
    saveTtsSettings();
});

voxtralUrlInput.addEventListener('change', () => {
    voxtralUrl = voxtralUrlInput.value.trim();
    saveTtsSettings();
});

voxtralApikeyInput.addEventListener('change', () => {
    voxtralApiKey = voxtralApikeyInput.value.trim();
    updateVoicePreviewButtons();
    saveTtsSettings();
});

elevenlabsApikeyInput.addEventListener('change', () => {
    elevenlabsApiKey = elevenlabsApikeyInput.value.trim();
    fetchElevenLabsVoices({ force: true });
    updateElevenLabsCloneUI();
    updateVoicePreviewButtons();
    saveTtsSettings();
});

document.querySelectorAll('input[name="voxtral-backend"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        voxtralBackend = radio.value;
        updateBackendUI();
        saveTtsSettings();
    });
});

voxtralRefreshBtn.addEventListener('click', () => fetchVoxtralVoices());
elevenlabsRefreshBtn.addEventListener('click', () => fetchElevenLabsVoices({ force: true }));

voxtralVoiceSelect.addEventListener('change', () => {
    voxtralVoice = voxtralVoiceSelect.value;
    if (isClippyAvatar()) {
        clippyVoxtralVoice = voxtralVoice;
    }
    updateVoicePreviewButtons();
    saveTtsSettings();
});

elevenlabsVoiceSelect.addEventListener('change', () => {
    elevenlabsVoice = elevenlabsVoiceSelect.value;
    updateVoicePreviewButtons();
    saveTtsSettings();
});

samVoiceSelect.addEventListener('change', () => {
    samVoice = samVoiceSelect.value;
    updateVoicePreviewButtons();
    saveTtsSettings();
});

ttsSamTestBtn.addEventListener('click', () => {
    previewCurrentVoice('sam');
});

document.querySelectorAll('input[name="ai-voice-source"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        voxtralVoiceSource = radio.value;
        updateEngineUI();
        saveTtsSettings();
    });
});

ttsAiTestBtn.addEventListener('click', () => {
    previewCurrentVoice();
});

voxtralRecordBtn.addEventListener('click', () => startRecording());
voxtralStopBtn.addEventListener('click', () => stopRecording());
clippyRetroVoiceBtn.addEventListener('click', () => generateRetroClippyVoice());
voxtralFileInput.addEventListener('change', async () => {
    const file = voxtralFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await audioFileToVoxtralRefAudio(file);
    voxtralVoiceSource = 'myvoice';
    setRadioGroupValue('ai-voice-source', voxtralVoiceSource);
    setVoxtralRefAudio(dataUrl);
    updateEngineUI();
    voxtralFileInput.value = '';
});
voxtralRerecordBtn.addEventListener('click', () => {
    setVoxtralRefAudio(null);
});
elevenlabsCloneBtn.addEventListener('click', () => {
    createOrReplaceElevenLabsClone();
});
elevenlabsDeleteBtn.addEventListener('click', () => {
    deleteActiveElevenLabsClone();
});

window.setTts = (enabled) => {
    ttsEnabled = !!enabled;
    updateTtsButton();
    if (!ttsEnabled) stopAllSpeech();
    saveTtsSettings();
    return ttsEnabled;
};

window.getTts = () => ttsEnabled;
window.speak = (text) => speak(text, { clippy: true });
window.speakClippySummary = (text) => speakClippySummary(text);
window.flushClippySummary = (text) => flushClippySummary(text);
window.setAvatarStyle = (style) => {
    avatarStyle = style === 'clippy' ? 'clippy' : 'copilot';
    applyAvatarStyle({ enforceVoiceDefaults: avatarStyle === 'clippy' });
    saveTtsSettings();
    return avatarStyle;
};
window.getAvatarStyle = () => avatarStyle;

window.getVoices = () => {
    const voices = speechSynthesis.getVoices();
    return voices.map((voice, index) => `${index}: ${voice.name} (${voice.lang})`).join('\n');
};

window.setVoice = (name) => {
    ttsVoiceName = name;
    ttsVoiceSelect.value = name;
    saveTtsSettings();
    return `Voice set to: ${name}`;
};

window.setRate = (rate) => {
    ttsRate = Math.max(0.5, Math.min(3.0, Number(rate) || 1.1));
    ttsRateInput.value = ttsRate;
    ttsRateValue.textContent = `${ttsRate.toFixed(1)}×`;
    saveTtsSettings();
    return `Rate set to: ${ttsRate}`;
};

window.getTtsSettings = () => JSON.stringify({
    enabled: ttsEnabled,
    rate: ttsRate,
    pitch: ttsPitch,
    voice: ttsVoiceName,
    avatarStyle,
    engine: ttsEngine,
    voxtralBackend,
    voxtralUrl,
    voxtralApiKey,
    voxtralVoice,
    voxtralVoiceSource,
    clippyVoxtralVoice,
    elevenlabsVoice,
    elevenlabsHasApiKey: !!elevenlabsApiKey,
    elevenlabsClonedVoiceId,
    clippyElevenlabsVoiceId,
    samVoice,
    hasClippyRefAudio: !!clippyRefAudio,
    hasClippyModel: !!clippyRoot,
    clippyAnimations: clippyActions.map((action) => action.getClip().name),
    showSpokenText,
    showAvatarBadges,
    showModelBadges,
});

window.setMessageTextVisible = (visible) => {
    showSpokenText = !!visible;
    if (fadeTimeout) clearTimeout(fadeTimeout);
    updateMessageVisibility();
    saveTtsSettings();
    return showSpokenText;
};

window.getMessageTextVisible = () => showSpokenText;
window.setAgentModel = (payload = {}) => {
    const model = String(payload.model || '').trim();
    if (!model) return;

    const resolvedId = payload.agentId || ROOT_AGENT_ID;
    if (resolvedId !== ROOT_AGENT_ID && !avatars.has(resolvedId)) {
        pendingAgentModels.set(resolvedId, model);
        return;
    }

    const avatar = ensureAvatar(payload.agentId || ROOT_AGENT_ID, payload);
    applyAvatarModel(avatar, model);
};
window.runDemoSequence = () => runDemoSequence();
window.stopDemoSequence = () => {
    resetDemoSequence();
    return 'stopped';
};

function stripMarkdownForSpeech(text) {
    return String(text)
        .replace(/```(?:[\w-]+)?\r?\n([\s\S]*?)```/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/^>\s?/gm, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-+*]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
        .replace(/\s*\r?\n\s*/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function clampSpokenSummary(text, maxLength = 185) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    const clipped = normalized.slice(0, maxLength - 1);
    const breakAt = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf(','), clipped.lastIndexOf(';'));
    return `${clipped.slice(0, breakAt > 70 ? breakAt : maxLength - 1).trim()}...`;
}

function summarizeForClippy(text) {
    const plain = stripMarkdownForSpeech(text)
        .replace(/https?:\/\/\S+/gi, 'a link')
        .replace(/\b[A-Z]:\\\S+/g, 'a file')
        .replace(/\s+/g, ' ')
        .trim();
    if (!plain) return 'It looks like there is nothing new to report.';

    const sentences = plain
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
    const lower = plain.toLowerCase();
    const failed = /\b(failed|error|unable|cannot|can't|couldn't|blocked|not working|issue|problem)\b/.test(lower);
    const successful = /\b(done|completed|fixed|implemented|updated|added|created|ready|finished|resolved)\b/.test(lower);
    const candidate = sentences.find((sentence) => sentence.length >= 24 && sentence.length <= 220) || sentences[0] || plain;
    const summary = clampSpokenSummary(candidate.replace(/^(done|completed|fixed|implemented|updated|added|created|ready|finished|resolved)[:,.\s-]*/i, ''));

    if (failed) {
        return `It looks like we hit a snag. ${summary}`;
    }
    if (successful) {
        return `It looks like you're all set. ${summary}`;
    }
    return `It looks like there is an update. ${summary}`;
}

function speakClippySummary(text) {
    speak(summarizeForClippy(text), { clippy: true });
}

function flushClippySummary(text = pendingClippyMessage) {
    const sourceText = String(text || '').trim();
    pendingClippyMessage = '';
    if (!sourceText) return false;

    const summary = summarizeForClippy(sourceText);
    const now = performance.now();
    if (summary === lastSpokenClippySummary && now - lastSpokenClippySummaryAt < 8000) {
        return false;
    }

    lastSpokenClippySummary = summary;
    lastSpokenClippySummaryAt = now;
    speak(summary, { clippy: true });
    return true;
}

function speak(text, { clippy = false, forceEngine = null } = {}) {
    if (!ttsEnabled || !text) return;
    const spokenText = stripMarkdownForSpeech(text);
    if (!spokenText) return;
    const engine = forceEngine || ttsEngine;
    if (engine === 'voxtral') {
        speakVoxtral(spokenText, { clippy });
    } else if (engine === 'elevenlabs') {
        speakElevenLabs(spokenText, { clippy });
    } else if (engine === 'sam') {
        speakSam(spokenText, { clippy });
    } else {
        speakWebSpeech(spokenText, { clippy });
    }
}

const resizeObserver = new ResizeObserver(() => {
    layoutSubagents();
    scheduleWindowSizeSave();
});
resizeObserver.observe(container);

const loader = new GLTFLoader();
try {
    const gltf = await loader.loadAsync('model.glb');
    baseAsset = createBaseAsset(gltf.scene);
} catch {
    baseAsset = createBaseAsset(null);
}
await loadClippyModel(loader);

initializeRootAvatar();
updateSceneModeVisibility();
layoutSubagents();
updateStatusIndicator();
updateBadgeVisibility();
updateCamera();
startAnimation();
window.__copilotAvatarReady = true;

void (async () => {
    try {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync('duck-bill.glb');
        duckBeakAsset = createDuckBeakAsset(gltf.scene);
        for (const avatar of avatars.values()) {
            if (!avatar.isDuck || avatar.duckBeak?.userData.isImported) continue;
            replaceAvatarDuckBeak(avatar);
        }
    } catch {
        duckBeakAsset = null;
    }
})();
