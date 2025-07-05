const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let browser;
let page;

async function initBrowser() {
  browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-web-security']
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    bypassCSP: true
  });
  page = await context.newPage();
  
  // Set a real user agent
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
}

// Simple approach: serve the page directly without URL rewriting
app.get('/capture-simple', async (req, res) => {
  try {
    console.log('Navigating to Sky News...');
    
    // Navigate and wait for page to load
    await page.goto('https://news.sky.com/uk', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait a bit more for dynamic content
    await page.waitForTimeout(2000);
    
    // Get the HTML content
    const html = await page.content();
    
    // Send the HTML as-is
    res.send(html);
  } catch (error) {
    console.error('Error capturing page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Alternative: use page.screenshot for visual capture
app.get('/screenshot', async (req, res) => {
  try {
    await page.goto('https://news.sky.com/uk', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    const screenshot = await page.screenshot({ 
      fullPage: true,
      type: 'png'
    });
    
    res.setHeader('Content-Type', 'image/png');
    res.send(screenshot);
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`Simple server running at http://localhost:${PORT}`);
  await initBrowser();
  console.log('Browser initialized');
});

process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit();
});