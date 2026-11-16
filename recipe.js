/* Recipe data model and portion scaling. Pure functions, no DOM, so it runs in the
   browser (as window.Recipe) and in Node (require) for tests.

   Recipe shape:
   {
     id, title, baseServings, time,
     photo?: { source: 'upload', key } | { source: 'internet', url },
     ingredients: [{ id, name, plural?, qty: number|null, unit: string, whole?, note?, qtyText? }],
     steps: [{ id, title, text, ingredients: [ingredientId], timer?: { label, minutes } }]
   }
   unit: 'g' 'kg' 'ml' 'l' 'tsp' 'tbsp' 'cup', or '' for countable items, or a counting
   word such as 'handful' or 'clove'. qty null means "no amount" (e.g. salt, to taste). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Recipe = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MIN_SERVINGS = 1, MAX_SERVINGS = 24;

  const roundTo = (v, step) => Math.round(v / step) * step;
  // Metric amounts: coarser steps as quantities grow, so 187 g reads as 190 g, not 187.4 g.
  const roundMetric = (v) => Math.max(0.5, roundTo(v, v < 10 ? 0.5 : v < 50 ? 1 : v < 200 ? 5 : 10));
  const clean = (v) => Math.round(v * 1000) / 1000;

  function clampServings(n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n)) return MIN_SERVINGS;
    return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, n));
  }

  // Scales one ingredient. Returns { qty, unit } with units tidied (1200 g -> 1.2 kg, 3 tsp -> 1 tbsp).
  function scaleIngredient(ing, baseServings, servings) {
    if (ing.qty == null) return { qty: null, unit: ing.unit || '' };
    const raw = ing.qty * servings / baseServings;
    switch (ing.unit) {
      case 'g':
        return raw >= 1000 ? { qty: clean(roundTo(raw / 1000, 0.05)), unit: 'kg' } : { qty: roundMetric(raw), unit: 'g' };
      case 'kg':
        return raw < 1 ? { qty: roundMetric(raw * 1000), unit: 'g' } : { qty: clean(roundTo(raw, 0.05)), unit: 'kg' };
      case 'ml':
        return raw >= 1000 ? { qty: clean(roundTo(raw / 1000, 0.05)), unit: 'l' } : { qty: roundMetric(raw), unit: 'ml' };
      case 'l':
        return raw < 1 ? { qty: roundMetric(raw * 1000), unit: 'ml' } : { qty: clean(roundTo(raw, 0.05)), unit: 'l' };
      case 'tsp':
      case 'tbsp': {
        const tsp = ing.unit === 'tbsp' ? raw * 3 : raw;
        if (tsp < 0.2) return { qty: 1, unit: 'pinch' };
        if (tsp < 2.75) return { qty: roundTo(tsp, 0.25), unit: 'tsp' };
        const tbsp = Math.max(1, roundTo(tsp / 3, 0.5));
        return tbsp >= 16 ? { qty: roundTo(tbsp / 16, 0.25), unit: 'cup' } : { qty: tbsp, unit: 'tbsp' };
      }
      case 'oz':
      case 'lb':
        return { qty: Math.max(0.25, roundTo(raw, 0.25)), unit: ing.unit };
      case 'cup':
        return raw < 0.25 ? { qty: Math.max(1, roundTo(raw * 16, 0.5)), unit: 'tbsp' } : { qty: roundTo(raw, 0.25), unit: 'cup' };
      default: {
        // Countable: eggs stay whole, everything else may be halved.
        const step = ing.whole ? 1 : 0.5;
        return { qty: Math.max(step, roundTo(raw, step)), unit: ing.unit || '' };
      }
    }
  }

  const FRACTIONS = { 0.125: '⅛', 0.25: '¼', 0.333: '⅓', 0.375: '⅜', 0.5: '½', 0.625: '⅝', 0.667: '⅔', 0.75: '¾', 0.875: '⅞' };
  const METRIC = new Set(['g', 'kg', 'ml', 'l']);

  function formatNumber(qty, unit) {
    if (METRIC.has(unit)) return String(clean(qty));
    const whole = Math.floor(qty + 1e-9);
    const frac = qty - whole;
    if (frac < 0.01) return String(whole);
    const sym = FRACTIONS[Object.keys(FRACTIONS).find((k) => Math.abs(k - frac) < 0.01)];
    if (sym) return (whole ? whole : '') + sym;
    return String(clean(qty));
  }

  function pluralUnit(unit, qty) {
    if (qty <= 1 || !unit) return unit;
    if (/(ch|sh|s|x)$/.test(unit)) return unit + 'es';
    return unit + 's';
  }

  // "300 g", "1½ tbsp", "2 handfuls", "2" (countable), or the ingredient's own text ("to taste").
  function formatQty(scaled, ing = {}) {
    if (scaled.qty == null) return ing.qtyText || '';
    const n = formatNumber(scaled.qty, scaled.unit);
    const u = METRIC.has(scaled.unit) || ['tsp', 'tbsp', 'oz', 'lb'].includes(scaled.unit) ? scaled.unit : pluralUnit(scaled.unit, scaled.qty);
    return u ? `${n}${METRIC.has(scaled.unit) ? ' ' : ' '}${u}` : n;
  }

  // Everything the UI needs for one ingredient at a given serving size.
  function displayIngredient(ing, baseServings, servings) {
    const scaled = scaleIngredient(ing, baseServings, servings);
    const plural = scaled.qty != null && scaled.qty > 1 && !scaled.unit && ing.plural;
    return { id: ing.id, name: plural ? ing.plural : ing.name, qty: formatQty(scaled, ing), note: ing.note || '' };
  }

  function scaleRecipe(recipe, servings) {
    const s = clampServings(servings);
    return recipe.ingredients.map((i) => displayIngredient(i, recipe.baseServings, s));
  }

  // Ingredients used by a single step, scaled. Unknown ids are skipped rather than throwing.
  function stepIngredients(recipe, step, servings) {
    const s = clampServings(servings);
    return step.ingredients
      .map((id) => recipe.ingredients.find((i) => i.id === id))
      .filter(Boolean)
      .map((i) => displayIngredient(i, recipe.baseServings, s));
  }

  // ---------- Writing and importing: text -> structured recipe ----------
  const VULGAR = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅕': 0.2 };
  const VF = '[¼½¾⅓⅔⅛⅜⅝⅞⅕]';
  const UNIT_ALIASES = {
    g: 'g', gr: 'g', gram: 'g', grams: 'g', kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
    ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
    l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
    tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
    tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
    cup: 'cup', cups: 'cup', oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb'
  };
  const COUNT_WORDS = new Set(['clove', 'pinch', 'handful', 'bunch', 'can', 'tin', 'slice', 'sprig', 'stalk', 'stick', 'piece', 'head', 'dash', 'knob', 'sheet', 'packet', 'jar', 'fillet']);

  // Reads a number at the start of s: "2", "1½", "1 1/2", "3/4", "0.5", optionally a range "2-3".
  function readQty(s) {
    const one = (str) => {
      let m = new RegExp(`^\\s*(\\d+)?\\s*(${VF})`).exec(str);
      if (m) return { v: Number(m[1] || 0) + VULGAR[m[2]], rest: str.slice(m[0].length) };
      m = /^\s*(\d+)\s+(\d+)\/(\d+)/.exec(str);
      if (m && Number(m[3])) return { v: Number(m[1]) + Number(m[2]) / Number(m[3]), rest: str.slice(m[0].length) };
      m = /^\s*(\d+)\/(\d+)/.exec(str);
      if (m && Number(m[2])) return { v: Number(m[1]) / Number(m[2]), rest: str.slice(m[0].length) };
      m = /^\s*(\d+(?:\.\d+)?)/.exec(str);
      return m ? { v: Number(m[1]), rest: str.slice(m[0].length) } : null;
    };
    const a = one(s);
    if (!a) return null;
    const dash = /^\s*(?:-|–|—|to)\s*(?=\d|[¼½¾⅓⅔⅛⅜⅝⅞⅕])/i.exec(a.rest);
    const b = dash && one(a.rest.slice(dash[0].length));
    return b ? { qty: a.v, hi: b.v, rest: b.rest } : { qty: a.v, hi: null, rest: a.rest };
  }

  const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  function singularWord(w) {
    if (/ies$/i.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
    if (/(oes|ches|shes|xes|sses)$/i.test(w)) return w.slice(0, -2);
    if (/s$/i.test(w) && !/(ss|us|is)$/i.test(w) && w.length > 3) return w.slice(0, -1);
    return w;
  }
  function pluralWord(w) {
    if (/[^aeiou]y$/i.test(w)) return w.slice(0, -1) + 'ies';
    if (/(s|x|ch|sh)$/i.test(w)) return w + 'es';
    if (/[^aeiou]o$/i.test(w) && /(tomato|potato)$/i.test(w)) return w + 'es';
    return w + 's';
  }
  const mapLast = (name, fn) => name.replace(/(\S+)$/, (w) => fn(w));

  // "2 1/2 cups flour, sifted" -> { id, name, qty, unit, note, ... }. Never throws; unknown lines become amount-less ingredients.
  function parseIngredient(line, index = 0) {
    let rest = String(line).replace(/\s+/g, ' ').trim();
    const notes = [];
    let qty = null, unit = '';
    const q = readQty(rest);
    if (q) {
      qty = q.qty; rest = q.rest.trim();
      if (q.hi != null) notes.push(`${fmtPlain(q.qty)}–${fmtPlain(q.hi)} as written`);
    } else {
      const art = /^(an?)\s+(?=\S)/i.exec(rest);
      const next = art && /^(\S+)/.exec(rest.slice(art[0].length));
      if (next && (COUNT_WORDS.has(singularWord(next[1].toLowerCase())) || UNIT_ALIASES[next[1].toLowerCase()])) { qty = 1; rest = rest.slice(art[0].length); }
    }
    if (qty != null) {
      const paren = /^\(([^)]*)\)\s*/.exec(rest);
      if (paren) { notes.push(paren[1].trim()); rest = rest.slice(paren[0].length); }
      const w = /^([A-Za-z]+)\.?\s*/.exec(rest);
      if (w) {
        const lower = w[1].toLowerCase(), sing = singularWord(lower);
        if (UNIT_ALIASES[lower]) { unit = UNIT_ALIASES[lower]; rest = rest.slice(w[0].length); }
        else if (COUNT_WORDS.has(lower) || COUNT_WORDS.has(sing)) { unit = COUNT_WORDS.has(lower) ? lower : sing; rest = rest.slice(w[0].length); }
      }
      rest = rest.replace(/^of\s+/i, '');
    }
    // Parentheses and anything after the first comma are notes.
    rest = rest.replace(/\(([^)]*)\)/g, (_, n) => { notes.push(n.trim()); return ''; });
    let [name, ...after] = rest.split(',');
    if (after.length) notes.push(after.join(',').trim());
    name = name.replace(/\s+/g, ' ').trim();
    let qtyText = '';
    const tasteRe = /\b(?:,?\s*)to taste\b/i;
    if (tasteRe.test(name) || notes.some((n) => tasteRe.test(n))) {
      qtyText = 'to taste';
      name = name.replace(tasteRe, '').trim();
      for (let i = notes.length - 1; i >= 0; i--) { notes[i] = notes[i].replace(tasteRe, '').trim(); if (!notes[i]) notes.splice(i, 1); }
    }
    if (!name) name = String(line).trim();
    const ing = { id: `i${index + 1}`, name: capital(name), qty, unit, note: notes.filter(Boolean).join(', ') };
    if (qtyText) ing.qtyText = qtyText;
    if (/\begg/i.test(name)) ing.whole = true;
    if (qty != null && !unit) {
      // Countables ("2 eggs"): keep the singular and plural forms so the name follows the amount.
      const sing = mapLast(ing.name, singularWord), plur = mapLast(sing, pluralWord);
      ing.name = sing; ing.plural = plur;
    }
    return ing;
  }
  const fmtPlain = (n) => formatNumber(n, '');

  // The inverse of parseIngredient, for editing.
  function ingredientToLine(ing) {
    const tail = ing.note ? `, ${ing.note}` : '';
    if (ing.qty == null) return `${ing.name}${ing.qtyText ? `, ${ing.qtyText}` : ''}${tail}`;
    const n = formatNumber(ing.qty, ing.unit);
    const u = ing.unit ? (COUNT_WORDS.has(ing.unit) ? `${pluralUnit(ing.unit, ing.qty)} of ` : `${ing.unit} `) : '';
    return `${n} ${u}${ing.name}${tail}`.replace(/\s+/g, ' ');
  }

  // "simmer for 10-15 minutes" -> 10. Returns 0 when there is no single clear duration.
  function detectTimer(text) {
    const t = String(text);
    const found = [];
    const hm = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b(?:\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?|m)\b)?/gi;
    let m;
    while ((m = hm.exec(t))) found.push(Math.round(Number(m[1]) * 60 + Number(m[2] || 0)));
    if (!found.length) {
      const mm = /(\d+)(?:\s*(?:-|–|to)\s*\d+)?\s*(?:minutes?|mins?)\b/gi;
      while ((m = mm.exec(t))) found.push(Number(m[1]));
    }
    return found.length === 1 && found[0] > 0 && found[0] <= 600 ? found[0] : 0;
  }

  // Which ingredients does a step mention? Matches the whole name or its last word ("Double cream" ~ "cream").
  const STOP = new Set(['fresh', 'ground', 'large', 'small', 'medium', 'chopped', 'extra', 'virgin', 'plain', 'whole', 'the', 'and', 'for', 'dried', 'frozen', 'sliced']);
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function mentions(text, name) {
    const words = String(name).toLowerCase().split(/[^a-zà-ÿ]+/).filter((w) => w.length > 2 && !STOP.has(w));
    if (!words.length) return false;
    const stems = [words.join(' '), words[words.length - 1]].map((w) => singularWord(w));
    return stems.some((s) => new RegExp(`\\b${reEsc(s)}(?:s|es|ed)?\\b`, 'i').test(text));
  }
  function linkIngredients(ingredients, text) {
    return ingredients.filter((i) => mentions(text, i.name)).map((i) => i.id);
  }

  // A draft is the editable form: plain text lines and steps with optional timer minutes.
  function draftFromRecipe(r) {
    return {
      id: r.id, title: r.title, baseServings: r.baseServings, time: r.time || '', source: r.source || '', photo: normalizePhoto(r.photo),
      ingredientsText: r.ingredients.map(ingredientToLine).join('\n'),
      steps: r.steps.map((s) => ({ text: s.title ? `${s.title} ${s.text}`.trim() : s.text, minutes: s.timer ? s.timer.minutes : 0 }))
    };
  }
  function draftFromImport(data) {
    return {
      id: null, title: data.title || '', baseServings: clampServings(data.servings || 4), time: data.time || '', source: data.source || '', photo: normalizePhoto({ source: 'internet', url: data.image }),
      ingredientsText: (data.ingredients || []).join('\n'),
      steps: (data.steps || []).map((text) => ({ text, minutes: detectTimer(text) }))
    };
  }
  const blankDraft = () => ({ id: null, title: '', baseServings: 4, time: '', source: '', ingredientsText: '', steps: [{ text: '', minutes: 0 }] });

  function validateDraft(d) {
    if (!String(d.title).trim()) return 'Give the recipe a title.';
    if (!String(d.ingredientsText).split('\n').some((l) => l.trim())) return 'Add at least one ingredient.';
    if (!d.steps.some((s) => String(s.text).trim())) return 'Add at least one step.';
    return '';
  }
  function normalizePhoto(photo) {
    if (photo?.source === 'upload' && typeof photo.key === 'string' && photo.key) return { source: 'upload', key: photo.key };
    if (photo?.source === 'internet' && typeof photo.url === 'string') {
      try { const url = new URL(photo.url); if (/^https?:$/.test(url.protocol)) return { source: 'internet', url: url.href }; } catch { /* No usable image. */ }
    }
    return null;
  }
  const needsPhoto = (r) => normalizePhoto(r.photo)?.source !== 'upload';
  function buildRecipe(d, id) {
    const ingredients = String(d.ingredientsText).split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => parseIngredient(l, i));
    const steps = d.steps.filter((s) => String(s.text).trim()).map((s, i) => {
      const text = String(s.text).trim().replace(/\s+/g, ' ');
      const mins = Math.round(Number(s.minutes) || 0);
      const step = { id: `s${i + 1}`, text, ingredients: linkIngredients(ingredients, text) };
      if (mins > 0) step.timer = { label: '', minutes: Math.min(mins, 600) };
      return step;
    });
    const r = { id: id || d.id || `r-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, title: String(d.title).trim(), baseServings: clampServings(d.baseServings), time: String(d.time || '').trim(), ingredients, steps };
    if (d.source) r.source = d.source;
    const photo = normalizePhoto(d.photo);
    if (photo) r.photo = photo;
    return r;
  }

  const sample = {
    id: 'lemon-herb-pasta',
    title: 'Lemon & herb pasta',
    baseServings: 2,
    time: 'About 25 min',
    ingredients: [
      { id: 'pasta', name: 'Pasta', qty: 200, unit: 'g' },
      { id: 'lemon', name: 'Lemon', plural: 'Lemons', qty: 1, unit: '', note: 'zest and juice' },
      { id: 'cream', name: 'Double cream', qty: 150, unit: 'ml' },
      { id: 'oil', name: 'Olive oil', qty: 1, unit: 'tbsp' },
      { id: 'herbs', name: 'Fresh herbs', qty: 1, unit: 'handful' },
      { id: 'parmesan', name: 'Parmesan', qty: 40, unit: 'g' },
      { id: 'salt', name: 'Salt', qty: null, unit: '', qtyText: 'to taste' }
    ],
    steps: [
      { id: 'lemon', title: 'Zest and juice the lemon.', text: 'Zest the lemon finely, then squeeze out the juice.', ingredients: ['lemon'] },
      { id: 'sauce', title: 'Start the sauce.', text: 'Warm the oil, add the cream and lemon juice, and simmer gently.', ingredients: ['oil', 'cream', 'lemon'], timer: { label: 'Sauce', minutes: 8 } },
      { id: 'parmesan', title: 'Grate the parmesan.', text: 'Finely grate the parmesan. Keep it aside for serving.', ingredients: ['parmesan'] },
      { id: 'herbs', title: 'Chop the herbs.', text: 'Roughly chop the herbs. Keep them aside for serving.', ingredients: ['herbs'] },
      { id: 'check', title: 'Check the sauce.', text: 'It should be smooth and lightly thickened, coating the back of a spoon.', ingredients: [] },
      { id: 'pasta', title: 'Cook the pasta.', text: 'Boil in well-salted water until just tender, then drain, keeping a cup of the water.', ingredients: ['pasta', 'salt'], timer: { label: 'Pasta', minutes: 10 } },
      { id: 'combine', title: 'Combine.', text: 'Toss the pasta through the sauce with a splash of pasta water and the lemon zest.', ingredients: [] },
      { id: 'serve', title: 'Serve.', text: 'Divide between bowls and finish with the herbs and parmesan.', ingredients: ['herbs', 'parmesan'] }
    ]
  };

  return { MIN_SERVINGS, MAX_SERVINGS, clampServings, scaleIngredient, formatQty, displayIngredient, scaleRecipe, stepIngredients, sample, normalizePhoto, needsPhoto,
    parseIngredient, ingredientToLine, detectTimer, linkIngredients, draftFromRecipe, draftFromImport, blankDraft, validateDraft, buildRecipe };
});
