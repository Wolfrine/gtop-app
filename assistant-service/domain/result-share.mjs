const states = {
  correct: 'Correct', partial: 'Partial credit', wrong: 'Incorrect', missing: 'Unattempted',
  unreadable: 'Unreadable', uncertain: 'Uncertain',
};
const outcomeLabels = {complete:'Complete assessment',partial:'Partial assessment',unassessable:'Unable to assess'};
const mark = value => value == null ? 'Unavailable' : String(value);
const ratio = score => score ? mark(score.earned) + ' / ' + mark(score.maximum) : 'Unavailable';
const heading = data => outcomeLabels[data.outcome] || 'Assessment status unavailable';

function summaryLines(data) {
  return [
    ['Final marks', ratio(data.final)],
    ['Assessed marks', ratio(data.assessed)],
    ['Full paper maximum', mark(data.fullMaximum)],
    ...(data.pending ? [['Unresolved questions', String(data.pending)]] : []),
  ];
}

function questionLine(question) {
  const option = question.choice ? ' · Option ' + question.choice : '';
  const score = question.earned == null ? 'Mark withheld' : ratio(question);
  const counted = question.counted === false ? ' · Excluded by choice rule' : '';
  const state = states[question.state] ? ' · ' + states[question.state] : '';
  return 'Question ' + question.number + option + ' · ' + score + state + counted;
}

async function summaryPdf(data, loadPdf, signal) {
  const {PDFDocument} = await loadPdf();
  await document.fonts?.ready;
  signal.throwIfAborted();
  const pdf = await PDFDocument.create();
  pdf.setTitle(data.title + ' | Result summary');
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1414;
  const ctx = canvas.getContext('2d', {alpha:false});
  if (!ctx) throw Error('The summary cannot be drawn on this device.');
  let y = 0;
  const edge = 68;
  const inner = canvas.width - 2 * edge;
  function startPage() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#154c38';
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillText('GT Papers · Result summary', edge, 71);
    y = 123;
  }
  async function appendPage() {
    signal.throwIfAborted();
    const image = await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if (!image) throw Error('The summary could not be generated.');
    const embedded = await pdf.embedPng(await image.arrayBuffer());
    const page = pdf.addPage([595.28,841.89]);
    page.drawImage(embedded, {x:0,y:0,width:595.28,height:841.89});
  }
  function split(input) {
    let line = '';
    const lines = [];
    for (const word of input.split(/\s+/u)) {
      if (line && ctx.measureText(line + ' ' + word).width > inner) {
        lines.push(line);
        line = '';
      }
      if (line) line += ' ';
      for (const character of word) {
        if (line && ctx.measureText(line + character).width > inner) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  async function text(value, weight = 400, size = 23, color = '#172625', gap = 9) {
    const font = weight + ' ' + size + 'px system-ui, sans-serif';
    ctx.font = font;
    for (const line of split(value)) {
      if (y + size >= canvas.height - edge) {
        await appendPage();
        startPage();
        ctx.font = font;
      }
      ctx.fillStyle = color;
      ctx.fillText(line,edge,y);
      y += size * 1.36;
    }
    y += gap;
  }
  try {
    startPage();
    await text(data.title, 700, 35);
    await text(heading(data), 600, 24, '#154c38');
    for (const [label,value] of summaryLines(data)) await text(label + ': ' + value);
    if (data.message) await text(data.message);
    y += 20;
    if (data.questions.length) await text('Question feedback',700,25);
    for (const question of data.questions) {
      if (y > canvas.height - 190) {
        await appendPage();
        startPage();
      }
      await text(questionLine(question),600,22,'#154c38',4);
      if (question.explanation) await text(question.explanation,400,21);
    }
    await appendPage();
    signal.throwIfAborted();
    return await pdf.save();
  } finally {
    canvas.width = 0;
  }
}

/** The caller must dismiss this operation on identity, route or selection change. */
export function openResultShare({metadata, report, loadPdf}) {
  const invoker = document.activeElement;
  const controller = new AbortController();
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label','Share result');
  dialog.style.cssText = 'box-sizing:border-box;width:min(38rem,calc(100% - 2rem));max-height:calc(100dvh - 2rem);padding:1.3rem;border:1px solid #d6ded9;border-radius:14px;background:#fff;color:#172625;box-shadow:0 18px 54px #152d2640;font:inherit';
  const urls = [];
  const element = (tag, text, parent = dialog) => {
    const node = document.createElement(tag);
    node.textContent = text;
    parent.append(node);
    return node;
  };
  const bar = element('header','');
  bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.6rem;position:sticky;top:-1.3rem;background:#fff;padding:.25rem 0;z-index:1';
  const title = element('h2','Share result',bar);
  title.style.margin = '0';
  const preview = element('section','');
  preview.setAttribute('aria-label','Result summary preview');
  preview.style.cssText = 'margin-top:1rem;overflow-wrap:anywhere';
  const announcement = element('p','Preparing the summary and exact annotated PDF…');
  announcement.setAttribute('role','status');
  const actions = element('div','');
  actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:.55rem;margin-top:1rem';
  const style = 'font:inherit;min-height:44px;padding:.52rem .72rem;border:1px solid #8c9d94;border-radius:.5rem;background:#fff;color:#154c38;text-decoration:none;cursor:pointer';
  const close = element('button','Close',bar);
  close.type = 'button';
  close.style.cssText = style;
  close.autofocus = true;
  const cancel = () => {
    if (controller.signal.aborted) return;
    controller.abort();
    urls.forEach(url => URL.revokeObjectURL(url));
    dialog.remove();
    if (invoker instanceof HTMLElement && invoker.isConnected) invoker.focus();
  };
  close.addEventListener('click', cancel);
  dialog.addEventListener('cancel', event => {event.preventDefault();cancel();});
  document.body.append(dialog);
  dialog.showModal();
  const {signal} = controller;
  async function prepare() {
    let data = await metadata(signal);
    let exact;
    try { exact = await report(data.revision, signal); }
    catch (error) {
      if (error?.status !== 409 || signal.aborted) throw error;
      data = await metadata(signal);
      exact = await report(data.revision,signal);
    }
    signal.throwIfAborted();
    const annotated = new File([exact],data.filename,{type:'application/pdf'});
    let summary;
    try {
      const bytes = await summaryPdf(data,loadPdf,signal);
      summary = new File([bytes],data.summaryFilename,{type:'application/pdf'});
    } catch {
      signal.throwIfAborted();
    }
    signal.throwIfAborted();
    const files = summary ? [summary,annotated] : [annotated];
    element('strong',data.title,preview);
    element('p',heading(data),preview);
    for (const [label,value] of summaryLines(data)) element('div',label + ': ' + value,preview);
    if (data.message) element('p',data.message,preview);
    if (data.questions.length) {
      const details = element('details','',preview);
      details.style.marginTop = '.75rem';
      element('summary','Question feedback',details);
      for (const question of data.questions) {
        element('p',questionLine(question) + (question.explanation ? ' — ' + question.explanation : ''),details);
      }
    }
    announcement.textContent = 'Choose both files to share, or download a copy.';
    for (const file of files) {
      const isReport = file === annotated;
      const url = URL.createObjectURL(file);
      urls.push(url);
      const download = element('a',isReport ? 'Download annotated PDF' : 'Download summary',actions);
      download.href = url;
      download.download = file.name;
      download.style.cssText = style + ';box-sizing:border-box;display:inline-flex;align-items:center';
      if (isReport) {
        const inspect = element('a','Preview annotated PDF',actions);
        inspect.href = url;
        inspect.target = '_blank';
        inspect.rel = 'noopener noreferrer';
        inspect.style.cssText = download.style.cssText;
      }
    }
    if (!summary) announcement.textContent = 'The summary could not be generated. The annotated PDF is available below.';
    else if (navigator.canShare?.({files}) && typeof navigator.share === 'function') {
      const share = element('button','Share both files',actions);
      share.type = 'button';
      share.style.cssText = style + ';background:#154c38;color:white';
      actions.prepend(share);
      share.addEventListener('click', () => {
        if (signal.aborted || share.disabled) return;
        share.disabled = true;
        void navigator.share({title:data.title,files}).then(() => {
          if (!signal.aborted) announcement.textContent = 'Files handed to your device share menu.';
        }).catch(error => {
          if (!signal.aborted) announcement.textContent = error?.name === 'AbortError'
            ? 'Sharing canceled. Your downloads are still available.'
            : 'This device could not share both files. Download the copies below.';
        }).finally(() => {share.disabled = false;});
      });
    } else announcement.textContent = 'File sharing is unavailable here. Download the copies below.';
  }
  void prepare().catch(error => {
    if (!signal.aborted) announcement.textContent = error instanceof Error ? error.message : 'The report is unavailable.';
  });
  return cancel;
}
