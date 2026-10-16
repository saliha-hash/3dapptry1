import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';

const viewer = document.getElementById('viewer');
const status = document.getElementById('status');
const measurement = document.getElementById('measurement');
const inputA = document.getElementById('dimensionA');
const inputB = document.getElementById('dimensionB');
const inputC = document.getElementById('dimensionC');

if (!viewer) {
  throw new Error('The 3D viewer element was not found.');
}

// ---------- SCENE ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  40,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  10000
);

camera.position.set(0, 2.5, 8);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
viewer.appendChild(renderer.domElement);

// ---------- LIGHTING ----------
scene.add(new THREE.AmbientLight(0xffffff, 1.8));

const mainLight = new THREE.DirectionalLight(0xffffff, 3.5);
mainLight.position.set(4, 6, 5);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xb8d5ff, 2);
fillLight.position.set(-5, 2, -4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 2.5);
rimLight.position.set(0, -3, 5);
scene.add(rimLight);

// ---------- CAMERA CONTROLS ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.045;
controls.rotateSpeed = 0.45;
controls.zoomSpeed = 0.55;
controls.panSpeed = 0.4;
controls.minDistance = 1;
controls.maxDistance = 100;
controls.target.set(0, 0, 0);

// ---------- OBJECTS ----------
const loader = new GLTFLoader();

let caliper = null;
let caliperMixer = null;
let selectedObject = null;
let selectedObjectType = 'sphere';
let objectSize = { a: 10, b: 10, c: 10 };

const silverMaterial = new THREE.MeshStandardMaterial({
  color: 0xc9cdd2,
  metalness: 0.88,
  roughness: 0.24
});

const objectGroup = new THREE.Group();
scene.add(objectGroup);

// ---------- LOAD VERNIER CALIPER ----------
loader.load(
  './verniercaliper.glb',
  (gltf) => {
    caliper = gltf.scene;

    // Keep the model's original proportions.
    caliper.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(caliper);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z);

    if (largestDimension > 0) {
      const scale = 5.2 / largestDimension;
      caliper.scale.setScalar(scale);
    }

    // Recenter the model after scaling.
    caliper.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(caliper);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    caliper.position.sub(scaledCenter);
    scene.add(caliper);

    // Automatically play the model's existing animation.
    if (gltf.animations && gltf.animations.length > 0) {
      caliperMixer = new THREE.AnimationMixer(caliper);
      gltf.animations.forEach((clip) => {
        caliperMixer.clipAction(clip).play();
      });
    }

    // Show the caliper prominently in the viewer.
    camera.position.set(0, 1.2, 7.2);
    controls.target.set(0, 0, 0);
    controls.update();

    // Put a small silver sphere in the scene as the starting object.
    createObject('sphere');

    if (status) status.textContent = '';
  },
  undefined,
  (error) => {
    console.error('Could not load Vernier caliper model:', error);
    if (status) {
      status.textContent = 'Could not load the caliper model. Check the model filename.';
    }
  }
);

// ---------- CREATE OBJECTS ----------
function createObject(type) {
  if (selectedObject) {
    objectGroup.remove(selectedObject);
    selectedObject.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
      }
    });
  }

  selectedObjectType = type;

  const a = Math.max(0.1, Number(inputA?.value) || 10);
  const b = Math.max(0.1, Number(inputB?.value) || 10);
  const c = Math.max(0.1, Number(inputC?.value) || 10);

  objectSize = { a, b, c };

  let geometry;

  // These are deliberately small so they look like objects
  // being measured, not giant shapes filling the screen.
  const scale = 0.035;

  switch (type) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(a * scale / 2, 40, 32);
      break;

    case 'cube':
      geometry = new THREE.BoxGeometry(
        a * scale,
        a * scale,
        a * scale
      );
      break;

    case 'cylinder':
      geometry = new THREE.CylinderGeometry(
        a * scale / 2,
        a * scale / 2,
        b * scale,
        40
      );
      break;

    case 'cuboid':
      geometry = new THREE.BoxGeometry(
        a * scale,
        b * scale,
        c * scale
      );
      break;

    case 'cone':
      geometry = new THREE.ConeGeometry(
        a * scale / 2,
        b * scale,
        40
      );
      break;

    default:
      geometry = new THREE.SphereGeometry(0.18, 40, 32);
  }

  selectedObject = new THREE.Mesh(geometry, silverMaterial);
  selectedObject.position.set(0, 0, 0.35);
  selectedObject.castShadow = true;
  selectedObject.receiveShadow = true;

  objectGroup.add(selectedObject);
  updateMeasurement();
}

// ---------- OBJECT MENU BUTTONS ----------
// These IDs must match the buttons in index.html.
const objectButtons = {
  sphere: document.getElementById('sphereButton'),
  cube: document.getElementById('cubeButton'),
  cylinder: document.getElementById('cylinderButton'),
  cuboid: document.getElementById('cuboidButton'),
  cone: document.getElementById('coneButton')
};

Object.entries(objectButtons).forEach(([type, button]) => {
  if (button) {
    button.addEventListener('click', () => createObject(type));
  }
});

// ---------- UPDATE DIMENSIONS ----------
const updateButton = document.getElementById('updateButton');

if (updateButton) {
  updateButton.addEventListener('click', () => {
    createObject(selectedObjectType);
  });
}

// ---------- RESET VIEW ----------
const resetButton = document.getElementById('resetButton');

if (resetButton) {
  resetButton.addEventListener('click', () => {
    camera.position.set(0, 1.2, 7.2);
    controls.target.set(0, 0, 0);
    controls.update();
  });
}

// ---------- REMOVE OBJECT ----------
const removeButton = document.getElementById('removeButton');

if (removeButton) {
  removeButton.addEventListener('click', () => {
    if (selectedObject) {
      objectGroup.remove(selectedObject);
      selectedObject.geometry.dispose();
      selectedObject = null;
    }

    if (measurement) {
      measurement.textContent = 'Select an object to begin.';
    }
  });
}

// ---------- VERNIER CALIPER FORMULA ----------
function updateMeasurement() {
  if (!measurement) return;

  if (!selectedObject) {
    measurement.textContent = 'Select an object to begin.';
    return;
  }

  const a = Math.max(0, Number(inputA?.value) || 0);

  // Simplified teaching example:
  // Reading = Main scale reading + (Vernier coincidence × least count)
  const mainScaleReading = Math.floor(a);
  const vernierCoincidence = 0;
  const leastCount = 0.01;

  const reading =
    mainScaleReading + vernierCoincidence * leastCount;

  measurement.textContent =
    `Object: ${selectedObjectType} | ` +
    `Simulated reading: ${reading.toFixed(2)} cm | ` +
    `Formula: Main scale reading + (Vernier coincidence × least count)`;
}

[inputA, inputB, inputC].forEach((input) => {
  if (input) {
    input.addEventListener('change', updateMeasurement);
  }
});

// ---------- RESIZE ----------
window.addEventListener('resize', () => {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (width === 0 || height === 0) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

// ---------- ANIMATION LOOP ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (caliperMixer) {
    caliperMixer.update(delta);
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
