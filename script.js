import * as THREE from 'three';

import { OrbitControls } from
  'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';

import { GLTFLoader } from
  'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';

const viewer = document.getElementById('viewer');
const status = document.getElementById('status');
const measurement = document.getElementById('measurement');

const inputA = document.getElementById('dimensionA');
const inputB = document.getElementById('dimensionB');
const inputC = document.getElementById('dimensionC');

const labelA = document.getElementById('labelA');
const labelB = document.getElementById('labelB');
const labelC = document.getElementById('labelC');

const menuButton = document.getElementById('otherObjectsButton');
const objectMenu = document.getElementById('objectMenu');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  38,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  1000
);

camera.position.set(0, 1.5, 8);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio || 1, 2)
);

renderer.setSize(
  viewer.clientWidth,
  viewer.clientHeight
);

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;

viewer.appendChild(renderer.domElement);

// Lighting for metallic-looking objects.
scene.add(new THREE.AmbientLight(0xffffff, 2));

const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
keyLight.position.set(4, 6, 7);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xc9dcff, 2);
fillLight.position.set(-5, 1, 3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 2.5);
rimLight.position.set(0, -3, -5);
scene.add(rimLight);

// Gentle touch controls.
const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.4;
controls.zoomSpeed = 0.55;
controls.panSpeed = 0.4;
controls.minDistance = 1;
controls.maxDistance = 35;
controls.target.set(0, 0, 0);

// Model and object state.
const loader = new GLTFLoader();

let caliper = null;
let mixer = null;
let selectedObject = null;
let selectedShape = 'sphere';

// Keep all shapes small relative to the viewer.
const UNIT = 0.018;

const silverMaterial = new THREE.MeshStandardMaterial({
  color: 0xd7dce2,
  metalness: 0.78,
  roughness: 0.26
});

const objectGroup = new THREE.Group();
scene.add(objectGroup);

// Display errors only when something actually fails.
function showStatus(message) {
  status.textContent = message;
  status.classList.add('visible');
}

function clearStatus() {
  status.textContent = '';
  status.classList.remove('visible');
}

// Load the existing model.
loader.load(
  './verniercaliper.glb',

  (gltf) => {
    caliper = gltf.scene;

    // Find the model's original dimensions.
    caliper.updateMatrixWorld(true);

    const originalBox = new THREE.Box3().setFromObject(caliper);
    const originalSize = originalBox.getSize(new THREE.Vector3());

    const largest = Math.max(
      originalSize.x,
      originalSize.y,
      originalSize.z
    );

    if (!Number.isFinite(largest) || largest <= 0) {
      showStatus('The caliper model has invalid dimensions.');
      return;
    }

    // Make the caliper larger in the viewer.
    const desiredSize = 7.0;
    const scale = desiredSize / largest;

    caliper.scale.setScalar(scale);
    caliper.updateMatrixWorld(true);

    // Centre the model.
    const box = new THREE.Box3().setFromObject(caliper);
    const center = box.getCenter(new THREE.Vector3());

    caliper.position.sub(center);
    scene.add(caliper);

    // Play the existing model animation if present.
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(caliper);

      for (const clip of gltf.animations) {
        mixer.clipAction(clip).play();
      }
    }

    // Initial object.
    createObject('sphere');

    // The camera is fixed relative to the overall model.
    camera.position.set(0, 1.1, 8.4);
    controls.target.set(0, 0, 0);
    controls.update();

    clearStatus();
  },

  undefined,

  (error) => {
    console.error('Caliper model loading failed:', error);

    showStatus(
      'The caliper model could not load. Check that the file is named verniercaliper.glb and is in the repository root.'
    );
  }
);

// Update labels for each selected shape.
function updateLabels(type) {
  if (type === 'sphere') {
    labelA.textContent = 'Diameter (mm)';
    labelB.textContent = 'Not used';
    labelC.textContent = 'Not used';
  } else if (type === 'cube') {
    labelA.textContent = 'Side (mm)';
    labelB.textContent = 'Not used';
    labelC.textContent = 'Not used';
  } else if (type === 'cylinder' || type === 'cone') {
    labelA.textContent = 'Diameter (mm)';
    labelB.textContent = 'Height (mm)';
    labelC.textContent = 'Not used';
  } else {
    labelA.textContent = 'Length (mm)';
    labelB.textContent = 'Width (mm)';
    labelC.textContent = 'Height (mm)';
  }
}

// Create or replace the selected object.
function createObject(type) {
  selectedShape = type;

  if (selectedObject) {
    objectGroup.remove(selectedObject);
    selectedObject.geometry.dispose();
    selectedObject = null;
  }

  let a = Math.max(1, Number(inputA.value) || 6);
  let b = Math.max(1, Number(inputB.value) || 6);
  let c = Math.max(1, Number(inputC.value) || 6);

  // Limit initial objects and prevent giant shapes.
  a = Math.min(a, 100);
  b = Math.min(b, 100);
  c = Math.min(c, 100);

  let geometry;

  switch (type) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(
        a * UNIT / 2,
        40,
        32
      );
      break;

    case 'cube':
      geometry = new THREE.BoxGeometry(
        a * UNIT,
        a * UNIT,
        a * UNIT
      );
      break;

    case 'cylinder':
      geometry = new THREE.CylinderGeometry(
        a * UNIT / 2,
        a * UNIT / 2,
        b * UNIT,
        40
      );
      break;

    case 'cuboid':
      geometry = new THREE.BoxGeometry(
        a * UNIT,
        b * UNIT,
        c * UNIT
      );
      break;

    case 'cone':
      geometry = new THREE.ConeGeometry(
        a * UNIT / 2,
        b * UNIT,
        40
      );
      break;

    default:
      return;
  }

  selectedObject = new THREE.Mesh(geometry, silverMaterial);

  // This is a temporary placement position.
  // Actual jaw positioning requires the model's jaw coordinates.
  selectedObject.position.set(0, 0, 0.25);

  objectGroup.add(selectedObject);

  updateLabels(type);
  updateMeasurement();

  document.querySelectorAll('.object-option').forEach((button) => {
    button.classList.toggle(
      'selected',
      button.dataset.shape === type
    );
  });
}

// Open and close the vertical object list.
menuButton.addEventListener('click', () => {
  const isOpen = objectMenu.classList.toggle('open');

  menuButton.setAttribute('aria-expanded', String(isOpen));
  document.getElementById('menuArrow').textContent =
    isOpen ? '⌃' : '⌄';
});

// Object choices.
document.querySelectorAll('.object-option').forEach((button) => {
  button.addEventListener('click', () => {
    createObject(button.dataset.shape);

    objectMenu.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    document.getElementById('menuArrow').textContent = '⌄';
  });
});

// Update the current object's dimensions.
document.getElementById('updateButton').addEventListener('click', () => {
  createObject(selectedShape);
});

// Remove only the selected object.
document.getElementById('removeButton').addEventListener('click', () => {
  if (selectedObject) {
    objectGroup.remove(selectedObject);
    selectedObject.geometry.dispose();
    selectedObject = null;
  }

  measurement.textContent = 'No object selected.';
});

// Reset camera position.
document.getElementById('resetButton').addEventListener('click', () => {
  camera.position.set(0, 1.1, 8.4);
  controls.target.set(0, 0, 0);
  controls.update();
});

// Teaching formula and simulated calculation.
function updateMeasurement() {
  if (!selectedObject) {
    measurement.textContent = 'No object selected.';
    return;
  }

  const a = Math.max(0, Number(inputA.value) || 0);

  measurement.textContent =
    `Selected object: ${selectedShape}\n` +
    `Entered dimension: ${a} mm\n` +
    `Vernier formula: Main scale reading + ` +
    `(Vernier coincidence × Least count)\n\n` +
    `This is the entered dimension, not a reading measured by the model.`;
}

[inputA, inputB, inputC].forEach((input) => {
  input.addEventListener('change', updateMeasurement);
});

// Keep the viewer fitted to the available screen size.
window.addEventListener('resize', () => {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});

// Animation loop.
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer) {
    mixer.update(delta);
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
