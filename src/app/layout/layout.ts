import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ApiService } from '../core/api.service';
import { Category, Offer, OrderSummary } from '../core/models';
import { AuthService, CartService, SiteService, ThemeService, WishlistService } from '../core/store';
import { InitialsPipe, MediaPipe, OrderStatusPipe } from '../shared/shared';
import { InstagramComponent } from '../shared/instagram';

type Menu = '' | 'category' | 'notifications' | 'user';
interface NavLink { label: string; link: string; exact?: boolean; query?: Record<string, string>; highlight?: boolean; }

@Component({
  selector: 'wc-layout',
  imports: [InstagramComponent, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, DatePipe, InitialsPipe, MediaPipe, OrderStatusPipe],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class LayoutComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  protected auth = inject(AuthService);
  protected cart = inject(CartService);
  protected wishlist = inject(WishlistService);
  protected site = inject(SiteService);
  protected theme = inject(ThemeService);

  protected categories = signal<Category[]>([]);
  protected drawerOpen = signal(false);
  protected menu = signal<Menu>('');
  protected year = new Date().getFullYear();
  q = '';

  /** Festival offers running now (adds an "Offers" link to the menu). */
  protected liveOffers = signal<Offer[]>([]);

  protected readonly navLinks = computed<NavLink[]>(() => {
    const offers = this.liveOffers();
    const offerLink: NavLink[] = offers.length === 0 ? []
      : [{ label: offers.length === 1 ? offers[0].name : 'Offers', link: offers.length === 1 ? '/offers/' + offers[0].slug : '/offers', highlight: true }];
    return [...this.baseLinks.slice(0, 2), ...offerLink, ...this.baseLinks.slice(2)];
  });

  private readonly baseLinks: NavLink[] = [
    { label: 'Home', link: '/', exact: true },
    { label: 'Shop', link: '/shop', exact: true },
    { label: 'Deals', link: '/shop', query: { sort: 'discount' } },
    { label: 'Wishlist', link: '/wishlist' },
    { label: 'Shipping info', link: '/policies/shipping' },
    { label: 'Bulk orders', link: '/contact' },
    { label: 'Track order', link: '/track' },
    { label: 'Checkout', link: '/checkout' }
  ];

  /** Order updates for the bell: orders that are still on their way. */
  private orders = signal<OrderSummary[]>([]);
  protected updates = computed(() => this.orders().filter(o => !['Delivered', 'Cancelled', 'Returned'].includes(o.status)).slice(0, 5));

  constructor() {
    this.api.get<Category[]>('catalog/categories').subscribe(c => this.categories.set(c));
    this.api.get<Offer[]>('catalog/offers').subscribe(o => this.liveOffers.set(o));
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.drawerOpen.set(false);
      this.menu.set('');
    });
    effect(() => {
      if (this.auth.isLoggedIn()) this.api.get<OrderSummary[]>('orders').subscribe(o => this.orders.set(o));
      else this.orders.set([]);
    });
    // The page behind the open menu doesn't scroll (also when the menu's own scroll reaches its end)
    effect(() => document.documentElement.classList.toggle('wc-no-scroll', this.drawerOpen()));
  }

  /** Delivery date changed in the last 7 days. */
  recentlyRescheduled(o: OrderSummary) {
    return !!o.deliveryDateChangedAt && Date.now() - new Date(o.deliveryDateChangedAt).getTime() < 7 * 86_400_000;
  }

  /** A link in the menu closes it, also the page already open (e.g. Shop while on the shop page). */
  closeOnLink(e: Event) { if ((e.target as HTMLElement).closest('a')) this.drawerOpen.set(false); }

  toggle(m: Menu) { this.menu.set(this.menu() === m ? '' : m); }

  search() {
    const q = this.q.trim();
    this.router.navigate(['/shop'], { queryParams: q ? { q } : {} });
  }

  logout() {
    this.auth.logout();
    this.menu.set('');
    this.router.navigate(['/']);
  }
}
