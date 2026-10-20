import { Component, computed, input } from '@angular/core';
import { DatePipe, LowerCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderDetail, OrderStatus } from '../../core/models';
import { SHARED } from '../../shared/shared';

const FLOW: OrderStatus[] = ['Pending', 'Confirmed', 'PlacedWithVendor', 'Dispatched', 'OutForDelivery', 'Delivered'];

/** Shared order summary + tracking timeline (used by the order page and public tracking). */
@Component({
  selector: 'wc-order-view',
  styles: [`
    .delivery-box { display: flex; gap: .85rem; align-items: flex-start; padding: .9rem 1rem; border-radius: .75rem; background: var(--wc-soft); border: 1px solid var(--bs-border-color); }
    .delivery-box .bi { color: #3874ff; }
    .delivery-box.delayed { background: #fff4e5; border-color: #ffd8a8; color: #7a3e00; }
    .delivery-box.delayed .bi { color: #e8590c; }
    :host-context([data-bs-theme=dark]) .delivery-box.delayed { background: #3a2a14; border-color: #7a4a10; color: #ffd8a8; }
  `],
  imports: [RouterLink, DatePipe, LowerCasePipe, ...SHARED],
  template: `
    @let o = order();
    <div class="row g-4">
      <div class="col-lg-7">
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="fw-800 mb-3">Tracking</h5>
            @if (open() && o.expectedDeliveryDate) {
              <div class="delivery-box mb-3" [class.delayed]="delayed()">
                <i class="bi fs-4" [class.bi-calendar-check]="!delayed()" [class.bi-calendar-x]="delayed()"></i>
                <div>
                  <div class="fs-8 text-uppercase fw-bold opacity-75">{{ delayed() ? 'New expected delivery' : 'Expected delivery' }}</div>
                  <div class="fw-800 fs-5">{{ o.expectedDeliveryDate | date: 'EEEE, d MMMM' }}</div>
                  @if (delayed()) {
                    <div class="fs-7 mt-1">Sorry for the wait — this was originally expected on {{ o.originalDeliveryDate | date: 'EEE, d MMM' }}.</div>
                  }
                  @if (o.deliveryDateReason) { <div class="fs-7 mt-1"><b>Reason:</b> {{ o.deliveryDateReason }}</div> }
                  @if (o.deliveryDateChangedAt) { <div class="fs-8 opacity-75 mt-1">Updated {{ o.deliveryDateChangedAt | date: 'd MMM, h:mm a' }}</div> }
                </div>
              </div>
            }
            @if (o.status === 'Cancelled' || o.status === 'Returned') {
              <div class="alert alert-secondary mb-0">This order was {{ o.status | orderStatus | lowercase }}.@if (o.cancelReason) { Reason: {{ o.cancelReason }} }</div>
            } @else {
              <ul class="timeline">
                @for (s of flow; track s; let i = $index) {
                  <li [class.done]="i <= stepIndex()">
                    <span class="dot"></span>
                    <div class="fw-bold" [class.text-muted]="i > stepIndex()">{{ s | orderStatus }}</div>
                    @if (historyFor(s); as h) { <div class="text-muted fs-7">{{ h.createdAt | date: 'EEE, d MMM · h:mm a' }}@if (h.note) { — {{ h.note }} }</div> }
                    @if (s === 'Delivered' && i > stepIndex() && o.expectedDeliveryDate) { <div class="text-muted fs-7">Expected by {{ o.expectedDeliveryDate | date: 'EEE, d MMM' }}</div> }
                  </li>
                }
              </ul>
            }
            @if (o.trackingNumber) { <div class="fs-7 mt-2"><i class="bi bi-truck me-1"></i>{{ o.courierName }} · <b>{{ o.trackingNumber }}</b></div> }
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <h5 class="fw-800 mb-3">Items</h5>
            @for (i of o.items; track i.id) {
              <div class="d-flex gap-3 mb-3 align-items-center">
                <img [src]="i.imageUrl | media" alt="" class="rounded border" style="width: 64px; height: 64px; object-fit: cover" />
                <div class="flex-grow-1 min-w-0">
                  @if (i.slug) { <a class="fw-bold d-block" [routerLink]="['/product', i.slug]">{{ i.productName }}</a> } @else { <span class="fw-bold">{{ i.productName }}</span> }
                  <span class="text-muted fs-7">{{ i.variantName }} · Qty {{ i.quantity }}</span>
                </div>
                <span class="fw-bold">{{ i.lineTotal | inr }}</span>
              </div>
            }
          </div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card mb-3">
          <div class="card-body fs-7">
            <h5 class="fw-800 mb-3">Payment</h5>
            <div class="d-flex justify-content-between mb-1"><span class="text-muted">Subtotal</span><span>{{ o.subTotal | inr }}</span></div>
            @if (o.discount) { <div class="d-flex justify-content-between mb-1"><span class="text-muted">Coupon {{ o.couponCode }}</span><span class="text-success">−{{ o.discount | inr }}</span></div> }
            <div class="d-flex justify-content-between mb-1"><span class="text-muted">Delivery</span><span>{{ o.shippingFee ? (o.shippingFee | inr) : 'Free' }}</span></div>
            @if (o.codFee) { <div class="d-flex justify-content-between mb-1"><span class="text-muted">COD fee</span><span>{{ o.codFee | inr }}</span></div> }
            <div class="d-flex justify-content-between border-top pt-2 mt-2 fs-6 fw-800"><span>Total</span><span>{{ o.total | inr }}</span></div>
            <div class="d-flex justify-content-between mt-2"><span class="text-muted">{{ methodLabel(o.paymentMethod) }}</span>
              <span class="fw-bold" [class.text-success]="o.paymentStatus === 'Paid'">{{ o.paymentStatus === 'Paid' ? 'Paid' : (o.paymentStatus === 'Refunded' ? 'Refunded' : 'Due ' + (o.total - o.amountPaid | inr)) }}</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-body fs-7">
            <h5 class="fw-800 mb-2">Delivery address</h5>
            <div class="fw-bold">{{ o.shipName }}</div>
            <div class="text-muted">{{ o.shipLine1 }}@if (o.shipLine2) {, {{ o.shipLine2 }}}</div>
            @if (o.shipLandmark) { <div class="text-muted">Near {{ o.shipLandmark }}</div> }
            <div class="text-muted">{{ o.shipCity }}, {{ o.shipState }} – {{ o.shipPincode }}</div>
            <div class="text-muted">{{ o.shipPhone }}</div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class OrderViewComponent {
  /** Still on its way (not delivered, cancelled or returned). */
  protected open = computed(() => !['Delivered', 'Cancelled', 'Returned'].includes(this.order().status));
  /** The delivery date was moved later than first promised. */
  protected delayed = computed(() => {
    const o = this.order();
    return !!o.originalDeliveryDate && !!o.expectedDeliveryDate && o.expectedDeliveryDate.slice(0, 10) > o.originalDeliveryDate.slice(0, 10);
  });
  readonly order = input.required<OrderDetail>();
  protected flow = FLOW;
  protected stepIndex = computed(() => FLOW.indexOf(this.order().status));
  methodLabel(m: string) {
    return ({ CashOnDelivery: 'Cash on delivery', Upi: 'UPI', Card: 'Card', NetBanking: 'Net banking', Wallet: 'Wallet', Emi: 'EMI',
      BankTransfer: 'Bank transfer', Razorpay: 'Online' } as Record<string, string>)[m] ?? m;
  }

  historyFor(s: OrderStatus) {
    const h = this.order().history.filter(x => x.status === s);
    return h.length ? h[h.length - 1] : null;
  }
}
