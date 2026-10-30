import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InstallService } from './install';
import { PushClient } from './push';

/** Order page: "Get updates about this order on this phone" (app notifications), or that they're on. */
@Component({
  selector: 'wc-order-updates',
  imports: [RouterLink],
  template: `
    @if (show()) {
      <div class="upd d-flex flex-wrap align-items-center gap-3 mb-4">
        <i class="bi fs-3 text-primary" [class.bi-bell]="!push.on()" [class.bi-bell-fill]="push.on()"></i>
        <div class="me-auto">
          @if (push.on()) {
            <div class="fw-bold">Order updates are on for this phone</div>
            <div class="text-muted fs-7">We'll let you know when your order is confirmed, shipped and delivered.</div>
          } @else if (push.needsInstall) {
            <div class="fw-bold">Get updates about this order on this phone</div>
            <div class="text-muted fs-7">On iPhone, add WoodsyCart to your home screen first, then open this order from there.</div>
          } @else {
            <div class="fw-bold">Get updates about this order on this phone</div>
            <div class="text-muted fs-7">A notification when your order is confirmed, shipped and delivered.</div>
          }
        </div>
        @if (push.on()) {
          <a class="btn btn-phoenix-secondary btn-sm" routerLink="/notifications">Manage</a>
        } @else if (push.needsInstall) {
          <button class="btn btn-primary btn-sm" (click)="installer.install()"><i class="bi bi-phone me-1"></i>Install the app</button>
        } @else {
          <button class="btn btn-primary btn-sm" [disabled]="push.busy()" (click)="turnOn()">{{ push.busy() ? 'Turning on…' : 'Turn on' }}</button>
        }
      </div>
    }
  `,
  styles: [`.upd { border: 1px solid color-mix(in srgb, #9A5226 30%, transparent); background: var(--wc-soft-primary); border-radius: 0.75rem; padding: 1rem 1.25rem; }`]
})
export class OrderUpdatesComponent {
  readonly orderNumber = input.required<string>();
  readonly token = input<string | null>(null);
  protected push = inject(PushClient);
  protected installer = inject(InstallService);
  /** Not when the shop has customer notifications off, the browser can't do them, or they were blocked for us. */
  protected show = computed(() => {
    const s = this.push.status();
    if (!s) return this.push.needsInstall;
    return s.on || (s.enabled && this.push.permission() !== 'denied' && (this.push.supported || this.push.needsInstall || !!this.push.debug));
  });

  turnOn() { this.push.turnOn({ orderNumber: this.orderNumber(), token: this.token() }); }
}
