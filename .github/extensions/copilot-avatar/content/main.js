import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- Message display ---
const messageEl = document.getElementById('message-text');
const statusEl = document.getElementById('status-indicator');
const subtasksEl = document.getElementById('subtasks');
let fadeTimeout = null;

window.showMessage = (text) => {
    if (fadeTimeout) clearTimeout(fadeTimeout);

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
    if (active) {
        statusEl.textContent = '● Working…';
        statusEl.classList.add('active');
    } else {
        statusEl.classList.remove('active');
        subtasksEl.textContent = '';
    }
};

window.setSubtask = (text) => {
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
    voices.forEach(v => {
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

window.setContext = ({ folder, sessionTitle }) => {
    const folderEl = document.querySelector('#session-context .folder-name');
    const nameEl = document.querySelector('#session-context .session-name');
    folderEl.textContent = folder || '';
    nameEl.textContent = sessionTitle || '';
    nameEl.style.display = sessionTitle ? '' : 'none';
    document.title = `Copilot Avatar · ${folder || ''}`;
};

// Load initial session context (must come after window.setContext is defined)
try {
    const ctx = await copilot.getContext();
    if (ctx) window.setContext(ctx);
} catch {}

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
        const voice = speechSynthesis.getVoices().find(v => v.name === ttsVoiceName);
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
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float capsule = length(max(abs(uv) - vec2(0.2, 0.45), 0.0)) - 0.35;
    float mask = 1.0 - smoothstep(-0.05, 0.02, capsule);
    float blinkMask = smoothstep(1.0 - uBlink, 1.0 - uBlink + 0.05, 1.0 - abs(uv.y));
    float scanline = sin(vUv.y * 40.0 + uTime * 2.0) * 0.5 + 0.5;
    scanline = smoothstep(0.3, 0.7, scanline);
    float brightness = 0.7 + scanline * 0.3;
    float alpha = mask * blinkMask;
    vec3 color = uColor * brightness;
    float glow = (1.0 - smoothstep(-0.15, 0.1, capsule)) * 0.3;
    color += uColor * glow;
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
        uColor: { value: new THREE.Color(0xffffff) }
    }
});

const eyeGeo = new THREE.PlaneGeometry(0.12, 0.18);
const eyeL = new THREE.Mesh(eyeGeo, eyeMatL);
const eyeR = new THREE.Mesh(eyeGeo, eyeMatR);

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

        eyeL.position.set(-eyeSpacing, eyeY, eyeZ);
        eyeR.position.set(eyeSpacing, eyeY, eyeZ);
        model.add(eyeL, eyeR);
        scene.add(model);
        startAnimation();
    },
    undefined,
    (err) => {
        // No model found — just show eyes in empty scene
        console.log('No model.glb found, showing eyes only:', err);
        eyeL.position.set(-0.15, 0, 0.5);
        eyeR.position.set(0.15, 0, 0.5);
        scene.add(eyeL, eyeR);
        startAnimation();
    }
);

function startAnimation() {
    let idleTime = 0;
    let blinkTimer = 2 + Math.random() * 3;
    let winkTimer = 8 + Math.random() * 10;
    let isBlinking = false;
    let isWinking = false;
    let blinkProgress = 0;
    let blinkPhase = 0;
    let targetRotY = 0, targetRotX = 0;
    let wanderTimer = 0;

    function animate() {
        requestAnimationFrame(animate);
        const dt = 1 / 60;
        idleTime += dt;

        eyeMatL.uniforms.uTime.value = idleTime;
        eyeMatR.uniforms.uTime.value = idleTime;

        if (model) {
            // Gentle bobbing
            model.position.y += (Math.sin(idleTime * 1.2) * 0.02 - model.position.y) * 0.03;

            // Head turning
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

        // Blinking
        blinkTimer -= dt;
        if (blinkTimer <= 0 && !isBlinking && !isWinking) {
            isBlinking = true;
            blinkPhase = 1;
            blinkProgress = 0;
            blinkTimer = 2 + Math.random() * 4;
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

        // Winking
        winkTimer -= dt;
        if (winkTimer <= 0 && !isBlinking && !isWinking) {
            isWinking = true;
            blinkPhase = 1;
            blinkProgress = 0;
            winkTimer = 10 + Math.random() * 12;
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
