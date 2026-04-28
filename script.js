import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/vision_bundle.mjs";

const MEDIAPIPE_WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const HAND_MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const optionButtons = document.querySelectorAll(".option-btn");
const panels = document.querySelectorAll(".panel");
const startButton = document.getElementById("start-camera");
const stopButton = document.getElementById("stop-camera");
const cameraFeed = document.getElementById("camera-feed");
const cameraPlaceholder = document.getElementById("camera-placeholder");
const cameraStatus = document.getElementById("camera-status");
const handOverlay = document.getElementById("hand-overlay");
const detectionPill = document.getElementById("detection-pill");
const handSummary = document.getElementById("hand-summary");
const overlayContext = handOverlay.getContext("2d");

let cameraStream = null;
let handLandmarker = null;
let handLandmarkerPromise = null;
let detectionFrameId = null;
let lastProcessedTime = -1;

function setDetectionState(pillText, summaryText) {
  detectionPill.textContent = pillText;
  handSummary.textContent = summaryText;
}

function scoreCameraLabel(label) {
  const normalizedLabel = label.toLowerCase();
  let score = 0;

  if (/(front|user|selfie|facetime)/.test(normalizedLabel)) {
    score += 5;
  }

  if (/(integrated|webcam|hd camera)/.test(normalizedLabel)) {
    score += 2;
  }

  if (/(back|rear|environment|telephoto|ultra)/.test(normalizedLabel)) {
    score -= 5;
  }

  return score;
}

async function ensureHandLandmarker() {
  if (handLandmarker) {
    return handLandmarker;
  }

  if (!handLandmarkerPromise) {
    setDetectionState("Loading detector...", "Preparing the hand detector for the live camera feed.");

    handLandmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT);

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: HAND_MODEL_PATH
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      setDetectionState(
        "Detector ready",
        "Show one or two hands to the camera to detect fingertips and palm landmarks."
      );

      return handLandmarker;
    })().catch((error) => {
      handLandmarkerPromise = null;
      handLandmarker = null;
      setDetectionState(
        "Detector failed",
        "The hand detector could not load. Check your internet connection and refresh the app."
      );
      throw error;
    });
  }

  return handLandmarkerPromise;
}

async function getPreferredFrontCameraStream() {
  const initialStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "user" }
    },
    audio: false
  });

  const currentTrack = initialStream.getVideoTracks()[0];
  const currentFacingMode = currentTrack.getSettings().facingMode;

  if (currentFacingMode === "user") {
    return initialStream;
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((device) => device.kind === "videoinput");

  if (videoInputs.length < 2) {
    return initialStream;
  }

  const preferredDevice = videoInputs
    .filter((device) => device.deviceId)
    .sort((left, right) => scoreCameraLabel(right.label) - scoreCameraLabel(left.label))[0];

  const currentScore = scoreCameraLabel(currentTrack.label || "");
  const preferredScore = preferredDevice ? scoreCameraLabel(preferredDevice.label || "") : -1;

  if (!preferredDevice || preferredScore <= currentScore) {
    return initialStream;
  }

  initialStream.getTracks().forEach((track) => track.stop());

  return navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: preferredDevice.deviceId }
    },
    audio: false
  });
}

function resizeOverlayCanvas() {
  const width = cameraFeed.clientWidth;
  const height = cameraFeed.clientHeight;

  if (!width || !height) {
    return;
  }

  const devicePixelRatio = window.devicePixelRatio || 1;
  handOverlay.width = Math.round(width * devicePixelRatio);
  handOverlay.height = Math.round(height * devicePixelRatio);
  handOverlay.style.width = `${width}px`;
  handOverlay.style.height = `${height}px`;
  overlayContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function clearOverlay() {
  overlayContext.clearRect(0, 0, handOverlay.clientWidth, handOverlay.clientHeight);
}

function drawConnection(startLandmark, endLandmark, color) {
  overlayContext.beginPath();
  overlayContext.moveTo(
    startLandmark.x * handOverlay.clientWidth,
    startLandmark.y * handOverlay.clientHeight
  );
  overlayContext.lineTo(
    endLandmark.x * handOverlay.clientWidth,
    endLandmark.y * handOverlay.clientHeight
  );
  overlayContext.strokeStyle = color;
  overlayContext.lineWidth = 2.2;
  overlayContext.stroke();
}

function drawLandmarkPoint(landmark, color) {
  overlayContext.beginPath();
  overlayContext.arc(
    landmark.x * handOverlay.clientWidth,
    landmark.y * handOverlay.clientHeight,
    4,
    0,
    Math.PI * 2
  );
  overlayContext.fillStyle = color;
  overlayContext.fill();
}

function drawHandLabel(landmarks, handedness, color) {
  const xCoordinates = landmarks.map((landmark) => landmark.x * handOverlay.clientWidth);
  const yCoordinates = landmarks.map((landmark) => landmark.y * handOverlay.clientHeight);
  const minX = Math.min(...xCoordinates);
  const minY = Math.min(...yCoordinates);
  const score = Math.round((handedness.score || 0) * 100);

  overlayContext.fillStyle = "rgba(16, 75, 113, 0.8)";
  overlayContext.fillRect(minX - 4, Math.max(8, minY - 28), 118, 24);
  overlayContext.fillStyle = color;
  overlayContext.font = '600 14px "Trebuchet MS", "Segoe UI", sans-serif';
  overlayContext.fillText(
    `${handedness.categoryName} hand ${score}%`,
    minX + 6,
    Math.max(24, minY - 10)
  );
}

function renderHandDetections(results) {
  clearOverlay();

  if (!results || !results.landmarks || results.landmarks.length === 0) {
    setDetectionState(
      "Looking for hands",
      "No hands detected right now. Hold your hand inside the camera frame."
    );
    return;
  }

  const handDescriptions = [];

  results.landmarks.forEach((landmarks, index) => {
    const handedness = results.handedness[index]?.[0] || {
      categoryName: "Hand",
      score: 0
    };
    const color = index === 0 ? "#0b88d9" : "#ffc857";

    HandLandmarker.HAND_CONNECTIONS.forEach((connection) => {
      drawConnection(landmarks[connection.start], landmarks[connection.end], color);
    });

    landmarks.forEach((landmark) => {
      drawLandmarkPoint(landmark, color);
    });

    drawHandLabel(landmarks, handedness, color);
    handDescriptions.push(
      `${handedness.categoryName} hand (${Math.round((handedness.score || 0) * 100)}%)`
    );
  });

  const handCount = results.landmarks.length;
  setDetectionState(
    `${handCount} hand${handCount > 1 ? "s" : ""} detected`,
    `Detected ${handCount} hand${handCount > 1 ? "s" : ""}: ${handDescriptions.join(", ")}.`
  );
}

function stopDetectionLoop() {
  if (detectionFrameId) {
    cancelAnimationFrame(detectionFrameId);
    detectionFrameId = null;
  }

  lastProcessedTime = -1;
  clearOverlay();
}

function runDetectionLoop() {
  if (!cameraStream || !handLandmarker || cameraFeed.readyState < 2) {
    detectionFrameId = requestAnimationFrame(runDetectionLoop);
    return;
  }

  if (cameraFeed.currentTime !== lastProcessedTime) {
    renderHandDetections(handLandmarker.detectForVideo(cameraFeed, performance.now()));
    lastProcessedTime = cameraFeed.currentTime;
  }

  detectionFrameId = requestAnimationFrame(runDetectionLoop);
}

function startDetectionLoop() {
  stopDetectionLoop();
  resizeOverlayCanvas();
  runDetectionLoop();
}

optionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.target;

    optionButtons.forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-selected", String(item === button));
    });

    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === targetId);
    });
  });
});

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = "Camera access is not supported in this browser.";
    return;
  }

  if (cameraStream) {
    cameraStatus.textContent = "Camera is already running with hand detection.";
    return;
  }

  try {
    cameraStatus.textContent = "Starting front camera...";
    cameraStream = await getPreferredFrontCameraStream();
    cameraFeed.srcObject = cameraStream;
    await cameraFeed.play();
    cameraPlaceholder.classList.add("hidden");
    resizeOverlayCanvas();

    await ensureHandLandmarker();
    startDetectionLoop();

    cameraStatus.textContent =
      "Front camera started successfully. Hand detection is now watching the live video.";
  } catch (error) {
    cameraStatus.textContent = "Unable to start the camera or hand detection. Please try again.";
    cameraPlaceholder.classList.remove("hidden");
    stopDetectionLoop();

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraFeed.srcObject = null;
      cameraStream = null;
    }

    console.error(error);
  }
}

function stopCamera() {
  if (!cameraStream) {
    cameraStatus.textContent = "Camera is already stopped.";
    setDetectionState(
      "Hand detection paused",
      "Start the camera to begin detecting hands in the live view."
    );
    return;
  }

  stopDetectionLoop();
  cameraStream.getTracks().forEach((track) => track.stop());
  cameraFeed.srcObject = null;
  cameraStream = null;
  cameraPlaceholder.classList.remove("hidden");
  cameraStatus.textContent = "Camera stopped.";
  setDetectionState(
    "Hand detection paused",
    "Start the camera to begin detecting hands in the live view."
  );
}

cameraFeed.addEventListener("loadedmetadata", resizeOverlayCanvas);
window.addEventListener("resize", resizeOverlayCanvas);
startButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", stopCamera);
window.addEventListener("beforeunload", stopCamera);
