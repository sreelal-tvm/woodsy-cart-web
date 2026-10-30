import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteService } from '../core/store';

interface Faq { q: string; a: string; }

/**
 * Static content pages. Policy text is a starting draft for a Bengaluru furniture store —
 * review it (ideally with a professional) before going live.
 */
@Component({
  selector: 'wc-info',
  imports: [RouterLink],
  template: `
    <div class="container-xxl py-5">
      <div class="mx-auto prose" style="max-width: 820px">
        @switch (key()) {
          @case ('about') {
            <h1 class="fw-800">About {{ name() }}</h1>
            <p class="lead text-muted">Honest furniture at factory prices, delivered across Bengaluru.</p>
            <p>{{ name() }} works directly with experienced furniture manufacturers. Every piece you order is made and dispatched straight from the workshop to your home — no showroom rent, no middlemen, so you pay closer to the factory price.</p>
            <h2>What you can expect</h2>
            <ul>
              <li><b>Made-to-order quality</b> — engineered wood, plywood, solid wood and metal furniture built by craftsmen with years of experience.</li>
              <li><b>Free delivery and assembly</b> within our Bengaluru service area.</li>
              <li><b>Manufacturer warranty</b> as listed on each product.</li>
              <li><b>Real support</b> — talk to a person on WhatsApp or phone before and after you buy.</li>
            </ul>
            <p>Need something custom — a different size, finish or a bulk order for an office or café? <a routerLink="/contact">Tell us about it</a>.</p>
          }
          @case ('faq') {
            <h1 class="fw-800 mb-4">Frequently asked questions</h1>
            @for (f of faqs(); track f.q) {
              <details class="border rounded-3 p-3 mb-2"><summary class="fw-bold cursor-pointer">{{ f.q }}</summary><p class="mt-2 mb-0">{{ f.a }}</p></details>
            }
          }
          @case ('shipping') {
            <h1 class="fw-800">Shipping & delivery policy</h1>
            <p>We currently deliver within Bengaluru and nearby areas. Enter your pincode on any product page or at checkout to confirm delivery to your address.</p>
            <h2>Delivery time</h2>
            <p>Most furniture is made to order. Typical delivery is 7–10 working days from order confirmation; the estimate for each product is shown on its page. We'll share the dispatch date and keep you updated by email and on your order page.</p>
            <h2>Delivery charges</h2>
            <p>Delivery and standard assembly are free within our service area unless stated at checkout. Deliveries above the ground floor without a lift may need extra handling, which we'll confirm with you in advance.</p>
            <h2>At delivery</h2>
            <ul>
              <li>Please check the product for visible damage before signing. Note any damage on the delivery receipt and share photos with us within 48 hours.</li>
              <li>Ensure doors, lifts and staircases can accommodate the furniture. We can share dimensions on request.</li>
            </ul>
          }
          @case ('returns') {
            <h1 class="fw-800">Returns, cancellations & refunds</h1>
            <h2>Cancellations</h2>
            <p>You can cancel an order free of charge from your order page until it has been sent for production. Once production has started, made-to-order items can't be cancelled, but please contact us — we'll always try to help.</p>
            <h2>Returns</h2>
            <p>If your furniture arrives damaged, defective, or different from what you ordered, request a return within <b>7 days of delivery</b> from your order page or on WhatsApp, with photos. We'll arrange a repair, replacement or pickup and refund.</p>
            <p>Change-of-mind returns are not accepted for made-to-order furniture.</p>
            <h2>Refunds</h2>
            <ul>
              <li>Online payments are refunded to the original payment method within 5–7 working days after approval.</li>
              <li>Cash-on-delivery orders are refunded by bank transfer or UPI to the account you share with us.</li>
            </ul>
            <h2>Warranty</h2>
            <p>Products carry the manufacturer's warranty described on the product page. Warranty does not cover normal wear, misuse, water damage or damage from moving the product yourself.</p>
          }
          @case ('privacy') {
            <h1 class="fw-800">Privacy policy</h1>
            <p>This policy explains what personal information {{ name() }} collects and how we use it.</p>
            <h2>What we collect</h2>
            <ul>
              <li>Account details: name, email, mobile number.</li>
              <li>Order details: delivery addresses, items purchased, order history and, for business purchases, your GSTIN.</li>
              <li>Site usage: how long you use the site and how you found us (for example Instagram or Google), linked to a random ID kept in your browser and, once you sign in, to your account. We don't record your location or IP address for this, and delete it after 12 months.</li>
              <li>Payment information is processed securely by our payment partners (such as Razorpay, PhonePe, Cashfree, PayU or Paytm). We do not store your card or bank details.</li>
            </ul>
            <h2>How we use it</h2>
            <p>To process and deliver your orders, share order updates, provide customer support, issue invoices and meet legal obligations. We share your name, phone and delivery address with our manufacturing and delivery partners only to fulfil your order.</p>
            <h2>Your choices</h2>
            <p>You can update your profile and addresses from your account at any time, or ask us to delete your account by contacting {{ email() }}. We retain invoices and order records as required by Indian tax law.</p>
          }
          @case ('terms') {
            <h1 class="fw-800">Terms of service</h1>
            <p>By using this website and placing an order, you agree to these terms.</p>
            <h2>Products & pricing</h2>
            <p>Prices are in Indian Rupees and include applicable taxes. Product images are representative; finishes and colours may vary slightly. We may correct pricing errors and will contact you before processing an affected order.</p>
            <h2>Orders</h2>
            <p>An order is accepted once we confirm it. We may decline or cancel an order (with a full refund) if a product is unavailable or delivery isn't possible to your address.</p>
            <h2>Liability</h2>
            <p>Our liability for any order is limited to the amount paid for it. Nothing in these terms limits your rights under the Consumer Protection Act, 2019.</p>
            <h2>Governing law</h2>
            <p>These terms are governed by the laws of India, with courts in Bengaluru having jurisdiction.</p>
            <p>Questions? Write to {{ email() }}.</p>
          }
          @default {
            <div class="empty-state"><i class="bi bi-signpost-split"></i><h2>Page not found</h2><p>The page you're looking for doesn't exist or has moved.</p><a class="btn btn-primary" routerLink="/">Go home</a></div>
          }
        }
      </div>
    </div>
  `
})
export class InfoPage {
  private site = inject(SiteService);
  readonly page = input<string>();
  protected key = computed(() => this.page() ?? 'not-found');
  protected name = computed(() => this.site.settings()?.businessName ?? 'WoodsyCart');
  protected email = computed(() => this.site.settings()?.email || 'us');

  protected faqs = computed<Faq[]>(() => [
    { q: 'Where do you deliver?', a: 'Across Bengaluru and nearby areas. Check your pincode on any product page to confirm.' },
    { q: 'How long does delivery take?', a: 'Most furniture is made to order and delivered in 7–10 working days. Each product page shows its estimate.' },
    { q: 'Is assembly included?', a: 'Yes — standard assembly is free within our service area. Our team assembles the furniture at your home.' },
    { q: 'Can I pay cash on delivery?', a: this.site.settings()?.codEnabled
      ? 'Yes, for eligible orders and pincodes. Online payment by UPI, cards and net banking is also available.'
      : 'Not at the moment. Pay securely online by UPI, cards or net banking at checkout.' },
    { q: 'Can I get a custom size or colour?', a: 'Often, yes. Send us an enquiry or WhatsApp message with your requirement and we will share a quote.' },
    { q: 'What if my furniture arrives damaged?', a: 'Report it within 7 days of delivery with photos. We will repair, replace or refund it.' },
    { q: 'Do you provide a GST invoice?', a: 'Every order gets an invoice you can download from your order page. Add your GSTIN at checkout for business purchases.' },
    { q: 'How do I track my order?', a: 'Use the Track order page with your order number and phone number, or open the order from My orders.' }
  ]);
}
