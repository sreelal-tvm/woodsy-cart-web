import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ProductCard } from '../core/models';
import { WishlistService } from '../core/store';
import { SHARED } from '../shared/shared';

@Component({
  selector: 'wc-wishlist',
  imports: [RouterLink, ...SHARED],
  template: `
    <div class="container-xxl py-4">
      <h1 class="h2 fw-800 mb-4">Wishlist <span class="text-muted fs-5">({{ visible().length }})</span></h1>
      <div class="row g-3 g-md-4 row-cols-2 row-cols-md-3 row-cols-xl-5">
        @for (p of visible(); track p.id) { <div class="col"><wc-product-card [product]="p" /></div> }
      </div>
      @if (loaded() && !visible().length) {
        <div class="empty-state"><i class="bi bi-heart"></i><h4>Your wishlist is empty</h4><p>Tap the heart on any product to save it for later.</p><a class="btn btn-primary" routerLink="/shop">Explore furniture</a></div>
      }
    </div>
  `
})
export class WishlistPage {
  private api = inject(ApiService);
  private wishlist = inject(WishlistService);
  protected items = signal<ProductCard[]>([]);
  protected loaded = signal(false);
  protected visible = signal<ProductCard[]>([]);

  constructor() {
    this.api.get<ProductCard[]>('account/wishlist').subscribe(i => { this.items.set(i); this.loaded.set(true); });
    effect(() => {
      const ids = this.wishlist.ids();
      this.visible.set(this.items().filter(p => ids.has(p.id)));
    });
  }
}
