import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

/**
 * The server addresses live in config.json next to index.html, so the same build runs on localhost or the live
 * domain: after deploying, edit config.json only (no rebuild).
 */
fetch('config.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error(`config.json: HTTP ${r.status}`); return r.json(); })
  .then((cfg: Record<string, string>) => {
    for (const [k, v] of Object.entries(cfg)) if (typeof v === 'string') (environment as Record<string, unknown>)[k] = v.trim().replace(/\/+$/, '');
    if (!environment.apiUrl) throw new Error('config.json has no "apiUrl"');
    try { sessionStorage.removeItem('wc-config-retry'); } catch { /* ignore */ }
    return bootstrapApplication(App, appConfig);
  })
  .catch(err => {
    console.error(err);
    // An expired Cloudflare Access login redirects config.json to the login page; a full reload shows that page.
    // Reload once only, so a real outage doesn't loop.
    try {
      if (!sessionStorage.getItem('wc-config-retry')) {
        sessionStorage.setItem('wc-config-retry', '1');
        location.reload();
        return;
      }
      sessionStorage.removeItem('wc-config-retry');
    } catch { /* storage blocked: show the message */ }
    document.body.innerHTML = '<p style="font-family:system-ui,sans-serif;padding:2rem;max-width:32rem">Sorry, the site could not start. Please refresh in a minute.</p>';
  });
