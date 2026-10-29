import { Component, computed, inject, input } from '@angular/core';
import { SiteService } from '../core/store';

/**
 * "Follow us on Instagram" in different sizes. Shows nothing until an Instagram link is set in Admin → Business settings.
 * banner = big home-page section · card = thank-you page · inline = product page line · icon = header button · float = floating button
 */
@Component({
  selector: 'wc-instagram',
  styles: [`
    :host { display: contents; }
    .ig-grad { background: linear-gradient(45deg, #f9ce34 0%, #ee2a7b 45%, #6228d7 100%); color: #fff; }
    .ig-icon { width: 2.4rem; height: 2.4rem; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 1.15rem;
      box-shadow: 0 2px 8px rgba(238, 42, 123, .35); transition: transform .15s; }
    .ig-icon:hover { transform: scale(1.08); color: #fff; }
    /* Phones: the floating button already shows Instagram — keep the header roomy for cart / account */
    @media (max-width: 575.98px) { .ig-icon.ig-header { display: none; } }
    /* Same size and right edge as the WhatsApp button (styles.scss .wa-float), stacked 0.65rem above it */
    .ig-float { position: fixed; right: 1rem; bottom: calc(1rem + 2.85rem + .65rem); z-index: 1030; width: 2.85rem; height: 2.85rem; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 1.35rem; border: 0; outline: 0;
      box-shadow: 0 6px 16px rgba(238, 42, 123, .35); animation: ig-pulse 2.6s ease-in-out 3; }
    .ig-float:focus-visible { outline: 2px solid #ee2a7b; outline-offset: 2px; }
    .ig-float:hover { color: #fff; transform: scale(1.06); }
    @keyframes ig-pulse { 0%, 100% { box-shadow: 0 6px 16px rgba(238, 42, 123, .35); } 50% { box-shadow: 0 6px 22px 5px rgba(238, 42, 123, .4); } }
    @media (max-width: 991.98px) {
      .ig-float { bottom: calc(4.6rem + 2.85rem + .65rem); }
      :host-context(body.has-sticky-buy) .ig-float { bottom: calc(8.25rem + 2.85rem + .65rem); }
      :host-context(body.floats-left) .ig-float { right: auto; left: 1rem; }
    }
    .ig-banner { border-radius: 1rem; padding: 1.8rem 2rem; display: flex; flex-wrap: wrap; align-items: center; gap: 1.25rem; }
    .ig-banner .big { font-size: 2.6rem; line-height: 1; }
    .ig-banner h3 { color: #fff; font-weight: 800; margin: 0 0 .25rem; }
    .ig-banner p { margin: 0; opacity: .95; }
    .ig-btn { background: #fff; color: #c13584; font-weight: 800; border-radius: 2rem; padding: .6rem 1.4rem; white-space: nowrap; }
    .ig-btn:hover { background: #fff; color: #833ab4; }
    .ig-card { border-radius: .9rem; padding: 1rem 1.25rem; display: flex; flex-wrap: wrap; align-items: center; gap: .9rem; }
    .ig-card .bi-instagram { font-size: 1.8rem; }
    .ig-inline { display: flex; align-items: center; gap: .6rem; padding: .6rem .85rem; border: 1px solid var(--bs-border-color); border-radius: .75rem; color: var(--bs-body-color); }
    .ig-inline:hover { border-color: #ee2a7b; color: var(--bs-emphasis-color); }
    .ig-inline .ig-icon { width: 2rem; height: 2rem; font-size: 1rem; flex: none; }
  `],
  template: `
    @if (url(); as u) {
      @switch (variant()) {
        @case ('icon') {
          <a class="ig-icon ig-header ig-grad" [href]="u" target="_blank" rel="noopener" [attr.aria-label]="'Follow ' + handle() + ' on Instagram'" [title]="'Follow ' + handle() + ' on Instagram'"><i class="bi bi-instagram"></i></a>
        }
        @case ('float') {
          <a class="ig-float ig-grad" [href]="u" target="_blank" rel="noopener" [attr.aria-label]="'Follow ' + handle() + ' on Instagram'" [title]="'Follow us on Instagram'"><i class="bi bi-instagram"></i></a>
        }
        @case ('banner') {
          <div class="ig-banner ig-grad">
            <i class="bi bi-instagram big"></i>
            <div class="flex-grow-1" style="min-width: 220px">
              <h3>Follow us on Instagram</h3>
              <p>New arrivals, real customer homes and festive offers — posted first on <b>{{ handle() }}</b>.</p>
            </div>
            <a class="btn ig-btn" [href]="u" target="_blank" rel="noopener"><i class="bi bi-instagram me-1"></i>Follow {{ handle() }}</a>
          </div>
        }
        @case ('card') {
          <div class="ig-card ig-grad">
            <i class="bi bi-instagram"></i>
            <div class="flex-grow-1" style="min-width: 200px">
              <div class="fw-bold">Get offers & new arrivals first</div>
              <div class="fs-7" style="opacity: .95">Follow {{ handle() }} on Instagram — and tag us when your furniture arrives!</div>
            </div>
            <a class="btn ig-btn btn-sm" [href]="u" target="_blank" rel="noopener">Follow</a>
          </div>
        }
        @default {
          <a class="ig-inline" [href]="u" target="_blank" rel="noopener">
            <span class="ig-icon ig-grad"><i class="bi bi-instagram"></i></span>
            <span class="fs-7"><b>See it in real homes</b> — photos & videos on Instagram <span class="text-muted">{{ handle() }}</span></span>
            <i class="bi bi-chevron-right ms-auto text-muted"></i>
          </a>
        }
      }
    }
  `
})
export class InstagramComponent {
  readonly variant = input<'banner' | 'card' | 'inline' | 'icon' | 'float'>('inline');
  private site = inject(SiteService);
  protected url = computed(() => this.site.settings()?.instagramUrl?.trim() || null);
  /** "@vaidehi.mantra" from https://www.instagram.com/vaidehi.mantra/ */
  protected handle = computed(() => {
    const m = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(this.url() ?? '');
    return m ? '@' + m[1] : 'us';
  });
}
