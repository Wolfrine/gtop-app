const encoder = new TextEncoder();
const unsafe = /[<>:"/\\|?*\p{Cc}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function fileStem(input, fallback, maxBytes = 68) {
  const clean = String(input ?? '').normalize('NFC').replace(unsafe, ' ')
    .replace(/\s+/gu, ' ').replace(/^[. ]+|[. ]+$/g, '');
  let stem = '';
  let bytes = 0;
  for (const character of clean) {
    const length = encoder.encode(character).length;
    if (bytes + length > maxBytes) break;
    bytes += length;
    stem += character;
  }
  stem = stem.replace(/[. ]+$/g, '') || fallback;
  return reserved.test(stem) ? '_' + stem : stem;
}

const identifier = value => String(value ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 128);

export function artifactFilename({label, kind, id, revision, digest, page, extension}) {
  const qualifiers = [
    identifier(kind),
    identifier(id),
    revision == null ? '' : 'r' + identifier(revision),
    page == null ? '' : 'p' + identifier(page),
    identifier(digest).slice(0, 32),
  ].filter(Boolean);
  return [fileStem(label, 'GT Papers'), ...qualifiers].join(' - ') + '.' + identifier(extension);
}

export function attachmentHeader(filename) {
  const ascii = filename.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\x20-\x7e]+/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, character =>
    '%' + character.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function attachmentName(header, fallback) {
  const encoded = /(?:^|;\s*)filename\*=UTF-8''([^;]+)/i.exec(header || '')?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch {}
  }
  return /(?:^|;\s*)filename="([^"]+)"/i.exec(header || '')?.[1] || fallback;
}

export function saveArtifact(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
