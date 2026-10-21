import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { OrderDetail, OrderReview } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED } from '../../shared/shared';

interface Draft { rating: number; title: string; comment: string; }
const WORDS = ['', 'Poor', 'Not great', 'Good', 'Very good', 'Excellent'];

/**
 * "Rate your purchase" on a delivered order — one row per product: tap the stars, add a few words, submit.
 * Used on the order page (signed in / access token) and the tracking page (order number + phone).
 */
@Component({
  selector: 'wc-order-reviews',
  imports: [FormsModule, RouterLink, ...SHARED],
  styles: [`
    .rv-item + .rv-item { border-top: 1px solid var(--bs-border-color); padding-top: 1rem; margin-top: 1rem; }
    .rv-stars { display: inline-flex; gap: .15rem; }
    .rv-stars button { background: none; border: 0; padding: .1rem .15rem; font-size: 1.65rem; line-height: 1; color: #f5a524; }
    .rv-stars button:focus-visible { outline: 2px solid #3874ff; border-radius: .35rem; }
    .rv-word { font-weight: 700; font-size: .85rem; min-width: 5.5rem; }
    .rv-mine .bi { color: #f5a524; }
    .rv-card { border-color: color-mix(in srgb, #f5a524 45%, var(--bs-border-color)); }
  `],
  template: `
    <div class="card rv-card mb-4" id="review">
      <div class="card-body">
        <h5 class="fw-800 mb-1"><i class="bi bi-star-fill text-warning me-1"></i>{{ allDone() ? 'Thanks for your reviews!' : 'Rate your purchase' }}</h5>
        <p class="text-muted fs-7 mb-3">{{ allDone() ? 'Reviews show on the product page once we have checked them. You can edit yours any time.' : 'How do you like your furniture? Your rating helps other families in Bengaluru choose.' }}</p>
        @for (i of products(); track i.productId) {
          @let mine = reviewOf(i.productId);
          @let d = draft(i.productId);
          <div class="rv-item">
            <div class="d-flex gap-3 align-items-center mb-2">
              <img [src]="i.imageUrl | media" alt="" class="rounded border" style="flex: none; width: 52px; height: 52px; object-fit: cover" />
              <div class="min-w-0">
                @if (i.slug) { <a class="fw-bold d-block text-truncate" [routerLink]="['/product', i.slug]">{{ i.productName }}</a> } @else { <span class="fw-bold d-block text-truncate">{{ i.productName }}</span> }
                @if (i.variantName) { <span class="text-muted fs-8">{{ i.variantName }}</span> }
              </div>
            </div>
            @if (mine && editing() !== i.productId) {
              <div class="rv-mine fs-7">
                <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <span>@for (s of stars; track s) { <i class="bi" [class.bi-star-fill]="s <= mine.rating" [class.bi-star]="s > mine.rating"></i> }</span>
                  @if (mine.isApproved) { <span class="badge text-bg-success"><i class="bi bi-check2 me-1"></i>Published</span> }
                  @else { <span class="badge text-bg-light border text-muted"><i class="bi bi-hourglass-split me-1"></i>Waiting for approval</span> }
                  <button class="btn btn-link btn-sm p-0 ms-auto" (click)="edit(mine)"><i class="bi bi-pencil me-1"></i>Edit</button>
                </div>
                @if (mine.title) { <div class="fw-bold">{{ mine.title }}</div> }
                @if (mine.comment) { <div class="text-muted" style="white-space: pre-line">{{ mine.comment }}</div> }
              </div>
            } @else {
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <div class="rv-stars" role="radiogroup" [attr.aria-label]="'Rate ' + i.productName">
                  @for (s of stars; track s) {
                    <button type="button" role="radio" [attr.aria-checked]="d.rating === s" [attr.aria-label]="s + ' star' + (s > 1 ? 's' : '') + ' — ' + words[s]" (click)="d.rating = s; open.set(i.productId)">
                      <i class="bi" [class.bi-star-fill]="s <= d.rating" [class.bi-star]="s > d.rating"></i>
                    </button>
                  }
                </div>
                <span class="rv-word" [class.text-muted]="!d.rating">{{ d.rating ? words[d.rating] : 'Tap a star' }}</span>
              </div>
              @if (d.rating && (open() === i.productId || editing() === i.productId)) {
                <form class="mt-2" (ngSubmit)="submit(i.productId)">
                  <input class="form-control form-control-sm mb-2" [name]="'t' + i.productId" [(ngModel)]="d.title" maxlength="200" placeholder="Headline (optional) — e.g. Sturdy and looks great" />
                  <textarea class="form-control form-control-sm mb-2" [name]="'c' + i.productId" [(ngModel)]="d.comment" rows="3" maxlength="4000"
                    placeholder="What do you like? How were the finish, size, delivery and assembly?"></textarea>
                  <div class="d-flex gap-2">
                    <button class="btn btn-primary btn-sm" [disabled]="busy()">{{ busy() ? 'Sending…' : (mine ? 'Update review' : 'Submit review') }}</button>
                    @if (mine) { <button type="button" class="btn btn-phoenix-secondary btn-sm" (click)="editing.set(null)">Cancel</button> }
                  </div>
                </form>
              }
            }
          </div>
        }
      </div>
    </div>
  `
})
export class OrderReviewsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly order = input.required<OrderDetail>();
  /** How this visitor may act on the order: { token } on the order page, { phone } on the tracking page. */
  readonly access = input<Record<string, string | null>>({});

  protected stars = [1, 2, 3, 4, 5];
  protected words = WORDS;
  protected reviews = signal<OrderReview[]>([]);
  protected open = signal<number | null>(null);
  protected editing = signal<number | null>(null);
  protected busy = signal(false);
  private drafts = new Map<number, Draft>();

  /** One row per product (the same product can appear twice in different colours). */
  protected products = computed(() => {
    const seen = new Set<number>();
    return this.order().items.filter(i => !seen.has(i.productId) && seen.add(i.productId));
  });
  protected allDone = computed(() => this.products().every(p => this.reviews().some(r => r.productId === p.productId)));

  constructor() {
    effect(() => this.reviews.set(this.order().reviews ?? []));
  }

  reviewOf(productId: number) { return this.reviews().find(r => r.productId === productId) ?? null; }

  draft(productId: number): Draft {
    let d = this.drafts.get(productId);
    if (!d) this.drafts.set(productId, d = { rating: 0, title: '', comment: '' });
    return d;
  }

  edit(r: OrderReview) {
    Object.assign(this.draft(r.productId), { rating: r.rating, title: r.title ?? '', comment: r.comment ?? '' });
    this.editing.set(r.productId);
  }

  submit(productId: number) {
    const d = this.draft(productId);
    if (!d.rating) return;
    this.busy.set(true);
    this.api.post<OrderReview[]>(`orders/${this.order().orderNumber}/reviews`, { productId, ...d }, this.access()).subscribe({
      next: list => {
        this.reviews.set(list);
        this.editing.set(null);
        this.open.set(null);
        this.busy.set(false);
        this.toast.success('Thank you! Your review will appear once we have checked it.');
      },
      error: () => this.busy.set(false)
    });
  }
}
