const optionButtons = document.querySelectorAll(".option-btn");
const panels = document.querySelectorAll(".panel");
const startButton = document.getElementById("start-camera");
const stopButton = document.getElementById("stop-camera");
const cameraFeed = document.getElementById("camera-feed");
const cameraPlaceholder = document.getElementById("camera-placeholder");
const cameraStatus = document.getElementById("camera-status");

let cameraStream = null;

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
    cameraStatus.textContent = "Camera is already running.";
    return;
  }

  try {
    cameraStream = await getPreferredFrontCameraStream();

    cameraFeed.srcObject = cameraStream;
    cameraPlaceholder.classList.add("hidden");
    cameraStatus.textContent = "Front camera started successfully.";
  } catch (error) {
    cameraStatus.textContent = "Unable to access the camera. Please allow permission and try again.";
    cameraPlaceholder.classList.remove("hidden");
    console.error(error);
  }
}

function stopCamera() {
  if (!cameraStream) {
    cameraStatus.textContent = "Camera is already stopped.";
    return;
  }

  cameraStream.getTracks().forEach((track) => track.stop());
  cameraFeed.srcObject = null;
  cameraStream = null;
  cameraPlaceholder.classList.remove("hidden");
  cameraStatus.textContent = "Camera stopped.";
}

startButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", stopCamera);

window.addEventListener("beforeunload", stopCamera);
