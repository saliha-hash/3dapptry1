import * as THREE from "three";

import { OrbitControls } from
  "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/controls/OrbitControls.js";

import { GLTFLoader } from
  "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/loaders/GLTFLoader.js";


const viewer = document.getElementById("viewer");
const statusText = document.getElementById("status");
const measurement = document.getElementById("measurement");

const dimensionA = document.getElementById("dimensionA");
const dimensionB = document.getElementById("dimensionB");
const dimensionC = document.getElementById("dimensionC");

const labelA = document.getElementById("labelA");
const labelB = document.getElementById("labelB");
const labelC = document.getElementById("labelC");

const otherObjectsButton =
  document.getElementById("otherObjectsButton");

const objectMenu = document.getElementById("objectMenu");
const menuArrow = document.getElementById("menuArrow");
const selectedObjectName =
  document.getElementById("selectedObjectName");

const updateButton = document.getElementById("updateButton");
const removeButton = document.getElementById("removeButton");
const resetButton = document.getElementById("resetButton");


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  38,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  1000
);

camera.position.set(0, 1.2, 9);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 1);

viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.08;

// Allow one-finger rotation and two-finger zoom on mobile.
controls.enableRotate = true;
controls.enableZoom = true;
controls.enablePan = true;

// Allow closer zoom.
controls.minDistance = 0.5;
controls.maxDistance = 30;

// Zoom toward the point under the fingers.
controls.zoomToCursor = true;


scene.add(new THREE.AmbientLight(0xffffff, 2.2));

const keyLight = new THREE.DirectionalLight(0xffffff, 3);
keyLight.position.set(4, 6, 8);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xbac8ff, 1.4);
fillLight.position.set(-5, 2, -4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 1.5);
rimLight.position.set(0, -3, 5);
scene.add(rimLight);


let caliper = null;
let caliperMixer = null;
let animationFrame = null;

let selectedShape = "sphere";
let selectedObject = null;

let objectGroup = new THREE.Group();
scene.add(objectGroup);

const shapeNames = {
  sphere: "Sphere",
  cube: "Cube",
  cylinder: "Cylinder",
  cuboid: "Cuboid",
  cone: "Cone"
};

const MILLIMETRES_TO_SCENE_UNITS = 0.035;


function setStatus(message) {
  statusText.textContent = message;
}


function readDimension(input, fallback = 20) {
  const value = Number(input.value);

  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, 200);
}


function disposeObject(root) {
  root.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => material.dispose());
    }
  });
}


function removeSelectedObject() {
  if (!selectedObject) {
    measurement.innerHTML = "There is no object to remove.";
    return;
  }

  objectGroup.remove(selectedObject);
  disposeObject(selectedObject);
  selectedObject = null;

  measurement.innerHTML =
    "Object removed.<br>Select an object from the menu to add another.";

  setStatus(caliper ? "3D caliper loaded." : "Waiting for caliper model.");
}
function setDimensionLabels(shape) {
  labelA.textContent = "Diameter (mm)";
  labelB.textContent = "Height (mm)";
  labelC.textContent = "Depth (mm)";

  dimensionA.disabled = false;
  dimensionB.disabled = false;
  dimensionC.disabled = false;

  if (shape === "sphere") {
    labelA.textContent = "Diameter (mm)";
    labelB.textContent = "Height (mm)";
    labelC.textContent = "Depth (mm)";
  } else if (shape === "cube") {
    labelA.textContent = "Side (mm)";
    labelB.textContent = "Height (mm)";
    labelC.textContent = "Depth (mm)";
  } else if (shape === "cylinder") {
    labelA.textContent = "Diameter (mm)";
    labelB.textContent = "Height (mm)";
    labelC.textContent = "Depth (mm)";
  } else if (shape === "cuboid") {
    labelA.textContent = "Width (mm)";
    labelB.textContent = "Height (mm)";
    labelC.textContent = "Depth (mm)";
  } else if (shape === "cone") {
    labelA.textContent = "Diameter (mm)";
    labelB.textContent = "Height (mm)";
    labelC.textContent = "Depth (mm)";
  }
      }

function makeMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xc8cdd2,
    metalness: 0.72,
    roughness: 0.24
  });
}


function makeGeometry(shape, a, b, c) {
  const A = a * MILLIMETRES_TO_SCENE_UNITS;
  const B = b * MILLIMETRES_TO_SCENE_UNITS;
  const C = c * MILLIMETRES_TO_SCENE_UNITS;

  if (shape === "sphere") {
    return new THREE.SphereGeometry(A / 2, 48, 32);
  }

  if (shape === "cube") {
    return new THREE.BoxGeometry(A, A, A);
  }

  if (shape === "cylinder") {
    return new THREE.CylinderGeometry(A / 2, A / 2, B, 48);
  }

  if (shape === "cuboid") {
    return new THREE.BoxGeometry(A, B, C);
  }

  if (shape === "cone") {
    return new THREE.ConeGeometry(A / 2, B, 48);
  }

  return new THREE.SphereGeometry(A / 2, 48, 32);
}


function addObject(shape) {
  selectedShape = shape;

  if (selectedObject) {
    objectGroup.remove(selectedObject);
    disposeObject(selectedObject);
    selectedObject = null;
  }

  setDimensionLabels(shape);

  if (shape === "sphere") {
    dimensionA.value = 20;
    dimensionB.value = 20;
    dimensionC.value = 20;
  } else if (shape === "cube") {
    dimensionA.value = 20;
    dimensionB.value = 20;
    dimensionC.value = 20;
  } else if (shape === "cylinder") {
    dimensionA.value = 15;
    dimensionB.value = 25;
    dimensionC.value = 20;
  } else {
    dimensionA.value = 20;
    dimensionB.value = 20;
    dimensionC.value = 20;
  }

  selectedObjectName.textContent =
    "Other Objects — " + shapeNames[shape];

  selectedObject = new THREE.Mesh(
    makeGeometry(
      shape,
      readDimension(dimensionA),
      readDimension(dimensionB),
      readDimension(dimensionC)
    ),
    makeMaterial()
  );

  /*
   * This is a demonstration object in the scene.
   * Its position is not yet calibrated to the actual caliper jaws.
   */
  selectedObject.position.set(-1.0, 0.15, 0.25);

  objectGroup.add(selectedObject);

  updateMeasurement();
}


function updateObjectSize() {
  if (!selectedObject) {
    measurement.textContent =
      "Select an object before changing its dimensions.";
    return;
  }

  const a = readDimension(dimensionA);
  const b = readDimension(dimensionB);
  const c = readDimension(dimensionC);

  selectedObject.geometry.dispose();

  selectedObject.geometry = makeGeometry(
    selectedShape,
    a,
    b,
    c
  );

  updateMeasurement();
}


function updateMeasurement() {
  if (!selectedObject) {
    return;
  }

  const a = readDimension(dimensionA);
  const b = readDimension(dimensionB);
  const c = readDimension(dimensionC);

  let details = "";

  if (selectedShape === "sphere") {
    details = `Diameter: ${a} mm`;
  } else if (selectedShape === "cube") {
    details = `Side length: ${a} mm`;
  } else if (selectedShape === "cylinder") {
    details = `Diameter: ${a} mm<br>Height: ${b} mm`;
  } else if (selectedShape === "cuboid") {
    details =
      `Width: ${a} mm<br>Height: ${b} mm<br>Depth: ${c} mm`;
  } else if (selectedShape === "cone") {
    details = `Base diameter: ${a} mm<br>Height: ${b} mm`;
  }

  measurement.innerHTML =
    `<strong>${shapeNames[selectedShape]}</strong><br>` +
    `${details}<br><br>` +
    `<span style="color:#aaa">These are entered dimensions, not a live Vernier caliper reading.</span>`;
}


function frameCaliper(model) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  if (
    !Number.isFinite(size.x) ||
    !Number.isFinite(size.y) ||
    !Number.isFinite(size.z) ||
    Math.max(size.x, size.y, size.z) === 0
  ) {
    throw new Error("The model has no measurable geometry.");
  }

  model.position.sub(center);

  const maxDimension = Math.max(size.x, size.y, size.z);
  const scale = 6.5 / maxDimension;

  model.scale.multiplyScalar(scale);

  model.updateMatrixWorld(true);

  const newBounds = new THREE.Box3().setFromObject(model);
  const newCenter = newBounds.getCenter(new THREE.Vector3());

  model.position.sub(newCenter);

  controls.target.set(0, 0, 0);
  camera.position.set(0, 1.2, 9);
  camera.lookAt(0, 0, 0);

  controls.update();
}


function loadCaliper() {
  const loader = new GLTFLoader();

  loader.load(
    "./verniercaliper.glb",

    (gltf) => {
      caliper = gltf.scene;

      caliper.traverse((child) => {
        if (child.isMesh) {
          child.frustumCulled = false;

          if (child.material) {
            child.material.side = THREE.DoubleSide;
            child.material.needsUpdate = true;
          }
        }
      });

      frameCaliper(caliper);
      scene.add(caliper);
      addObject("sphere");

      setStatus("3D caliper loaded. Drag to rotate; pinch to zoom.");
    },

    undefined,

    (error) => {
      console.error("Caliper model loading failed:", error);

      setStatus(
        "The 3D model could not load. Check the browser console or try refreshing."
      );

      addObject("sphere");
    }
  );
}


otherObjectsButton.addEventListener("click", () => {
  const isOpen = objectMenu.classList.toggle("open");

  otherObjectsButton.setAttribute("aria-expanded", String(isOpen));
  menuArrow.textContent = isOpen ? "⌃" : "⌄";
});


document.querySelectorAll(".object-option").forEach((button) => {
  button.addEventListener("click", () => {
    const shape = button.dataset.shape;

    addObject(shape);

    objectMenu.classList.remove("open");
    otherObjectsButton.setAttribute("aria-expanded", "false");
    menuArrow.textContent = "⌄";
  });
});


updateButton.addEventListener("click", updateObjectSize);

removeButton.addEventListener("click", removeSelectedObject);


resetButton.addEventListener("click", () => {
  camera.position.set(0, 1.2, 9);
  controls.target.set(0, 0, 0);
  controls.update();

  setStatus(
    caliper
      ? "View reset."
      : "Waiting for caliper model."
  );
});


window.addEventListener("resize", () => {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (!width || !height) {
    return;
  }

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});


const clock = new THREE.Clock();

function animate() {
  animationFrame = requestAnimationFrame(animate);

  const delta = clock.getDelta();
  controls.update();
  renderer.render(scene, camera);
}

loadCaliper();
animate();
