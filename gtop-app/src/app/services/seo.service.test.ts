import '@angular/compiler';
import { Meta, Title } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { SeoConfig, SeoService } from './seo.service';

const HOME = 'https://gtop.growthtutorials.in/';
const IMAGE = `${HOME}assets/icons/icon-512-512.png`;
const TITLE = 'GTOP | School Chapter Practice for Classes 5-12';
const DESCRIPTION = 'Practise school chapters with GTOP for Classes 5-12, CBSE and ICSE. Choose your board and class, take MCQ quizzes and review your answers.';
const html = readFileSync(resolve('src/index.html'), 'utf8');

// Read the actual route literal without importing unrelated pages or Firebase.
const source = ts.createSourceFile('app.routes.ts', readFileSync(resolve('src/app/app.routes.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const property = (node: ts.ObjectLiteralExpression, name: string) => node.properties.find(
  (item): item is ts.PropertyAssignment => ts.isPropertyAssignment(item) && item.name.getText(source) === name
)?.initializer;
const routeObjects: ts.ObjectLiteralExpression[] = [];
function visit(node: ts.Node) {
  if (ts.isObjectLiteralExpression(node) && property(node, 'path')) routeObjects.push(node);
  ts.forEachChild(node, visit);
}
visit(source);
const homeRoutes = routeObjects.filter(node => property(node, 'path')?.getText(source) === "''");
function routeSeo(node: ts.ObjectLiteralExpression): SeoConfig {
  const data = property(node, 'data') as ts.ObjectLiteralExpression;
  const seo = property(data, 'seo') as ts.ObjectLiteralExpression;
  return Object.fromEntries(seo.properties.map(item => {
    expect(ts.isPropertyAssignment(item)).toBe(true);
    const assignment = item as ts.PropertyAssignment;
    expect(ts.isStringLiteral(assignment.initializer)).toBe(true);
    return [assignment.name.getText(source), (assignment.initializer as ts.StringLiteral).text];
  }));
}
const create = () => {
  const dom = new JSDOM(html, { url: HOME });
  const document = dom.window.document;
  return { document, seo: new SeoService(new Title(document), new Meta(document), document) };
};
const snapshot = (document: Document) => ({
  title: document.title,
  tags: Object.fromEntries(Array.from(document.head.querySelectorAll('meta[name], meta[property]')).map(
    tag => [tag.getAttribute('name') ?? tag.getAttribute('property'), tag.getAttribute('content')]
  )),
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
  structured: JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!)
});

describe('public home acquisition metadata', () => {
  it('keeps raw HTML, home route and service defaults consistent', () => {
    expect(homeRoutes).toHaveLength(1);
    const { document, seo } = create();
    const raw = snapshot(document);
    expect(raw.title).toBe(TITLE);
    for (const name of ['og:title', 'twitter:title']) expect(raw.tags[name]).toBe(TITLE);
    for (const name of ['description', 'og:description', 'twitter:description']) expect(raw.tags[name]).toBe(DESCRIPTION);
    expect(raw.structured.description).toBe(DESCRIPTION);
    expect(raw.canonical).toBe(HOME);
    expect(raw.tags['og:url']).toBe(HOME);
    expect(raw.structured.url).toBe(HOME);
    for (const name of ['og:image', 'twitter:image']) expect(raw.tags[name]).toBe(IMAGE);
    expect(raw.structured.logo).toBe(IMAGE);
    expect(raw.tags['robots']).toBe('index, follow');
    expect(raw.structured.name).toBe('GTOP - Growth Tutorials Objective Practice');
    seo.update();
    expect(snapshot(document)).toEqual(raw);
    seo.update(routeSeo(homeRoutes[0]));
    expect(snapshot(document)).toEqual(raw);
  });

  it('restores home metadata after a private route without weakening noindex overrides', () => {
    const { document, seo } = create();
    const home = snapshot(document);
    seo.update({ title: 'Private fixture', description: 'Private fixture description', robots: 'noindex, nofollow', url: `${HOME}practice` });
    expect(snapshot(document).tags['robots']).toBe('noindex, nofollow');
    expect(document.title).toBe('Private fixture');
    seo.update(routeSeo(homeRoutes[0]));
    expect(snapshot(document)).toEqual(home);
    for (const path of ['practice', 'profile-setup', 'dashboard', 'admin/question-papers']) {
      const route = routeObjects.find(node => (property(node, 'path') as ts.StringLiteral)?.text === path);
      expect(route, path).toBeDefined();
      expect(routeSeo(route!).robots, path).toBe('noindex, nofollow');
    }
  });
});
