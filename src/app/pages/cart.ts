import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Quote, QuoteLine } from '../core/models';
import { CartService, SiteService } from '../core/store';
import { SHARED } from '../shared/shared';

@Component({
  selector: 'wc-cart',
  imports: [FormsModule, RouterLink, ...SHARED],
  template: `
    <div class="container-xxl py-4">
      <h1 class="h2 fw-800 mb-4">Your cart @if (cart.count()) { <span class="text-muted fs-5">({{ cart.count() }} items)</span> }</h1>
      @if (!cart.lines().length) {
        <div class="empty-state"><i class="bi bi-bag"></i><h4>Your cart is empty</h4><p>Find something you'll love.</p><a class="btn btn-primary" routerLink="/shop">Start shopping</a></div>
      } @else if (quote(); as q) {
        <div class="row g-4">
          <div class="col-lg-8">
            <!-- Phones: one compact card per item, everything visible without scrolling sideways -->
            <div class="d-md-none border-top mb-3">
              @for (l of q.lines; track l.productId + '-' + l.variantId) {
                <div class="cart-item" [class.opacity-75]="!l.isAvailable">
                  <a [routerLink]="['/product', l.slug]"><img [src]="l.imageUrl | media" alt="" class="rounded border" /></a>
                  <div class="min-w-0 flex-grow-1">
                    <div class="d-flex gap-2 align-items-start">
                      <a class="fw-bold name flex-grow-1" [routerLink]="['/product', l.slug]">{{ l.name }}</a>
                      <button class="btn btn-sm text-danger p-0 lh-1" (click)="remove(l)" aria-label="Remove"><i class="bi bi-trash fs-6"></i></button>
                    </div>
                    @if (l.variantName) { <div class="text-muted fs-8">{{ l.variantName }}</div> }
                    @if (l.offerName) { <div class="fs-8 fw-bold text-offer"><i class="bi bi-stars me-1"></i>{{ l.offerName }} price</div> }
                    @if (l.problem) { <div class="text-danger fs-8 fw-bold">{{ l.problem }}</div> }
                    <div class="fs-7 mt-1">{{ l.unitPrice | inr }}@if (l.unitMrp > l.unitPrice) { <span class="text-quiet fs-8 text-decoration-line-through ms-1">{{ l.unitMrp | inr }}</span> }</div>
                    <div class="d-flex justify-content-between align-items-center mt-1">
                      <div class="d-inline-flex align-items-center border rounded">
                        <button class="btn btn-sm" (click)="setQty(l, l.quantity - 1)" [disabled]="l.quantity <= 1" aria-label="Decrease"><i class="bi bi-dash"></i></button>
                        <span class="px-2 fw-bold">{{ l.quantity }}</span>
                        <button class="btn btn-sm" (click)="setQty(l, l.quantity + 1)" aria-label="Increase"><i class="bi bi-plus"></i></button>
                      </div>
                      <span class="fw-bold">{{ l.lineTotal | inr }}</span>
                    </div>
                  </div>
                </div>
              }
            </div>
            <div class="table-responsive d-none d-md-block">
              <table class="table align-middle">
                <thead class="fs-8 text-uppercase"><tr><th>Product</th><th class="text-end">Price</th><th class="text-center">Qty</th><th class="text-end">Total</th><th></th></tr></thead>
                <tbody>
                  @for (l of q.lines; track l.productId + '-' + l.variantId) {
                    <tr [class.opacity-75]="!l.isAvailable">
                      <td>
                        <div class="d-flex gap-3 align-items-center">
                          <a [routerLink]="['/product', l.slug]"><img [src]="l.imageUrl | media" alt="" class="rounded border" style="width: 80px; height: 80px; object-fit: cover" /></a>
                          <div class="min-w-0">
                            <a class="fw-bold d-block" [routerLink]="['/product', l.slug]" style="max-width: 360px">{{ l.name }}</a>
                            @if (l.variantName) { <span class="text-muted fs-7">{{ l.variantName }}</span> }
                            @if (l.offerName) { <div class="fs-8 fw-bold text-offer"><i class="bi bi-stars me-1"></i>{{ l.offerName }} price</div> }
                            @if (l.problem) { <div class="text-danger fs-7 fw-bold">{{ l.problem }}</div> }
                          </div>
                        </div>
                      </td>
                      <td class="text-end">{{ l.unitPrice | inr }}@if (l.unitMrp > l.unitPrice) { <div class="text-quiet fs-8 text-decoration-line-through">{{ l.unitMrp | inr }}</div> }</td>
                      <td class="text-center">
                        <div class="d-inline-flex align-items-center border rounded">
                          <button class="btn btn-sm" (click)="setQty(l, l.quantity - 1)" [disabled]="l.quantity <= 1" aria-label="Decrease"><i class="bi bi-dash"></i></button>
                          <span class="px-2 fw-bold">{{ l.quantity }}</span>
                          <button class="btn btn-sm" (click)="setQty(l, l.quantity + 1)" aria-label="Increase"><i class="bi bi-plus"></i></button>
                        </div>
                      </td>
                      <td class="text-end fw-bold">{{ l.lineTotal | inr }}</td>
                      <td class="text-end"><button class="btn btn-sm text-danger" (click)="remove(l)" aria-label="Remove"><i class="bi bi-trash"></i></button></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <a routerLink="/shop" class="fw-bold fs-7"><i class="bi bi-arrow-left me-1"></i>Continue shopping</a>
          </div>
          <div class="col-lg-4">
            <div class="card">
              <div class="card-body">
                <h5 class="fw-800 mb-3">Summary</h5>
                <form class="d-flex gap-2 mb-2" (ngSubmit)="applyCoupon()">
                  <input class="form-control" name="coupon" [(ngModel)]="couponInput" placeholder="Coupon code" aria-label="Coupon code" />
                  <button class="btn btn-phoenix-secondary">Apply</button>
                </form>
                @if (q.couponMessage) { <div class="fs-7 mb-3" [class.text-success]="q.couponCode" [class.text-danger]="!q.couponCode">{{ q.couponMessage }}</div> }
                <div class="d-flex justify-content-between mb-2"><span class="text-muted">Items (MRP)</span><span>{{ q.mrpTotal | inr }}</span></div>
                @if (q.mrpTotal > q.subTotal) { <div class="d-flex justify-content-between mb-2"><span class="text-muted">Discount on MRP</span><span class="text-success">−{{ q.mrpTotal - q.subTotal | inr }}</span></div> }
                @if (q.offerSavings > 0) { <div class="d-flex justify-content-between mb-2 fs-7"><span class="text-muted ps-2">incl. festival offer savings</span><span class="text-success">{{ q.offerSavings | inr }}</span></div> }
                @if (q.discount) { <div class="d-flex justify-content-between mb-2"><span class="text-muted">Coupon {{ q.couponCode }}</span><span class="text-success">−{{ q.discount | inr }}</span></div> }
                <div class="d-flex justify-content-between mb-2"><span class="text-muted">Delivery & assembly</span><span>{{ q.shippingFee ? (q.shippingFee | inr) : 'Free' }}</span></div>
                <div class="d-flex justify-content-between border-top pt-2 mt-2 fs-5 fw-800"><span>Total</span><span>{{ q.total | inr }}</span></div>
                <div class="text-muted fs-8 mb-3">Inclusive of all taxes</div>
                @if (q.mrpTotal - q.total > 0) { <div class="alert alert-success py-2 fs-7">You save {{ q.mrpTotal - q.total | inr }} on this order 🎉</div> }
                @for (m of q.messages; track m) { <div class="alert alert-warning py-2 fs-7">{{ m }}</div> }
                <button class="btn btn-primary btn-lg w-100" [disabled]="!q.canCheckout" (click)="checkout()">Proceed to checkout</button>
                <div class="text-center text-muted fs-8 mt-2"><i class="bi bi-lock me-1"></i>Secure checkout · UPI, cards, net banking{{ site.settings()?.codEnabled ? ', COD' : '' }}</div>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <div class="skeleton" style="height: 320px"></div>
      }
    </div>
  `,
  styles: [`
    .cart-item { display: flex; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--bs-border-color); }
    .cart-item img { width: 72px; height: 72px; object-fit: cover; }
    .cart-item .name { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; }
  `]
})
export class CartPage {
  private api = inject(ApiService);
  private router = inject(Router);
  protected cart = inject(CartService);
  protected site = inject(SiteService);
  protected quote = signal<Quote | null>(null);
  couponInput = sessionStorage.getItem('wc_coupon') ?? '';

  constructor() {
    // Phones: the floating WhatsApp / Instagram buttons go to the left, clear of the prices and buttons on the right
    document.body.classList.add('floats-left');
    inject(DestroyRef).onDestroy(() => document.body.classList.remove('floats-left'));
    effect(() => {
      const lines = this.cart.lines();
      if (lines.length) this.refresh(lines);
    });
  }

  private refresh(lines = this.cart.lines()) {
    this.api.post<Quote>('checkout/quote', { items: lines, couponCode: sessionStorage.getItem('wc_coupon'), pincode: localStorage.getItem('wc_pincode') })
      .subscribe(q => this.quote.set(q));
  }

  applyCoupon() {
    const code = this.couponInput.trim().toUpperCase();
    if (code) sessionStorage.setItem('wc_coupon', code); else sessionStorage.removeItem('wc_coupon');
    this.refresh();
  }

  setQty(l: QuoteLine, q: number) { this.cart.setQuantity(l.productId, l.variantId, q); }
  remove(l: QuoteLine) { this.cart.remove(l.productId, l.variantId); }

  checkout() { this.router.navigate(['/checkout']); }
}
