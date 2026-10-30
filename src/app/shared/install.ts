import { Component, DestroyRef, Injectable, ViewEncapsulation, computed, effect, inject, isDevMode, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ToastService } from '../core/toast.service';

/** How this phone's browser installs the site. 'prompt' = the browser's own install dialog (Chrome / Edge / Samsung on Android). */
export type InstallKind = 'prompt' | 'ios-safari' | 'ios-other' | 'android' | 'samsung' | 'firefox' | 'in-app';

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; }

const SNOOZE_KEY = 'wc_install_snooze';
const SNOOZE_DAYS = 14;

/** "Install the app" for phone visitors: keeps the browser's install event and works out which steps to show. */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private toast = inject(ToastService);
  private deferred = signal<InstallEvent | null>(null);
  private installedNow = signal(false);
  /** The tutorial is open. */
  readonly open = signal(false);

  readonly ua = navigator.userAgent;
  readonly ios = /iPhone|iPad|iPod/.test(this.ua) || (/Macintosh/.test(this.ua) && navigator.maxTouchPoints > 1);
  readonly android = /Android/.test(this.ua);
  /** Instagram, Facebook, Threads and other apps' own browsers can't install sites. */
  readonly inAppName = /Instagram/.test(this.ua) ? 'Instagram' : /FBAN|FBAV|FB_IAB/.test(this.ua) ? 'Facebook' : /Barcelona/.test(this.ua) ? 'Threads'
    : /; wv\)|Snapchat|Line\//.test(this.ua) ? 'this app' : '';
  private standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  /** Dev only: ?install=ios-safari etc. shows that browser's steps on a computer. */
  readonly debug = isDevMode() && new URLSearchParams(location.search).has('install');
  private debugKind = isDevMode() ? new URLSearchParams(location.search).get('install') as InstallKind | null : null;

  /** A phone browser that isn't the installed app. */
  readonly eligible = computed(() => !!this.debugKind || (!this.standalone && !this.installedNow() && (this.ios || this.android)));

  readonly kind = computed<InstallKind>(() => {
    if (this.debugKind) return this.debugKind;
    if (this.inAppName) return 'in-app';
    if (this.deferred()) return 'prompt';
    if (this.ios) return /CriOS|FxiOS|EdgiOS/.test(this.ua) ? 'ios-other' : 'ios-safari';
    if (/SamsungBrowser/.test(this.ua)) return 'samsung';
    if (/Firefox/.test(this.ua)) return 'firefox';
    return 'android';
  });

  constructor() {
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.deferred.set(e as InstallEvent); });
    addEventListener('appinstalled', () => { this.installedNow.set(true); this.deferred.set(null); this.open.set(false); });
  }

  /** The Install button: the browser's own dialog when it offers one, otherwise the steps. */
  async install() {
    const e = this.deferred();
    if (!e || this.debugKind) { this.open.set(true); return; }
    await e.prompt();
    const { outcome } = await e.userChoice;
    this.deferred.set(null); // the browser's event works once
    if (outcome === 'accepted') { this.installedNow.set(true); this.toast.success('WoodsyCart is on your home screen'); }
  }

  snoozed() {
    try { return Date.now() < Number(localStorage.getItem(SNOOZE_KEY) ?? 0); } catch { return false; }
  }

  snooze() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000)); } catch { /* private mode: only this visit */ }
  }
}

/**
 * Floating "Get the WoodsyCart app" card for phone visitors after 15 seconds on the site, plus the tutorial with this
 * browser's steps and an arrow at the button they need. Not on cart, checkout, order or sign-in pages.
 * "Not now" hides the card for 14 days; the menu's "Install the app" opens the tutorial any time.
 */
@Component({
  selector: 'wc-install',
  encapsulation: ViewEncapsulation.None, // the steps' button pictures come in as HTML; every class starts with ins-
  styles: [`
    wc-install { display: contents; }
    .ins-card { position: fixed; left: .75rem; right: .75rem; bottom: calc(var(--wc-nav-h, 3.6rem) + 1rem); z-index: 1045; max-width: 26rem; margin: 0 auto;
      background: var(--wc-surface); border: 1px solid var(--wc-border-strong); border-radius: 1rem; padding: .85rem .9rem;
      box-shadow: 0 .75rem 2rem rgba(42, 33, 28, .22); display: flex; gap: .75rem; align-items: center; animation: ins-up .35s ease-out; }
    body.has-sticky-buy .ins-card { bottom: calc(var(--wc-nav-h, 3.6rem) + var(--wc-buy-h, 3.65rem) + .75rem); } /* product page: above "Buy now" */
    .ins-icon { width: 3rem; height: 3rem; border-radius: .8rem; flex: none; box-shadow: 0 2px 8px rgba(154, 82, 38, .3); }
    .ins-title { font-weight: 800; color: var(--bs-emphasis-color); line-height: 1.2; }
    .ins-sub { font-size: .78rem; color: var(--wc-muted); line-height: 1.3; margin-top: .15rem; }
    .ins-x { position: absolute; top: .3rem; right: .45rem; background: none; border: 0; color: var(--wc-quiet); font-size: 1.1rem; line-height: 1; padding: .2rem; }
    .ins-btn { border-radius: 2rem; font-weight: 800; white-space: nowrap; padding: .45rem 1rem; }
    .ins-backdrop { position: fixed; inset: 0; z-index: 2100; background: rgba(42, 33, 28, .55); animation: ins-fade .2s ease-out; }
    .ins-sheet { position: fixed; left: 1rem; right: 1rem; top: 50%; transform: translateY(-50%); z-index: 2101; max-width: 24rem; margin: 0 auto;
      background: var(--wc-surface); border-radius: 1.1rem; padding: 1.25rem 1.2rem 1rem; box-shadow: 0 1rem 3rem rgba(0, 0, 0, .3); max-height: calc(100vh - 6rem); overflow-y: auto; }
    .ins-steps { list-style: none; padding: 0; margin: 1rem 0; counter-reset: s; }
    .ins-steps li { counter-increment: s; display: flex; gap: .7rem; align-items: flex-start; padding: .55rem 0; font-size: .9rem; opacity: 0; animation: ins-in .3s ease-out forwards; }
    .ins-steps li::before { content: counter(s); flex: none; width: 1.6rem; height: 1.6rem; border-radius: 50%; background: #9A5226; color: #fff;
      font-weight: 800; font-size: .8rem; display: flex; align-items: center; justify-content: center; margin-top: .05rem; }
    .ins-steps li:nth-child(2) { animation-delay: .15s; } .ins-steps li:nth-child(3) { animation-delay: .3s; }
    .ins-key { display: inline-flex; align-items: center; justify-content: center; min-width: 1.7rem; height: 1.7rem; padding: 0 .35rem; margin: 0 .1rem;
      border: 1px solid var(--wc-border-strong); border-radius: .45rem; background: var(--wc-soft); color: #0a84ff; font-size: 1rem; vertical-align: middle; }
    .ins-perks { display: flex; flex-wrap: wrap; gap: .35rem .9rem; font-size: .78rem; color: var(--wc-muted); }
    .ins-perks .bi { color: #25b003; }
    .ins-arrow { position: fixed; z-index: 2102; color: #fff; font-size: 2.6rem; line-height: 1; filter: drop-shadow(0 2px 6px rgba(0, 0, 0, .5)); pointer-events: none; }
    .ins-arrow small { display: block; font-size: .75rem; font-weight: 800; text-align: center; }
    .ins-arrow.top-right { top: .25rem; right: .6rem; animation: ins-bob-up 1s ease-in-out infinite; }
    .ins-arrow.bottom { bottom: .25rem; left: 50%; margin-left: -1.3rem; animation: ins-bob-down 1s ease-in-out infinite; }
    .ins-arrow.bottom-right { bottom: .25rem; right: .9rem; animation: ins-bob-down 1s ease-in-out infinite; }
    @keyframes ins-up { from { transform: translateY(1.5rem); opacity: 0; } }
    @keyframes ins-fade { from { opacity: 0; } }
    @keyframes ins-in { from { opacity: 0; transform: translateX(-.5rem); } to { opacity: 1; transform: none; } }
    @keyframes ins-bob-up { 50% { transform: translateY(-.45rem); } }
    @keyframes ins-bob-down { 50% { transform: translateY(.45rem); } }
    @media (prefers-reduced-motion: reduce) { .ins-card, .ins-arrow, .ins-steps li { animation: none !important; opacity: 1; } }
  `],
  template: `
    @if (showCard()) {
      <div class="ins-card" role="dialog" aria-label="Get the WoodsyCart app">
        <button class="ins-x" (click)="notNow()" aria-label="Not now"><i class="bi bi-x"></i></button>
        <img class="ins-icon" src="icons/icon-96x96.png" alt="" />
        <div class="flex-grow-1 pe-2">
          <div class="ins-title">Get the WoodsyCart app</div>
          <div class="ins-sub">Free · no Play Store needed · opens in one tap from your home screen</div>
        </div>
        <button class="btn btn-primary btn-sm ins-btn" (click)="install()">{{ svc.kind() === 'prompt' ? 'Install' : 'Show me' }}</button>
      </div>
    }

    @if (svc.open()) {
      <div class="ins-backdrop" (click)="close()"></div>
      <div class="ins-sheet" role="dialog" aria-modal="true" aria-labelledby="ins-h">
        <div class="d-flex align-items-center gap-2">
          <img class="ins-icon" src="icons/icon-96x96.png" alt="" style="width: 2.6rem; height: 2.6rem" />
          <div class="flex-grow-1">
            <div class="ins-title" id="ins-h">{{ svc.kind() === 'in-app' ? 'Open in your browser first' : 'Add WoodsyCart to your home screen' }}</div>
            <div class="ins-sub">{{ intro() }}</div>
          </div>
          <button class="btn-close align-self-start" (click)="close()" aria-label="Close"></button>
        </div>
        <ol class="ins-steps">
          @for (s of steps(); track $index) { <li><span [innerHTML]="s"></span></li> }
        </ol>
        <div class="ins-perks mb-3">
          <span><i class="bi bi-check-circle-fill me-1"></i>Full screen, like an app</span>
          <span><i class="bi bi-check-circle-fill me-1"></i>Uses almost no space</span>
          <span><i class="bi bi-check-circle-fill me-1"></i>Your cart stays saved</span>
        </div>
        <button class="btn btn-primary w-100 ins-btn" (click)="close()">Got it</button>
      </div>
      @if (arrow(); as a) {
        <div class="ins-arrow" [class]="a">
          @if (a === 'top-right') { <i class="bi bi-arrow-up-right-circle-fill"></i><small>Here</small> }
          @else { <small>Here</small><i class="bi bi-arrow-down-circle-fill"></i> }
        </div>
      }
    }
  `
})
export class InstallComponent {
  protected svc = inject(InstallService);
  private router = inject(Router);
  private waited = signal(false);
  private dismissed = signal(this.svc.snoozed());
  private quietPage = signal(false);

  protected showCard = computed(() => this.svc.eligible() && this.waited() && !this.dismissed() && !this.quietPage() && !this.svc.open());

  protected intro = computed(() => ({
    'in-app': `${!this.svc.inAppName || this.svc.inAppName === 'this app' ? 'This app' : this.svc.inAppName}'s own browser can't add apps. Open WoodsyCart in Chrome or Safari, then install it.`,
    'ios-safari': 'Takes 10 seconds in Safari:',
    'ios-other': 'Takes 10 seconds:',
    prompt: 'Takes 10 seconds:',
    android: 'Takes 10 seconds in Chrome:',
    samsung: 'Takes 10 seconds in Samsung Internet:',
    firefox: 'Takes 10 seconds in Firefox:'
  })[this.svc.kind()]);

  private readonly key = (icon: string) => `<span class="ins-key"><i class="bi ${icon}"></i></span>`;

  protected steps = computed<string[]>(() => {
    const k = this.key;
    switch (this.svc.kind()) {
      case 'in-app': return [
        `Tap ${k('bi-three-dots')} or ${k('bi-three-dots-vertical')} at the <b>top right</b>`,
        `Choose <b>Open in browser</b> (or <b>Open in Chrome</b> / <b>Open in Safari</b>)`,
        `In the browser, open the menu ${k('bi-list')} on WoodsyCart and tap <b>Install the app</b>`];
      case 'ios-safari': return [
        `Tap Share ${k('bi-box-arrow-up')} in Safari's bar at the <b>bottom</b> (newer iPhones: tap ${k('bi-three-dots')} first, then Share)`,
        `Scroll down and tap <b>Add to Home Screen</b> ${k('bi-plus-square')}`,
        `Tap <b>Add</b> — WoodsyCart appears on your home screen`];
      case 'ios-other': return [
        `Tap Share ${k('bi-box-arrow-up')} next to the address bar at the <b>top right</b>`,
        `Tap <b>Add to Home Screen</b> ${k('bi-plus-square')} (scroll down or tap <b>More</b> if you don't see it)`,
        `Tap <b>Add</b> — WoodsyCart appears on your home screen`];
      case 'samsung': return [
        `Tap the menu ${k('bi-list')} at the <b>bottom right</b>`,
        `Tap <b>Add page to</b> ${k('bi-plus-lg')}, then <b>Home screen</b>`,
        `Tap <b>Add</b> — WoodsyCart appears on your home screen`];
      case 'firefox': return [
        `Tap the menu ${k('bi-three-dots-vertical')} at the <b>top right</b>`,
        `Tap <b>Install</b> or <b>Add to Home screen</b> ${k('bi-phone')}`,
        `Tap <b>Add</b> — WoodsyCart appears on your home screen`];
      default: return [
        `Tap the menu ${k('bi-three-dots-vertical')} at the <b>top right</b>`,
        `Tap <b>Add to Home screen</b> or <b>Install app</b> ${k('bi-phone')}`,
        `Tap <b>Install</b> — WoodsyCart appears on your home screen`];
    }
  });

  /** Where the browser button is on screen. */
  protected arrow = computed(() => ({ 'ios-safari': 'bottom', samsung: 'bottom-right', prompt: '' } as Record<string, string>)[this.svc.kind()] ?? 'top-right');

  constructor() {
    const quiet = (url: string) => /^\/(cart|checkout|login|register|forgot-password|reset-password|order|account)(\/|\?|$)/.test(url);
    this.quietPage.set(quiet(this.router.url));
    const sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => this.quietPage.set(quiet((e as NavigationEnd).urlAfterRedirects)));
    const timer = setTimeout(() => this.waited.set(true), this.svc.debug ? 1_000 : 15_000);
    // The card sits where the WhatsApp and Instagram buttons float
    effect(() => document.body.classList.toggle('has-install-card', this.showCard()));
    inject(DestroyRef).onDestroy(() => { sub.unsubscribe(); clearTimeout(timer); document.body.classList.remove('has-install-card'); });
  }

  protected install() { this.dismissed.set(true); this.svc.install(); }

  protected notNow() { this.dismissed.set(true); this.svc.snooze(); }

  protected close() { this.svc.open.set(false); this.svc.snooze(); }
}
