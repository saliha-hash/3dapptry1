
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
scene.background = new THREE.Color(0x080a0e);

const camera = new THREE.PerspectiveCamera(
  45,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  10000
);

camera.position.set(35, 25, 45);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

viewer.appendChild(renderer.domElement);

// Camera controls tuned for a phone.
const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.rotateSpeed = 0.45;
controls.zoomSpeed = 0.55;
controls.panSpeed = 0.4;
controls.enablePan = true;
controls.minDistance = 3;
controls.maxDistance = 300;

// Lighting.
scene.add(
  new THREE.HemisphereLight(0xe8f1ff, 0x303541, 2.2)
);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
keyLight.position.set(30, 50, 40);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9ebdff, 1.5);
fillLight.position.set(-30, 15, -25);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 2);
rimLight.position.set(0, 25, -35);
scene.add(rimLight);

// Subtle laboratory grid.
const grid = new THREE.GridHelper(
  100,
  50,
  0x394453,
  0x1c2530
);

grid.position.y = -0.01;
scene.add(grid);

// Objects and model state.
let currentObject = null;
let currentShape = 'cube';
let isCaliper = false;

let mixer = null;
let caliperAnimations = [];
let animationAction = null;
let animationDuration = 0;

const loader = new GLTFLoader();

function setStatus(message) {
  status.textContent = message;
}

function removeObject() {
  if (currentObject) {
    scene.remove(currentObject);

    currentObject.traverse(part => {
      if (part.isMesh) {
        part.geometry.dispose();

        if (Array.isArray(part.material)) {
          part.material.forEach(material => material.dispose());
        } else if (part.material) {
          part.material.dispose();
        }
      }
    });

    currentObject = null;
  }

  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }

  animationAction = null;
  caliperAnimations = [];
  animationDuration = 0;
}

function frameObject(object, padding = 1.8) {
  const box = new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    setStatus('No visible 3D geometry found.');
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);

  controls.target.copy(center);

  const distance = Math.max(maxSize * padding, 5);

  camera.position.set(
    center.x + distance * 0.8,
    center.y + distance * 0.55,
    center.z + distance
  );

  camera.near = Math.max(maxSize / 1000, 0.01);
  camera.far = Math.max(maxSize * 100, 1000);
  camera.updateProjectionMatrix();

  controls.minDistance = Math.max(maxSize * 0.08, 0.5);
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

// Metallic material for laboratory objects.
function createMetalMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xc7cdd5,
    metalness: 0.82,
    roughness: 0.24
  });
}

function createShape(shape, keepView = false) {
  const dimensions = getDimensions();

  if (!dimensions) return;

  const { a, b, c } = dimensions;

  removeObject();

  let geometry;

  switch (shape) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(a / 2, 48, 32);
      break;

    case 'cylinder':
      geometry = new THREE.CylinderGeometry(
        a / 2,
        a / 2,
        b,
        48
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

  currentObject = new THREE.Mesh(
    geometry,
    createMetalMaterial()
  );

  currentObject.position.set(0, a / 2, 0);
  currentObject.castShadow = true;
  currentObject.receiveShadow = true;

  scene.add(currentObject);

  currentShape = shape;
  isCaliper = false;

  if (!keepView) {
    frameObject(currentObject);
  }

  measurement.textContent =
    'Selected: ' + shape +
    '. Dimensions entered in millimetres.';

  setStatus(shape + ' created.');
}

// Load and inspect the downloaded Sketchfab caliper.
function loadCaliper() {
  removeObject();

  isCaliper = true;

  setStatus('Loading Vernier caliper...');

  loader.load(
    './verniercaliper.glb',

    gltf => {
      if (!isCaliper) return;

      currentObject = gltf.scene;

      // Improve the model's material appearance without
      // replacing the original textures.
      currentObject.traverse(part => {
        if (part.isMesh) {
          part.castShadow = true;
          part.receiveShadow = true;
        }
      });

      scene.add(currentObject);

      // Inspect model meshes.
      const meshNames = [];

      currentObject.traverse(part => {
        if (part.isMesh) {
          meshNames.push(part.name || '(unnamed mesh)');
        }
      });

      // Inspect animation and its tracks.
      caliperAnimations = gltf.animations;

      if (caliperAnimations.length > 0) {
        mixer = new THREE.AnimationMixer(currentObject);

        animationAction = mixer.clipAction(
          caliperAnimations[0]
        );

        animationDuration = caliperAnimations[0].duration;
      }

      const animationDetails = caliperAnimations.map(animation => {
        const tracks = animation.tracks.map(track => {
          return track.name;
        });

        return animation.name +
          ' | Duration: ' + animation.duration.toFixed(2) +
          ' seconds | Tracks: ' + tracks.join(', ');
      });

      frameObject(currentObject);

      measurement.textContent =
        'Meshes (' + meshNames.length + '): ' +
        meshNames.join(', ') +
        ' | Animation details: ' +
        (animationDetails.join(' ; ') || 'None');

      setStatus(
        'Caliper loaded. Drag slowly to rotate; pinch to zoom.'
      );

      addJawControls();
    },

    undefined,

    error => {
      console.error(error);
      isCaliper = false;

      setStatus(
        'Caliper failed to load. Check verniercaliper.glb filename.'
      );
    }
  );
}

// Create an animation slider if the model has an animation.
function addJawControls() {
  const oldPanel = document.getElementById('jawControls');

  if (oldPanel) oldPanel.remove();

  if (!caliperAnimations.length) return;

  const panel = document.createElement('div');
  panel.id = 'jawControls';
  panel.style.cssText =
    'margin-top:14px;padding:12px;border:1px solid #465265;' +
    'border-radius:9px;background:#10151d;';

  const label = document.createElement('label');
  label.textContent = 'Caliper animation control';
  label.style.display = 'block';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1000';
  slider.step = '1';
  slider.value = '0';
  slider.style.width = '100%';

  const note = document.createElement('p');
  note.style.cssText =
    'font-size:12px;color:#b8c5d6;line-height:1.5;';
  note.textContent =
    'Move the slider to inspect the model animation. ' +
    'Jaw movement depends on what the animation contains.';

  slider.addEventListener('input', () => {
    if (!mixer || !animationAction) return;

    const progress = Number(slider.value) / 1000;

    animationAction.reset();
    animationAction.play();
    animationAction.paused = true;

    mixer.setTime(progress * animationDuration);

    setStatus(
      'Animation position: ' + Math.round(progress * 100) + '%'
    );
  });

  panel.appendChild(label);
  panel.appendChild(slider);
  panel.appendChild(note);

  document.getElementById('measurement').after(panel);
}

// Shape buttons.
document.querySelectorAll('[data-shape]').forEach(button => {
  button.addEventListener('click', () => {
    createShape(button.dataset.shape);
  });
});

// Caliper button.
document.getElementById('caliperButton').addEventListener(
  'click',
  loadCaliper
);

// Update object dimensions.
document.getElementById('updateButton').addEventListener(
  'click',
  () => {
    if (isCaliper) {
      setStatus('Select an object before changing dimensions.');
      return;
    }

    createShape(currentShape, true);
  }
);

// Remove current object.
document.getElementById('removeButton').addEventListener(
  'click',
  () => {
    removeObject();
    isCaliper = false;

    const panel = document.getElementById('jawControls');
    if (panel) panel.remove();

    measurement.textContent = 'No object selected.';
    setStatus('Object removed.');
  }
);

// Reset camera.
document.getElementById('resetButton').addEventListener(
  'click',
  () => {
    if (currentObject) {
      frameObject(currentObject);
    } else {
      camera.position.set(35, 25, 45);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }
);

// Keep the viewer responsive.
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

  const delta = Math.min(clock.getDelta(), 0.05);

  if (mixer && animationAction && !animationAction.paused) {
    mixer.update(delta);
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Smaller defaults.
inputA.value = 10;
inputB.value = 10;
inputC.value = 10;

// Start with a small metallic cube.
createShape('cube');
