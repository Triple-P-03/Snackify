import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const defaults = JSON.parse(await readFile(new URL('site-config.json', root), 'utf8'));
const ordersApiUrl = (process.env.SNACKIFY_API_URL ?? defaults.ordersApiUrl).trim();

// This URL is public browser configuration, never an API key or database secret.
let endpoint;
try {
  endpoint = new URL(ordersApiUrl);
} catch {
  throw new Error('SNACKIFY_API_URL must be an absolute HTTPS order endpoint.');
}
if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash || endpoint.search) {
  throw new Error('The order endpoint must use HTTPS without credentials, query parameters, or a fragment.');
}

// Publish only these explicit frontend assets, not the repo, notes, or config files.
const publicFiles = [
  'index.html',
  'menu.html',
  '404.html',
  'menu.js',
  'hero.js',
  'donut.mp4',
  'styles.css',
  'logo.png',
  'snacki.png',
  'donut.png',
  'coffee.png'
];

// dist is generated and ignored; remove stale assets from earlier builds.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(publicFiles.map((file) => cp(new URL(file, root), new URL(file, output))));
const browserConfig = `// Public configuration generated at build time.\nwindow.SNACKIFY_CONFIG = Object.freeze(${JSON.stringify({ ordersApiUrl })});\n`;
await writeFile(new URL('config.js', output), browserConfig);
// Also support editor/static previews of the source pages after a build.
await writeFile(new URL('config.js', root), browserConfig);
console.log(`Prepared ${publicFiles.length} static assets and public API configuration in dist/.`);
