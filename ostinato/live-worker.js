"use strict";

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";
const POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const PYTHON_ROOT = "/ostinato-web";

let runtime;
let frameInPython;
let commandInPython;
let poseLoad;
let lastPoseTimestamp = -1;
let frameCanvas;
let frameContext;
let pending = Promise.resolve();

async function fetchAsset(path) {
    const response = await fetch(new URL(path, self.location.href));
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
    return response;
}

async function startPython() {
    if (frameInPython && commandInPython) return;

    self.postMessage({ type: "status", status: "loading", message: "Loading the assessment engine…" });
    const sources = Promise.all([
        fetchAsset("live-core.json").then(response => response.json()),
        fetchAsset("live-engine.py").then(response => response.text()),
    ]);
    const boot = async () => {
        if (!runtime) {
            importScripts(`${PYODIDE_URL}pyodide.js`);
            runtime = await self.loadPyodide({ indexURL: PYODIDE_URL });
        }
        await runtime.loadPackage(["numpy", "scipy", "opencv-python"]);
    };
    const [[modules, adapter]] = await Promise.all([sources, boot()]);

    const moduleFolder = `${PYTHON_ROOT}/ostinato`;
    runtime.FS.mkdirTree(moduleFolder);
    runtime.FS.writeFile(`${moduleFolder}/__init__.py`, "");
    for (const filename of ["app.py", "breathing.py", "chest.py", "decision.py", "response.py"]) {
        if (typeof modules[filename] !== "string") throw new Error(`Missing Python source ${filename}.`);
        runtime.FS.writeFile(`${moduleFolder}/${filename}`, modules[filename]);
    }
    runtime.runPython(`import sys\nsys.path.insert(0, ${JSON.stringify(PYTHON_ROOT)})`);
    runtime.runPython(adapter, { filename: "live-engine.py" });

    const engine = runtime.globals.get("engine");
    try {
        // Attribute PyProxies are borrowed from the engine proxy.
        frameInPython = engine.frame.copy();
        commandInPython = engine.command.copy();
    } finally {
        engine.destroy();
    }
}

async function startPose() {
    if (typeof OffscreenCanvas === "undefined") {
        throw new Error("Camera tracking requires a browser with OffscreenCanvas support.");
    }
    if (!poseLoad) {
        self.postMessage({ type: "status", status: "camera-loading", message: "Loading pose tracking…" });
        poseLoad = (async () => {
            // Tasks Vision uses importScripts to load its WASM runtime inside the classic worker.
            const { FilesetResolver, PoseLandmarker } = await import(`${VISION_URL}/vision_bundle.mjs`);
            const vision = await FilesetResolver.forVisionTasks(`${VISION_URL}/wasm`);
            return PoseLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "CPU" },
                canvas: new OffscreenCanvas(1, 1),
                runningMode: "VIDEO",
                numPoses: 1,
            });
        })().catch(error => {
            poseLoad = undefined;
            throw new Error(`Could not load camera pose tracking. ${error?.message || String(error)}`);
        });
    }
    return poseLoad;
}

function processPixels(t, width, height, pixels, landmarks, sound = false) {
    const pythonPixels = runtime.toPy(pixels);
    let pythonLandmarks;
    try {
        pythonLandmarks = runtime.toPy(landmarks);
        return JSON.parse(frameInPython(t, width, height, pythonPixels, pythonLandmarks, sound));
    } finally {
        pythonLandmarks?.destroy();
        pythonPixels.destroy();
    }
}

async function processFrame({ t, bitmap, width, height, pixels, landmarks, sound }) {
    if (!bitmap) {
        const rgba = new Uint8Array(pixels);
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
            rgba.length !== width * height * 4 || !Array.isArray(landmarks)) {
            throw new Error("The sample frame is incomplete.");
        }
        return processPixels(t, width, height, rgba, landmarks);
    }

    const pose = await startPose();
    width = bitmap.width;
    height = bitmap.height;
    if (!frameCanvas) {
        frameCanvas = new OffscreenCanvas(width, height);
        frameContext = frameCanvas.getContext("2d", { alpha: false, willReadFrequently: true });
        if (!frameContext) throw new Error("Could not read camera pixels in this browser.");
    } else if (frameCanvas.width !== width || frameCanvas.height !== height) {
        frameCanvas.width = width;
        frameCanvas.height = height;
    }
    const timestamp = Math.max(lastPoseTimestamp + 1, Math.round(performance.now()));
    const result = pose.detectForVideo(bitmap, timestamp);
    lastPoseTimestamp = timestamp;
    landmarks = (result.landmarks[0] || []).map(({ x, y, visibility }) => [x, y, visibility ?? 0]);

    frameContext.drawImage(bitmap, 0, 0);
    const rgba = frameContext.getImageData(0, 0, width, height).data;
    return processPixels(t, width, height, new Uint8Array(rgba.buffer), landmarks, Boolean(sound));
}

async function handleMessage(message) {
    const { type, action, t, sound, camera, bitmap } = message;
    const request = { requestType: type, action, t };
    try {
        if (type === "init") {
            await startPython();
            self.postMessage({ type: "ready", state: JSON.parse(commandInPython(0, "snapshot")) });
            return;
        }

        if (!frameInPython || !commandInPython) throw new Error("The assessment engine is still loading.");
        if (!Number.isFinite(t) || t < 0) throw new Error("The session timestamp is invalid.");
        const state = type === "frame"
            ? await processFrame(message)
            : JSON.parse(commandInPython(t, action, Boolean(sound), Boolean(camera)));
        self.postMessage({ type: "state", ...request, state });
    } catch (error) {
        self.postMessage({ type: "error", ...request, message: error?.message || String(error) });
    } finally {
        if (bitmap) bitmap.close();
    }
}

self.addEventListener("message", ({ data }) => {
    if (data && ["init", "frame", "command"].includes(data.type)) {
        pending = pending.then(() => handleMessage(data));
    }
});
