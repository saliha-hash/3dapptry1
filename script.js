import * as THREE from
  'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b10);

const camera = new THREE.PerspectiveCamera(
  45,
  viewer.clientWidth / viewer.clientHeight,
  0.1,
  10000
);

camera.position.set(60, 50, 80);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x526078, 2));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(50, 80, 60);
scene.add(light);

scene.add(new THREE.GridHelper(200, 20, 0x526174, 0x27313e));

let currentObject = null;
let currentShape = 'sphere';
let isCaliper = false;

const loader = new GLTFLoader();

function setStatus(message) {
  status.textContent = message;
}

function removeObject() {
  if (currentObject) {
    scene.remove(currentObject);
    currentObject = null;
  }
}

function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    setStatus('The model contains no visible geometry.');
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);

  controls.target.copy(center);

  camera.position.set(
    center.x + maxSize * 1.5,
    center.y + maxSize,
    center.z + maxSize * 1.8
  );

  camera.near = Math.max(maxSize / 1000, 0.01);
  camera.far = Math.max(maxSize * 100, 1000);
  camera.updateProjectionMatrix();

  controls.minDistance = Math.max(maxSize * 0.05, 0.1);
  controls.maxDistance = Math.max(maxSize * 10, 100);

  controls.update();
}

function getDimensions() {
  const a = Number(inputA.value);
  const b = Number(inputB.value);
  const c = Number(inputC.value);

  if (![a, b, c].every(
    value => Number.isFinite(value) && value > 0 && value <= 500
  )) {
    setStatus('Enter dimensions between 1 and 500 mm.');
    return null;
  }

  return { a, b, c };
}

function createShape(shape) {
  const dimensions = getDimensions();
  if (!dimensions) return;

  const { a, b, c } = dimensions;

  removeObject();

  let geometry;

  switch (shape) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(a, 32, 24);
      break;

    case 'cylinder':
      geometry = new THREE.CylinderGeometry(a, a, b, 32);
      break;

    case 'cube':
      geometry = new THREE.BoxGeometry(a, a, a);
      break;

    case 'cuboid':
      geometry = new THREE.BoxGeometry(a, b, c);
      break;

    case 'cone':
      geometry = new THREE.ConeGeometry(a, b, 32);
      break;

    default:
      return;
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0xb8c6d9,
    metalness: 0.35,
    roughness: 0.35
  });

  currentObject = new THREE.Mesh(geometry, material);

  scene.add(currentObject);

  currentShape = shape;
  isCaliper = false;

  frameObject(currentObject);

  measurement.textContent =
    `Selected: ${shape}. Dimensions are in millimetres.`;

  setStatus(`${shape} created.`);
}

function loadCaliper() {
  removeObject();
  isCaliper = true;

  setStatus('Loading Vernier caliper...');

  loader.load(
    './verniercaliper.glb',
(gltf) => {
  if (!isCaliper) return;

  currentObject = gltf.scene;

  const meshNames = [];

  currentObject.traverse((part) => {
    if (part.isMesh) {
      meshNames.push(part.name || '(unnamed mesh)');
    }
  });
const animationDetails = gltf.animations.map(animation => {
  return animation.name +
    ' | Duration: ' + animation.duration + ' seconds' +
    ' | Tracks: ' + animation.tracks.map(track => track.name).join(', ');
});
  scene.add(currentObject);
  frameObject(currentObject);
measurement.textContent =
  'Meshes (' + meshNames.length + '): ' +
  meshNames.join(', ') +
  ' | Animation details: ' +
  (animationDetails.join(' ; ') || 'None');
  
    'Meshes (' + meshNames.length + '): ' +
    meshNames.join(', ') +
    ' | Animations: ' +
    (animationNames.join(', ') || 'None');

  setStatus('Model inspected. Check the mesh and animation list below.');
},
    undefined,

    (error) => {
      console.error(error);
      setStatus('Caliper failed to load. Check the filename and file URL.');
    }
  );
}

document.querySelectorAll('[data-shape]').forEach(button => {
  button.addEventListener('click', () => {
    createShape(button.dataset.shape);
  });
});

document.getElementById('caliperButton').addEventListener(
  'click',
  loadCaliper
);

document.getElementById('updateButton').addEventListener(
  'click',
  () => {
    if (isCaliper) {
      setStatus('Select a shape before changing its dimensions.');
      return;
    }

    createShape(currentShape);
  }
);

document.getElementById('removeButton').addEventListener(
  'click',
  () => {
    removeObject();
    isCaliper = false;
    measurement.textContent = 'No object selected.';
    setStatus('Object removed.');
  }
);

document.getElementById('resetButton').addEventListener(
  'click',
  () => {
    if (currentObject) {
      frameObject(currentObject);
    } else {
      camera.position.set(60, 50, 80);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }
);

window.addEventListener('resize', () => {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

createShape('sphere');
