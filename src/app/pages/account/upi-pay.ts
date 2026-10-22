import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import QRCode from 'qrcode';
import { PaymentInstructions } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED } from '../../shared/shared';

/**
 * Pay a direct-UPI / bank-transfer order without a gateway:
 * phone → opens the customer's UPI app with everything pre-filled; desktop → scan the QR.
 */
@Component({
  selector: 'wc-upi-pay',
  imports: [FormsModule, ...SHARED],
  template: `
    @let p = payment();
    <div class="pay-card">
      @if (p.awaitingVerification) {
        <div class="d-flex gap-3 align-items-start">
          <i class="bi bi-hourglass-split fs-2 text-warning"></i>
          <div>
            <h5 class="fw-800 mb-1">Checking your payment</h5>
            <p class="text-muted mb-0 fs-7">We received your reference <b>{{ p.customerUtr }}</b>. Your order is confirmed as soon as the payment reaches us — usually within a few minutes. This page updates automatically.</p>
          </div>
        </div>
      } @else if (p.provider === 'DirectUpi') {
        <div class="row g-4 align-items-center">
          <div class="col-md-7">
            <div class="text-muted fs-7 fw-bold text-uppercase mb-1">Amount to pay</div>
            <div class="amount">{{ p.amount | inr2 }}</div>
            <div class="fs-8 text-muted mb-3">Please pay this <b>exact</b> amount — it identifies your order (we've taken a few paise off for you).</div>

            <a class="btn btn-primary btn-lg w-100 mb-2 d-md-none" [href]="p.upiUri">
              <i class="bi bi-phone me-1"></i>Pay with UPI app
            </a>
            <div class="d-flex flex-wrap gap-2 mb-3 d-md-none">
              @for (app of apps; track app) { <span class="app-chip">{{ app }}</span> }
            </div>

            <div class="vpa d-flex align-items-center justify-content-between gap-2">
              <span class="min-w-0"><span class="text-muted fs-8 d-block">UPI ID</span><b class="text-break">{{ p.upiId }}</b> <span class="text-muted fs-8">({{ p.payeeName }})</span></span>
              <button class="btn btn-sm btn-phoenix-secondary" (click)="copy(p.upiId!, 'UPI ID')"><i class="bi bi-copy"></i></button>
            </div>
            <ol class="fs-7 text-muted mt-3 mb-0 ps-3">
              <li>Tap <b>Pay with UPI app</b> (or scan the QR) and choose Google Pay, PhonePe, Paytm or BHIM.</li>
              <li>Check the amount and payee <b>{{ p.payeeName }}</b>, then enter your UPI PIN.</li>
              <li>That's it — this page confirms automatically once the money arrives.</li>
            </ol>
          </div>
          <div class="col-md-5 text-center">
            @if (qr()) { <img [src]="qr()" alt="UPI QR code" class="qr" width="220" height="220" /> }
            <div class="fs-8 text-muted mt-1">Scan with any UPI app</div>
          </div>
        </div>
      } @else if (p.provider === 'BankTransfer') {
        <h5 class="fw-800 mb-2">Pay by bank transfer (NEFT / IMPS)</h5>
        <div class="text-muted fs-7 mb-3">Transfer exactly <b>{{ p.amount | inr2 }}</b> to the account below and enter the reference (UTR) after paying.</div>
        <table class="table table-sm fs-7 mb-0">
          <tbody>
            <tr><th>Account name</th><td>{{ p.accountName }}</td><td></td></tr>
            <tr><th>Account number</th><td><b>{{ p.accountNumber }}</b></td><td class="text-end"><button class="btn btn-sm btn-link p-0" (click)="copy(p.accountNumber!, 'Account number')">Copy</button></td></tr>
            <tr><th>IFSC</th><td><b>{{ p.ifsc }}</b></td><td class="text-end"><button class="btn btn-sm btn-link p-0" (click)="copy(p.ifsc!, 'IFSC')">Copy</button></td></tr>
            @if (p.bankName) { <tr><th>Bank</th><td>{{ p.bankName }}</td><td></td></tr> }
            <tr><th>Amount</th><td><b>{{ p.amount | inr2 }}</b></td><td></td></tr>
          </tbody>
        </table>
      }

      @if (!p.awaitingVerification) {
        <hr />
        <details [open]="showUtr()">
          <summary class="fs-7 fw-bold cursor-pointer">Paid already? Enter your payment reference (UTR)</summary>
          <form class="d-flex gap-2 mt-2" (ngSubmit)="submitUtr()">
            <input class="form-control" name="utr" [(ngModel)]="utr" placeholder="12-digit UPI reference / UTR" inputmode="numeric" maxlength="22" />
            <button class="btn btn-phoenix-secondary" [disabled]="utr.trim().length < 10">Submit</button>
          </form>
          <div class="fs-8 text-muted mt-1">Find it in your UPI app under the payment details ("UPI Ref No." / "UTR"). Screenshots aren't needed.</div>
        </details>
      }
    </div>
  `,
  styles: [`
    .pay-card { border: 2px solid #9A5226; border-radius: 1rem; padding: 1.5rem; background: var(--wc-surface); }
    .amount { font-size: 2.25rem; font-weight: 800; color: var(--bs-emphasis-color); line-height: 1.1; }
    .vpa { border: 1px dashed var(--wc-border-strong); border-radius: 0.5rem; padding: 0.6rem 0.8rem; }
    .qr { border-radius: 0.75rem; border: 1px solid var(--bs-border-color); background: #fff; padding: 0.5rem; max-width: 100%; height: auto; }
    .app-chip { font-size: 0.7rem; font-weight: 700; border: 1px solid var(--bs-border-color); border-radius: 2rem; padding: 0.15rem 0.6rem; color: var(--wc-muted); }
    th { font-weight: 600; color: var(--wc-muted); width: 40%; }
  `]
})
export class UpiPayComponent {
  private toast = inject(ToastService);
  readonly payment = input.required<PaymentInstructions>();
  readonly utrSubmitted = output<string>();
  protected qr = signal<string | null>(null);
  protected showUtr = computed(() => this.payment().provider === 'BankTransfer');
  protected apps = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM'];
  utr = '';

  constructor() {
    effect(() => {
      const uri = this.payment().upiUri;
      if (uri) QRCode.toDataURL(uri, { width: 440, margin: 1, errorCorrectionLevel: 'M' }).then(d => this.qr.set(d));
      else this.qr.set(null);
    });
  }

  copy(text: string, what: string) {
    navigator.clipboard.writeText(text).then(() => this.toast.success(`${what} copied`));
  }

  submitUtr() { this.utrSubmitted.emit(this.utr.trim()); }
}
