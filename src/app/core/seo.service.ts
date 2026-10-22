import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, MetaDefinition, Title } from '@angular/platform-browser';
import { NavigationStart, Router } from '@angular/router';
import { ApiService } from './api.service';
import { ProductDetail } from './models';

const SITE = 'WoodsyCart';
const DEFAULT_TITLE = 'WoodsyCart — Furniture in Bengaluru, factory-direct';
const DEFAULT_DESCRIPTION = 'Buy beds, sofas, wardrobes, dining sets and office furniture online in Bengaluru at factory prices. Free delivery and assembly.';
/** Personal pages: never shown in search results (robots.txt also asks crawlers to skip them). */
const PRIVATE = ['/account', '/cart', '/checkout', '/wishlist', '/order/', '/login', '/register', '/forgot-password', '/reset-password', '/track'];

/** Tags this service writes, so they can be cleared when the page changes. */
const MANAGED: string[] = [
  'name="description"', 'name="robots"',
  'property="og:type"', 'property="og:title"', 'property="og:description"', 'property="og:url"', 'property="og:image"', 'property="og:image:alt"',
  'property="og:locale"', 'property="product:price:amount"', 'property="product:price:currency"', 'property="product:availability"',
  'property="product:brand"', 'property="product:category"',
  'name="twitter:card"', 'name="twitter:title"', 'name="twitter:description"', 'name="twitter:image"'
];

export interface PageSeo { title?: string; description?: string; image?: string | null; noindex?: boolean; }

/**
 * Search and share tags for every storefront page: title, description, canonical address, robots, Open Graph / Twitter
 * (link previews) and, on product pages, schema.org Product + Breadcrumb data that lets Google show price, stock and rating.
 * The site address is taken from the browser (window.location), so nothing here depends on the domain.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private doc = inject(DOCUMENT);
  private title = inject(Title);
  private meta = inject(Meta);
  private api = inject(ApiService);

  constructor() {
    // Reset before each new page is built, so one page's tags never leak onto the next.
    inject(Router).events.subscribe(e => { if (e instanceof NavigationStart) this.page({}, e.url); });
  }

  private get origin() { return this.doc.location.origin; }

  /** Address search engines should treat as the original of this page (keeps only meaningful query parameters). */
  private canonical(url: string) {
    const u = new URL(url, this.origin);
    const keep = u.pathname === '/shop' && u.searchParams.get('category') ? `?category=${encodeURIComponent(u.searchParams.get('category')!)}` : '';
    return this.origin + (u.pathname.replace(/\/+$/, '') || '/') + keep;
  }

  /** Full https:// address of a photo (search engines and share previews need absolute links). */
  absoluteImage(url?: string | null) {
    if (!url) return null;
    const m = this.api.media(url);
    return m.startsWith('http') ? m : new URL(m, this.origin).href;
  }

  /** Standard tags for any page. Product pages call {@link product} afterwards. */
  page(seo: PageSeo, url = this.doc.location.pathname + this.doc.location.search) {
    for (const sel of MANAGED) this.meta.removeTag(sel);
    this.jsonLd(null);
    const path = new URL(url, this.origin).pathname;
    const title = seo.title ? `${seo.title} · ${SITE}` : DEFAULT_TITLE;
    const description = clip(seo.description || DEFAULT_DESCRIPTION, 160);
    const canonical = this.canonical(url);
    const image = seo.image ?? new URL('og-image.png', this.doc.baseURI).href;
    const noindex = seo.noindex || PRIVATE.some(p => path.startsWith(p)) || (path === '/shop' && new URL(url, this.origin).searchParams.has('q'));

    this.title.setTitle(title);
    this.link('canonical', canonical);
    this.tags([
      { name: 'description', content: description },
      { name: 'robots', content: noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: seo.title ?? DEFAULT_TITLE },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonical },
      { property: 'og:image', content: image },
      { property: 'og:locale', content: 'en_IN' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: seo.title ?? DEFAULT_TITLE },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image }
    ]);
  }

  /** Product page: everything from {@link page}, plus price / stock tags and schema.org data. */
  product(p: ProductDetail, description: string) {
    const photos = p.images.filter(i => i.mediaType !== 3).map(i => this.absoluteImage(i.url)).filter((u): u is string => !!u);
    this.page({ title: p.metaTitle || p.name, description, image: photos[0] ?? null }, `/product/${p.slug}`);
    const url = this.canonical(`/product/${p.slug}`);
    const prices = (p.variants.length ? p.variants.filter(v => v.price > 0).map(v => v.price) : [p.price]).filter(x => x > 0);
    const low = Math.min(...prices, p.price), high = Math.max(...prices, p.price);
    const inStock = p.isAvailable;

    this.meta.updateTag({ property: 'og:type', content: 'product' });
    this.tags([
      { property: 'og:image:alt', content: p.name },
      { property: 'product:price:amount', content: String(p.price) },
      { property: 'product:price:currency', content: 'INR' },
      { property: 'product:availability', content: inStock ? 'in stock' : 'out of stock' },
      ...(p.brand ? [{ property: 'product:brand', content: p.brand }] : []),
      { property: 'product:category', content: p.category.name }
    ]);

    const offer = {
      '@type': low !== high ? 'AggregateOffer' : 'Offer',
      url,
      priceCurrency: 'INR',
      ...(low !== high ? { lowPrice: low, highPrice: high, offerCount: prices.length } : { price: p.price }),
      availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`,
      itemCondition: 'https://schema.org/NewCondition',
      ...(p.offer?.endsAt ? { priceValidUntil: p.offer.endsAt.slice(0, 10) } : {}),
      seller: { '@type': 'Organization', name: SITE },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'INR' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN', addressRegion: 'KA' },
        // Same promise as the product page: "Ships in N–N+3 days", free delivery and assembly
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          transitTime: { '@type': 'QuantitativeValue', minValue: p.deliveryDays, maxValue: p.deliveryDays + 3, unitCode: 'DAY' }
        }
      },
      // "Easy returns · 7 days for defects"
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy', applicableCountry: 'IN', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7
      }
    };
    this.jsonLd([
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description: clip(description, 5000),
        url,
        image: photos.slice(0, 10),
        sku: p.sku || String(p.id),
        category: p.category.name,
        ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
        ...(p.material ? { material: p.material } : {}),
        ...(p.ratingCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAverage, reviewCount: p.ratingCount, bestRating: 5, worstRating: 1 } } : {}),
        offers: offer
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: this.origin + '/' },
          { '@type': 'ListItem', position: 2, name: p.category.name, item: `${this.origin}/shop?category=${encodeURIComponent(p.category.slug)}` },
          { '@type': 'ListItem', position: 3, name: p.name, item: url }
        ]
      }
    ]);
  }

  private tags(list: MetaDefinition[]) { for (const t of list) this.meta.updateTag(t); }

  private link(rel: string, href: string) {
    let el = this.doc.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) { el = this.doc.createElement('link'); el.rel = rel; this.doc.head.appendChild(el); }
    el.href = href;
  }

  private jsonLd(data: object[] | null) {
    this.doc.head.querySelector('script[data-seo]')?.remove();
    if (!data) return;
    const s = this.doc.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-seo', '');
    s.textContent = JSON.stringify(data.length === 1 ? data[0] : data).replace(/</g, '\\u003c');
    this.doc.head.appendChild(s);
  }
}

function clip(s: string, max: number) {
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
}
