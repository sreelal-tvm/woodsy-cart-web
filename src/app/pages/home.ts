import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Home } from '../core/models';
import { SiteService } from '../core/store';
import { SHARED } from '../shared/shared';
import { OfferBannerComponent } from './offers';

@Component({
  selector: 'wc-home',
  imports: [RouterLink, OfferBannerComponent, ...SHARED],
  template: `
    @if (home(); as h) {
      <!-- Festival offers (only while running) -->
      @for (o of h.offers ?? []; track o.id) {
        <section class="container-xxl pt-3">
          <wc-offer-banner [offer]="o" />
          @if (o.products.length) {
            <div class="d-flex justify-content-between align-items-end mt-4 mb-3">
              <div><h2 class="section-title">{{ o.name }} picks</h2><p class="section-sub mb-0">Festive prices on these — for a limited time</p></div>
              <a [routerLink]="['/offers', o.slug]" class="fw-bold fs-7">See all {{ o.productCount }} <i class="bi bi-chevron-right"></i></a>
            </div>
            <wc-scroller>@for (p of o.products; track p.id) { <wc-product-card [product]="p" /> }</wc-scroller>
          }
        </section>
      }

      <!-- Hero -->
      @if (h.banners.length) {
        <section class="container-xxl pt-3">
          <div class="banner" [style.background-image]="'url(' + (h.banners[slide()].imageUrl | media) + ')'">
            <div class="banner-copy">
              <h1>{{ h.banners[slide()].title }}</h1>
              @if (h.banners[slide()].subtitle) { <p>{{ h.banners[slide()].subtitle }}</p> }
              @if (h.banners[slide()].linkUrl) { <a class="btn btn-light btn-lg" [href]="h.banners[slide()].linkUrl">{{ h.banners[slide()].buttonText || 'Shop now' }}</a> }
            </div>
            @if (h.banners.length > 1) {
              <div class="dots">@for (b of h.banners; track b.id; let i = $index) { <button [class.on]="i === slide()" (click)="slide.set(i)" [attr.aria-label]="'Slide ' + (i + 1)"></button> }</div>
            }
          </div>
        </section>
      } @else {
        <section class="hero">
          <div class="container-xxl">
            <div class="row align-items-center g-4">
              <div class="col-lg-6">
                <span class="badge-soft badge-soft-primary mb-3">Now delivering across Bengaluru</span>
                <h1 class="display-5 fw-800 mb-3">Furniture that feels like home — at factory prices.</h1>
                <p class="lead text-muted mb-4">Beds, sofas, wardrobes, dining sets and office furniture made by skilled craftsmen and delivered to your door with free assembly.</p>
                <div class="d-flex flex-wrap gap-2">
                  <a class="btn btn-primary btn-lg" routerLink="/shop">Shop all furniture</a>
                  <a class="btn btn-phoenix-secondary btn-lg" routerLink="/shop" [queryParams]="{ sort: 'discount' }">Today's deals</a>
                </div>
                <div class="d-flex flex-wrap gap-4 mt-4 fs-7 text-muted">
                  <span><i class="bi bi-truck text-primary me-1"></i>Free delivery</span>
                  <span><i class="bi bi-tools text-primary me-1"></i>Free assembly</span>
                  <span><i class="bi bi-shield-check text-primary me-1"></i>Manufacturer warranty</span>
                </div>
              </div>
              <div class="col-lg-6">
                <div class="collage">
                  @for (p of h.featured.slice(0, 3); track p.id; let i = $index) {
                    <a [routerLink]="['/product', p.slug]" class="tile t{{ i }}"><img [src]="(p.imageUrl || p.thumbnailUrl) | media" [alt]="p.name" /></a>
                  }
                </div>
              </div>
            </div>
          </div>
        </section>
      }

      <!-- Categories -->
      <section class="section">
        <div class="container-xxl">
          <div class="d-flex justify-content-between align-items-end mb-3">
            <div><h2 class="section-title">Shop by category</h2><p class="section-sub mb-0">Everything for your home and office</p></div>
            <a routerLink="/shop" class="fw-bold fs-7">View all <i class="bi bi-chevron-right"></i></a>
          </div>
          <div class="cat-grid">
            @for (c of h.categories; track c.id) {
              <a class="cat" routerLink="/shop" [queryParams]="{ category: c.slug }">
                <span class="cat-img"><img [src]="c.imageUrl | media" [alt]="c.name" loading="lazy" /></span>
                <span class="fw-bold fs-7 mt-2">{{ c.name }}</span>
                <span class="text-quiet fs-8">{{ c.productCount }} items</span>
              </a>
            }
          </div>
        </div>
      </section>

      @if (h.bestDeals.length) {
        <section class="section pt-0">
          <div class="container-xxl">
            <div class="d-flex justify-content-between align-items-end mb-3">
              <div><h2 class="section-title">Top deals today</h2><p class="section-sub mb-0">Biggest savings on popular pieces</p></div>
              <a routerLink="/shop" [queryParams]="{ sort: 'discount' }" class="fw-bold fs-7">See all deals <i class="bi bi-chevron-right"></i></a>
            </div>
            <wc-scroller>@for (p of h.bestDeals; track p.id) { <wc-product-card [product]="p" /> }</wc-scroller>
          </div>
        </section>
      }

      <section class="container-xxl">
        <div class="promise row g-3 g-md-4 mx-0">
          <div class="col-6 col-md-3"><i class="bi bi-buildings"></i><div><b>Factory direct</b><span>No showroom markup</span></div></div>
          <div class="col-6 col-md-3"><i class="bi bi-truck"></i><div><b>Free delivery</b><span>Across Bengaluru</span></div></div>
          <div class="col-6 col-md-3"><i class="bi bi-tools"></i><div><b>Free assembly</b><span>By trained fitters</span></div></div>
          <div class="col-6 col-md-3"><i class="bi bi-cash-coin"></i><div><b>Pay your way</b><span>UPI, cards or COD</span></div></div>
        </div>
      </section>

      @if (h.featured.length) {
        <section class="section">
          <div class="container-xxl">
            <div class="d-flex justify-content-between align-items-end mb-3">
              <div><h2 class="section-title">Best sellers</h2><p class="section-sub mb-0">Loved by homes across the city</p></div>
              <a routerLink="/shop" [queryParams]="{ featured: true }" class="fw-bold fs-7">View all <i class="bi bi-chevron-right"></i></a>
            </div>
            <div class="row g-3 g-md-4 row-cols-2 row-cols-md-3 row-cols-xl-6">@for (p of h.featured; track p.id) { <div class="col"><wc-product-card [product]="p" /></div> }</div>
          </div>
        </section>
      }

      <section class="container-xxl">
        <div class="custom-cta">
          <div>
            <h3 class="fw-800 mb-1">Need a custom size or bulk order?</h3>
            <p class="mb-0 opacity-75">Office fit-outs, hostels, cafés or a bed that fits that tricky corner — tell us what you need.</p>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <a class="btn btn-light" routerLink="/contact">Send an enquiry</a>
            @if (site.whatsAppLink('Hi WoodsyCart! I need a custom furniture quote.'); as wa) { <a class="btn btn-success" [href]="wa" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-1"></i>WhatsApp us</a> }
          </div>
        </div>
      </section>

      @if (h.newArrivals.length) {
        <section class="section">
          <div class="container-xxl">
            <div class="d-flex justify-content-between align-items-end mb-3">
              <div><h2 class="section-title">New arrivals</h2><p class="section-sub mb-0">Fresh designs added this week</p></div>
              <a routerLink="/shop" [queryParams]="{ sort: 'newest' }" class="fw-bold fs-7">View all <i class="bi bi-chevron-right"></i></a>
            </div>
            <wc-scroller>@for (p of h.newArrivals; track p.id) { <wc-product-card [product]="p" /> }</wc-scroller>
          </div>
        </section>
      }
    } @else {
      <div class="container-xxl py-4">
        <div class="skeleton mb-4" style="height: 380px"></div>
        <div class="row g-3">@for (i of [1, 2, 3, 4, 5, 6]; track i) { <div class="col-4 col-md-2"><div class="skeleton" style="aspect-ratio: 1"></div></div> }</div>
      </div>
    }
  `,
  styles: [`
    .hero { background: linear-gradient(180deg, var(--wc-soft) 0%, var(--bs-body-bg) 100%); padding: 3rem 0 2rem; }
    .collage { display: grid; grid-template-columns: 1.3fr 1fr; grid-template-rows: 1fr 1fr; gap: 1rem; height: 440px; }
    .collage .tile { border-radius: 1rem; overflow: hidden; background: var(--wc-soft); }
    .collage .tile img { width: 100%; height: 100%; object-fit: cover; }
    .collage .t0 { grid-row: span 2; }
    @media (max-width: 991.98px) { .collage { height: 300px; } }
    .banner { position: relative; border-radius: 1rem; min-height: 420px; background-size: cover; background-position: center; display: flex; align-items: flex-end; overflow: hidden; }
    .banner::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(20,24,36,0.7) 0%, rgba(20,24,36,0.1) 70%); }
    .banner-copy { position: relative; color: #fff; padding: 2.5rem; max-width: 620px; h1 { color: #fff; font-weight: 800; font-size: clamp(1.6rem, 4vw, 2.75rem); } }
    .dots { position: absolute; bottom: 1rem; right: 1.25rem; display: flex; gap: 0.4rem; button { width: 0.6rem; height: 0.6rem; border-radius: 1rem; border: 0; background: rgba(255,255,255,0.5); } button.on { background: var(--wc-surface); width: 1.4rem; } }
    .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1.25rem; }
    .cat { display: flex; flex-direction: column; align-items: center; text-align: center; color: var(--bs-emphasis-color); }
    .cat-img { width: 100%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; background: var(--wc-soft); border: 1px solid var(--bs-border-color); transition: transform .2s; }
    .cat-img img { width: 100%; height: 100%; object-fit: cover; }
    .cat:hover .cat-img { transform: translateY(-3px); border-color: #3874ff; }
    .promise { background: var(--wc-soft); border-radius: 1rem; padding: 1.5rem 0.5rem; }
    .promise > div { display: flex; gap: 0.75rem; align-items: center; }
    .promise .bi { font-size: 1.75rem; color: #3874ff; }
    .promise b { display: block; color: var(--bs-emphasis-color); } .promise span { font-size: 0.8rem; color: var(--wc-muted); }
    .custom-cta { background: linear-gradient(120deg, #3874ff, #0a3ec2); color: #fff; border-radius: 1rem; padding: 2rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; h3 { color: #fff; } }
  `]
})
export class HomePage {
  protected home = signal<Home | null>(null);
  protected slide = signal(0);
  protected site = inject(SiteService);

  constructor() {
    inject(ApiService).get<Home>('catalog/home').subscribe(h => this.home.set(h));
    const timer = setInterval(() => {
      const n = this.home()?.banners.length ?? 0;
      if (n > 1) this.slide.set((this.slide() + 1) % n);
    }, 6000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
