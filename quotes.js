/* Render the quote and author supplied in the submission inbox as text. */
(() => {
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
  if (window.cleanupQuotebook) window.cleanupQuotebook();
  let active = true;
  let pending = false;
  let lastRefresh = 0;
  async function refresh() {
  if (!active || pending || Date.now() - lastRefresh < 2000) return;
  pending = true;
  try {
    const response = await fetch('quotes.json?t=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Quote list unavailable');
    const data = await response.json();
    if (!Array.isArray(data.entries)) throw new Error('Invalid quote list');
    if (!active) return;
    const entries = data.entries.filter(item => typeof item.quote === 'string');
    status.textContent = 'Quotes and ideas I’ve collected.';
    empty.hidden = entries.length > 0;
    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      const article = el('article', null, 'quote-card');
      if (entry.quote) {
        const block = el('blockquote');
        block.append(el('p', '“' + entry.quote + '”'));
        const author = typeof entry.submittedAuthor === 'string' ? entry.submittedAuthor : entry.attribution;
        if (author && author.trim()) block.append(el('cite', author));
        article.append(block);
      }
      if (entry.summary) article.append(el('p', entry.summary));
      if (entry.question) article.append(el('p', entry.question));
      fragment.append(article);
    }
    list.replaceChildren(fragment);
    lastRefresh = Date.now();
  } catch {
    if (!list.children.length) {
      status.textContent = 'The collection is temporarily unavailable.';
      empty.hidden = false;
    }
  } finally { pending = false; }
  }
  refresh();
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
  const onVisible = () => { if (!document.hidden) refresh(); };
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(onVisible, 30000);
  window.cleanupQuotebook = () => {
    active = false;
    clearInterval(timer);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('pageshow', refresh);
    document.removeEventListener('visibilitychange', onVisible);
  };
})();
