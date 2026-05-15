import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const ROOT_AGENT_ID = 'root';
const ROOT_SCALE = 1;
const SUBAGENT_SCALE = 0.38;
const MESSAGE_FADE_MS = 6000;
const IDLE_SLEEP_MS = 5 * 60 * 1000;
const EMOTION_HOLD_MS = 9000;
const THINKING_HOLD_MS = 1800;
const INTENT_HOLD_MS = 2600;
const COMPLETION_HOLD_MS = 2000;
const FAILURE_HOLD_MS = 1100;
const CLIPPY_MODEL_URL = 'clippy.glb';
const CLIPPY_TARGET_HEIGHT = 1.55;
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

const container = document.getElementById('avatar-container');
const overlayContainer = document.getElementById('subagent-overlays');

// Native OS window drag — let WebView2 handle it natively
document.body.style.webkitAppRegion = 'drag';
document.getElementById('tts-controls').style.webkitAppRegion = 'no-drag';
container.style.cursor = 'grab';
const messageEl = document.getElementById('message-text');
const statusEl = document.getElementById('status-indicator');
const subtasksEl = document.getElementById('subtasks');
const emotionBubbleEl = document.getElementById('emotion-bubble');
const clippyAvatarEl = document.getElementById('clippy-avatar');

const ttsToggleBtn = document.getElementById('tts-toggle');
const ttsSettingsBtn = document.getElementById('tts-settings-btn');
const ttsControls = document.getElementById('tts-controls');
const ttsDropdown = document.getElementById('tts-dropdown');
const avatarStyleSelect = document.getElementById('avatar-style-select');
const ttsEngineSelect = document.getElementById('tts-engine-select');
const ttsWebspeechSection = document.getElementById('tts-webspeech-section');
const ttsVoxtralSection = document.getElementById('tts-voxtral-section');
const ttsVoiceSelect = document.getElementById('tts-voice-select');
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
const voxtralPresetSection = document.getElementById('voxtral-preset-section');
const voxtralRecordSection = document.getElementById('voxtral-record-section');
const voxtralRecordBtn = document.getElementById('voxtral-record-btn');
const voxtralRecordTimer = document.getElementById('voxtral-record-timer');
const voxtralStopBtn = document.getElementById('voxtral-stop-btn');
const clippyRetroVoiceBtn = document.getElementById('clippy-retro-voice-btn');
const voxtralAudioPreview = document.getElementById('voxtral-audio-preview');
const voxtralFileInput = document.getElementById('voxtral-file-input');
const voxtralRerecordBtn = document.getElementById('voxtral-rerecord-btn');

const avatars = new Map();
const pendingSubagents = [];
const particles = [];

let rootWorking = false;
let rootLastActivityAt = performance.now();
let rootEmotion = { name: 'default', until: 0 };
let fadeTimeout = null;
let animationStarted = false;
let lastFrameTime = performance.now();
let baseAsset = null;
let clippyRoot = null;
let clippyMixer = null;
let clippyActions = [];
let clippyActiveAction = null;
let clippyCurrentAnimationKey = '';
let clippyVisualMode = 'idle';
let clippySpeaking = false;
let clippyBaseY = 0;
let clippyBaseScale = 1;
let clippyInnerClipDeform = null;
let clippyTalkEnvelope = 0;
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
    if (!rootWorking && now - rootLastActivityAt >= IDLE_SLEEP_MS) return 'sleep';
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
    if (rootWorking) {
        statusEl.textContent = '● Working…';
        statusEl.classList.add('active');
        return;
    }

    statusEl.textContent = '';
    statusEl.classList.remove('active');
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
    if (clippyRoot) {
        clippyRoot.visible = clippyActive;
    }

    for (const avatar of avatars.values()) {
        avatar.group.visible = !clippyActive;
    }

    for (const particle of particles) {
        particle.sprite.visible = !clippyActive;
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

function styleClippyMesh(object) {
    if (!object.isMesh) return;
    window.__allMeshes = window.__allMeshes || [];
    const mats = getObjectMaterialNames(object);
    window.__allMeshes.push({ name: object.name, mats });

    const objectName = object.name.toLowerCase();
    const materialNames = getObjectMaterialNames(object);
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

        const model = gltf.scene;
        const modelWrapper = new THREE.Group();
        modelWrapper.add(model);
        model.traverse(styleClippyMesh);
        normalizeClippyModel(modelWrapper, clippyRoot);

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

function updateClippyModel(dt, now) {
    if (!clippyRoot || !isClippyAvatar()) return;

    const time = now / 1000;
    const mode = getClippyAnimationKey();
    const motion = getClippyMotionConfig(mode, time);
    clippyRoot.position.x = 0;
    clippyRoot.position.y = clippyBaseY + motion.bobY;
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

    if (save) saveTtsSettings();
}

function applyAvatarStyle({ enforceVoiceDefaults = false } = {}) {
    document.body.classList.toggle('avatar-clippy', isClippyAvatar());
    avatarStyleSelect.value = avatarStyle;
    updateSceneModeVisibility();
    updateCamera();
    if (!isClippyAvatar()) {
        setClippySpeaking(false);
        updateClippyVisual('idle');
        return;
    }

    if (enforceVoiceDefaults) {
        ttsEnabled = true;
        ttsEngine = 'voxtral';
        ttsEngineSelect.value = ttsEngine;
        voxtralVoice = clippyVoxtralVoice || CLIPPY_DEFAULT_VOXTRAL_VOICE;
        voxtralVoiceSource = 'myvoice';
        setRadioGroupValue('voxtral-voice-source', voxtralVoiceSource);
        if (clippyRefAudio) {
            setVoxtralRefAudio(clippyRefAudio, { rememberForClippy: false, save: false });
        } else if (voxtralRefAudio) {
            clippyRefAudio = voxtralRefAudio;
        }
    }

    updateTtsButton();
    updateEngineUI();
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
        overlayOffset: new THREE.Vector3(0, -size.y * 0.82, size.z * 0.14),
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

function createOverlay(agentId) {
    const labelEl = document.createElement('div');
    labelEl.className = 'subagent-label';
    labelEl.dataset.agentId = agentId;

    const nameEl = document.createElement('span');
    nameEl.className = 'agent-name';

    const badgeEl = document.createElement('span');
    badgeEl.className = 'agent-badge idle';

    const badgeIconEl = document.createElement('span');
    badgeIconEl.className = 'agent-badge-icon';

    const badgeTextEl = document.createElement('span');
    badgeTextEl.className = 'agent-badge-text';

    badgeEl.append(badgeIconEl, badgeTextEl);
    labelEl.append(nameEl, badgeEl);
    overlayContainer.appendChild(labelEl);

    return { labelEl, nameEl, badgeEl, badgeIconEl, badgeTextEl };
}

function defaultDisplayName(agentId) {
    if (!agentId) return 'Agent';
    return agentId.length > 12 ? `agent-${agentId.slice(0, 6)}` : agentId;
}

function createAvatarInstance(agentId, data = {}) {
    const isRoot = agentId === ROOT_AGENT_ID;
    const group = new THREE.Group();
    const modelRoot = baseAsset.sourceScene ? SkeletonUtils.clone(baseAsset.sourceScene) : new THREE.Group();
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
    modelRoot.add(raccoonMask, eyeL, eyeR, heartEyeL, heartEyeR);
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

    const avatar = {
        agentId,
        agentName: data.agentName || '',
        displayName: data.displayName || defaultDisplayName(agentId),
        description: data.description || '',
        isRoot,
        group,
        modelRoot,
        eyeL,
        eyeR,
        eyeMatL,
        eyeMatR,
        heartEyeL,
        heartEyeR,
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
        currentBobY: 0,
        currentRotX: 0,
        currentRotY: 0,
        currentRotZ: 0,
        currentWritingFx: 0,
        currentReadingFx: 0,
        currentThinkingFx: 0,
        anim: {
            idleTime: 0,
            blinkTimer: 2 + Math.random() * 3,
            winkTimer: 8 + Math.random() * 10,
            isBlinking: false,
            isWinking: false,
            blinkProgress: 0,
            blinkPhase: 0,
            targetRotX: 0,
            targetRotY: 0,
            wanderTimer: 0,
        },
    };

    scene.add(group);
    avatars.set(agentId, avatar);
    updateAvatarMetadata(avatar, data);
    updateAvatarBadge(avatar);
    return avatar;
}

function disposeAvatar(avatar) {
    scene.remove(avatar.group);

    avatar.eyeMatL.dispose();
    avatar.eyeMatR.dispose();
    avatar.raccoonMask.material.dispose();
    avatar.heartEyeL.userData.glow.material.dispose();
    avatar.heartEyeL.userData.core.material.dispose();
    avatar.heartEyeR.userData.glow.material.dispose();
    avatar.heartEyeR.userData.core.material.dispose();
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
    if (data.agentName) avatar.agentName = data.agentName;
    if (data.displayName) avatar.displayName = data.displayName;
    if (data.description) avatar.description = data.description;

    if (!avatar.displayName) {
        avatar.displayName = defaultDisplayName(avatar.agentId);
    }

    if (avatar.overlay) {
        avatar.overlay.nameEl.textContent = avatar.displayName;
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

function ensureAvatar(agentId, payload = {}) {
    const resolvedId = agentId || ROOT_AGENT_ID;
    if (avatars.has(resolvedId)) {
        const avatar = avatars.get(resolvedId);
        updateAvatarMetadata(avatar, payload);
        return avatar;
    }

    const data = resolvedId === ROOT_AGENT_ID ? payload : consumePendingSubagent(payload);
    const avatar = createAvatarInstance(resolvedId, data);
    if (!avatar.isRoot) {
        layoutSubagents();
    }
    return avatar;
}

function computeLayoutState(subagentCount) {
    const width = Math.max(container.clientWidth || 0, 320);
    const height = Math.max(container.clientHeight || 0, 360);
    const maxColumns = Math.max(1, Math.floor((width - 32) / 168));
    const columns = subagentCount > 0 ? Math.min(subagentCount, maxColumns) : 1;
    const rows = subagentCount > 0 ? Math.ceil(subagentCount / columns) : 0;
    const slotWidthPx = subagentCount > 0 ? Math.max(118, (width - 32) / columns) : width - 32;
    const widthScale = THREE.MathUtils.clamp(slotWidthPx / 190, 0.66, 1);
    const heightScale = THREE.MathUtils.clamp((height - 170) / 620, 0.72, 1);
    const rowScale = rows >= 3 ? 0.78 : rows === 2 ? 0.88 : 1;
    const subScale = THREE.MathUtils.clamp(SUBAGENT_SCALE * widthScale * heightScale * rowScale, 0.2, SUBAGENT_SCALE);
    const spacingX = Math.max(baseAsset.rowSpacing * widthScale * 0.96, baseAsset.size.x * subScale * 1.45);
    const rowGap = Math.max(baseAsset.size.y * subScale * 1.3, 0.28);
    const compactness = THREE.MathUtils.clamp(Math.max((560 - width) / 260, (760 - height) / 260), 0, 1);
    const stackCenterY = baseAsset.subY + compactness * 0.34 + Math.max(0, rows - 1) * 0.08;
    const rootScale = THREE.MathUtils.clamp(ROOT_SCALE * (1 - compactness * 0.16) * (rows >= 3 ? 0.92 : 1), 0.8, ROOT_SCALE);
    const rootY = baseAsset.rootY + compactness * 0.24 + Math.max(0, rows - 1) * 0.08;
    const cameraDistance = baseAsset.maxDim * (3.7 + compactness * 1.05 + Math.max(0, rows - 1) * 0.42);
    const cameraY = baseAsset.size.y * (0.04 + compactness * 0.08 + Math.max(0, rows - 1) * 0.02);
    const cameraLookAtY = THREE.MathUtils.lerp(0.05, rootY * 0.28, 0.72);
    const overlayScale = THREE.MathUtils.clamp(slotWidthPx / 176, 0.72, 1);

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

function layoutSubagents() {
    if (!baseAsset) return;

    const active = [...avatars.values()]
        .filter((avatar) => !avatar.isRoot && avatar.inLayout)
        .sort((a, b) => a.createdAt - b.createdAt);

    layoutState = computeLayoutState(active.length);
    document.body.classList.toggle('compact-layout', layoutState.slotWidthPx < 156);
    document.body.classList.toggle('tiny-layout', layoutState.slotWidthPx < 136);

    const topRowY = layoutState.stackCenterY + ((layoutState.rows - 1) * layoutState.rowGap) / 2;

    active.forEach((avatar, index) => {
        const row = Math.floor(index / layoutState.columns);
        const rowStart = row * layoutState.columns;
        const itemsInRow = Math.min(layoutState.columns, active.length - rowStart);
        const column = index - rowStart;
        const centerOffset = (itemsInRow - 1) / 2;

        avatar.baseScale = layoutState.subScale;
        avatar.targetPosition.set(
            (column - centerOffset) * layoutState.spacingX,
            topRowY - row * layoutState.rowGap,
            0,
        );
    });

    const rootAvatar = avatars.get(ROOT_AGENT_ID);
    if (rootAvatar) {
        rootAvatar.baseScale = layoutState.rootScale;
        rootAvatar.targetPosition.set(0, layoutState.rootY, 0);
    }

    updateCamera(layoutState);
}

function getResolvedActivity(avatar, now = performance.now()) {
    if (avatar.activeTools.size > 0) {
        let latest = null;
        for (const entry of avatar.activeTools.values()) {
            if (!latest || entry.startedAt > latest.startedAt) {
                latest = entry;
            }
        }
        return latest?.activity || 'idle';
    }

    if (avatar.thinkingUntil > now) {
        return 'thinking';
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
    const badgeText = avatar.intentText && avatar.intentUntil > now ? avatar.intentText : badge.text;
    avatar.overlay.badgeEl.className = `agent-badge ${activity}`;
    avatar.overlay.badgeIconEl.textContent = badge.icon;
    avatar.overlay.badgeTextEl.textContent = badgeText;
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

    avatar.group.updateWorldMatrix(true, true);
    avatar.group.localToWorld(worldVector.copy(baseAsset.overlayOffset));
    overlayVector.copy(worldVector).project(camera);

    const onScreen = overlayVector.z > -1 && overlayVector.z < 1
        && overlayVector.x > -1.2 && overlayVector.x < 1.2
        && overlayVector.y > -1.2 && overlayVector.y < 1.2
        && avatar.presence > 0.05;

    if (!onScreen) {
        avatar.overlay.labelEl.classList.remove('visible');
        avatar.overlay.labelEl.style.opacity = '0';
        return;
    }

    const x = (overlayVector.x * 0.5 + 0.5) * container.clientWidth;
    const y = (-overlayVector.y * 0.5 + 0.5) * container.clientHeight;
    const scale = layoutState.overlayScale * (0.92 + avatar.presence * 0.08);
    avatar.overlay.labelEl.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
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
        avatar.anim.blinkTimer = 2 + Math.random() * 4;
    } else {
        avatar.anim.blinkTimer -= dt;
        if (avatar.anim.blinkTimer <= 0 && !avatar.anim.isBlinking && !avatar.anim.isWinking) {
            avatar.anim.isBlinking = true;
            avatar.anim.blinkPhase = 1;
            avatar.anim.blinkProgress = 0;
            avatar.anim.blinkTimer = 2 + Math.random() * 4;
        }
    }

    if (avatar.anim.isBlinking) {
        avatar.anim.blinkProgress += dt * 12;
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
        avatar.anim.winkTimer = 8 + Math.random() * 10;
    } else {
        avatar.anim.winkTimer -= dt;
        if (avatar.anim.winkTimer <= 0 && !avatar.anim.isBlinking && !avatar.anim.isWinking) {
            avatar.anim.isWinking = true;
            avatar.anim.blinkPhase = 1;
            avatar.anim.blinkProgress = 0;
            avatar.anim.winkTimer = 8 + Math.random() * 10;
        }
    }

    if (avatar.anim.isWinking) {
        avatar.anim.blinkProgress += dt * 10;
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
                avatar.anim.targetRotY = (Math.random() - 0.5) * 0.3;
                avatar.anim.targetRotX = (Math.random() - 0.5) * 0.1;
                avatar.anim.wanderTimer = 2.5 + Math.random() * 3;
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

    return base;
}

function updateAvatar(avatar, dt, now) {
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
    const scalePulse = avatar.scalePulseUntil > now ? 1 + Math.sin((now / 1000) * 20) * 0.08 : 1;
    const motionEase = 1 - Math.exp(-dt * (avatar.isRoot ? 7 : 9));
    const eyeEase = 1 - Math.exp(-dt * 12);
    avatar.currentScale += ((avatar.baseScale * avatar.presence) - avatar.currentScale) * (1 - Math.exp(-dt * 10));
    avatar.currentEyeColor.lerp(visual.color, 1 - Math.exp(-dt * 9));
    avatar.currentBobY += (visual.bobY - avatar.currentBobY) * motionEase;
    avatar.currentRotX += (visual.rotX - avatar.currentRotX) * motionEase;
    avatar.currentRotY += (visual.rotY - avatar.currentRotY) * motionEase;
    avatar.currentRotZ += (visual.rotZ - avatar.currentRotZ) * motionEase;
    avatar.currentEyeScaleX += (visual.eyeScaleX - avatar.currentEyeScaleX) * eyeEase;
    avatar.currentEyeScaleY += (visual.eyeScaleY - avatar.currentEyeScaleY) * eyeEase;
    avatar.currentHeartPulse += (visual.heartPulse - avatar.currentHeartPulse) * eyeEase;
    avatar.currentWritingFx += ((resolvedActivity === 'writing' ? 1 : 0) - avatar.currentWritingFx) * eyeEase;
    avatar.currentReadingFx += ((resolvedActivity === 'reading' ? 1 : 0) - avatar.currentReadingFx) * eyeEase;
    avatar.currentThinkingFx += ((resolvedActivity === 'thinking' ? 1 : 0) - avatar.currentThinkingFx) * eyeEase;

    let shakeX = 0;
    if (avatar.shakeUntil > now) {
        shakeX = Math.sin(now * 0.08) * 0.04;
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
    for (const glyph of avatar.writingGlyphs) {
        const writingOpacity = avatar.currentWritingFx * (0.38 + (Math.sin(avatar.anim.idleTime * 4.6 * glyph.speed + glyph.phase) + 1) * 0.18);
        glyph.sprite.visible = writingOpacity > 0.03;
        glyph.material.opacity = writingOpacity;
        glyph.material.rotation = Math.sin(avatar.anim.idleTime * 1.8 + glyph.phase) * 0.08;
        glyph.sprite.position.set(
            Math.cos(avatar.anim.idleTime * glyph.speed + glyph.phase) * glyph.orbitRadius,
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
    readingBeam.position.x = Math.sin(avatar.anim.idleTime * 1.7) * baseAsset.eyeSpacing * 1.45;
    readingBeam.scale.x = baseAsset.readingBeamWidth * (0.82 + (Math.sin(avatar.anim.idleTime * 2.5) + 1) * 0.1);
    readingBeam.scale.y = baseAsset.readingBeamHeight;

    for (const dot of avatar.activityEffects.thinkingDots) {
        const orbitAngle = avatar.anim.idleTime * 0.85 + dot.phase;
        const bob = Math.sin(avatar.anim.idleTime * 1.6 + dot.phase * 1.5) * 0.03;
        dot.sprite.visible = avatar.currentThinkingFx > 0.04;
        dot.material.opacity = avatar.currentThinkingFx * (0.22 + (Math.sin(avatar.anim.idleTime * 2 + dot.phase) + 1) * 0.08);
        dot.sprite.position.set(
            Math.cos(orbitAngle) * (baseAsset.thinkingOrbitRadius + dot.orbitRadius * 0.4),
            baseAsset.thinkingCenterY + bob,
            baseAsset.eyeZ + 0.08 + Math.sin(orbitAngle) * 0.05,
        );
        const dotScale = baseAsset.thinkingDotSize * dot.size * (0.9 + (Math.sin(avatar.anim.idleTime * 2.2 + dot.phase) + 1) * 0.08);
        dot.sprite.scale.setScalar(dotScale);
    }

    updateBlinkState(avatar, visual, dt, now);
    updateAvatarBadge(avatar, now);
    setOverlayPosition(avatar);
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
    if (isClippyAvatar()) {
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
    ensureAvatar(ROOT_AGENT_ID, { displayName: 'Copilot' });
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
        speakClippySummary(text);
        return;
    }

    messageEl.classList.remove('fading');
    messageEl.classList.add('visible');
    messageEl.textContent = text;
    speak(text);

    fadeTimeout = setTimeout(() => {
        messageEl.classList.add('fading');
        messageEl.classList.remove('visible');
    }, MESSAGE_FADE_MS);
};

window.setWorking = (active) => {
    rootWorking = !!active;
    if (active) {
        registerRootActivity();
    } else {
        subtasksEl.textContent = '';
    }
    updateStatusIndicator();
};

window.setSubtask = (text) => {
    if (text) registerRootActivity();
    subtasksEl.textContent = text || '';
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

window.completeSubagent = (payload = {}) => {
    if (!payload.agentId) return;
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
    const avatar = ensureAvatar(payload.agentId || ROOT_AGENT_ID, payload);
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;
    const key = payload.toolCallId || `${payload.toolName || 'tool'}:${performance.now()}`;
    avatar.activeTools.set(key, {
        toolName: payload.toolName || '',
        activity: classifyTool(payload.toolName || ''),
        startedAt: performance.now(),
    });
    avatar.effectState = 'idle';
    if (avatar.isRoot) registerRootActivity();
};

window.clearAgentActivity = (payload = {}) => {
    const avatar = avatars.get(payload.agentId || ROOT_AGENT_ID);
    if (!avatar) return;
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;

    if (payload.toolCallId && avatar.activeTools.has(payload.toolCallId)) {
        avatar.activeTools.delete(payload.toolCallId);
    } else if (payload.toolName) {
        for (const [key, value] of avatar.activeTools.entries()) {
            if (value.toolName === payload.toolName) {
                avatar.activeTools.delete(key);
                break;
            }
        }
    }
};

window.setAgentThinking = (agentId) => {
    const avatar = ensureAvatar(agentId || ROOT_AGENT_ID);
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;
    avatar.thinkingUntil = performance.now() + THINKING_HOLD_MS;
    if (avatar.isRoot) registerRootActivity();
};

window.setAgentIntent = (payload = {}) => {
    const avatar = ensureAvatar(payload.agentId || ROOT_AGENT_ID, payload);
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;
    avatar.intentText = payload.intent || '';
    avatar.intentUntil = performance.now() + INTENT_HOLD_MS;
    if (avatar.isRoot) registerRootActivity();
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

let ttsEnabled = true;
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
let clippyRefAudio = null;
let voxtralAudioPlayer = null;
let voxtralAudioCtx = null;

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
    document.querySelectorAll('input[name="voxtral-voice-source"]').forEach((radio) => {
        radio.checked = radio.value === voxtralVoiceSource;
    });
}
if (savedTts.clippyRefAudio) {
    clippyRefAudio = savedTts.clippyRefAudio;
}
if (savedTts.voxtralRefAudio) {
    setVoxtralRefAudio(savedTts.voxtralRefAudio, { rememberForClippy: false, save: false });
}
applyAvatarStyle({ enforceVoiceDefaults: avatarStyle === 'clippy' });
updateTtsButton();
updateEngineUI();

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
        clippyRefAudio,
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
    ttsWebspeechSection.classList.toggle('hidden', isVoxtral);
    ttsVoxtralSection.classList.toggle('hidden', !isVoxtral);
    if (isVoxtral) {
        const isMyVoice = voxtralVoiceSource === 'myvoice';
        voxtralPresetSection.classList.toggle('hidden', isMyVoice);
        voxtralRecordSection.classList.toggle('hidden', !isMyVoice);
        updateBackendUI();
    }
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
    saveTtsSettings();
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

populateVoxtralVoices(VOXTRAL_VOICES_FALLBACK);
speechSynthesis.onvoiceschanged = populateVoices;
populateVoices();

// ── Recording ─────────────────────────────────────────────────────────────────

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
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
        ttsEngine = 'voxtral';
        voxtralVoiceSource = 'myvoice';
        avatarStyleSelect.value = avatarStyle;
        ttsEngineSelect.value = ttsEngine;
        setRadioGroupValue('voxtral-voice-source', voxtralVoiceSource);
        setVoxtralRefAudio(dataUrl, { rememberForClippy: true, save: false });
        applyAvatarStyle({ enforceVoiceDefaults: true });
        saveTtsSettings();
    } catch (err) {
        console.error('Retro Clippy voice generation failed:', err);
    } finally {
        clippyRetroVoiceBtn.disabled = false;
        clippyRetroVoiceBtn.textContent = previousText;
    }
}

// ── TTS engines ───────────────────────────────────────────────────────────────

function speakWebSpeech(text, { clippy = false } = {}) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = ttsRate;
    utterance.pitch = ttsPitch;
    if (ttsVoiceName) {
        const voice = speechSynthesis.getVoices().find((item) => item.name === ttsVoiceName);
        if (voice) utterance.voice = voice;
    }
    if (clippy) {
        setClippySpeaking(true);
        utterance.onend = () => setClippySpeaking(false);
        utterance.onerror = () => setClippySpeaking(false);
    }
    speechSynthesis.speak(utterance);
}

function fallbackClippySpeech(text) {
    if (!clippyRefAudio && !voxtralRefAudio) {
        console.warn('Clippy Voxtral speech failed; falling back to Web Speech. Add a Voxtral API key or local server in settings for Clippy voice cloning.');
    }
    speakWebSpeech(text, { clippy: true });
}

async function speakVoxtral(text, { clippy = false } = {}) {
    try {
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
        if (!res.ok) {
            console.error('Voxtral TTS error:', res.status, await res.text());
            if (clippy) fallbackClippySpeech(text);
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
        const audio = new Audio(audioSrc);
        applyVoiceWarming(audio);
        voxtralAudioPlayer = audio;
        if (clippy) {
            setClippySpeaking(true);
            audio.addEventListener('ended', () => setClippySpeaking(false), { once: true });
            audio.addEventListener('error', () => setClippySpeaking(false), { once: true });
        }
        await audio.play();
    } catch (err) {
        if (clippy) setClippySpeaking(false);
        console.error('Voxtral TTS failed:', err);
        if (clippy) fallbackClippySpeech(text);
    }
}

function stopAllSpeech() {
    speechSynthesis.cancel();
    if (voxtralAudioPlayer) {
        voxtralAudioPlayer.pause();
        voxtralAudioPlayer = null;
    }
    setClippySpeaking(false);
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

container.addEventListener('contextmenu', (event) => {
    if (!isClippyAvatar()) return;
    event.preventDefault();
    setTtsSettingsOpen(true);
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

ttsVoiceSelect.addEventListener('change', () => {
    ttsVoiceName = ttsVoiceSelect.value;
    saveTtsSettings();
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

voxtralVoiceSelect.addEventListener('change', () => {
    voxtralVoice = voxtralVoiceSelect.value;
    if (isClippyAvatar()) {
        clippyVoxtralVoice = voxtralVoice;
    }
    saveTtsSettings();
});

document.querySelectorAll('input[name="voxtral-voice-source"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        voxtralVoiceSource = radio.value;
        updateEngineUI();
        saveTtsSettings();
    });
});

voxtralRecordBtn.addEventListener('click', () => startRecording());
voxtralStopBtn.addEventListener('click', () => stopRecording());
clippyRetroVoiceBtn.addEventListener('click', () => generateRetroClippyVoice());
voxtralFileInput.addEventListener('change', async () => {
    const file = voxtralFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await audioFileToVoxtralRefAudio(file);
    voxtralVoiceSource = 'myvoice';
    setRadioGroupValue('voxtral-voice-source', voxtralVoiceSource);
    setVoxtralRefAudio(dataUrl);
    updateEngineUI();
    voxtralFileInput.value = '';
});
voxtralRerecordBtn.addEventListener('click', () => {
    setVoxtralRefAudio(null);
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
    hasClippyRefAudio: !!clippyRefAudio,
    hasClippyModel: !!clippyRoot,
    clippyAnimations: clippyActions.map((action) => action.getClip().name),
});

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
    speak(summarizeForClippy(text), { clippy: true, forceEngine: 'voxtral' });
}

function speak(text, { clippy = false, forceEngine = null } = {}) {
    if (!ttsEnabled || !text) return;
    const spokenText = stripMarkdownForSpeech(text);
    if (!spokenText) return;
    const engine = forceEngine || (clippy ? 'voxtral' : ttsEngine);
    if (engine === 'voxtral') {
        speakVoxtral(spokenText, { clippy });
    } else {
        speakWebSpeech(spokenText, { clippy });
    }
}

const resizeObserver = new ResizeObserver(() => {
    layoutSubagents();
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
updateCamera();
startAnimation();
