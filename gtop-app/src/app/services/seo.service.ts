import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const PUBLIC_ORIGIN = 'https://gtop.growthtutorials.in';
const DEFAULT_IMAGE_PATH = '/assets/icons/icon-512-512.png';

export interface SeoConfig {
    title?: string;
    description?: string;
    keywords?: string;
    image?: string;
    url?: string;
    robots?: string;
    type?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
    private readonly defaultConfig: Required<Omit<SeoConfig, 'url'>> & { url?: string } = {
        title: 'GTOP | School Chapter Practice for Classes 5-12',
        description: 'Practise school chapters with GTOP for Classes 5-12, CBSE and ICSE. Choose your board and class, take MCQ quizzes and review your answers.',
        keywords: 'GTOP, Growth Tutorials, school chapter practice, Classes 5-12, CBSE, ICSE, MCQ quizzes',
        image: `${PUBLIC_ORIGIN}${DEFAULT_IMAGE_PATH}`,
        robots: 'index, follow',
        type: 'website'
    };

    private readonly fallbackOrigin = PUBLIC_ORIGIN;

    constructor(private readonly title: Title, private readonly meta: Meta, @Inject(DOCUMENT) private readonly document: Document) { }

    update(config: SeoConfig = {}) {
        const merged: SeoConfig = {
            ...this.defaultConfig,
            ...config,
            url: config.url ?? this.resolveUrl()
        };

        merged.image = this.toAbsoluteUrl(merged.image);

        if (merged.title) {
            this.title.setTitle(merged.title);
        }

        this.updateMetaTag('description', merged.description);
        this.updateMetaTag('keywords', merged.keywords);
        this.updateMetaTag('robots', merged.robots);

        this.updateMetaProperty('og:title', merged.title);
        this.updateMetaProperty('og:description', merged.description);
        this.updateMetaProperty('og:image', merged.image);
        this.updateMetaProperty('og:url', merged.url);
        this.updateMetaProperty('og:type', merged.type);
        this.updateMetaProperty('og:site_name', 'GTOP - Growth Tutorials');

        this.updateMetaTag('twitter:card', 'summary_large_image');
        this.updateMetaTag('twitter:title', merged.title);
        this.updateMetaTag('twitter:description', merged.description);
        this.updateMetaTag('twitter:image', merged.image);

        this.setCanonicalLink(merged.url);
    }

    private updateMetaTag(name: string, content?: string) {
        if (!content) {
            this.meta.removeTag(`name="${name}"`);
            return;
        }

        this.meta.updateTag({ name, content });
    }

    private updateMetaProperty(property: string, content?: string) {
        if (!content) {
            this.meta.removeTag(`property="${property}"`);
            return;
        }

        this.meta.updateTag({ property, content });
    }

    private resolveUrl(): string | undefined {
        const { defaultView } = this.document;
        if (!defaultView?.location) {
            return this.fallbackOrigin;
        }

        const { location } = defaultView;
        return location.href?.split('#')[0] ?? this.fallbackOrigin;
    }

    private setCanonicalLink(url?: string) {
        if (!url) {
            return;
        }

        let link: HTMLLinkElement | null = this.document.querySelector("link[rel='canonical']");

        if (!link) {
            link = this.document.createElement('link');
            link.setAttribute('rel', 'canonical');
            this.document.head.appendChild(link);
        }

        link.setAttribute('href', url);
    }

    private toAbsoluteUrl(value?: string) {
        if (!value) {
            return value;
        }

        try {
            return new URL(value, this.currentOrigin()).toString();
        } catch {
            return value;
        }
    }

    private currentOrigin(): string {
        const { defaultView } = this.document;
        return defaultView?.location?.origin ?? this.fallbackOrigin;
    }
}
