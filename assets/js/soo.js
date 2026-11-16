/* =====================================================================
   سو براند — المحرك المشترك
   (العروض الأوتوماتيك، الجمعة البيضاء، سلة الطلب والدفع المقدم، الهدية، السفراء)
   الإعدادات كلها في soo-config.js
   ===================================================================== */
(function () {
  'use strict';
  var C = window.SOO_CFG || {}, R = window.SOO_ROOT || '';
  var FOLD = { S: 'royal', F: 'flat', B: 'sheets' };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function f(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var SETS = C.sets || {};

  /* ------------------------------------------------------------------
     الوقت بتوقيت مصر (بيتعامل مع التوقيت الصيفي لوحده)
     ------------------------------------------------------------------ */
  function cairoOffset(d) {
    try {
      var s = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', timeZoneName: 'longOffset' }).format(d);
      var m = /GMT([+-]\d\d)(?::?(\d\d))?/.exec(s);
      if (m) return m[1] + ':' + (m[2] || '00');
    } catch (e) { }
    return '+02:00';
  }
  function cairoYMD(d) {
    try {
      var p = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d), o = {};
      p.forEach(function (x) { o[x.type] = x.value; });
      return { y: +o.year, m: +o.month, d: +o.day };
    } catch (e) { return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
  }
  function ymdStr(u) { return u.getUTCFullYear() + '-' + pad(u.getUTCMonth() + 1) + '-' + pad(u.getUTCDate()); }

  /* الجمعة الحالية/الجاية: {date, open, close, live, offers} */
  function fridayInfo(nowMs) {
    var t = cairoYMD(new Date(nowMs)), u = new Date(Date.UTC(t.y, t.m - 1, t.d, 12));
    var wd = u.getUTCDay(), to = (5 - wd + 7) % 7;
    u = new Date(u.getTime() + to * 864e5);
    var date = ymdStr(u), off = cairoOffset(u);
    return {
      date: date, live: to === 0, daysTo: to,
      open: Date.parse(date + 'T00:00:00' + off), close: Date.parse(date + 'T23:59:59' + off),
      closeISO: date + 'T23:59:59' + off,
      offers: (C.friday && C.friday[date]) || {}, bundle: (C.fridayBundles && C.fridayBundles[date]) || null, ts: u.getTime()
    };
  }

  /* ------------------------------------------------------------------
     العروض الشغالة دلوقتي  → window.SOO_OFFERS  (بيقراها محرك الصفحات)
     ------------------------------------------------------------------ */
  var NOW = Date.now(), OFF = {}, nextBoundary = Infinity;
  Object.keys(C.offers || {}).forEach(function (code) {
    var o = C.offers[code]; if (!SETS[code] || !(o.price > 0 && o.price < SETS[code].p)) return;
    var s = o.start ? Date.parse(o.start) : 0, e = o.end ? Date.parse(o.end) : Infinity;
    if (s > NOW) { nextBoundary = Math.min(nextBoundary, s); return; }
    if (e > NOW) OFF[code] = { price: o.price, end: o.end };
  });
  var FRI = fridayInfo(NOW), friCount = 0;
  if (FRI.live) {
    Object.keys(FRI.offers).forEach(function (code) {
      var p = +FRI.offers[code]; if (!SETS[code] || !(p > 0 && p < SETS[code].p)) return;
      friCount++;
      if (!OFF[code] || p < OFF[code].price) OFF[code] = { price: p, end: FRI.closeISO, friday: true };
    });
    nextBoundary = Math.min(nextBoundary, FRI.close + 1500);
  } else {
    nextBoundary = Math.min(nextBoundary, FRI.open);
  }
  window.SOO_OFFERS = OFF;
  var BUN = (FRI.live && FRI.bundle) ? FRI.bundle : null;
  /* لما يتفتح عرض مجدول / الجمعة تبدأ أو تخلص: الصفحة بتتحدّث لوحدها */
  if (nextBoundary < Infinity && nextBoundary - NOW < 2147e6 && nextBoundary - NOW > 300) {
    setTimeout(function () { location.reload(); }, nextBoundary - NOW + 400);
  }

  function unit(code) { var o = OFF[code]; return o ? o.price : SETS[code].p; }

  /* ------------------------------------------------------------------
     الرسايل: السطر بتاع السعر في الواتساب + الترشيح (سفراء سو براند)
     ------------------------------------------------------------------ */
  var REF = '';
  try {
    var q = new URLSearchParams(location.search).get('ref');
    if (q) { q = q.replace(/[^؀-ۿa-zA-Z0-9 _.-]/g, '').trim().slice(0, 30); if (q) localStorage.setItem('soo_ref', q); }
    REF = localStorage.getItem('soo_ref') || '';
  } catch (e) { }
  function decorate(msg) { return REF ? msg + '\n\nترشيح من: ' + REF : msg; }
  function offerMsg(card) {
    var code = card.dataset.code, o = OFF[code], s = SETS[code];
    if (!o || !s) return card.dataset.msg;
    return card.dataset.msg.replace(/السعر: .*/, 'السعر: ' + f(o.price) + ' جنيه بدلا من ' + f(s.p) + ' جنيه (' + (o.friday ? 'عرض الجمعة البيضاء' : (o.end ? 'عرض لفترة محدودة' : 'عرض خاص')) + ')');
  }

  /* ------------------------------------------------------------------
     أيقونات + علبة الهدية
     ------------------------------------------------------------------ */
  function giftSVG() {
    return '<svg class="gsvg" viewBox="0 0 120 120" aria-hidden="true">' +
      '<defs><linearGradient id="gw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a1d3f"/><stop offset="1" stop-color="#3a0c1a"/></linearGradient>' +
      '<linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e0a3"/><stop offset=".55" stop-color="#d9ae62"/><stop offset="1" stop-color="#a8721f"/></linearGradient>' +
      '<radialGradient id="gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".95"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient></defs>' +
      '<circle class="gglow" cx="60" cy="58" r="52" fill="url(#gl)"/>' +
      '<ellipse cx="60" cy="112" rx="38" ry="5" fill="rgba(0,0,0,.28)"/>' +
      '<g class="gspark" fill="#ffe9a8"><path d="M16 30l2.2 5.8L24 38l-5.8 2.2L16 46l-2.2-5.8L8 38l5.8-2.2z"/><path d="M104 24l1.8 4.6 4.6 1.8-4.6 1.8-1.8 4.6-1.8-4.6-4.6-1.8 4.6-1.8z"/><path d="M98 70l1.5 3.8 3.8 1.5-3.8 1.5-1.5 3.8-1.5-3.8-3.8-1.5 3.8-1.5z"/></g>' +
      '<rect x="24" y="58" width="72" height="50" rx="6" fill="url(#gw)" stroke="#d9ae62" stroke-width="1.5"/>' +
      '<rect x="54" y="58" width="12" height="50" fill="url(#gg)"/>' +
      '<g class="glid"><rect x="18" y="42" width="84" height="19" rx="5" fill="url(#gw)" stroke="#d9ae62" stroke-width="1.5"/>' +
      '<rect x="54" y="42" width="12" height="19" fill="url(#gg)"/>' +
      '<path d="M60 42c-6-14-24-14-24-5 0 7 15 6 24 5z" fill="url(#gg)" stroke="#a8721f" stroke-width="1"/>' +
      '<path d="M60 42c6-14 24-14 24-5 0 7-15 6-24 5z" fill="url(#gg)" stroke="#a8721f" stroke-width="1"/>' +
      '<circle cx="60" cy="42" r="5.5" fill="url(#gg)" stroke="#a8721f" stroke-width="1"/></g></svg>';
  }
  function fillGifts(root) { $$('[data-giftbox]', root).forEach(function (el) { if (!el.firstChild) el.innerHTML = giftSVG(); }); }

  /* ------------------------------------------------------------------
     1) تجهيز ماركب العروض لكل الأطقم (علشان أي طقم يتعمله عرض يشتغل أوتوماتيك)
     ------------------------------------------------------------------ */
  var CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v4l2.5 2M9 2.5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function cdHTML(big) {
    return '<div class="cd off-only' + (big ? ' big' : '') + '" role="timer" aria-label="الوقت المتبقي على انتهاء العرض"><span class="cdl">' + CLOCK + 'العرض ينتهي بعد</span><div class="cdb">' +
      '<div class="u" data-w="d"><b data-u="d">00</b><i>يوم</i></div><div class="u" data-w="h"><b data-u="h">00</b><i>ساعة</i></div>' +
      '<div class="u" data-w="m"><b data-u="m">00</b><i>دقيقة</i></div><div class="u" data-w="s"><b data-u="s">00</b><i>ثانية</i></div></div></div>';
  }
  var OFFP = function (code) { var s = SETS[code]; return '<strong class="offp"><bdi dir="ltr" data-offprice>' + f(s.p) + '</bdi> <small>جنيه</small></strong><s><bdi dir="ltr">' + f(s.p) + '</bdi></s>'; };
  function ensureMarkup() {
    $$('.card[data-code], a.rq[data-code]').forEach(function (el) {
      var code = el.dataset.code, s = SETS[code]; if (!s) return;
      el.dataset.reg = s.p;
      if (el.dataset.ok) return;
      if (el.classList.contains('rq')) {
        if (!$('.off-only', el)) {
          var pz = $('.pz', el), st = $('strong', pz), im = $('.im', el);
          if (st) st.classList.add('reg-only');
          pz.insertAdjacentHTML('beforeend', '<span class="off-only">' + OFFP(code) + '</span>');
          if (im) im.insertAdjacentHTML('beforeend', '<span class="rb off-only">عرض <bdi dir="ltr" data-pct>0%</bdi></span>');
        }
      } else if (el.classList.contains('solo')) {
        if (!$('.price.off-only', el)) {
          var pr = $('.price', el);
          if (pr) {
            pr.classList.add('reg-only');
            pr.insertAdjacentHTML('afterend', '<div class="price off-only"><div class="now"><span class="lbl">سعر العرض</span><strong class="offp"><bdi dir="ltr" data-offprice>0</bdi></strong><span class="cur">جنيه</span></div><div class="was"><s><bdi dir="ltr">' + f(s.p) + '</bdi> جنيه</s><span class="tag">وفّرت <bdi dir="ltr" data-save>0</bdi> جنيه</span></div></div>' + cdHTML(true));
          }
        }
      } else if (el.classList.contains('pc')) {
        if (!$('.pr .off-only', el)) {
          var p2 = $('.pr', el), bd = $('.bd2', el);
          if (p2) {
            var cur = p2.innerHTML;
            p2.innerHTML = '<div class="grp reg-only">' + cur + '</div><div class="grp off-only">' + OFFP(code) + '</div>';
            p2.insertAdjacentHTML('afterend', cdHTML(false));
          }
          if (bd) bd.insertAdjacentHTML('beforeend', '<span class="pct hot off-only">عرض <bdi dir="ltr" data-pct>0%</bdi></span>');
        }
      }
      el.dataset.ok = 1;
    });
    /* صفحة العروض: كل الأطقم موجودة (الشغال بس بيظهر) وبترتيب الأقرب انتهاءً */
    var grid = $('#ofgrid');
    if (grid) {
      var have = {}; $$('.card', grid).forEach(function (c) { have[c.dataset.code] = c; });
      var tpl = $('#oftpl');
      if (tpl) {
        var wrap = document.createElement('div'); wrap.innerHTML = tpl.innerHTML;
        $$('.card', wrap).forEach(function (c) { if (!have[c.dataset.code]) { c.hidden = true; grid.appendChild(c); have[c.dataset.code] = c; } });
      }
      Object.keys(have).sort(function (a, b) {
        var ea = OFF[a] ? (OFF[a].end ? Date.parse(OFF[a].end) : 9e15) : Infinity, eb = OFF[b] ? (OFF[b].end ? Date.parse(OFF[b].end) : 9e15) : Infinity;
        return ea - eb || (a < b ? -1 : 1);
      }).forEach(function (code) { grid.appendChild(have[code]); });
    }
    /* أزرار "ادفع مقدمًا" على كل طقم */
    $$('.card.pc .mb, .card.solo .cbody').forEach(function (box) {
      var card = box.closest('.card'); if (!card.dataset.code || $('.btn-pay', box)) return;
      var wa = $('.btn-wa', box); if (!wa) return;
      wa.insertAdjacentHTML('afterend', '<button class="btn btn-pay" type="button" data-prepay data-code="' + card.dataset.code + '"><span class="bp-ic"><svg class="ico"><use href="#i-card"/></svg></span><span class="bp-t">ادفع مقدمًا (كاش / إنستا باي)</span>' + (ppMax((SETS[card.dataset.code] || {}).g) ? '<em class="bp-s">وفّر حتى ' + ppMax((SETS[card.dataset.code] || {}).g) + ' ج</em>' : '') + '</button>');
    });
  }

  /* ------------------------------------------------------------------
     2) سلة الطلب + الدفع المقدم + الهدية
     ------------------------------------------------------------------ */
  var PAY = C.pay || {}, st = { q: {}, method: 'vodafone', bun: null }, os = null, lastFocus = null;
  function kindOf(m) { return m === 'cod' ? null : (m === 'instapay' ? 'insta' : 'cash'); }
  function rate(g, k) { var p = (C.prepay || {})[g]; return p && k ? (+p[k] || 0) : 0; }
  function ppMax(g) { return Math.max(rate(g, 'cash'), rate(g, 'insta')); }
  function ppMaxAll() { var m = 0; Object.keys(C.prepay || {}).forEach(function (g) { m = Math.max(m, ppMax(g)); }); return m; }
  function groupCounts() { var gc = {}; Object.keys(st.q).forEach(function (c) { if (st.q[c] > 0 && SETS[c]) gc[SETS[c].g] = (gc[SETS[c].g] || 0) + st.q[c]; }); return gc; }
  function discFor(m, total) {
    var k = kindOf(m); if (!k) return 0;
    /* خصم واحد ثابت على الأوردر كله: أعلى قيمة بين مجموعات الأطقم الموجودة (مش بيتجمع) */
    var gc = groupCounts(), d = 0;
    Object.keys(gc).forEach(function (g) { d = Math.max(d, rate(g, k)); });
    return Math.min(d, total);
  }
  function tileDisc(m) {
    if (m === 'cod') return 'بدون خصم';
    var gc = groupCounts();
    if (!Object.keys(gc).length) { var k = kindOf(m), mx = 0; Object.keys(C.prepay || {}).forEach(function (g) { mx = Math.max(mx, rate(g, k)); }); return 'حتى ' + mx + ' ج'; }
    var dd = discFor(m, 1e9); return dd > 0 ? '−' + dd + ' ج' : 'بدون خصم';
  }
  function bestDisc() { return Math.max(discFor('vodafone', 1e9), discFor('instapay', 1e9)); }
  function giftN() { var n = 0; Object.keys(st.q).forEach(function (c) { if (SETS[c] && SETS[c].g === C.giftGroup) n += st.q[c]; }); return n; }
  function calc() {
    var total = 0, count = 0;
    Object.keys(st.q).forEach(function (c) { if (st.q[c] > 0 && SETS[c]) { total += unit(c) * st.q[c]; count += st.q[c]; } });
    if (st.bun) { if (!st.bun.pick) return { total: 0, count: 0, bundle: 0, pre: false, disc: 0, due: 0, wait: true }; total = BUN.was; }
    var bd = st.bun ? BUN.was - BUN.price : bundleDisc(), net = total - bd;
    var pre = st.method !== 'cod' && count > 0, disc = pre ? discFor(st.method, net) : 0;
    return { total: total, count: count, bundle: bd, pre: pre, disc: disc, due: net - disc };
  }
  /* باقات التوفير: أقل تكلفة لعدد n طقم من نفس المجموعة (سعر الطقم الواحد u أو الباقات) */
  function bundleCost(g, n, u) {
    var Bd = (C.bundles || {})[g], best = [0], i;
    for (i = 1; i <= n; i++) {
      var m = best[i - 1] + u;
      if (Bd) Object.keys(Bd).forEach(function (k) { k = +k; if (k <= i) m = Math.min(m, best[i - k] + Bd[k]); });
      best[i] = m;
    }
    return best[n];
  }
  function bundleDisc() {
    var gt = {}, gn = {}, d = 0;
    Object.keys(st.q).forEach(function (c) { var n = st.q[c]; if (n > 0 && SETS[c]) { var g = SETS[c].g; gt[g] = (gt[g] || 0) + unit(c) * n; gn[g] = (gn[g] || 0) + n; } });
    Object.keys(gn).forEach(function (g) { if (!(C.bundles || {})[g]) return; d += gt[g] - Math.min(gt[g], bundleCost(g, gn[g], gt[g] / gn[g])); });
    return Math.round(d);
  }
  var GNAME = { S: 'مفارش الفخامة', F: 'مفارش الفلات', B: 'ملايات السرير' };
  function nudgeHTML() {
    if (st.bun) return '';
    var gn = {}, out = '';
    Object.keys(st.q).forEach(function (c) { if (st.q[c] > 0 && SETS[c]) gn[SETS[c].g] = (gn[SETS[c].g] || 0) + st.q[c]; });
    Object.keys(gn).forEach(function (g) {
      var Bd = (C.bundles || {})[g]; if (!Bd) return;
      var ks = Object.keys(Bd).map(Number).sort(function (a, b) { return a - b; }), nx = ks.filter(function (k) { return k > gn[g]; })[0];
      if (!nx) return;
      var gap = nx - gn[g], w = gap === 1 ? 'طقم' : (gap === 2 ? 'طقمين' : gap + ' أطقم');
      out += '<p class="os-nudge">ضيف ' + w + ' كمان من ' + (GNAME[g] || g) + '، وخد باقة ' + nx + ' أطقم بـ ' + f(Bd[nx]) + ' جنيه.</p>';
    });
    return out;
  }
  function fillBundles() {
    $$('[data-bundles]').forEach(function (el) {
      var g = el.dataset.bundles || 'B', Bd = (C.bundles || {})[g]; if (!Bd) return;
      var codes = Object.keys(SETS).filter(function (c) { return SETS[c].g === g; }); if (!codes.length) return;
      var reg = SETS[codes[0]].p, u = unit(codes[0]), ks = Object.keys(Bd).map(Number).sort(function (a, b) { return a - b; });
      var tiles = '<div class="bnd-t"><b>طقم واحد</b><strong><bdi dir="ltr">' + f(u) + '</bdi></strong><small>جنيه' + (u < reg ? ' بدل ' + f(reg) : '') + '</small></div>';
      ks.forEach(function (k, i) {
        tiles += '<button type="button" class="bnd-t' + (i === ks.length - 1 ? ' best' : '') + '" data-bundle data-g="' + g + '"><b>' + k + ' أطقم</b><strong><bdi dir="ltr">' + f(Bd[k]) + '</bdi></strong><small>جنيه · الطقم بـ ' + f(Math.round(Bd[k] / k)) + '</small></button>';
      });
      el.innerHTML = '<h2>باقات التوفير</h2><p>كل ما تزوّد الأطقم، سعر الطقم بينزل. اختار الباقة واحسب طلبك.</p><div class="bnd-g">' + tiles + '</div>';
    });
  }
  function buildMsg() {
    var t = calc(), L = ['السلام عليكم، عايز أطلب من سو براند 🌸', '', (st.bun ? 'باقة الجمعة البيضاء (3 أطقم):' : 'الأطقم:')];
    Object.keys(SETS).forEach(function (c) {
      var n = st.q[c]; if (!(n > 0)) return;
      if (st.bun) { L.push('- ' + c + ' — ' + SETS[c].t); return; }
      L.push('- ' + c + ' × ' + n + ' — ' + SETS[c].t + ' — ' + f(unit(c)) + ' جنيه للطقم' + (OFF[c] ? ' (سعر العرض بدل ' + f(SETS[c].p) + ')' : ''));
    });
    L.push('', 'إجمالي الأطقم: ' + f(t.total) + ' جنيه');
    if (t.bundle) L.push('خصم الباقة: -' + f(t.bundle) + ' جنيه');
    if (t.pre) {
      var p = PAY[st.method];
      L.push('خصم الدفع المقدم: -' + f(t.disc) + ' جنيه', 'المطلوب تحويله: ' + f(t.due) + ' جنيه', 'طريقة الدفع: ' + p.n + ' (' + p.num + ') — هبعتلكم سكرين شوت التحويل');
    } else { L.push('طريقة الدفع: عند الاستلام'); }
    if (giftN() >= (C.giftMin || 4)) L.push('', '🎁 هدية سو براند: مستحقة (' + giftN() + ' أطقم من مجموعة ' + C.giftGroup + ')');
    L.push('', 'رابط الكتالوج: ' + C.base);
    return decorate(L.join('\n'));
  }

  function rowHTML(code) {
    var s = SETS[code], o = OFF[code];
    return '<div class="os-row" data-row="' + code + '"><img src="' + s.i + '" alt="" width="56" height="70" loading="lazy">' +
      '<div class="os-rt"><b><span class="os-code">' + code + '</span>' + (o ? '<span class="os-off">عرض</span>' : '') + '</b><span class="os-nm">' + esc(s.t) + '</span>' +
      '<span class="os-pr">' + (o ? '<strong class="offp"><bdi dir="ltr">' + f(o.price) + '</bdi></strong><s><bdi dir="ltr">' + f(s.p) + '</bdi></s>' : '<strong><bdi dir="ltr">' + f(s.p) + '</bdi></strong>') + ' <small>جنيه</small></span></div>' +
      '<div class="os-qty"><button type="button" data-os="dec" data-code="' + code + '" aria-label="إنقاص">−</button><output data-qty="' + code + '">0</output><button type="button" data-os="inc" data-code="' + code + '" aria-label="زيادة">+</button></div></div>';
  }
  function ensureOS() {
    if (os) return os;
    os = document.createElement('div'); os.className = 'os-bg'; os.hidden = true; os.id = 'os';
    var groups = { S: 'مفارش الفخامة', F: 'مفارش الفلات', B: 'ملايات السرير' }, list = '', last = '';
    Object.keys(SETS).forEach(function (c) {
      var g = SETS[c].g; if (g !== last) { list += '<div class="os-grp">' + (groups[g] || g) + '</div>'; last = g; }
      list += rowHTML(c);
    });
    os.innerHTML = '<div class="os-sheet" role="dialog" aria-modal="true" aria-labelledby="os-h"><button class="os-x" type="button" data-os="close" aria-label="إغلاق">×</button>' +
      '<div class="os-body" id="os-body"><div class="os-top"><span class="os-ic"><svg class="ico"><use href="#i-card"/></svg></span><div><h3 id="os-h">اطلب طقمك</h3><p>اختار أطقمك واحسب المطلوب بالظبط. وادفع مقدمًا علشان توفّر <b>حتى ' + ppMaxAll() + ' جنيه</b>.</p></div></div>' +
      '<div id="os-bunp" hidden></div><div class="os-sec" id="os-s1"><i>1</i>اختار أطقمك</div><div class="os-list" id="os-ls">' + list + '</div>' +
      '<div id="os-dyn"></div></div><div class="os-foot" id="os-foot"></div></div>';
    document.body.appendChild(os);
    os.addEventListener('click', function (e) {
      var b = e.target.closest('[data-os]');
      if (e.target === os) return closeOS();
      if (!b) return;
      var a = b.dataset.os, c = b.dataset.code;
      if (a === 'close') closeOS();
      else if (a === 'inc') { st.q[c] = Math.min(9, (st.q[c] || 0) + 1); render(); }
      else if (a === 'dec') { st.q[c] = Math.max(0, (st.q[c] || 0) - 1); render(); }
      else if (a === 'method') { st.method = b.dataset.m; render(); }
      else if (a === 'copy') copyNum(b);
      else if (a === 'pick') pickSheet(c);
      else if (a === 'exitbun') { st.bun = null; loadCart(); render(); }
      else if (a === 'clear') { st.q = {}; render(); }
    });
    return os;
  }
  function copyNum(btn) {
    var num = PAY[st.method] && PAY[st.method].num; if (!num) return;
    var done = function () { btn.textContent = 'تم النسخ'; btn.classList.add('ok'); setTimeout(function () { btn.textContent = 'نسخ الرقم'; btn.classList.remove('ok'); }, 1800); };
    function fb() { var t = document.createElement('textarea'); t.value = num; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (x) { } t.remove(); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(num).then(done, fb); else fb();
  }
  function render() {
    var bp = $('#os-bunp', os), s1 = $('#os-s1', os), ls = $('#os-ls', os);
    if (bp) { bp.hidden = !st.bun; if (s1) s1.hidden = !!st.bun; if (ls) ls.hidden = !!st.bun; if (st.bun) bp.innerHTML = bunPanel(); }
    Object.keys(SETS).forEach(function (c) {
      var n = st.q[c] || 0, out = $('[data-qty="' + c + '"]', os), row = $('[data-row="' + c + '"]', os);
      if (out) out.textContent = n; if (row) row.classList.toggle('on', n > 0);
    });
    var t = calc(), gn = giftN(), gm = C.giftMin || 4, got = gn >= gm, G = C.giftGroup;
    var tiles = Object.keys(PAY).map(function (k) {
      var p = PAY[k];
      return '<button type="button" class="os-m' + (st.method === k ? ' on' : '') + '" data-os="method" data-m="' + k + '" aria-pressed="' + (st.method === k) + '"><span class="lg' + (p.bg ? ' fill' : '') + '"' + (p.bg ? ' style="background:' + p.bg + '"' : '') + '><img src="' + p.img + '" alt=""></span><b>' + p.n + '</b><em>' + tileDisc(k) + '</em></button>';
    }).join('') + '<button type="button" class="os-m os-cod' + (st.method === 'cod' ? ' on' : '') + '" data-os="method" data-m="cod" aria-pressed="' + (st.method === 'cod') + '"><span class="lg cod"><svg class="ico"><use href="#i-truck"/></svg></span><b>عند الاستلام</b><em>بدون خصم</em></button>';
    var pips = ''; for (var i = 0; i < gm; i++) pips += '<i class="' + (i < gn ? 'on' : '') + '"></i>';
    var giftTxt = got ? 'مبروك! هديتك من سو براند هتوصلك مع الطقم.' : (gn === 0 ? 'اطلب ' + gm + ' أطقم أو أكتر من مجموعة ' + G + ' وهدية مفاجأة من سو براند تفتح معاك.' : 'باقي ' + (gm - gn) + (gm - gn > 2 ? ' أطقم' : (gm - gn === 2 ? ' طقمين' : ' طقم')) + ' من مجموعة ' + G + ' وهديتك تتفتح.');
    var sum = '';
    if (t.count) {
      sum = '<div class="os-line"><span>إجمالي الأطقم (' + t.count + ')</span><b><bdi dir="ltr">' + f(t.total) + '</bdi> جنيه</b></div>' +
        (t.bundle ? '<div class="os-line disc"><span>خصم الباقة</span><b>−<bdi dir="ltr">' + f(t.bundle) + '</bdi> جنيه</b></div>' : '') +
        (t.pre && t.disc > 0 ? '<div class="os-line disc"><span>خصم الدفع المقدم</span><b>−<bdi dir="ltr">' + f(t.disc) + '</bdi> جنيه</b></div>' : (bestDisc() > 0 ? '<div class="os-line hint"><span>ادفع مقدمًا (كاش / وي باي / إنستا باي) وهتوفّر حتى ' + bestDisc() + ' جنيه</span></div>' : '')) +
        '<div class="os-line due"><span>' + (t.pre ? 'المطلوب تحويله' : 'الإجمالي') + '</span><b><bdi dir="ltr">' + f(t.due) + '</bdi> جنيه</b></div>' +
        '<p class="os-note">رسوم الشحن بتتحدد على حسب محافظتك، وبنبلغك بيها قبل تأكيد الأوردر.</p>';
    } else sum = '<p class="os-empty">' + (st.bun ? 'اختار الملاية اللي عجبتك من القايمة فوق، وهنحسبلك الباقة فورًا.' : 'ابدأ بإضافة طقم من القايمة فوق، وهنحسبلك المطلوب فورًا.') + '</p>';
    sum += nudgeHTML();
    var xfer = '';
    if (t.pre) {
      var p = PAY[st.method];
      xfer = '<div class="os-sec"><i>' + (st.bun ? 4 : 3) + '</i>حوّل على ' + p.n + '</div><div class="os-num"><div><small>الرقم اللي هتحوّل عليه</small><bdi class="num" dir="ltr">' + p.num + '</bdi></div><button type="button" data-os="copy">نسخ الرقم</button></div>' +
        '<ol class="os-steps"><li>حوّل مبلغ <b><bdi dir="ltr">' + f(t.due) + '</bdi> جنيه</b> على الرقم ده.</li><li>دوس "ابعت الطلب على واتساب" تحت، وابعتلنا سكرين شوت التحويل.</li></ol>';
    }
    $('#os-dyn', os).innerHTML = '<div class="os-sec"><i>' + (st.bun ? 3 : 2) + '</i>طريقة الدفع</div><div class="os-pay">' + tiles + '</div>' +
      '<div class="os-gift' + (got ? ' open' : '') + (st.bun ? ' gone' : '') + '"><div class="gx" data-giftbox></div><div class="gt"><b>هديتك من سو براند</b><span>' + giftTxt + '</span><div class="pips">' + pips + '</div></div></div>' +
      '<div class="os-sum">' + sum + '</div>' + xfer;
    fillGifts(os);
    var msg = t.count ? buildMsg() : '', enc = encodeURIComponent(msg), nums = C.wa || [];
    $('#os-foot', os).innerHTML = '<div class="os-due"><small>' + (t.pre ? 'المطلوب تحويله' : 'الإجمالي') + '</small><strong><bdi dir="ltr">' + (t.count ? f(t.due) : '0') + '</bdi> <em>جنيه</em></strong></div>' +
      '<div class="os-go' + (t.count ? '' : ' dis') + '">' + nums.map(function (n, i) {
        return '<a class="btn btn-wa" ' + (t.count ? 'href="https://wa.me/20' + n.replace(/^0/, '') + '?text=' + enc + '" target="_blank" rel="noopener"' : 'role="link" aria-disabled="true"') + '><svg class="ico"><use href="#i-wa"/></svg><span>' + (i === 0 ? 'ابعت الطلب' : (i === 1 ? 'رقم تاني' : 'رقم تالت')) + '</span><bdi dir="ltr">' + n.slice(0, 4) + ' ' + n.slice(4, 7) + ' ' + n.slice(7) + '</bdi></a>';
      }).join('') + '</div>';
  }
  function openOS(o) {
    o = o || {}; ensureOS();
    if (o.bundle && BUN) { st.bun = { pick: null }; st.q = {}; BUN.fixed.forEach(function (c) { st.q[c] = 1; }); }
    else if (st.bun) { st.bun = null; loadCart(); }
    if (o.method) st.method = o.method;
    if (o.code && SETS[o.code]) st.q[o.code] = Math.max(1, st.q[o.code] || 0);
    lastFocus = document.activeElement;
    render(); os.hidden = false; document.body.classList.add('lock');
    var b = $('#os-body', os); if (b) b.scrollTop = 0;
    var sc = o.code || (o.group && Object.keys(SETS).filter(function (c) { return SETS[c].g === o.group; })[0]);
    if (sc) { var r = $('[data-row="' + sc + '"]', os); if (r && b) setTimeout(function () { b.scrollTop = Math.max(0, r.offsetTop - 150); }, 30); }
    var x = $('.os-x', os); if (x) x.focus();
  }
  function closeOS() { if (!os) return; os.hidden = true; document.body.classList.remove('lock'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && os && !os.hidden) closeOS(); });

  /* ------------------------------------------------------------------
     السلة: حفظ على جهاز العميل + أيقونة عائمة + زرار "أضف للسلة"
     ------------------------------------------------------------------ */
  function track(ev, data) {
    try { if (typeof window.fbq === 'function') window.fbq('track', ev, data || {}); } catch (e) { }
  }
  function cartData() {
    var ids = [], contents = [], t = calc();
    Object.keys(st.q).forEach(function (c) { if (st.q[c] > 0 && SETS[c]) { ids.push(c); contents.push({ id: c, quantity: st.q[c], item_price: unit(c) }); } });
    return { content_ids: ids, contents: contents, content_type: 'product', num_items: t.count, value: Math.max(0, t.total - t.bundle), currency: 'EGP' };
  }
  var CART_KEY = 'soo_cart_v1', CART_TTL = 3 * 864e5, cartFab = null, toastEl = null, toastT = 0, lastN = 0;
  function loadCart() {
    var q = {}, m = null;
    try {
      var j = JSON.parse(localStorage.getItem(CART_KEY) || 'null');
      if (j && j.t && Date.now() - j.t < CART_TTL && j.q) {
        Object.keys(j.q).forEach(function (c) { var n = Math.floor(+j.q[c]); if (SETS[c] && n > 0) q[c] = Math.min(9, n); });
        if (j.m === 'cod' || (j.m && PAY[j.m])) m = j.m;
      }
    } catch (e) { }
    st.q = q; if (m) st.method = m;
  }
  function saveCart() {
    if (st.bun) return;
    try {
      var any = Object.keys(st.q).some(function (c) { return st.q[c] > 0; });
      if (any) localStorage.setItem(CART_KEY, JSON.stringify({ q: st.q, m: st.method, t: Date.now() })); else localStorage.removeItem(CART_KEY);
    } catch (e) { }
  }
  var BAG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 8h13l-1.1 12.2a1 1 0 0 1-1 .8H7.6a1 1 0 0 1-1-.8L5.5 8z"/><path d="M9 8V6.6a3 3 0 0 1 6 0V8"/></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  function updateFab() {
    var t = calc(), n = t.count;
    if (!cartFab) {
      cartFab = document.createElement('button'); cartFab.type = 'button'; cartFab.className = 'cartfab'; cartFab.setAttribute('aria-label', 'افتح السلة'); cartFab.hidden = true;
      cartFab.addEventListener('click', function () { openOS({}); });
      document.body.appendChild(cartFab);
    }
    cartFab.hidden = !(n > 0) || !!st.bun || !!(os && !os.hidden);
    cartFab.innerHTML = '<span class="cf-i">' + BAG + '<b>' + n + '</b></span><span class="cf-t"><small>سلتك</small><strong><bdi dir="ltr">' + f(t.total - t.bundle) + '</bdi> جنيه</strong></span>';
    if (n > lastN) { cartFab.classList.remove('bump'); void cartFab.offsetWidth; cartFab.classList.add('bump'); }
    lastN = n;
  }
  function hideToast() { if (toastEl) toastEl.classList.remove('on'); clearTimeout(toastT); }
  function showToast(code) {
    if (!toastEl) {
      toastEl = document.createElement('div'); toastEl.className = 'carttoast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    var t = calc();
    toastEl.innerHTML = '<span class="ct-ok">✓</span><span class="ct-tx"><b>' + code + '</b> اتضاف للسلة<small>' + t.count + (t.count === 1 ? ' طقم' : ' أطقم') + ' · ' + f(t.total - t.bundle) + ' جنيه</small></span><button type="button" data-opencart>شوف السلة</button>';
    toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(hideToast, 3200);
  }
  function addToCart(code, btn) {
    if (!SETS[code]) return;
    if (st.bun) { st.bun = null; loadCart(); }
    st.q[code] = Math.min(9, (st.q[code] || 0) + 1);
    saveCart(); updateFab(); showToast(code);
    track('AddToCart', { content_ids: [code], content_type: 'product', contents: [{ id: code, quantity: 1, item_price: unit(code) }], value: unit(code), currency: 'EGP' });
    if (btn) {
      var lab = btn.querySelector('span'); if (lab && !btn.dataset.t) btn.dataset.t = lab.textContent;
      btn.classList.add('ok'); if (lab) lab.textContent = 'اتضاف ✓ (' + st.q[code] + ')';
      clearTimeout(btn._t); btn._t = setTimeout(function () { btn.classList.remove('ok'); if (lab) lab.textContent = btn.dataset.t; }, 1600);
    }
  }
  function injectCart() {
    $$('.card[data-code]').forEach(function (el) {
      var code = el.dataset.code, wa = $('.btn-wa[data-wa="card"]', el);
      if (!SETS[code] || !wa || $('[data-addcart]', el)) return;
      var add = document.createElement('button'); add.type = 'button'; add.className = 'btn btn-gold btn-cart'; add.dataset.addcart = code;
      add.innerHTML = PLUS + '<span>أضف للسلة</span>';
      var w = document.createElement('div'); w.className = 'cta2';
      if (el.classList.contains('pc')) { wa.setAttribute('aria-label', 'اطلب هذا الطقم مباشرة عبر واتساب'); wa.title = 'اطلب هذا الطقم مباشرة عبر واتساب'; }
      wa.parentNode.insertBefore(w, wa); w.appendChild(add); w.appendChild(wa);
    });
  }
  var _render = render, _closeOS = closeOS, _openOS = openOS;
  render = function () {
    _render.apply(this, arguments);
    var s1 = os && $('#os-s1', os);
    if (s1) {
      var c = $('.os-clr', s1);
      if (!c) { c = document.createElement('button'); c.type = 'button'; c.className = 'os-clr'; c.dataset.os = 'clear'; c.textContent = 'تفريغ السلة'; s1.appendChild(c); }
      c.hidden = !calc().count || !!st.bun;
    }
    saveCart(); updateFab();
  };
  closeOS = function () { if (st.bun) { st.bun = null; loadCart(); } _closeOS.apply(this, arguments); updateFab(); };
  openOS = function () { _openOS.apply(this, arguments); updateFab(); if (!st.bun && calc().count > 0) track('InitiateCheckout', cartData()); };

  var NAME2M = { 'فودافون كاش': 'vodafone', 'وي باي': 'wepay', 'إنستا باي': 'instapay' };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('#os-foot a.btn-wa[href]');
    if (b) { var d = cartData(); d.value = Math.max(0, calc().due); track('Lead', d); }
    b = e.target.closest('[data-wa]');
    if (b && !b.closest('#os-foot')) {
      if (b.dataset.wa === 'card') { var cc2 = b.closest('[data-code]'), k = cc2 && cc2.dataset.code; if (k && SETS[k]) track('Lead', { content_ids: [k], content_type: 'product', value: unit(k), currency: 'EGP' }); }
      else track('Contact');
    }
    b = e.target.closest('[data-addcart]');
    if (b) { e.preventDefault(); e.stopImmediatePropagation(); addToCart(b.dataset.addcart, b); return; }
    b = e.target.closest('[data-opencart]');
    if (b) { e.preventDefault(); e.stopImmediatePropagation(); hideToast(); openOS({}); return; }
    b = e.target.closest('#os-foot a.btn-wa[href]');
    if (b) { setTimeout(function () { st.q = {}; render(); }, 900); return; }
    b = e.target.closest('[data-pay]');
    if (b) { e.preventDefault(); e.stopImmediatePropagation(); openOS({ method: NAME2M[b.dataset.name] || 'vodafone' }); return; }
    b = e.target.closest('[data-prepay],[data-order]');
    if (b) { e.preventDefault(); e.stopImmediatePropagation(); openOS({ code: b.dataset.code || (b.closest('[data-code]') || {}).dataset && b.closest('[data-code]').dataset.code, method: b.hasAttribute('data-order') ? 'cod' : undefined }); return; }
    b = e.target.closest('[data-bundle]');
    if (b) { e.preventDefault(); e.stopImmediatePropagation(); var cc = b.closest('[data-code]'); openOS({ code: cc && cc.dataset.code, group: b.dataset.g || 'B' }); return; }
    b = e.target.closest('[data-frbun]');
    if (b) { e.preventDefault(); e.stopImmediatePropagation(); openOS({ bundle: true }); return; }
    b = e.target.closest('[data-gift]');
    if (b) { e.preventDefault(); e.stopImmediatePropagation(); openOS({}); }
  }, true);

  /* ------------------------------------------------------------------
     3) عدّادات الجمعة البيضاء (الصفحة الرئيسية + صفحة الجمعة)
     ------------------------------------------------------------------ */
  function parts(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 }; }
  function miniTxt(ms) { var p = parts(ms); return (p.d ? p.d + ' يوم ' : '') + '<bdi dir="ltr">' + pad(p.h) + ':' + pad(p.m) + ':' + pad(p.s) + '</bdi>'; }
  var DAYS_AR = '';
  try { DAYS_AR = new Date(FRI.ts).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', timeZone: 'UTC' }); } catch (e) { }
  function friTick() {
    var now = Date.now(), live = now >= FRI.open && now <= FRI.close, target = live ? FRI.close : FRI.open, ms = target - now;
    var state = live ? ((friCount || BUN) ? 'live' : 'live-empty') : 'wait';
    $$('[data-fri-cd]').forEach(function (el) { el.innerHTML = miniTxt(ms); });
    $$('[data-fri-line]').forEach(function (el) {
      el.textContent = state === 'live' ? 'الجمعة البيضاء شغالة دلوقتي' : state === 'live-empty' ? 'الجمعة البيضاء شغالة النهارده' : 'العروض بتنزل الجمعة ' + DAYS_AR;
    });
    $$('[data-fri-lbl]').forEach(function (el) { el.textContent = live ? 'العروض بتخلص بعد' : 'الباب بيتفتح بعد'; });
    $$('[data-fri-state]').forEach(function (el) { el.dataset.friState = state; });
    var p = parts(ms);
    $$('[data-fri-u]').forEach(function (el) { var v = p[el.dataset.friU], t = el.dataset.friU === 'd' ? String(v) : pad(v); if (el.textContent !== t) { el.textContent = t; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); } });
  }

  /* صفحة الجمعة: كروت العروض الحية */
  function renderFriday() {
    var g = $('#frgrid'); if (!g) return;
    var codes = FRI.live ? Object.keys(FRI.offers).filter(function (c) { return SETS[c] && FRI.offers[c] < SETS[c].p; }) : [];
    g.hidden = !codes.length; var secL = $('#frlive'); if (secL && BUN && !codes.length) secL.hidden = true;
    g.innerHTML = codes.map(function (c) {
      var s = SETS[c], p = +FRI.offers[c], pct = Math.round((s.p - p) * 100 / s.p);
      return '<article class="fc"><a class="fi" href="' + R + (FOLD[SETS[c].g] || 'royal') + '/' + c.toLowerCase() + '.html"><img src="' + s.i + '" alt="' + esc(s.t) + '" loading="lazy"><span class="fcode">' + c + '</span><span class="fpct">خصم ' + pct + '%</span></a>' +
        '<div class="fb"><h3>' + esc(s.t) + '</h3><div class="fp"><strong><bdi dir="ltr">' + f(p) + '</bdi> <small>جنيه</small></strong><s><bdi dir="ltr">' + f(s.p) + '</bdi></s><span class="fsave">وفّر ' + f(s.p - p) + ' جنيه</span></div>' +
        '<button class="btn btn-gold" type="button" data-prepay data-code="' + c + '"><svg class="ico"><use href="#i-card"/></svg>اطلب بسعر الجمعة</button></div></article>';
    }).join('');
  }

  /* ------------------------------------------------------------------
     4) صفحة السفراء: رابط خاص + رسالة جاهزة
     ------------------------------------------------------------------ */
  function initAmb() {
    var inp = $('#ambName'); if (!inp) return;
    var linkEl = $('#ambLink'), prev = $('#ambMsg'), copy = $('#ambCopy'), share = $('#ambShare'), wa = $('#ambWa'), warn = $('#ambWarn'), pm = $('#ambProofMsg'), proof = $('#ambProof');
    function clean(v) { return v.replace(/[^a-zA-Z0-9 _.-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30); }
    function build() {
      var raw = inp.value, hasAr = /[؀-ۿ]/.test(raw), n = clean(raw), slug = n.replace(/ /g, '-');
      if (warn) warn.hidden = !hasAr;
      inp.value = raw.replace(/[^a-zA-Z0-9 _.-]/g, '');
      var url = C.base + (slug ? '?ref=' + encodeURIComponent(slug) : '');
      var msg = 'شوفت أطقم المفارش دي من سو براند؟ شغل شيك وجودة حلوة، وفيه عروض وأطقم وجهين بالصور والأسعار 🌸\n' + url;
      var pmsg = 'السلام عليكم، أنا ' + (n || '(اسمي بالإنجليزي)') + '، وعايز أشتغل مع سو براند كسفير ومسوّق 🌸\n\nرابطي الخاص: ' + url + '\n\nهنشر الرابط على: (اكتب هنا: فيسبوك / إنستجرام / تيك توك / جروبات واتساب)\n\nعايز أعرف العروض والهدايا الخاصة بالسفراء، وهبعتلكم لقطة الشاشة بعد النشر.';
      linkEl.textContent = url; prev.textContent = msg; if (pm) pm.textContent = pmsg;
      wa.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
      if (proof) { proof.classList.toggle('dis', !n); proof.href = 'https://wa.me/20' + ((C.wa || [])[0] || '').replace(/^0/, '') + '?text=' + encodeURIComponent(pmsg); }
      return { url: url, msg: msg, n: n };
    }
    inp.addEventListener('input', build); build();
    copy.addEventListener('click', function () {
      var b = build(), done = function () { copy.textContent = 'تم النسخ ✓'; setTimeout(function () { copy.textContent = 'انسخ الرسالة'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(b.msg).then(done, function () { }); else { var t = document.createElement('textarea'); t.value = b.msg; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (x) { } t.remove(); }
    });
    if (navigator.share) { share.hidden = false; share.addEventListener('click', function () { var b = build(); navigator.share({ title: 'سو براند', text: b.msg }).catch(function () { }); }); }
    if (proof) proof.addEventListener('click', function (e) {
      if (!clean(inp.value)) { e.preventDefault(); inp.focus(); inp.classList.add('shake'); setTimeout(function () { inp.classList.remove('shake'); }, 600); if (warn) { warn.hidden = false; } }
    });
  }
  function NUMS() { return C.wa || []; }


  /* ------------------------------------------------------------------
     5) صور متغيّرة: كروت الأقسام (كل ثانية) + جناحين البار العلوي في الكمبيوتر
     ------------------------------------------------------------------ */
  function groupImgs(g) { return Object.keys(SETS).filter(function (c) { return SETS[c].g === g; }).map(function (c) { return SETS[c].i; }); }
  function cycle(box, list, ms, start, first) {
    if (!box || list.length < 2) return;
    var ims = list.map(function (src, k) {
      if (k === 0 && first) { first.classList.add('rot', 'on'); return first; }
      var im = document.createElement('img'); im.src = src; im.alt = ''; im.decoding = 'async'; im.className = (first ? first.className.replace(/\bon\b/, '') : 'rot') + ' rot'; if (first && first.getAttribute('style')) im.setAttribute('style', first.getAttribute('style'));
      box.appendChild(im); return im;
    });
    var k = start || 0; ims.forEach(function (im, i) { im.classList.toggle('on', i === k); });
    setInterval(function () { ims[k].classList.remove('on'); k = (k + 1) % ims.length; ims[k].classList.add('on'); }, ms);
  }
  function initRotators() {
    var gmap = { 'royal/': 'S', 'flat/': 'F', 'sheets/': 'B' }, n = 0;
    $$('a.ct').forEach(function (a) {
      var g = gmap[(a.getAttribute('href') || '').replace(R, '')], first = $('.cimg', a); if (!g || !first) return;
      var list = groupImgs(g); var i0 = list.indexOf(first.getAttribute('src')); if (i0 > 0) { list = list.slice(i0).concat(list.slice(0, i0)); }
      setTimeout(function () { cycle(a, list, 1000, 0, first); }, 400 + (n++ % 3) * 330);
    });
    $$('[data-rot]').forEach(function (el, n) {
      var list = groupImgs(el.dataset.rot), off = +el.dataset.off || 0; if (list.length < 2) return;
      list = list.slice(off % list.length).concat(list.slice(0, off % list.length));
      var im = document.createElement('img'); im.src = list[0]; im.alt = ''; el.appendChild(im); cycle(el, list, 2200 + n * 400, 0, im);
    });
    var bar = $('#bar'); if (!bar || $('.bs', bar)) return;
    function side(cls, g, href, title, sub) {
      var list = groupImgs(g), a = document.createElement('a'); a.className = 'bs ' + cls; a.href = href;
      a.innerHTML = '<span class="bs-st"></span><span class="bs-t"><b>' + title + '</b><small>' + sub + '</small></span>';
      bar.appendChild(a);
      var st3 = $('.bs-st', a);
      for (var j = 0; j < 3; j++) { (function (j) { var t = document.createElement('span'); t.className = 'bs-th t' + j; st3.appendChild(t); var off = list.slice(j * 2).concat(list.slice(0, j * 2)); var im = document.createElement('img'); im.src = off[0]; im.alt = ''; t.appendChild(im); cycle(t, off, 2400 + j * 350, 0, im); })(j); }
    }
    side('bs-r', 'S', R + 'royal/', 'فخامة بتكمّل بيتك', 'مفارش الفخامة.. تطريز ودانتيل وتفاصيل بتتشاف');
    side('bs-l', 'F', R + 'flat/', 'بساطة بتبهر', 'مفارش الفلات.. شيك وخفيف وعلى مزاجك');
  }
  window.addEventListener('load', initRotators);

  /* ------------------------------------------------------------------ */
  fillBundles();
  /* ------------------------------------------------------------------
     باقة الجمعة البيضاء + فاعلية الجمعة (شريط + زرار عايم + شاشة ترحيب)
     ------------------------------------------------------------------ */
  var STAR = '<svg class="ico" aria-hidden="true"><use href="#i-star"/></svg>';
  var KIND = { S: 'طقم فخامة', F: 'طقم فلات', B: 'ملاية سرير' };
  function shortName(c) { return SETS[c].t.replace(/^ملاية سرير\s*/, '').replace(/\s*-\s*4 قطع$/, ''); }
  function pickCodes() { return BUN ? Object.keys(SETS).filter(function (c) { return SETS[c].g === BUN.pick; }) : []; }
  function pickSheet(c) {
    if (!st.bun || !SETS[c]) return;
    Object.keys(st.q).forEach(function (k) { if (SETS[k] && SETS[k].g === BUN.pick) delete st.q[k]; });
    st.q[c] = 1; st.bun.pick = c; render();
  }
  function bunPanel() {
    var pk = st.bun.pick;
    var fixed = BUN.fixed.map(function (c) {
      var s = SETS[c];
      return '<div class="os-row on"><img src="' + s.i + '" alt="" width="56" height="70"><div class="os-rt"><b><span class="os-code">' + c + '</span><span class="os-off">في الباقة</span></b><span class="os-nm">' + esc(s.t) + '</span></div></div>';
    }).join('');
    var picks = pickCodes().map(function (c) {
      return '<button type="button" class="bp-p' + (pk === c ? ' on' : '') + '" data-os="pick" data-code="' + c + '" aria-pressed="' + (pk === c) + '"><img src="' + SETS[c].i + '" alt="" loading="lazy"><b>' + c + '</b><span>' + esc(shortName(c)) + '</span></button>';
    }).join('');
    return '<div class="bp-hd"><div class="bp-k">' + STAR + 'باقة الجمعة البيضاء · النهارده بس</div><b>3 أطقم بـ <bdi dir="ltr">' + f(BUN.price) + '</bdi> جنيه <s><bdi dir="ltr">' + f(BUN.was) + '</bdi></s></b><span>وفّر ' + f(BUN.was - BUN.price) + ' جنيه</span></div>' +
      '<div class="os-sec"><i>1</i>أطقم الباقة</div><div class="os-list nolimit">' + fixed + '</div>' +
      '<div class="os-sec"><i>2</i>اختار ملاءتك' + (pk ? '' : ' <em class="bp-need">لازم تختار واحدة</em>') + '</div><div class="bp-grid">' + picks + '</div>' +
      '<button type="button" class="bp-x" data-os="exitbun">أو اطلب أطقم تانية بدل الباقة</button>';
  }
  function tileCD() {
    function t(u, l) { return '<div class="t"><b data-fri-u="' + u + '">00</b><span>' + l + '</span></div>'; }
    return '<div class="fb-cd" role="timer" aria-label="الوقت المتبقي على انتهاء العرض"><span class="fb-cl">' + '<svg class="ico" aria-hidden="true"><use href="#i-hourglass"/></svg>العرض بيخلص بعد</span><div class="frcd sm">' + t('d', 'يوم') + '<i>:</i>' + t('h', 'ساعة') + '<i>:</i>' + t('m', 'دقيقة') + '<i>:</i>' + t('s', 'ثانية') + '</div></div>';
  }
  function renderBundle() {
    var els = $$('[data-frbundle]'); if (!els.length) return;
    els.forEach(function (el) {
      if (!BUN) { el.innerHTML = ''; return; }
      var save = BUN.was - BUN.price, picks = pickCodes();
      var fig = BUN.fixed.map(function (c) { var s = SETS[c]; return '<figure><img src="' + s.i + '" alt="' + esc(s.t) + '"><figcaption><b>' + c + '</b>' + (KIND[s.g] || '') + '</figcaption></figure>'; }).join('<i class="plus">+</i>');
      var sheets = '<figure class="fb-sheets">' + picks.map(function (c, i) { return '<img class="' + (i === 0 ? 'on' : '') + '" src="' + SETS[c].i + '" alt="" loading="lazy">'; }).join('') + '<figcaption><b>ملاية</b>من اختيارك</figcaption></figure>';
      el.innerHTML = '<section class="fbun"><div class="fb-tag">' + STAR + 'باقة الجمعة البيضاء · النهارده بس</div>' +
        '<h2 class="fb-h">3 أطقم في أوردر واحد.. بـ <span><bdi dir="ltr">' + f(BUN.price) + '</bdi> جنيه</span> بس!</h2>' +
        '<p class="fb-hook">طقم فخامة + طقم فلات + ملاية من اختيارك، وأوضتك كلها تتغيّر مرة واحدة. الجمعة البيضاء بتيجي مرة في الأسبوع، والسعر ده بيختفي مع آخر النهارده.</p>' +
        '<div class="fb-pics">' + fig + '<i class="plus">+</i>' + sheets + '</div>' +
        '<div class="fb-price"><strong><bdi dir="ltr">' + f(BUN.price) + '</bdi> <small>جنيه</small></strong><s><bdi dir="ltr">' + f(BUN.was) + '</bdi></s><span class="fb-save">وفّر ' + f(save) + ' جنيه</span></div>' +
        '<ul class="fb-list">' + BUN.fixed.map(function (c) { return '<li>' + esc(SETS[c].t) + ' <b>' + c + '</b></li>'; }).join('') + '<li>ملاية سرير 4 قطع من اختيارك (' + picks.length + ' تصميم)</li></ul>' +
        tileCD() +
        '<button class="btn btn-gold fb-go" type="button" data-frbun>' + '<svg class="ico"><use href="#i-gift"/></svg>اختار ملاءتك واطلب الباقة</button>' +
        '<small class="fb-note">ادفع مقدمًا وهتوفّر كمان خصم الدفع المقدم. والسعر بيرجع لأصله بعد آخر النهارده.</small></section>';
    });
    if (!window.__fbCyc) {
      window.__fbCyc = setInterval(function () {
        $$('.fb-sheets').forEach(function (w) { var im = $$('img', w); if (im.length < 2) return; var i = 0; im.forEach(function (x, k) { if (x.classList.contains('on')) i = k; x.classList.remove('on'); }); im[(i + 1) % im.length].classList.add('on'); });
      }, 1700);
    }
  }
  function friFx() {
    if (!(FRI.live && (friCount || BUN))) return;
    if (/\/friday\//.test(location.pathname)) return;
    var txt = BUN ? 'باقة 3 أطقم بـ ' + f(BUN.price) + ' جنيه بدل ' + f(BUN.was) : 'عروض جديدة النهارده';
    var r = document.createElement('a'); r.className = 'frribbon'; r.href = R + 'friday/';
    r.innerHTML = '<span class="fr-st">' + STAR + 'الجمعة البيضاء</span><span class="fr-tx">' + txt + '</span><span class="fr-cd">ينتهي بعد <bdi dir="ltr" data-fri-cd></bdi></span><span class="fr-go">شوف العرض ‹</span>';
    document.body.insertBefore(r, document.body.firstChild);
    var p = document.createElement('a'); p.className = 'frpill'; p.href = R + 'friday/'; p.setAttribute('aria-label', 'الجمعة البيضاء');
    p.innerHTML = STAR + '<span><b>الجمعة البيضاء</b><bdi dir="ltr" data-fri-cd></bdi></span>';
    document.body.appendChild(p);
    var key = 'soo_fs_' + FRI.date, seen = false;
    try { seen = !!localStorage.getItem(key); } catch (e) { }
    if (seen) return;
    setTimeout(function () {
      if (os && !os.hidden) return;
      try { localStorage.setItem(key, '1'); } catch (e) { }
      var cf = '', cols = ['#f7dca0', '#d9ae62', '#ffffff', '#e0452f', '#c8963f'];
      for (var i = 0; i < 26; i++) cf += '<i style="left:' + Math.round(Math.random() * 100) + '%;background:' + cols[i % cols.length] + ';animation-delay:' + (Math.random() * 2.4).toFixed(2) + 's;animation-duration:' + (2.6 + Math.random() * 2).toFixed(2) + 's"></i>';
      var d = document.createElement('div'); d.className = 'frs-bg'; d.id = 'frs';
      d.innerHTML = '<div class="frs" role="dialog" aria-modal="true" aria-label="الجمعة البيضاء"><button class="frs-x" type="button" aria-label="إغلاق">×</button><div class="confetti" aria-hidden="true">' + cf + '</div>' +
        '<div class="frs-art open" data-giftbox></div><div class="frs-k">' + STAR + 'الجمعة البيضاء وصلت</div><h3>عرض النهارده بس.. وبيختفي آخر اليوم</h3>' +
        '<p>' + (BUN ? 'طقم فخامة + طقم فلات + ملاية من اختيارك بـ <b>' + f(BUN.price) + '</b> جنيه بدل ' + f(BUN.was) + '. وفّر <b>' + f(BUN.was - BUN.price) + '</b> جنيه.' : 'عروض جديدة نازلة دلوقتي، والأسعار بترجع لأصلها آخر اليوم.') + '</p>' +
        '<div class="frs-cd">ينتهي بعد <bdi dir="ltr" data-fri-cd></bdi></div><a class="btn btn-gold" href="'+R+'friday/">شوف عرض الجمعة</a><button class="frs-skip" type="button">مش دلوقتي</button></div>';
      document.body.appendChild(d); fillGifts(d); friTick();
      function close() { d.remove(); }
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('.frs-x,.frs-skip')) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }, 1100);
  }


  /* ---------- آراء العملاء (شريط متحرك + شبكة + عارض صور) ---------- */
  var RV = C.reviews || [];
  function rvCard(r, i) { return '<button type="button" class="rv-c" data-rv="' + (i % RV.length) + '" aria-label="افتح الرأي"><img src="' + r.img + '" alt="رأي عميلة في منتجات سو براند" loading="lazy"><span class="rv-s">' + esc(r.src || '') + '</span></button>'; }
  function renderReviews() {
    var els = $$('[data-reviews]'); if (!els.length || !RV.length) return;
    els.forEach(function (el) {
      var all = RV.map(rvCard).join('');
      if (el.dataset.reviews === 'grid') { el.innerHTML = '<div class="rv-grid">' + all + '</div>'; return; }
      el.innerHTML = '<div class="rv-hd"><span class="rv-k">✦ كلام عملائنا</span><h2>ناس جرّبت وحبّت</h2><p>رسايل حقيقية من عملائنا بعد ما استلموا أطقمهم. الأسماء والأرقام مخفية حفاظًا على خصوصيتهم.</p></div>' +
        '<div class="rv-mq"><div class="rv-tr">' + all + '<span class="rv-dup" aria-hidden="true">' + RV.map(function (r, i) { return rvCard(r, i).replace('<button', '<button tabindex="-1"'); }).join('') + '</span></div></div>' +
        '<div class="rv-more"><a class="btn-gold" href="' + R + 'reviews/">شوف كل الآراء</a></div>';
    });
    var lb = null, cur = 0;
    function show(i) { cur = (i + RV.length) % RV.length; $('#rvimg', lb).src = RV[cur].img; $('#rvct', lb).textContent = (cur + 1) + ' / ' + RV.length; }
    function open(i) {
      if (!lb) {
        lb = document.createElement('div'); lb.className = 'rvlb'; lb.hidden = true; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'رأي عميل');
        lb.innerHTML = '<img id="rvimg" alt=""><button class="rb x" type="button" data-a="x" aria-label="إغلاق">×</button><button class="rb nx" type="button" data-a="n" aria-label="التالي">‹</button><button class="rb pv" type="button" data-a="p" aria-label="السابق">›</button><div class="rvct" id="rvct"></div>';
        document.body.appendChild(lb);
        lb.addEventListener('click', function (e) { var a = e.target.closest('[data-a]'); if (a) { if (a.dataset.a === 'x') lb.hidden = true; else show(cur + (a.dataset.a === 'n' ? 1 : -1)); } else if (e.target === lb) lb.hidden = true; });
        document.addEventListener('keydown', function (e) { if (lb.hidden) return; if (e.key === 'Escape') lb.hidden = true; else if (e.key === 'ArrowLeft') show(cur + 1); else if (e.key === 'ArrowRight') show(cur - 1); });
      }
      show(i); lb.hidden = false;
    }
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-rv]'); if (b) open(+b.dataset.rv); });
  }
  /* أرقام الواتساب في الفوتر من الـ config + رابط آراء العملاء */
  function fillFooter() {
    var wa = C.wa || [];
    $$('.f4-wa a').forEach(function (a, i) {
      var n = wa[i]; if (!n) return;
      a.href = a.href.replace(/wa\.me\/\d+/, 'wa.me/20' + n.replace(/^0/, ''));
      var s = $('small', a); if (s) s.textContent = n.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3');
    });
    var ul = $('.f4-links');
    if (ul && !$('a[href$="reviews/"]', ul)) { var li = document.createElement('li'); li.innerHTML = '<a href="' + R + 'reviews/">آراء العملاء</a>'; var pr = ul.lastElementChild; ul.insertBefore(li, pr && /privacy/.test(pr.innerHTML) ? pr : null); }
  }

  /* شريط الحقوق السفلي: طرق الدفع + جمل إنجليزي + اسم شركة التسويق */
  function fillCopyBar() {
    var cp = $('footer > .copy'); if (!cp) return;
    var P = C.pay || {};
    var logos = ['vodafone', 'wepay', 'instapay'].filter(function (k) { return P[k]; }).map(function (k) {
      return '<span class="cb-lg" title="' + esc(P[k].n) + '"><img src="' + P[k].img + '" alt="' + esc(P[k].n) + '" loading="lazy"></span>';
    }).join('');
    cp.innerHTML = '<div class="wrap cbar">' +
      '<div class="cb-mie"><span><img src="'+R+'assets/img/brand/made-in-egypt.png" alt="بكل فخر صنع في مصر" loading="lazy"></span></div>'+
    '<div class="cb-pay"><span class="cb-k">SECURE PAYMENT</span><div class="cb-row">' + logos + '<span class="cb-cod">الدفع عند الاستلام <small>CASH ON DELIVERY</small></span></div></div>' +
      '<div class="cb-line" aria-hidden="true"><i></i><span>✦</span><i></i></div>' +
      '<ul class="cb-en"><li>MADE IN EGYPT</li><li>INSPECT BEFORE YOU PAY</li><li>DELIVERED TO YOUR DOOR · 3–5 DAYS</li><li>ELEGANCE THAT COMPLETES YOUR HOME</li></ul>' +
      '<div class="cb-bot"><span>جميع الحقوق محفوظة | سو براند</span><a href="' + R + 'privacy/">سياسة الخصوصية</a><span class="cb-mk">Marketing by <b>A.M.GROUP</b></span><span><bdi dir="ltr">© 2026 SOO BRAND</bdi></span></div></div>';
  }
  window.SOO = { cfg: C, offers: OFF, friday: FRI, offerMsg: offerMsg, decorate: decorate, openOrder: openOS, fmt: f };
  ensureMarkup();
  loadCart(); injectCart(); updateFab();
  (function () { var el = $('.card.solo[data-code]'); var k = el && el.dataset.code; if (k && SETS[k]) track('ViewContent', { content_ids: [k], content_type: 'product', content_name: SETS[k].t, value: unit(k), currency: 'EGP' }); })();
  fillGifts(document);
  renderFriday();
  initAmb();
  renderReviews();
  fillFooter();
  fillCopyBar();
  renderBundle();
  friFx();
  friTick(); setInterval(friTick, 1000);
  $$('[data-gm]').forEach(function (e) { e.textContent = C.giftMin || 4; });
  $$('[data-gg]').forEach(function (e) { e.textContent = C.giftGroup || 'S'; });
  $$('[data-pp]').forEach(function (e) { e.textContent = ppMaxAll(); });
  $$('[data-pd]').forEach(function (e) { var a = e.dataset.pd.split(':'); e.textContent = rate(a[0], a[1]); });
  /* عدد عروض الجمعة على الأيقونات */
  $$('[data-fri-count]').forEach(function (el) { el.textContent = friCount; el.hidden = !friCount; });
})();
