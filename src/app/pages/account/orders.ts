import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { OrderSummary } from '../../core/models';
import { SHARED } from '../../shared/shared';

@Component({
  selector: 'wc-orders',
  imports: [RouterLink, DatePipe, ...SHARED],
  template: `
    <h4 class="fw-800 mb-3">My orders</h4>
    @if (orders(); as list) {
      @for (o of list; track o.id) {
        <a class="order-row" [routerLink]="['/order', o.orderNumber]">
          <img [src]="o.firstItemImage | media" alt="" />
          <div class="flex-grow-1 min-w-0">
            <div class="fw-bold text-truncate">{{ o.firstItemName }}{{ o.itemCount > 1 ? ' + ' + (o.itemCount - 1) + ' more' : '' }}</div>
            <div class="text-muted fs-7">#{{ o.orderNumber }} · {{ o.createdAt | date: 'd MMM yyyy' }}</div>
          </div>
          <div class="text-end">
            <div class="fw-800">{{ o.total | inr }}</div>
            <span class="badge-soft" [class]="badge(o.status)">{{ o.status | orderStatus }}</span>
            @if (o.paymentStatus === 'Pending' && o.paymentMethod !== 'CashOnDelivery' && o.status === 'Pending') { <div class="text-danger fs-8 fw-bold mt-1">Payment pending</div> }
          </div>
          <i class="bi bi-chevron-right text-quiet"></i>
        </a>
      } @empty {
        <div class="empty-state"><i class="bi bi-bag"></i><h5>No orders yet</h5><a class="btn btn-primary" routerLink="/shop">Start shopping</a></div>
      }
    } @else { <div class="skeleton" style="height: 200px"></div> }
  `,
  styles: [`.order-row { display: flex; gap: 1rem; align-items: center; border: 1px solid var(--bs-border-color); border-radius: 0.75rem; padding: 0.9rem; margin-bottom: 0.75rem; color: inherit; }
    .order-row:hover { border-color: #9A5226; } .order-row img { width: 64px; height: 64px; object-fit: cover; border-radius: 0.5rem; background: var(--wc-soft); }`]
})
export class OrdersPage {
  protected orders = signal<OrderSummary[] | null>(null);
  constructor() { inject(ApiService).get<OrderSummary[]>('orders').subscribe(o => this.orders.set(o)); }
  badge(s: string) {
    const map: Record<string, string> = { Delivered: 'badge-soft-success', Cancelled: 'badge-soft-secondary', Returned: 'badge-soft-danger', Pending: 'badge-soft-warning' };
    return 'badge-soft ' + (map[s] ?? 'badge-soft-primary');
  }
}
