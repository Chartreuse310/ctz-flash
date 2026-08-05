/* ========== Garden App ========== */

(function () {
  'use strict';

  let cards = [];
  let activeTag = null;

  const tagBar = document.getElementById('tag-bar');
  const grid = document.getElementById('card-grid');
  const countEl = document.getElementById('card-count');
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modal-content');
  const closeBtn = document.getElementById('modal-close');

  /* ---------- Data ---------- */

  async function load() {
    const res = await fetch('manifest.json');
    const data = await res.json();
    cards = data.cards.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    renderTags();
    renderGrid();
  }

  function allTags() {
    const map = new Map();
    cards.forEach(c => {
      (c.tags || []).forEach(t => {
        map.set(t, (map.get(t) || 0) + 1);
      });
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  /* ---------- Tag Bar ---------- */

  function renderTags() {
    const tags = allTags();
    tagBar.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'tag-all' + (activeTag === null ? ' active' : '');
    allBtn.textContent = '全部';
    allBtn.addEventListener('click', () => setTag(null));
    tagBar.appendChild(allBtn);

    tags.forEach(([tag, count]) => {
      const btn = document.createElement('button');
      btn.className = 'tag-btn' + (activeTag === tag ? ' active' : '');
      btn.textContent = tag + ' ' + count;
      btn.addEventListener('click', () => setTag(tag));
      tagBar.appendChild(btn);
    });
  }

  function setTag(tag) {
    activeTag = tag;
    renderTags();
    renderGrid();
  }

  /* ---------- Card Grid ---------- */

  function renderGrid() {
    grid.innerHTML = '';
    const visible = activeTag ? cards.filter(c => (c.tags || []).includes(activeTag)) : cards;

    visible.forEach(card => {
      const el = document.createElement('article');
      el.className = 'card';

      const title = document.createElement('h2');
      title.className = 'card-title';
      title.textContent = card.title;

      const date = document.createElement('div');
      date.className = 'card-date';
      date.textContent = card.date || '';

      const summary = document.createElement('p');
      summary.className = 'card-summary';
      summary.textContent = card.summary || '';

      const tags = document.createElement('div');
      tags.className = 'card-tags';
      (card.tags || []).forEach(t => {
        const span = document.createElement('span');
        span.className = 'card-tag';
        span.textContent = t;
        tags.appendChild(span);
      });

      el.appendChild(title);
      el.appendChild(date);
      el.appendChild(summary);
      el.appendChild(tags);

      el.addEventListener('click', () => openModal(card));
      grid.appendChild(el);
    });

    countEl.textContent = visible.length + ' 张卡片';
  }

  /* ---------- Modal ---------- */

  function openModal(card) {
    renderModal(card);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    modal.scrollTop = 0;
  }

  function renderModal(card) {
    modalContent.innerHTML = '';

    const title = document.createElement('h1');
    title.className = 'modal-title';
    title.textContent = card.title;

    const meta = document.createElement('div');
    meta.className = 'modal-meta';
    const dateSpan = document.createElement('span');
    dateSpan.textContent = card.date || '';
    meta.appendChild(dateSpan);

    if (card.tags && card.tags.length) {
      const tags = document.createElement('span');
      tags.className = 'modal-tags';
      card.tags.forEach(t => {
        const s = document.createElement('span');
        s.textContent = t;
        tags.appendChild(s);
      });
      meta.appendChild(tags);
    }

    // 正文：构建时已渲染为 HTML
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML = card.content_html || '';

    modalContent.appendChild(title);
    modalContent.appendChild(meta);
    modalContent.appendChild(body);

    // 拦截正文内链接：站内卡片链接 → 模态内切换（花园漫游不出站）
    body.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', (e) => {
        const target = findCardByUrl(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          renderModal(target);
          modal.scrollTop = 0;
        }
      });
    });
  }

  function findCardByUrl(href) {
    if (!href) return null;
    const norm = href.split('#')[0];
    return cards.find(c => c.url === norm) || null;
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  /* ---------- Init ---------- */

  load();
})();