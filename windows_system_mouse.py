from __future__ import annotations

import argparse
import ctypes
import sys
import threading
import time
import urllib.request
from pathlib import Path

LOCAL_PACKAGES_PATH = Path(__file__).resolve().parent / ".python-packages"

if LOCAL_PACKAGES_PATH.exists():
  sys.path.insert(0, str(LOCAL_PACKAGES_PATH))

try:
  import cv2
  import mediapipe as mp
  from mediapipe.tasks import python
  from mediapipe.tasks.python import vision
except ImportError as error:
  missing_package = str(error).split("'")[1] if "'" in str(error) else str(error)
  print(
    "Missing dependency:",
    missing_package,
    "\nInstall the requirements first with:\n"
    "  python -m pip install --target .python-packages -r requirements-system-mouse.txt",
    file=sys.stderr
  )
  raise


MODEL_URL = (
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
  "hand_landmarker/float16/1/hand_landmarker.task"
)
MODEL_PATH = Path(__file__).resolve().parent / "assets" / "models" / "hand_landmarker.task"
PREVIEW_WINDOW_NAME = "Gesture Mouse Controller"
HOTKEY_ID = 1
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
VK_Q = 0x51
WM_HOTKEY = 0x0312

user32 = ctypes.windll.user32


class POINT(ctypes.Structure):
  _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


class MSG(ctypes.Structure):
  _fields_ = [
    ("hwnd", ctypes.c_void_p),
    ("message", ctypes.c_uint),
    ("wParam", ctypes.c_size_t),
    ("lParam", ctypes.c_ssize_t),
    ("time", ctypes.c_uint),
    ("pt", POINT)
  ]


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Move the Windows mouse with your index fingertip."
  )
  parser.add_argument(
    "--background",
    action="store_true",
    help="Run without the preview window and keep the mouse controller in the background."
  )
  parser.add_argument(
    "--camera-index",
    type=int,
    default=0,
    help="Camera index to open. Default is 0."
  )
  return parser.parse_args()


def ensure_model() -> Path:
  MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

  if MODEL_PATH.exists():
    return MODEL_PATH

  print(f"Downloading MediaPipe hand model to {MODEL_PATH} ...")
  urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
  return MODEL_PATH


def start_hotkey_listener(stop_event: threading.Event) -> None:
  if not user32.RegisterHotKey(None, HOTKEY_ID, MOD_CONTROL | MOD_ALT, VK_Q):
    print("Warning: Ctrl+Alt+Q hotkey could not be registered.", file=sys.stderr)
    return

  message = MSG()

  try:
    while not stop_event.is_set():
      result = user32.GetMessageW(ctypes.byref(message), None, 0, 0)

      if result == 0 or result == -1:
        break

      if message.message == WM_HOTKEY and message.wParam == HOTKEY_ID:
        stop_event.set()
        break
  finally:
    user32.UnregisterHotKey(None, HOTKEY_ID)


def move_cursor(x_position: float, y_position: float) -> None:
  user32.SetCursorPos(int(round(x_position)), int(round(y_position)))


def draw_status(frame, text: str, line: int = 0) -> None:
  y_position = 30 + (line * 32)
  cv2.putText(
    frame,
    text,
    (18, y_position),
    cv2.FONT_HERSHEY_SIMPLEX,
    0.8,
    (255, 255, 255),
    2,
    cv2.LINE_AA
  )


def main() -> int:
  args = parse_args()
  stop_event = threading.Event()
  model_path = ensure_model()

  screen_width = user32.GetSystemMetrics(0)
  screen_height = user32.GetSystemMetrics(1)

  hotkey_thread = threading.Thread(
    target=start_hotkey_listener,
    args=(stop_event,),
    daemon=True
  )
  hotkey_thread.start()

  base_options = python.BaseOptions(model_asset_path=str(model_path))
  options = vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.VIDEO,
    num_hands=1,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5
  )

  camera_backend = cv2.CAP_DSHOW if hasattr(cv2, "CAP_DSHOW") else 0
  capture = cv2.VideoCapture(args.camera_index, camera_backend)

  if not capture.isOpened():
    print("Could not open the camera. Try a different --camera-index value.", file=sys.stderr)
    return 1

  smoothed_x = screen_width / 2
  smoothed_y = screen_height / 2
  smoothing_factor = 0.28

  print("Gesture mouse started.")
  print("Move your index fingertip to move the Windows cursor.")
  print("Press Ctrl+Alt+Q to stop.")

  with vision.HandLandmarker.create_from_options(options) as landmarker:
    while not stop_event.is_set():
      is_frame_ready, frame = capture.read()

      if not is_frame_ready:
        time.sleep(0.01)
        continue

      frame = cv2.flip(frame, 1)
      frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
      mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
      frame_timestamp_ms = int(time.time() * 1000)
      result = landmarker.detect_for_video(mp_image, frame_timestamp_ms)

      if result.hand_landmarks:
        hand_landmarks = result.hand_landmarks[0]
        index_tip = hand_landmarks[8]

        target_x = index_tip.x * screen_width
        target_y = index_tip.y * screen_height
        smoothed_x += (target_x - smoothed_x) * smoothing_factor
        smoothed_y += (target_y - smoothed_y) * smoothing_factor
        move_cursor(smoothed_x, smoothed_y)

        if not args.background:
          x_pixel = int(index_tip.x * frame.shape[1])
          y_pixel = int(index_tip.y * frame.shape[0])
          cv2.circle(frame, (x_pixel, y_pixel), 14, (0, 200, 255), -1)

          for landmark in hand_landmarks:
            point_x = int(landmark.x * frame.shape[1])
            point_y = int(landmark.y * frame.shape[0])
            cv2.circle(frame, (point_x, point_y), 5, (255, 180, 70), -1)

          handedness_label = "Hand"

          if result.handedness and result.handedness[0]:
            handedness_label = result.handedness[0][0].category_name

          draw_status(frame, f"{handedness_label} hand detected")
          draw_status(
            frame,
            f"Cursor: {int(smoothed_x)}, {int(smoothed_y)}",
            line=1
          )
      elif not args.background:
        draw_status(frame, "No hand detected")
        draw_status(frame, "Show your index finger to move the mouse", line=1)

      if not args.background:
        draw_status(frame, "Ctrl+Alt+Q or ESC to stop", line=2)
        cv2.imshow(PREVIEW_WINDOW_NAME, frame)

        if cv2.waitKey(1) & 0xFF == 27:
          stop_event.set()
          break

  capture.release()
  cv2.destroyAllWindows()
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
