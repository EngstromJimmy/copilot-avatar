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

const ttsToggleBtn = document.getElementById('tts-toggle');
const ttsSettingsBtn = document.getElementById('tts-settings-btn');
const ttsDropdown = document.getElementById('tts-dropdown');
const runDemoBtn = document.getElementById('run-demo-btn');
const ttsVoiceSelect = document.getElementById('tts-voice-select');
const ttsRateInput = document.getElementById('tts-rate-input');
const ttsRateValue = document.getElementById('tts-rate-value');
const ttsPitchInput = document.getElementById('tts-pitch-input');
const ttsPitchValue = document.getElementById('tts-pitch-value');
const messageVisibilityToggle = document.getElementById('message-visibility-toggle');
const badgeVisibilityToggle = document.getElementById('badge-visibility-toggle');
const modelVisibilityToggle = document.getElementById('model-visibility-toggle');

const avatars = new Map();
const pendingSubagents = [];
const pendingAgentModels = new Map();
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
let demoTimers = [];
let demoSequenceRunId = 0;
let animationStarted = false;
let lastFrameTime = performance.now();
let baseAsset = null;
let duckBeakAsset = null;
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
scene.background = new THREE.Color(0x0d1117);

const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
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

function getAvatarBadgeText(avatar, activity, now = performance.now()) {
    const badge = ACTIVITY_BADGES[activity] || ACTIVITY_BADGES.idle;
    const liveIntent = getLiveIntentText(avatar, now);
    const latestTool = getLatestToolEntry(avatar);
    const liveActivity = latestTool?.activityLabel || describeToolActivity(latestTool?.toolName);

    if (avatar.effectState === 'success' || avatar.effectState === 'failed') {
        return liveIntent || badge.text;
    }

    if (latestTool) {
        return liveActivity || liveIntent || badge.text;
    }

    if (activity === 'thinking') {
        return liveIntent || badge.text;
    }

    return liveIntent || (activity === 'idle' && avatar.role ? avatar.role : badge.text);
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

function clearMessageOverlay() {
    if (fadeTimeout) {
        clearTimeout(fadeTimeout);
        fadeTimeout = null;
    }
    messageEl.classList.remove('visible');
    messageEl.classList.remove('fading');
    messageEl.textContent = '';
}

function updateMessageVisibility() {
    messageContainerEl.classList.toggle('hidden', !showSpokenText);
    messageVisibilityToggle.checked = showSpokenText;
    if (!showSpokenText) {
        clearMessageOverlay();
    }
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

    const nameEl = document.createElement('span');
    nameEl.className = 'agent-name';

    const modelEl = document.createElement('span');
    modelEl.className = 'agent-model';

    const badgeEl = document.createElement('span');
    badgeEl.className = 'agent-badge idle';

    const badgeIconEl = document.createElement('span');
    badgeIconEl.className = 'agent-badge-icon';

    const badgeTextEl = document.createElement('span');
    badgeTextEl.className = 'agent-badge-text';

    badgeEl.append(badgeIconEl, badgeTextEl);
    labelEl.append(nameEl, modelEl, badgeEl);
    overlayContainer.appendChild(labelEl);

    return { labelEl, nameEl, modelEl, badgeEl, badgeIconEl, badgeTextEl };
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

function resolveAvatarDisplayName(agentId, data = {}, currentDisplayName = '') {
    const nextDisplayName = cleanAgentLabel(data.displayName);
    const nextAgentName = cleanAgentLabel(data.agentName);
    const currentLabel = cleanAgentLabel(currentDisplayName);

    if (nextDisplayName && !isLowConfidenceDisplayName(nextDisplayName, agentId)) {
        return nextDisplayName;
    }

    if (currentLabel && !isLowConfidenceDisplayName(currentLabel, agentId)) {
        return currentLabel;
    }

    if (nextAgentName && !isLowConfidenceDisplayName(nextAgentName, agentId)) {
        return nextAgentName;
    }

    return nextDisplayName || nextAgentName || currentLabel || defaultDisplayName(agentId);
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
    if (!avatar?.isRoot || !avatar.squadMicBoom) return;
    avatar.squadMicBoom.visible = squadRootMicActive;
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

    const avatar = {
        agentId,
        agentName: data.agentName || '',
        displayName: resolveAvatarDisplayName(agentId, data),
        description: data.description || '',
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

    if (data.agentName) avatar.agentName = data.agentName;
    avatar.displayName = resolveAvatarDisplayName(avatar.agentId, {
        ...data,
        agentName: data.agentName || avatar.agentName,
    }, avatar.displayName);
    if (data.description) avatar.description = data.description;
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
        applyRoleStyle(avatar);
        updateAvatarModelDisplay(avatar);
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
    if (latestTool) return latestTool.activity || 'idle';

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
    const roleStyle = avatar.roleStyle || ROLE_STYLES.default;
    const badgeText = getAvatarBadgeText(avatar, activity, now);
    avatar.overlay.badgeEl.className = `agent-badge ${activity}`;
    avatar.overlay.badgeIconEl.textContent = activity === 'idle'
        ? avatar.isDuck
            ? '🦆'
            : avatar.role
                ? roleStyle.icon
                : badge.icon
        : badge.icon;
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
    pendingAgentModels.delete(agentId);
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
    ensureAvatar(ROOT_AGENT_ID, { displayName: 'Copilot', agentName: '@copilot' });
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
    if (text) registerRootActivity();
    activeSubtaskText = text || '';
    updateSubtaskDisplay();
};

window.setSquadContext = (payload = {}) => {
    squadRootMicActive = !!payload.active;
    idleStatusText = payload.active ? (payload.statusText || '● Squad ready') : '';
    idleSubtaskText = payload.active ? (payload.detailText || '') : '';
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
    const key = getToolActivityKey(payload);
    const existingEntry = avatar.activeTools.get(key);
    avatar.activeTools.set(key, {
        toolName: payload.toolName || '',
        activityLabel: payload.activityLabel || describeToolActivity(payload.toolName || '') || formatToolLabel(payload.toolName || ''),
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
    const avatar = avatars.get(payload.agentId || ROOT_AGENT_ID);
    if (!avatar) return;
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;

    clearAvatarToolActivity(avatar, payload);

    if (avatar.isRoot) {
        updateRootModelIndicator();
        updateSubtaskDisplay();
    }
};

window.setAgentThinking = (agentId) => {
    const avatar = ensureAvatar(agentId || ROOT_AGENT_ID);
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;
    avatar.thinkingUntil = performance.now() + THINKING_HOLD_MS;
    if (avatar.isRoot) {
        registerRootActivity();
        updateRootModelIndicator();
    }
};

window.setAgentIntent = (payload = {}) => {
    const avatar = ensureAvatar(payload.agentId || ROOT_AGENT_ID, payload);
    if (!avatar.isRoot && (avatar.effectState === 'success' || avatar.effectState === 'failed')) return;
    avatar.intentText = payload.intent || '';
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

let ttsEnabled = false;
let ttsRate = 1.1;
let ttsPitch = 1.0;
let ttsVoiceName = null;
let showSpokenText = true;
let showAvatarBadges = true;
let showModelBadges = false;

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
if (savedTts.showSpokenText != null) {
    showSpokenText = !!savedTts.showSpokenText;
}
if (savedTts.showAvatarBadges != null) {
    showAvatarBadges = !!savedTts.showAvatarBadges;
}
if (savedTts.showModelBadges != null) {
    showModelBadges = !!savedTts.showModelBadges;
}
updateTtsButton();
updateMessageVisibility();
updateBadgeVisibility();

function saveTtsSettings() {
    copilot.saveSettings({
        enabled: ttsEnabled,
        rate: ttsRate,
        pitch: ttsPitch,
        voice: ttsVoiceName,
        showSpokenText,
        showAvatarBadges,
        showModelBadges,
    }).catch(() => {});
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

speechSynthesis.onvoiceschanged = populateVoices;
populateVoices();

ttsToggleBtn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    updateTtsButton();
    if (!ttsEnabled) speechSynthesis.cancel();
    saveTtsSettings();
});

ttsSettingsBtn.addEventListener('click', () => {
    ttsDropdown.classList.toggle('hidden');
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

window.setTts = (enabled) => {
    ttsEnabled = !!enabled;
    updateTtsButton();
    if (!ttsEnabled) speechSynthesis.cancel();
    saveTtsSettings();
    return ttsEnabled;
};

window.getTts = () => ttsEnabled;

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

function speak(text) {
    if (!ttsEnabled || !text) return;
    const spokenText = stripMarkdownForSpeech(text);
    if (!spokenText) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = ttsRate;
    utterance.pitch = ttsPitch;

    if (ttsVoiceName) {
        const voice = speechSynthesis.getVoices().find((item) => item.name === ttsVoiceName);
        if (voice) {
            utterance.voice = voice;
        }
    }

    speechSynthesis.speak(utterance);
}

const resizeObserver = new ResizeObserver(() => {
    layoutSubagents();
});
resizeObserver.observe(container);

try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('model.glb');
    baseAsset = createBaseAsset(gltf.scene);
} catch {
    baseAsset = createBaseAsset(null);
}

initializeRootAvatar();
layoutSubagents();
updateStatusIndicator();
updateBadgeVisibility();
updateCamera();
startAnimation();

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
