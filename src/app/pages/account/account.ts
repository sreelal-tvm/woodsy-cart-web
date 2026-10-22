import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/store';

@Component({
  selector: 'wc-account',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="container-xxl py-4">
      <div class="d-flex align-items-center gap-3 mb-4">
        <span class="big-avatar">{{ auth.user()?.fullName?.charAt(0) }}</span>
        <div><h1 class="h3 fw-800 mb-0">{{ auth.user()?.fullName }}</h1><span class="text-muted fs-7">{{ auth.user()?.email }}</span></div>
      </div>
      <div class="row g-4">
        <div class="col-lg-3">
          <nav class="list-group">
            <a class="list-group-item list-group-item-action" routerLink="orders" routerLinkActive="active"><i class="bi bi-bag-check me-2"></i>My orders</a>
            <a class="list-group-item list-group-item-action" routerLink="/wishlist"><i class="bi bi-heart me-2"></i>Wishlist</a>
            <a class="list-group-item list-group-item-action" routerLink="addresses" routerLinkActive="active"><i class="bi bi-geo-alt me-2"></i>Addresses</a>
            <a class="list-group-item list-group-item-action" routerLink="profile" routerLinkActive="active"><i class="bi bi-person me-2"></i>Profile & password</a>
            <button class="list-group-item list-group-item-action text-danger" (click)="logout()"><i class="bi bi-box-arrow-right me-2"></i>Sign out</button>
          </nav>
        </div>
        <div class="col-lg-9"><router-outlet /></div>
      </div>
    </div>
  `,
  styles: [`.big-avatar { width: 3.5rem; height: 3.5rem; border-radius: 50%; background: #9A5226; color: #fff; font-weight: 800; font-size: 1.5rem; display: flex; align-items: center; justify-content: center; }
    .list-group-item { font-weight: 700; } .list-group-item.active { background: var(--wc-soft-primary); color: #9A5226; border-color: var(--bs-border-color); }`]
})
export class AccountPage {
  protected auth = inject(AuthService);
  private router = inject(Router);
  logout() { this.auth.logout(); this.router.navigate(['/']); }
}
