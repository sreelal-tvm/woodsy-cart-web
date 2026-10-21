import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { AuthResponse, CartLine, SiteSettings } from './models';
import { ToastService } from './toast.service';

const AUTH_KEY = 'wc_auth';
const CART_KEY = 'wc_cart';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private state = signal<AuthResponse | null>(read<AuthResponse | null>(AUTH_KEY, null));
  readonly user = computed(() => this.state()?.user ?? null);
  readonly token = computed(() => this.state()?.token ?? null);
  readonly isLoggedIn = computed(() => {
    const s = this.state();
    return !!s && new Date(s.expiresAt) > new Date();
  });

  private persist(res: AuthResponse | null) {
    this.state.set(res);
    if (res) localStorage.setItem(AUTH_KEY, JSON.stringify(res));
    else localStorage.removeItem(AUTH_KEY);
  }

  login(email: string, password: string) {
    return this.api.post<AuthResponse>('auth/login', { email, password }).pipe(tap(r => this.persist(r)));
  }

  /** Emails a reset link (the answer is the same whether or not the email has an account). */
  forgotPassword(email: string) {
    return this.api.post<{ message: string }>('auth/forgot-password', { email });
  }

  /** Sets the new password from the emailed link and signs the customer in. */
  resetPassword(email: string, token: string, newPassword: string) {
    return this.api.post<AuthResponse>('auth/reset-password', { email, token, newPassword }).pipe(tap(r => this.persist(r)));
  }

  register(fullName: string, email: string, phone: string, password: string) {
    return this.api.post<AuthResponse>('auth/register', { fullName, email, phone, password }).pipe(tap(r => this.persist(r)));
  }

  updateUser(user: AuthResponse['user']) {
    const s = this.state();
    if (s) this.persist({ ...s, user });
  }

  logout() { this.persist(null); }
}

/** Cart lives in localStorage for guests and is mirrored to the server for signed-in customers. */
@Injectable({ providedIn: 'root' })
export class CartService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  readonly lines = signal<CartLine[]>(read<CartLine[]>(CART_KEY, []));
  readonly count = computed(() => this.lines().reduce((s, l) => s + l.quantity, 0));
  private syncedFor: number | null = null;

  constructor() {
    effect(() => localStorage.setItem(CART_KEY, JSON.stringify(this.lines())));
    effect(() => {
      const user = this.auth.user();
      if (user && this.syncedFor !== user.id) {
        this.syncedFor = user.id;
        this.mergeFromServer();
      }
      if (!user) this.syncedFor = null;
    });
  }

  private mergeFromServer() {
    this.api.get<CartLine[]>('account/cart').subscribe(server => {
      const merged = [...this.lines()];
      for (const s of server)
        if (!merged.some(l => l.productId === s.productId && (l.variantId ?? null) === (s.variantId ?? null))) merged.push(s);
      this.lines.set(merged);
      this.push();
    });
  }

  private push() {
    if (this.auth.isLoggedIn()) this.api.put('account/cart', this.lines()).subscribe();
  }

  add(productId: number, variantId: number | null | undefined, quantity = 1) {
    const lines = [...this.lines()];
    const existing = lines.find(l => l.productId === productId && (l.variantId ?? null) === (variantId ?? null));
    if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
    else lines.push({ productId, variantId: variantId ?? null, quantity });
    this.lines.set(lines.map(l => ({ ...l })));
    this.push();
  }

  setQuantity(productId: number, variantId: number | null | undefined, quantity: number) {
    this.lines.set(this.lines()
      .map(l => l.productId === productId && (l.variantId ?? null) === (variantId ?? null) ? { ...l, quantity: Math.max(1, Math.min(20, quantity)) } : l));
    this.push();
  }

  remove(productId: number, variantId: number | null | undefined) {
    this.lines.set(this.lines().filter(l => !(l.productId === productId && (l.variantId ?? null) === (variantId ?? null))));
    this.push();
  }

  clear(productIds?: number[]) {
    this.lines.set(productIds ? this.lines().filter(l => !productIds.includes(l.productId)) : []);
    this.push();
  }
}

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly ids = signal<Set<number>>(new Set());

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) this.api.get<number[]>('account/wishlist/ids').subscribe(ids => this.ids.set(new Set(ids)));
      else this.ids.set(new Set());
    });
  }

  has(id: number) { return this.ids().has(id); }

  toggle(id: number) {
    if (!this.auth.isLoggedIn()) {
      this.toast.info('Sign in to save items to your wishlist');
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const on = this.has(id);
    const next = new Set(this.ids());
    if (on) next.delete(id); else next.add(id);
    this.ids.set(next);
    (on ? this.api.delete(`account/wishlist/${id}`) : this.api.post(`account/wishlist/${id}`)).subscribe();
    if (!on) this.toast.success('Saved to wishlist');
  }
}

/** Remembers access tokens of orders placed as a guest on this device, so the order page works without signing in. */
export const GuestOrders = {
  key: 'wc_guest_orders',
  all(): Record<string, string> { return read<Record<string, string>>(this.key, {}); },
  get(orderNumber: string): string | null { return this.all()[orderNumber] ?? null; },
  save(orderNumber: string, token: string) {
    const all = this.all();
    all[orderNumber] = token;
    localStorage.setItem(this.key, JSON.stringify(all));
  }
};

/** Light/dark theme (Phoenix-style toggle in the header). The choice is remembered on this device. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal(localStorage.getItem('wc_theme') === 'dark');

  constructor() {
    effect(() => {
      const dark = this.dark();
      document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f111a' : '#3874ff');
      localStorage.setItem('wc_theme', dark ? 'dark' : 'light');
    });
  }

  toggle() { this.dark.update(d => !d); }
}

@Injectable({ providedIn: 'root' })
export class SiteService {
  private api = inject(ApiService);
  readonly settings = signal<SiteSettings | null>(null);
  constructor() { this.api.get<SiteSettings>('site/settings').subscribe(s => this.settings.set(s)); }

  whatsAppLink(text = 'Hi WoodsyCart! I have a question.') {
    const s = this.settings();
    const n = (s?.whatsApp || s?.phone || '').replace(/\D/g, '');
    if (!n) return null;
    return `https://wa.me/${n.length === 10 ? '91' + n : n}?text=${encodeURIComponent(text)}`;
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && token) {
        auth.logout();
        toast.error('Please sign in again.');
      } else if (err.status === 0) {
        toast.error('We could not reach WoodsyCart. Check your connection.');
      } else if (err.error?.message && err.status !== 404) {
        toast.error(err.error.message);
      }
      return throwError(() => err);
    })
  );
};

export const authGuard: CanActivateFn = (_, state) => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
