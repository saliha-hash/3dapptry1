<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#000000">

  <title>Vernier Caliper | Science Lab</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #000;
      color: #f3f4f6;
      font-family: Arial, sans-serif;
    }

    header {
      padding: 15px 16px;
      text-align: center;
      background: #000;
    }

    header h1 {
      margin: 0;
      font-size: 25px;
      font-weight: 600;
      letter-spacing: .5px;
    }

    main {
      width: 100%;
      max-width: 850px;
      margin: auto;
      padding: 10px 14px 28px;
    }

    .viewer-panel {
      overflow: hidden;
      background: #000;
      border: 1px solid #242424;
      border-radius: 12px;
    }

    #viewer {
      width: 100%;
      height: min(62vh, 520px);
      min-height: 340px;
      background: #000;
      position: relative;
      overflow: hidden;
    }

    #viewer canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
    }

    .viewer-help {
      padding: 8px 12px;
      color: #929292;
      font-size: 12px;
      text-align: center;
    }

    .section {
      padding: 17px 0;
      border-bottom: 1px solid #202020;
    }

    h2 {
      margin: 0 0 12px;
      font-size: 17px;
      font-weight: 600;
    }

    button {
      color: #f5f5f5;
      background: #171717;
      border: 1px solid #454545;
      border-radius: 8px;
      padding: 11px 14px;
      font-size: 14px;
      cursor: pointer;
    }

    button:active {
      background: #303030;
    }

    .menu-button {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-align: left;
      font-size: 15px;
    }

    #objectMenu {
      display: none;
      flex-direction: column;
      gap: 7px;
      margin-top: 8px;
    }

    #objectMenu.open {
      display: flex;
    }

    .object-option {
      width: 100%;
      text-align: left;
      padding: 12px 14px;
      background: #0d0d0d;
      border-color: #292929;
    }

    .object-option.selected {
      border-color: #c4c4c4;
      background: #202020;
    }

    .dimensions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 9px;
    }

    label {
      display: block;
      color: #bcbcbc;
      font-size: 12px;
      margin-bottom: 7px;
    }

    input {
      width: 100%;
      min-width: 0;
      padding: 11px 7px;
      background: #0a0a0a;
      color: white;
      border: 1px solid #444;
      border-radius: 7px;
      font-size: 16px;
    }

    .button-row {
      display: flex;
      gap: 9px;
      margin-top: 12px;
    }

    .button-row button {
      flex: 1;
    }

    .primary {
      background: #e5e5e5;
      color: #000;
      border-color: #e5e5e5;
      font-weight: 600;
    }

    .result-box {
      margin-top: 14px;
      padding: 13px;
      border: 1px solid #292929;
      border-radius: 8px;
      background: #080808;
      line-height: 1.6;
      overflow-wrap: anywhere;
      font-size: 14px;
    }

    .muted {
      color: #999;
      font-size: 12px;
      line-height: 1.5;
    }

    #status {
      display: none;
      padding: 10px;
      color: #d0d0d0;
      font-size: 13px;
      overflow-wrap: anywhere;
    }

    #status.visible {
      display: block;
    }

    .coming-soon {
      padding-top: 20px;
      color: #777;
      font-size: 12px;
      text-align: center;
    }

    @media (max-width: 420px) {
      main {
        padding: 8px 10px 22px;
      }

      #viewer {
        height: 52vh;
        min-height: 320px;
      }

      header h1 {
        font-size: 23px;
      }

      .dimensions {
        gap: 6px;
      }
    }
  </style>
</head>

<body>
  <header>
    <h1>Vernier Caliper</h1>
  </header>

  <main>
    <section class="viewer-panel">
      <div id="viewer"></div>
      <div class="viewer-help">
        Drag to rotate · Pinch to zoom
      </div>
      <div id="status" role="status"></div>
    </section>

    <section class="section">
      <button
        id="otherObjectsButton"
        class="menu-button"
        aria-expanded="false"
        aria-controls="objectMenu"
      >
        <span>＋ Other Objects</span>
        <span id="menuArrow">⌄</span>
      </button>

      <div id="objectMenu">
        <button class="object-option" data-shape="sphere">Sphere</button>
        <button class="object-option" data-shape="cube">Cube</button>
        <button class="object-option" data-shape="cylinder">Cylinder</button>
        <button class="object-option" data-shape="cuboid">Cuboid</button>
        <button class="object-option" data-shape="cone">Cone</button>
      </div>
    </section>

    <section class="section">
      <h2>Object Dimensions (mm)</h2>

      <div class="dimensions">
        <div>
          <label id="labelA" for="dimensionA">Diameter</label>
          <input id="dimensionA" type="number"
                 min="1" max="100" step="1" value="6">
        </div>

        <div>
          <label id="labelB" for="dimensionB">Height</label>
          <input id="dimensionB" type="number"
                 min="1" max="100" step="1" value="6">
        </div>

        <div>
          <label id="labelC" for="dimensionC">Depth</label>
          <input id="dimensionC" type="number"
                 min="1" max="100" step="1" value="6">
        </div>
      </div>

      <div class="button-row">
        <button id="updateButton" class="primary">Update Size</button>
        <button id="removeButton">Remove Object</button>
      </div>
    </section>

    <section class="section">
      <h2>Measurement & Formula</h2>

      <div id="measurement" class="result-box">
        Select an object to begin.
      </div>

      <p class="muted">
        Vernier reading = Main scale reading +
        (Vernier coincidence × Least count).
      </p>

      <p class="muted">
        The displayed object dimensions are simulation values.
        They are not actual Vernier readings unless the model
        and measuring scale are calibrated.
      </p>
    </section>

    <div class="button-row">
      <button id="resetButton">Reset View</button>
    </div>

    <p class="coming-soon">
      More scientific instruments coming soon.
    </p>
  </main>

  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"
    }
  }
  </script>

  <script type="module" src="./script.js?v=10"></script>
</body>
</html>
