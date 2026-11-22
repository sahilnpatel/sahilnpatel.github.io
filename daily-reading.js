/* Public reading entries only. Content is rendered as text, never HTML. */
(async () => {
  const path = location.pathname;
  const home = path.endsWith('/') || path.endsWith('/index.html');
  const main = document.getElementById('main');
  if (!main) return;
  const topics = home || path.endsWith('/ai-policy.html') ? ['ai-policy'] : [];
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const feedStatus = topics.length ? el('p','Checking for recent AI policy notes…','sr-only') : null;
  if (feedStatus) { feedStatus.id='reading-feed-status'; feedStatus.setAttribute('role','status'); feedStatus.setAttribute('aria-live','polite'); main.prepend(feedStatus); }
  const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
  for (const topic of topics) {
    try {
      const response = await fetch(`reading-${topic}.json`, {cache:'no-cache'});
      if (!response.ok) { if (feedStatus) feedStatus.textContent='Showing the saved reading list.'; continue; }
      const data = await response.json();
      if (!main.isConnected || location.pathname !== path || !Array.isArray(data.entries)) continue;
      const entries = data.entries.filter(e => typeof e.id === 'string' && typeof e.title === 'string' && typeof e.summary === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Array.isArray(e.sources) && e.sources.some(s => safeUrl(s.url))).sort((a,b) => b.date.localeCompare(a.date));
      if (!entries.length) { if (feedStatus) feedStatus.textContent='Showing the saved reading list.'; continue; }
      if (home) {
        const preview = main.querySelector('#home-policy-preview');
        if (!preview) continue;
        const latest = entries[0];
        if (feedStatus) feedStatus.textContent='Recent AI policy notes updated.';
        preview.querySelector('.post-meta').textContent = `AI SAFETY & POLICY · ${latest.date}`;
        preview.querySelector('h3 a').textContent = latest.title;
        preview.querySelector('p:not(.post-meta)').textContent = latest.summary.length > 180 ? latest.summary.slice(0,177).trimEnd()+'…' : latest.summary;
        continue;
      }
      const section = el('section', null, 'prose daily-entries');
      section.setAttribute('aria-label','AI safety and policy readings');
      const fragment = document.createDocumentFragment();
      for (const entry of entries) {
        const article = el('article', null, 'post-preview');
        article.append(el('p', `${entry.date} · AI SAFETY & POLICY`, 'post-meta'), el('h2', entry.title));
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
      if (feedStatus) feedStatus.textContent='Recent AI policy readings updated.';
      const titles = new Set(entries.map(e => e.title));
      main.querySelectorAll('article.post-preview').forEach(article => {
        if (titles.has(article.querySelector('h2')?.textContent.trim())) article.remove();
      });
      main.querySelector('.daily-entries')?.remove();
      main.querySelector('.page-heading')?.after(section);
    } catch { if (feedStatus) feedStatus.textContent='Showing the saved reading list.'; /* Keep the existing curated reading list when the feed is unavailable. */ }
  }
})();
