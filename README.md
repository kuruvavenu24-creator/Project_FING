# Sky Camera App

A simple sky-themed web app with two main options:

- `Camera` to open a live browser camera preview
- `About` to show a short description of the app

## Preview

![Sky Camera App Preview](assets/sky-camera-preview.png)

## Features

- Sky blue interface with a soft glass-style card
- Light animated clouds moving across the background
- Camera start and stop controls
- Friendly status messages for camera access
- Responsive layout for desktop and mobile

## Run Locally

1. Make sure you have Node.js installed.
2. Start the local server:

```bash
npm start
```

3. Open this URL in your browser:

```text
http://127.0.0.1:3000
```

## Windows Support

This app works on Windows 10 and Windows 11.

- Run `npm start` in Command Prompt or PowerShell
- Or double-click `start-windows.bat` to start the server and open the app in your browser
- Use Microsoft Edge or Google Chrome and allow camera permission when prompted

## Notes

- Camera access works best on `localhost` or `https`
- Allow browser camera permission when prompted

## System-Wide Windows Gesture Mouse

The browser app can move an on-screen pointer inside the page, but Windows-wide mouse control needs a native helper.

- Run `start-system-mouse.bat` to start the Windows gesture mouse with a preview window
- Run `start-system-mouse-background.bat` to keep it running in the background for other apps
- Press `Ctrl + Alt + Q` to stop the gesture mouse
- The launcher stores Python packages inside the project folder at `.python-packages`
- The first run downloads the hand-landmarker model into `assets/models`
- If you have multiple cameras, edit `windows_system_mouse.py` or pass another `--camera-index`

### Files for Windows Gesture Mouse

- `windows_system_mouse.py` - native Windows cursor controller using your index fingertip
- `requirements-system-mouse.txt` - Python dependencies for the system-wide mouse
- `start-system-mouse.bat` - launch with preview
- `start-system-mouse-background.bat` - launch in background mode

## Project Files

- `index.html` - app structure
- `styles.css` - sky blue theme and cloud animation
- `script.js` - tab switching and camera controls
- `server.js` - lightweight local server
- `start-windows.bat` - Windows launcher
