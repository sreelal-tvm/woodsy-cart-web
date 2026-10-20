import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { User } from '../../core/models';
import { AuthService } from '../../core/store';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'wc-profile',
  imports: [FormsModule],
  template: `
    <h4 class="fw-800 mb-3">Profile</h4>
    <div class="card mb-4"><div class="card-body">
      <form class="row g-3" (ngSubmit)="save()">
        <div class="col-md-6"><label class="form-label">Full name</label><input class="form-control" name="n" [(ngModel)]="name" required /></div>
        <div class="col-md-6"><label class="form-label">Mobile</label><input class="form-control" name="p" [(ngModel)]="phone" inputmode="tel" pattern="(\+?91[ -]?)?0?[6-9][0-9]{4}[ -]?[0-9]{5}" title="10-digit mobile number, e.g. 98765 43210" maxlength="16" /></div>
        <div class="col-md-6"><label class="form-label">Email</label><input class="form-control" [value]="auth.user()?.email" disabled /></div>
        <div class="col-12"><button class="btn btn-primary">Save profile</button></div>
      </form>
    </div></div>
    <h5 class="fw-800 mb-3">Change password</h5>
    <div class="card"><div class="card-body">
      <form class="row g-3" (ngSubmit)="changePassword()">
        <div class="col-md-6"><label class="form-label">Current password</label><input type="password" class="form-control" name="c" [(ngModel)]="pw.currentPassword" autocomplete="current-password" /></div>
        <div class="col-md-6"><label class="form-label">New password</label><input type="password" class="form-control" name="n2" [(ngModel)]="pw.newPassword" autocomplete="new-password" />
          <div class="form-text">At least 8 characters.</div></div>
        <div class="col-12"><button class="btn btn-phoenix-secondary" [disabled]="pw.newPassword.length < 8">Update password</button></div>
      </form>
    </div></div>
  `
})
export class ProfilePage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  name = this.auth.user()?.fullName ?? '';
  phone = this.auth.user()?.phone ?? '';
  pw = { currentPassword: '', newPassword: '' };

  save() {
    this.api.put<User>('auth/me', { fullName: this.name, phone: this.phone }).subscribe(u => { this.auth.updateUser(u); this.toast.success('Profile saved'); });
  }

  changePassword() {
    this.api.post('auth/change-password', this.pw).subscribe(() => { this.pw = { currentPassword: '', newPassword: '' }; this.toast.success('Password updated'); });
  }
}
