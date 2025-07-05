const express = require('express');
const { chromium } = require('playwright');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

let browser;
let page;
let lastFrameTime = Date.now();
let frameCount = 0;
let fps = 0;

async function initBrowser(width = 1920, height = 1080) {
  browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width, height }
  });
  
  page = await context.newPage();
  await page.goto('https://bbc.co.uk');
  
  console.log(`Browser initialized with viewport ${width}x${height}, navigated to BBC`);
}

async function captureScreenshot() {
  const startTime = Date.now();
  const screenshot = await page.screenshot({ 
    type: 'png',
    fullPage: false
  });
  const captureTime = Date.now() - startTime;
  
  // FPS calculation
  frameCount++;
  const currentTime = Date.now();
  const timeDiff = currentTime - lastFrameTime;
  
  if (timeDiff >= 1000) {
    fps = Math.round((frameCount * 1000) / timeDiff);
    frameCount = 0;
    lastFrameTime = currentTime;
  }
  
  return {
    screenshot: screenshot.toString('base64'),
    captureTime,
    fps
  };
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  let screenshotInterval;
  let continuousMode = false;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      const startTime = Date.now();
      
      switch (data.type) {
        case 'init':
          if (!browser) {
            await initBrowser(data.width || 1920, data.height || 1080);
          } else if (data.width && data.height) {
            // Resize existing viewport if dimensions provided
            await page.setViewportSize({ width: data.width, height: data.height });
          }
          const initScreenshot = await captureScreenshot();
          ws.send(JSON.stringify({
            type: 'screenshot',
            data: initScreenshot.screenshot,
            captureTime: initScreenshot.captureTime,
            fps: initScreenshot.fps,
            totalTime: Date.now() - startTime
          }));
          break;
          
        case 'click':
          await page.mouse.click(data.x, data.y);
          const clickScreenshot = await captureScreenshot();
          ws.send(JSON.stringify({
            type: 'screenshot',
            data: clickScreenshot.screenshot,
            captureTime: clickScreenshot.captureTime,
            fps: clickScreenshot.fps,
            totalTime: Date.now() - startTime
          }));
          break;
          
        case 'mousedown':
          await page.mouse.down();
          continuousMode = true;
          if (screenshotInterval) clearInterval(screenshotInterval);
          screenshotInterval = setInterval(async () => {
            const screenshot = await captureScreenshot();
            ws.send(JSON.stringify({
              type: 'screenshot',
              data: screenshot.screenshot,
              captureTime: screenshot.captureTime,
              fps: screenshot.fps,
              totalTime: 0
            }));
          }, 33); // ~30fps target
          break;
          
        case 'mouseup':
          await page.mouse.up();
          continuousMode = false;
          if (screenshotInterval) {
            clearInterval(screenshotInterval);
            screenshotInterval = null;
          }
          const mouseupScreenshot = await captureScreenshot();
          ws.send(JSON.stringify({
            type: 'screenshot',
            data: mouseupScreenshot.screenshot,
            captureTime: mouseupScreenshot.captureTime,
            fps: mouseupScreenshot.fps,
            totalTime: Date.now() - startTime
          }));
          break;
          
        case 'mousemove':
          await page.mouse.move(data.x, data.y);
          if (!continuousMode) {
            const moveScreenshot = await captureScreenshot();
            ws.send(JSON.stringify({
              type: 'screenshot',
              data: moveScreenshot.screenshot,
              captureTime: moveScreenshot.captureTime,
              fps: moveScreenshot.fps,
              totalTime: Date.now() - startTime
            }));
          }
          break;
          
        case 'keypress':
          await page.keyboard.press(data.key);
          const keypressScreenshot = await captureScreenshot();
          ws.send(JSON.stringify({
            type: 'screenshot',
            data: keypressScreenshot.screenshot,
            captureTime: keypressScreenshot.captureTime,
            fps: keypressScreenshot.fps,
            totalTime: Date.now() - startTime
          }));
          break;
          
        case 'scroll':
          await page.mouse.wheel(0, data.deltaY);
          const scrollScreenshot = await captureScreenshot();
          ws.send(JSON.stringify({
            type: 'screenshot',
            data: scrollScreenshot.screenshot,
            captureTime: scrollScreenshot.captureTime,
            fps: scrollScreenshot.fps,
            totalTime: Date.now() - startTime
          }));
          break;
          
        case 'navigate':
          await page.goto(data.url);
          const navScreenshot = await captureScreenshot();
          ws.send(JSON.stringify({
            type: 'screenshot',
            data: navScreenshot.screenshot,
            captureTime: navScreenshot.captureTime,
            fps: navScreenshot.fps,
            totalTime: Date.now() - startTime
          }));
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    if (screenshotInterval) {
      clearInterval(screenshotInterval);
    }
  });
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (browser) {
    await browser.close();
  }
  process.exit();
});