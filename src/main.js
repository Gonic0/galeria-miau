import * as THREE from 'three/webgpu';
import {
  pass,
  mrt,
  output,
  normalView,
  metalness,
  roughness,
  vec2,
  vec3,
  vec4,
  float,
  uniform,
  attribute,
  positionLocal,
  uv,
  screenUV,
  cameraPosition,
  positionWorld,
  positionView,
  modelViewMatrix,
  cameraProjectionMatrix,
  sample,
  colorToDirection,
  directionToColor,
  toneMapping,
  Fn,
  sin,
  cos,
  smoothstep,
  pow,
  length,
  mix,
  saturate,
  abs,
  step,
  color,
  texture3D,
  time
} from 'three/tsl';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { outline } from 'three/addons/tsl/display/OutlineNode.js';
import { lut3D } from 'three/addons/tsl/display/Lut3DNode.js';
import { anamorphic } from 'three/addons/tsl/display/AnamorphicNode.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  Bookmark,
  ExternalLink,
  HandCoins,
  HeartHandshake,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Share2,
  Volume2,
  VolumeX,
  X,
  createIcons
} from 'lucide';
import './styles.css';
import { artworks, galleryConfig, sponsors } from './gallery/catalog.js';
import { GalleryAudio } from './gallery/audio.js';

createIcons({
  icons: {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Award,
    Bookmark,
    ExternalLink,
    HandCoins,
    HeartHandshake,
    MousePointer2,
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Share2,
    Volume2,
    VolumeX,
    X
  }
});

const canvas = document.querySelector('#gallery-canvas');
const enterButton = document.querySelector('#enter-gallery');
const artPanel = document.querySelector('#art-panel');
const artTitle = document.querySelector('#art-title');
const artMeta = document.querySelector('#art-meta');
const artStory = document.querySelector('#art-story');
const artNumber = document.querySelector('#art-number');
const artDonate = document.querySelector('#art-donate');
const donateOpen = document.querySelector('#donate-open');
const donateClose = document.querySelector('#donate-close');
const donationPanel = document.querySelector('#donation-panel');
const donationTitle = document.querySelector('#donation-title');
const donationCopy = document.querySelector('#donation-copy');
const donationTiers = document.querySelector('#donation-tiers');
const donationCheckout = document.querySelector('#donation-checkout');
const sponsorLabel = document.querySelector('#sponsor-label');
const sponsorLink = document.querySelector('#sponsor-link');
const soundToggle = document.querySelector('#sound-toggle');
const perfPanel = {
  fps: document.querySelector('#perf-fps'),
  ms: document.querySelector('#perf-ms'),
  draws: document.querySelector('#perf-draws'),
  tris: document.querySelector('#perf-tris'),
  textures: document.querySelector('#perf-textures'),
  heap: document.querySelector('#perf-heap')
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeadbe1);
scene.fog = new THREE.Fog(0xead7df, 38, 72);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 80);
camera.rotation.order = 'YXZ';

const reticleEl = document.querySelector('.reticle');
const artworkModal = document.querySelector('#artwork-modal');
const artworkModalImage = document.querySelector('#artwork-modal-image');
const artworkModalTitle = document.querySelector('#artwork-modal-title');
const artworkModalMeta = document.querySelector('#artwork-modal-meta');
const artworkModalStory = document.querySelector('#artwork-modal-story');
const artworkModalClose = document.querySelector('#artwork-modal-close');
const artworkModalSupport = document.querySelector('#artwork-modal-support');
const artworkModalShare = document.querySelector('#artwork-modal-share');
const welcomeEl = document.querySelector('#welcome');
const welcomeStartBtn = document.querySelector('#welcome-start');
const welcomeTourBtn = document.querySelector('#welcome-tour');
const tourToggleBtn = document.querySelector('#tour-toggle');
const progressPill = document.querySelector('#progress-pill');
const progressCurrent = document.querySelector('#progress-current');
const progressTotal = document.querySelector('#progress-total');
const completionEl = document.querySelector('#completion');
const completionCloseBtn = document.querySelector('#completion-close');
const completionSupportBtn = document.querySelector('#completion-support');
const completionShareBtn = document.querySelector('#completion-share');

const PROGRESS_KEY = 'galeria-miau-vistos';
const baseObraIds = new Set();
artworks.forEach((a) => {
  const baseId = a.id.replace(/-\d+$/, '');
  baseObraIds.add(baseId);
});
const seenObras = new Set(loadSeen());

function loadSeen() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return [];
    return JSON.parse(raw).filter((id) => baseObraIds.has(id));
  } catch {
    return [];
  }
}

function persistSeen() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...seenObras]));
  } catch {
    /* noop */
  }
}
const tourState = {
  active: false,
  index: 0,
  segmentStart: 0,
  duration: 4.2,
  pauseDuration: 2.6,
  pausing: false,
  pauseStart: 0,
  fromX: 0,
  fromZ: 0,
  fromYaw: 0,
  toX: 0,
  toZ: 0,
  toYaw: 0
};

const focusAnimation = {
  active: false,
  mode: 'idle',
  startTime: 0,
  duration: 0.9,
  fromX: 0,
  fromZ: 0,
  fromYaw: 0,
  toX: 0,
  toZ: 0,
  toYaw: 0,
  returnX: 0,
  returnZ: 0,
  returnYaw: 0,
  pendingArtwork: null,
  hasReturn: false
};
const perfPanelEl = document.querySelector('#perf-panel');
const shaderTimeUniforms = [];
const galleryAudio = new GalleryAudio();
let stepDistance = 0;
let lastMeowAt = 0;
const meowedArtworks = new Set();
const debugMode =
  new URLSearchParams(window.location.search).has('debug') ||
  window.location.hash.includes('debug');
if (debugMode) {
  perfPanelEl.classList.add('is-visible');
}

const renderer = new THREE.WebGPURenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.3;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

try {
  await renderer.init();
} catch (error) {
  console.warn('WebGPU/WebGL2 init failed:', error);
  document.getElementById('splash')?.remove();
  document.getElementById('app')?.setAttribute('hidden', '');
  const unsupportedEl = document.getElementById('unsupported');
  if (unsupportedEl) unsupportedEl.hidden = false;
  throw error;
}

const splashEl = document.querySelector('#splash');
const splashBarEl = document.querySelector('#splash-bar');
const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (_url, loaded, total) => {
  if (!splashBarEl) return;
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
  splashBarEl.style.width = `${pct}%`;
};
loadingManager.onLoad = () => {
  if (!splashEl) return;
  splashBarEl.style.width = '100%';
  setTimeout(() => {
    splashEl.classList.add('is-fading');
    setTimeout(() => splashEl.remove(), 700);
  }, 280);
};

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

new RGBELoader(loadingManager).load('/hdr/museum_1k.hdr', (hdrTexture) => {
  hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmremGenerator.fromEquirectangular(hdrTexture).texture;
  hdrTexture.dispose();
});

const renderPipeline = new THREE.RenderPipeline(renderer);
const scenePass = pass(scene, camera);
scenePass.setMRT(
  mrt({
    output,
    normal: directionToColor(normalView),
    metalrough: vec2(metalness, roughness)
  })
);
scenePass.getTexture('normal').type = THREE.UnsignedByteType;
scenePass.getTexture('metalrough').type = THREE.UnsignedByteType;

const scenePassColor = scenePass.getTextureNode('output');
const scenePassDepth = scenePass.getTextureNode('depth');
const scenePassNormal = scenePass.getTextureNode('normal');
const scenePassMetalRough = scenePass.getTextureNode('metalrough');

const sceneNormal = sample((uv) => colorToDirection(scenePassNormal.sample(uv)));

const ssrNode = ssr(
  scenePassColor,
  scenePassDepth,
  sceneNormal,
  scenePassMetalRough.r,
  scenePassMetalRough.g
);

const aoNode = ao(scenePassDepth, scenePassNormal, camera);
const aoFactor = mix(float(1), aoNode.r, float(0.45));
const sceneWithAO = scenePassColor.mul(aoFactor);
const sceneWithReflections = sceneWithAO.add(ssrNode.rgb);
const vignetteFactor = float(1).sub(
  smoothstep(0.45, 0.95, length(screenUV.sub(vec2(0.5, 0.5)))).mul(0.4)
);
const flaresPass = anamorphic(sceneWithReflections, float(2.8), float(2.2), 16);
flaresPass.colorNode = vec3(0.95, 0.7, 0.32);
const sceneWithFlares = sceneWithReflections.add(flaresPass.mul(float(0.28)));

const grained = film(sceneWithFlares.mul(vignetteFactor), float(0.18));

const museumLutSize = 32;
const museumLutTexture = makeMuseumLut(museumLutSize);
const graded = lut3D(grained, texture3D(museumLutTexture), museumLutSize, float(0.85));

const outlineSelected = [];
const outlinePulse = sin(time.mul(2.4)).mul(0.18).add(0.32);
const outlinePass = outline(scene, camera, {
  selectedObjects: outlineSelected,
  edgeThickness: float(1.05),
  edgeGlow: outlinePulse,
  downSampleRatio: 4
});
const outlineVisibleColor = color(0xffd27a);
const outlineEdge = outlinePass.visibleEdge.mul(outlineVisibleColor).mul(float(1.2));

renderPipeline.outputNode = smaa(graded.add(outlineEdge));

function makeMuseumLut(size) {
  const data = new Uint8Array(size * size * size * 4);
  let idx = 0;
  for (let z = 0; z < size; z += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let r = x / (size - 1);
        let g = y / (size - 1);
        let b = z / (size - 1);

        const sCurve = (v) => v * v * (3 - 2 * v);
        r = r + (sCurve(r) - r) * 0.18;
        g = g + (sCurve(g) - g) * 0.18;
        b = b + (sCurve(b) - b) * 0.18;

        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const shadowMix = (1 - luma) * (1 - luma);
        const highlightMix = luma * luma;
        r += shadowMix * 0.045 + highlightMix * -0.018;
        g += shadowMix * 0.012 + highlightMix * 0.004;
        b += shadowMix * -0.05 + highlightMix * 0.028;

        const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const sat = 1.07;
        r = grey + (r - grey) * sat;
        g = grey + (g - grey) * sat;
        b = grey + (b - grey) * sat;

        data[idx++] = Math.max(0, Math.min(255, Math.round(r * 255)));
        data[idx++] = Math.max(0, Math.min(255, Math.round(g * 255)));
        data[idx++] = Math.max(0, Math.min(255, Math.round(b * 255)));
        data[idx++] = 255;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const textureLoader = new THREE.TextureLoader(loadingManager);
const textureCache = new Map();
const materialCache = new Map();
const geometryCache = new Map();
const plaqueTextureCache = new Map();
const reflectionAlphaCache = new Map();
const frameGrainTexture = makeFrameGrainTexture();
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const lookTarget = new THREE.Vector2(0, 0);
const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const moveVector = new THREE.Vector3();
const centerObstacles = [
  { min: new THREE.Vector2(-0.8, -6.8), max: new THREE.Vector2(0.8, -5.2) },
  { min: new THREE.Vector2(-0.8, 4), max: new THREE.Vector2(0.8, 5.6) }
];
const artworkMeshes = [];
const frameByArtwork = new Map();
const keys = new Set();
const virtualControls = new Set();
const cameraState = {
  yaw: galleryConfig.room.start.yaw,
  pitch: 0.02,
  speed: 3.15,
  focusedArtwork: null,
  pointerDown: false,
  pointerId: null,
  pointerStartX: 0,
  pointerStartY: 0,
  pointerDragged: false,
  soundOn: false
};
const perfState = {
  frames: 0,
  elapsed: 0,
  lastMs: 0,
  lastUpdate: 0,
  lastCalls: 0,
  drawsPerFrame: 0
};

const room = {
  width: galleryConfig.room.width,
  depth: galleryConfig.room.depth,
  height: galleryConfig.room.height,
  springHeight: galleryConfig.room.springHeight,
  eyeHeight: galleryConfig.room.eyeHeight,
  artworkCenterY: galleryConfig.room.artworkCenterY,
  baseboardHeight: galleryConfig.room.baseboardHeight
};

camera.position.set(galleryConfig.room.start.x, galleryConfig.room.start.y, galleryConfig.room.start.z);

if (document.fonts?.load) {
  await Promise.race([
    Promise.all([
      document.fonts.load('600 132px "Cormorant Garamond"'),
      document.fonts.load('italic 600 132px "Cormorant Garamond"'),
      document.fonts.load('italic 600 52px "Cormorant Garamond"'),
      document.fonts.load('600 60px "Cormorant Garamond"')
    ]),
    new Promise((resolve) => setTimeout(resolve, 2500))
  ]);
}

buildGallery();
setupDonationPanel();
setupSponsors();
setupEvents();
setupDebugBridge();
updateProgressUI();
resize();

(function bootstrapEntryFlow() {
  const params = new URLSearchParams(window.location.search);
  const requestedObra = params.get('obra');
  if (requestedObra) {
    const artwork = artworks.find((a) => a.id === requestedObra);
    if (artwork) {
      setTimeout(() => openArtworkModal(artwork), 800);
      try {
        localStorage.setItem('galeria-miau-welcomed', '1');
      } catch {
        /* ignore */
      }
      return;
    }
  }
  let alreadySeen = false;
  try {
    alreadySeen = localStorage.getItem('galeria-miau-welcomed') === '1';
  } catch {
    /* ignore */
  }
  if (!alreadySeen && welcomeEl) {
    welcomeEl.hidden = false;
  }
  syncOverlayClass();
})();

function buildGallery() {
  scene.add(new THREE.HemisphereLight(0xeadcd2, 0x3a2f2b, 0.55));
  scene.add(new THREE.AmbientLight(0xfff5ea, 0.18));

  const floorTexture = makeMarbleTexture();
  floorTexture.colorSpace = THREE.SRGBColorSpace;
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(1.6, 6);

  const wallTexture = makePlasterTexture();
  wallTexture.colorSpace = THREE.SRGBColorSpace;
  wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(1.2, 7);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(room.width, room.depth, 18, 56),
    new THREE.MeshStandardMaterial({
      map: floorTexture,
      color: 0x1f1814,
      roughness: 0.22,
      metalness: 0.55,
      envMapIntensity: 0.3
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallTexture,
    color: 0xc7a8b1,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide
  });

  const vaultMaterial = new THREE.MeshStandardMaterial({
    color: 0xeae0d6,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide
  });

  addWall('front', 0, room.height / 2, -room.depth / 2, 0, wallMaterial);
  addWall('back', 0, room.height / 2, room.depth / 2, Math.PI, wallMaterial);
  addWall('left', -room.width / 2, room.height / 2, 0, Math.PI / 2, wallMaterial);
  addWall('right', room.width / 2, room.height / 2, 0, -Math.PI / 2, wallMaterial);
  addVaultCeiling(vaultMaterial);
  addCornices();
  addArchRibs();
  addCeilingOculi();
  addLowerGalleryBand();
  addBaseboards();
  addTrackLights();
  addCenterPlinths();
  addBenches();
  // Dust particles desactivado: OutlineNode aplica material override a toda la escena
  // durante el mask-pass y rompe con InstancedMesh + transparent+additive blending.
  // Para reactivar habria que renderizar el dust en un segundo render pass aparte.
  // addDustParticles();

  artworks.forEach((artwork) => addArtwork(artwork));
}

function addWall(name, x, y, z, rotationY, material) {
  const isSideWall = name === 'left' || name === 'right';
  const wallHeight = isSideWall ? room.springHeight : room.height;
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(isSideWall ? room.depth : room.width, wallHeight),
    material
  );
  wall.position.set(x, wallHeight / 2, z);
  wall.rotation.y = rotationY;
  wall.receiveShadow = true;
  scene.add(wall);
}

function addVaultCeiling(material) {
  const vault = new THREE.Mesh(getVaultGeometry(room.width, room.depth, room.springHeight, room.height, 24), material);
  vault.receiveShadow = true;
  scene.add(vault);
}

function addCornices() {
  const material = getMaterial('white-cornice', () => new THREE.MeshStandardMaterial({ color: 0xfaf3ec, roughness: 0.62, metalness: 0.02 }));
  const shadowMaterial = getMaterial('cornice-shadow', () => new THREE.MeshStandardMaterial({ color: 0xc8b4ba, roughness: 0.84, metalness: 0 }));
  const y = room.springHeight;
  [-1, 1].forEach((side) => {
    const upper = new THREE.Mesh(getBoxGeometry(0.42, 0.22, room.depth), material);
    upper.position.set(side * (room.width / 2 - 0.21), y + 0.04, 0);
    upper.castShadow = true;
    upper.receiveShadow = true;
    scene.add(upper);

    const middle = new THREE.Mesh(getBoxGeometry(0.32, 0.08, room.depth), material);
    middle.position.set(side * (room.width / 2 - 0.16), y - 0.14, 0);
    middle.castShadow = true;
    middle.receiveShadow = true;
    scene.add(middle);

    const dentil = new THREE.Mesh(getBoxGeometry(0.06, 0.06, room.depth), shadowMaterial);
    dentil.position.set(side * (room.width / 2 - 0.06), y - 0.05, 0);
    scene.add(dentil);
  });
}

function addArchRibs() {
  const material = getMaterial('vault-ribs-clear', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf6efe6,
      roughness: 0.78,
      metalness: 0
    })
  );
  const startY = room.springHeight + 0.18;
  const radius = room.width / 2 - 0.08;
  for (let z = -room.depth / 2 + 3.4; z <= room.depth / 2 - 3.4; z += 4.6) {
    const rib = new THREE.Mesh(getArchRibGeometry(radius, 0.32, 0.22, 28), material);
    rib.position.set(0, startY, z);
    rib.receiveShadow = true;
    scene.add(rib);
  }
}

function addCeilingOculi() {
  const oculusMaterial = getMaterial('oculus-glow', () =>
    new THREE.MeshBasicMaterial({
      color: 0xfff6e1,
      toneMapped: false
    })
  );
  const haloMaterial = getMaterial('oculus-halo', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf1e8de,
      roughness: 0.86,
      metalness: 0
    })
  );
  const moldingMaterial = getMaterial('oculus-molding', () =>
    new THREE.MeshStandardMaterial({ color: 0xede1d6, roughness: 0.6, metalness: 0.04 })
  );

  const ovalRX = 0.92;
  const ovalRZ = 0.5;
  const oculusY = 6.35;
  const startZ = -room.depth / 2 + 3.4;
  const endZ = room.depth / 2 - 3.4;
  const span = endZ - startZ;
  const groups = 5;
  const groupSpacing = span / (groups - 1);

  for (let g = 0; g < groups; g += 1) {
    const z = startZ + g * groupSpacing;
    [-1.55, 1.55].forEach((offsetX) => {
      const halo = new THREE.Mesh(getOvalGeometry(ovalRX + 0.34, ovalRZ + 0.26, 40), haloMaterial);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(offsetX, oculusY - 0.04, z);
      scene.add(halo);

      const molding = new THREE.Mesh(getOvalRingGeometry(ovalRX + 0.26, ovalRZ + 0.18, ovalRX + 0.04, ovalRZ + 0.02, 40), moldingMaterial);
      molding.rotation.x = Math.PI / 2;
      molding.position.set(offsetX, oculusY - 0.012, z);
      scene.add(molding);

      const glow = new THREE.Mesh(getOvalGeometry(ovalRX, ovalRZ, 40), oculusMaterial);
      glow.rotation.x = Math.PI / 2;
      glow.position.set(offsetX, oculusY, z);
      scene.add(glow);

      const skylight = new THREE.PointLight(0xfff1d8, 7, 7.5, 1.8);
      skylight.position.set(offsetX, oculusY - 0.4, z);
      scene.add(skylight);
    });
  }
}

function addLowerGalleryBand() {
  const ventMaterial = getMaterial('vent-grilles', () =>
    new THREE.MeshStandardMaterial({ color: 0x4a4036, roughness: 0.7, metalness: 0.1 })
  );

  [-1, 1].forEach((side) => {
    for (let z = -room.depth / 2 + 2.8; z <= room.depth / 2 - 2.8; z += 4.6) {
      const grille = new THREE.Mesh(getPlaneGeometry(0.36, 0.1), ventMaterial);
      grille.position.set(side * (room.width / 2 - 0.012), 0.18, z);
      grille.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(grille);
    }
  });
}

function addBaseboards() {
  const material = new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.52 });
  const frontBackGeometry = new THREE.BoxGeometry(room.width, room.baseboardHeight, 0.08);
  const sideGeometry = new THREE.BoxGeometry(0.08, room.baseboardHeight, room.depth);
  const placements = [
    [frontBackGeometry, 0, room.baseboardHeight / 2, -room.depth / 2 + 0.04],
    [frontBackGeometry, 0, room.baseboardHeight / 2, room.depth / 2 - 0.04],
    [sideGeometry, -room.width / 2 + 0.04, room.baseboardHeight / 2, 0],
    [sideGeometry, room.width / 2 - 0.04, room.baseboardHeight / 2, 0]
  ];
  placements.forEach(([geometry, x, y, z]) => {
    const board = new THREE.Mesh(geometry, material);
    board.position.set(x, y, z);
    board.castShadow = true;
    board.receiveShadow = true;
    scene.add(board);
  });
}

function addTrackLights() {
  addCeilingTracks();
}

function addCeilingTracks() {
  const railMaterial = getMaterial('museum-ceiling-rails', () =>
    new THREE.MeshStandardMaterial({ color: 0xbdb7ad, roughness: 0.46, metalness: 0.18 })
  );
  [-0.34, 0.34].forEach((x) => {
    const rail = new THREE.Mesh(getBoxGeometry(0.035, 0.035, room.depth - 4.4), railMaterial);
    rail.position.set(x, room.height - 0.34, 0);
    rail.castShadow = false;
    rail.receiveShadow = true;
    scene.add(rail);
  });

  const headMaterial = getMaterial('museum-track-heads', () =>
    new THREE.MeshStandardMaterial({ color: 0xf6f1e7, roughness: 0.34, metalness: 0.12, emissive: 0xffe4b6, emissiveIntensity: 0.12 })
  );
  for (let z = -room.depth / 2 + 5; z <= room.depth / 2 - 5; z += 4.2) {
    [-0.34, 0.34].forEach((x) => {
      const head = new THREE.Mesh(getRoundedBoxGeometry(0.13, 0.1, 0.22, 4, 0.025), headMaterial);
      head.position.set(x, room.height - 0.42, z);
      head.castShadow = false;
      scene.add(head);
    });
  }
}

function addArtworkSpotlight(artwork, placement) {
  const distanceFromWall = 1.4;
  const heightAboveCenter = 1.5;
  const spot = new THREE.SpotLight(0xfff1d2, 14, 6.5, Math.PI * 0.32, 0.75, 1.4);
  spot.position.copy(placement.position).add(placement.normal.clone().multiplyScalar(distanceFromWall));
  spot.position.y = placement.position.y + heightAboveCenter;
  spot.target.position.copy(placement.position);
  spot.target.position.y = placement.position.y - 0.05;
  scene.add(spot);
  scene.add(spot.target);
}

function addBenches() {
  const woodMaterial = getMaterial('bench-wood', () =>
    new THREE.MeshStandardMaterial({ color: 0x4a3225, roughness: 0.55, metalness: 0.08 })
  );
  const ironMaterial = getMaterial('bench-iron', () =>
    new THREE.MeshStandardMaterial({ color: 0x16110e, roughness: 0.42, metalness: 0.62 })
  );
  const benchLength = 1.8;
  const benchDepth = 0.42;
  const seatThickness = 0.06;
  const legHeight = 0.42;
  const legThickness = 0.045;

  [9.6, -9.6].forEach((z) => {
    const seat = new THREE.Mesh(
      getRoundedBoxGeometry(benchLength, seatThickness, benchDepth, 4, 0.012),
      woodMaterial
    );
    seat.position.set(0, legHeight + seatThickness / 2, z);
    seat.castShadow = true;
    seat.receiveShadow = true;
    scene.add(seat);

    const cornersX = [-benchLength / 2 + 0.18, benchLength / 2 - 0.18];
    const cornersZ = [-benchDepth / 2 + 0.06, benchDepth / 2 - 0.06];
    cornersX.forEach((cx) => {
      cornersZ.forEach((cz) => {
        const leg = new THREE.Mesh(
          getBoxGeometry(legThickness, legHeight, legThickness),
          ironMaterial
        );
        leg.position.set(cx, legHeight / 2, z + cz);
        leg.castShadow = true;
        scene.add(leg);
      });
    });

    const stretcher = new THREE.Mesh(
      getBoxGeometry(benchLength - 0.4, 0.018, 0.018),
      ironMaterial
    );
    stretcher.position.set(0, 0.08, z);
    scene.add(stretcher);
  });
}

const dustState = {
  mesh: null,
  basePositions: null,
  seeds: null,
  matrix: new THREE.Matrix4(),
  count: 0
};

function addDustParticles() {
  const count = 180;
  const basePositions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    basePositions[i * 3] = (Math.random() - 0.5) * (room.width - 1.2);
    basePositions[i * 3 + 1] = 0.8 + Math.random() * (room.height - 1.6);
    basePositions[i * 3 + 2] = (Math.random() - 0.5) * (room.depth - 1.5);
    seeds[i] = Math.random() * 1000;
  }

  const geometry = new THREE.IcosahedronGeometry(0.022, 0);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd9a3,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  dustState.mesh = mesh;
  dustState.basePositions = basePositions;
  dustState.seeds = seeds;
  dustState.count = count;
}

function updateDust(t) {
  if (!dustState.mesh) return;
  const base = dustState.basePositions;
  const seeds = dustState.seeds;
  const count = dustState.count;
  const matrix = dustState.matrix;
  for (let i = 0; i < count; i += 1) {
    const seed = seeds[i];
    const j = i * 3;
    const x = base[j] + Math.sin(t * 0.55 + seed) * 0.45;
    const y = base[j + 1] + Math.sin(t * 0.32 + seed * 0.7) * 0.18 + Math.sin(t * 0.1 + seed * 0.05) * 0.07;
    const z = base[j + 2] + Math.cos(t * 0.42 + seed * 0.4) * 0.32;
    matrix.makeTranslation(x, y, z);
    dustState.mesh.setMatrixAt(i, matrix);
  }
  dustState.mesh.instanceMatrix.needsUpdate = true;
}

function addCenterPlinths() {
  const material = getMaterial('white-plinth', () => new THREE.MeshStandardMaterial({ color: 0xeae3da, roughness: 0.78, metalness: 0.02 }));
  const sculpture = getMaterial('bronze-sculpture', () => new THREE.MeshStandardMaterial({ color: 0x2a1e16, roughness: 0.42, metalness: 0.62, envMapIntensity: 0.8 }));
  const stanchion = getMaterial('stanchion-post', () => new THREE.MeshStandardMaterial({ color: 0x141112, roughness: 0.42, metalness: 0.55 }));
  const rope = getMaterial('stanchion-rope', () => new THREE.MeshStandardMaterial({ color: 0x231d1a, roughness: 0.85, metalness: 0 }));

  [-5.8, 4.8].forEach((z, index) => {
    const base = new THREE.Mesh(getRoundedBoxGeometry(0.78, 0.86, 0.78, 5, 0.012), material);
    base.position.set(0, 0.43, z);
    base.castShadow = true;
    base.receiveShadow = true;
    scene.add(base);

    const object = new THREE.Mesh(
      index === 0 ? getRoundedBoxGeometry(0.42, 0.84, 0.32, 5, 0.06) : getRoundedBoxGeometry(0.52, 0.5, 0.36, 5, 0.09),
      sculpture
    );
    object.position.set(0, index === 0 ? 1.28 : 1.11, z);
    object.rotation.y = index === 0 ? 0.6 : -0.4;
    object.castShadow = true;
    scene.add(object);

    const corners = [
      [-0.95, z - 0.95],
      [0.95, z - 0.95],
      [-0.95, z + 0.95],
      [0.95, z + 0.95]
    ];
    corners.forEach(([px, pz]) => {
      const post = new THREE.Mesh(getCylinderGeometry(0.022, 0.028, 0.92, 10), stanchion);
      post.position.set(px, 0.46, pz);
      post.castShadow = true;
      scene.add(post);

      const cap = new THREE.Mesh(getCylinderGeometry(0.04, 0.04, 0.04, 12), stanchion);
      cap.position.set(px, 0.94, pz);
      scene.add(cap);
    });

    const ropeSegments = [
      { from: [-0.95, z - 0.95], to: [0.95, z - 0.95] },
      { from: [-0.95, z + 0.95], to: [0.95, z + 0.95] },
      { from: [-0.95, z - 0.95], to: [-0.95, z + 0.95] },
      { from: [0.95, z - 0.95], to: [0.95, z + 0.95] }
    ];
    ropeSegments.forEach(({ from, to }) => {
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const cord = new THREE.Mesh(getCylinderGeometry(0.014, 0.014, length, 8), rope);
      cord.position.set((from[0] + to[0]) / 2, 0.84, (from[1] + to[1]) / 2);
      const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
      cord.rotation.z = Math.PI / 2;
      cord.rotation.y = -angle;
      scene.add(cord);
    });
  });
}

function getCylinderGeometry(radiusTop, radiusBottom, height, segments) {
  return getGeometry(`cyl:${roundSize(radiusTop)}:${roundSize(radiusBottom)}:${roundSize(height)}:${segments}`, () =>
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)
  );
}

function addSideInstallations() {
  const plinthMaterial = getMaterial('side-plinth-stone', () =>
    new THREE.MeshStandardMaterial({ color: 0xe8dfd0, roughness: 0.38, metalness: 0.03 })
  );
  const glassMaterial = getMaterial('display-case-glass', () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xddefff,
      transparent: true,
      opacity: 0.2,
      roughness: 0.02,
      metalness: 0,
      transmission: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      depthWrite: false
    })
  );
  const objectMaterial = getMaterial('bronze-side-object', () =>
    new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.42, metalness: 0.32, envMapIntensity: 0.6 })
  );

  [
    { type: 'case', x: -room.width / 2 + 0.95, z: 7.6, rotation: 0.1 },
    { type: 'sculpture', x: room.width / 2 - 0.82, z: -5.2, rotation: -0.45 },
    { type: 'case', x: -room.width / 2 + 0.9, z: -9.8, rotation: -0.18 }
  ].forEach((item) => {
    const base = new THREE.Mesh(getRoundedBoxGeometry(0.9, 0.52, 0.9, 5, 0.018), plinthMaterial);
    base.position.set(item.x, 0.26, item.z);
    base.rotation.y = item.rotation;
    base.castShadow = true;
    base.receiveShadow = true;
    scene.add(base);

    const artifact = new THREE.Mesh(
      item.type === 'case' ? getRoundedBoxGeometry(0.36, 0.46, 0.28, 5, 0.07) : getRoundedBoxGeometry(0.42, 0.72, 0.34, 5, 0.08),
      objectMaterial
    );
    artifact.position.set(item.x, item.type === 'case' ? 0.78 : 1.05, item.z);
    artifact.rotation.y = item.rotation + 0.7;
    artifact.castShadow = true;
    scene.add(artifact);

    if (item.type !== 'case') {
      return;
    }

    const caseGlass = new THREE.Mesh(getRoundedBoxGeometry(0.82, 1.05, 0.82, 5, 0.02), glassMaterial);
    caseGlass.position.set(item.x, 0.98, item.z);
    caseGlass.rotation.y = item.rotation;
    caseGlass.castShadow = false;
    scene.add(caseGlass);
  });
}

function addSponsorInstallation() {
  const group = new THREE.Group();
  group.position.set(0, 1.45, room.depth / 2 - 0.08);
  group.rotation.y = Math.PI;

  const panel = new THREE.Mesh(
    new RoundedBoxGeometry(3.8, 1.08, 0.08, 5, 0.035),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.54, metalness: 0.01 })
  );
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  const sponsorTexture = makeTextTexture('Galería Miau', 'Demo · código disponible en GitHub', '#2f7368');
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.45, 0.78),
    new THREE.MeshBasicMaterial({ map: sponsorTexture, transparent: true })
  );
  screen.position.z = 0.046;
  group.add(screen);
  scene.add(group);
}

function addArtwork(artwork) {
  const placement = resolveArtworkPlacement(artwork);
  const group = new THREE.Group();
  group.position.copy(placement.position);
  group.rotation.y = placement.rotationY;

  addArtworkSpotlight(artwork, placement);

  const frameDepth = 0.05;
  const frameBorder = 0.2;
  const matBorder = 0.04;
  const frameColor = new THREE.Color(0xc89548).lerp(new THREE.Color(artwork.frame), 0.04);
  const bevelColor = new THREE.Color(0xe9c674).lerp(new THREE.Color(artwork.frame), 0.03);
  const frameMaterial = getMaterial(`frame-${frameColor.getHexString()}`, () =>
    new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.32,
      metalness: 0.88,
      envMapIntensity: 1.55
    })
  );
  const bevelMaterial = getMaterial(`bevel-${bevelColor.getHexString()}`, () =>
    new THREE.MeshStandardMaterial({
      color: bevelColor,
      roughness: 0.26,
      metalness: 0.92,
      envMapIntensity: 1.65
    })
  );
  const accentMaterial = getMaterial(`accent-${artwork.accent}`, () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf3d27e).lerp(new THREE.Color(artwork.accent), 0.06),
      roughness: 0.18,
      metalness: 0.96,
      envMapIntensity: 1.8
    })
  );
  const matMaterial = getMaterial('mat-board', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf5f3eb,
      roughness: 0.78,
      metalness: 0,
      emissive: 0xf5f3eb,
      emissiveIntensity: 0.015
    })
  );
  const backingMaterial = getMaterial('frame-backing', () =>
    new THREE.MeshStandardMaterial({
      color: 0x12100f,
      roughness: 0.66,
      metalness: 0.02
    })
  );
  const frame = new THREE.Group();
  const visibleWidth = artwork.width + matBorder * 2;
  const visibleHeight = artwork.height + matBorder * 2;
  const outerWidth = visibleWidth + frameBorder * 2;
  const outerHeight = visibleHeight + frameBorder * 2;

  const backing = new THREE.Mesh(
    getBoxGeometry(outerWidth - 0.02, outerHeight - 0.02, 0.01),
    backingMaterial
  );
  backing.position.z = -0.005;
  frame.add(backing);

  buildBoxRing(frame, outerWidth, outerHeight, visibleWidth, visibleHeight, frameDepth, frameDepth, frameMaterial);
  buildBoxRing(frame, visibleWidth + 0.04, visibleHeight + 0.04, visibleWidth - 0.005, visibleHeight - 0.005, 0.04, frameDepth + 0.012, bevelMaterial);
  buildBoxRing(frame, artwork.width + 0.05, artwork.height + 0.05, artwork.width + 0.005, artwork.height + 0.005, 0.025, frameDepth + 0.005, accentMaterial);

  const matRing = new THREE.Mesh(
    getRingGeometry(visibleWidth, visibleHeight, artwork.width, artwork.height, 0.01, 0.004),
    matMaterial
  );
  matRing.position.z = 0.018;
  frame.add(matRing);

  group.add(frame);
  frameByArtwork.set(artwork.id, frame);

  const textureAspect = artwork.width / artwork.height;
  const texture = getArtworkTexture(artwork.image, textureAspect);

  const painting = new THREE.Mesh(
    getPlaneGeometry(artwork.width, artwork.height),
    getMaterial(`painting-${artwork.image}-${roundSize(textureAspect)}`, () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.62,
        metalness: 0,
        envMapIntensity: 0.4
      })
    )
  );
  painting.position.z = 0.038;
  painting.userData.artwork = artwork;
  artworkMeshes.push(painting);
  group.add(painting);

  const glass = new THREE.Mesh(
    getPlaneGeometry(visibleWidth - 0.01, visibleHeight - 0.01),
    getMaterial('glass-low-cost', () =>
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.025,
        roughness: 0.015,
        metalness: 0,
        transmission: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.04
      })
    )
  );
  glass.position.z = 0.052;
  group.add(glass);
  addFloorReflection(artwork, texture);

  const catalogIndex = artworks.findIndex((a) => a.id === artwork.id) + 1;
  const plaqueTexture = getPlaqueTexture(artwork.title, `${artwork.artist} · ${artwork.year}`, catalogIndex);
  const plaqueWidth = 0.84;
  const plaqueHeight = plaqueWidth / 4;
  const plaque = new THREE.Mesh(
    getPlaneGeometry(plaqueWidth, plaqueHeight),
    getMaterial(`plaque-${artwork.id}`, () => new THREE.MeshBasicMaterial({ map: plaqueTexture, transparent: true }))
  );
  plaque.position.set(0, -outerHeight / 2 - 0.16, 0.075);
  group.add(plaque);

  scene.add(group);
}

function addFloorReflection(artwork, texture) {
  if (artwork.wall !== 'left' && artwork.wall !== 'right') {
    return;
  }

  const isRightWall = artwork.wall === 'right';
  const material = getMaterial(`floor-reflection-${artwork.image}-${isRightWall ? 'right' : 'left'}`, () =>
    new THREE.MeshBasicMaterial({
      map: texture,
      alphaMap: getReflectionAlphaTexture(isRightWall),
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide
    })
  );
  const inward = isRightWall ? -1 : 1;
  const reflectionDepth = Math.min(1.9, artwork.height * 0.78);
  const reflectionWidth = artwork.width * 1.05;
  const reflection = new THREE.Mesh(getPlaneGeometry(reflectionDepth, reflectionWidth), material);
  reflection.rotation.x = -Math.PI / 2;
  reflection.position.set(
    (isRightWall ? room.width / 2 : -room.width / 2) + inward * (reflectionDepth / 2 + 0.14),
    0.018,
    artwork.offset
  );
  reflection.renderOrder = 1;
  scene.add(reflection);
}

function buildBoxRing(parent, outerWidth, outerHeight, innerWidth, innerHeight, depth, frontZ, material) {
  const sideThicknessX = (outerWidth - innerWidth) / 2;
  const sideThicknessY = (outerHeight - innerHeight) / 2;
  const z = frontZ - depth / 2;

  const top = new THREE.Mesh(getBoxGeometry(outerWidth, sideThicknessY, depth), material);
  top.position.set(0, (outerHeight - sideThicknessY) / 2, z);
  parent.add(top);

  const bottom = new THREE.Mesh(getBoxGeometry(outerWidth, sideThicknessY, depth), material);
  bottom.position.set(0, -(outerHeight - sideThicknessY) / 2, z);
  parent.add(bottom);

  const left = new THREE.Mesh(getBoxGeometry(sideThicknessX, innerHeight, depth), material);
  left.position.set(-(outerWidth - sideThicknessX) / 2, 0, z);
  parent.add(left);

  const right = new THREE.Mesh(getBoxGeometry(sideThicknessX, innerHeight, depth), material);
  right.position.set((outerWidth - sideThicknessX) / 2, 0, z);
  parent.add(right);
}

function addRectRails(parent, outerWidth, outerHeight, railWidth, depth, material, z = 0) {
  const radius = Math.min(railWidth * 0.35, 0.035);
  const top = new THREE.Mesh(getRoundedBoxGeometry(outerWidth, railWidth, depth, 5, radius), material);
  top.position.set(0, (outerHeight - railWidth) / 2, z);
  const bottom = top.clone();
  bottom.position.y = -(outerHeight - railWidth) / 2;

  const sideHeight = Math.max(railWidth, outerHeight - railWidth * 2);
  const left = new THREE.Mesh(getRoundedBoxGeometry(railWidth, sideHeight, depth, 5, radius), material);
  left.position.set(-(outerWidth - railWidth) / 2, 0, z);
  const right = left.clone();
  right.position.x = (outerWidth - railWidth) / 2;

  [top, bottom, left, right].forEach((part) => {
    part.castShadow = true;
    part.receiveShadow = true;
    parent.add(part);
  });
}

function addFlatShadowRails(parent, outerWidth, outerHeight, railWidth, material, z = 0) {
  const top = new THREE.Mesh(getPlaneGeometry(outerWidth, railWidth), material);
  top.position.set(0, (outerHeight - railWidth) / 2, z);
  const bottom = top.clone();
  bottom.position.y = -(outerHeight - railWidth) / 2;

  const sideHeight = Math.max(railWidth, outerHeight - railWidth * 2);
  const left = new THREE.Mesh(getPlaneGeometry(railWidth, sideHeight), material);
  left.position.set(-(outerWidth - railWidth) / 2, 0, z);
  const right = left.clone();
  right.position.x = (outerWidth - railWidth) / 2;

  [top, bottom, left, right].forEach((part) => parent.add(part));
}

function getMaterial(key, factory) {
  if (!materialCache.has(key)) {
    materialCache.set(key, factory());
  }
  return materialCache.get(key);
}

function getGeometry(key, factory) {
  if (!geometryCache.has(key)) {
    geometryCache.set(key, factory());
  }
  return geometryCache.get(key);
}

function getBoxGeometry(width, height, depth) {
  return getGeometry(`box:${roundSize(width)}:${roundSize(height)}:${roundSize(depth)}`, () => new THREE.BoxGeometry(width, height, depth));
}

function getPlaneGeometry(width, height) {
  return getGeometry(`plane:${roundSize(width)}:${roundSize(height)}`, () => new THREE.PlaneGeometry(width, height));
}

function getRoundedBoxGeometry(width, height, depth, segments, radius) {
  return getGeometry(
    `rounded:${roundSize(width)}:${roundSize(height)}:${roundSize(depth)}:${segments}:${roundSize(radius)}`,
    () => new RoundedBoxGeometry(width, height, depth, segments, radius)
  );
}

function getRingGeometry(outerWidth, outerHeight, innerWidth, innerHeight, depth, bevelSize) {
  return getGeometry(
    `ring:${roundSize(outerWidth)}:${roundSize(outerHeight)}:${roundSize(innerWidth)}:${roundSize(innerHeight)}:${roundSize(depth)}:${roundSize(bevelSize)}`,
    () => {
      const outer = new THREE.Shape();
      outer.moveTo(-outerWidth / 2, -outerHeight / 2);
      outer.lineTo(outerWidth / 2, -outerHeight / 2);
      outer.lineTo(outerWidth / 2, outerHeight / 2);
      outer.lineTo(-outerWidth / 2, outerHeight / 2);
      outer.lineTo(-outerWidth / 2, -outerHeight / 2);

      const hole = new THREE.Path();
      hole.moveTo(-innerWidth / 2, -innerHeight / 2);
      hole.lineTo(-innerWidth / 2, innerHeight / 2);
      hole.lineTo(innerWidth / 2, innerHeight / 2);
      hole.lineTo(innerWidth / 2, -innerHeight / 2);
      hole.lineTo(-innerWidth / 2, -innerHeight / 2);
      outer.holes.push(hole);

      const geometry = new THREE.ShapeGeometry(outer);
      return geometry;
    }
  );
}

function getVaultGeometry(width, depth, springY, topY, segments) {
  return getGeometry(`vault:${roundSize(width)}:${roundSize(depth)}:${roundSize(springY)}:${roundSize(topY)}:${segments}`, () => {
    const positions = [];
    const uvs = [];
    const indices = [];
    const radius = width / 2;
    const archHeight = topY - springY;

    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const angle = Math.PI - t * Math.PI;
      const x = Math.cos(angle) * radius;
      const y = springY + Math.sin(angle) * archHeight;
      positions.push(x, y, -depth / 2, x, y, depth / 2);
      uvs.push(t, 0, t, 1);
    }

    for (let i = 0; i < segments; i += 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  });
}

function getArchRibGeometry(radius, width, depth, segments) {
  return getGeometry(`arch-rib:${roundSize(radius)}:${roundSize(width)}:${roundSize(depth)}:${segments}`, () => {
    const outerWidth = radius * 2 + width;
    const outerHeight = radius + width;
    const innerWidth = radius * 2 - width;
    const innerHeight = Math.max(0.1, radius - width);
    const outer = new THREE.Shape();
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const angle = Math.PI - t * Math.PI;
      const x = Math.cos(angle) * outerWidth / 2;
      const y = Math.sin(angle) * outerHeight;
      if (i === 0) outer.moveTo(x, y);
      else outer.lineTo(x, y);
    }
    outer.lineTo(outerWidth / 2, 0);
    outer.lineTo(-outerWidth / 2, 0);
    outer.lineTo(-outerWidth / 2, 0);

    const hole = new THREE.Path();
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const angle = Math.PI - t * Math.PI;
      const x = Math.cos(angle) * innerWidth / 2;
      const y = Math.sin(angle) * innerHeight;
      if (i === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    hole.lineTo(innerWidth / 2, 0);
    hole.lineTo(-innerWidth / 2, 0);
    outer.holes.push(hole);

    const geometry = new THREE.ExtrudeGeometry(outer, {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  });
}

function getOvalGeometry(radiusX, radiusZ, segments) {
  return getGeometry(`oval:${roundSize(radiusX)}:${roundSize(radiusZ)}:${segments}`, () => {
    const shape = new THREE.Shape();
    for (let i = 0; i <= segments; i += 1) {
      const t = (i / segments) * Math.PI * 2;
      const x = Math.cos(t) * radiusX;
      const z = Math.sin(t) * radiusZ;
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    }
    return new THREE.ShapeGeometry(shape);
  });
}

function getOvalRingGeometry(outerRX, outerRZ, innerRX, innerRZ, segments) {
  return getGeometry(
    `oval-ring:${roundSize(outerRX)}:${roundSize(outerRZ)}:${roundSize(innerRX)}:${roundSize(innerRZ)}:${segments}`,
    () => {
      const shape = new THREE.Shape();
      for (let i = 0; i <= segments; i += 1) {
        const t = (i / segments) * Math.PI * 2;
        const x = Math.cos(t) * outerRX;
        const z = Math.sin(t) * outerRZ;
        if (i === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
      }
      const hole = new THREE.Path();
      for (let i = 0; i <= segments; i += 1) {
        const t = (i / segments) * Math.PI * 2;
        const x = Math.cos(t) * innerRX;
        const z = Math.sin(t) * innerRZ;
        if (i === 0) hole.moveTo(x, z);
        else hole.lineTo(x, z);
      }
      shape.holes.push(hole);
      return new THREE.ShapeGeometry(shape);
    }
  );
}

function roundSize(value) {
  return Math.round(value * 1000) / 1000;
}

function getArtworkTexture(image, frameAspect) {
  const key = `${image}:${roundSize(frameAspect)}`;
  if (!textureCache.has(key)) {
    const texture = textureLoader.load(image, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = 8;
      fitTextureCover(loaded, frameAspect);
      loaded.needsUpdate = true;
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(key, texture);
  }
  return textureCache.get(key);
}

function getReflectionAlphaTexture(reverse = false) {
  const key = reverse ? 'right-wall' : 'left-wall';
  if (!reflectionAlphaCache.has(key)) {
    const canvasTexture = document.createElement('canvas');
    canvasTexture.width = 256;
    canvasTexture.height = 128;
    const ctx = canvasTexture.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);
    const gradient = ctx.createLinearGradient(reverse ? canvasTexture.width : 0, 0, reverse ? 0 : canvasTexture.width, 0);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
    gradient.addColorStop(0.34, 'rgba(255, 255, 255, 0.38)');
    gradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.08)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);

    const texture = new THREE.CanvasTexture(canvasTexture);
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    reflectionAlphaCache.set(key, texture);
  }
  return reflectionAlphaCache.get(key);
}

function getPlaqueTexture(title, subtitle, catalogNumber) {
  const key = `plaque:${catalogNumber}:${title}:${subtitle}`;
  if (!plaqueTextureCache.has(key)) {
    plaqueTextureCache.set(key, makePlaqueTexture(title, subtitle, catalogNumber));
  }
  return plaqueTextureCache.get(key);
}

function makePlaqueTexture(title, subtitle, catalogNumber) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#f8efdf');
  bg.addColorStop(1, '#eddfc4');
  ctx.fillStyle = bg;
  roundRect(ctx, 12, 24, w - 24, h - 48, 10);
  ctx.fill();

  ctx.strokeStyle = 'rgba(120, 90, 50, 0.22)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const ruleY = 70;
  const ruleStart = 90;
  const ruleEnd = w - 90;
  const ruleGradient = ctx.createLinearGradient(ruleStart, ruleY, ruleEnd, ruleY);
  ruleGradient.addColorStop(0, 'rgba(157, 110, 48, 0)');
  ruleGradient.addColorStop(0.18, 'rgba(157, 110, 48, 0.7)');
  ruleGradient.addColorStop(0.5, 'rgba(212, 168, 86, 1)');
  ruleGradient.addColorStop(0.82, 'rgba(157, 110, 48, 0.7)');
  ruleGradient.addColorStop(1, 'rgba(157, 110, 48, 0)');
  ctx.fillStyle = ruleGradient;
  ctx.fillRect(ruleStart, ruleY, ruleEnd - ruleStart, 3);

  const catalogText = `M· ${String(catalogNumber).padStart(2, '0')}`;
  ctx.fillStyle = '#7a4a14';
  ctx.font = 'italic 600 52px "Cormorant Garamond", Georgia, serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(catalogText, 110, 130);

  ctx.fillStyle = '#160e06';
  ctx.font = 'italic 600 132px "Cormorant Garamond", Georgia, serif';
  fitTextLine(ctx, title, 110, 268, w - 220, 132, 80);

  ctx.fillStyle = '#3a2810';
  ctx.font = '600 60px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(subtitle.toUpperCase(), 110, 408);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function fitTextLine(ctx, text, x, y, maxWidth, baseSize, minSize) {
  let size = baseSize;
  ctx.font = `italic 600 ${size}px "Cormorant Garamond", Georgia, serif`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = `italic 600 ${size}px "Cormorant Garamond", Georgia, serif`;
  }
  ctx.fillText(text, x, y);
}

function resolveArtworkPlacement(artwork) {
  const y = room.artworkCenterY;
  const inset = 0.005;
  if (artwork.wall === 'front') {
    return {
      position: new THREE.Vector3(artwork.offset, y, -room.depth / 2 + inset),
      rotationY: 0,
      normal: new THREE.Vector3(0, 0, 1)
    };
  }
  if (artwork.wall === 'back') {
    return {
      position: new THREE.Vector3(artwork.offset, y, room.depth / 2 - inset),
      rotationY: Math.PI,
      normal: new THREE.Vector3(0, 0, -1)
    };
  }
  if (artwork.wall === 'left') {
    return {
      position: new THREE.Vector3(-room.width / 2 + inset, y, artwork.offset),
      rotationY: Math.PI / 2,
      normal: new THREE.Vector3(1, 0, 0)
    };
  }
  return {
    position: new THREE.Vector3(room.width / 2 - inset, y, artwork.offset),
    rotationY: -Math.PI / 2,
    normal: new THREE.Vector3(-1, 0, 0)
  };
}

function makeMarbleTexture() {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 2048;
  canvasTexture.height = 2048;
  const ctx = canvasTexture.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, canvasTexture.width, canvasTexture.height);
  base.addColorStop(0, '#2a221d');
  base.addColorStop(0.5, '#3a2c25');
  base.addColorStop(1, '#241c18');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);

  for (let i = 0; i < 36; i += 1) {
    const y = Math.random() * canvasTexture.height;
    ctx.strokeStyle = `rgba(214, 196, 168, ${0.06 + Math.random() * 0.08})`;
    ctx.lineWidth = 0.8 + Math.random() * 2.4;
    ctx.beginPath();
    ctx.moveTo(-60, y);
    ctx.bezierCurveTo(
      canvasTexture.width * 0.3,
      y + (Math.random() - 0.5) * 320,
      canvasTexture.width * 0.7,
      y + (Math.random() - 0.5) * 320,
      canvasTexture.width + 60,
      y + (Math.random() - 0.5) * 200
    );
    ctx.stroke();
  }

  for (let i = 0; i < 14; i += 1) {
    ctx.strokeStyle = `rgba(170, 140, 110, ${0.04 + Math.random() * 0.05})`;
    ctx.lineWidth = 4 + Math.random() * 6;
    ctx.beginPath();
    const y = Math.random() * canvasTexture.height;
    ctx.moveTo(-100, y);
    ctx.bezierCurveTo(
      canvasTexture.width * 0.25,
      y + (Math.random() - 0.5) * 420,
      canvasTexture.width * 0.75,
      y + (Math.random() - 0.5) * 420,
      canvasTexture.width + 100,
      y + (Math.random() - 0.5) * 260
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 1800; i += 1) {
    const tone = 38 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgba(${tone}, ${tone - 6}, ${tone - 12}, 0.5)`;
    ctx.fillRect(Math.random() * canvasTexture.width, Math.random() * canvasTexture.height, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(canvasTexture);
}

function makeFrameGrainTexture() {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 512;
  canvasTexture.height = 512;
  const ctx = canvasTexture.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);

  for (let y = 0; y < canvasTexture.height; y += 1) {
    const wave = Math.sin(y * 0.045) * 9 + Math.sin(y * 0.013) * 18;
    const tone = 118 + wave + Math.random() * 18;
    ctx.strokeStyle = `rgb(${tone}, ${tone}, ${tone})`;
    ctx.globalAlpha = 0.34;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= canvasTexture.width; x += 24) {
      ctx.lineTo(x, y + Math.sin((x + y) * 0.024) * 1.6);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 34; i += 1) {
    ctx.globalAlpha = 0.12 + Math.random() * 0.1;
    ctx.strokeStyle = Math.random() > 0.5 ? '#f0f0f0' : '#303030';
    ctx.lineWidth = 0.5 + Math.random() * 1.25;
    const y = Math.random() * canvasTexture.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(140, y - 24 + Math.random() * 48, 360, y - 24 + Math.random() * 48, 512, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.6, 2.6);
  texture.needsUpdate = true;
  return texture;
}

function fitTextureCover(texture, frameAspect) {
  const image = texture.image;
  if (!image?.width || !image?.height) {
    return;
  }

  const imageAspect = image.width / image.height;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.offset.set(0, 0);
  texture.repeat.set(1, 1);

  if (imageAspect > frameAspect) {
    const repeatX = frameAspect / imageAspect;
    texture.repeat.x = repeatX;
    texture.offset.x = (1 - repeatX) / 2;
  } else if (imageAspect < frameAspect) {
    const repeatY = imageAspect / frameAspect;
    texture.repeat.y = repeatY;
    texture.offset.y = (1 - repeatY) / 2;
  }
}

function makePlasterTexture() {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 2048;
  canvasTexture.height = 2048;
  const ctx = canvasTexture.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);
  for (let i = 0; i < 5200; i += 1) {
    const tone = 232 + Math.floor(Math.random() * 21);
    ctx.fillStyle = `rgba(${tone}, ${tone}, ${tone}, 0.045)`;
    ctx.fillRect(Math.random() * 2048, Math.random() * 2048, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }
  return new THREE.CanvasTexture(canvasTexture);
}

function makeTextTexture(title, subtitle, accent) {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 1024;
  canvasTexture.height = 256;
  const ctx = canvasTexture.getContext('2d');
  ctx.clearRect(0, 0, canvasTexture.width, canvasTexture.height);
  ctx.fillStyle = 'rgba(255, 250, 240, 0.96)';
  roundRect(ctx, 12, 18, 1000, 220, 32);
  ctx.fill();
  ctx.strokeStyle = 'rgba(23, 23, 23, 0.16)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = accent;
  roundRect(ctx, 44, 72, 12, 112, 8);
  ctx.fill();
  ctx.fillStyle = '#171717';
  fitText(ctx, title, 82, 104, 850, 50, 26, 52, '800');
  ctx.fillStyle = 'rgba(23, 23, 23, 0.62)';
  fitText(ctx, subtitle, 82, 158, 850, 32, 18, 31, '600');
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function fitText(ctx, text, x, y, maxWidth, targetHeight, minSize, maxSize, weight) {
  let size = maxSize;
  ctx.textBaseline = 'middle';
  do {
    ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`;
    size -= 1;
  } while (ctx.measureText(text).width > maxWidth && size > minSize);
  ctx.fillText(text, x, y + targetHeight / 2 - 4);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function setupDonationPanel() {
  donationTitle.textContent = galleryConfig.donation.title;
  donationCopy.textContent = galleryConfig.donation.copy;
  donationCheckout.href = galleryConfig.donation.checkoutUrl;
  donationTiers.innerHTML = '';
  galleryConfig.donation.tiers.forEach((tier, index) => {
    const button = document.createElement('button');
    button.className = `tier${index === 1 ? ' is-selected' : ''}`;
    button.type = 'button';
    button.innerHTML = `<strong>${tier.amount}</strong><span>${tier.label}</span>`;
    button.addEventListener('click', () => {
      donationTiers.querySelectorAll('.tier').forEach((node) => node.classList.remove('is-selected'));
      button.classList.add('is-selected');
    });
    donationTiers.append(button);
  });
}

function setupSponsors() {
  let active = 0;
  const updateSponsor = () => {
    const sponsor = sponsors[active % sponsors.length];
    sponsorLabel.textContent = sponsor.label;
    sponsorLink.textContent = sponsor.cta;
    sponsorLink.href = sponsor.url;
    active += 1;
  };
  updateSponsor();
  window.setInterval(updateSponsor, galleryConfig.sponsorRotationSeconds * 1000);
}

function setupEvents() {
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (tourState.active && (event.code === 'KeyW' || event.code === 'KeyA' || event.code === 'KeyS' || event.code === 'KeyD' || event.code.startsWith('Arrow'))) {
      stopTour();
    }
    if (event.code === 'Escape') {
      if (tourState.active) {
        stopTour();
        return;
      }
      if (!artworkModal.hidden) {
        closeArtworkModal();
        return;
      }
      closeDonationPanel();
    }
    if ((event.code === 'KeyE' || event.code === 'Enter') && cameraState.focusedArtwork && artworkModal.hidden && !focusAnimation.active) {
      startArtworkFocus(cameraState.focusedArtwork);
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));

  enterButton.addEventListener('click', () => {
    canvas.requestPointerLock?.();
    enterButton.classList.add('is-hidden');
  });

  canvas.addEventListener('click', () => {
    if (cameraState.pointerDragged) {
      cameraState.pointerDragged = false;
      return;
    }
    if (tourState.active) {
      stopTour();
      return;
    }
    if (cameraState.focusedArtwork && artworkModal.hidden && !focusAnimation.active) {
      startArtworkFocus(cameraState.focusedArtwork);
      return;
    }
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    enterButton.classList.toggle('is-hidden', document.pointerLockElement === canvas);
  });

  window.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== canvas) {
      return;
    }
    rotateCamera(event.movementX, event.movementY, 0.0018);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && document.pointerLockElement === canvas) {
      return;
    }
    cameraState.pointerDown = true;
    cameraState.pointerId = event.pointerId;
    cameraState.pointerStartX = event.clientX;
    cameraState.pointerStartY = event.clientY;
    cameraState.pointerDragged = false;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!cameraState.pointerDown || cameraState.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - cameraState.pointerStartX;
    const dy = event.clientY - cameraState.pointerStartY;
    if (dx * dx + dy * dy > 36) cameraState.pointerDragged = true;
    rotateCamera(event.movementX, event.movementY, event.pointerType === 'touch' ? 0.0035 : 0.0022);
  });

  window.addEventListener('pointerup', (event) => {
    if (cameraState.pointerId === event.pointerId) {
      cameraState.pointerDown = false;
      cameraState.pointerId = null;
    }
  });

  document.querySelectorAll('[data-control]').forEach((button) => {
    const control = button.dataset.control;
    const activate = (event) => {
      event.preventDefault();
      virtualControls.add(control);
      button.classList.add('is-active');
    };
    const deactivate = () => {
      virtualControls.delete(control);
      button.classList.remove('is-active');
    };
    button.addEventListener('pointerdown', activate);
    button.addEventListener('pointerup', deactivate);
    button.addEventListener('pointercancel', deactivate);
    button.addEventListener('pointerleave', deactivate);
  });

  donateOpen.addEventListener('click', openDonationPanel);
  artDonate.addEventListener('click', openDonationPanel);
  donateClose.addEventListener('click', closeDonationPanel);
  soundToggle.addEventListener('click', toggleSound);

  artworkModalClose.addEventListener('click', closeArtworkModal);
  artworkModalSupport.addEventListener('click', () => {
    closeArtworkModal();
    openDonationPanel();
  });
  artworkModalShare.addEventListener('click', shareCurrentArtwork);
  artworkModal.addEventListener('click', (event) => {
    if (event.target === artworkModal) closeArtworkModal();
  });

  welcomeStartBtn?.addEventListener('click', dismissWelcome);
  welcomeTourBtn?.addEventListener('click', () => {
    dismissWelcome();
    startTour();
  });
  tourToggleBtn?.addEventListener('click', () => {
    if (tourState.active) stopTour();
    else startTour();
  });

  progressPill?.addEventListener('click', () => {
    if (seenObras.size === baseObraIds.size) showCompletion();
  });
  completionCloseBtn?.addEventListener('click', hideCompletion);
  completionSupportBtn?.addEventListener('click', () => {
    hideCompletion();
    openDonationPanel();
  });
  completionShareBtn?.addEventListener('click', async () => {
    const url = window.location.origin + window.location.pathname;
    const text = 'Recorri la Galeria Miau, una sala de arte solidario en 3D.';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Galeria Miau', text, url });
        return;
      }
    } catch {
      /* fallback */
    }
    try {
      await navigator.clipboard.writeText(url);
      const span = completionShareBtn.querySelector('span');
      const previous = span.textContent;
      span.textContent = '¡Enlace copiado!';
      setTimeout(() => {
        span.textContent = previous;
      }, 1800);
    } catch {
      /* noop */
    }
  });
}

function setupDebugBridge() {
  window.__galleryDebug = {
    artworks: artworks.map(({ id, title, image }) => ({ id, title, image })),
    sources: [...new Set(artworks.map((artwork) => artwork.image))],
    artworkSamples() {
      return artworkMeshes.map((mesh) => {
        const artwork = mesh.userData.artwork;
        const points = [];
        for (let row = 1; row <= 5; row += 1) {
          for (let col = 1; col <= 5; col += 1) {
            const point = mesh.localToWorld(new THREE.Vector3(
              (col / 6 - 0.5) * artwork.width * 0.8,
              (row / 6 - 0.5) * artwork.height * 0.8,
              0
            )).project(camera);
            if (point.z >= -1 && point.z <= 1 && Math.abs(point.x) < 1 && Math.abs(point.y) < 1) {
              points.push([(point.x + 1) / 2, (1 - point.y) / 2]);
            }
          }
        }
        return { id: artwork.id, points };
      }).filter(({ points }) => points.length === 25);
    },
    getState: () => ({
      camera: camera.position.toArray(),
      yaw: cameraState.yaw,
      focusedArtwork: cameraState.focusedArtwork?.id ?? null
    }),
    rendererInfo() {
      return {
        renderKeys: Object.keys(renderer.info?.render || {}),
        memoryKeys: Object.keys(renderer.info?.memory || {}),
        info: JSON.parse(JSON.stringify(renderer.info))
      };
    },
    forceFocusFirst() {
      const m = artworkMeshes[0];
      cameraState.focusedArtwork = m?.userData?.artwork ?? null;
      updateArtPanel(cameraState.focusedArtwork);
      updateOutlineSelection(cameraState.focusedArtwork);
      return cameraState.focusedArtwork?.id ?? null;
    },
    openArtworkById(id) {
      const a = artworks.find((x) => x.id === id) ?? artworkMeshes[0]?.userData?.artwork;
      if (a) openArtworkModal(a);
      return a?.id ?? null;
    },
    focusArtworkById(id) {
      const a = artworks.find((x) => x.id === id) ?? artworkMeshes[0]?.userData?.artwork;
      if (a) startArtworkFocus(a);
      return a?.id ?? null;
    },
    getFocusAnimation() {
      return {
        active: focusAnimation.active,
        mode: focusAnimation.mode,
        hasReturn: focusAnimation.hasReturn,
        from: [focusAnimation.fromX, focusAnimation.fromZ, focusAnimation.fromYaw],
        to: [focusAnimation.toX, focusAnimation.toZ, focusAnimation.toYaw]
      };
    },
    setCamera({ x, y, z, yaw, pitch }) {
      if (typeof x === 'number') camera.position.x = x;
      if (typeof y === 'number') camera.position.y = y;
      if (typeof z === 'number') camera.position.z = z;
      if (typeof yaw === 'number') cameraState.yaw = yaw;
      if (typeof pitch === 'number') cameraState.pitch = pitch;
    },
    inspectArtwork() {
      const mesh = artworkMeshes[0];
      if (!mesh) return null;
      const m = mesh.material;
      return {
        type: m.type,
        hasMap: !!m.map,
        mapImage: m.map?.image ? `${m.map.image.width}x${m.map.image.height}` : null,
        colorSpace: m.map?.colorSpace,
        repeat: m.map?.repeat?.toArray?.(),
        offset: m.map?.offset?.toArray?.()
      };
    }
  };
}

function rotateCamera(deltaX, deltaY, sensitivity) {
  cameraState.yaw -= deltaX * sensitivity;
  cameraState.pitch -= deltaY * sensitivity;
  cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch, -0.92, 0.92);
}

function toggleSound() {
  cameraState.soundOn = !cameraState.soundOn;
  galleryAudio.setMuted(!cameraState.soundOn);
  soundToggle.setAttribute('aria-label', cameraState.soundOn ? 'Ambiente sonoro' : 'Ambiente silenciado');
  soundToggle.innerHTML = `<i data-lucide="${cameraState.soundOn ? 'volume-2' : 'volume-x'}"></i>`;
  createIcons({
    icons: { Volume2, VolumeX }
  });
}

function openDonationPanel() {
  donationPanel.hidden = false;
  syncOverlayClass();
}

function closeDonationPanel() {
  donationPanel.hidden = true;
  syncOverlayClass();
}

function openArtworkModal(artwork) {
  if (!artwork) return;
  artworkModalImage.src = artwork.image;
  artworkModalImage.alt = artwork.title;
  artworkModalTitle.textContent = artwork.title;
  artworkModalMeta.textContent = `${artwork.artist} · ${artwork.year}`;
  artworkModalStory.textContent = artwork.story;
  artworkModal.dataset.artworkId = artwork.id;
  artworkModal.hidden = false;
  document.exitPointerLock?.();
  setUrlForArtwork(artwork.id);
  markObraSeen(artwork);
  syncOverlayClass();
}

function markObraSeen(artwork) {
  const baseId = artwork.id.replace(/-\d+$/, '');
  if (!baseObraIds.has(baseId)) return;
  const wasComplete = seenObras.size === baseObraIds.size;
  if (seenObras.has(baseId)) return;
  seenObras.add(baseId);
  persistSeen();
  updateProgressUI();
  if (!wasComplete && seenObras.size === baseObraIds.size) {
    setTimeout(() => showCompletion(), 1400);
  }
}

function updateProgressUI() {
  if (!progressCurrent || !progressTotal) return;
  progressCurrent.textContent = seenObras.size.toString();
  progressTotal.textContent = baseObraIds.size.toString();
  progressPill?.classList.toggle('is-complete', seenObras.size === baseObraIds.size);
}

function showCompletion() {
  if (!completionEl) return;
  completionEl.hidden = false;
  document.exitPointerLock?.();
  syncOverlayClass();
}

function hideCompletion() {
  if (!completionEl) return;
  completionEl.hidden = true;
  syncOverlayClass();
}

function closeArtworkModal() {
  artworkModal.hidden = true;
  delete artworkModal.dataset.artworkId;
  setUrlForArtwork(null);
  syncOverlayClass();
  if (!tourState.active) startArtworkExit();
}

function syncOverlayClass() {
  const open =
    !welcomeEl?.hidden ||
    !artworkModal.hidden ||
    !completionEl?.hidden ||
    !donationPanel?.hidden;
  document.body.classList.toggle('has-overlay', open);
}

function setUrlForArtwork(id) {
  const url = new URL(window.location);
  if (id) url.searchParams.set('obra', id);
  else url.searchParams.delete('obra');
  window.history.replaceState({}, '', url);
}

async function shareCurrentArtwork() {
  const id = artworkModal.dataset.artworkId;
  if (!id) return;
  const url = new URL(window.location);
  url.searchParams.set('obra', id);
  const shareData = {
    title: `${artworkModalTitle.textContent} · Galeria Miau`,
    text: artworkModalStory.textContent,
    url: url.toString()
  };
  try {
    if (navigator.share && navigator.canShare?.(shareData) !== false) {
      await navigator.share(shareData);
      return;
    }
  } catch {
    /* fallback to copy */
  }
  try {
    await navigator.clipboard.writeText(url.toString());
    const span = artworkModalShare.querySelector('span');
    const previous = span.textContent;
    span.textContent = '¡Enlace copiado!';
    setTimeout(() => {
      span.textContent = previous;
    }, 1800);
  } catch {
    /* noop */
  }
}

function dismissWelcome() {
  welcomeEl.hidden = true;
  try {
    localStorage.setItem('galeria-miau-welcomed', '1');
  } catch {
    /* ignore */
  }
  syncOverlayClass();
}

function startTour() {
  if (tourState.active) return;
  tourState.active = true;
  tourState.index = 0;
  tourState.pausing = false;
  prepareTourSegment(0);
  updateTourButton();
}

function stopTour() {
  if (!tourState.active) return;
  tourState.active = false;
  tourState.pausing = false;
  closeArtworkModal();
  updateTourButton();
}

function updateTourButton() {
  if (!tourToggleBtn) return;
  tourToggleBtn.setAttribute('aria-label', tourState.active ? 'Detener recorrido' : 'Recorrido guiado');
  tourToggleBtn.innerHTML = `<i data-lucide="${tourState.active ? 'pause' : 'play'}"></i>`;
  createIcons({ icons: { Pause, Play } });
}

function getTourTargets() {
  const seen = new Set();
  const unique = [];
  for (const mesh of artworkMeshes) {
    const baseId = mesh.userData.artwork.id.replace(/-\d+$/, '');
    if (seen.has(baseId)) continue;
    seen.add(baseId);
    unique.push(mesh);
  }
  return unique;
}

function prepareTourSegment(index) {
  const targets = getTourTargets();
  if (!targets.length) {
    stopTour();
    return;
  }
  const mesh = targets[index % targets.length];
  const artwork = mesh.userData.artwork;
  const groupPos = mesh.parent.position;
  const distance = 3.4;
  let toX = groupPos.x;
  let toZ = groupPos.z;
  let toYaw = 0;
  if (artwork.wall === 'left') {
    toX = groupPos.x + distance;
    toZ = groupPos.z;
    toYaw = Math.PI / 2;
  } else if (artwork.wall === 'right') {
    toX = groupPos.x - distance;
    toZ = groupPos.z;
    toYaw = -Math.PI / 2;
  } else if (artwork.wall === 'front') {
    toX = groupPos.x;
    toZ = groupPos.z + distance;
    toYaw = 0;
  } else {
    toX = groupPos.x;
    toZ = groupPos.z - distance;
    toYaw = Math.PI;
  }
  tourState.fromX = camera.position.x;
  tourState.fromZ = camera.position.z;
  tourState.fromYaw = cameraState.yaw;
  tourState.toX = toX;
  tourState.toZ = toZ;
  tourState.toYaw = toYaw;
  tourState.segmentStart = clock.elapsedTime;
  tourState.targetArtwork = artwork;
}

function computeArtworkFocusTarget(artwork, distance = 2.6) {
  const mesh = artworkMeshes.find((m) => m.userData.artwork.id === artwork.id);
  if (!mesh) return null;
  const groupPos = mesh.parent.position;
  let toX = groupPos.x;
  let toZ = groupPos.z;
  let toYaw = 0;
  if (artwork.wall === 'left') {
    toX = groupPos.x + distance;
    toZ = groupPos.z;
    toYaw = Math.PI / 2;
  } else if (artwork.wall === 'right') {
    toX = groupPos.x - distance;
    toZ = groupPos.z;
    toYaw = -Math.PI / 2;
  } else if (artwork.wall === 'front') {
    toX = groupPos.x;
    toZ = groupPos.z + distance;
    toYaw = 0;
  } else {
    toX = groupPos.x;
    toZ = groupPos.z - distance;
    toYaw = Math.PI;
  }
  return { x: toX, z: toZ, yaw: toYaw };
}

function startArtworkFocus(artwork) {
  if (!artwork) return;
  const target = computeArtworkFocusTarget(artwork);
  if (!target) {
    openArtworkModal(artwork);
    return;
  }
  focusAnimation.active = true;
  focusAnimation.mode = 'enter';
  focusAnimation.duration = 0.9;
  focusAnimation.fromX = camera.position.x;
  focusAnimation.fromZ = camera.position.z;
  focusAnimation.fromYaw = cameraState.yaw;
  focusAnimation.toX = target.x;
  focusAnimation.toZ = target.z;
  focusAnimation.toYaw = target.yaw;
  focusAnimation.returnX = camera.position.x;
  focusAnimation.returnZ = camera.position.z;
  focusAnimation.returnYaw = cameraState.yaw;
  focusAnimation.pendingArtwork = artwork;
  focusAnimation.hasReturn = true;
  runFocusTween(target, 'enter', artwork);
}

let focusInterval = null;
function runFocusTween(target, mode, pendingArtwork) {
  if (focusInterval) {
    clearInterval(focusInterval);
    focusInterval = null;
  }
  const startTime = performance.now();
  const fromX = camera.position.x;
  const fromZ = camera.position.z;
  const fromYaw = cameraState.yaw;
  const toX = target.x;
  const toZ = target.z;
  const toYaw = target.yaw;
  const duration = mode === 'enter' ? 900 : 700;
  focusInterval = setInterval(() => {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeInOut(t);
    camera.position.x = fromX + (toX - fromX) * eased;
    camera.position.z = fromZ + (toZ - fromZ) * eased;
    cameraState.yaw = shortAngleLerp(fromYaw, toYaw, eased);
    camera.rotation.y = cameraState.yaw;
    if (t >= 1) {
      clearInterval(focusInterval);
      focusInterval = null;
      focusAnimation.active = false;
      focusAnimation.mode = 'idle';
      if (pendingArtwork) openArtworkModal(pendingArtwork);
    }
  }, 16);
}

function startArtworkExit() {
  if (!focusAnimation.hasReturn) return;
  focusAnimation.active = true;
  focusAnimation.mode = 'exit';
  const target = { x: focusAnimation.returnX, z: focusAnimation.returnZ, yaw: focusAnimation.returnYaw };
  focusAnimation.hasReturn = false;
  runFocusTween(target, 'exit', null);
}

function maybeTriggerMeow(time) {
  if (cameraState.soundOn === false) return;
  if (time - lastMeowAt < 6) return;
  let nearest = null;
  let nearestDist = Infinity;
  for (const mesh of artworkMeshes) {
    const groupPos = mesh.parent.position;
    const dx = groupPos.x - camera.position.x;
    const dz = groupPos.z - camera.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = mesh.userData.artwork;
    }
  }
  if (!nearest || nearestDist > 2.4) return;
  const baseId = nearest.id.replace(/-\d+$/, '');
  if (meowedArtworks.has(baseId) && Math.random() > 0.18) return;
  meowedArtworks.add(baseId);
  if (meowedArtworks.size > 6) {
    const first = meowedArtworks.values().next().value;
    meowedArtworks.delete(first);
  }
  lastMeowAt = time;
  const volume = 0.12 + (1 - nearestDist / 2.4) * 0.16;
  galleryAudio.playMeow(volume);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function shortAngleLerp(from, to, t) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

function updateTour() {
  if (!tourState.active) return;
  const now = clock.elapsedTime;
  if (tourState.pausing) {
    if (now - tourState.pauseStart >= tourState.pauseDuration) {
      tourState.pausing = false;
      closeArtworkModal();
      tourState.index += 1;
      if (tourState.index >= getTourTargets().length) {
        stopTour();
        return;
      }
      prepareTourSegment(tourState.index);
    }
    return;
  }
  const elapsed = now - tourState.segmentStart;
  const t = Math.min(elapsed / tourState.duration, 1);
  const eased = easeInOut(t);
  camera.position.x = tourState.fromX + (tourState.toX - tourState.fromX) * eased;
  camera.position.z = tourState.fromZ + (tourState.toZ - tourState.fromZ) * eased;
  cameraState.yaw = shortAngleLerp(tourState.fromYaw, tourState.toYaw, eased);
  if (t >= 1) {
    tourState.pausing = true;
    tourState.pauseStart = now;
    if (tourState.targetArtwork) openArtworkModal(tourState.targetArtwork);
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isPortrait = height > width;
  camera.aspect = width / height;
  camera.fov = isPortrait ? 78 : 62;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  perfState.frames += 1;
  perfState.elapsed += delta;
  perfState.lastMs = delta * 1000;
  updateTour();
  updateMovement(delta);
  updateArtworkFocus();
  animateFrames(clock.elapsedTime);
  updateDust(clock.elapsedTime);
  for (let i = 0; i < shaderTimeUniforms.length; i += 1) {
    shaderTimeUniforms[i].value = clock.elapsedTime;
  }
  renderPipeline.render();
  updatePerfPanel(clock.elapsedTime);
}
renderer.setAnimationLoop(animate);

function updateMovement(delta) {
  if (focusAnimation.active) {
    camera.rotation.y = cameraState.yaw;
    camera.rotation.x = cameraState.pitch;
    return;
  }
  const forwardInput =
    Number(keys.has('KeyW') || keys.has('ArrowUp') || virtualControls.has('forward')) -
    Number(keys.has('KeyS') || keys.has('ArrowDown') || virtualControls.has('backward'));
  const sideInput =
    Number(keys.has('KeyD') || keys.has('ArrowRight') || virtualControls.has('right')) -
    Number(keys.has('KeyA') || keys.has('ArrowLeft') || virtualControls.has('left'));
  const turnInput = Number(virtualControls.has('turnLeft')) - Number(virtualControls.has('turnRight'));

  if (turnInput !== 0) {
    cameraState.yaw += turnInput * delta * 1.8;
  }

  moveForward.set(-Math.sin(cameraState.yaw), 0, -Math.cos(cameraState.yaw));
  moveRight.set(Math.cos(cameraState.yaw), 0, -Math.sin(cameraState.yaw));
  moveVector.set(0, 0, 0);
  moveVector.addScaledVector(moveForward, forwardInput);
  moveVector.addScaledVector(moveRight, sideInput);

  if (moveVector.lengthSq() > 0) {
    moveVector.normalize().multiplyScalar(cameraState.speed * delta);
    camera.position.add(moveVector);
    resolveCollision(camera.position);
    stepDistance += moveVector.length();
    if (stepDistance > 0.55) {
      galleryAudio.playStep();
      stepDistance = 0;
    }
  } else {
    stepDistance = Math.max(0, stepDistance - delta * 0.4);
  }

  maybeTriggerMeow(clock.elapsedTime);

  camera.rotation.y = cameraState.yaw;
  camera.rotation.x = cameraState.pitch;
}

function resolveCollision(nextPosition) {
  const margin = 0.42;
  nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, -room.width / 2 + margin, room.width / 2 - margin);
  nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, -room.depth / 2 + margin, room.depth / 2 - margin);

  centerObstacles.forEach(({ min, max }) => {
    const inside =
      nextPosition.x > min.x &&
      nextPosition.x < max.x &&
      nextPosition.z > min.y &&
      nextPosition.z < max.y;
    if (!inside) return;
    const leftDistance = Math.abs(nextPosition.x - min.x);
    const rightDistance = Math.abs(nextPosition.x - max.x);
    const frontDistance = Math.abs(nextPosition.z - min.y);
    const backDistance = Math.abs(nextPosition.z - max.y);
    const minDistance = Math.min(leftDistance, rightDistance, frontDistance, backDistance);
    if (minDistance === leftDistance) nextPosition.x = min.x - 0.02;
    if (minDistance === rightDistance) nextPosition.x = max.x + 0.02;
    if (minDistance === frontDistance) nextPosition.z = min.y - 0.02;
    if (minDistance === backDistance) nextPosition.z = max.y + 0.02;
  });

  nextPosition.y = galleryConfig.room.start.y;
  return nextPosition;
}

function updatePerfPanel(time) {
  const info = renderer.info;
  const totalCalls = info.render.calls ?? 0;
  const delta = totalCalls - perfState.lastCalls;
  if (delta > 0) perfState.drawsPerFrame = delta;
  perfState.lastCalls = totalCalls;

  if (time - perfState.lastUpdate < 0.25) {
    return;
  }

  const fps = perfState.frames / Math.max(perfState.elapsed, 0.001);
  const heap = performance.memory?.usedJSHeapSize
    ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
    : null;

  perfPanel.fps.textContent = Math.round(fps).toString();
  perfPanel.ms.textContent = perfState.lastMs.toFixed(1);
  perfPanel.draws.textContent = perfState.drawsPerFrame.toString();
  perfPanel.tris.textContent = compactNumber(info.render.triangles);
  perfPanel.textures.textContent = info.memory.textures.toString();
  perfPanel.heap.textContent = heap === null ? '--' : heap.toString();

  perfState.frames = 0;
  perfState.elapsed = 0;
  perfState.lastUpdate = time;
}

function compactNumber(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}m`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return value.toString();
}

function updateArtworkFocus() {
  raycaster.setFromCamera(lookTarget, camera);
  const hits = raycaster.intersectObjects(artworkMeshes, false);
  const hit = hits.find((candidate) => candidate.distance < 7.5);
  const artwork = hit?.object.userData.artwork ?? null;
  if (cameraState.focusedArtwork?.id === artwork?.id) {
    return;
  }

  cameraState.focusedArtwork = artwork;
  updateArtPanel(artwork);
  updateOutlineSelection(artwork);
}

function updateOutlineSelection(artwork) {
  outlineSelected.length = 0;
  if (!artwork) return;
  const frame = frameByArtwork.get(artwork.id);
  if (frame) outlineSelected.push(frame);
}

function updateArtPanel(artwork) {
  reticleEl?.classList.toggle('is-focused', Boolean(artwork));

  if (!artwork) {
    artPanel.hidden = true;
    return;
  }

  artTitle.textContent = artwork.title;
  artMeta.textContent = `${artwork.artist} · ${artwork.year}`;
  artStory.textContent = artwork.story;
  if (artNumber) {
    const idx = artworks.findIndex((a) => a.id === artwork.id);
    artNumber.textContent = String(idx + 1).padStart(2, '0');
  }
  artPanel.hidden = false;
}

function animateFrames(time) {
  const focusedId = cameraState.focusedArtwork?.id ?? null;
  if (animateFrames.lastFocusedId && animateFrames.lastFocusedId !== focusedId) {
    const prev = frameByArtwork.get(animateFrames.lastFocusedId);
    if (prev) prev.scale.setScalar(1);
    animateFrames.lastFocusedId = null;
  }
  if (!focusedId) return;
  const frame = frameByArtwork.get(focusedId);
  if (!frame) return;
  const target = 1.04 + Math.sin(time * 2.3) * 0.002;
  frame.scale.setScalar(THREE.MathUtils.lerp(frame.scale.x, target, 0.08));
  animateFrames.lastFocusedId = focusedId;
}
animateFrames.lastFocusedId = null;
