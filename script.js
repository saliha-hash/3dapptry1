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
scene.background = new THREE.Color(0x08090c);

const camera = new THREE.PerspectiveCamera(
  38,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  10000
);

camera.position.set(35, 25, 40);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

viewer.appendChild(renderer.domElement);

// Smooth mobile camera controls.
const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.35;
controls.zoomSpeed = 0.45;
controls.panSpeed = 0.35;
controls.enablePan = true;
controls.minDistance = 1;
controls.maxDistance = 500;
controls.target.set(0, 0, 0);

// Professional studio lighting.
scene.add(
  new THREE.HemisphereLight(0xe8efff, 0x252a33, 2.0)
);

const mainLight = new THREE.DirectionalLight(0xffffff, 3.5);
mainLight.position.set(20, 35, 30);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xb5caff, 2);
fillLight.position.set(-25, 10, -20);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 2.5);
rimLight.position.set(0, 20, -30);
scene.add(rimLight);

// State.
let currentObject = null;
let currentShape = 'sphere';
let isCaliper = false;
let mixer = null;
let animationAction = null;
let currentModel = null;

const loader = new GLTFLoader();

function setStatus(message) {
  status.textContent = message;
}

function disposeObject(object) {
  object.traverse(part => {
    if (part.isMesh) {
      part.geometry.dispose();

      if (Array.isArray(part.material)) {
        part.material.forEach(material => material.dispose());
      } else if (part.material) {
        part.material.dispose();
      }
    }
  });
}

function removeObject() {
  if (currentObject) {
    scene.remove(currentObject);
    disposeObject(currentObject);
    currentObject = null;
  }

  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }

  animationAction = null;
  currentModel = null;
}

function frameObject(object) {
  object.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    setStatus('No visible model geometry was found.');
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);

  controls.target.copy(center);

  // Fill the viewer without cutting off the object.
  const distance =
    maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(
      camera.fov / 2
    ))) * 1.35;

  camera.position.set(
    center.x + distance * 0.65,
    center.y + distance * 0.45,
    center.z + distance
  );

  camera.near = Math.max(maxSize / 1000, 0.01);
  camera.far = Math.max(maxSize * 100, 1000);
  camera.updateProjectionMatrix();

  controls.minDistance = Math.max(maxSize * 0.03, 0.1);
  controls.maxDistance = Math.max(maxSize * 8, 50);

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

// Realistic-looking silver material.
function silverMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xc5cbd3,
    metalness: 0.85,
    roughness: 0.23
  });
}

function createShape(shape) {
  const dimensions = getDimensions();
  if (!dimensions) return;

  const { a, b, c } = dimensions;

  removeObject();

  let geometry;

  switch (shape) {
    case 'sphere':
      // A is the diameter in millimetres.
      geometry = new THREE.SphereGeometry(a / 2, 64, 48);
      break;

    case 'cylinder':
      geometry = new THREE.CylinderGeometry(
        a / 2, a / 2, b, 48
      );
      break;

    case 'cube':
      geometry = new THREE.BoxGeometry(a, a, a);
      break;

    case 'cuboid':
      geometry = new THREE.BoxGeometry(a, b, c);
      break;

    case 'cone':
      geometry = new THREE.ConeGeometry(a / 2, b, 48);
      break;

    default:
      return;
  }

  currentObject = new THREE.Mesh(geometry, silverMaterial());
  currentObject.position.set(0, a / 2, 0);

  scene.add(currentObject);

  currentShape = shape;
  isCaliper = false;

  frameObject(currentObject);

  measurement.textContent =
    'Selected: ' + shape +
    '. Dimensions are entered in millimetres.';

  setStatus(shape + ' selected.');
}

// Load the Sketchfab Vernier caliper.
function loadCaliper() {
  removeObject();
  isCaliper = true;

  setStatus('Loading Vernier caliper...');

  loader.load(
    './verniercaliper.glb',

    gltf => {
      if (!isCaliper) {
        disposeObject(gltf.scene);
        return;
      }

      currentObject = gltf.scene;
      currentModel = gltf.scene;

      currentObject.traverse(part => {
        if (part.isMesh) {
          part.castShadow = true;
          part.receiveShadow = true;
        }
      });

      scene.add(currentObject);

      // Report the model structure for future jaw controls.
      const meshNames = [];

      currentObject.traverse(part => {
        if (part.isMesh) {
          meshNames.push(part.name || '(unnamed)');
        }
      });

      frameObject(currentObject);

      // Automatically play the existing animation.
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(currentObject);

        animationAction = mixer.clipAction(gltf.animations[0]);

        animationAction.setLoop(THREE.LoopOnce, 1);
        animationAction.clampWhenFinished = true;
        animationAction.reset();
        animationAction.play();
      }

      measurement.textContent =
        'Vernier caliper | Model parts: ' +
        meshNames.length +
        ' | Existing animation: ' +
        (gltf.animations.length ? 'Playing automatically' : 'None');

      setStatus(
        'Caliper loaded. Drag gently to rotate; pinch to zoom.'
      );
    },

    undefined,

    error => {
      console.error(error);
      isCaliper = false;

      setStatus(
        'Unable to load the caliper. Check the model filename.'
      );
    }
  );
}

// Shape selection.
document.querySelectorAll('[data-shape]').forEach(button => {
  button.addEventListener('click', () => {
    createShape(button.dataset.shape);
  });
});

// Caliper selection.
document.getElementById('caliperButton').addEventListener(
  'click',
  loadCaliper
);

// Update dimensions.
document.getElementById('updateButton').addEventListener(
  'click',
  () => {
    if (isCaliper) {
      setStatus('Select a shape to change its dimensions.');
      return;
    }

    createShape(currentShape);
  }
);

// Remove the selected object.
document.getElementById('removeButton').addEventListener(
  'click',
  () => {
    removeObject();
    isCaliper = false;

    measurement.textContent = 'No object selected.';
    setStatus('Object removed.');
  }
);

// Reset the view.
document.getElementById('resetButton').addEventListener(
  'click',
  () => {
    if (currentObject) {
      frameObject(currentObject);
    } else {
      camera.position.set(35, 25, 40);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }
);

// Responsive viewer.
window.addEventListener('resize', () => {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

// Render loop.
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  if (mixer) {
    mixer.update(delta);
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Start with a small silver sphere.
inputA.value = 10;
inputB.value = 10;
inputC.value = 10;

createShape('sphere');
