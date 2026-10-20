import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { Address } from '../../core/models';
import { AddressFormComponent, emptyAddress } from './address-form';

@Component({
  selector: 'wc-addresses',
  imports: [AddressFormComponent],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h4 class="fw-800 mb-0">Addresses</h4>
      @if (!editing()) { <button class="btn btn-sm btn-primary" (click)="editing.set(new())"><i class="bi bi-plus me-1"></i>Add address</button> }
    </div>
    @if (editing(); as a) {
      <div class="card mb-3"><div class="card-body"><wc-address-form [address]="a" (saved)="done()" (cancelled)="editing.set(null)" /></div></div>
    }
    <div class="row g-3">
      @for (a of list(); track a.id) {
        <div class="col-md-6">
          <div class="card h-100"><div class="card-body fs-7">
            <div class="d-flex justify-content-between mb-1"><b class="fs-6">{{ a.fullName }}</b>
              <span><span class="badge-soft badge-soft-secondary">{{ a.label }}</span>@if (a.isDefault) { <span class="badge-soft badge-soft-primary ms-1">Default</span> }</span></div>
            <div class="text-muted">{{ a.line1 }}@if (a.line2) {, {{ a.line2 }}}</div>
            @if (a.landmark) { <div class="text-muted">Near {{ a.landmark }}</div> }
            <div class="text-muted">{{ a.city }}, {{ a.state }} – {{ a.pincode }}</div>
            <div class="text-muted mb-2">{{ a.phone }}</div>
            <button class="btn btn-sm btn-phoenix-secondary me-1" (click)="editing.set({ ...a })">Edit</button>
            <button class="btn btn-sm btn-link text-danger" (click)="remove(a)">Delete</button>
          </div></div>
        </div>
      } @empty { @if (!editing()) { <div class="col-12"><div class="empty-state"><i class="bi bi-geo-alt"></i>No saved addresses yet.</div></div> } }
    </div>
  `
})
export class AddressesPage {
  private api = inject(ApiService);
  protected list = signal<Address[]>([]);
  protected editing = signal<Address | null>(null);
  constructor() { this.load(); }
  load() { this.api.get<Address[]>('account/addresses').subscribe(a => this.list.set(a)); }
  new() { return emptyAddress(); }
  done() { this.editing.set(null); this.load(); }
  remove(a: Address) { if (confirm('Delete this address?')) this.api.delete(`account/addresses/${a.id}`).subscribe(() => this.load()); }
}
