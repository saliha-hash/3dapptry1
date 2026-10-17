import * as THREE from "three";

import { OrbitControls } from
  "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/controls/OrbitControls.js";

import { GLTFLoader } from
  "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/loaders/GLTFLoader.js";


/* =========================================
   TEMPORARY VERNIER CALIPER MODEL INSPECTOR
   No default sphere. No jaw slider.
========================================= */

const viewer = document.getElementById("viewer");
const status = document.getElementById("status");

if (!viewer) {
  throw new Error("The #viewer element was not found.");
}


/* ---------- SCENE ---------- */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  40,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  1000
);

camera.position.set(0, 0, 9);

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
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 25;

scene.add(new THREE.AmbientLight(0xffffff, 2));

const light1 = new THREE.DirectionalLight(0xffffff, 3);
light1.position.set(4, 5, 8);
scene.add(light1);

const light2 = new THREE.DirectionalLight(0xffffff, 1.5);
light2.position.set(-5, 2, -4);
scene.add(light2);


/* ---------- INSPECTOR STATE ---------- */

let model = null;
let mixer = null;
let animationClip = null;
let animationAction = null;

const meshEntries = [];
const nodeNames = new Set();


/* ---------- INSPECTOR UI ---------- */

const inspector = document.createElement("section");

inspector.id = "modelInspector";

inspector.style.cssText = `
  margin-top: 14px;
  padding: 14px;
  background: #101010;
  color: #eeeeee;
  border: 1px solid #444;
  border-radius: 10px;
  font-family: Arial, sans-serif;
`;

inspector.innerHTML = `
  <h2 style="font-size:18px;margin:0 0 8px">
    Model Inspector
  </h2>

  <p style="font-size:13px;line-height:1.6;color:#bbb">
    Temporarily hide individual parts to identify the black circle
    and the moving jaw components.
  </p>

  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
    <button id="inspectClosed" type="button">Closed Pose</button>
    <button id="inspectOpen" type="button">Open Pose</button>
    <button id="inspectAll" type="button">Show All Parts</button>
    <button id="inspectReport" type="button">Copy Part Report</button>
  </div>

  <div id="animationInfo"
    style="font-size:12px;color:#aaa;line-height:1.7;margin-bottom:12px">
    Checking model...
  </div>

  <div id="meshList"></div>

  <pre id="modelReport"
    style="white-space:pre-wrap;overflow-wrap:anywhere;
    font-size:11px;line-height:1.5;color:#bcd7ff;
    background:#050505;padding:10px;border-radius:6px"></pre>
`;

viewer.insertAdjacentElement("afterend", inspector);


/* ---------- INSPECTOR BUTTON STYLE ---------- */

const inspectorStyle = document.createElement("style");

inspectorStyle.textContent = `
  #modelInspector button {
    padding: 10px 12px;
    color: white;
    background: #202020;
    border: 1px solid #555;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
  }

  #modelInspector button:active {
    background: #333;
  }

  .mesh-entry {
    padding: 10px 0;
    border-top: 1px solid #292929;
  }

  .mesh-entry label {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    font-size: 13px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .mesh-entry input {
    margin-top: 3px;
    accent-color: #1687ff;
    flex-shrink: 0;
  }

  .mesh-details {
    margin: 5px 0 0 25px;
    color: #999;
    font-size: 11px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
`;

document.head.appendChild(inspectorStyle);


/* ---------- UTILITIES ---------- */

function getPath(object) {
  const names = [];
  let current = object;

  while (current && current !== model) {
    names.unshift(current.name || "(unnamed)");
    current = current.parent;
  }

  return names.join(" / ");
}

function getBounds(object) {
  object.updateWorldMatrix(true, false);

  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  return { center, size };
}

function number(value) {
  return Number(value).toFixed(3);
}

function formatBounds(object) {
  const { center, size } = getBounds(object);

  return (
    `Center: (${number(center.x)}, ${number(center.y)}, ${number(center.z)})` +
    `<br>Size: (${number(size.x)}, ${number(size.y)}, ${number(size.z)})`
  );
}


/* ---------- MODEL REPORT ---------- */

function buildReport() {
  if (!model) return "";

  const lines = [];

  lines.push("VERNIER CALIPER MODEL REPORT");
  lines.push("============================");

  lines.push("");
  lines.push("MESHES:");

  meshEntries.forEach((entry, index) => {
    const { center, size } = getBounds(entry.mesh);

    lines.push(
      `${index + 1}. ${entry.path}` +
      ` | visible=${entry.mesh.visible}` +
      ` | center=(${number(center.x)}, ${number(center.y)}, ${number(center.z)})` +
      ` | size=(${number(size.x)}, ${number(size.y)}, ${number(size.z)})` +
      ` | material=${entry.materialNames}`
    );
  });

  lines.push("");
  lines.push("ANIMATION CLIPS:");

  if (!model.animations || model.animations.length === 0) {
    lines.push("No animations found.");
  } else {
    model.animations.forEach((clip, index) => {
      lines.push(
        `${index + 1}. ${clip.name || "(unnamed)"}` +
        ` | duration=${number(clip.duration)} seconds`
      );

      clip.tracks.forEach((track) => {
        lines.push(`   TRACK: ${track.name}`);
      });
    });
  }

  return lines.join("\n");
}

function refreshReport() {
  const report = document.getElementById("modelReport");
  if (report) report.textContent = buildReport();
}


/* ---------- LIST EVERY MESH ---------- */

function createMeshList() {
  const list = document.getElementById("meshList");
  list.innerHTML = "";

  meshEntries.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "mesh-entry";

    const label = document.createElement("label");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = entry.mesh.visible;

    const title = document.createElement("span");
    title.textContent =
      `${index + 1}. ${entry.path}`;

    label.appendChild(checkbox);
    label.appendChild(title);

    const details = document.createElement("div");
    details.className = "mesh-details";
    details.innerHTML =
      formatBounds(entry.mesh) +
      `<br>Material: ${entry.materialNames}`;

    checkbox.addEventListener("change", () => {
      entry.mesh.visible = checkbox.checked;

      details.innerHTML =
        formatBounds(entry.mesh) +
        `<br>Material: ${entry.materialNames}`;

      refreshReport();
    });

    row.appendChild(label);
    row.appendChild(details);
    list.appendChild(row);
  });
}


/* ---------- ANIMATION POSES ---------- */

function showAnimationPose(progress) {
  if (!animationAction || !animationClip || !mixer) {
    document.getElementById("animationInfo").textContent =
      "No animation is available in this model.";

    return;
  }

  animationAction.paused = false;

  animationAction.time =
    THREE.MathUtils.clamp(progress, 0, 1) *
    animationClip.duration;

  mixer.update(0);

  animationAction.paused = true;

  document.getElementById("animationInfo").textContent =
    `Showing animation at ${Math.round(progress * 100)}% ` +
    `(${number(animationAction.time)} of ` +
    `${number(animationClip.duration)} seconds).`;

  // Refresh bounds after the animation has moved the parts.
  createMeshList();
  refreshReport();
}

document.getElementById("inspectClosed").addEventListener(
  "click",
  () => showAnimationPose(0)
);

document.getElementById("inspectOpen").addEventListener(
  "click",
  () => showAnimationPose(1)
);

document.getElementById("inspectAll").addEventListener(
  "click",
  () => {
    meshEntries.forEach((entry) => {
      entry.mesh.visible = true;
    });

    createMeshList();
    refreshReport();
  }
);

document.getElementById("inspectReport").addEventListener(
  "click",
  async () => {
    const report = buildReport();

    try {
      await navigator.clipboard.writeText(report);

      document.getElementById("animationInfo").textContent =
        "Report copied. You can paste it into this chat.";
    } catch (error) {
      // The report remains visible below if clipboard access fails.
      document.getElementById("modelReport").textContent = report;

      document.getElementById("animationInfo").textContent =
        "Copy is unavailable. The report is displayed below.";
    }
  }
);


/* ---------- LOAD MODEL ---------- */

function loadModel() {
  const loader = new GLTFLoader();

  loader.load(
    "./verniercaliper.glb",

    (gltf) => {
      model = gltf.scene;

      model.traverse((object) => {
        if (object.name) nodeNames.add(object.name);

        if (!object.isMesh) return;

        object.frustumCulled = false;

        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => {
            material.side = THREE.DoubleSide;
            material.needsUpdate = true;
          });
        }

        const materials = object.material
          ? (
              Array.isArray(object.material)
                ? object.material
                : [object.material]
            )
          : [];

        meshEntries.push({
          mesh: object,
          path: getPath(object),
          materialNames: materials
            .map((material) => material.name || "(unnamed)")
            .join(", ") || "(none)"
        });
      });

      // Scale and center the model without changing its mesh geometry.
      model.updateMatrixWorld(true);

      const initialBounds = new THREE.Box3().setFromObject(model);
      const initialSize = initialBounds.getSize(new THREE.Vector3());
      const initialCenter = initialBounds.getCenter(new THREE.Vector3());

      const maxDimension = Math.max(
        initialSize.x,
        initialSize.y,
        initialSize.z
      );

      if (!Number.isFinite(maxDimension) || maxDimension === 0) {
        throw new Error("The loaded model has no measurable geometry.");
      }

      model.position.sub(initialCenter);
      model.scale.multiplyScalar(6.5 / maxDimension);
      model.updateMatrixWorld(true);

      const centeredBounds = new THREE.Box3().setFromObject(model);
      const centeredPosition =
        centeredBounds.getCenter(new THREE.Vector3());

      model.position.sub(centeredPosition);
      model.updateMatrixWorld(true);

      scene.add(model);

      // Fit the model in the viewer.
      camera.position.set(0, 0.25, 9);
      controls.target.set(0, 0, 0);
      controls.update();

      if (gltf.animations && gltf.animations.length > 0) {
        animationClip = gltf.animations[0];
        mixer = new THREE.AnimationMixer(model);

        animationAction = mixer.clipAction(animationClip);
        animationAction.setLoop(THREE.LoopOnce, 1);
        animationAction.clampWhenFinished = true;
        animationAction.play();
        animationAction.paused = true;
        animationAction.time = 0;

        mixer.update(0);
      }

      createMeshList();
      refreshReport();

      const info = document.getElementById("animationInfo");

      info.textContent =
        `${meshEntries.length} meshes found. ` +
        `${gltf.animations.length} animation clips found. ` +
        "Use Closed Pose and Open Pose to compare jaw positions.";

      if (status) {
        status.textContent =
          "Inspector ready. Toggle parts below to identify the black circle.";
      }
    },

    undefined,

    (error) => {
      console.error("Model loading error:", error);

      if (status) {
        status.textContent =
          "Could not load the model. Check verniercaliper.glb.";
      }
    }
  );
}


/* ---------- RESIZE ---------- */

window.addEventListener("resize", () => {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});


/* ---------- RENDER ---------- */

function animate() {
  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);
}

loadModel();
animate();
