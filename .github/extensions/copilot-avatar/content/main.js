import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import confetti from 'canvas-confetti';

// --- Message display ---
const messageEl = document.getElementById('message-text');
const statusEl = document.getElementById('status-indicator');
const subtasksEl = document.getElementById('subtasks');
const emotionBubbleEl = document.getElementById('emotion-bubble');
const confettiCanvas = document.getElementById('confetti-layer');
let fadeTimeout = null;
let isWorking = false;

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
const IDLE_SLEEP_MS = 5 * 60 * 1000;
const EMOTION_HOLD_MS = 9000;
const PARTY_CONFETTI_MS = 4200;
const PARTY_BURST_INTERVAL_MS = 240;
const SPARKLE_CONFETTI_MS = 1800;
const SPARKLE_BURST_INTERVAL_MS = 180;
const PARTY_COLORS = ['#ffd866', '#ff7eb6', '#8ea8ff', '#7ce7ff', '#9dff8f', '#ffffff'];
const emotionState = {
    active: 'default',
    transient: 'default',
    until: 0,
    lastActivityAt: performance.now(),
};
const confettiState = {
    timeoutId: null,
    burstId: null,
    until: 0,
};
const fireConfetti = confetti.create(confettiCanvas, {
    resize: true,
    useWorker: true,
});

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

function registerActivity() {
    emotionState.lastActivityAt = performance.now();
}

function triggerEmotion(name, durationMs = EMOTION_HOLD_MS) {
    emotionState.transient = name;
    emotionState.until = performance.now() + durationMs;
}

function getActiveEmotion(now = performance.now()) {
    if (!isWorking && now - emotionState.lastActivityAt >= IDLE_SLEEP_MS) return 'sleep';
    if (emotionState.until > now) return emotionState.transient;
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

function firePartyBurst() {
    const drift = Math.random() * 0.18;
    fireConfetti({
        particleCount: 28,
        angle: 60,
        spread: 72,
        startVelocity: 52,
        gravity: 1.05,
        scalar: 1.05,
        origin: { x: -0.02, y: 0.72 - drift },
        colors: PARTY_COLORS,
    });
    fireConfetti({
        particleCount: 28,
        angle: 120,
        spread: 72,
        startVelocity: 52,
        gravity: 1.05,
        scalar: 1.05,
        origin: { x: 1.02, y: 0.72 - drift },
        colors: PARTY_COLORS,
    });
    fireConfetti({
        particleCount: 24,
        angle: 90,
        spread: 110,
        startVelocity: 42,
        gravity: 0.95,
        scalar: 1.1,
        origin: { x: 0.5 + (Math.random() - 0.5) * 0.4, y: -0.05 },
        colors: PARTY_COLORS,
    });
}

function fireSparkleBurst() {
    fireConfetti({
        particleCount: 22,
        spread: 118,
        startVelocity: 22,
        gravity: 0.35,
        ticks: 240,
        scalar: 0.85,
        origin: { x: 0.5, y: 0.2 },
        colors: ['#ffffff', '#fff0a8', '#ffe38a', '#8ea8ff'],
    });
}

function stopConfettiEffect() {
    if (confettiState.timeoutId) {
        clearTimeout(confettiState.timeoutId);
        confettiState.timeoutId = null;
    }
    if (confettiState.burstId) {
        clearInterval(confettiState.burstId);
        confettiState.burstId = null;
    }
}

function startConfettiEffect(durationMs, intervalMs, burstFn) {
    stopConfettiEffect();
    confettiState.until = performance.now() + durationMs;
    burstFn();
    confettiState.burstId = setInterval(() => {
        if (performance.now() >= confettiState.until) {
            stopConfettiEffect();
            return;
        }
        burstFn();
    }, intervalMs);
    confettiState.timeoutId = setTimeout(() => {
        stopConfettiEffect();
    }, durationMs + intervalMs);
}

function startPartyConfetti(durationMs = PARTY_CONFETTI_MS) {
    startConfettiEffect(durationMs, PARTY_BURST_INTERVAL_MS, firePartyBurst);
}

function startSparkleConfetti(durationMs = SPARKLE_CONFETTI_MS) {
    startConfettiEffect(durationMs, SPARKLE_BURST_INTERVAL_MS, fireSparkleBurst);
}

window.showMessage = (text) => {
    if (fadeTimeout) clearTimeout(fadeTimeout);
    registerActivity();

    const emotion = detectEmotion(text);
    if (emotion === 'party') {
        triggerEmotion('party', PARTY_CONFETTI_MS + 1200);
        startPartyConfetti();
    } else if (emotion === 'sparkle') {
        triggerEmotion('sparkle', SPARKLE_CONFETTI_MS + 900);
        startSparkleConfetti();
    } else if (emotion) {
        triggerEmotion(emotion);
    }

    // Show full message
    messageEl.classList.remove('fading');
    messageEl.classList.add('visible');
    messageEl.textContent = text;

    // Speak the message if TTS is enabled
    speak(text);

    // Fade out after 6 seconds or when next message arrives
    fadeTimeout = setTimeout(() => {
        messageEl.classList.add('fading');
        messageEl.classList.remove('visible');
    }, 6000);
};

window.setWorking = (active) => {
    isWorking = !!active;
    if (active) registerActivity();

    if (active) {
        statusEl.textContent = '● Working…';
        statusEl.classList.add('active');
    } else {
        statusEl.classList.remove('active');
        subtasksEl.textContent = '';
    }
};

window.setSubtask = (text) => {
    if (text) registerActivity();
    subtasksEl.textContent = text || '';
};

// --- Text-to-Speech ---
let ttsEnabled = false;
let ttsRate = 1.1;
let ttsPitch = 1.0;
let ttsVoiceName = null;
const ttsToggleBtn = document.getElementById('tts-toggle');
const ttsSettingsBtn = document.getElementById('tts-settings-btn');
const ttsDropdown = document.getElementById('tts-dropdown');
const ttsVoiceSelect = document.getElementById('tts-voice-select');
const ttsRateInput = document.getElementById('tts-rate-input');
const ttsRateValue = document.getElementById('tts-rate-value');
const ttsPitchInput = document.getElementById('tts-pitch-input');
const ttsPitchValue = document.getElementById('tts-pitch-value');

function updateTtsButton() {
    ttsToggleBtn.textContent = ttsEnabled ? '🔊' : '🔇';
}

// Load saved settings from file via bridge
let savedTts = {};
try { savedTts = await copilot.loadSettings() || {}; } catch {}
if (savedTts.rate) { ttsRate = savedTts.rate; ttsRateInput.value = ttsRate; ttsRateValue.textContent = `${ttsRate.toFixed(1)}×`; }
if (savedTts.pitch != null) { ttsPitch = savedTts.pitch; ttsPitchInput.value = ttsPitch; ttsPitchValue.textContent = ttsPitch.toFixed(1); }
if (savedTts.voice) { ttsVoiceName = savedTts.voice; }
if (savedTts.enabled) { ttsEnabled = true; updateTtsButton(); }

function saveTtsSettings() {
    copilot.saveSettings({ enabled: ttsEnabled, rate: ttsRate, pitch: ttsPitch, voice: ttsVoiceName }).catch(() => {});
}

function populateVoices() {
    const voices = speechSynthesis.getVoices();
    ttsVoiceSelect.innerHTML = '';
    voices.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        if (v.name === ttsVoiceName) opt.selected = true;
        ttsVoiceSelect.appendChild(opt);
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
    return ttsEnabled;
};

window.getTts = () => ttsEnabled;

window.getVoices = () => {
    const voices = speechSynthesis.getVoices();
    return voices.map((v, i) => `${i}: ${v.name} (${v.lang})`).join('\n');
};

window.setVoice = (name) => {
    ttsVoiceName = name;
    ttsVoiceSelect.value = name;
    return `Voice set to: ${name}`;
};

window.setRate = (rate) => {
    ttsRate = Math.max(0.5, Math.min(3.0, Number(rate) || 1.1));
    ttsRateInput.value = ttsRate;
    ttsRateValue.textContent = `${ttsRate.toFixed(1)}×`;
    return `Rate set to: ${ttsRate}`;
};

window.getTtsSettings = () => JSON.stringify({ enabled: ttsEnabled, rate: ttsRate, voice: ttsVoiceName });

function speak(text) {
    if (!ttsEnabled || !text) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = ttsRate;
    utterance.pitch = ttsPitch;
    if (ttsVoiceName) {
        const voice = speechSynthesis.getVoices().find((v) => v.name === ttsVoiceName);
        if (voice) utterance.voice = voice;
    }
    speechSynthesis.speak(utterance);
}

// --- 3D Avatar ---
const container = document.getElementById('avatar-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 1000);
camera.position.set(0, 0.05, 1.4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0x8866ff, 0.4);
fillLight.position.set(-3, 2, -2);
scene.add(fillLight);
scene.add(new THREE.HemisphereLight(0x9966ff, 0x222244, 0.6));

// --- Digital eye shader ---
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

const eyeMatL = new THREE.ShaderMaterial({
    vertexShader: eyeVertexShader,
    fragmentShader: eyeFragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
        uTime: { value: 0 },
        uBlink: { value: 1.0 },
        uMode: { value: 0.0 },
        uColor: { value: new THREE.Color(0xffffff) }
    }
});

const eyeMatR = new THREE.ShaderMaterial({
    vertexShader: eyeVertexShader,
    fragmentShader: eyeFragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
        uTime: { value: 0 },
        uBlink: { value: 1.0 },
        uMode: { value: 0.0 },
        uColor: { value: new THREE.Color(0xffffff) }
    }
});

const eyeGeo = new THREE.PlaneGeometry(0.12, 0.18);
const eyeL = new THREE.Mesh(eyeGeo, eyeMatL);
const eyeR = new THREE.Mesh(eyeGeo, eyeMatR);
eyeL.renderOrder = 2;
eyeR.renderOrder = 2;

function createHeartEye() {
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
    const maxDim = Math.max(
        bounds.max.x - bounds.min.x,
        bounds.max.y - bounds.min.y
    );
    geometry.scale(1 / maxDim, 1 / maxDim, 1);

    const glow = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
            color: 0xff5ca8,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            side: THREE.DoubleSide,
        })
    );
    const core = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
            color: 0xff8fc7,
            depthWrite: false,
            side: THREE.DoubleSide,
        })
    );

    glow.scale.setScalar(1.22);
    glow.position.z = -0.001;
    glow.renderOrder = 3;
    core.position.z = 0.001;
    core.renderOrder = 4;

    const heart = new THREE.Group();
    heart.visible = false;
    heart.add(glow, core);
    return heart;
}

function placeHeartEye(heartEye, x, y, z, scale = 0.1) {
    heartEye.position.set(x, y, z + 0.003);
    heartEye.userData.baseScale = scale;
    heartEye.scale.setScalar(scale);
}

const heartEyeL = createHeartEye();
const heartEyeR = createHeartEye();
heartEyeL.rotation.z = Math.PI - 0.16;
heartEyeR.rotation.z = Math.PI + 0.16;

const raccoonMask = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
        color: 0x05070c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
    })
);
raccoonMask.visible = false;
raccoonMask.renderOrder = 1;

// Load model (try model.glb from the repo root served alongside content)
// The model file needs to be in the content directory for the webview to serve it
let model = null;

// Try loading model — if not available, we'll just show the eyes floating
const loader = new GLTFLoader();
loader.load(
    'model.glb',
    (gltf) => {
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(0, size.y * 0.1, maxDim * 2.2);

        // Position eyes
        const eyeZ = size.z * 0.39;
        const eyeY = size.y * 0.28;
        const eyeSpacing = size.x * 0.11;

        raccoonMask.scale.set(size.x * 0.44, size.y * 0.13, 1);
        raccoonMask.position.set(0, eyeY, eyeZ - 0.01);
        eyeL.position.set(-eyeSpacing, eyeY, eyeZ);
        eyeR.position.set(eyeSpacing, eyeY, eyeZ);
        placeHeartEye(heartEyeL, -eyeSpacing * 0.98, eyeY, eyeZ, 0.1);
        placeHeartEye(heartEyeR, eyeSpacing * 0.98, eyeY, eyeZ, 0.1);
        model.add(raccoonMask, eyeL, eyeR, heartEyeL, heartEyeR);
        scene.add(model);
        startAnimation();
    },
    undefined,
    (err) => {
        // No model found — just show eyes and mask in empty scene
        console.log('No model.glb found, showing eyes only:', err);
        raccoonMask.scale.set(0.42, 0.14, 1);
        raccoonMask.position.set(0, 0, 0.48);
        eyeL.position.set(-0.15, 0, 0.5);
        eyeR.position.set(0.15, 0, 0.5);
        placeHeartEye(heartEyeL, -0.15, 0, 0.5, 0.1);
        placeHeartEye(heartEyeR, 0.15, 0, 0.5, 0.1);
        scene.add(raccoonMask, eyeL, eyeR, heartEyeL, heartEyeR);
        startAnimation();
    }
);

function startAnimation() {
    let idleTime = 0;
    let currentEmotion = 'default';
    let blinkTimer = 2 + Math.random() * 3;
    let winkTimer = 8 + Math.random() * 10;
    let isBlinking = false;
    let isWinking = false;
    let blinkProgress = 0;
    let blinkPhase = 0;
    let targetRotY = 0;
    let targetRotX = 0;
    let wanderTimer = 0;
    const bubbleAnchor = new THREE.Vector3();
    const eyeColor = new THREE.Color(0xffffff);

    function updateBubblePosition() {
        if (!emotionBubbleEl.classList.contains('visible')) return;

        if (model) {
            scene.updateMatrixWorld();
            eyeR.getWorldPosition(bubbleAnchor);
            bubbleAnchor.project(camera);
            const x = (bubbleAnchor.x * 0.5 + 0.5) * container.clientWidth + 46;
            const y = (-bubbleAnchor.y * 0.5 + 0.5) * container.clientHeight - 70;
            emotionBubbleEl.style.left = `${x}px`;
            emotionBubbleEl.style.top = `${y}px`;
            return;
        }

        emotionBubbleEl.style.left = '62%';
        emotionBubbleEl.style.top = '26%';
    }

    function animate() {
        requestAnimationFrame(animate);
        const dt = 1 / 60;
        const now = performance.now();
        const emotion = getActiveEmotion(now);
        idleTime += dt;

        if (emotion !== currentEmotion) {
            currentEmotion = emotion;
            emotionState.active = emotion;
            updateEmotionBubble(emotion);
        }

        eyeMatL.uniforms.uTime.value = idleTime;
        eyeMatR.uniforms.uTime.value = idleTime;

        let eyeMode = 0;
        let eyeScaleX = 1;
        let eyeScaleY = 1;
        let heartPulse = 1;
        let showHeartEyes = false;
        let maskOpacity = 0;
        let blinkEnabled = emotion === 'default' || emotion === 'raccoon';
        let winkEnabled = emotion === 'default';
        eyeColor.set(0xffffff);

        if (emotion === 'heart') {
            showHeartEyes = true;
            heartPulse = 1 + Math.sin(idleTime * 5.5) * 0.06;
        } else if (emotion === 'laugh') {
            eyeMode = 1;
            eyeScaleX = 1.08;
            eyeScaleY = 0.72;
            eyeColor.set(0xffe38a);
        } else if (emotion === 'party') {
            eyeMode = 1;
            eyeScaleX = 1.12;
            eyeScaleY = 0.76;
            eyeColor.set(0xfff08f);
        } else if (emotion === 'think') {
            eyeScaleX = 0.96;
            eyeScaleY = 0.92;
            eyeColor.set(0xc7d2ff);
        } else if (emotion === 'success') {
            eyeScaleX = 1.02;
            eyeScaleY = 1.02;
            eyeColor.set(0x7ee787);
        } else if (emotion === 'warning') {
            eyeScaleX = 1.03;
            eyeScaleY = 0.82;
            eyeColor.set(0xffb86b);
        } else if (emotion === 'error') {
            eyeScaleX = 0.98;
            eyeScaleY = 0.78;
            eyeColor.set(0xff7b72);
        } else if (emotion === 'sparkle') {
            eyeScaleX = 1.05 + Math.sin(idleTime * 4.6) * 0.03;
            eyeScaleY = 1.05 + Math.sin(idleTime * 4.6) * 0.03;
            eyeColor.set(0xfff0a8);
        } else if (emotion === 'sleep') {
            eyeMode = 2;
            eyeScaleX = 1.04;
            eyeScaleY = 0.72;
            eyeColor.set(0x9fb5ff);
        } else if (emotion === 'raccoon') {
            maskOpacity = 0.82;
            eyeColor.set(0xf3f7ff);
        }

        if (model) {
            if (emotion === 'heart') {
                model.position.y = Math.sin(idleTime * 2.2) * 0.03;
                model.rotation.y = Math.sin(idleTime * 1.4) * 0.16;
                model.rotation.x = -0.04 + Math.cos(idleTime * 1.8) * 0.02;
                model.rotation.z = Math.sin(idleTime * 2.6) * 0.05;
            } else if (emotion === 'laugh') {
                model.position.y = Math.sin(idleTime * 8.5) * 0.025;
                model.rotation.y = Math.sin(idleTime * 6.4) * 0.07;
                model.rotation.x = Math.cos(idleTime * 4.5) * 0.03;
                model.rotation.z = Math.sin(idleTime * 12.5) * 0.04;
            } else if (emotion === 'party') {
                model.position.y = Math.sin(idleTime * 9.2) * 0.028;
                model.rotation.y = Math.sin(idleTime * 7.2) * 0.08;
                model.rotation.x = Math.cos(idleTime * 5.0) * 0.04;
                model.rotation.z = 0.02 + Math.sin(idleTime * 13.5) * 0.055;
            } else if (emotion === 'think') {
                model.position.y = Math.sin(idleTime * 1.1) * 0.012;
                model.rotation.y = 0.18 + Math.sin(idleTime * 0.8) * 0.04;
                model.rotation.x = -0.1 + Math.cos(idleTime * 0.9) * 0.02;
                model.rotation.z = -0.02 + Math.sin(idleTime * 0.6) * 0.015;
            } else if (emotion === 'success') {
                model.position.y = Math.sin(idleTime * 4.2) * 0.018;
                model.rotation.y = Math.sin(idleTime * 2.1) * 0.04;
                model.rotation.x = 0.03 + Math.sin(idleTime * 8.4) * 0.08;
                model.rotation.z = Math.sin(idleTime * 4.5) * 0.02;
            } else if (emotion === 'warning') {
                model.position.y = Math.sin(idleTime * 3.0) * 0.01;
                model.rotation.y = Math.sin(idleTime * 3.4) * 0.08;
                model.rotation.x = -0.02 + Math.cos(idleTime * 3.2) * 0.03;
                model.rotation.z = Math.sin(idleTime * 6.0) * 0.02;
            } else if (emotion === 'error') {
                model.position.y = -0.012 + Math.sin(idleTime * 1.4) * 0.006;
                model.rotation.y = Math.sin(idleTime * 1.0) * 0.03;
                model.rotation.x = -0.14 + Math.cos(idleTime * 1.1) * 0.02;
                model.rotation.z = -0.05 + Math.sin(idleTime * 0.9) * 0.01;
            } else if (emotion === 'sparkle') {
                model.position.y = Math.sin(idleTime * 2.6) * 0.02;
                model.rotation.y = Math.sin(idleTime * 2.2) * 0.06;
                model.rotation.x = Math.cos(idleTime * 1.8) * 0.03;
                model.rotation.z = Math.sin(idleTime * 4.0) * 0.025;
            } else if (emotion === 'sleep') {
                model.position.y = Math.sin(idleTime * 0.9) * 0.01;
                model.rotation.y = Math.sin(idleTime * 0.35) * 0.04;
                model.rotation.x = -0.1 + Math.sin(idleTime * 0.6) * 0.03;
                model.rotation.z = -0.03 + Math.sin(idleTime * 0.45) * 0.015;
            } else if (emotion === 'raccoon') {
                model.position.y = Math.sin(idleTime * 1.8) * 0.015;
                model.rotation.y = Math.sin(idleTime * 1.9) * 0.25;
                model.rotation.x = Math.cos(idleTime * 1.5) * 0.03;
                model.rotation.z = Math.sin(idleTime * 2.3) * 0.035;
            } else {
                model.position.y += (Math.sin(idleTime * 1.2) * 0.02 - model.position.y) * 0.03;

                wanderTimer -= dt;
                if (wanderTimer <= 0) {
                    targetRotY = (Math.random() - 0.5) * 0.3;
                    targetRotX = (Math.random() - 0.5) * 0.1;
                    wanderTimer = 2.5 + Math.random() * 3;
                }
                model.rotation.y += (targetRotY - model.rotation.y) * 0.015;
                model.rotation.x += (targetRotX - model.rotation.x) * 0.015;
                model.rotation.z = Math.sin(idleTime * 0.6) * 0.015;
            }
        }

        raccoonMask.visible = maskOpacity > 0.01;
        raccoonMask.material.opacity = maskOpacity;
        eyeL.visible = !showHeartEyes;
        eyeR.visible = !showHeartEyes;
        heartEyeL.visible = showHeartEyes;
        heartEyeR.visible = showHeartEyes;
        eyeL.scale.set(eyeScaleX, eyeScaleY, 1);
        eyeR.scale.set(eyeScaleX, eyeScaleY, 1);
        heartEyeL.scale.setScalar(heartEyeL.userData.baseScale * heartPulse);
        heartEyeR.scale.setScalar(heartEyeR.userData.baseScale * heartPulse);
        eyeMatL.uniforms.uMode.value = eyeMode;
        eyeMatR.uniforms.uMode.value = eyeMode;
        eyeMatL.uniforms.uColor.value.copy(eyeColor);
        eyeMatR.uniforms.uColor.value.copy(eyeColor);

        if (!blinkEnabled) {
            isBlinking = false;
            blinkTimer = 2 + Math.random() * 4;
            eyeMatL.uniforms.uBlink.value = 1;
            eyeMatR.uniforms.uBlink.value = 1;
        } else {
            blinkTimer -= dt;
            if (blinkTimer <= 0 && !isBlinking && !isWinking) {
                isBlinking = true;
                blinkPhase = 1;
                blinkProgress = 0;
                blinkTimer = 2 + Math.random() * 4;
            }
        }

        if (isBlinking) {
            blinkProgress += dt * 12;
            if (blinkPhase === 1) {
                const s = Math.max(0, 1 - blinkProgress * 1.5);
                eyeMatL.uniforms.uBlink.value = s;
                eyeMatR.uniforms.uBlink.value = s;
                if (s <= 0) { blinkPhase = 2; blinkProgress = 0; }
            } else {
                const s = Math.min(1, blinkProgress * 1.5);
                eyeMatL.uniforms.uBlink.value = s;
                eyeMatR.uniforms.uBlink.value = s;
                if (s >= 1) {
                    isBlinking = false;
                    eyeMatL.uniforms.uBlink.value = 1;
                    eyeMatR.uniforms.uBlink.value = 1;
                }
            }
        }

        if (!winkEnabled) {
            isWinking = false;
            winkTimer = 10 + Math.random() * 12;
            eyeMatL.uniforms.uBlink.value = 1;
        } else {
            winkTimer -= dt;
            if (winkTimer <= 0 && !isBlinking && !isWinking) {
                isWinking = true;
                blinkPhase = 1;
                blinkProgress = 0;
                winkTimer = 10 + Math.random() * 12;
            }
        }

        if (isWinking) {
            blinkProgress += dt * 10;
            if (blinkPhase === 1) {
                const s = Math.max(0, 1 - blinkProgress * 1.5);
                eyeMatL.uniforms.uBlink.value = s;
                if (s <= 0) { blinkPhase = 2; blinkProgress = 0; }
            } else {
                const s = Math.min(1, blinkProgress * 1.2);
                eyeMatL.uniforms.uBlink.value = s;
                if (s >= 1) {
                    isWinking = false;
                    eyeMatL.uniforms.uBlink.value = 1;
                }
            }
        }

        updateBubblePosition();
        renderer.render(scene, camera);
    }

    animate();
}

// Handle resize
const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
});
ro.observe(container);
