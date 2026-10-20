import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { OrderDetail } from '../core/models';
import { OrderViewComponent } from './account/order-view';

@Component({
  selector: 'wc-track',
  imports: [FormsModule, OrderViewComponent],
  template: `
    <div class="container-xxl py-4">
      <div class="mx-auto" style="max-width: 560px">
        <h1 class="h2 fw-800 text-center">Track your order</h1>
        <p class="text-muted text-center">Enter your order number (from your confirmation email) and the phone number used for delivery.</p>
        <form class="card card-body mb-4" (ngSubmit)="track()">
          <div class="row g-2">
            <div class="col-sm-6"><input class="form-control" name="o" [(ngModel)]="orderNumber" placeholder="Order no. e.g. WC2610190001" required /></div>
            <div class="col-sm-6"><input class="form-control" name="p" [(ngModel)]="phone" placeholder="Phone number" inputmode="tel" required /></div>
            <div class="col-12"><button class="btn btn-primary w-100" [disabled]="busy()">Track order</button></div>
          </div>
          @if (error()) { <div class="text-danger fs-7 mt-2">{{ error() }}</div> }
        </form>
      </div>
      @if (order(); as o) {
        <h4 class="fw-800 mb-3">Order #{{ o.orderNumber }}</h4>
        <wc-order-view [order]="o" />
      }
    </div>
  `
})
export class TrackPage {
  private api = inject(ApiService);
  orderNumber = ''; phone = '';
  protected order = signal<OrderDetail | null>(null);
  protected error = signal('');
  protected busy = signal(false);

  track() {
    this.busy.set(true);
    this.error.set('');
    this.api.get<OrderDetail>('orders/track', { orderNumber: this.orderNumber.trim(), phone: this.phone.replace(/\D/g, '') }).subscribe({
      next: o => { this.order.set(o); this.busy.set(false); },
      error: e => { this.order.set(null); this.error.set(e.error?.message ?? 'Order not found'); this.busy.set(false); }
    });
  }
}
