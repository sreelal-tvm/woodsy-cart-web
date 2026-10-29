import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ApiService } from '../core/api.service';
import { Facets, Paged, ProductCard } from '../core/models';
import { SHARED } from '../shared/shared';

const PAGE_SIZE = 24;

@Component({
  selector: 'wc-shop',
  host: { '(window:popstate)': 'onPopState()' },
  imports: [FormsModule, RouterLink, ...SHARED],
  template: `
    <div class="container-xxl py-4">
      <nav class="fs-7 mb-2"><a routerLink="/">Home</a> <i class="bi bi-chevron-right text-quiet mx-1"></i>
        <span class="text-muted">{{ heading() }}</span></nav>
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <h1 class="h2 fw-800 mb-0">{{ heading() }}</h1>
          <span class="text-muted fs-7">{{ result().total }} products</span>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <button class="btn btn-phoenix-secondary btn-sm d-lg-none" (click)="openFilters()"><i class="bi bi-funnel me-1"></i>Filters @if (activeFilterCount()) { ({{ activeFilterCount() }}) }</button>
          <select class="form-select form-select-sm w-auto" [ngModel]="sort() || 'popular'" (ngModelChange)="go({ sort: $event === 'popular' ? null : $event })" aria-label="Sort">
            <option value="popular">Most popular</option><option value="newest">Newest</option><option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option><option value="discount">Biggest discount</option><option value="rating">Top rated</option>
          </select>
        </div>
      </div>

      <div class="row g-4">
        <aside class="col-lg-3 filters" [class.open]="filtersOpen()">
          <div class="d-flex justify-content-between align-items-center d-lg-none mb-3">
            <h5 class="mb-0">Filters</h5><button class="btn-close" (click)="closeFilters()" aria-label="Close filters"></button>
          </div>
          @if (activeFilterCount()) { <button class="btn btn-sm btn-link px-0 mb-2" (click)="clearAll()">Clear all filters</button> }
          @if (facets(); as f) {
            <div class="filter-block">
              <h6>Category</h6>
              <a class="filter-link" [class.active]="!category()" (click)="go({ category: null })">All furniture</a>
              @for (c of f.categories; track c.key) {
                <a class="filter-link" [class.active]="category() === c.key" (click)="go({ category: c.key })">{{ c.label }} <span>{{ c.count }}</span></a>
              }
            </div>
            <div class="filter-block">
              <h6>Price</h6>
              <div class="d-flex gap-2 align-items-center">
                <input type="number" class="form-control form-control-sm" placeholder="Min" [(ngModel)]="minInput" />
                <span class="text-muted">–</span>
                <input type="number" class="form-control form-control-sm" placeholder="Max" [(ngModel)]="maxInput" />
                <button class="btn btn-sm btn-soft-primary" (click)="go({ minPrice: minInput || null, maxPrice: maxInput || null })">Go</button>
              </div>
              <div class="d-flex flex-wrap gap-1 mt-2">
                @for (b of priceBands; track b.label) { <button class="chip" [class.on]="isBand(b)" (click)="go({ minPrice: b.min, maxPrice: b.max })">{{ b.label }}</button> }
              </div>
            </div>
            @if (f.colors.length) {
              <div class="filter-block">
                <h6>Colour / finish</h6>
                <div class="d-flex flex-wrap gap-1">
                  @for (c of f.colors; track c.key) {
                    <button class="chip" [class.on]="selected(colors(), c.key)" (click)="toggleList('colors', colors(), c.key)">
                      <span class="sw" [style.background]="c.extra || '#ddd'"></span>{{ c.label }}
                    </button>
                  }
                </div>
              </div>
            }
            @if (f.sizes.length) {
              <div class="filter-block">
                <h6>Size</h6>
                <div class="d-flex flex-wrap gap-1">
                  @for (s of f.sizes; track s.key) { <button class="chip" [class.on]="selected(sizes(), s.key)" (click)="toggleList('sizes', sizes(), s.key)">{{ s.label }}</button> }
                </div>
              </div>
            }
            <div class="filter-block">
              <h6>More</h6>
              <div class="form-check"><input class="form-check-input" type="checkbox" id="stk" [checked]="inStock() === 'true'" (change)="go({ inStock: inStock() === 'true' ? null : true })" /><label class="form-check-label" for="stk">In stock only</label></div>
              <div class="form-check"><input class="form-check-input" type="checkbox" id="dis" [checked]="minDiscount() === '20'" (change)="go({ minDiscount: minDiscount() === '20' ? null : 20 })" /><label class="form-check-label" for="dis">20% off or more</label></div>
              <div class="form-check"><input class="form-check-input" type="checkbox" id="fea" [checked]="featured() === 'true'" (change)="go({ featured: featured() === 'true' ? null : true })" /><label class="form-check-label" for="fea">Best sellers</label></div>
            </div>
          }
          <button class="btn btn-primary w-100 d-lg-none mt-2" (click)="closeFilters()">Show {{ result().total }} products</button>
        </aside>

        <div class="col-lg-9">
          @if (q()) { <p class="mb-3">Results for <b>"{{ q() }}"</b> <a class="fs-7 ms-2" (click)="go({ q: null })" role="button">clear search</a></p> }
          @if (loading() && !result().items.length) {
            <div class="row g-3 row-cols-2 row-cols-md-3 row-cols-xl-4">@for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) { <div class="col"><div class="skeleton" style="aspect-ratio: 0.75"></div></div> }</div>
          } @else {
            <div class="row g-3 g-md-4 row-cols-2 row-cols-md-3 row-cols-xl-4" [style.opacity]="loading() ? 0.5 : 1">
              @for (p of result().items; track p.id) { <div class="col"><wc-product-card [product]="p" /></div> }
            </div>
            @if (!result().items.length) {
              <div class="empty-state"><i class="bi bi-search"></i><h5>No furniture matches these filters</h5><button class="btn btn-primary mt-2" (click)="clearAll()">Clear filters</button></div>
            }
          }
          @if (pages() > 1) {
            <nav class="d-flex justify-content-center gap-1 mt-5" aria-label="Pages">
              <button class="btn btn-phoenix-secondary btn-sm" [disabled]="currentPage() <= 1" (click)="go({ page: currentPage() - 1 }, false)"><i class="bi bi-chevron-left"></i></button>
              @for (p of pageList(); track p) {
                <button class="btn btn-sm" [class.btn-primary]="p === currentPage()" [class.btn-phoenix-secondary]="p !== currentPage()" (click)="go({ page: p }, false)">{{ p }}</button>
              }
              <button class="btn btn-phoenix-secondary btn-sm" [disabled]="currentPage() >= pages()" (click)="go({ page: currentPage() + 1 }, false)"><i class="bi bi-chevron-right"></i></button>
            </nav>
          }
        </div>
      </div>
    </div>
    @if (filtersOpen()) { <div class="filters-backdrop d-lg-none" (click)="closeFilters()"></div> }
  `,
  styles: [`
    .filter-block { border-bottom: 1px solid var(--bs-border-color); padding: 1rem 0; h6 { font-weight: 800; margin-bottom: 0.6rem; } }
    .filter-link { display: flex; justify-content: space-between; padding: 0.3rem 0; color: var(--bs-body-color); cursor: pointer; font-size: 0.875rem; span { color: #A39283; font-size: 0.75rem; } &.active { color: #9A5226; font-weight: 800; } }
    .chip { border: 1px solid var(--wc-border-strong); background: var(--wc-surface); border-radius: 2rem; padding: 0.25rem 0.7rem; font-size: 0.78rem; font-weight: 700; color: var(--bs-body-color); display: inline-flex; align-items: center; gap: 0.35rem; &.on { border-color: #9A5226; background: var(--wc-soft-primary); color: #9A5226; } }
    .sw { width: 0.8rem; height: 0.8rem; border-radius: 50%; border: 1px solid rgba(0,0,0,.15); }
    @media (max-width: 991.98px) {
      .filters { position: fixed; inset: 0 0 0 auto; width: min(340px, 90vw); background: var(--wc-surface); z-index: 1065; overflow-y: auto; padding: 1.25rem; transform: translateX(100%); transition: transform .2s; }
      .filters.open { transform: none; }
      .filters-backdrop { position: fixed; inset: 0; background: rgba(42, 33, 28,.45); z-index: 1060; }
    }
  `]
})
export class ShopPage {
  private api = inject(ApiService);
  private router = inject(Router);
  private title = inject(Title);

  // Query params (bound by the router)
  readonly q = input<string>();
  readonly category = input<string>();
  readonly collection = input<string>();
  readonly sort = input<string>();
  readonly minPrice = input<string>();
  readonly maxPrice = input<string>();
  readonly colors = input<string>();
  readonly sizes = input<string>();
  readonly inStock = input<string>();
  readonly featured = input<string>();
  readonly minDiscount = input<string>();
  readonly page = input<string>();

  protected result = signal<Paged<ProductCard>>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  protected facets = signal<Facets | null>(null);
  protected loading = signal(true);
  protected filtersOpen = signal(false);
  /** Phones: the open filter panel has one history entry of its own, so Back closes it (keeping the filters chosen in it)
   * instead of undoing the filters one by one. Filters changed while it is open replace that entry. */
  private panelEntry = false;
  private shownUrl = '';
  private keepUrl: string | null = null;
  minInput: number | null = null;
  maxInput: number | null = null;

  protected priceBands = [
    { label: 'Under ₹10k', min: null, max: 10000 }, { label: '₹10k–25k', min: 10000, max: 25000 },
    { label: '₹25k–50k', min: 25000, max: 50000 }, { label: 'Above ₹50k', min: 50000, max: null }
  ];

  protected currentPage = computed(() => Number(this.page() ?? 1) || 1);
  protected pages = computed(() => Math.ceil(this.result().total / PAGE_SIZE));
  protected pageList = computed(() => {
    const last = this.pages(), cur = this.currentPage();
    const start = Math.max(1, Math.min(cur - 2, last - 4));
    return Array.from({ length: Math.min(5, last) }, (_, i) => start + i);
  });
  protected heading = computed(() => {
    const c = this.category();
    const label = c ? this.facets()?.categories.find(x => x.key === c)?.label : null;
    if (label) return label;
    if (this.featured() === 'true') return 'Best sellers';
    if (this.sort() === 'discount') return 'Deals';
    return this.q() ? 'Search results' : 'All furniture';
  });
  protected activeFilterCount = computed(() =>
    [this.category(), this.minPrice() || this.maxPrice(), this.colors(), this.sizes(), this.inStock(), this.featured(), this.minDiscount(), this.collection()].filter(Boolean).length);

  constructor() {
    effect(() => {
      const query = {
        search: this.q(), category: this.category(), collection: this.collection(), sort: this.sort(), minPrice: this.minPrice(), maxPrice: this.maxPrice(),
        colors: this.colors(), sizes: this.sizes(), inStock: this.inStock(), featured: this.featured(), minDiscount: this.minDiscount(),
        page: this.currentPage(), pageSize: PAGE_SIZE
      };
      this.minInput = this.minPrice() ? Number(this.minPrice()) : null;
      this.maxInput = this.maxPrice() ? Number(this.maxPrice()) : null;
      this.loading.set(true);
      this.api.get<Paged<ProductCard>>('catalog/products', query).subscribe(r => { this.result.set(r); this.loading.set(false); });
      this.api.get<Facets>('catalog/facets', { search: query.search, category: query.category, collection: query.collection, inStock: query.inStock, featured: query.featured })
        .subscribe(f => this.facets.set(f));
    });
    effect(() => this.title.setTitle(`${this.heading()} · WoodsyCart`));
    this.shownUrl = this.router.url;
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.shownUrl = this.router.url);
  }

  openFilters() {
    this.filtersOpen.set(true);
    if (!this.panelEntry) { history.pushState(history.state, ''); this.panelEntry = true; }
  }

  /** ✕, "Show … products", the backdrop: the same as Back. */
  closeFilters() {
    if (this.panelEntry) history.back();
    else this.filtersOpen.set(false);
  }

  /** Back while the panel is open lands on the entry from before it opened: close the panel and keep the filters. */
  protected onPopState() {
    if (!this.panelEntry) return;
    this.panelEntry = false;
    this.filtersOpen.set(false);
    const keep = this.keepUrl ?? this.shownUrl;
    this.keepUrl = null;
    // After the router's own Back navigation (it starts on the next tick), so this one wins
    if (keep && keep !== location.pathname + location.search) setTimeout(() => this.router.navigateByUrl(keep, { replaceUrl: true }));
  }

  go(params: Record<string, unknown>, resetPage = true) {
    this.router.navigate(['/shop'], { queryParams: { ...params, ...(resetPage ? { page: null } : {}) }, queryParamsHandling: 'merge', replaceUrl: this.panelEntry });
    if (!resetPage) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  isBand(b: { min: number | null; max: number | null }) {
    return (this.minPrice() ?? null) === (b.min === null ? null : String(b.min)) && (this.maxPrice() ?? null) === (b.max === null ? null : String(b.max));
  }

  selected(list: string | undefined, key: string) { return (list ?? '').split(',').includes(key); }

  toggleList(param: 'colors' | 'sizes', list: string | undefined, key: string) {
    const items = (list ?? '').split(',').filter(Boolean);
    const next = items.includes(key) ? items.filter(i => i !== key) : [...items, key];
    this.go({ [param]: next.length ? next.join(',') : null });
  }

  clearAll() {
    const tree = this.router.createUrlTree(['/shop'], { queryParams: this.q() ? { q: this.q() } : {} });
    if (this.panelEntry) { this.keepUrl = this.router.serializeUrl(tree); this.closeFilters(); }
    else this.router.navigateByUrl(tree);
  }
}
