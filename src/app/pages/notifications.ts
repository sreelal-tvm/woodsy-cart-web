import { Component, inject } from '@angular/core';
import { InstallService } from '../shared/install';
import { PushClient } from '../shared/push';

/** Notifications on this phone: on or off, and whether offers, new arrivals and reminders come too. */
@Component({
  selector: 'wc-notifications',
  template: `
    <div class="container-xxl py-4" style="max-width: 40rem">
      <h1 class="h3 fw-800 mb-1">Notifications</h1>
      <p class="text-muted mb-4">Order updates, offers and new arrivals on this phone.</p>

      <div class="card"><div class="card-body">
        @if (push.status(); as s) {
          @if (!s.enabled) {
            <p class="mb-0 text-muted">We're not sending app notifications right now.</p>
          } @else if (push.needsInstall) {
            <p class="mb-3">On iPhone, notifications work in the WoodsyCart app. Add it to your home screen, open it from there and turn them on.</p>
            <button class="btn btn-primary" (click)="installer.install()"><i class="bi bi-phone me-1"></i>Install the app</button>
          } @else if (!push.supported && !push.debug) {
            <p class="mb-0 text-muted">This browser can't show notifications. Open WoodsyCart in Chrome, or install the app on your phone.</p>
          } @else if (push.permission() === 'denied' && !s.on) {
            <p class="mb-0">Notifications are blocked for WoodsyCart. Allow them in your phone's settings for the app (or the browser's site settings), then come back here.</p>
          } @else {
            <div class="form-check form-switch d-flex gap-3 align-items-start ps-0 mb-0">
              <input class="form-check-input ms-0 mt-1 flex-none" type="checkbox" role="switch" id="ntfOn" [checked]="s.on" [disabled]="push.busy()"
                (change)="$any($event.target).checked ? push.turnOn() : push.turnOff()" />
              <label class="form-check-label" for="ntfOn"><b class="d-block">Notifications on this phone</b>
                <span class="text-muted fs-7">Order updates: confirmed, shipped, out for delivery and delivered.</span></label>
            </div>
            @if (s.on) {
              <div class="form-check form-switch d-flex gap-3 align-items-start ps-0 mt-3 pt-3 border-top mb-0">
                <input class="form-check-input ms-0 mt-1 flex-none" type="checkbox" role="switch" id="ntfPromo" [checked]="s.promotions"
                  (change)="push.setPromotions($any($event.target).checked)" />
                <label class="form-check-label" for="ntfPromo"><b class="d-block">Offers, new arrivals &amp; reminders</b>
                  <span class="text-muted fs-7">Sales, new furniture, price drops on your wishlist and a nudge about your cart. At most one a day.</span></label>
              </div>
            }
          }
        } @else if (push.needsInstall) {
          <p class="mb-3">On iPhone, notifications work in the WoodsyCart app. Add it to your home screen, open it from there and turn them on.</p>
          <button class="btn btn-primary" (click)="installer.install()"><i class="bi bi-phone me-1"></i>Install the app</button>
        } @else if (!push.supported) {
          <p class="mb-0 text-muted">This browser can't show notifications. Open WoodsyCart in Chrome, or install the app on your phone.</p>
        } @else {
          <div class="skeleton" style="height: 4rem"></div>
        }
      </div></div>
    </div>
  `,
  styles: [`.flex-none { flex: none; } .form-switch .form-check-input { width: 2.5em; height: 1.35em; }`]
})
export class NotificationsPage {
  protected push = inject(PushClient);
  protected installer = inject(InstallService);
}
