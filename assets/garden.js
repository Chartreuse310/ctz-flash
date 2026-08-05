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

  /* ---------- Modal: 书页翻页 + 右侧栏 ---------- */

  function openModal(card) {
    renderModal(card);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    modal.scrollTop = 0;
  }

  function renderModal(card) {
    modalContent.innerHTML = '';

    // 两栏布局
    const layout = document.createElement('div');
    layout.className = 'modal-layout';

    const main = document.createElement('div');
    main.className = 'modal-main';

    const title = document.createElement('h1');
    title.className = 'modal-title';
    title.textContent = card.title;

    const meta = document.createElement('div');
    meta.className = 'modal-meta';

    // 左侧：日期 + 标签
    const metaLeft = document.createElement('div');
    metaLeft.className = 'meta-left';
    const dateSpan = document.createElement('span');
    dateSpan.textContent = card.date || '';
    metaLeft.appendChild(dateSpan);
    if (card.tags && card.tags.length) {
      const tags = document.createElement('span');
      tags.className = 'modal-tags';
      card.tags.forEach(t => {
        const s = document.createElement('span');
        s.textContent = t;
        tags.appendChild(s);
      });
      metaLeft.appendChild(tags);
    }
    meta.appendChild(metaLeft);

    // 右侧：翻页控件（上箭头 + 页码 + 下箭头）
    const pager = document.createElement('div');
    pager.className = 'book-pager';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'book-nav book-prev';
    prevBtn.innerHTML = '&#8593;';
    prevBtn.title = '上一页';
    const pageNum = document.createElement('span');
    pageNum.className = 'book-page-num';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'book-nav book-next';
    nextBtn.innerHTML = '&#8595;';
    nextBtn.title = '下一页';
    pager.appendChild(prevBtn);
    pager.appendChild(pageNum);
    pager.appendChild(nextBtn);
    meta.appendChild(pager);

    // ── 书页阅读器 ──
    const bookViewer = document.createElement('div');
    bookViewer.className = 'book-viewer';

    const bookPage = document.createElement('div');
    bookPage.className = 'book-page';
    bookPage.innerHTML = card.content_html || '';

    bookViewer.appendChild(bookPage);

    main.appendChild(title);
    main.appendChild(meta);
    main.appendChild(bookViewer);

    // ── 右侧侧栏 ──
    const side = document.createElement('aside');
    side.className = 'modal-side';

    const graphSection = document.createElement('div');
    graphSection.className = 'graph-section';
    const graphTitle = document.createElement('h3');
    graphTitle.textContent = '图谱';
    const graphContainer = document.createElement('div');
    graphContainer.className = 'graph-container';
    graphSection.appendChild(graphTitle);
    graphSection.appendChild(graphContainer);

    const backlinksSection = document.createElement('div');
    backlinksSection.className = 'backlinks-section';
    const backlinksTitle = document.createElement('h3');
    backlinksTitle.textContent = '反链';
    const backlinksList = document.createElement('ul');
    backlinksList.className = 'backlinks-list';
    backlinksSection.appendChild(backlinksTitle);
    backlinksSection.appendChild(backlinksList);

    side.appendChild(graphSection);
    side.appendChild(backlinksSection);

    layout.appendChild(main);
    layout.appendChild(side);
    modalContent.appendChild(layout);

    // ── 翻页控制（基于 scrollTop，天然适配容器大小） ──
    let pageHeight = 0;
    let totalPages = 1;
    let currentPage = 0;
    let isPageAnimating = false;

    function recalcPage() {
      pageHeight = bookPage.clientHeight;
      totalPages = Math.max(1, Math.ceil(bookPage.scrollHeight / pageHeight));
      if (currentPage >= totalPages) currentPage = totalPages - 1;
      pageNum.textContent = totalPages > 1 ? (currentPage + 1) + ' / ' + totalPages : '';
      prevBtn.style.display = currentPage === 0 ? 'none' : '';
      nextBtn.style.display = currentPage >= totalPages - 1 ? 'none' : '';
    }

    function showPage(idx, smooth) {
      if (isPageAnimating) return;
      idx = Math.max(0, Math.min(idx, totalPages - 1));
      if (idx === currentPage) return;
      currentPage = idx;
      isPageAnimating = true;
      bookPage.scrollTo({ top: currentPage * pageHeight, behavior: smooth ? 'smooth' : 'instant' });
      setTimeout(() => { isPageAnimating = false; }, 300);
      pageNum.textContent = totalPages > 1 ? (currentPage + 1) + ' / ' + totalPages : '';
      prevBtn.style.display = currentPage === 0 ? 'none' : '';
      nextBtn.style.display = currentPage >= totalPages - 1 ? 'none' : '';
    }

    // 窗口大小变化时重新计算
    const ro = new ResizeObserver(recalcPage);
    ro.observe(bookViewer);

    // 延迟一帧初始化（确保布局完成）
    requestAnimationFrame(() => recalcPage());

    // 箭头按钮
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showPage(currentPage - 1, true); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showPage(currentPage + 1, true); });

    // 点击上下区域翻页（排除链接）
    bookViewer.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link) {
        const target = findCardByUrl(link.getAttribute('href'));
        if (target) {
          e.preventDefault();
          renderModal(target);
          return;
        }
      }
      if (totalPages <= 1) return;
      const rect = bookViewer.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = rect.height;
      if (y < h * 0.3) showPage(currentPage - 1, true);
      else if (y > h * 0.7) showPage(currentPage + 1, true);
    });

    // 触摸上下滑动翻页
    let touchStartY = 0;
    bookViewer.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; });
    bookViewer.addEventListener('touchend', (e) => {
      if (totalPages <= 1) return;
      const diff = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(diff) > 40) {
        showPage(currentPage + (diff > 0 ? 1 : -1), true);
      }
    });

    // 键盘上下键翻页（渲染新卡片时移除旧 handler）
    const keyHandler = (e) => {
      if (overlay.classList.contains('open')) {
        if (e.key === 'ArrowUp') showPage(currentPage - 1, true);
        if (e.key === 'ArrowDown') showPage(currentPage + 1, true);
      }
    };
    if (currentKeyHandler) document.removeEventListener('keydown', currentKeyHandler);
    currentKeyHandler = keyHandler;
    document.addEventListener('keydown', keyHandler);

    renderGraph(card, graphContainer);
    renderBacklinks(card, backlinksList);
  }

  let currentKeyHandler = null;

  /* ---------- Graph ---------- */

  const GRAPH_DEPTH = 2;

  function buildGraphData(card) {
    const byUrl = new Map(cards.map(c => [c.url, c]));

    const outgoing = (card.links || []).map(u => byUrl.get(u)).filter(Boolean);
    const incoming = cards.filter(c => (c.links || []).includes(card.url));
    const level1 = new Map();
    outgoing.forEach(c => level1.set(c.url, c));
    incoming.forEach(c => level1.set(c.url, c));

    const level2 = new Map();
    if (GRAPH_DEPTH >= 2) {
      level1.forEach(c => {
        (c.links || []).forEach(u => {
          const node = byUrl.get(u);
          if (node && node.url !== card.url && !level1.has(node.url)) {
            level2.set(node.url, node);
          }
        });
        cards.forEach(c2 => {
          if ((c2.links || []).includes(c.url) && c2.url !== card.url && !level1.has(c2.url)) {
            level2.set(c2.url, c2);
          }
        });
      });
    }

    const nodes = [
      { id: card.url, label: card.title, level: 0 },
      ...[...level1.values()].map(c => ({ id: c.url, label: c.title, level: 1 })),
      ...[...level2.values()].map(c => ({ id: c.url, label: c.title, level: 2 })),
    ];

    const nodeUrls = new Set(nodes.map(n => n.id));
    const edges = [];
    nodeUrls.forEach(a => {
      nodeUrls.forEach(b => {
        if (a === b) return;
        const cardA = byUrl.get(a);
        if (cardA && (cardA.links || []).includes(b)) {
          edges.push({ from: a, to: b });
        }
      });
    });

    return { nodes, edges, counts: { level1: level1.size, level2: level2.size } };
  }

  function ensureVis() {
    return new Promise((resolve, reject) => {
      if (window.vis) return resolve(window.vis);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/vis-network@9.1.9/standalone/umd/vis-network.min.js';
      s.onload = () => resolve(window.vis);
      s.onerror = () => reject(new Error('vis-network 加载失败'));
      document.head.appendChild(s);
    });
  }

  function renderGraph(card, container) {
    ensureVis()
      .then(() => {
        const { nodes, edges } = buildGraphData(card);
        if (nodes.length <= 1) {
          container.innerHTML = '<p class="graph-empty">这张卡片还没有与其他卡片相连</p>';
          return;
        }
        container.innerHTML = '';

        const visNodes = new vis.DataSet(nodes.map(n => ({
          id: n.id,
          label: '',
          level: n.level,
          shape: 'dot',
          size: n.level === 0 ? 10 : n.level === 1 ? 7 : 5,
          color: n.level === 0
            ? { background: '#4a7c59', border: '#3a6a49' }
            : n.level === 1
              ? { background: '#8ab58c', border: '#4a7c59' }
              : { background: '#c3d8c4', border: '#8ab58c' },
          borderWidth: n.level === 0 ? 2 : 1,
          title: n.label,
        })));

        const visEdges = new vis.DataSet(edges.map(e => ({
          from: e.from,
          to: e.to,
          color: { color: '#b5cbb5', highlight: '#4a7c59' },
          width: 1.2,
          smooth: { enabled: true, type: 'continuous' },
        })));

        const network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, {
          physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            stabilization: true,
            forceAtlas2Based: { springLength: 70, springConstant: 0.08, avoidOverlap: 0.5 },
          },
          interaction: { hover: true, dragNodes: true, zoomView: true, tooltipDelay: 80 },
          nodes: { scaling: { min: 6, max: 20 } },
        });

        network.on('click', (params) => {
          if (params.nodes.length) {
            const target = findCardByUrl(params.nodes[0]);
            if (target) {
              renderModal(target);
              modal.scrollTop = 0;
            }
          }
        });
      })
      .catch(() => {
        container.innerHTML = '<p class="graph-empty">图谱组件加载失败</p>';
      });
  }

  /* ---------- Backlinks ---------- */

  function renderBacklinks(card, listEl) {
    const incoming = cards.filter(c => (c.links || []).includes(card.url));
    listEl.innerHTML = '';

    if (!incoming.length) {
      const empty = document.createElement('p');
      empty.className = 'backlinks-empty';
      empty.textContent = '暂无其他卡片链接到这里';
      listEl.appendChild(empty);
      return;
    }

    incoming.forEach(c => {
      const li = document.createElement('li');
      li.textContent = c.title;
      li.addEventListener('click', () => {
        renderModal(c);
        modal.scrollTop = 0;
      });
      listEl.appendChild(li);
    });
  }

  function findCardByUrl(url) {
    if (!url) return null;
    const norm = url.split('#')[0];
    return cards.find(c => c.url === norm) || null;
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (currentKeyHandler) {
      document.removeEventListener('keydown', currentKeyHandler);
      currentKeyHandler = null;
    }
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