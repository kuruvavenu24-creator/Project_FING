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

## Project Files

- `index.html` - app structure
- `styles.css` - sky blue theme and cloud animation
- `script.js` - tab switching and camera controls
- `server.js` - lightweight local server
- `start-windows.bat` - Windows launcher
