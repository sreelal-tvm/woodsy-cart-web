# WoodsyCart Storefront

Customer-facing Angular 21 storefront for WoodsyCart, factory-direct furniture delivered across Bengaluru. It's an installable PWA with offline catalogue caching, and its layout follows the Phoenix e-commerce customer pages.

## Pages

- **Home**: hero (or admin-managed banners), shop by category, top deals, best sellers, new arrivals, custom-order call to action
- **Shop** (`/shop`): search, category, price bands, colour and size facets, in-stock, discount and sort options, pagination; mobile filter drawer
- **Product details**: gallery with YouTube videos, colour/size variant selection with availability, pincode delivery check, highlights, specifications, reviews, related products, WhatsApp question button, sticky mobile buy bar
- **Cart** with coupons, and **Checkout** with saved addresses, Razorpay or cash on delivery, and an optional GSTIN for business buyers
- **Account**: orders, order details (tracking timeline, cancel, return request, invoice PDF, retry payment), addresses, profile and password
- **Wishlist**, **Track order** (order number + phone, no login), **Contact / enquiry**
- **Info pages**: About, FAQs, and Shipping, Returns & refunds, Privacy and Terms policies. These are drafts — review them before going live (Razorpay checks for these pages during onboarding).

## Run locally

```bash
npm install
npm start          # http://localhost:4200 (API expected at http://localhost:5100)
```

## Configuration

Set `apiUrl` in `src/environments/environment.development.ts` (dev) and `src/environments/environment.ts` (production).

Online payments appear automatically once Razorpay keys are configured in the API.

## Build and deploy

```bash
npm run build      # output: dist/woodsy-cart-web/browser
```

Host the `browser` folder over HTTPS with SPA fallback to `index.html`. The PWA service worker (production builds only) caches the app shell, catalogue API responses (network-first) and product images (cache-first), so customers can install WoodsyCart on their phone and browse while offline.
