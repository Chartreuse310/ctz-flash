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

    // 正文：直接渲染，滚动阅读
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML = card.content_html || '';

    main.appendChild(title);
    main.appendChild(meta);
    main.appendChild(body);

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

    // 拦截正文内链接：站内卡片链接 → 模态内切换（花园漫游不出站）
    body.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', (e) => {
        const target = findCardByUrl(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          renderModal(target);
        }
      });
    });


    renderGraph(card, graphContainer);
    renderBacklinks(card, backlinksList);
  }

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