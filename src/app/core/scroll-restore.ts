import { inject, provideAppInitializer } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { Router, Scroll } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Back / forward returns to where the page was scrolled. The router's own restoring scrolls before the products have
 * loaded (the page is still short, so it lands near the top); this waits until the page is long enough, then scrolls.
 * New pages still start at the top. Use with withInMemoryScrolling({ scrollPositionRestoration: 'disabled' }), which
 * keeps the positions but leaves the scrolling to this.
 */
export function provideScrollRestore() {
  return provideAppInitializer(() => {
    const router = inject(Router);
    const scroller = inject(ViewportScroller);
    let cancel = () => {};
    router.events.pipe(filter((e): e is Scroll => e instanceof Scroll)).subscribe(e => {
      cancel();
      if (e.position) cancel = restore(e.position[1]);
      else if (e.anchor) scroller.scrollToAnchor(e.anchor);
      else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
  });
}

/** Scrolls to y once the page is that long (up to 4 seconds), and holds it while late images and lists settle.
 * Stops as soon as the person scrolls or taps. */
function restore(y: number): () => void {
  const started = Date.now();
  let reachedAt = 0;
  let timer = 0;
  const stop = () => {
    clearInterval(timer);
    for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown'] as const) window.removeEventListener(ev, stop);
  };
  for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown'] as const) window.addEventListener(ev, stop, { passive: true });
  const tick = () => {
    const room = document.documentElement.scrollHeight - window.innerHeight;
    if (room >= y || Date.now() - started > 4000) {
      if (Math.abs(window.scrollY - Math.min(y, room)) > 2) window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      reachedAt ||= Date.now();
      if (Date.now() - reachedAt > 1000) stop();
    }
  };
  tick();
  timer = window.setInterval(tick, 50);
  return stop;
}
