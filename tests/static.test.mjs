import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const pages = ['index.html', 'menu.html', '404.html'];

test('the deployable artifact contains only public frontend files', async () => {
  assert.deepEqual((await readdir(output)).sort(), [
    '404.html', 'coffee.png', 'config.js', 'donut.png', 'donut.mp4', 'hero.js', 'index.html',
    'logo.png', 'menu.html', 'menu.js', 'snacki.png', 'styles.css'
  ].sort());
});

for (const page of pages) {
  test(`${page} has working local asset, page, and anchor references`, async () => {
    const html = await readFile(new URL(page, output), 'utf8');
    const origin = new URL(`https://snackify.example/${page}`);
    assert.match(html, /<html lang="en">/);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.doesNotMatch(html, /cdn\.tailwindcss\.com|\sonclick=|\sonsubmit=/);
    for (const [, attribute, value] of html.matchAll(/\b(src|href)="([^"]+)"/g)) {
      const url = new URL(value, origin);
      assert.equal(url.origin, origin.origin, `${attribute} must be local: ${value}`);
      const target = new URL(url.pathname.slice(1), output);
      assert.ok((await stat(target)).isFile(), `${page}: missing ${value}`);
      if (url.hash) {
        const targetHtml = await readFile(target, 'utf8');
        assert.ok(targetHtml.includes(`id="${url.hash.slice(1)}"`), `Missing anchor: ${value}`);
      }
    }
  });
}

test('production and source previews have the same compiled CSS', async () => {
  const css = await readFile(new URL('styles.css', output), 'utf8');
  assert.ok(css.length > 4000, 'Styles must be compiled, not an empty placeholder');
  assert.doesNotMatch(css, /@tailwind\b/);
  assert.match(css, /\.flex\{/);
  assert.match(css, /\.bg-orange-50\{/);
  assert.equal(await readFile(new URL('styles.css', root), 'utf8'), css);
});

test('public API configuration is generated for both previews', async () => {
  const code = await readFile(new URL('config.js', output), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(code, context);
  const config = context.window.SNACKIFY_CONFIG;
  assert.deepEqual(Object.keys(config), ['ordersApiUrl']);
  const endpoint = new URL(config.ordersApiUrl);
  assert.equal(endpoint.protocol, 'https:');
  assert.equal(endpoint.username + endpoint.password + endpoint.search + endpoint.hash, '');
  assert.equal(await readFile(new URL('config.js', root), 'utf8'), code);
});

test('browser JavaScript parses and checkout has no embedded endpoint or payload logging', async () => {
  new vm.Script(await readFile(new URL('hero.js', output), 'utf8'));
  const script = await readFile(new URL('menu.js', output), 'utf8');
  new vm.Script(script);
  assert.doesNotMatch(script, /https?:\/\/|console\.(log|error)|localStorage|sessionStorage/);
});

test('all published images have real PNG or JPEG signatures', async () => {
  for (const name of await readdir(output)) {
    if (!/\.(png|jpg)$/.test(name)) continue;
    const buffer = await readFile(new URL(name, output));
    const signature = name.endsWith('.png') ? '89504e470d0a1a0a' : 'ffd8ff';
    assert.ok(buffer.toString('hex').startsWith(signature), `${name} is not a valid image`);
  }
});
