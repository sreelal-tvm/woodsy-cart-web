import { effect, inject, provideAppInitializer } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { SiteSettings } from './models';
import { AuthService, SiteService } from './store';

const VISITOR_KEY = 'wc_vid';
const VISIT_KEY = 'wc_visit';
/** Set from Admin → Visitors ("Don't count this device"): ?wc_nostats=1 switches counting off on this browser, 0 back on. */
const SKIP_KEY = 'wc_nostats';
const VISIT_GAP = 30 * 60_000;
const TICK = 60_000;
const RECHECK = 5 * 60_000;

/**
 * Visitor statistics for Admin → Visitors: checks in when the site opens and once a minute while it is on screen,
 * with a random visitor ID, where the visitor came from and the seconds on screen. No pages, location or IP are sent.
 * Stops when Admin switches it off; looks again (at most every 5 minutes) when the visitor opens a page or comes back.
 */
export function provideVisitStats() {
  return provideAppInitializer(() => {
    if (!storageWorks()) return;
    const skip = new URLSearchParams(location.search).get(SKIP_KEY);
    if (skip === '1') localStorage.setItem(SKIP_KEY, '1');
    if (skip === '0') localStorage.removeItem(SKIP_KEY);
    if (localStorage.getItem(SKIP_KEY) === '1') return;

    const tracker = new Tracker(inject(AuthService), inject(ApiService));
    const site = inject(SiteService);
    const started = effect(() => {
      const s = site.settings();
      if (!s) return;
      started.destroy();
      tracker.init(s);
    });
    inject(Router).events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => tracker.recheck());
  });
}

class Tracker {
  private on = false;
  private visitorId = visitor();
  /** Where this page load came from; only the first visit it starts gets it (a later one is "direct"). */
  private source: string | null = landingSource();
  private visibleSince = 0;
  private pendingMs = 0;
  private timer = 0;
  private busy = false;
  private checkedAt = 0;

  constructor(private auth: AuthService, private api: ApiService) {
    document.addEventListener('visibilitychange', () => this.visibility());
  }

  init(s: SiteSettings) {
    this.checkedAt = Date.now();
    if (s.visitStats) this.start();
  }

  /** Switched off earlier: see whether Admin switched it back on (the settings are cached on the server, so this is cheap). */
  recheck() {
    if (this.on || Date.now() - this.checkedAt < RECHECK) return;
    this.checkedAt = Date.now();
    this.api.get<SiteSettings>('site/settings').subscribe({ next: s => { if (s.visitStats && !this.on) this.start(); }, error: () => {} });
  }

  private start() {
    this.on = true;
    this.pendingMs = 0;
    if (document.visibilityState === 'visible') this.resume();
  }

  private stop() {
    this.on = false;
    clearInterval(this.timer);
    this.checkedAt = Date.now();
  }

  private resume() {
    this.visibleSince = Date.now();
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), TICK);
    this.send(false);
  }

  private tick() {
    const now = Date.now();
    this.pendingMs += now - this.visibleSince;
    this.visibleSince = now;
    this.send(false);
  }

  private visibility() {
    if (!this.on) { if (document.visibilityState === 'visible') this.recheck(); return; }
    if (document.visibilityState === 'visible') return this.resume();
    // Hidden (other app, other tab, phone locked): stop counting and send the time so far
    clearInterval(this.timer);
    this.pendingMs += Date.now() - this.visibleSince;
    this.send(true);
  }

  private send(leaving: boolean) {
    if (this.busy && !leaving) return;
    const last = current();
    const seconds = Math.round(this.pendingMs / 1000);
    this.pendingMs = 0;
    const body = { visitorId: this.visitorId, visitId: last?.id ?? null, seconds, source: last ? null : (this.source ?? 'direct') };
    if (!last) this.source = null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.auth.isLoggedIn() ? this.auth.token() : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    this.busy = true;
    fetch(`${environment.apiUrl}/api/site/visit`, { method: 'POST', headers, body: JSON.stringify(body), keepalive: leaving })
      .then(r => (r.ok ? r.json() : null))
      .then((r: { visitId: number | null; on: boolean } | null) => {
        if (!r) return;
        if (!r.on) { this.stop(); return; }
        if (r.visitId) save({ id: r.visitId, at: Date.now() });
      })
      .catch(() => {})
      .finally(() => (this.busy = false));
  }
}

function storageWorks() {
  try { localStorage.setItem('wc_t', '1'); localStorage.removeItem('wc_t'); return true; } catch { return false; }
}

function visitor(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = crypto.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

/** The visit still running on this browser (shared by its tabs), or null after 30 minutes without activity. */
function current(): { id: number; at: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(VISIT_KEY) ?? 'null');
    return v && Date.now() - v.at < VISIT_GAP ? v : null;
  } catch { return null; }
}

function save(v: { id: number; at: number }) {
  try { localStorage.setItem(VISIT_KEY, JSON.stringify(v)); } catch { /* not remembered */ }
}

/** instagram, facebook, threads, google-ads, google, other or direct, from link tags, ad click IDs, the in-app browser and the referring site. */
function landingSource(): string {
  const q = new URLSearchParams(location.search);
  const utm = (q.get('utm_source') ?? '').toLowerCase();
  const medium = (q.get('utm_medium') ?? '').toLowerCase();
  const ua = navigator.userAgent;
  let ref = '';
  try { ref = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ''; } catch { /* no referrer */ }
  if (ref === location.hostname) ref = '';

  if (utm) {
    if (utm.includes('insta') || utm === 'ig') return 'instagram';
    if (utm.includes('threads')) return 'threads';
    if (utm.includes('facebook') || utm === 'fb' || utm === 'meta') return 'facebook';
    if (utm.includes('google')) return q.has('gclid') || ['cpc', 'ppc', 'paid', 'ads'].includes(medium) ? 'google-ads' : 'google';
    return 'other';
  }
  if (q.has('gclid') || q.has('gbraid') || q.has('wbraid')) return 'google-ads';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/Barcelona|Threads/i.test(ua) || /(^|\.)threads\.(net|com)$/.test(ref)) return 'threads';
  if (/FBAN|FBAV|FB_IAB/.test(ua) || q.has('fbclid') || /(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(ref)) return 'facebook';
  if (/(^|\.)instagram\.com$/.test(ref)) return 'instagram';
  if (/(^|\.)google\./.test(ref)) return 'google';
  return ref ? 'other' : 'direct';
}
