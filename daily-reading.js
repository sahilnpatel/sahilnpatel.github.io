/* Public reading entries only. Content is rendered as text, never HTML. */
(async () => {
  const path = location.pathname;
  const home = path.endsWith('/') || path.endsWith('/index.html');
  const quoteBook = path.endsWith('/quotes.html');
  const topics = home ? ['philosophy', 'ai-policy'] : quoteBook ? ['philosophy'] : path.endsWith('/philosophy.html') ? ['philosophy'] : path.endsWith('/ai-policy.html') ? ['ai-policy'] : [];
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
  for (const topic of topics) {
    try {
      const response = await fetch(`reading-${topic}.json`, {cache:'no-cache'});
      if (!response.ok) continue;
      const data = await response.json();
      if (!Array.isArray(data.entries)) continue;
      const entries = data.entries.filter(e => typeof e.id === 'string' && typeof e.title === 'string' && typeof e.summary === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Array.isArray(e.sources) && e.sources.some(s => safeUrl(s.url))).sort((a,b) => b.date.localeCompare(a.date));
      if (!entries.length) continue;
      if (home) {
        const preview = document.getElementById(topic === 'philosophy' ? 'home-philosophy-preview' : 'home-policy-preview');
        if (!preview) continue;
        const latest = entries[0];
        preview.querySelector('.post-meta').textContent = `${topic === 'philosophy' ? 'PHILOSOPHY' : 'AI & POLICY'} · ${latest.date}`;
        preview.querySelector('h3 a').textContent = latest.title;
        preview.querySelector('p:not(.post-meta)').textContent = latest.summary.length > 180 ? latest.summary.slice(0,177).trimEnd()+'…' : latest.summary;
        continue;
      }
      if (quoteBook) {
        const section = document.getElementById('quote-book');
        if (!section) continue;
        const quoted = entries.filter(entry => typeof entry.quote === 'string' && entry.quote.trim());
        if (!quoted.length) continue;
        section.replaceChildren();
        for (const entry of quoted) {
          const article = el('article', null, 'quote-card');
          article.append(el('p', entry.date + ' · PHILOSOPHY READING', 'post-meta'));
          const block = el('blockquote');
          block.append(el('p', '“' + entry.quote + '”'));
          if (typeof entry.attribution === 'string') block.append(el('cite', entry.attribution));
          article.append(block);
          const source = entry.sources.find(item => safeUrl(item.url));
          if (source) {
            const link = el('a', (source.title || 'Original source') + ' ↗', 'read-more');
            link.href = safeUrl(source.url);
            article.append(link);
          }
          section.append(article);
        }
        continue;
      }
      const section = el('section', null, 'prose daily-entries');
      section.setAttribute('aria-label','Daily reading notes');
      const fragment = document.createDocumentFragment();
      for (const entry of entries) {
        const article = el('article', null, 'post-preview');
        article.append(el('p', `${entry.date} · DAILY READING`, 'post-meta'), el('h2', entry.title));
        if (typeof entry.quote === 'string' && entry.quote) {
          const quote = el('blockquote'); quote.append(el('p', `“${entry.quote}”`));
          if (typeof entry.attribution === 'string') quote.append(el('cite', entry.attribution));
          article.append(quote);
        }
        article.append(el('p', entry.summary));
        if (typeof entry.question === 'string' && entry.question) article.append(el('p', `A question: ${entry.question}`));
        for (const source of entry.sources) {
          const url = safeUrl(source.url); if (!url) continue;
          const link = el('a', (source.title || 'Original source')+' ↗', 'read-more'); link.href=url;
          const row=el('div'); row.append(link); article.append(row);
        }
        fragment.append(article);
      }
      section.append(fragment);
      const titles = new Set(entries.map(e => e.title));
      document.querySelectorAll('article.post-preview').forEach(article => {
        if (titles.has(article.querySelector('h2')?.textContent.trim())) article.remove();
      });
      document.querySelector('.page-heading').after(section);
    } catch { /* Keep the existing curated reading list when the feed is unavailable. */ }
  }
})();
