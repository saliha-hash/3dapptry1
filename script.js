import * as THREE from "three";

import { OrbitControls } from
  "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/controls/OrbitControls.js";

import { GLTFLoader } from
  "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/loaders/GLTFLoader.js";


/* =========================================
   VERNIER CALIPER — INTERACTIVE MODEL
========================================= */

const viewer = document.getElementById("viewer");
const status = document.getElementById("status");

const objectButton = document.getElementById("otherObjectsButton");
const objectMenu = document.getElementById("objectMenu");
const selectedObjectName = document.getElementById("selectedObjectName");
const menuArrow = document.getElementById("menuArrow");

const dimensionA = document.getElementById("dimensionA");
const dimensionB = document.getElementById("dimensionB");
const dimensionC = document.getElementById("dimensionC");

const labelA = document.getElementById("labelA");
const labelB = document.getElementById("labelB");
const labelC = document.getElementById("labelC");

const updateButton = document.getElementById("updateButton");
const removeButton = document.getElementById("removeButton");
const resetButton = document.getElementById("resetButton");
const measurement = document.getElementById("measurement");

const jawPanel = document.getElementById("jawControlPanel");
const jawSlider = document.getElementById("jawSlider");
const jawValue = document.getElementById("jawValue");


if (!viewer) {
  throw new Error("The viewer element is missing.");
}


/* =========================================
   SCENE
========================================= */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  38,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  1000
);

camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 22;
controls.target.set(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 2));

const light1 = new THREE.DirectionalLight(0xffffff, 2.5);
light1.position.set(3, 5, 8);
scene.add(light1);

const light2 = new THREE.DirectionalLight(0xffffff, 1.5);
light2.position.set(-5, 2, -5);
scene.add(light2);


/* =========================================
   MODEL STATE
========================================= */

let caliper = null;
let movableNode = null;
let selectedObject = null;
let selectedShape = null;

let initialJawPosition = null;
let modelScale = 1;

const objects = new THREE.Group();
scene.add(objects);


/*
 * These values control the estimated movement.
 * The model has no animation, so the slider moves
 * the selected node directly.
 *
 * Adjust MAX_JAW_TRAVEL after verifying the
 * actual jaw movement.
 */

const MAX_JAW_TRAVEL = 1.5;


/* =========================================
   SLIDER PANEL
========================================= */

if (jawPanel) {
  jawPanel.hidden = false;
}

function setJawSliderVisibility() {
  if (!jawPanel) return;

  jawPanel.hidden = Boolean(selectedObject);
}

function updateJawSlider() {
  if (!jawSlider || !movableNode || initialJawPosition === null) {
    return;
  }

  const progress = Number(jawSlider.value) / 100;

  /*
   * Move the node horizontally.
   * The negative direction is an initial estimate.
   */

  movableNode.position.x =
    initialJawPosition - (MAX_JAW_TRAVEL * progress / modelScale);

  if (jawValue) {
    jawValue.textContent = `${Math.round(progress * 100)}% open`;
  }

  movableNode.updateMatrixWorld(true);

  if (selectedObject) {
    positionObjectInWorkingArea();
  }
}

if (jawSlider) {
  jawSlider.addEventListener("input", updateJawSlider);
}


/* =========================================
   LOAD CALIPER MODEL
========================================= */

function loadCaliper() {
  const loader = new GLTFLoader();

  loader.load(
    "./verniercaliper.glb",

    (gltf) => {
      caliper = gltf.scene;

      /*
       * Find the movable node using the name from
       * the model-inspection report.
       */

      movableNode = caliper.getObjectByName("Cube004_2");

      /*
       * Hide the unwanted circle by its identified
       * mesh name. Do not hide the entire parent.
       */

      const unwantedCircle =
        caliper.getObjectByName("Circle_4") ||
        caliper.getObjectByName("Object_12");

      if (unwantedCircle) {
        unwantedCircle.visible = false;
      }

      caliper.traverse((child) => {
        if (!child.isMesh) return;

        child.frustumCulled = false;

        if (child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

          materials.forEach((material) => {
            material.side = THREE.DoubleSide;
            material.needsUpdate = true;
          });
        }
      });

      /*
       * Scale and center the model.
       */

      caliper.updateMatrixWorld(true);

      const bounds = new THREE.Box3().setFromObject(caliper);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());

      const largestDimension = Math.max(
        size.x,
        size.y,
        size.z
      );

      if (!Number.isFinite(largestDimension) || largestDimension <= 0) {
        if (status) {
          status.textContent = "The caliper model has invalid dimensions.";
        }
        return;
      }

      modelScale = 6.5 / largestDimension;

      caliper.position.sub(center);
      caliper.scale.setScalar(modelScale);
      caliper.updateMatrixWorld(true);

      /*
       * Recenter after scaling.
       */

      const scaledBounds = new THREE.Box3().setFromObject(caliper);
      const scaledCenter =
        scaledBounds.getCenter(new THREE.Vector3());

      caliper.position.sub(scaledCenter);
      caliper.updateMatrixWorld(true);

      scene.add(caliper);

      /*
       * Save the starting position of the movable node.
       */

      if (movableNode) {
        initialJawPosition = movableNode.position.x;
      }

      if (jawSlider) {
        jawSlider.value = "0";
      }

      updateJawSlider();

      /*
       * Fit the caliper into the viewer.
       */

      camera.position.set(0, 0.2, 9);
      controls.target.set(0, 0, 0);
      controls.update();

      setJawSliderVisibility();

      if (status) {
        status.textContent = movableNode
          ? "Caliper loaded. Use the slider to test jaw movement."
          : "Caliper loaded, but the movable part was not found.";
      }
    },

    undefined,

    (error) => {
      console.error("Caliper loading error:", error);

      if (status) {
        status.textContent =
          "Model failed to load. Check the GLB filename.";
      }
    }
  );
}


/* =========================================
   OBJECT GEOMETRY
========================================= */

function createGeometry(shape, a, b, c) {
  /*
   * Convert millimetres into approximate model units.
   */

  const scale = 0.035;

  const A = a * scale;
  const B = b * scale;
  const C = c * scale;

  switch (shape) {
    case "sphere":
      return new THREE.SphereGeometry(
        A / 2,
        40,
        28
      );

    case "cube":
      return new THREE.BoxGeometry(A, A, A);

    case "cuboid":
      return new THREE.BoxGeometry(A, B, C);

    case "cylinder":
      return new THREE.CylinderGeometry(
        A / 2,
        A / 2,
        B,
        40
      );

    case "cone":
      return new THREE.ConeGeometry(
        A / 2,
        B,
        40
      );

    default:
      return new THREE.SphereGeometry(A / 2, 40, 28);
  }
}


function getDimensions() {
  const a = Number(dimensionA.value);
  const b = Number(dimensionB.value);
  const c = Number(dimensionC.value);

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c) ||
    a < 1 || b < 1 || c < 1 ||
    a > 200 || b > 200 || c > 200
  ) {
    if (measurement) {
      measurement.textContent =
        "Enter dimensions between 1 mm and 200 mm.";
    }

    return null;
  }

  return { a, b, c };
}


/* =========================================
   OBJECT LABELS
========================================= */

function updateDimensionLabels(shape) {
  const labels = {
    sphere: ["Diameter", "Diameter", "Diameter"],
    cube: ["Side", "Side", "Side"],
    cylinder: ["Diameter", "Height", "Diameter"],
    cuboid: ["Length", "Height", "Depth"],
    cone: ["Diameter", "Height", "Diameter"]
  };

  const names = labels[shape] || labels.sphere;

  labelA.textContent = names[0];
  labelB.textContent = names[1];
  labelC.textContent = names[2];

  if (shape === "sphere" || shape === "cube") {
    dimensionB.value = dimensionA.value;
    dimensionC.value = dimensionA.value;
  }

  if (shape === "cylinder" || shape === "cone") {
    dimensionC.value = dimensionA.value;
  }
}


/* =========================================
   POSITION OBJECT
========================================= */

function positionObjectInWorkingArea() {
  if (!selectedObject || !caliper) return;

  /*
   * Estimated working position based on the model
   * bounds. This must be refined if the model's
   * jaw opening is not centered here.
   */

  selectedObject.position.set(-1.0, 0.15, 0.95);
}


/* =========================================
   ADD / REPLACE OBJECT
========================================= */

function addObject(shape) {
  if (!caliper) {
    if (status) {
      status.textContent = "Wait for the caliper to load.";
    }
    return;
  }

  const dimensions = getDimensions();

  if (!dimensions) return;

  if (selectedObject) {
    objects.remove(selectedObject);

    selectedObject.geometry.dispose();

    if (selectedObject.material) {
      selectedObject.material.dispose();
    }

    selectedObject = null;
  }

  const geometry = createGeometry(
    shape,
    dimensions.a,
    dimensions.b,
    dimensions.c
  );

  const material = new THREE.MeshStandardMaterial({
    color: 0x1687ff,
    metalness: 0.15,
    roughness: 0.35
  });

  selectedObject = new THREE.Mesh(geometry, material);
  selectedObject.name = `measuring-object-${shape}`;

  objects.add(selectedObject);

  selectedShape = shape;

  positionObjectInWorkingArea();

  selectedObjectName.textContent =
    `Selected Object — ${shape.charAt(0).toUpperCase()}${shape.slice(1)}`;

  measurement.innerHTML =
    `Selected object: ${shape}<br>` +
    `Dimensions: ${dimensions.a} × ${dimensions.b} × ${dimensions.c} mm`;

  setJawSliderVisibility();
}


/* =========================================
   DROPDOWN EVENTS
========================================= */

objectButton.addEventListener("click", () => {
  const isOpen = objectMenu.classList.toggle("open");

  objectButton.setAttribute("aria-expanded", String(isOpen));
  menuArrow.textContent = isOpen ? "⌃" : "⌄";
});

document.querySelectorAll(".object-option").forEach((button) => {
  button.addEventListener("click", () => {
    const shape = button.dataset.shape;

    updateDimensionLabels(shape);

    objectMenu.classList.remove("open");
    objectButton.setAttribute("aria-expanded", "false");
    menuArrow.textContent = "⌄";

    addObject(shape);
  });
});


/* =========================================
   UPDATE OBJECT SIZE
========================================= */

updateButton.addEventListener("click", () => {
  if (!selectedShape) {
    if (measurement) {
      measurement.textContent =
        "Choose an object from the dropdown first.";
    }
    return;
  }

  const dimensions = getDimensions();

  if (!dimensions) return;

  if (selectedObject) {
    selectedObject.geometry.dispose();

    selectedObject.geometry = createGeometry(
      selectedShape,
      dimensions.a,
      dimensions.b,
      dimensions.c
    );

    positionObjectInWorkingArea();

    measurement.innerHTML =
      `Selected object: ${selectedShape}<br>` +
      `Updated dimensions: ${dimensions.a} × ` +
      `${dimensions.b} × ${dimensions.c} mm`;
  }
});


/* =========================================
   REMOVE OBJECT
========================================= */

removeButton.addEventListener("click", () => {
  if (selectedObject) {
    objects.remove(selectedObject);

    selectedObject.geometry.dispose();
    selectedObject.material.dispose();

    selectedObject = null;
  }

  selectedShape = null;

  selectedObjectName.textContent = "Other Objects — Select Shape";

  measurement.innerHTML =
    "No object selected.<br>" +
    "Choose a shape from the Objects menu to begin.";

  setJawSliderVisibility();
});


/* =========================================
   RESET VIEW
========================================= */

resetButton.addEventListener("click", () => {
  camera.position.set(0, 0.2, 9);
  controls.target.set(0, 0, 0);
  controls.update();

  if (jawSlider) {
    jawSlider.value = "0";
    updateJawSlider();
  }
});


/* =========================================
   RESIZE
========================================= */

window.addEventListener("resize", () => {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});


/* =========================================
   RENDER
========================================= */

function animate() {
  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);
}

loadCaliper();
animate();
