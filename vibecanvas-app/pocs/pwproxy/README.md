# Playwright Proxy POC

A proof-of-concept that allows remote control of a headless Playwright browser through a canvas-based web interface.

## Features

- Headless Playwright browser running and navigating to BBC.co.uk
- Full-screen canvas displaying browser screenshots
- Mouse interaction (click, drag, scroll)
- Keyboard input support
- Real-time FPS measurement for:
  - Server-side screenshot capture rate
  - Client-side render rate
  - Round-trip latency

## Setup

```bash
cd pocs/pwproxy
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## Performance Metrics

The interface displays:
- **FPS**: Server-side screenshot capture framerate
- **Capture Time**: Time to capture a screenshot in Playwright
- **Round Trip**: Total time from user input to canvas update
- **Render FPS**: Client-side canvas rendering framerate

## Architecture

- **Server**: Express + WebSocket server managing Playwright instance
- **Client**: HTML5 Canvas with WebSocket connection
- **Protocol**: JSON messages over WebSocket for all interactions
- **Optimization**: JPEG compression (quality 80) for fast screenshot transfer