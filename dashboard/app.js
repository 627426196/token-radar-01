// Token Launch Radar — dashboard logic (model radar-2).
// Static page: reads window.RADAR from ../data.js, no network, no framework.
// Every implied value shown is recomputed here from the snapshot figures,
// so the page and the board agree by construction.
(function () {
  'use strict';
  var R = window.RADAR;
  var rows = R.rows, live = R.live, wl = new Set(R.watchlist);
  var maxImplied = Math.max.apply(null, rows.map(function (r) { return r.implied_value_usd; }));
  var maxMcap = Math.max.apply(null, live.map(function (r) { return r.mcap_usd || 0; }));

  // ---------- formatting ----------
  function money(n) {
    if (n == null) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(x) { return x == null ? '—' : (x > 0 ? '+' : '') + x.toFixed(1) + '%'; }
  function ageShort(d) { return d == null ? '—' : d >= 365 ? (d / 365).toFixed(1) + 'y' : d + 'd'; }
  function ageLong(d) {
    if (d == null) return 'unknown (counted as 1 year)';
    var y = Math.floor(d / 365), rest = d % 365;
    return d + ' days' + (y ? ' (' + y + 'y' + (rest ? ' ' + rest + 'd' : '') + ')' : '');
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  // ---------- the model, recomputed in the page ----------
  // radar-2: implied = TVL x multiple(TVL) x growth x maturity x chains
  function recompute(p) {
    var mult = clamp(0.25 * Math.pow(p.tvl_usd / 1e9, -0.15), 0.1, 0.6);
    var base = p.tvl_usd * mult;
    var g = clamp(p.change_7d == null ? 0 : p.change_7d, -50, 150);
    var gm = 1 + (g / 100) * 0.75;
    var age = p.age_days == null ? 365 : p.age_days;
    var mat = 0.7 + 0.3 * (Math.min(age, 1095) / 1095);
    var cm = 1 + 0.05 * Math.min(p.chains.length, 8);
    return { implied: Math.max(1, Math.round(base * gm * mat * cm)), mult: mult, base: base, g: g, gm: gm, age: age, mat: mat, cm: cm };
  }
  function why(r) {
    var m = r.model;
    return '<b>' + esc(r.name) + '</b> — TVL ' + money(r.tvl_usd) + ' at a ' + m.tvl_multiple.toFixed(3) +
      '× multiple, 7d ' + pct(r.change_7d) + ', ' + ageLong(r.age_days) + ' with no token, ' +
      r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ' → <b>' + money(r.implied_value_usd) + '</b>.';
  }

  // ---------- state from the hash ----------
  var state = { q: '', p: '', category: '', chain: '', tab: 'pre', growing: false, watch: false, sort: 'implied', dir: -1 };
  function readHash() {
    var h = new URLSearchParams(location.hash.slice(1));
    state.q = h.get('q') || ''; state.p = h.get('p') || '';
    state.category = h.get('category') || ''; state.chain = h.get('chain') || '';
    state.tab = h.get('tab') === 'live' ? 'live' : 'pre';
    state.growing = h.get('growing') === '1'; state.watch = h.get('watch') === '1';
    state.sort = h.get('sort') || 'implied';
    state.dir = state.sort === 'name' ? 1 : -1;
  }
  function writeHash() {
    var h = new URLSearchParams();
    if (state.q) h.set('q', state.q);
    if (state.p) h.set('p', state.p);
    if (state.category) h.set('category', state.category);
    if (state.chain) h.set('chain', state.chain);
    if (state.tab === 'live') h.set('tab', 'live');
    if (state.growing) h.set('growing', '1');
    if (state.watch) h.set('watch', '1');
    if (state.sort !== 'implied') h.set('sort', state.sort);
    var s = h.toString();
    history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
  }

  // ---------- elements ----------
  var $ = function (id) { return document.getElementById(id); };
  var qEl = $('q'), catEl = $('category'), chainEl = $('chain'), sortEl = $('sort'),
    rowsEl = $('rows'), countEl = $('count'), emptyEl = $('empty'),
    drawer = $('drawer'), detailEl = $('detail'), scrim = $('scrim');

  // ---------- header stats ----------
  (function stats() {
    var med = rows.slice().sort(function (a, b) { return a.implied_value_usd - b.implied_value_usd; })[Math.floor(rows.length / 2)];
    var top = rows[0];
    $('asof').textContent = 'Snapshot as of ' + R.as_of + '.';
    $('asof2').textContent = R.as_of;
    $('stats').innerHTML =
      '<div><dt>Ranked</dt><dd>' + rows.length + ' <small>protocols</small></dd></div>' +
      '<div><dt>Watchlist</dt><dd>' + R.watchlist.length + ' <small>at the $50M floor</small></dd></div>' +
      '<div><dt>Top implied value</dt><dd>' + money(top.implied_value_usd) + ' <small>' + esc(top.name) + '</small></dd></div>' +
      '<div><dt>Median implied value</dt><dd>' + money(med.implied_value_usd) + '</dd></div>';
    var m = top.model;
    $('worked').innerHTML = '<b>Worked example — #1 ' + esc(top.name) + ':</b> ' + money(top.tvl_usd) + ' × ' +
      m.tvl_multiple.toFixed(3) + ' = ' + money(m.base_usd) + ' base × ' + m.growth_multiplier.toFixed(2) +
      ' momentum × ' + m.maturity_multiplier.toFixed(2) + ' seasoning × ' + m.chain_multiplier.toFixed(2) +
      ' reach = <b>' + money(top.implied_value_usd) + '</b>.';
  })();

  // ---------- filter options ----------
  function fillOptions() {
    var src = state.tab === 'live' ? live : rows;
    var cats = {}, chs = {};
    src.forEach(function (r) { cats[r.category || 'Uncategorised'] = 1; r.chains.forEach(function (c) { chs[c] = 1; }); });
    var keepCat = state.category, keepChain = state.chain;
    catEl.innerHTML = '<option value="">All categories</option>' +
      Object.keys(cats).sort().map(function (c) { return '<option' + (c === keepCat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    chainEl.innerHTML = '<option value="">All chains</option>' +
      Object.keys(chs).sort().map(function (c) { return '<option' + (c === keepChain ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
  }

  // ---------- filtering + sorting ----------
  function filtered() {
    var src = state.tab === 'live' ? live : rows;
    var q = state.q.trim().toLowerCase();
    var list = src.filter(function (r) {
      if (state.category && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.growing && !(r.change_7d != null && r.change_7d > 0)) return false;
      if (state.watch && !wl.has(r.slug)) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort, dir = state.dir;
    list.sort(function (a, b) {
      var d = 0;
      if (key === 'implied') d = (state.tab === 'live' ? (a.mcap_usd || 0) - (b.mcap_usd || 0) : a.implied_value_usd - b.implied_value_usd);
      else if (key === 'tvl') d = a.tvl_usd - b.tvl_usd;
      else if (key === 'growth') d = (a.change_7d || 0) - (b.change_7d || 0);
      else if (key === 'age') d = (a.age_days || 0) - (b.age_days || 0);
      else if (key === 'chains') d = a.chains.length - b.chains.length;
      else if (key === 'name') d = a.name.localeCompare(b.name);
      return d * dir || a.slug.localeCompare(b.slug);
    });
    return list;
  }

  // ---------- table ----------
  function render() {
    fillOptions();
    var list = filtered();
    var isLive = state.tab === 'live';
    document.querySelectorAll('#board thead th')[6].textContent = isLive ? 'Market cap' : 'Implied value';
    countEl.textContent = list.length + ' of ' + (isLive ? live.length : rows.length) + ' shown';
    emptyEl.hidden = list.length > 0;
    var max = isLive ? maxMcap : maxImplied;
    rowsEl.innerHTML = list.map(function (r) {
      var val = isLive ? (r.mcap_usd || 0) : r.implied_value_usd;
      var g = r.change_7d, cls = g == null ? 'flat' : g > 0 ? 'up' : g < 0 ? 'down' : 'flat';
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.p === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="rank"><b>' + r.rank + '</b></td>' +
        '<td><span class="name">' + esc(r.name) + '</span><span class="sub">' + esc(r.slug) +
        ' · <span class="cat">' + esc(r.category || 'Uncategorised') + '</span></span></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num"><span class="' + cls + '">' + pct(g) + '</span></td>' +
        '<td class="num">' + ageShort(r.age_days) + '</td>' +
        '<td class="num">' + r.chains.length + '</td>' +
        '<td class="num"><span class="val">' + money(val) + '</span><span class="bar"><i style="width:' +
        Math.max(1, Math.round(val / max * 100)) + '%"></i></span></td>' +
        '<td><span class="tok ' + (isLive ? 'live' : 'pre') + '">' + (isLive ? 'Live' : 'Pre-token') + '</span></td></tr>';
    }).join('');
    $('tab-pre').setAttribute('aria-selected', String(!isLive));
    $('tab-live').setAttribute('aria-selected', String(isLive));
    qEl.value = state.q; sortEl.value = state.sort;
    $('growing').checked = state.growing; $('watch').checked = state.watch;
    renderDetail();
  }

  // ---------- detail ----------
  function renderDetail() {
    var r = null;
    if (state.p) {
      r = rows.concat(live).find(function (x) { return x.slug === state.p; }) || null;
    }
    if (!r) { drawer.hidden = true; scrim.hidden = true; return; }
    var isLive = r.token_status === 'live';
    var html = '<h2>' + esc(r.name) + '</h2>' +
      '<p class="meta">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) +
      ' · ' + (wl.has(r.slug) ? 'On the watchlist' : 'Early find — below the $50M floor') + '</p>';
    if (isLive) {
      html += '<div class="live-note">This protocol already has a token — market cap <b>' + money(r.mcap_usd) +
        '</b>. It is shown for comparison only and is never ranked against pre-token rows.</div>';
    }
    html += '<h3>Snapshot</h3><div class="kv">' +
      '<div><dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day growth</dt><dd>' + pct(r.change_7d) + '</dd></div>' +
      '<div><dt>Age with no token</dt><dd>' + ageLong(r.age_days) + '</dd></div>' +
      '<div><dt>' + (isLive ? 'Market cap' : 'Implied value · rank #' + r.rank) + '</dt><dd>' +
      money(isLive ? r.mcap_usd : r.implied_value_usd) + '</dd></div></div>';
    if (!isLive && r.model) {
      var m = r.model, rc = recompute(r);
      html += '<h3>How the value is made</h3><div class="eq">' +
        'TVL ' + money(r.tvl_usd) + ' × ' + m.tvl_multiple.toFixed(3) + ' multiple = ' + money(m.base_usd) + ' base\n' +
        '× ' + m.growth_multiplier.toFixed(2) + ' momentum  (7d ' + pct(r.change_7d) + ')\n' +
        '× ' + m.maturity_multiplier.toFixed(2) + ' seasoning (' + ageLong(r.age_days) + ')\n' +
        '× ' + m.chain_multiplier.toFixed(2) + ' reach (' + r.chains.length + ' chains)\n' +
        '= <span class="hl">' + money(r.implied_value_usd) + ' implied value</span></div>' +
        '<h3>Why this rank</h3><p class="why">' + why(r) + '</p>' +
        '<p class="note">Recomputed in this page from TVL, 7d, age and chains: ' + money(rc.implied) +
        (rc.implied === r.implied_value_usd ? ' — matches the board value.' : ' — differs from the board value by ' + money(Math.abs(rc.implied - r.implied_value_usd)) + '.') + '</p>' +
        '<p class="note">Comparable range: live-token protocols in this snapshot trade at ' +
        R.comparables.p25.toFixed(2) + '×–' + R.comparables.p75.toFixed(2) + '× their TVL (25th–75th percentile, n=' +
        R.comparables.n + '); at those multiples this protocol’s TVL alone would be worth ' +
        money(r.tvl_usd * R.comparables.p25) + '–' + money(r.tvl_usd * R.comparables.p75) + '.</p>' +
        '<h3>Farm plan — 6 steps</h3><p class="note">Farm economics: ' + esc(r.farm_summary) + '.</p><ol class="farm">' +
        r.farm_steps.map(function (s) {
          return '<li>' + esc(s).replace(/Cost:/g, '<b>Cost:</b>').replace(/Time:/g, '<b>Time:</b>') + '</li>';
        }).join('') + '</ol>' +
        '<p class="note">Costs are gas per step; the position size is stated in step 2. Never farm from a wallet that holds funds you cannot afford to lose.</p>';
    }
    detailEl.innerHTML = html;
    drawer.hidden = false; scrim.hidden = false;
  }

  // ---------- events ----------
  var deb = null;
  qEl.addEventListener('input', function () { clearTimeout(deb); deb = setTimeout(function () { state.q = qEl.value; writeHash(); render(); }, 120); });
  catEl.addEventListener('change', function () { state.category = catEl.value; writeHash(); render(); });
  chainEl.addEventListener('change', function () { state.chain = chainEl.value; writeHash(); render(); });
  sortEl.addEventListener('change', function () { state.sort = sortEl.value; state.dir = state.sort === 'name' ? 1 : -1; writeHash(); render(); });
  $('growing').addEventListener('change', function (e) { state.growing = e.target.checked; writeHash(); render(); });
  $('watch').addEventListener('change', function (e) { state.watch = e.target.checked; writeHash(); render(); });
  $('tab-pre').addEventListener('click', function () { if (state.tab !== 'pre') { state.tab = 'pre'; writeHash(); render(); } });
  $('tab-live').addEventListener('click', function () { if (state.tab !== 'live') { state.tab = 'live'; writeHash(); render(); } });
  document.querySelectorAll('#board thead th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
      writeHash(); render();
    });
  });
  rowsEl.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.p = tr.getAttribute('data-slug'); writeHash(); render();
  });
  function closeDetail() { state.p = ''; writeHash(); render(); }
  $('close').addEventListener('click', closeDetail);
  scrim.addEventListener('click', closeDetail);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.p) closeDetail(); });
  window.addEventListener('hashchange', function () { readHash(); render(); });

  readHash();
  render();
})();
