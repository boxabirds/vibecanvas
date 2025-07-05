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
let capturedHTML = '';
let resourceLogs = [];

async function initBrowser() {
  browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    bypassCSP: true
  });
  page = await context.newPage();
  
  // Log all network requests
  page.on('request', request => {
    resourceLogs.push({
      time: new Date().toISOString(),
      type: 'request',
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType()
    });
  });
  
  page.on('requestfailed', request => {
    const failure = request.failure();
    resourceLogs.push({
      time: new Date().toISOString(),
      type: 'failed',
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      error: failure ? failure.errorText : 'Unknown error'
    });
    console.error(`Failed: ${request.url()} - ${failure ? failure.errorText : 'Unknown'}`);
  });
  
  page.on('response', response => {
    resourceLogs.push({
      time: new Date().toISOString(),
      type: 'response',
      url: response.url(),
      status: response.status(),
      statusText: response.statusText()
    });
    if (response.status() >= 400) {
      console.warn(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
}

app.get('/capture', async (req, res) => {
  try {
    resourceLogs = []; // Clear previous logs
    console.log('Navigating to Sky News...');
    await page.goto('https://news.sky.com/uk', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    capturedHTML = await page.content();
    console.log('HTML captured successfully');
    
    // Rewrite all URLs in the HTML to go through our proxy
    let modifiedHTML = capturedHTML;
    
    // Replace all absolute URLs with proxied versions
    modifiedHTML = modifiedHTML.replace(
      /(?:href|src|srcset|data-src|data-srcset|action)=["']([^"']+)["']/gi,
      (match, url) => {
        // Skip data URIs, javascript:, and already proxied URLs
        if (url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('http://localhost')) {
          return match;
        }
        
        // Convert relative URLs to absolute
        let absoluteUrl = url;
        if (!url.startsWith('http')) {
          if (url.startsWith('//')) {
            absoluteUrl = 'https:' + url;
          } else if (url.startsWith('/')) {
            absoluteUrl = 'https://news.sky.com' + url;
          } else {
            absoluteUrl = 'https://news.sky.com/' + url;
          }
        }
        
        const proxiedUrl = `http://localhost:3000/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        return match.replace(url, proxiedUrl);
      }
    );
    
    // Also replace URLs in inline styles
    modifiedHTML = modifiedHTML.replace(
      /url\(["']?([^"')]+)["']?\)/gi,
      (match, url) => {
        if (url.startsWith('data:') || url.startsWith('http://localhost')) {
          return match;
        }
        
        let absoluteUrl = url;
        if (!url.startsWith('http')) {
          if (url.startsWith('//')) {
            absoluteUrl = 'https:' + url;
          } else if (url.startsWith('/')) {
            absoluteUrl = 'https://news.sky.com' + url;
          } else {
            absoluteUrl = 'https://news.sky.com/' + url;
          }
        }
        
        return `url(http://localhost:3000/proxy?url=${encodeURIComponent(absoluteUrl)})`;
      }
    );
    
    // Replace import statements in scripts
    modifiedHTML = modifiedHTML.replace(
      /import\s+(.+?)\s+from\s+["']([^"']+)["']/g,
      (match, imports, path) => {
        if (path.startsWith('http://localhost')) {
          return match;
        }
        
        let absoluteUrl = path;
        if (!path.startsWith('http')) {
          if (path.startsWith('//')) {
            absoluteUrl = 'https:' + path;
          } else if (path.startsWith('/')) {
            absoluteUrl = 'https://news.sky.com' + path;
          } else {
            absoluteUrl = 'https://news.sky.com/' + path;
          }
        }
        
        return `import ${imports} from "http://localhost:3000/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
      }
    );
    
    // Add our navigation and fetch interceptors
    modifiedHTML = modifiedHTML.replace(
      /<head>/i,
      `<head>
        <script>
          // Store the original location for proper URL resolution
          window.__originalLocation = 'https://news.sky.com/uk';
          
          // Helper to resolve URLs
          function resolveUrl(url) {
            if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) {
              return url;
            }
            if (url.startsWith('http://localhost')) {
              return url;
            }
            
            try {
              // Handle absolute URLs
              if (url.startsWith('http://') || url.startsWith('https://')) {
                return 'http://localhost:3000/proxy?url=' + encodeURIComponent(url);
              }
              
              // Try to resolve against the original URL
              const resolved = new URL(url, window.__originalLocation).href;
              return 'http://localhost:3000/proxy?url=' + encodeURIComponent(resolved);
            } catch (e) {
              // Fallback for malformed URLs
              if (url.startsWith('//')) {
                return 'http://localhost:3000/proxy?url=' + encodeURIComponent('https:' + url);
              } else if (url.startsWith('/')) {
                const base = new URL(window.__originalLocation).origin;
                return 'http://localhost:3000/proxy?url=' + encodeURIComponent(base + url);
              }
              // For relative paths without leading slash
              const base = window.__originalLocation.endsWith('/') 
                ? window.__originalLocation 
                : window.__originalLocation + '/';
              return 'http://localhost:3000/proxy?url=' + encodeURIComponent(base + url);
            }
          }
          
          // Intercept dynamic imports
          const originalImport = window.import || function() {};
          if (typeof window.import === 'function') {
            window.import = function(url) {
              return originalImport(resolveUrl(url));
            };
          }
          
          window.addEventListener('load', function() {
            // Intercept clicks
            document.addEventListener('click', function(e) {
              const link = e.target.closest('a');
              if (link && link.href) {
                e.preventDefault();
                const originalUrl = link.href.includes('localhost:3000/proxy?url=') 
                  ? decodeURIComponent(link.href.split('url=')[1])
                  : link.href;
                window.parent.postMessage({
                  type: 'navigate',
                  url: originalUrl
                }, '*');
              }
            });
            
            // Intercept fetch
            const originalFetch = window.fetch;
            window.fetch = function(url, ...args) {
              return originalFetch.call(this, resolveUrl(url), ...args);
            };
            
            // Intercept XMLHttpRequest
            const OriginalXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
              const xhr = new OriginalXHR();
              const originalOpen = xhr.open;
              xhr.open = function(method, url, ...args) {
                return originalOpen.call(this, method, resolveUrl(url), ...args);
              };
              return xhr;
            };
          });
        </script>`
    );
    
    res.json({ success: true, html: modifiedHTML });
  } catch (error) {
    console.error('Error capturing page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle CORS preflight
app.options('/proxy', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.status(200).end();
});

app.get('/proxy', async (req, res) => {
  let targetUrl;
  try {
    targetUrl = decodeURIComponent(req.query.url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL parameter' });
  }
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    console.log(`Proxying request to: ${targetUrl}`);
    
    // For binary content, we need to handle it differently
    const response = await page.evaluate(async (url) => {
      try {
        const resp = await fetch(url, {
          credentials: 'include',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!resp.ok && resp.status === 404) {
          return {
            status: 404,
            headers: {'content-type': 'text/plain'},
            body: 'Not Found',
            isBinary: false
          };
        }
        
        const contentType = resp.headers.get('content-type') || '';
        
        // Check if it's binary content
        const isBinary = contentType.includes('image') || 
                        contentType.includes('video') || 
                        contentType.includes('audio') ||
                        contentType.includes('font') ||
                        contentType.includes('application/octet-stream') ||
                        contentType.includes('application/pdf');
        
        if (isBinary) {
          const blob = await resp.blob();
          const buffer = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          return {
            status: resp.status,
            headers: Object.fromEntries([...resp.headers.entries()]),
            body: base64,
            isBinary: true
          };
        } else {
          const text = await resp.text();
          return {
            status: resp.status,
            headers: Object.fromEntries([...resp.headers.entries()]),
            body: text,
            isBinary: false
          };
        }
      } catch (error) {
        console.error('Fetch error in browser:', error);
        return {
          status: 500,
          headers: {'content-type': 'text/plain'},
          body: error.message,
          isBinary: false
        };
      }
    }, targetUrl);
    
    // Set headers
    Object.entries(response.headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      // Skip headers that might cause issues
      if (lowerKey !== 'content-encoding' && 
          lowerKey !== 'content-length' &&
          lowerKey !== 'transfer-encoding' &&
          lowerKey !== 'connection') {
        res.setHeader(key, value);
      }
    });
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    // Ensure proper content-type for known extensions if missing
    if (!response.headers['content-type'] && targetUrl) {
      const ext = targetUrl.split('.').pop().toLowerCase();
      const mimeTypes = {
        'js': 'application/javascript',
        'css': 'text/css',
        'json': 'application/json',
        'html': 'text/html',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf'
      };
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      }
    }
    
    if (response.isBinary) {
      const buffer = Buffer.from(response.body, 'base64');
      res.status(response.status).send(buffer);
    } else {
      res.status(response.status).send(response.body);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy Error: ' + error.message);
  }
});

app.post('/navigate', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }

  try {
    resourceLogs = []; // Clear previous logs
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const html = await page.content();
    
    // Rewrite all URLs in the HTML to go through our proxy
    let modifiedHTML = html;
    const baseUrl = new URL(url);
    
    // Replace all absolute URLs with proxied versions
    modifiedHTML = modifiedHTML.replace(
      /(?:href|src|srcset|data-src|data-srcset|action)=["']([^"']+)["']/gi,
      (match, urlAttr) => {
        // Skip data URIs, javascript:, and already proxied URLs
        if (urlAttr.startsWith('data:') || urlAttr.startsWith('javascript:') || urlAttr.startsWith('http://localhost')) {
          return match;
        }
        
        // Convert relative URLs to absolute
        let absoluteUrl = urlAttr;
        if (!urlAttr.startsWith('http')) {
          if (urlAttr.startsWith('//')) {
            absoluteUrl = baseUrl.protocol + urlAttr;
          } else if (urlAttr.startsWith('/')) {
            absoluteUrl = baseUrl.origin + urlAttr;
          } else {
            absoluteUrl = baseUrl.origin + '/' + urlAttr;
          }
        }
        
        const proxiedUrl = `http://localhost:3000/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        return match.replace(urlAttr, proxiedUrl);
      }
    );
    
    // Also replace URLs in inline styles
    modifiedHTML = modifiedHTML.replace(
      /url\(["']?([^"')]+)["']?\)/gi,
      (match, urlAttr) => {
        if (urlAttr.startsWith('data:') || urlAttr.startsWith('http://localhost')) {
          return match;
        }
        
        let absoluteUrl = urlAttr;
        if (!urlAttr.startsWith('http')) {
          if (urlAttr.startsWith('//')) {
            absoluteUrl = baseUrl.protocol + urlAttr;
          } else if (urlAttr.startsWith('/')) {
            absoluteUrl = baseUrl.origin + urlAttr;
          } else {
            absoluteUrl = baseUrl.origin + '/' + urlAttr;
          }
        }
        
        return `url(http://localhost:3000/proxy?url=${encodeURIComponent(absoluteUrl)})`;
      }
    );
    
    // Replace import statements in scripts
    modifiedHTML = modifiedHTML.replace(
      /import\s+(.+?)\s+from\s+["']([^"']+)["']/g,
      (match, imports, path) => {
        if (path.startsWith('http://localhost')) {
          return match;
        }
        
        let absoluteUrl = path;
        if (!path.startsWith('http')) {
          if (path.startsWith('//')) {
            absoluteUrl = 'https:' + path;
          } else if (path.startsWith('/')) {
            absoluteUrl = 'https://news.sky.com' + path;
          } else {
            absoluteUrl = 'https://news.sky.com/' + path;
          }
        }
        
        return `import ${imports} from "http://localhost:3000/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
      }
    );
    
    // Add our navigation and fetch interceptors
    modifiedHTML = modifiedHTML.replace(
      /<head>/i,
      `<head>
        <script>
          // Store the original location for proper URL resolution
          window.__originalLocation = 'https://news.sky.com/uk';
          
          // Helper to resolve URLs
          function resolveUrl(url) {
            if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) {
              return url;
            }
            if (url.startsWith('http://localhost')) {
              return url;
            }
            
            try {
              // Handle absolute URLs
              if (url.startsWith('http://') || url.startsWith('https://')) {
                return 'http://localhost:3000/proxy?url=' + encodeURIComponent(url);
              }
              
              // Try to resolve against the original URL
              const resolved = new URL(url, window.__originalLocation).href;
              return 'http://localhost:3000/proxy?url=' + encodeURIComponent(resolved);
            } catch (e) {
              // Fallback for malformed URLs
              if (url.startsWith('//')) {
                return 'http://localhost:3000/proxy?url=' + encodeURIComponent('https:' + url);
              } else if (url.startsWith('/')) {
                const base = new URL(window.__originalLocation).origin;
                return 'http://localhost:3000/proxy?url=' + encodeURIComponent(base + url);
              }
              // For relative paths without leading slash
              const base = window.__originalLocation.endsWith('/') 
                ? window.__originalLocation 
                : window.__originalLocation + '/';
              return 'http://localhost:3000/proxy?url=' + encodeURIComponent(base + url);
            }
          }
          
          // Intercept dynamic imports
          const originalImport = window.import || function() {};
          if (typeof window.import === 'function') {
            window.import = function(url) {
              return originalImport(resolveUrl(url));
            };
          }
          
          window.addEventListener('load', function() {
            // Intercept clicks
            document.addEventListener('click', function(e) {
              const link = e.target.closest('a');
              if (link && link.href) {
                e.preventDefault();
                const originalUrl = link.href.includes('localhost:3000/proxy?url=') 
                  ? decodeURIComponent(link.href.split('url=')[1])
                  : link.href;
                window.parent.postMessage({
                  type: 'navigate',
                  url: originalUrl
                }, '*');
              }
            });
            
            // Intercept fetch
            const originalFetch = window.fetch;
            window.fetch = function(url, ...args) {
              return originalFetch.call(this, resolveUrl(url), ...args);
            };
            
            // Intercept XMLHttpRequest
            const OriginalXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
              const xhr = new OriginalXHR();
              const originalOpen = xhr.open;
              xhr.open = function(method, url, ...args) {
                return originalOpen.call(this, method, resolveUrl(url), ...args);
              };
              return xhr;
            };
          });
        </script>`
    );
    
    res.json({ success: true, html: modifiedHTML });
  } catch (error) {
    console.error('Navigation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/logs', (req, res) => {
  const failed = resourceLogs.filter(log => log.type === 'failed');
  const errors = resourceLogs.filter(log => log.type === 'response' && log.status >= 400);
  
  res.json({
    total: resourceLogs.length,
    failed: failed.length,
    errors: errors.length,
    failedResources: failed,
    errorResponses: errors,
    allLogs: resourceLogs
  });
});

app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  await initBrowser();
  console.log('Browser initialized');
});

process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit();
});