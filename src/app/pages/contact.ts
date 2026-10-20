import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService, SiteService } from '../core/store';

@Component({
  selector: 'wc-contact',
  imports: [FormsModule],
  template: `
    <div class="container-xxl py-5">
      <div class="row g-5">
        <div class="col-lg-5">
          <h1 class="h2 fw-800">We'd love to help</h1>
          <p class="text-muted">Questions about a product, a custom size, bulk orders for offices or cafés, or an order you've placed — reach out and we'll respond within a few hours.</p>
          @if (site.settings(); as s) {
            <div class="d-flex flex-column gap-3 mt-4">
              @if (site.whatsAppLink(); as wa) { <a class="contact-tile" [href]="wa" target="_blank" rel="noopener"><i class="bi bi-whatsapp text-success"></i><span><b>WhatsApp</b><br /><span class="text-muted fs-7">Fastest — chat with us</span></span></a> }
              @if (s.phone) { <a class="contact-tile" [href]="'tel:' + s.phone"><i class="bi bi-telephone text-primary"></i><span><b>{{ s.phone }}</b><br /><span class="text-muted fs-7">Mon–Sat, 10am–7pm</span></span></a> }
              <a class="contact-tile" [href]="'mailto:' + s.email"><i class="bi bi-envelope text-primary"></i><span><b>{{ s.email }}</b><br /><span class="text-muted fs-7">We reply within a day</span></span></a>
              <div class="contact-tile"><i class="bi bi-geo-alt text-primary"></i><span><b>Serving all of Bengaluru</b><br /><span class="text-muted fs-7">{{ s.address }}</span></span></div>
            </div>
          }
        </div>
        <div class="col-lg-7">
          @if (sent()) {
            <div class="card card-body text-center p-5"><i class="bi bi-check-circle-fill text-success display-5"></i><h4 class="mt-3">Thanks, {{ name }}!</h4><p class="text-muted mb-0">We've received your message and will get back to you shortly.</p></div>
          } @else {
            <form class="card card-body p-4" (ngSubmit)="send()" #f="ngForm">
              <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Name</label><input class="form-control" name="n" [(ngModel)]="name" required /></div>
                <div class="col-md-6"><label class="form-label">Phone</label><input class="form-control" name="p" [(ngModel)]="phone" required inputmode="tel" pattern="(\+?91[ -]?)?0?[6-9][0-9]{4}[ -]?[0-9]{5}" title="10-digit mobile number, e.g. 98765 43210" maxlength="16" /></div>
                <div class="col-md-6"><label class="form-label">Email</label><input type="email" class="form-control" name="e" [(ngModel)]="email" /></div>
                <div class="col-md-6"><label class="form-label">Topic</label>
                  <select class="form-select" name="s" [(ngModel)]="subject">
                    @for (t of topics; track t) { <option [value]="t">{{ t }}</option> }
                  </select></div>
                <div class="col-12"><label class="form-label">Message</label><textarea class="form-control" rows="5" name="m" [(ngModel)]="message" required></textarea></div>
                <div class="col-12"><button class="btn btn-primary btn-lg" [disabled]="f.invalid || busy()">Send message</button></div>
              </div>
            </form>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`.contact-tile { display: flex; gap: 1rem; align-items: center; border: 1px solid var(--bs-border-color); border-radius: 0.75rem; padding: 1rem; color: inherit; } .contact-tile .bi { font-size: 1.5rem; }`]
})
export class ContactPage {
  private api = inject(ApiService);
  protected site = inject(SiteService);
  readonly product = input<string>();
  topics = ['Product question', 'Custom size / design', 'Bulk / office order', 'Order support', 'Other'];
  name = inject(AuthService).user()?.fullName ?? '';
  phone = inject(AuthService).user()?.phone ?? '';
  email = inject(AuthService).user()?.email ?? '';
  subject = this.topics[0];
  message = '';
  sent = signal(false);
  busy = signal(false);

  send() {
    this.busy.set(true);
    this.api.post('site/enquiry', {
      name: this.name, phone: this.phone, email: this.email || null, subject: this.subject, message: this.message,
      productId: this.product() ? Number(this.product()) : null
    }).subscribe({ next: () => this.sent.set(true), error: () => this.busy.set(false) });
  }
}
