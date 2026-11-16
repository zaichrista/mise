const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../recipe.js');

const ing = (qty, unit, extra = {}) => ({ id: 'x', name: 'X', qty, unit, ...extra });
const show = (i, base, s) => R.displayIngredient(i, base, s).qty;

test('same servings leaves quantities unchanged', () => {
  assert.equal(show(ing(200, 'g'), 2, 2), '200 g');
  assert.equal(show(ing(1, 'tbsp'), 2, 2), '1 tbsp');
});

test('metric scales and converts up and down', () => {
  assert.equal(show(ing(200, 'g'), 2, 6), '600 g');
  assert.equal(show(ing(200, 'g'), 2, 12), '1.2 kg');
  assert.equal(show(ing(1, 'kg'), 4, 1), '250 g');
  assert.equal(show(ing(150, 'ml'), 2, 8), '600 ml');
  assert.equal(show(ing(500, 'ml'), 2, 6), '1.5 l');
});

test('metric rounding is tidy', () => {
  assert.equal(show(ing(40, 'g'), 2, 3), '60 g');
  assert.equal(show(ing(40, 'g'), 2, 1), '20 g');
  assert.equal(show(ing(125, 'g'), 4, 5), '155 g'); // 156.25 -> nearest 5
});

test('spoons convert tsp <-> tbsp and use fractions', () => {
  assert.equal(show(ing(1, 'tsp'), 2, 6), '1 tbsp');
  assert.equal(show(ing(1, 'tbsp'), 2, 1), '1½ tsp');
  assert.equal(show(ing(1, 'tbsp'), 2, 3), '1½ tbsp');
  assert.equal(show(ing(0.5, 'tsp'), 2, 1), '¼ tsp');
  assert.equal(show(ing(0.5, 'tsp'), 4, 1), '1 pinch'); // 0.125 tsp is too small to measure
});

test('cups use quarters and fall back to tbsp when tiny', () => {
  assert.equal(show(ing(1, 'cup'), 4, 6), '1½ cups');
  assert.equal(show(ing(0.25, 'cup'), 4, 1), '1 tbsp');
});

test('countable items halve, eggs stay whole, singular/plural names', () => {
  assert.equal(show(ing(1, ''), 2, 3), '1½');
  assert.equal(show(ing(2, '', { whole: true }), 4, 3), '2'); // 1.5 -> rounds to 2
  assert.equal(show(ing(2, '', { whole: true }), 4, 1), '1'); // never below 1
  const lemon = { id: 'l', name: 'Lemon', plural: 'Lemons', qty: 1, unit: '' };
  assert.equal(R.displayIngredient(lemon, 2, 2).name, 'Lemon');
  assert.equal(R.displayIngredient(lemon, 2, 6).name, 'Lemons');
});

test('counting words pluralise', () => {
  const herbs = ing(1, 'handful');
  assert.equal(show(herbs, 2, 2), '1 handful');
  assert.equal(show(herbs, 2, 6), '3 handfuls');
  assert.equal(show(ing(1, 'pinch'), 2, 6), '3 pinches');
});

test('amount-less ingredients keep their own text', () => {
  const salt = ing(null, '', { qtyText: 'to taste' });
  assert.equal(show(salt, 2, 10), 'to taste');
});

test('servings are clamped and sanitised', () => {
  assert.equal(R.clampServings(0), 1);
  assert.equal(R.clampServings(99), R.MAX_SERVINGS);
  assert.equal(R.clampServings('abc'), 1);
  assert.equal(R.clampServings(3.4), 3);
});

test('sample recipe scales as a whole and per step', () => {
  const list = R.scaleRecipe(R.sample, 4);
  assert.equal(list.find((i) => i.id === 'pasta').qty, '400 g');
  assert.equal(list.find((i) => i.id === 'lemon').name, 'Lemons');
  const step = R.sample.steps.find((s) => s.id === 'parmesan');
  assert.deepEqual(R.stepIngredients(R.sample, step, 4).map((i) => i.qty), ['80 g']);
});

test('every step references real ingredients', () => {
  const ids = new Set(R.sample.ingredients.map((i) => i.id));
  for (const s of R.sample.steps) for (const id of s.ingredients) assert.ok(ids.has(id), `${s.id} -> ${id}`);
});
