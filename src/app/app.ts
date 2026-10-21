import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeoService } from './core/seo.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <div class="wc-toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="wc-toast bg-{{ t.kind === 'info' ? 'dark' : t.kind }}" role="status" (click)="toast.dismiss(t.id)">{{ t.text }}</div>
      }
    </div>
  `
})
export class App {
  protected toast = inject(ToastService);
  private seo = inject(SeoService); // search / share tags for every page
}
