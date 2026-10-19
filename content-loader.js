/* ===== Content loader — JSON outside the engine, loaded at runtime =====
   Priority: (1) fetch content/*.json  (2) embedded bundle  (3) legacy globals
   All three produce IDENTICAL structures. Verifies counts vs manifest. */
'use strict';
(function () {
  const FILES = ['lessons-l1.json', 'lessons-l2.json', 'variety-l1.json', 'variety-l2.json', 'summaries.json', 'chapters.json', 'lesson-extras.json'];

  function fromBundle() {
    const b = window.__CONTENT_BUNDLE__;
    if (!b) return null;
    return {
      L1: b['lessons-l1'], L2: b['lessons-l2'],
      VAR1: b['variety-l1'], VAR2: b['variety-l2'],
      SUMMARIES: b['summaries'],
      CHAPTERS: b['chapters'].CHAPTERS, CHAPTER_META: b['chapters'].CHAPTER_META,
      CHAPTER_SUMMARIES: b['chapters'].CHAPTER_SUMMARIES,
      EXTRAS: b['lesson-extras'], manifest: b['manifest']
    };
  }

  function fromLegacy() {
    try {
      if (typeof LESSON_11 === 'undefined' || typeof SUMMARIES === 'undefined') return null;
      return {
        L1: [LESSON_11, LESSON_12, LESSON_13, LESSON_14, LESSON_21, LESSON_22, LESSON_23],
        L2: [L2_11, L2_12, L2_13, L2_14, L2_21, L2_22, L2_23],
        VAR1: VARIETY, VAR2: (typeof L2_VARIETY !== 'undefined') ? L2_VARIETY : [],
        SUMMARIES: SUMMARIES,
        CHAPTERS: { ch1: ['l11', 'l12', 'l13', 'l14'], ch2: ['l21', 'l22', 'l23'] },
        CHAPTER_META: {
          ch1: { num: 'الفصل الأول — 1-1..1-4', title: 'امتحان الفصل الأول', icon: '🎓', color: '#a78bfa' },
          ch2: { num: 'الفصل الثاني — 2-1..2-3', title: 'امتحان الفصل الثاني', icon: '🛡️', color: '#22d3ee' }
        },
        CHAPTER_SUMMARIES: (typeof CHAPTER_SUMMARIES !== 'undefined') ? CHAPTER_SUMMARIES : {},
        EXTRAS: (typeof LESSON_EXTRAS !== 'undefined') ? LESSON_EXTRAS : {},
        manifest: null
      };
    } catch (e) { return null; }
  }

  function checkCounts(d) {
    if (!d.manifest || !d.manifest.expected) return { ok: true, skipped: true };
    const e = d.manifest.expected;
    const got = {
      l1Lessons: d.L1.length, l2Lessons: d.L2.length,
      l1Questions: d.L1.reduce((a, L) => a + L.questions.length, 0),
      l2Questions: d.L2.reduce((a, L) => a + L.questions.length, 0),
      varietyL1: d.VAR1.length, varietyL2: d.VAR2.length,
      summaries: Object.keys(d.SUMMARIES).length,
      extras: Object.keys(d.EXTRAS).length
    };
    const bad = Object.keys(e).filter(k => e[k] !== got[k]);
    return { ok: bad.length === 0, bad, expected: e, got };
  }

  async function load() {
    // (1) try JSON over http(s)
    try {
      const base = (document.currentScript && document.currentScript.src)
        ? document.currentScript.src.slice(0, document.currentScript.src.lastIndexOf('/') + 1)
        : '';
      const get = f => fetch(base + 'content/' + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
      const [l1, l2, v1, v2, sum, ch, ex] = await Promise.all(FILES.map(get));
      let manifest = null;
      try { manifest = await fetch(base + 'content/manifest.json').then(r => r.json()); } catch (e) {}
      const d = { L1: l1, L2: l2, VAR1: v1, VAR2: v2, SUMMARIES: sum, CHAPTERS: ch.CHAPTERS, CHAPTER_META: ch.CHAPTER_META, CHAPTER_SUMMARIES: ch.CHAPTER_SUMMARIES, EXTRAS: ex, manifest, source: 'json' };
      const c = checkCounts(d);
      if (!c.ok) throw new Error('content count mismatch: ' + JSON.stringify(c));
      return d;
    } catch (e) { /* fall through to bundle/legacy (file:// has no fetch) */ }
    // (2) embedded bundle (generated FROM the same JSON — identical)
    const b = fromBundle();
    if (b) {
      b.source = 'bundle';
      const c = checkCounts(b);
      if (!c.ok) throw new Error('bundle count mismatch: ' + JSON.stringify(c));
      return b;
    }
    // (3) legacy globals (during migration only)
    const g = fromLegacy();
    if (g) { g.source = 'legacy'; return g; }
    throw new Error('No content source available (json/bundle/legacy)');
  }

  window.ContentLoader = { load };
})();
