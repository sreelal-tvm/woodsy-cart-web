import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { OrderDetail, PlaceOrderResponse } from '../../core/models';
import { AuthService, GuestOrders, SiteService } from '../../core/store';
import { ToastService } from '../../core/toast.service';
import { SHARED } from '../../shared/shared';
import { InstagramComponent } from '../../shared/instagram';
import { loadRazorpay } from '../checkout';
import { OrderReviewsComponent } from './order-reviews';
import { OrderViewComponent } from './order-view';
import { UpiPayComponent } from './upi-pay';

@Component({
  selector: 'wc-order',
  imports: [InstagramComponent, FormsModule, RouterLink, DatePipe, OrderViewComponent, OrderReviewsComponent, UpiPayComponent, ...SHARED],
  template: `
    <div class="container-xxl py-4">
      @if (o(); as o) {
        @if (o.payment; as pay) {
          <div class="mb-4">
            <h1 class="h3 fw-800 mb-1">{{ placed() ? 'Almost done — complete your payment' : 'Complete your payment' }}</h1>
            <p class="text-muted fs-7">Order #{{ o.orderNumber }} is reserved. It's confirmed and sent for crafting as soon as your payment reaches us.</p>
            <wc-upi-pay [payment]="pay" (utrSubmitted)="submitUtr($event)" />
          </div>
        } @else if (placed() || justPaid()) {
          <div class="placed text-center mb-4">
            <i class="bi bi-check-circle-fill"></i>
            <h1 class="h3 fw-800 mt-2">{{ justPaid() ? 'Payment received — thank you!' : 'Thank you! Your order is placed.' }}</h1>
            <p class="text-muted mb-0">We've sent the details to {{ o.shipEmail }}. Your furniture will be crafted and delivered to {{ o.shipCity }}.</p>
          </div>
          <div class="mb-4"><wc-instagram variant="card" /></div>
        }
        @if (!auth.isLoggedIn()) {
          <div class="guest-cta d-flex flex-wrap align-items-center gap-3 mb-4">
            <i class="bi bi-person-plus fs-3 text-primary"></i>
            <div class="me-auto">
              <div class="fw-bold">Save this order to an account</div>
              <div class="text-muted fs-7">Create a free account with {{ o.shipEmail }} to see all your orders, save addresses and check out faster next time.</div>
            </div>
            <a class="btn btn-primary btn-sm" routerLink="/register" [queryParams]="{ email: o.shipEmail, returnUrl: '/account/orders' }">Create account</a>
          </div>
        }
        <nav class="fs-7 mb-2">
          @if (auth.isLoggedIn()) { <a routerLink="/account/orders">My orders</a> } @else { <a routerLink="/track">Track order</a> }
          <i class="bi bi-chevron-right text-quiet mx-1"></i><span class="text-muted">#{{ o.orderNumber }}</span>
        </nav>
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
          <div>
            <h2 class="fw-800 mb-1">Order #{{ o.orderNumber }}</h2>
            <span class="text-muted fs-7">Placed on {{ o.createdAt | date: 'd MMM yyyy, h:mm a' }} · {{ o.status | orderStatus }}</span>
          </div>
          <div class="d-flex flex-wrap gap-2">
            @if (needsPayment(o)) { <button class="btn btn-primary" (click)="retryPayment()"><i class="bi bi-credit-card me-1"></i>Complete payment</button> }
            @if (o.hasInvoice) { <button class="btn btn-phoenix-secondary" (click)="invoice()"><i class="bi bi-download me-1"></i>Invoice</button> }
            @if (o.canCancel) { <button class="btn btn-outline-danger" (click)="mode.set('cancel')">Cancel order</button> }
            @if (o.canReturn) { <button class="btn btn-phoenix-secondary" (click)="mode.set('return')">Return / report a problem</button> }
            @if (site.whatsAppLink('Hi WoodsyCart! I need help with order ' + o.orderNumber); as wa) { <a class="btn btn-outline-success" [href]="wa" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-1"></i>Help</a> }
          </div>
        </div>

        @if (mode() === 'cancel') {
          <div class="card border-danger mb-4"><div class="card-body">
            <h6 class="fw-800">Cancel this order?</h6>
            <select class="form-select mb-2" [(ngModel)]="reason">
              @for (r of cancelReasons; track r) { <option [value]="r">{{ r }}</option> }
            </select>
            @if (o.amountPaid > 0) { <p class="fs-7 text-muted">Your refund of {{ o.amountPaid | inr }} will be processed to the original payment method within 5–7 working days.</p> }
            <button class="btn btn-danger me-2" (click)="cancel()">Yes, cancel order</button><button class="btn btn-phoenix-secondary" (click)="mode.set('')">Keep order</button>
          </div></div>
        }
        @if (mode() === 'return') {
          <div class="card mb-4"><div class="card-body">
            <h6 class="fw-800">Request a return</h6>
            <select class="form-select mb-2" [(ngModel)]="reason">
              @for (r of returnReasons; track r) { <option [value]="r">{{ r }}</option> }
            </select>
            <textarea class="form-control mb-2" rows="3" [(ngModel)]="comment" placeholder="Tell us what happened — photos can be shared on WhatsApp"></textarea>
            <button class="btn btn-primary me-2" (click)="requestReturn()">Submit request</button><button class="btn btn-phoenix-secondary" (click)="mode.set('')">Close</button>
          </div></div>
        }

        @if (o.canReview) { <wc-order-reviews [order]="o" [access]="q()" /> }
        <wc-order-view [order]="o" />
      } @else if (notFound()) {
        <div class="empty-state">
          <i class="bi bi-search"></i>
          <h4>We couldn't open this order</h4>
          <p>Sign in to the account used for the order, or look it up with your order number and phone.</p>
          <div class="d-flex gap-2 justify-content-center">
            <a class="btn btn-primary" routerLink="/track">Track order</a>
            <a class="btn btn-phoenix-secondary" routerLink="/login" [queryParams]="{ returnUrl: '/order/' + orderNumber() }">Sign in</a>
          </div>
        </div>
      } @else { <div class="skeleton" style="height: 400px"></div> }
    </div>
  `,
  styles: [`.placed { background: rgba(37, 176, 3, 0.1); border-radius: 1rem; padding: 2rem; } .placed .bi { font-size: 3rem; color: #25b003; }
    .guest-cta { border: 1px solid color-mix(in srgb, #9A5226 30%, transparent); background: var(--wc-soft-primary); border-radius: 0.75rem; padding: 1rem 1.25rem; }`]
})
export class OrderPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  protected site = inject(SiteService);
  readonly orderNumber = input.required<string>();
  readonly placedParam = input<string>(undefined, { alias: 'placed' });
  readonly tokenParam = input<string>(undefined, { alias: 'token' });
  protected o = signal<OrderDetail | null>(null);
  protected placed = signal(false);
  protected justPaid = signal(false);
  private poll?: ReturnType<typeof setInterval>;
  protected notFound = signal(false);
  protected mode = signal<'' | 'cancel' | 'return'>('');
  cancelReasons = ['Ordered by mistake', 'Found a better price', 'Delivery is taking too long', 'Want to change the product or colour', 'Other'];
  returnReasons = ['Product damaged on arrival', 'Manufacturing defect', 'Different from what was ordered', 'Missing parts', 'Other'];
  reason = this.cancelReasons[0];
  comment = '';

  /** Guest access: token from the link (email / checkout redirect) or remembered on this device. */
  private token = computed(() => this.tokenParam() || GuestOrders.get(this.orderNumber()) || null);
  protected q = computed(() => ({ token: this.token() }));

  constructor() {
    effect(() => {
      this.placed.set(this.placedParam() === '1');
      const t = this.tokenParam();
      if (t) GuestOrders.save(this.orderNumber(), t);
      this.load();
    });
    inject(DestroyRef).onDestroy(() => clearInterval(this.poll));
  }

  /** While a direct UPI / bank payment is pending, check every 5 s so the page flips to "paid" by itself. */
  private watch(o: OrderDetail) {
    if (o.payment && !this.poll) {
      this.poll = setInterval(() => this.api.get<OrderDetail>(`orders/${this.orderNumber()}`, this.q()).subscribe(n => {
        if (!n.payment) {
          clearInterval(this.poll);
          this.poll = undefined;
          this.justPaid.set(n.paymentStatus === 'Paid');
        }
        this.o.set(n);
      }), 5000);
    }
    if (!o.payment && this.poll) { clearInterval(this.poll); this.poll = undefined; }
  }

  submitUtr(utr: string) {
    this.api.post<OrderDetail>(`orders/${this.orderNumber()}/utr`, { utr }, this.q()).subscribe(o => {
      this.o.set(o);
      this.toast.success(o.payment ? 'Thanks! We\'ll confirm as soon as the payment reaches us.' : 'Payment confirmed!');
      if (!o.payment) this.justPaid.set(true);
    });
  }

  load() {
    this.notFound.set(false);
    this.api.get<OrderDetail>(`orders/${this.orderNumber()}`, this.q()).subscribe({
      next: o => { this.o.set(o); this.watch(o); },
      error: () => this.notFound.set(true)
    });
  }

  needsPayment(o: OrderDetail) {
    const gateway = o.paymentProvider === 'Razorpay' || (!o.paymentProvider && o.paymentMethod === 'Razorpay');
    return gateway && o.paymentStatus === 'Pending' && o.status === 'Pending';
  }

  cancel() {
    this.api.post(`orders/${this.orderNumber()}/cancel`, { reason: this.reason }, this.q()).subscribe(() => { this.toast.success('Order cancelled'); this.mode.set(''); this.load(); });
  }

  requestReturn() {
    this.api.post(`orders/${this.orderNumber()}/return`, { reason: this.reason, comment: this.comment }, this.q()).subscribe(() => {
      this.toast.success('Return requested — we will contact you shortly'); this.mode.set(''); this.load();
    });
  }

  invoice() { this.api.download(`orders/${this.orderNumber()}/invoice`, `Invoice-${this.orderNumber()}.pdf`, this.q()); }

  retryPayment() {
    this.api.post<PlaceOrderResponse>(`orders/${this.orderNumber()}/pay`, {}, this.q()).subscribe(async res => {
      await loadRazorpay();
      new window.Razorpay!({
        key: res.razorpayKeyId, amount: res.amountInPaise, currency: 'INR', order_id: res.razorpayOrderId, name: 'WoodsyCart',
        description: `Order ${res.orderNumber}`, prefill: { name: res.customerName, email: res.customerEmail, contact: res.customerPhone }, theme: { color: '#9A5226' },
        handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
          this.api.post<OrderDetail>('checkout/verify-payment', {
            orderNumber: res.orderNumber, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id,
            razorpaySignature: r.razorpay_signature, accessToken: res.accessToken
          }).subscribe(o => { this.o.set(o); this.placed.set(true); })
      }).open();
    });
  }
}
