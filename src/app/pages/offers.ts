import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SeoService } from '../core/seo.service';
import { ApiService } from '../core/api.service';
import { Offer, Paged, ProductCard } from '../core/models';
import { SHARED } from '../shared/shared';

/** A clock that ticks every 30 seconds, for countdowns. */
function useNow() {
  const now = signal(Date.now());
  const t = setInterval(() => now.set(Date.now()), 30_000);
  inject(DestroyRef).onDestroy(() => clearInterval(t));
  return now;
}

/** "2 days 5 hrs" / "3 hrs 20 mins" / "12 mins". */
export function timeLeft(iso: string, now: number): string {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const mins = Math.floor(ms / 60_000), hrs = Math.floor(mins / 60), days = Math.floor(hrs / 24);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (days >= 1) return `${plural(days, 'day')}${hrs % 24 ? ' ' + plural(hrs % 24, 'hr') : ''}`;
  if (hrs >= 1) return `${plural(hrs, 'hr')}${mins % 60 ? ' ' + plural(mins % 60, 'min') : ''}`;
  return plural(Math.max(1, mins), 'min');
}

export function discountLabel(o: Offer): string {
  return o.discountType === 0 ? `Up to ${o.value}% off` : `Up to ₹${o.value.toLocaleString('en-IN')} off`;
}

/** Festive banner for an offer (uses its image, or its colour when there is none). */
@Component({
  selector: 'wc-offer-banner',
  imports: [RouterLink, DatePipe, ...SHARED],
  template: `
    @let o = offer();
    <div class="offer-banner" [class.compact]="compact()" [style.--oc]="o.themeColor"
         [style.background-image]="o.bannerImageUrl ? 'url(' + (o.bannerImageUrl | media) + ')' : null">
      <div class="ob-copy">
        <span class="ob-kicker"><i class="bi bi-stars"></i>Festival offer</span>
        <h2>{{ o.name }}</h2>
        @if (o.tagline) { <p class="ob-tagline">{{ o.tagline }}</p> }
        <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
          <span class="ob-chip ob-chip-solid">{{ label() }}</span>
          @if (o.status === 'live') { <span class="ob-chip"><i class="bi bi-clock"></i>Ends in {{ ends() }}</span> }
          @else if (o.status === 'upcoming') { <span class="ob-chip"><i class="bi bi-calendar-event"></i>Starts {{ o.startsAt | date: 'd MMM, h:mm a' }}</span> }
          @if (o.couponCode) { <span class="ob-chip"><i class="bi bi-ticket-perforated"></i>Extra savings with code <b class="ms-1">{{ o.couponCode }}</b></span> }
        </div>
        @if (showButton() && o.status === 'live') {
          <a class="btn btn-light fw-bold" [routerLink]="['/offers', o.slug]">Shop the offer <i class="bi bi-arrow-right ms-1"></i></a>
        }
      </div>
    </div>
  `,
  styles: [`
    .offer-banner {
      position: relative; border-radius: 1rem; overflow: hidden; min-height: 300px; display: flex; align-items: center;
      background-color: var(--oc); background-size: cover; background-position: center; color: #fff;
      background-image: radial-gradient(circle at 85% 20%, rgba(255,255,255,.25) 0, transparent 40%), linear-gradient(120deg, var(--oc), color-mix(in srgb, var(--oc) 55%, #000));
    }
    .offer-banner::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, color-mix(in srgb, var(--oc) 85%, #000) 0%, color-mix(in srgb, var(--oc) 40%, transparent) 60%, transparent 100%); }
    .offer-banner.compact { min-height: 220px; }
    .ob-copy { position: relative; padding: 2rem 2.25rem; max-width: 680px; }
    .ob-kicker { display: inline-flex; gap: .35rem; align-items: center; font-size: .75rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; opacity: .9; }
    h2 { color: #fff; font-weight: 800; font-size: clamp(1.7rem, 4.2vw, 2.9rem); margin: .25rem 0 .5rem; }
    .compact h2 { font-size: clamp(1.4rem, 3.2vw, 2.1rem); }
    .ob-tagline { font-size: 1.05rem; opacity: .95; margin-bottom: 1rem; }
    .ob-chip { display: inline-flex; align-items: center; gap: .35rem; font-size: .8rem; font-weight: 600; padding: .3rem .7rem; border-radius: 2rem; background: rgba(255,255,255,.18); backdrop-filter: blur(4px); }
    .ob-chip-solid { background: #fff; color: var(--oc); font-weight: 800; }
    @media (max-width: 575.98px) { .ob-copy { padding: 1.5rem 1.25rem; } .offer-banner { min-height: 240px; } }
  `]
})
export class OfferBannerComponent {
  readonly offer = input.required<Offer>();
  readonly compact = input(false);
  readonly showButton = input(true);
  private now = useNow();
  protected ends = computed(() => timeLeft(this.offer().endsAt, this.now()));
  protected label = computed(() => discountLabel(this.offer()));
}

/** /offers — every offer running now. */
@Component({
  selector: 'wc-offers',
  imports: [RouterLink, OfferBannerComponent, ...SHARED],
  template: `
    <div class="container-xxl py-4">
      <h1 class="section-title mb-1">Festival offers</h1>
      <p class="section-sub">Limited-time prices — offers end automatically, so grab them while they last.</p>
      @if (offers(); as list) {
        @for (o of list; track o.id) {
          <section class="mb-5">
            <wc-offer-banner [offer]="o" [compact]="true" />
            @if (o.products.length) {
              <div class="row g-3 g-md-4 row-cols-2 row-cols-md-4 mt-1">@for (p of o.products; track p.id) { <div class="col"><wc-product-card [product]="p" /></div> }</div>
              <div class="text-center mt-3"><a class="btn btn-phoenix-secondary" [routerLink]="['/offers', o.slug]">See all {{ o.productCount }} products in {{ o.name }}</a></div>
            }
          </section>
        } @empty {
          <div class="text-center py-5">
            <i class="bi bi-stars display-4 text-quiet"></i>
            <h4 class="mt-3">No offers running right now</h4>
            <p class="text-muted">Check back during festivals — or browse today's best prices.</p>
            <a class="btn btn-primary" routerLink="/shop" [queryParams]="{ sort: 'discount' }">See today's deals</a>
          </div>
        }
      } @else {
        <div class="skeleton" style="height: 260px"></div>
      }
    </div>
  `
})
export class OffersPage {
  protected offers = signal<Offer[] | null>(null);
  constructor() { inject(ApiService).get<Offer[]>('catalog/offers').subscribe(o => this.offers.set(o)); }
}

/** /offers/:slug — one offer and all its products. */
@Component({
  selector: 'wc-offer',
  imports: [RouterLink, FormsModule, DatePipe, OfferBannerComponent, ...SHARED],
  template: `
    <div class="container-xxl py-4">
      @if (offer(); as o) {
        <wc-offer-banner [offer]="o" [showButton]="false" />
        @if (o.description) { <p class="text-muted mt-3 mb-0" style="white-space: pre-line">{{ o.description }}</p> }

        @if (o.status === 'live') {
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 my-4">
            <div class="fw-bold">{{ total() }} products on offer</div>
            <select class="form-select form-select-sm w-auto" [ngModel]="sort()" (ngModelChange)="sort.set($event)">
              <option value="popular">Most popular</option>
              <option value="discount">Biggest discount</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          <div class="row g-3 g-md-4 row-cols-2 row-cols-md-3 row-cols-xl-4">
            @for (p of products(); track p.id) { <div class="col"><wc-product-card [product]="p" /></div> }
            @if (loading()) { @for (i of [1, 2, 3, 4]; track i) { <div class="col"><div class="skeleton" style="aspect-ratio: 3 / 4"></div></div> } }
          </div>
          @if (products().length < total() && !loading()) {
            <div class="text-center mt-4"><button class="btn btn-phoenix-secondary" (click)="more()">Show more</button></div>
          }
        } @else {
          <div class="text-center py-5">
            @if (o.status === 'upcoming') {
              <h4>Coming soon</h4>
              <p class="text-muted">{{ o.name }} starts on {{ o.startsAt | date: 'EEEE, d MMMM, h:mm a' }}. Add your favourites to your wishlist now.</p>
            } @else {
              <h4>This offer has ended</h4>
              <p class="text-muted">Thanks for shopping {{ o.name }}! There are still great prices across the store.</p>
            }
            <a class="btn btn-primary" routerLink="/shop">Browse furniture</a>
          </div>
        }
      } @else if (notFound()) {
        <div class="text-center py-5">
          <h4>Offer not found</h4>
          <p class="text-muted">It may have been removed.</p>
          <a class="btn btn-primary" routerLink="/offers">See current offers</a>
        </div>
      } @else {
        <div class="skeleton" style="height: 300px"></div>
      }
    </div>
  `
})
export class OfferPage {
  readonly slug = input.required<string>();
  private api = inject(ApiService);
  private seo = inject(SeoService);
  protected offer = signal<Offer | null>(null);
  protected notFound = signal(false);
  protected products = signal<ProductCard[]>([]);
  protected total = signal(0);
  protected loading = signal(false);
  protected sort = signal('popular');
  private page = 1;

  constructor() {
    effect(() => {
      const slug = this.slug();
      this.offer.set(null);
      this.notFound.set(false);
      this.api.get<Offer>(`catalog/offers/${slug}`).subscribe({
        next: o => {
          this.offer.set(o);
          this.seo.page({ title: o.name, description: o.tagline || o.description, image: this.seo.absoluteImage(o.bannerImageUrl) });
        },
        error: () => this.notFound.set(true)
      });
    });
    // Products load once the offer is known, and again from page 1 when the sort changes.
    effect(() => { this.sort(); if (this.offer()?.status === 'live') this.load(true); });
  }

  more() { this.page++; this.load(false); }

  private load(reset: boolean) {
    if (reset) { this.page = 1; this.products.set([]); }
    this.loading.set(true);
    this.api.get<Paged<ProductCard>>('catalog/products', { offer: this.slug(), sort: this.sort(), page: this.page, pageSize: 24 }).subscribe(r => {
      this.products.set(reset ? r.items : [...this.products(), ...r.items]);
      this.total.set(r.total);
      this.loading.set(false);
    });
  }
}
