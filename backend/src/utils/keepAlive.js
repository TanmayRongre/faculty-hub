/**
 * keepAlive.js
 *
 * Automated Keep-Alive & Self-Ping Service for Render.com Free Tier.
 *
 * Prevents Render from putting the backend web service to sleep after 15 minutes
 * of inactivity by sending an automated health check ping every 13 minutes.
 */

const http = require('http');
const https = require('https');

function startKeepAlive() {
  const isProduction = process.env.NODE_ENV === 'production';
  const renderUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || process.env.SERVER_URL;
  const port = process.env.PORT || 5000;

  // Run ping every 13 minutes (780,000 ms) — safely before the 15-min idle cutoff
  const INTERVAL_MS = 13 * 60 * 1000;

  console.log(`[KeepAlive] Service initialized (Interval: 13 mins). Target: ${renderUrl || `http://localhost:${port}`}`);

  setInterval(() => {
    const targetUrl = renderUrl ? `${renderUrl.replace(/\/$/, '')}/api/health` : `http://localhost:${port}/api/health`;
    const isHttps = targetUrl.startsWith('https://');
    const client = isHttps ? https : http;

    try {
      const req = client.get(targetUrl, (res) => {
        if (res.statusCode === 200) {
          console.log(`[KeepAlive] Ping successful (${targetUrl}) at ${new Date().toISOString()}`);
        } else {
          console.warn(`[KeepAlive] Ping returned status ${res.statusCode} at ${new Date().toISOString()}`);
        }
      });

      req.on('error', (err) => {
        console.warn(`[KeepAlive] Ping failed: ${err.message}`);
      });

      req.setTimeout(15000, () => {
        req.destroy();
        console.warn('[KeepAlive] Ping timed out after 15s');
      });
    } catch (err) {
      console.warn(`[KeepAlive] Error during ping: ${err.message}`);
    }
  }, INTERVAL_MS);
}

module.exports = { startKeepAlive };
