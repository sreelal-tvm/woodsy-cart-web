import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Address, PincodeCheck } from '../../core/models';

export const emptyAddress = (): Address => ({
  id: 0, label: 'Home', fullName: '', phone: '', line1: '', line2: '', landmark: '', city: 'Bengaluru', state: 'Karnataka', pincode: '', isDefault: false
});

@Component({
  selector: 'wc-address-form',
  imports: [FormsModule],
  template: `
    @let a = address();
    <form (ngSubmit)="save()" #f="ngForm">
      <div class="row g-2">
        <div class="col-md-6"><label class="form-label">Full name</label><input class="form-control" name="n" [(ngModel)]="a.fullName" required autocomplete="name" /></div>
        <div class="col-md-6"><label class="form-label">Mobile number</label><input class="form-control" name="p" #ph="ngModel" [(ngModel)]="a.phone" [class.is-invalid]="ph.invalid && ph.touched" required inputmode="tel" maxlength="16" autocomplete="tel" pattern="(\+?91[ -]?)?0?[6-9][0-9]{4}[ -]?[0-9]{5}" title="10-digit mobile number, e.g. 98765 43210" />
          @if (ph.invalid && ph.touched) { <div class="invalid-feedback d-block">Enter a 10-digit mobile number — we use it for delivery and order tracking.</div> }</div>
        <div class="col-md-4">
          <label class="form-label">Pincode</label>
          <input class="form-control" name="pin" [(ngModel)]="a.pincode" required maxlength="6" inputmode="numeric" (blur)="checkPin()" autocomplete="postal-code" />
          @if (pin(); as r) { <div class="fs-8 mt-1" [class.text-success]="r.serviceable" [class.text-danger]="!r.serviceable">{{ r.message }}</div> }
        </div>
        <div class="col-md-4"><label class="form-label">City</label><input class="form-control" name="c" [(ngModel)]="a.city" required autocomplete="address-level2" /></div>
        <div class="col-md-4"><label class="form-label">State</label><input class="form-control" name="s" [(ngModel)]="a.state" required autocomplete="address-level1" /></div>
        <div class="col-12"><label class="form-label">Flat / house no., building, street</label><input class="form-control" name="l1" [(ngModel)]="a.line1" required autocomplete="address-line1" /></div>
        <div class="col-md-6"><label class="form-label">Area / locality</label><input class="form-control" name="l2" [(ngModel)]="a.line2" autocomplete="address-line2" /></div>
        <div class="col-md-6"><label class="form-label">Landmark</label><input class="form-control" name="lm" [(ngModel)]="a.landmark" /></div>
        <div class="col-12 d-flex flex-wrap gap-3 align-items-center" [class.d-none]="!persist()">
          @for (l of ['Home', 'Work', 'Other']; track l) {
            <div class="form-check"><input class="form-check-input" type="radio" name="lbl" [id]="'lbl' + l" [value]="l" [(ngModel)]="a.label" /><label class="form-check-label" [for]="'lbl' + l">{{ l }}</label></div>
          }
          <div class="form-check ms-md-auto"><input class="form-check-input" type="checkbox" id="def" name="def" [(ngModel)]="a.isDefault" /><label class="form-check-label" for="def">Make default</label></div>
        </div>
      </div>
      <div class="d-flex gap-2 mt-3">
        <button class="btn btn-primary" [disabled]="f.invalid || busy()">{{ submitLabel() || (a.id ? 'Update address' : 'Save address') }}</button>
        @if (showCancel()) { <button type="button" class="btn btn-phoenix-secondary" (click)="cancelled.emit()">Cancel</button> }
      </div>
    </form>
  `
})
export class AddressFormComponent {
  private api = inject(ApiService);
  readonly address = input.required<Address>();
  readonly showCancel = input(true);
  /** false = just hand the address back (guest checkout) instead of saving it to the account. */
  readonly persist = input(true);
  readonly submitLabel = input<string>();
  readonly saved = output<Address>();
  readonly cancelled = output<void>();
  protected pin = signal<PincodeCheck | null>(null);
  protected busy = signal(false);

  checkPin() {
    const p = this.address().pincode?.trim();
    if (/^\d{6}$/.test(p)) this.api.get<PincodeCheck>(`site/pincode/${p}`).subscribe(r => {
      this.pin.set(r);
      if (r.serviceable) localStorage.setItem('wc_pincode', p);
    });
  }

  save() {
    const a = this.address();
    if (!this.persist()) {
      if (!/^\d{6}$/.test(a.pincode?.trim())) return;
      this.saved.emit({ ...a });
      return;
    }
    this.busy.set(true);
    const req = a.id ? this.api.put<Address | null>(`account/addresses/${a.id}`, a) : this.api.post<Address | null>('account/addresses', a);
    req.subscribe({
      next: r => { this.busy.set(false); this.saved.emit(r ?? a); },
      error: () => this.busy.set(false)
    });
  }
}
