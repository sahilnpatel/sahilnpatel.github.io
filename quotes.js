/* Render the quote and author supplied in the submission inbox as text. */
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
  try {
    const response = await fetch('quotes.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Quote list unavailable');
    const data = await response.json();
    if (!Array.isArray(data.entries)) throw new Error('Invalid quote list');
    const entries = data.entries.filter(item => typeof item.quote === 'string');
    status.textContent = 'Quotes and ideas I’ve collected.';
    empty.hidden = entries.length > 0;
    list.replaceChildren();
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
      list.append(article);
    }
  } catch {
    if (!list.children.length) {
      status.textContent = 'The collection is temporarily unavailable.';
      empty.hidden = false;
    }
  }
})();
