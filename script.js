const optionButtons = document.querySelectorAll(".option-btn");
const panels = document.querySelectorAll(".panel");
const startButton = document.getElementById("start-camera");
const stopButton = document.getElementById("stop-camera");
const cameraFeed = document.getElementById("camera-feed");
const cameraPlaceholder = document.getElementById("camera-placeholder");
const cameraStatus = document.getElementById("camera-status");

let cameraStream = null;

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
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    cameraFeed.srcObject = cameraStream;
    cameraPlaceholder.classList.add("hidden");
    cameraStatus.textContent = "Camera started successfully.";
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
