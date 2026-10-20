import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; text: string; kind: 'success' | 'danger' | 'info'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  success(text: string) { this.push(text, 'success'); }
  error(text: string) { this.push(text, 'danger'); }
  info(text: string) { this.push(text, 'info'); }

  dismiss(id: number) { this.toasts.update(t => t.filter(x => x.id !== id)); }

  private push(text: string, kind: Toast['kind']) {
    const id = ++this.seq;
    this.toasts.update(t => [...t, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), kind === 'danger' ? 6000 : 3500);
  }
}
