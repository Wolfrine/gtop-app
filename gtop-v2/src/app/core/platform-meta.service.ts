import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../environments/environment';

const productionOrigin = 'https://gtop.growthtutorials.in';

@Injectable({ providedIn: 'root' })
export class PlatformMetaService {
  constructor(
    router: Router,
    private readonly meta: Meta,
    private readonly title: Title,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {
    router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      const publicPage = event.urlAfterRedirects === '/' || event.urlAfterRedirects.startsWith('/privacy');
      this.meta.updateTag({ name: 'robots', content: publicPage ? 'index, follow' : 'noindex, nofollow' });
      this.setCanonical(publicPage ? `${productionOrigin}${event.urlAfterRedirects.split('?')[0]}` : productionOrigin);
      if (environment.analyticsEnabled) this.track(event.urlAfterRedirects);
    });
    if (environment.analyticsEnabled) this.loadAnalytics();
  }

  private setCanonical(href: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = href;
  }

  private loadAnalytics(): void {
    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${environment.analyticsMeasurementId}`;
    this.document.head.appendChild(script);
    const data = (window as unknown as { dataLayer?: unknown[] }).dataLayer ??= [];
    data.push(['js', new Date()]);
    data.push(['config', environment.analyticsMeasurementId, { send_page_view: false }]);
  }

  private track(path: string): void {
    const data = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    data?.push(['event', 'page_view', { page_path: path, page_title: this.title.getTitle() }]);
  }
}
