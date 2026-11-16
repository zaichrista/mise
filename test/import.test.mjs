import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRecipe, isPublicAddress, parseTarget, importFromUrl, decodeEntities } from '../import-recipe.mjs';

const page = (json) => `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`;

test('extracts a Recipe from JSON-LD, including @graph, HowToSection and ISO times', () => {
  const html = page(JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: 'Site' },
      {
        '@type': ['Recipe'], name: 'Tomato &amp; Basil Soup', recipeYield: ['4', '4 servings'], totalTime: 'PT1H10M',
        recipeIngredient: ['2 tbsp olive oil', '1 (14 oz) can tomatoes', '&frac12; tsp salt'],
        recipeInstructions: [
          { '@type': 'HowToSection', name: 'Soup', itemListElement: [{ '@type': 'HowToStep', text: 'Warm the oil.' }, { '@type': 'HowToStep', text: 'Add the tomatoes &amp; simmer 15 minutes.' }] },
          'Blend until smooth.'
        ]
      }
    ]
  }));
  const r = extractRecipe(html, 'https://example.com/soup');
  assert.equal(r.title, 'Tomato & Basil Soup');
  assert.equal(r.servings, 4);
  assert.equal(r.time, '1 h 10 min');
  assert.deepEqual(r.ingredients, ['2 tbsp olive oil', '1 (14 oz) can tomatoes', '½ tsp salt']);
  assert.deepEqual(r.steps, ['Warm the oil.', 'Add the tomatoes & simmer 15 minutes.', 'Blend until smooth.']);
  assert.equal(r.source, 'https://example.com/soup');
});

test('handles instructions as a single newline-separated string and bad JSON blocks', () => {
  const html = '<script type="application/ld+json">{ broken</script>' + page(JSON.stringify({ '@type': 'Recipe', name: 'Toast', recipeIngredient: ['bread'], recipeInstructions: 'Toast it.\nButter it.' }));
  const r = extractRecipe(html);
  assert.deepEqual(r.steps, ['Toast it.', 'Butter it.']);
  assert.equal(r.servings, 4);
});

test('returns null when there is no recipe', () => {
  assert.equal(extractRecipe('<html>nothing</html>'), null);
  assert.equal(extractRecipe(page(JSON.stringify({ '@type': 'Article', name: 'x' }))), null);
  assert.equal(extractRecipe(page(JSON.stringify({ '@type': 'Recipe', name: 'Empty' }))), null);
});

test('decodes entities', () => {
  assert.equal(decodeEntities('Mac &amp; cheese &#39;n&#x27; more &nbsp;x'), "Mac & cheese 'n' more  x");
});

test('refuses internal addresses and odd schemes', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.20.0.1', '169.254.169.254', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', '0.0.0.0']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111']) assert.equal(isPublicAddress(ip), true, ip);
  assert.throws(() => parseTarget('file:///etc/passwd'));
  assert.throws(() => parseTarget('ftp://example.com/x'));
  assert.throws(() => parseTarget('http://user:pw@example.com/'));
  assert.throws(() => parseTarget('http://127.0.0.1:5173/'));
  assert.throws(() => parseTarget('http://[::1]/'));
  assert.throws(() => parseTarget('not a url'));
  await assert.rejects(importFromUrl('http://localhost/'), /not allowed|reach/i);
});
