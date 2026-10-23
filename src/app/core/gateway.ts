/** How the API asks us to hand the customer to PhonePe, Cashfree, PayU or Paytm. */
export interface GatewayLaunch {
  kind: 'redirect' | 'form' | 'cashfree';
  url: string;
  fields?: Record<string, string>;
  sessionId?: string;
  mode?: 'sandbox' | 'production';
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: string }) => { checkout(options: { paymentSessionId: string; redirectTarget: string }): Promise<unknown> };
  }
}

function loadScript(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment page. Check your connection and try again.'));
    document.body.appendChild(s);
  });
}

/**
 * Sends the customer to the gateway's secure payment page. They come back to /order/:number,
 * where the payment is confirmed with the gateway by our API.
 */
export async function launchGateway(l: GatewayLaunch): Promise<void> {
  if (l.kind === 'redirect') {
    location.assign(l.url);
  } else if (l.kind === 'form') {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = l.url;
    for (const [name, value] of Object.entries(l.fields ?? {})) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  } else if (l.kind === 'cashfree') {
    await loadScript(l.url);
    if (!window.Cashfree || !l.sessionId) throw new Error('Could not open the payment page. Please try again.');
    await window.Cashfree({ mode: l.mode ?? 'production' }).checkout({ paymentSessionId: l.sessionId, redirectTarget: '_self' });
  }
}

/** Providers whose payment happens on the gateway's own page (the customer can come back and retry). */
export const GATEWAYS = ['Razorpay', 'PhonePe', 'Cashfree', 'PayU', 'PaytmPg'];
