import { Component, DestroyRef, Directive, ElementRef, Pipe, PipeTransform, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ProductCard } from '../core/models';
import { WishlistService } from '../core/store';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** "Sreelal M" → "SM", "Sreelal" → "S": first letters of the first and last names (avatars). */
@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(name?: string | null) {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  }
}

@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(v: number | null | undefined): string { return v === null || v === undefined ? '' : inr.format(v); }
}

const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹ with paise — used where the exact amount matters (direct UPI payments). */
@Pipe({ name: 'inr2' })
export class Inr2Pipe implements PipeTransform {
  transform(v: number | null | undefined): string { return v === null || v === undefined ? '' : inr2.format(v); }
}

@Pipe({ name: 'media' })
export class MediaPipe implements PipeTransform {
  private api = inject(ApiService);
  transform(v?: string | null): string { return this.api.media(v); }
}

const statusLabels: Record<string, string> = {
  Pending: 'Order placed', Confirmed: 'Confirmed', PlacedWithVendor: 'Being crafted', Dispatched: 'Dispatched',
  OutForDelivery: 'Out for delivery', Delivered: 'Delivered', Cancelled: 'Cancelled', Returned: 'Returned'
};

@Pipe({ name: 'orderStatus' })
export class OrderStatusPipe implements PipeTransform {
  transform(v?: string | null): string { return statusLabels[v ?? ''] ?? v ?? ''; }
}

@Component({
  selector: 'wc-stars',
  template: `<span class="stars" [attr.aria-label]="value() + ' out of 5'">@for (s of [1, 2, 3, 4, 5]; track s) {<i class="bi" [class.bi-star-fill]="s <= rounded()" [class.bi-star-half]="s - 0.5 === rounded()" [class.bi-star]="s > rounded() + 0.5"></i>}</span>`
})
export class StarsComponent {
  readonly value = input(0);
  rounded() { return Math.round(this.value() * 2) / 2; }
}

@Component({
  selector: 'wc-product-card',
  imports: [RouterLink, InrPipe, MediaPipe, StarsComponent],
  template: `
    @let p = product();
    <div class="product-card">
      <a class="img-wrap d-block" [routerLink]="['/product', p.slug]">
        <img [src]="(p.thumbnailUrl || p.imageUrl) | media" [alt]="p.name" loading="lazy" />
        @if (!p.isAvailable) { <span class="oos-pill badge-off">Sold out</span> }
        @else if (p.discountPercent >= 5) { <span class="off-pill badge-off">{{ p.discountPercent }}% off</span> }
        @if (p.offerName && p.isAvailable) { <span class="offer-ribbon" [style.background]="p.offerColor"><i class="bi bi-stars"></i>{{ p.offerName }}</span> }
      </a>
      <button class="wish" [class.on]="wishlist.has(p.id)" (click)="wishlist.toggle(p.id)" [attr.aria-label]="wishlist.has(p.id) ? 'Remove from wishlist' : 'Save to wishlist'">
        <i class="bi" [class.bi-heart-fill]="wishlist.has(p.id)" [class.bi-heart]="!wishlist.has(p.id)"></i>
      </button>
      <div class="pt-2 d-flex flex-column flex-grow-1">
        <span class="text-muted fs-8 text-uppercase fw-bold">{{ p.categoryName }}</span>
        <a class="name fs-7 mt-1" [routerLink]="['/product', p.slug]">{{ p.name }}</a>
        @if (p.ratingCount) { <div class="mt-1"><wc-stars [value]="p.ratingAverage" /> <span class="text-muted fs-8">({{ p.ratingCount }})</span></div> }
        <div class="mt-auto pt-1 d-flex align-items-baseline gap-2 flex-wrap">
          <span class="price">{{ p.hasVariants ? 'From ' : '' }}{{ p.price | inr }}</span>
          @if (p.discountPercent >= 3) { <span class="mrp">{{ p.mrp | inr }}</span> }
          @else if (p.offerName && p.regularPrice > p.price) { <span class="mrp">{{ p.regularPrice | inr }}</span> }
        </div>
        @if (p.colors.length) {
          <div class="d-flex gap-1 mt-1">@for (c of p.colors; track $index) { <span class="swatch" [style.background]="c.startsWith('#') ? c : '#ccc'" [title]="c"></span> }</div>
        }
      </div>
    </div>
  `
})
export class ProductCardComponent {
  readonly product = input.required<ProductCard>();
  protected wishlist = inject(WishlistService);
}


/**
 * Horizontal row of cards without a scrollbar: arrows on both sides scroll one card at a time
 * (hidden at the ends), and the row can be dragged with the mouse. Touch screens swipe as usual.
 */
@Component({
  selector: 'wc-scroller',
  template: `
    <div class="scroller-wrap">
      @if (canLeft()) {
        <button type="button" class="scroll-arrow left" (click)="page(-1)" aria-label="Scroll left"><i class="bi bi-chevron-left"></i></button>
      }
      <div #track class="scroller" [class.dragging]="dragging()" (scroll)="update()"
           (pointerdown)="dragStart($event)" (pointermove)="dragMove($event)" (pointerup)="dragEnd()" (pointerleave)="dragEnd()">
        <ng-content />
      </div>
      @if (canRight()) {
        <button type="button" class="scroll-arrow right" (click)="page(1)" aria-label="Scroll right"><i class="bi bi-chevron-right"></i></button>
      }
    </div>
  `
})
export class ScrollerComponent {
  private track = viewChild.required<ElementRef<HTMLDivElement>>('track');
  protected canLeft = signal(false);
  protected canRight = signal(false);
  protected dragging = signal(false);
  private drag: { x: number; left: number; moved: boolean } | null = null;
  private justDragged = false;

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.track().nativeElement;
      // Re-check the arrows when the row resizes or its cards change.
      const resize = new ResizeObserver(() => this.update());
      resize.observe(el);
      const mutate = new MutationObserver(() => this.update());
      mutate.observe(el, { childList: true, subtree: true });
      // Capture phase, so a drag never also opens the product under the mouse.
      const click = (e: MouseEvent) => this.swallowClick(e);
      el.addEventListener('click', click, true);
      destroy.onDestroy(() => { resize.disconnect(); mutate.disconnect(); el.removeEventListener('click', click, true); });
      this.update();
    });
  }

  update() {
    const el = this.track().nativeElement;
    this.canLeft.set(el.scrollLeft > 4);
    this.canRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  /** Moves one card at a time, always lining a card up with the edge. */
  page(dir: -1 | 1) {
    const el = this.track().nativeElement;
    const card = el.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = card ? card.offsetWidth + gap : el.clientWidth;
    const target = Math.round(el.scrollLeft / step + dir) * step;
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }

  dragStart(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return; // touch keeps native swiping
    this.drag = { x: e.clientX, left: this.track().nativeElement.scrollLeft, moved: false };
  }

  dragMove(e: PointerEvent) {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x;
    if (!this.drag.moved && Math.abs(dx) < 6) return;
    if (!this.drag.moved) { this.drag.moved = true; this.dragging.set(true); }
    this.track().nativeElement.scrollLeft = this.drag.left - dx;
  }

  dragEnd() {
    if (!this.drag) return;
    this.justDragged = this.drag.moved;
    this.drag = null;
    this.dragging.set(false);
  }

  private swallowClick(e: MouseEvent) {
    if (!this.justDragged) return;
    this.justDragged = false;
    e.preventDefault();
    e.stopPropagation();
  }
}

/** Swipe left / right: a finger or pen (phones, touch-screen laptops) or a two-finger sideways swipe on a trackpad.
 * Emits 1 for the next item (swiped left) and -1 for the previous one. Up / down still scrolls the page. */
@Directive({
  selector: '[wcSwipe]',
  host: { '(pointerdown)': 'down($event)', '(pointerup)': 'up($event)', '(pointercancel)': 'cancel()', '(wheel)': 'wheel($event)', '[style.touch-action]': '"pan-y"' }
})
export class SwipeDirective {
  readonly wcSwipe = output<number>();
  private start: { x: number; y: number; at: number } | null = null;
  private wheelX = 0;
  private wheelUntil = 0;
  private wheelAt = 0;

  protected down(e: PointerEvent) { this.start = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY, at: Date.now() }; }
  protected cancel() { this.start = null; }

  protected up(e: PointerEvent) {
    const s = this.start;
    this.start = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    // A quick sideways move of at least 40px that is clearly more sideways than up / down
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - s.at < 1000) this.wcSwipe.emit(dx < 0 ? 1 : -1);
  }

  protected wheel(e: WheelEvent) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // up / down: the page scrolls as usual
    e.preventDefault();                                       // no browser "back" gesture while swiping photos
    const now = Date.now();
    if (now < this.wheelUntil) return;                        // one photo per swipe
    if (now - this.wheelAt > 300) this.wheelX = 0;            // a new gesture
    this.wheelAt = now;
    this.wheelX += e.deltaX;
    if (Math.abs(this.wheelX) >= 60) {
      this.wcSwipe.emit(this.wheelX > 0 ? 1 : -1);
      this.wheelX = 0;
      this.wheelUntil = now + 600;
    }
  }
}

export const SHARED = [InitialsPipe, InrPipe, Inr2Pipe, MediaPipe, OrderStatusPipe, StarsComponent, ProductCardComponent, ScrollerComponent, SwipeDirective];
