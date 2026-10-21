import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Address, PincodeCheck } from '../../core/models';
import { SiteService } from '../../core/store';
import { LocationPickerComponent, PickedLocation } from '../../shared/location-picker';

export const emptyAddress = (): Address => ({
  id: 0, label: 'Home', fullName: '', phone: '', line1: '', line2: '', landmark: '', city: 'Bengaluru', state: 'Karnataka', pincode: '', isDefault: false
});

@Component({
  selector: 'wc-address-form',
  imports: [FormsModule, LocationPickerComponent],
  template: `
    @let a = address();
    <form (ngSubmit)="save()" #f="ngForm">
      @if (site.settings()?.mapsApiKey; as key) {
        <div class="mb-3">
          <label class="form-label">Pin your delivery location <span class="text-muted fw-normal">(helps the delivery team find you)</span></label>
          <wc-location-picker [apiKey]="key" [lat]="a.latitude" [lng]="a.longitude" (picked)="onPicked($event)" />
        </div>
      }
      <div class="row g-2">
        <div class="col-md-6"><label class="form-label">Full name</label><input class="form-control" name="n" [(ngModel)]="a.fullName" required autocomplete="name" /></div>
        <div class="col-md-6"><label class="form-label">Mobile number</label><input class="form-control" name="p" #ph="ngModel" [(ngModel)]="a.phone" [class.is-invalid]="ph.invalid && (ph.touched || !!ph.value)" required inputmode="tel" maxlength="16" autocomplete="tel" pattern="([+]?91[ -]?)?0?[6-9][0-9]{4}[ -]?[0-9]{5}" title="10-digit mobile number, e.g. 98765 43210" />
          @if (ph.invalid && (ph.touched || !!ph.value)) { <div class="invalid-feedback d-block">Enter a 10-digit mobile number — we use it for delivery and order tracking.</div> }</div>
        <div class="col-md-4">
          <label class="form-label">Pincode</label>
          <input class="form-control" name="pin" [(ngModel)]="a.pincode" required maxlength="6" inputmode="numeric" (blur)="checkPin()" autocomplete="postal-code" />
          @if (pin(); as r) {
            <div class="fs-8 mt-1" [class.text-success]="r.serviceable" [class.text-danger]="!r.serviceable && !r.nearBengaluru" [class.text-warning]="r.nearBengaluru">{{ r.message }}</div>
            @if (r.nearBengaluru && site.whatsAppLink(whatsAppText()); as wa) {
              <a class="btn btn-success btn-sm mt-1" [href]="wa" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-1"></i>Ask on WhatsApp</a>
            }
          }
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
  protected site = inject(SiteService);
  protected pin = signal<PincodeCheck | null>(null);
  /** The area text last filled in from the map, so moving the pin can replace it but never overwrite what the customer typed. */
  private autoArea: string | null = null;

  /** The pin moved: keep the point and fill pincode / city / state / area. Flat number and landmark are left to the customer. */
  onPicked(p: PickedLocation) {
    const a = this.address();
    a.latitude = p.lat;
    a.longitude = p.lng;
    if (p.pincode && /^\d{6}$/.test(p.pincode)) { a.pincode = p.pincode; this.checkPin(); }
    if (p.city) a.city = p.city;
    if (p.state) a.state = p.state;
    if (p.area && (!a.line2 || a.line2 === this.autoArea)) { a.line2 = p.area; this.autoArea = p.area; }
  }
  protected busy = signal(false);

  checkPin() {
    const p = this.address().pincode?.trim();
    const a = this.address();
    const at = a.latitude && a.longitude ? { lat: a.latitude, lng: a.longitude } : {};
    if (/^\d{6}$/.test(p)) this.api.get<PincodeCheck>(`site/pincode/${p}`, at).subscribe(r => {
      this.pin.set(r);
      if (r.serviceable) localStorage.setItem('wc_pincode', p);
    });
  }

  /** Pre-filled WhatsApp question for a location just outside the delivery list. */
  whatsAppText() {
    const a = this.address();
    const where = a.latitude && a.longitude ? ` https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}` : '';
    return `Hi WoodsyCart! Can you deliver to pincode ${a.pincode}${a.line2 ? ' (' + a.line2 + ')' : ''}?${where}`;
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
