import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SeoService } from '../core/seo.service';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Address, MyReviewStatus, Paged, PincodeCheck, ProductCard, ProductDetail, ProductImage, ProductOption, Review, Variant } from '../core/models';
import { AuthService, CartService, SiteService, WishlistService } from '../core/store';
import { ToastService } from '../core/toast.service';
import { SHARED } from '../shared/shared';
import { timeLeft } from './offers';
import { InstagramComponent } from '../shared/instagram';

/** The saved address chosen on product pages during this visit. */
const ADDRESS_KEY = 'wc_deliver_to';

@Component({
  selector: 'wc-product',
  imports: [InstagramComponent, FormsModule, RouterLink, DatePipe, ...SHARED],
  templateUrl: './product.html',
  styles: [`
    .offer-strip { display: flex; align-items: center; gap: .75rem; padding: .7rem 1rem; border-radius: .75rem; color: #fff; text-decoration: none;
      background: linear-gradient(120deg, var(--oc), color-mix(in srgb, var(--oc) 60%, #000)); }
    .offer-strip:hover { color: #fff; filter: brightness(1.05); }
    .main-img { aspect-ratio: 1; border-radius: 0.75rem; overflow: hidden; background: var(--wc-soft); border: 1px solid var(--bs-border-color); position: relative; }
    .main-img img, .main-img video { width: 100%; height: 100%; object-fit: contain; background: #fff; }
    .thumbs { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.25rem; }
    .thumbs button { flex: 0 0 72px; height: 72px; border-radius: 0.5rem; overflow: hidden; border: 2px solid transparent; padding: 0; background: var(--wc-soft); position: relative; }
    .thumbs button.on { border-color: #9A5226; }
    .thumbs img { width: 100%; height: 100%; object-fit: cover; }
    .nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 2.4rem; height: 2.4rem; border-radius: 50%; border: 0; background: rgba(255,255,255,.9); box-shadow: 0 2px 8px rgba(0,0,0,.12); }
    .price-big { font-size: 2rem; font-weight: 800; color: var(--bs-emphasis-color); }
    .opt { border: 1px solid var(--wc-border-strong); background: var(--wc-surface); border-radius: 0.5rem; padding: 0.4rem 0.9rem; font-weight: 700; font-size: 0.85rem; color: var(--bs-body-color); }
    .opt.on { border-color: #9A5226; background: var(--wc-soft-primary); color: #9A5226; }
    .opt.na { opacity: 0.4; text-decoration: line-through; }
    .color-opt { width: 2.25rem; height: 2.25rem; border-radius: 50%; border: 2px solid var(--wc-surface); box-shadow: 0 0 0 1px var(--wc-border-strong); }
    .color-opt.on { box-shadow: 0 0 0 2px #9A5226; }
    .qty { display: inline-flex; align-items: center; border: 1px solid var(--wc-border-strong); border-radius: 0.5rem; button { border: 0; background: transparent; width: 2.4rem; height: 2.6rem; } span { min-width: 2rem; text-align: center; font-weight: 800; } }
    .perk { display: flex; gap: 0.6rem; align-items: flex-start; font-size: 0.85rem; .bi { color: #9A5226; font-size: 1.15rem; } }
    .spec th { width: 34%; color: var(--wc-muted); font-weight: 700; }
    .sticky-buy { position: fixed; left: 0; right: 0; bottom: 3.6rem; background: var(--wc-surface); border-top: 1px solid var(--bs-border-color); padding: 0.6rem 1rem; z-index: 1030; }
    .desc-html :is(p, li) { margin-bottom: 0.4rem; }
  `]
})
export class ProductPage {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  private embeds = new Map<string, SafeResourceUrl | null>();
  protected cart = inject(CartService);
  protected wishlist = inject(WishlistService);
  protected auth = inject(AuthService);
  protected site = inject(SiteService);
  readonly slug = input.required<string>();

  protected p = signal<ProductDetail | null>(null);
  protected notFound = signal(false);
  protected selectedValues = signal<Record<number, number>>({});
  protected selectedVariantId = signal<number | null>(null);
  protected imageIndex = signal(0);
  protected qty = signal(1);
  protected related = signal<ProductCard[]>([]);
  protected reviews = signal<Paged<Review> | null>(null);
  protected pin = signal<PincodeCheck | null>(null);
  protected tab = signal<'details' | 'reviews'>('details');
  protected addresses = signal<Address[]>([]);
  protected addressId = signal<number | null>(null);
  pincode = localStorage.getItem('wc_pincode') ?? '';
  reviewForm = { rating: 5, title: '', comment: '' };
  protected reviewSent = signal(false);
  /** Signed-in customer: may they review this product (delivered order), and have they already? */
  protected myReview = signal<MyReviewStatus | null>(null);

  /** The variant matching all selected option values (or picked directly when a product has no options). */
  protected variant = computed<Variant | null>(() => {
    const p = this.p();
    if (!p || !p.variants.length) return null;
    if (!p.options.length) return p.variants.find(v => v.id === this.selectedVariantId()) ?? null;
    const sel = Object.values(this.selectedValues());
    return p.variants.find(v => sel.length === p.options.length && sel.every(id => v.optionValueIds.includes(id))) ?? null;
  });
  protected price = computed(() => this.variant()?.price ?? this.p()?.price ?? 0);
  protected mrp = computed(() => this.variant()?.mrp ?? this.p()?.mrp ?? 0);
  /** Price before the festival offer, and what the offer saves on the chosen option. */
  protected regular = computed(() => this.variant()?.regularPrice ?? this.p()?.regularPrice ?? 0);
  protected offerSaving = computed(() => (this.p()?.offer ? Math.max(0, this.regular() - this.price()) : 0));
  private now = signal(Date.now());
  protected offerEnds = computed(() => { const o = this.p()?.offer; return o ? timeLeft(o.endsAt, this.now()) : ''; });
  protected discount = computed(() => (this.mrp() > this.price() ? Math.round(((this.mrp() - this.price()) / this.mrp()) * 100) : 0));
  protected available = computed(() => {
    const p = this.p();
    if (!p?.isAvailable) return false;
    if (p.variants.length) return this.variant()?.isAvailable ?? false;
    return true;
  });
  protected needsChoice = computed(() => !!this.p()?.variants.length && !this.variant());
  protected images = computed<ProductImage[]>(() => {
    const p = this.p();
    if (!p) return [];
    const v = this.variant();
    const own = v ? p.images.filter(i => i.variantId === v.id) : [];
    const shared = p.images.filter(i => !i.variantId);
    const list = (own.length || shared.length ? [...own, ...shared] : p.images);
    // Photos first, videos after.
    return [...list.filter(i => i.mediaType !== 3), ...list.filter(i => i.mediaType === 3)];
  });
  protected highlights = computed(() => (this.p()?.description ?? '').split('\n').map(l => l.trim()).filter(l => l.length > 2));

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 30_000); // offer countdown
    // Phones: lift the floating WhatsApp / Instagram buttons above the sticky "Buy now" bar
    document.body.classList.add('has-sticky-buy');
    inject(DestroyRef).onDestroy(() => { clearInterval(clock); document.body.classList.remove('has-sticky-buy'); });
    effect(() => this.load(this.slug()));
    // Signed in with saved addresses: deliver to the chosen (default) address. Otherwise use the last pincode entered.
    effect(() => {
      if (this.auth.isLoggedIn()) this.loadAddresses();
      else { this.addresses.set([]); this.addressId.set(null); if (this.pincode.length === 6) this.checkPincode(); }
    });
  }

  private loadAddresses() {
    this.api.get<Address[]>('account/addresses').subscribe(list => {
      this.addresses.set(list);
      if (!list.length) { if (this.pincode.length === 6) this.checkPincode(); return; }
      // The address picked earlier in this visit, else the default one, else the first.
      const remembered = Number(sessionStorage.getItem(ADDRESS_KEY));
      const pick = list.find(a => a.id === remembered) ?? list.find(a => a.isDefault) ?? list[0];
      this.useAddress(pick.id, false);
    });
  }

  /** Choose a saved address (0 = type another pincode). */
  useAddress(id: number, remember = true) {
    this.addressId.set(id);
    if (remember) sessionStorage.setItem(ADDRESS_KEY, String(id));
    const a = this.addresses().find(x => x.id === id);
    if (!a) { this.pin.set(null); return; } // "Another pincode…": keep what's in the box for the customer to change
    this.pincode = a.pincode;
    this.checkPincode(a);
  }

  /** Typing a different pincode switches the dropdown to "Another pincode…". */
  onPincodeTyped() {
    const a = this.addresses().find(x => x.id === this.addressId());
    if (a && a.pincode !== this.pincode) this.addressId.set(0);
  }

  private load(slug: string) {
    this.p.set(null);
    this.notFound.set(false);
    this.imageIndex.set(0);
    this.qty.set(1);
    this.api.get<ProductDetail>(`catalog/products/${slug}`).subscribe({
      next: p => {
        this.p.set(p);
        this.seo.product(p, p.metaDescription || this.highlights().slice(0, 3).join(' ') ||
          `${p.name} — ${p.category.name.toLowerCase()} at factory price with free delivery and assembly in Bengaluru.`);
        const first = p.variants.find(v => v.isAvailable) ?? p.variants[0];
        if (first) {
          this.selectedVariantId.set(first.id);
          const sel: Record<number, number> = {};
          for (const o of p.options) {
            const match = o.values.find(val => first.optionValueIds.includes(val.id));
            if (match) sel[o.id] = match.id;
          }
          this.selectedValues.set(sel);
        } else {
          this.selectedValues.set({});
          this.selectedVariantId.set(null);
        }
        this.api.get<ProductCard[]>(`catalog/products/${p.id}/related`).subscribe(r => this.related.set(r));
        this.api.get<Paged<Review>>(`catalog/products/${p.id}/reviews`).subscribe(r => this.reviews.set(r));
        this.reviewSent.set(false);
        this.myReview.set(null);
        if (this.auth.isLoggedIn()) this.api.get<MyReviewStatus>(`catalog/products/${p.id}/my-review`).subscribe(m => this.myReview.set(m));
      },
      error: () => this.notFound.set(true)
    });
  }

  select(optionId: number, valueId: number) {
    this.selectedValues.update(s => ({ ...s, [optionId]: valueId }));
    this.imageIndex.set(0);
  }

  /** Privacy-friendly YouTube embed for video links (only well-formed 11-char ids are trusted). */
  youTubeEmbed(url: string): SafeResourceUrl | null {
    if (!this.embeds.has(url)) {
      const id = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(url)?.[1];
      this.embeds.set(url, id ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${id}?rel=0`) : null);
    }
    return this.embeds.get(url)!;
  }

  selectedLabel(o: ProductOption) { return o.values.find(v => v.id === this.selectedValues()[o.id])?.value ?? ''; }

  /** Is there any variant with this value combined with the other current selections? */
  isPossible(optionId: number, valueId: number) {
    const p = this.p()!;
    const others = Object.entries(this.selectedValues()).filter(([k]) => Number(k) !== optionId).map(([, v]) => v);
    return p.variants.some(v => v.isAvailable && v.optionValueIds.includes(valueId) && others.every(o => v.optionValueIds.includes(o)));
  }

  step(n: number) {
    const len = this.images().length;
    this.imageIndex.set((this.imageIndex() + n + len) % len);
  }

  checkPincode(address?: Address) {
    if (!/^\d{6}$/.test(this.pincode)) { this.toast.error('Enter a valid 6-digit pincode'); return; }
    localStorage.setItem('wc_pincode', this.pincode);
    const at = address?.latitude && address.longitude ? { lat: address.latitude, lng: address.longitude } : {};
    this.api.get<PincodeCheck>(`site/pincode/${this.pincode}`, at).subscribe(r => this.pin.set(r));
  }

  deliveryBy() {
    const days = Math.max(this.pin()?.deliveryDays ?? 0, this.p()?.deliveryDays ?? 7);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  addToCart(buyNow = false) {
    const p = this.p()!;
    if (this.needsChoice()) { this.toast.error('Please choose an option'); return; }
    this.cart.add(p.id, this.variant()?.id ?? null, this.qty());
    if (buyNow) this.router.navigate(['/cart']);
    else this.toast.success('Added to cart');
  }

  share() {
    const url = location.href;
    if (navigator.share) navigator.share({ title: this.p()!.name, url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => this.toast.success('Link copied'));
  }

  askLink() {
    const p = this.p()!;
    return this.site.whatsAppLink(`Hi WoodsyCart! I have a question about "${p.name}" ${location.href}`);
  }

  /** Saved against the delivered order, so the customer can edit it later from the order page. */
  submitReview(orderNumber: string) {
    const p = this.p()!;
    this.api.post(`orders/${orderNumber}/reviews`, { productId: p.id, ...this.reviewForm }).subscribe(() => {
      this.reviewSent.set(true);
      this.toast.success('Thank you! Your review will appear once we have checked it.');
    });
  }
}
