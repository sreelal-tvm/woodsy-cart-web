import { Component, DestroyRef, Injectable, computed, effect, inject, isDevMode, signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { filter, firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService, CartService } from '../core/store';
import { ToastService } from '../core/toast.service';
import { InstallService } from './install';

interface PushStatus { publicKey: string; on: boolean; enabled: boolean; promotions: boolean; }
interface OrderLink { orderNumber: string; token?: string | null; }
/** The prompt to show: in the installed app ('app'), or right after an order ('order'). */
export interface PushAsk extends Partial<OrderLink> { mode: 'app' | 'order'; }

const SNOOZE_KEY = 'wc_notify_snooze';
const SNOOZE_DAYS = 7;
/** The customer turned notifications off here: don't turn them back on by ourselves. */
const OFF_KEY = 'wc_notify_off';

function store(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ }
}
function stored(key: string) { try { return localStorage.getItem(key); } catch { return null; } }

/**
 * App notifications on this phone (Web Push through the site's service worker): offers, new arrivals, reminders and order
 * updates. Keeps the device linked to the signed-in account and to orders placed here, and tells the server what's in the
 * cart (for one "your cart is waiting" reminder).
 */
@Injectable({ providedIn: 'root' })
export class PushClient {
  private sw = inject(SwPush);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private installer = inject(InstallService);
  /** Dev only: ?notify=app or ?notify=order shows the prompt on a computer (notifications only work on the live site). */
  readonly debug = isDevMode() ? new URLSearchParams(location.search).get('notify') as 'app' | 'order' | null : null;
  readonly supported = this.sw.isEnabled && 'Notification' in window && 'PushManager' in window;
  /** iPhone in Safari (not the installed app): Apple allows notifications only once installed. */
  readonly needsInstall = this.installer.ios && this.installer.eligible();
  readonly status = signal<PushStatus | null>(null);
  readonly on = computed(() => !!this.status()?.on);
  readonly permission = signal<NotificationPermission>(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  readonly busy = signal(false);
  readonly ask = signal<PushAsk | null>(null);
  private endpoint: string | null = null;
  readonly ready: Promise<void>;
  private cartTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.ready = this.load().catch(() => undefined);
    // signed in after the app opened: link this device to the account
    effect(() => {
      const user = this.auth.user();
      untracked(() => { if (user && this.on()) this.relink(); });
    });
    // the cart on this device, for one "your cart is waiting" reminder
    effect(() => {
      const lines = this.cart.lines();
      if (!this.on()) return;
      clearTimeout(this.cartTimer);
      this.cartTimer = setTimeout(() => this.api.post('push/cart', {
        endpoint: this.endpoint, count: lines.length, productId: lines.at(-1)?.productId ?? null
      }).subscribe({ error: () => undefined }), 3000);
    });
  }

  private async load() {
    if (!this.supported) {
      if (this.debug) this.status.set({ publicKey: '', on: false, enabled: true, promotions: true });
      return;
    }
    const sub = await firstValueFrom(this.sw.subscription);
    this.endpoint = sub?.endpoint ?? null;
    const s = await firstValueFrom(this.api.get<PushStatus>('push/status', this.endpoint ? { endpoint: this.endpoint } : {}));
    this.status.set(s);
    if (!s.enabled || this.permission() !== 'granted') return;
    if (sub) await this.save(sub, {}); // keeps the device linked (account, keys) and back on if the server dropped it
    else if (this.installer.standalone && !stored(OFF_KEY)) await this.turnOn(undefined, true); // allowed before (e.g. reinstalled)
  }

  private async save(sub: PushSubscription, extra: Partial<OrderLink> & { promotions?: boolean }) {
    this.endpoint = sub.endpoint;
    this.status.set(await firstValueFrom(this.api.post<PushStatus>('push/subscribe', { ...sub.toJSON(), ...extra })));
  }

  private async relink(order?: OrderLink) {
    const sub = await firstValueFrom(this.sw.subscription);
    if (sub) await this.save(sub, order ?? {}).catch(() => undefined);
  }

  /** Asks the phone for permission (the browser's own dialog) and turns notifications on; from an order, links it too. */
  async turnOn(order?: OrderLink, quiet = false): Promise<boolean> {
    if (!this.supported) { if (!quiet) this.toast.info('Notifications work in the WoodsyCart app on your phone.'); return false; }
    this.busy.set(true);
    try {
      const key = this.status()?.publicKey || (await firstValueFrom(this.api.get<PushStatus>('push/status'))).publicKey;
      const sub = await this.sw.requestSubscription({ serverPublicKey: key });
      await this.save(sub, order ?? {});
      store(OFF_KEY, null);
      if (!quiet) this.toast.success("Notifications are on — we'll keep you posted");
      return true;
    } catch {
      this.permission.set(Notification.permission);
      if (!quiet) this.toast.info(Notification.permission === 'denied'
        ? 'Notifications are blocked for WoodsyCart. Allow them in your phone\'s settings for the app.'
        : "Couldn't turn on notifications on this phone.");
      return false;
    } finally {
      this.busy.set(false);
      this.permission.set(Notification.permission);
    }
  }

  async turnOff() {
    this.busy.set(true);
    const endpoint = this.endpoint;
    try { await this.sw.unsubscribe(); } catch { /* already off in the browser */ }
    store(OFF_KEY, '1');
    this.api.post('push/unsubscribe', { endpoint }).subscribe({
      next: () => { this.status.update(s => s && { ...s, on: false }); this.busy.set(false); this.endpoint = null; this.toast.info('Notifications are off on this phone'); },
      error: () => this.busy.set(false)
    });
  }

  /** Offers, new arrivals and reminders too, or order updates only. */
  setPromotions(promotions: boolean) {
    this.api.post('push/preferences', { endpoint: this.endpoint, promotions }).subscribe(() => this.status.update(s => s && { ...s, promotions }));
  }

  /**
   * An order opened on this phone: already on → link the order to it (guests get its updates too); just placed → offer
   * updates for it, unless notifications are blocked or the shop doesn't send them.
   */
  async afterOrder(order: OrderLink, offer = true) {
    await this.ready;
    if (this.on()) { await this.relink(order); return; }
    if (!offer) return;
    const s = this.status();
    if ((this.supported || this.debug) && s?.enabled && this.permission() !== 'denied') this.ask.set({ mode: 'order', ...order });
  }

  /** The installed app's "turn on notifications?" prompt is due: never asked, or "Not now" over a week ago. */
  canAskInApp() {
    const s = this.status();
    return (this.debug === 'app' || (this.supported && this.installer.standalone && this.permission() === 'default' && !stored(OFF_KEY)))
      && !!s?.enabled && !s.on && Date.now() > Number(stored(SNOOZE_KEY) ?? 0);
  }

  snooze() { store(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000)); }
}

/**
 * The short "turn on notifications" sheet: once in the installed app (6 seconds after it opens, not while paying or signing
 * in), and right after an order is placed. "Not now" waits a week before asking again in the app.
 */
@Component({
  selector: 'wc-notify-prompt',
  styles: [`
    .ntf-backdrop { position: fixed; inset: 0; z-index: 2100; background: rgba(42, 33, 28, .55); animation: ntf-fade .2s ease-out; }
    .ntf-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2101; max-width: 28rem; margin: 0 auto; text-align: center;
      background: var(--wc-surface); border-radius: 1.25rem 1.25rem 0 0; padding: 1.6rem 1.4rem calc(1rem + env(safe-area-inset-bottom));
      box-shadow: 0 -1rem 3rem rgba(0, 0, 0, .25); animation: ntf-up .3s ease-out; }
    @media (min-width: 576px) { .ntf-sheet { bottom: 50%; transform: translateY(50%); border-radius: 1.25rem; animation: ntf-fade .2s ease-out; } }
    .ntf-bell { width: 4rem; height: 4rem; margin: 0 auto .9rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #C2703D, #9A5226); color: #fff; font-size: 1.8rem; box-shadow: 0 .5rem 1.25rem rgba(154, 82, 38, .35); }
    .ntf-bell .bi { animation: ntf-ring 1.6s ease-in-out .3s 2; transform-origin: 50% 10%; }
    .ntf-title { font-weight: 800; font-size: 1.25rem; color: var(--bs-emphasis-color); margin-bottom: .35rem; }
    .ntf-text { color: var(--wc-muted); font-size: .95rem; line-height: 1.4; margin: 0 auto 1.2rem; max-width: 20rem; }
    .ntf-btn { border-radius: 2rem; font-weight: 800; padding: .7rem 1rem; }
    .ntf-later { color: var(--wc-muted); font-weight: 600; text-decoration: none; margin-top: .35rem; }
    @keyframes ntf-up { from { transform: translateY(100%); } }
    @keyframes ntf-fade { from { opacity: 0; } }
    @keyframes ntf-ring { 0%, 100% { transform: rotate(0); } 15% { transform: rotate(14deg); } 30% { transform: rotate(-12deg); } 45% { transform: rotate(9deg); } 60% { transform: rotate(-6deg); } 75% { transform: rotate(3deg); } }
    @media (prefers-reduced-motion: reduce) { .ntf-sheet, .ntf-backdrop, .ntf-bell .bi { animation: none !important; } }
  `],
  template: `
    @if (push.ask(); as a) {
      <div class="ntf-backdrop" (click)="later()"></div>
      <div class="ntf-sheet" role="dialog" aria-modal="true" aria-labelledby="ntf-h">
        <div class="ntf-bell"><i class="bi bi-bell-fill"></i></div>
        @if (a.mode === 'order') {
          <div class="ntf-title" id="ntf-h">Track your order live 📦</div>
          <p class="ntf-text">Get a heads-up the moment it's confirmed, shipped and out for delivery.</p>
        } @else {
          <div class="ntf-title" id="ntf-h">Never miss a deal 🔔</div>
          <p class="ntf-text">Offers, new arrivals and order updates — right on your phone. No spam, promise.</p>
        }
        <button class="btn btn-primary w-100 ntf-btn" [disabled]="push.busy()" (click)="allow(a)">
          {{ push.busy() ? 'Turning on…' : a.mode === 'order' ? 'Turn on order updates' : 'Turn on notifications' }}</button>
        <button class="btn btn-link w-100 ntf-later" (click)="later()">Not now</button>
      </div>
    }
  `
})
export class NotifyPromptComponent {
  protected push = inject(PushClient);
  private timer?: ReturnType<typeof setTimeout>;
  private asked = false;

  constructor() {
    const router = inject(Router);
    const quiet = () => /^\/(checkout|order\/|login|register|forgot-password|reset-password|notifications)/.test(router.url);
    // once per visit, 6 seconds in; on a page that shouldn't be interrupted, again after the next page change
    const schedule = () => {
      if (this.timer || this.asked || !this.push.canAskInApp()) return;
      this.timer = setTimeout(() => {
        this.timer = undefined;
        if (quiet() || this.push.ask() || !this.push.canAskInApp()) return;
        this.asked = true;
        this.push.ask.set({ mode: 'app' });
      }, 6000);
    };
    this.push.ready.then(() => {
      if (this.push.debug === 'order') this.push.ask.set({ mode: 'order', orderNumber: 'TEST' });
      schedule();
    });
    const sub = router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(schedule);
    inject(DestroyRef).onDestroy(() => { sub.unsubscribe(); clearTimeout(this.timer); });
  }

  async allow(a: PushAsk) {
    const ok = await this.push.turnOn(a.orderNumber && a.orderNumber !== 'TEST' ? { orderNumber: a.orderNumber, token: a.token } : undefined);
    if (ok || this.push.permission() === 'denied' || !this.push.supported) this.push.ask.set(null);
  }

  later() {
    if (this.push.ask()?.mode === 'app') this.push.snooze();
    this.push.ask.set(null);
  }
}
