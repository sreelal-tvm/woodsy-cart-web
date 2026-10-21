import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';

/** What the picker found at the pin. */
export interface PickedLocation {
  lat: number; lng: number; pincode?: string; city?: string; state?: string; area?: string; formatted?: string;
}

// The Google Maps script is loaded once per page, only when a picker is shown.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
let loader: Promise<G> | null = null;
function loadGoogleMaps(key: string): Promise<G> {
  const w = window as unknown as { google?: G; __wcMapsReady?: () => void };
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  loader ??= new Promise<G>((resolve, reject) => {
    w.__wcMapsReady = () => resolve(w.google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&region=IN&language=en-IN&callback=__wcMapsReady`;
    s.async = true;
    s.onerror = () => { loader = null; reject(new Error('Google Maps failed to load')); };
    document.head.appendChild(s);
  });
  return loader;
}

const BENGALURU = { lat: 12.9716, lng: 77.5946 };

/**
 * Pick the delivery point: search (Google suggestions), "use my current location", or move the map under the fixed pin.
 * Emits pincode / city / state / area for the address form. Costs: one map load per form, one address lookup when the map
 * stops moving, and search suggestions — all within Google's free monthly allowance at WoodsyCart's volume.
 */
@Component({
  selector: 'wc-location-picker',
  styles: [`
    .lp-search { margin-bottom: .5rem; }
    .lp-search gmp-place-autocomplete { width: 100%; }
    .lp-map-wrap { position: relative; height: 260px; border-radius: .75rem; overflow: hidden; border: 1px solid var(--bs-border-color); background: var(--wc-soft); }
    .lp-map { position: absolute; inset: 0; }
    .lp-pin { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -100%); pointer-events: none; z-index: 2; filter: drop-shadow(0 3px 4px rgba(0,0,0,.3)); }
    .lp-locate { position: absolute; right: .6rem; bottom: .6rem; z-index: 3; }
    .lp-hint { font-size: .8rem; color: var(--wc-muted); margin-top: .4rem; }
  `],
  template: `
    @if (failed()) {
      <div class="lp-hint mb-2"><i class="bi bi-map me-1"></i>The map couldn't load — just type your address below.</div>
    } @else {
      <div class="lp-search" #search></div>
      <div class="lp-map-wrap">
        <div class="lp-map" #map></div>
        <svg class="lp-pin" width="34" height="46" viewBox="0 0 34 46"><path d="M17 0C7.6 0 0 7.6 0 17c0 12.8 17 29 17 29s17-16.2 17-29C34 7.6 26.4 0 17 0z" fill="#3874ff"/><circle cx="17" cy="17" r="6.5" fill="#fff"/></svg>
        <button type="button" class="btn btn-light btn-sm shadow-sm lp-locate" (click)="locateMe()" [disabled]="locating()">
          <i class="bi bi-crosshair me-1"></i>{{ locating() ? 'Finding you…' : 'Use my current location' }}</button>
      </div>
      <div class="lp-hint">
        @if (here(); as h) { <i class="bi bi-geo-alt-fill text-primary me-1"></i><b>{{ h }}</b> — move the map to put the pin on your gate. }
        @else { Search for your building or area, or move the map to put the pin on your gate. }
        @if (geoError(); as e) { <div class="text-danger">{{ e }}</div> }
      </div>
    }
  `
})
export class LocationPickerComponent {
  readonly apiKey = input.required<string>();
  readonly lat = input<number | null | undefined>(null);
  readonly lng = input<number | null | undefined>(null);
  readonly picked = output<PickedLocation>();

  private mapEl = viewChild<ElementRef<HTMLDivElement>>('map');
  private searchEl = viewChild<ElementRef<HTMLDivElement>>('search');
  protected failed = signal(false);
  protected locating = signal(false);
  protected here = signal<string | null>(null);
  protected geoError = signal<string | null>(null);
  private g: G;
  private map: G;
  private geocoder: G;
  private last: { lat: number; lng: number } | null = null;
  private skipNextLookup = false;

  constructor() {
    const destroy = inject(DestroyRef);
    let alive = true;
    destroy.onDestroy(() => (alive = false));
    afterNextRender(async () => {
      try {
        this.g = await loadGoogleMaps(this.apiKey());
        if (!alive) return;
        const { Map } = await this.g.maps.importLibrary('maps');
        const { Geocoder } = await this.g.maps.importLibrary('geocoding');
        const places = await this.g.maps.importLibrary('places');
        const start = this.lat() && this.lng() ? { lat: this.lat()!, lng: this.lng()! } : BENGALURU;
        this.map = new Map(this.mapEl()!.nativeElement, {
          center: start, zoom: this.lat() ? 17 : 12, disableDefaultUI: true, zoomControl: true, clickableIcons: false, gestureHandling: 'greedy'
        });
        this.geocoder = new Geocoder();
        if (this.lat()) this.last = start; // an existing pin: don't look it up again until it moves
        this.map.addListener('idle', () => this.onIdle());

        // Search with Google's suggestions (Places API New), limited to India and favouring Bengaluru.
        const ac = new places.PlaceAutocompleteElement({
          includedRegionCodes: ['in'],
          locationBias: { center: BENGALURU, radius: 40000 }
        });
        ac.setAttribute('placeholder', 'Search your building, street or area');
        this.searchEl()!.nativeElement.appendChild(ac);
        ac.addEventListener('gmp-select', async (e: G) => {
          const place = e.placePrediction.toPlace();
          await place.fetchFields({ fields: ['location', 'addressComponents', 'formattedAddress'] }); // Essentials fields only
          if (!place.location) return;
          const loc = { lat: place.location.lat(), lng: place.location.lng() };
          this.skipNextLookup = true; // we already have the address for this point
          this.map.setCenter(loc);
          this.map.setZoom(18);
          this.emit(loc, this.fromNewComponents(place.addressComponents ?? []), place.formattedAddress);
        });
      } catch {
        this.failed.set(true);
      }
    });
  }

  locateMe() {
    this.geoError.set(null);
    if (!navigator.geolocation) { this.geoError.set('Your browser can’t share its location — search instead.'); return; }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      p => {
        this.locating.set(false);
        this.map?.setCenter({ lat: p.coords.latitude, lng: p.coords.longitude });
        this.map?.setZoom(18);
      },
      err => {
        this.locating.set(false);
        this.geoError.set(err.code === err.PERMISSION_DENIED ? 'Location permission was blocked — allow it in the browser, or search instead.' : 'Couldn’t find your location — search instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /** The map stopped moving: look up the address under the pin (only when it really moved). */
  private onIdle() {
    const c = this.map.getCenter();
    const pos = { lat: c.lat(), lng: c.lng() };
    if (this.skipNextLookup) { this.skipNextLookup = false; this.last = pos; return; }
    if (this.last && this.distance(this.last, pos) < 15) return;
    if (!this.last && this.map.getZoom() < 15) return; // still looking around the city
    this.last = pos;
    this.geocoder.geocode({ location: pos }).then((r: G) => {
      const best = r.results?.[0];
      if (best) this.emit(pos, this.fromLegacyComponents(best.address_components ?? []), best.formatted_address);
      else this.emit(pos, {});
    }).catch(() => this.emit(pos, {}));
  }

  private emit(pos: { lat: number; lng: number }, parts: Partial<PickedLocation>, formatted?: string) {
    const area = parts.area;
    this.here.set([area, parts.city, parts.pincode].filter(Boolean).join(', ') || formatted || null);
    this.picked.emit({ lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6), ...parts, formatted });
  }

  /** Places API (New) components: { longText, shortText, types }. */
  private fromNewComponents(cs: G[]): Partial<PickedLocation> {
    const get = (...types: string[]) => cs.find(c => types.some(t => c.types.includes(t)))?.longText as string | undefined;
    return this.parts(get);
  }

  /** Geocoder components: { long_name, short_name, types }. */
  private fromLegacyComponents(cs: G[]): Partial<PickedLocation> {
    const get = (...types: string[]) => cs.find(c => types.some(t => c.types.includes(t)))?.long_name as string | undefined;
    return this.parts(get);
  }

  private parts(get: (...types: string[]) => string | undefined): Partial<PickedLocation> {
    const sub2 = get('sublocality_level_2', 'neighborhood');
    const sub1 = get('sublocality_level_1', 'sublocality');
    const area = [get('premise'), sub2, sub1].filter((v, i, a) => v && a.indexOf(v) === i).join(', ') || get('route');
    return {
      pincode: get('postal_code'),
      city: get('locality') ?? get('administrative_area_level_3', 'administrative_area_level_2'),
      state: get('administrative_area_level_1'),
      area: area || undefined
    };
  }

  private distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const r = 6371000, toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(h));
  }
}
