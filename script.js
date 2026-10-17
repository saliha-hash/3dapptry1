import * as THREE from "three";

import { OrbitControls } from
  "three/addons/controls/OrbitControls.js";

import { GLTFLoader } from
  "three/addons/loaders/GLTFLoader.js";


/* ---------------------------------------
   HTML ELEMENTS
--------------------------------------- */

const viewer = document.getElementById("viewer");

const jawControlPanel =
  document.getElementById("jawControlPanel");

const jawSlider = document.getElementById("jawSlider");
const jawValue = document.getElementById("jawValue");

const closeJawsButton =
  document.getElementById("closeJawsButton");

const openJawsButton =
  document.getElementById("openJawsButton");

const otherObjectsButton =
  document.getElementById("otherObjectsButton");

const objectMenu = document.getElementById("objectMenu");
const menuArrow = document.getElementById("menuArrow");

const selectedObjectName =
  document.getElementById("selectedObjectName");

const dimensionA = document.getElementById("dimensionA");
const dimensionB = document.getElementById("dimensionB");
const dimensionC = document.getElementById("dimensionC");

const labelA = document.getElementById("labelA");
const labelB = document.getElementById("labelB");
const labelC = document.getElementById("labelC");

const updateButton = document.getElementById("updateButton");
const removeButton = document.getElementById("removeButton");
const resetButton = document.getElementById("resetButton");

const status = document.getElementById("status");

const measurement = document.getElementById("measurement");

const measurementDetails =
  document.getElementById("measurementDetails");

const measurementAnswer =
  document.getElementById("measurementAnswer");


/* ---------------------------------------
   THREE.JS SCENE
--------------------------------------- */

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(
  38,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  1000
);

camera.position.set(0, 1.1, 8.4);

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
renderer.toneMappingExposure = 1.35;

viewer.appendChild(renderer.domElement);


/* ---------------------------------------
   LIGHTING
--------------------------------------- */

scene.add(
  new THREE.AmbientLight(0xffffff, 1.8)
);

const keyLight = new THREE.DirectionalLight(
  0xffffff,
  3.5
);

keyLight.position.set(4, 6, 7);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(
  0xffffff,
  1.6
);

fillLight.position.set(-5, 2, 4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(
  0xffffff,
  2.2
);

rimLight.position.set(0, -3, -5);
scene.add(rimLight);


/* ---------------------------------------
   CAMERA CONTROLS
--------------------------------------- */

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;
controls.dampingFactor = 0.06;

controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.65;
controls.panSpeed = 0.45;

controls.minDistance = 1;
controls.maxDistance = 30;


/* ---------------------------------------
   MODEL STATE
--------------------------------------- */

let caliper = null;
let movableJawPart = null;

let originalJawX = 0;
let modelScale = 1;

let selectedObject = null;
let selectedShape = null;

const objectGroup = new THREE.Group();

scene.add(objectGroup);


/*
  Estimated object location in the GLB model's
  original coordinate system.

  The mesh report suggests the fixed and moving
  jaw edges are near x = -3.25 and x = -2.25.

  Their midpoint is approximately x = -2.75.
  This is an estimate, not a verified jaw-tip
  measurement.
*/

const OBJECT_POSITION_IN_MODEL = new THREE.Vector3(
  -2.75,
  -0.02,
  0.67
);


/*
  Visual conversion from millimetres to model units.
  This must be calibrated against the actual GLB
  dimensions before the app can give real readings.
*/

const MM_TO_MODEL_UNITS = 0.018;


/* ---------------------------------------
   SHINY SILVER MATERIAL
--------------------------------------- */

function createSilverMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xd4d4d4,
    metalness: 0.95,
    roughness: 0.17,
    clearcoat: 1,
    clearcoatRoughness: 0.12
  });
}


/* ---------------------------------------
   LOAD THE CALIPER MODEL
--------------------------------------- */

function loadCaliper() {
  const loader = new GLTFLoader();

  loader.load(
    "./verniercaliper.glb",

    function (gltf) {
      caliper = gltf.scene;

      /*
        Hide the unwanted black circle by mesh name.
      */

      caliper.traverse(function (child) {
        if (
          child.name === "Circle_4" ||
          child.name === "Object_12"
        ) {
          child.visible = false;
        }

        /*
          Find the suspected movable assembly.
        */

        if (child.name === "Cube004_2") {
          movableJawPart = child;
        }
      });

      /*
        Measure the original model bounds.
      */

      caliper.updateMatrixWorld(true);

      const originalBox = new THREE.Box3()
        .setFromObject(caliper);

      const originalSize = originalBox.getSize(
        new THREE.Vector3()
      );

      const largestDimension = Math.max(
        originalSize.x,
        originalSize.y,
        originalSize.z
      );

      if (
        !Number.isFinite(largestDimension) ||
        largestDimension <= 0
      ) {
        status.textContent =
          "The caliper model has invalid dimensions.";

        return;
      }

      /*
        Scale the model to fit the viewer.
      */

      const desiredSize = 6.5;

      modelScale = desiredSize / largestDimension;

      caliper.scale.setScalar(modelScale);

      caliper.updateMatrixWorld(true);

      /*
        Center the model after scaling.
      */

      const scaledBox = new THREE.Box3()
        .setFromObject(caliper);

      const scaledCenter = scaledBox.getCenter(
        new THREE.Vector3()
      );

      caliper.position.sub(scaledCenter);

      scene.add(caliper);

      caliper.updateMatrixWorld(true);

      /*
        Save the jaw's starting position.
      */

      if (movableJawPart) {
        originalJawX = movableJawPart.position.x;
      } else {
        status.textContent =
          "The model loaded, but the movable jaw assembly was not found.";
      }

      /*
        Fit the camera to the caliper.
      */

      const finalBox = new THREE.Box3()
        .setFromObject(caliper);

      const finalSize = finalBox.getSize(
        new THREE.Vector3()
      );

      const finalCenter = finalBox.getCenter(
        new THREE.Vector3()
      );

      controls.target.copy(finalCenter);

      camera.position.set(
        finalCenter.x,
        finalCenter.y + finalSize.y * 0.55,
        finalCenter.z + finalSize.z * 2.4
      );

      camera.lookAt(finalCenter);
      controls.update();

      /*
        Start with no object selected.
      */

      removeSelectedObject();

      status.textContent =
        "Model loaded. Select Add Object to begin.";

      updateJawPosition();
    },

    undefined,

    function (error) {
      console.error("Caliper loading error:", error);

      status.textContent =
        "Could not load verniercaliper.glb. Check the filename and repository location.";
    }
  );
}

loadCaliper();


/* ---------------------------------------
   JAW SLIDER
--------------------------------------- */

function updateJawPosition() {
  const sliderValue = Number(jawSlider.value);

  jawValue.textContent = sliderValue + "%";

  if (!movableJawPart) {
    return;
  }

  /*
    The jaw assembly moves along the model's X-axis.

    Increasing the slider increases its local X
    position. The travel range can be calibrated
    against the actual jaw tips.
  */

  const maximumTravel = 2.0;

  const openingAmount =
    (sliderValue / 100) * maximumTravel;

  movableJawPart.position.x =
    originalJawX + openingAmount;

  movableJawPart.updateMatrixWorld(true);
}

jawSlider.addEventListener(
  "input",
  updateJawPosition
);

closeJawsButton.addEventListener("click", function () {
  jawSlider.value = 0;
  updateJawPosition();
});

openJawsButton.addEventListener("click", function () {
  jawSlider.value = 100;
  updateJawPosition();
});


/* ---------------------------------------
   OBJECT MENU
--------------------------------------- */

otherObjectsButton.addEventListener("click", function () {
  objectMenu.classList.toggle("open");

  menuArrow.textContent =
    objectMenu.classList.contains("open") ? "⌃" : "⌄";
});

objectMenu.querySelectorAll("[data-shape]").forEach(
  function (button) {
    button.addEventListener("click", function () {
      addObject(button.dataset.shape);

      objectMenu.classList.remove("open");
      menuArrow.textContent = "⌄";
    });
  }
);


/* ---------------------------------------
   READ DIMENSIONS
--------------------------------------- */

function readDimensions() {
  const a = Number(dimensionA.value);
  const b = Number(dimensionB.value);
  const c = Number(dimensionC.value);

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c) ||
    a <= 0 ||
    b <= 0 ||
    c <= 0
  ) {
    status.textContent =
      "Enter positive dimensions in millimetres.";

    return null;
  }

  return { a, b, c };
}


/* ---------------------------------------
   CREATE SHAPE GEOMETRY
--------------------------------------- */

function createGeometry(shape, dimensions) {
  const a = dimensions.a * MM_TO_MODEL_UNITS;
  const b = dimensions.b * MM_TO_MODEL_UNITS;
  const c = dimensions.c * MM_TO_MODEL_UNITS;

  switch (shape) {
    case "sphere":
      return new THREE.SphereGeometry(
        a / 2,
        48,
        32
      );

    case "cube":
      return new THREE.BoxGeometry(a, a, a);

    case "cuboid":
      return new THREE.BoxGeometry(a, b, c);

    case "cylinder":
      return new THREE.CylinderGeometry(
        a / 2,
        a / 2,
        b,
        48
      );

    case "cone":
      return new THREE.ConeGeometry(
        a / 2,
        b,
        48
      );

    default:
      return new THREE.SphereGeometry(
        a / 2,
        48,
        32
      );
  }
}


/* ---------------------------------------
   POSITION OBJECT BETWEEN THE JAWS
--------------------------------------- */

function getObjectPosition() {
  /*
    Convert the estimated position from the GLB's
    local coordinate system into the scene's world
    coordinate system.

    This applies the model's scale and centering
    transformations instead of placing the object
    at an unrelated world coordinate.
  */

  caliper.updateMatrixWorld(true);

  return caliper.localToWorld(
    OBJECT_POSITION_IN_MODEL.clone()
  );
}


/* ---------------------------------------
   UPDATE SHAPE LABELS
--------------------------------------- */

function updateLabels(shape) {
  dimensionA.disabled = false;
  dimensionB.disabled = false;
  dimensionC.disabled = false;

  if (shape === "sphere") {
    labelA.textContent = "Diameter (mm)";
    labelB.textContent = "Not used";
    labelC.textContent = "Not used";

    dimensionB.disabled = true;
    dimensionC.disabled = true;
  } else if (shape === "cube") {
    labelA.textContent = "Side (mm)";
    labelB.textContent = "Not used";
    labelC.textContent = "Not used";

    dimensionB.disabled = true;
    dimensionC.disabled = true;
  } else if (
    shape === "cylinder" ||
    shape === "cone"
  ) {
    labelA.textContent = "Diameter (mm)";
    labelB.textContent = "Height (mm)";
    labelC.textContent = "Not used";

    dimensionC.disabled = true;
  } else {
    labelA.textContent = "Length (mm)";
    labelB.textContent = "Width (mm)";
    labelC.textContent = "Height (mm)";
  }
}


/* ---------------------------------------
   ADD OBJECT
--------------------------------------- */

function addObject(shape) {
  if (!caliper) {
    status.textContent =
      "Wait for the caliper model to load.";

    return;
  }

  const dimensions = readDimensions();

  if (!dimensions) {
    return;
  }

  removeSelectedObject();

  selectedShape = shape;

  selectedObject = new THREE.Mesh(
    createGeometry(shape, dimensions),
    createSilverMaterial()
  );

  selectedObject.name = shape + "Object";

  /*
    Place the object near the estimated jaw gap
    using the caliper's transformed coordinates.
  */

  selectedObject.position.copy(getObjectPosition());

  /*
    Keep the object centered in the estimated gap.
    Its dimensions determine how large it appears.
  */

  objectGroup.add(selectedObject);

  selectedObjectName.textContent =
    "Selected: " +
    shape.charAt(0).toUpperCase() +
    shape.slice(1);

  jawControlPanel.style.display = "none";

  updateLabels(shape);

  measurement.classList.remove("show");

  status.textContent =
    "Object added. Adjust its dimensions as required.";
}


/* ---------------------------------------
   UPDATE DIMENSIONS
--------------------------------------- */

updateButton.addEventListener("click", function () {
  if (!selectedObject || !selectedShape) {
    status.textContent =
      "Select an object first.";

    return;
  }

  const dimensions = readDimensions();

  if (!dimensions) {
    return;
  }

  selectedObject.geometry.dispose();

  selectedObject.geometry = createGeometry(
    selectedShape,
    dimensions
  );

  let answer;

  if (selectedShape === "sphere") {
    answer = dimensions.a + " mm diameter";
  } else if (selectedShape === "cube") {
    answer = dimensions.a + " mm side";
  } else if (
    selectedShape === "cylinder" ||
    selectedShape === "cone"
  ) {
    answer =
      dimensions.a + " mm diameter × " +
      dimensions.b + " mm height";
  } else {
    answer =
      dimensions.a + " × " +
      dimensions.b + " × " +
      dimensions.c + " mm";
  }

  measurementDetails.textContent =
    "Dimensions entered for the selected object:";

  measurementAnswer.textContent = answer;

  measurement.classList.add("show");

  status.textContent =
    "Dimensions updated.";
});


/* ---------------------------------------
   REMOVE OBJECT
--------------------------------------- */

function removeSelectedObject() {
  if (selectedObject) {
    objectGroup.remove(selectedObject);

    selectedObject.geometry.dispose();

    if (Array.isArray(selectedObject.material)) {
      selectedObject.material.forEach(function (material) {
        material.dispose();
      });
    } else if (selectedObject.material) {
      selectedObject.material.dispose();
    }
  }

  selectedObject = null;
  selectedShape = null;

  selectedObjectName.textContent =
    "No object selected";

  measurement.classList.remove("show");

  dimensionA.disabled = false;
  dimensionB.disabled = false;
  dimensionC.disabled = false;

  labelA.textContent = "Diameter (mm)";
  labelB.textContent = "Width (mm)";
  labelC.textContent = "Height (mm)";

  jawControlPanel.style.display = "block";
}

removeButton.addEventListener("click", function () {
  removeSelectedObject();

  status.textContent =
    "Object removed. The jaw slider is available.";
});


/* ---------------------------------------
   RESET
--------------------------------------- */

resetButton.addEventListener("click", function () {
  removeSelectedObject();

  dimensionA.value = 20;
  dimensionB.value = 20;
  dimensionC.value = 20;

  jawSlider.value = 0;

  updateJawPosition();

  status.textContent =
    "Reset complete.";
});


/* ---------------------------------------
   RESIZE
--------------------------------------- */

function resizeViewer() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (!width || !height) {
    return;
  }

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

window.addEventListener("resize", resizeViewer);


/* ---------------------------------------
   RENDER LOOP
--------------------------------------- */

function animate() {
  requestAnimationFrame(animate);

  controls.update();

  renderer.render(scene, camera);
}

animate();
