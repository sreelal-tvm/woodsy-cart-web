import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

type Query = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  readonly base = environment.apiUrl;

  private params(q?: Query): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(q ?? {})) {
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    }
    return p;
  }

  get<T>(url: string, query?: Query): Observable<T> {
    return this.http.get<T>(`${this.base}/api/${url}`, { params: this.params(query) });
  }

  post<T>(url: string, body: unknown = {}, query?: Query): Observable<T> {
    return this.http.post<T>(`${this.base}/api/${url}`, body, { params: this.params(query) });
  }

  put<T>(url: string, body: unknown = {}): Observable<T> {
    return this.http.put<T>(`${this.base}/api/${url}`, body);
  }

  delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(`${this.base}/api/${url}`);
  }

  upload<T>(url: string, files: File | File[], field = 'file', query?: Query): Observable<T> {
    const form = new FormData();
    for (const f of Array.isArray(files) ? files : [files]) form.append(field, f, f.name);
    return this.http.post<T>(`${this.base}/api/${url}`, form, { params: this.params(query) });
  }

  /** Downloads a file (PDF/CSV) with the auth header and saves or opens it. */
  download(url: string, fileName: string, query?: Query, open = false): void {
    this.http.get(`${this.base}/api/${url}`, { params: this.params(query), responseType: 'blob' }).subscribe(blob => {
      const href = URL.createObjectURL(blob);
      if (open) {
        window.open(href, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = href;
        a.download = fileName;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    });
  }

  /** Resolves /media/... paths served by the API. */
  media(url?: string | null): string {
    if (!url) return 'placeholder.svg';
    return url.startsWith('/') ? `${this.base}${url}` : url;
  }
}
