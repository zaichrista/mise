const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../recipe.js');

const p = (line) => { const i = R.parseIngredient(line); return [i.qty, i.unit, i.name, i.note]; };

test('parses quantity, unit and name', () => {
  assert.deepEqual(p('200 g pasta'), [200, 'g', 'Pasta', '']);
  assert.deepEqual(p('200g pasta'), [200, 'g', 'Pasta', '']);
  assert.deepEqual(p('1 tablespoon olive oil'), [1, 'tbsp', 'Olive oil', '']);
  assert.deepEqual(p('2 cups all-purpose flour, sifted'), [2, 'cup', 'All-purpose flour', 'sifted']);
  assert.deepEqual(p('1.5 kg potatoes'), [1.5, 'kg', 'Potatoes', '']);
});

test('parses fractions, mixed numbers and vulgar fractions', () => {
  assert.deepEqual(p('½ tsp salt'), [0.5, 'tsp', 'Salt', '']);
  assert.deepEqual(p('1½ cups milk'), [1.5, 'cup', 'Milk', '']);
  assert.deepEqual(p('1 1/2 cups milk'), [1.5, 'cup', 'Milk', '']);
  assert.deepEqual(p('3/4 cup sugar'), [0.75, 'cup', 'Sugar', '']);
});

test('countables keep singular and plural names', () => {
  const eggs = R.parseIngredient('2 eggs');
  assert.equal(eggs.name, 'Egg'); assert.equal(eggs.plural, 'Eggs'); assert.equal(eggs.whole, true);
  const lemon = R.parseIngredient('1 lemon, zest and juice');
  assert.equal(lemon.name, 'Lemon'); assert.equal(lemon.plural, 'Lemons'); assert.equal(lemon.note, 'zest and juice');
  assert.equal(R.parseIngredient('3 tomatoes').name, 'Tomato');
  assert.equal(R.parseIngredient('2 red onions').plural, 'Red onions');
  assert.equal(R.parseIngredient('1 asparagus').name, 'Asparagus');
});

test('counting words and "of"', () => {
  assert.deepEqual(p('2 cloves garlic, crushed'), [2, 'clove', 'Garlic', 'crushed']);
  assert.deepEqual(p('1 handful of fresh herbs'), [1, 'handful', 'Fresh herbs', '']);
  assert.deepEqual(p('a pinch of salt'), [1, 'pinch', 'Salt', '']);
  assert.deepEqual(p('1 (14 oz) can chopped tomatoes'), [1, 'can', 'Chopped tomatoes', '14 oz']);
});

test('ranges use the lower amount and say so', () => {
  const i = R.parseIngredient('2-3 tbsp honey');
  assert.equal(i.qty, 2); assert.equal(i.unit, 'tbsp'); assert.match(i.note, /2–3 as written/);
});

test('amount-less lines and "to taste"', () => {
  const salt = R.parseIngredient('Salt and pepper, to taste');
  assert.equal(salt.qty, null); assert.equal(salt.qtyText, 'to taste'); assert.equal(salt.name, 'Salt and pepper');
  assert.equal(R.parseIngredient('fresh basil').qty, null);
  assert.equal(R.parseIngredient('').name, '');
});

test('round trip: line -> ingredient -> line', () => {
  for (const line of ['200 g Pasta', '1½ tbsp Olive oil', '2 cloves of Garlic, crushed', 'Salt, to taste', '1 handful of Fresh herbs']) {
    assert.equal(R.ingredientToLine(R.parseIngredient(line)), line);
  }
});

test('oz and lb scale in quarters without pluralising', () => {
  const i = R.parseIngredient('8 oz cheddar');
  assert.equal(R.displayIngredient(i, 2, 3).qty, '12 oz');
  assert.equal(R.displayIngredient(R.parseIngredient('1 lb beef'), 4, 2).qty, '½ lb');
});

test('detects a single clear timer', () => {
  assert.equal(R.detectTimer('Simmer for 10 minutes.'), 10);
  assert.equal(R.detectTimer('Bake 20-25 mins until golden'), 20);
  assert.equal(R.detectTimer('Roast for 1 hour 15 minutes'), 75);
  assert.equal(R.detectTimer('Chill for 2 hours.'), 120);
  assert.equal(R.detectTimer('Cook 5 minutes, then rest 10 minutes'), 0, 'ambiguous');
  assert.equal(R.detectTimer('Stir well and serve.'), 0);
  assert.equal(R.detectTimer('Preheat the oven to 200C'), 0);
});

test('links ingredients a step mentions', () => {
  const ings = ['200 g pasta', '150 ml double cream', '1 tbsp olive oil', '1 lemon', 'Salt, to taste'].map((l, i) => R.parseIngredient(l, i));
  const ids = (t) => R.linkIngredients(ings, t).join(',');
  assert.equal(ids('Warm the oil, add the cream and lemon juice.'), 'i2,i3,i4');
  assert.equal(ids('Boil the pasta in salted water.'), 'i1,i5');
  assert.equal(ids('Serve.'), '');
});

test('draft validation and building', () => {
  const d = R.blankDraft();
  assert.match(R.validateDraft(d), /title/);
  d.title = 'Toast'; assert.match(R.validateDraft(d), /ingredient/);
  d.ingredientsText = '2 slices bread\nbutter'; assert.match(R.validateDraft(d), /step/);
  d.steps = [{ text: 'Toast the bread for 3 minutes.', minutes: 3 }, { text: '   ', minutes: 0 }, { text: 'Butter it.', minutes: 0 }];
  assert.equal(R.validateDraft(d), '');
  const r = R.buildRecipe(d);
  assert.equal(r.steps.length, 2);
  assert.equal(r.steps[0].timer.minutes, 3);
  assert.equal(r.steps[1].timer, undefined);
  assert.deepEqual(r.steps[0].ingredients, ['i1']);
  assert.deepEqual(r.steps[1].ingredients, ['i2']);
  assert.ok(r.id);
});

test('recipe -> draft -> recipe keeps ingredients and timers', () => {
  const again = R.buildRecipe(R.draftFromRecipe(R.sample), R.sample.id);
  assert.equal(again.ingredients.length, R.sample.ingredients.length);
  assert.equal(R.scaleRecipe(again, 4).find((i) => i.name.startsWith('Pasta')).qty, '400 g');
  assert.equal(again.steps.find((s) => s.timer && s.timer.minutes === 8) !== undefined, true);
});
