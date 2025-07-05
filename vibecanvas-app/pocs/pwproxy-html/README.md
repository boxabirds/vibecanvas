# Playwright HTML Proxy POC

This proof of concept demonstrates a Playwright-based proxy that captures rendered HTML from websites and serves it through an iframe, bypassing CORS restrictions.

## Features

- Headless Playwright browser captures fully rendered HTML from target sites
- Express server acts as a proxy for all network requests
- Iframe displays captured content with 80px top inset
- Click interception routes navigation through the proxy
- Network request interception and routing

## Setup

```bash
cd pocs/pwproxy-html
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## How it works

1. Playwright navigates to the target URL (Sky News by default)
2. Waits for network idle to ensure full page load
3. Captures the complete rendered HTML
4. Injects JavaScript to intercept clicks and route them through the proxy
5. Serves the HTML in an iframe with a custom proxy banner
6. All subsequent navigation and requests go through the Playwright instance

## Robustness Testing

The implementation includes:
- Error handling for navigation failures
- Loading states and status indicators
- Request logging for debugging
- Timeout handling for slow pages
- CORS bypass through proxy routing

## Limitations

- Some sites may detect headless browser usage
- Complex JavaScript interactions may not work perfectly
- Resource-intensive due to running a full browser instance
- Security implications of bypassing CORS should be considered