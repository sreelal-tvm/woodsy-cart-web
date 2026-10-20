import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/store';

@Component({
  selector: 'wc-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container py-5" style="max-width: 460px">
      <div class="text-center mb-4">
        <img src="logo.svg" width="52" height="52" alt="" />
        <h1 class="h3 fw-800 mt-3 mb-1">{{ register() ? 'Create your account' : 'Welcome back' }}</h1>
        <p class="text-muted">{{ register() ? 'Track orders, save addresses and check out faster.' : 'Sign in to continue to WoodsyCart.' }}</p>
      </div>
      <form class="card card-body p-4" (ngSubmit)="submit()">
        @if (register()) {
          <div class="mb-3"><label class="form-label" for="n">Full name</label><input id="n" class="form-control" name="n" [(ngModel)]="fullName" required autocomplete="name" /></div>
          <div class="mb-3"><label class="form-label" for="p">Mobile number</label><input id="p" class="form-control" name="p" [(ngModel)]="phone" inputmode="tel" autocomplete="tel" pattern="(\+?91[ -]?)?0?[6-9][0-9]{4}[ -]?[0-9]{5}" title="10-digit mobile number, e.g. 98765 43210" maxlength="16" /></div>
        }
        <div class="mb-3"><label class="form-label" for="e">Email</label><input id="e" type="email" class="form-control" name="e" [(ngModel)]="email" required autocomplete="email" /></div>
        <div class="mb-3"><label class="form-label" for="pw">Password</label><input id="pw" type="password" class="form-control" name="pw" [(ngModel)]="password" required
          [autocomplete]="register() ? 'new-password' : 'current-password'" />
          @if (register()) { <div class="form-text">At least 8 characters.</div> }</div>
        @if (error()) { <div class="alert alert-danger py-2 fs-7">{{ error() }}</div> }
        <button class="btn btn-primary btn-lg w-100" [disabled]="busy()">{{ busy() ? 'Please wait…' : (register() ? 'Create account' : 'Sign in') }}</button>
        <p class="text-center fs-7 mt-3 mb-0">
          @if (register()) { Already have an account? <a routerLink="/login" [queryParams]="{ returnUrl: returnUrl() }">Sign in</a> }
          @else { New to WoodsyCart? <a routerLink="/register" [queryParams]="{ returnUrl: returnUrl() }">Create an account</a> }
        </p>
      </form>
      <p class="text-center text-muted fs-8 mt-3">Forgot your password? Message us on WhatsApp and we'll help you reset it.</p>
    </div>
  `
})
export class LoginPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly register = input(false);
  readonly returnUrl = input<string>();
  readonly emailParam = input<string>(undefined, { alias: 'email' });
  fullName = ''; phone = ''; email = ''; password = '';
  busy = signal(false);
  error = signal('');

  ngOnInit() {
    if (this.emailParam()) this.email = this.emailParam()!;
  }

  submit() {
    this.busy.set(true);
    this.error.set('');
    const req = this.register()
      ? this.auth.register(this.fullName, this.email, this.phone, this.password)
      : this.auth.login(this.email, this.password);
    req.subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl() || '/'),
      error: e => { this.error.set(e.error?.message ?? 'Something went wrong'); this.busy.set(false); }
    });
  }
}
