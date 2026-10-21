import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Address, CheckoutMethod, OrderDetail, PaymentMethod, PlaceOrderResponse, Quote } from '../core/models';
import { AuthService, CartService, GuestOrders, SiteService } from '../core/store';
import { ToastService } from '../core/toast.service';
import { SHARED } from '../shared/shared';
import { AddressFormComponent, emptyAddress } from './account/address-form';

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: (r: unknown) => void): void }; }
}

/** Loads Razorpay Checkout on demand. */
export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment gateway.'));
    document.body.appendChild(s);
  });
}

const GUEST_KEY = 'wc_guest_checkout';

/** Indian mobile: 10 digits starting 6–9, optionally with +91 / 0 / spaces / dashes (same rule as the server). */
function validMobile(phone?: string | null): boolean {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d);
}

@Component({
  selector: 'wc-checkout',
  imports: [FormsModule, RouterLink, AddressFormComponent, ...SHARED],
  template: `
    <div class="container-xxl py-4">
      <h1 class="h2 fw-800 mb-4">Checkout</h1>
      @if (!cart.lines().length) {
        <div class="empty-state"><i class="bi bi-bag"></i><h4>Your cart is empty</h4><a class="btn btn-primary" routerLink="/shop">Shop furniture</a></div>
      } @else {
        <div class="row g-4">
          <div class="col-lg-7">
            <!-- Contact: sign in or guest -->
            @if (!auth.isLoggedIn()) {
              <div class="card mb-3">
                <div class="card-body">
                  <h5 class="fw-800 mb-3"><span class="step">1</span>Contact</h5>
                  <div class="d-flex flex-wrap align-items-center gap-2 border rounded-3 p-3 mb-3 bg-soft">
                    <span class="me-auto fs-7"><b>Have an account?</b> Sign in for faster checkout and saved addresses.</span>
                    <a class="btn btn-sm btn-primary" routerLink="/login" [queryParams]="{ returnUrl: '/checkout' }">Sign in</a>
                    <a class="btn btn-sm btn-phoenix-secondary" routerLink="/register" [queryParams]="{ returnUrl: '/checkout' }">Create account</a>
                  </div>
                  <div class="fw-bold mb-2">Or continue as a guest</div>
                  <label class="form-label" for="gemail">Email for order updates</label>
                  <input id="gemail" type="email" class="form-control" [(ngModel)]="guestEmail" (ngModelChange)="saveGuest()" placeholder="you@example.com" autocomplete="email" />
                  <div class="form-text">We'll send your order confirmation and tracking link here. No account needed.</div>
                </div>
              </div>
            }

            <!-- Address -->
            <div class="card mb-3">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h5 class="fw-800 mb-0"><span class="step">{{ stepNo(1) }}</span>Delivery address</h5>
                  @if (auth.isLoggedIn() && addresses().length && !adding()) { <button class="btn btn-sm btn-soft-primary" (click)="adding.set(true)"><i class="bi bi-plus me-1"></i>New address</button> }
                  @if (!auth.isLoggedIn() && guestAddress() && !adding()) { <button class="btn btn-sm btn-soft-primary" (click)="editGuestAddress()"><i class="bi bi-pencil me-1"></i>Change</button> }
                </div>

                @if (auth.isLoggedIn()) {
                  @if (!adding()) {
                    <div class="row g-2">
                      @for (a of addresses(); track a.id) {
                        <div class="col-md-6">
                          <label class="addr" [class.on]="addressId() === a.id">
                            <input type="radio" class="form-check-input me-2" name="addr" [checked]="addressId() === a.id" (change)="addressId.set(a.id)" />
                            <span><b>{{ a.fullName }}</b> <span class="badge-soft badge-soft-secondary ms-1">{{ a.label }}</span><br />
                              <span class="fs-7 text-muted">{{ a.line1 }}@if (a.line2) {, {{ a.line2 }}}, {{ a.city }} – {{ a.pincode }}<br />{{ a.phone }}</span></span>
                          </label>
                        </div>
                      }
                    </div>
                  } @else {
                    <wc-address-form [address]="newAddress" (saved)="onAddressSaved($event)" (cancelled)="adding.set(false)" [showCancel]="addresses().length > 0" />
                  }
                } @else {
                  @if (guestAddress() && !adding()) {
                    @let a = guestAddress()!;
                    <div class="addr on">
                      <i class="bi bi-geo-alt-fill text-primary me-2"></i>
                      <span><b>{{ a.fullName }}</b> · {{ a.phone }}<br />
                        <span class="fs-7 text-muted">{{ a.line1 }}@if (a.line2) {, {{ a.line2 }}}@if (a.landmark) {, near {{ a.landmark }}}, {{ a.city }}, {{ a.state }} – {{ a.pincode }}</span></span>
                    </div>
                  } @else {
                    <wc-address-form [address]="guestDraft" [persist]="false" submitLabel="Use this address" [showCancel]="!!guestAddress()"
                      (saved)="onGuestAddress($event)" (cancelled)="adding.set(false)" />
                  }
                }
              </div>
            </div>

            <!-- Payment -->
            <div class="card mb-3">
              <div class="card-body">
                <h5 class="fw-800 mb-3"><span class="step">{{ stepNo(2) }}</span>Payment</h5>
                @for (m of methods(); track m.method) {
                  @let codBlocked = m.method === 'CashOnDelivery' && !quote()?.codAvailable;
                  <label class="pay" [class.on]="method() === m.method" [class.disabled]="codBlocked">
                    <input type="radio" class="form-check-input me-2" name="pm" [disabled]="codBlocked" [checked]="method() === m.method" (change)="method.set(m.method)" />
                    <span><b>{{ m.label }}</b><br /><span class="fs-7 text-muted">{{ codBlocked ? 'Not available for this order or pincode' : m.description }}</span></span>
                    <i class="bi ms-auto fs-4 {{ icon(m.method) }}"></i>
                  </label>
                } @empty {
                  @if (methodsLoaded()) {
                    <div class="alert alert-warning fs-7 py-2 mb-0">Online payment is being set up. Please contact us on WhatsApp to complete your order.</div>
                  }
                }
                @if (method() === 'Upi' && provider() === 'DirectUpi') {
                  <div class="fs-8 text-muted mt-1"><i class="bi bi-shield-check text-success me-1"></i>You'll pay directly from your UPI app on the next screen — no card details or extra charges.</div>
                }
              </div>
            </div>

            <div class="card">
              <div class="card-body">
                <h5 class="fw-800 mb-3"><span class="step">{{ stepNo(3) }}</span>Anything else?</h5>
                <textarea class="form-control mb-2" rows="2" [(ngModel)]="notes" placeholder="Delivery instructions (floor, lift, preferred time…)"></textarea>
                <details><summary class="fs-7 text-muted cursor-pointer">Buying for business? Add your GSTIN</summary>
                  <input class="form-control mt-2 text-uppercase" [(ngModel)]="gstin" placeholder="GSTIN" maxlength="15" /></details>
              </div>
            </div>
          </div>

          <div class="col-lg-5">
            <div class="card position-sticky" style="top: 7rem">
              <div class="card-body">
                <h5 class="fw-800 mb-3">Order summary</h5>
                @if (quote(); as q) {
                  @for (l of q.lines; track l.productId + '-' + l.variantId) {
                    <div class="d-flex gap-2 mb-3">
                      <img [src]="l.imageUrl | media" alt="" class="rounded border" style="width: 56px; height: 56px; object-fit: cover" />
                      <div class="flex-grow-1 min-w-0 fs-7"><div class="fw-bold text-truncate">{{ l.name }}</div><div class="text-muted">{{ l.variantName }} × {{ l.quantity }}</div>
                        @if (l.offerName) { <div class="fs-8 fw-bold text-offer"><i class="bi bi-stars me-1"></i>{{ l.offerName }} price</div> }
                        @if (l.problem) { <div class="text-danger">{{ l.problem }}</div> }</div>
                      <div class="fw-bold fs-7">{{ l.lineTotal | inr }}</div>
                    </div>
                  }
                  <div class="border-top pt-2 fs-7">
                    <div class="d-flex justify-content-between mb-1"><span class="text-muted">Subtotal</span><span>{{ q.subTotal | inr }}</span></div>
                    @if (q.offerSavings > 0) { <div class="d-flex justify-content-between mb-1"><span class="text-muted">Festival offer savings</span><span class="text-success">{{ q.offerSavings | inr }} (included)</span></div> }
                    @if (q.discount) { <div class="d-flex justify-content-between mb-1"><span class="text-muted">Coupon {{ q.couponCode }}</span><span class="text-success">−{{ q.discount | inr }}</span></div> }
                    <div class="d-flex justify-content-between mb-1"><span class="text-muted">Delivery & assembly</span><span>{{ q.shippingFee ? (q.shippingFee | inr) : 'Free' }}</span></div>
                    @if (q.codFee) { <div class="d-flex justify-content-between mb-1"><span class="text-muted">COD fee</span><span>{{ q.codFee | inr }}</span></div> }
                    <div class="d-flex justify-content-between fs-5 fw-800 border-top pt-2 mt-2"><span>Total</span><span>{{ q.total | inr }}</span></div>
                    <div class="text-muted fs-8">Inclusive of all taxes · Estimated delivery in {{ q.deliveryDays }}–{{ q.deliveryDays + 3 }} days</div>
                  </div>
                  @for (m of q.messages; track m) { <div class="alert alert-warning py-2 fs-7 mt-3 mb-0">{{ m }}</div> }
                  @if (missing(); as why) { <div class="text-muted fs-7 mt-3"><i class="bi bi-info-circle me-1"></i>{{ why }}</div> }
                  <button class="btn btn-primary btn-lg w-100 mt-3" [disabled]="!canPlace() || placing()" (click)="place()">
                    {{ placing() ? 'Placing order…' : (method() === 'Razorpay' ? 'Pay ' : 'Place order · ') }}{{ placing() ? '' : (q.total | inr) }}
                  </button>
                  <p class="text-muted fs-8 mt-2 mb-0">By placing this order you agree to our <a routerLink="/policies/terms">terms</a> and <a routerLink="/policies/returns">return policy</a>.</p>
                } @else { <div class="skeleton" style="height: 240px"></div> }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .step { display: inline-flex; width: 1.6rem; height: 1.6rem; border-radius: 50%; background: #3874ff; color: #fff; font-size: 0.8rem; align-items: center; justify-content: center; margin-right: 0.6rem; }
    .addr, .pay { display: flex; align-items: flex-start; border: 1px solid var(--bs-border-color); border-radius: 0.5rem; padding: 0.9rem; cursor: pointer; height: 100%; }
    .pay { align-items: center; margin-bottom: 0.6rem; }
    .addr.on, .pay.on { border-color: #3874ff; background: var(--wc-soft-primary); }
    .pay.disabled { opacity: 0.55; cursor: not-allowed; }
  `]
})
export class CheckoutPage {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  protected cart = inject(CartService);
  protected site = inject(SiteService);

  // Signed-in customers
  protected addresses = signal<Address[]>([]);
  protected addressId = signal<number | null>(null);
  protected adding = signal(false);
  protected newAddress = emptyAddress();

  // Guests (remembered for this browser session so a refresh doesn't lose the form)
  private savedGuest = JSON.parse(sessionStorage.getItem(GUEST_KEY) ?? 'null') as { email: string; address: Address | null } | null;
  guestEmail = this.savedGuest?.email ?? '';
  // A remembered address with an invalid mobile number (e.g. saved before numbers were checked) opens in the form to be fixed.
  protected guestAddress = signal<Address | null>(this.savedGuest?.address && validMobile(this.savedGuest.address.phone) ? this.savedGuest.address : null);
  protected guestDraft: Address = this.savedGuest?.address ? { ...this.savedGuest.address } : emptyAddress();
  private guestEmailValid = signal(/^\S+@\S+\.\S+$/.test(this.guestEmail));

  protected methods = signal<CheckoutMethod[]>([]);
  protected methodsLoaded = signal(false);
  protected method = signal<PaymentMethod | null>(null);
  protected provider = computed(() => this.methods().find(m => m.method === this.method())?.provider ?? null);
  protected quote = signal<Quote | null>(null);
  protected placing = signal(false);
  notes = '';
  gstin = '';

  private pincode = computed(() => this.auth.isLoggedIn()
    ? this.addresses().find(a => a.id === this.addressId())?.pincode ?? localStorage.getItem('wc_pincode')
    : this.guestAddress()?.pincode ?? localStorage.getItem('wc_pincode'));

  /** Why the place-order button is disabled (shown under the summary). */
  protected missing = computed(() => {
    if (!this.auth.isLoggedIn()) {
      if (!this.guestEmailValid()) return 'Enter your email, or sign in, to continue.';
      if (!this.guestAddress()) return 'Add a delivery address to continue.';
    } else {
      const a = this.addresses().find(x => x.id === this.addressId());
      if (!a) return 'Add a delivery address to continue.';
      if (!validMobile(a.phone)) return 'The mobile number on this address is not valid. Edit it under My account → Addresses, or add a new address.';
    }
    return null;
  });

  protected canPlace = computed(() => {
    const q = this.quote();
    if (!q?.canCheckout || this.missing()) return false;
    if (!this.method()) return false;
    if (this.method() === 'CashOnDelivery') return q.codAvailable;
    return true;
  });

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) this.loadAddresses();
      else this.adding.set(!this.guestAddress());
    });
    this.api.get<CheckoutMethod[]>('site/payment-methods').subscribe(m => {
      this.methods.set(m);
      this.methodsLoaded.set(true);
      this.method.set(m.find(x => x.method !== 'CashOnDelivery')?.method ?? m[0]?.method ?? null);
    });
    effect(() => {
      const lines = this.cart.lines();
      if (!lines.length) return;
      this.api.post<Quote>('checkout/quote', { items: lines, couponCode: sessionStorage.getItem('wc_coupon'), pincode: this.pincode(), paymentMethod: this.method() ?? 'Upi' })
        .subscribe(q => this.quote.set(q));
    });
  }

  icon(m: PaymentMethod) {
    return ({ Upi: 'bi-phone text-primary', Card: 'bi-credit-card text-primary', NetBanking: 'bi-bank text-primary', Wallet: 'bi-wallet2 text-primary',
      Emi: 'bi-calendar3 text-primary', BankTransfer: 'bi-building text-primary', CashOnDelivery: 'bi-cash-coin text-success' } as Record<string, string>)[m] ?? 'bi-credit-card';
  }

  stepNo(n: number) { return this.auth.isLoggedIn() ? n : n + 1; }

  private loadAddresses(selectId?: number) {
    this.api.get<Address[]>('account/addresses').subscribe(a => {
      this.addresses.set(a);
      this.adding.set(a.length === 0);
      const user = this.auth.user();
      if (!a.length && user) this.newAddress = { ...emptyAddress(), fullName: user.fullName, phone: user.phone ?? '' };
      this.addressId.set(selectId ?? a.find(x => x.isDefault)?.id ?? a[0]?.id ?? null);
    });
  }

  onAddressSaved(a: Address) {
    this.adding.set(false);
    this.loadAddresses(a.id);
  }

  saveGuest() {
    this.guestEmailValid.set(/^\S+@\S+\.\S+$/.test(this.guestEmail.trim()));
    sessionStorage.setItem(GUEST_KEY, JSON.stringify({ email: this.guestEmail.trim(), address: this.guestAddress() }));
  }

  onGuestAddress(a: Address) {
    this.guestAddress.set(a);
    this.adding.set(false);
    localStorage.setItem('wc_pincode', a.pincode);
    this.saveGuest();
  }

  editGuestAddress() {
    this.guestDraft = { ...this.guestAddress()! };
    this.adding.set(true);
  }

  place() {
    const guest = !this.auth.isLoggedIn();
    const g = this.guestAddress();
    this.placing.set(true);
    this.api.post<PlaceOrderResponse>('checkout/place-order', {
      items: this.cart.lines(),
      addressId: guest ? null : this.addressId(),
      address: guest && g ? {
        label: 'Home', fullName: g.fullName, phone: g.phone, line1: g.line1, line2: g.line2 || null, landmark: g.landmark || null,
        city: g.city, state: g.state, pincode: g.pincode, isDefault: false, latitude: g.latitude ?? null, longitude: g.longitude ?? null
      } : null,
      guestEmail: guest ? this.guestEmail.trim() : null,
      couponCode: sessionStorage.getItem('wc_coupon'),
      paymentMethod: this.method(), notes: this.notes || null, customerGstin: this.gstin || null
    }).subscribe({
      next: res => {
        GuestOrders.save(res.orderNumber, res.accessToken);
        const bought = this.quote()?.lines.map(l => l.productId) ?? [];
        this.cart.clear(bought);
        sessionStorage.removeItem('wc_coupon');
        if (res.paymentProvider === 'Razorpay' && res.razorpayOrderId) this.pay(res);
        else this.openOrder(res, true);
      },
      error: () => this.placing.set(false)
    });
  }

  private openOrder(res: PlaceOrderResponse, placed: boolean) {
    // Direct UPI / bank transfer: the order page shows how to pay; "placed" shows the thank-you banner.
    this.router.navigate(['/order', res.orderNumber], { queryParams: { token: res.isGuest ? res.accessToken : null, placed: placed ? 1 : null } });
  }

  private async pay(res: PlaceOrderResponse) {
    try {
      await loadRazorpay();
    } catch (e) {
      this.toast.error((e as Error).message);
      this.openOrder(res, false);
      return;
    }
    const rzp = new window.Razorpay!({
      key: res.razorpayKeyId, amount: res.amountInPaise, currency: 'INR', order_id: res.razorpayOrderId,
      name: this.site.settings()?.businessName ?? 'WoodsyCart', description: `Order ${res.orderNumber}`,
      image: location.origin + '/icons/icon-192x192.png',
      prefill: { name: res.customerName, email: res.customerEmail, contact: res.customerPhone },
      theme: { color: '#3874ff' },
      ...(res.gatewayMethod ? { prefill: { name: res.customerName, email: res.customerEmail, contact: res.customerPhone, method: res.gatewayMethod } } : {}),
      handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        this.api.post<OrderDetail>('checkout/verify-payment', {
          orderNumber: res.orderNumber, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id,
          razorpaySignature: r.razorpay_signature, accessToken: res.accessToken
        }).subscribe({
          next: () => this.openOrder(res, true),
          error: () => this.openOrder(res, false)
        });
      },
      modal: {
        ondismiss: () => {
          this.toast.info('Payment not completed. You can retry from your order page.');
          this.openOrder(res, false);
        }
      }
    });
    rzp.open();
  }
}
