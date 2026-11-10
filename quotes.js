/* Public quotebook entries are rendered as text, never HTML. */
(async () => {
  const status = document.getElementById('quote-status');
  const empty = document.getElementById('quote-empty');
  const list = document.getElementById('quote-list');
  if (!status || !empty || !list) return;
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const safeUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : null;
    } catch { return null; }
  };
  try {
    const response = await fetch('quotes.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Quote list unavailable');
    const data = await response.json();
    if (!Array.isArray(data.entries)) throw new Error('Invalid quote list');
    const entries = data.entries
      .filter(item => typeof item.quote === 'string' && typeof item.attribution === 'string')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!entries.length) {
      status.textContent = 'In progress.';
      empty.hidden = false;
      return;
    }
    status.textContent = 'A growing collection of lines worth keeping.';
    empty.hidden = true;
    for (const entry of entries) {
      const article = el('article', null, 'quote-card');
      if (typeof entry.date === 'string') article.append(el('p', entry.date + ' · QUOTE', 'post-meta'));
      const block = el('blockquote');
      block.append(el('p', '“' + entry.quote + '”'));
      block.append(el('cite', entry.attribution));
      article.append(block);
      const url = safeUrl(entry.source);
      if (url) {
        const link = el('a', 'Source ↗', 'read-more');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        article.append(link);
      }
      list.append(article);
    }
  } catch {
    status.textContent = 'In progress.';
    empty.hidden = false;
  }
})();
