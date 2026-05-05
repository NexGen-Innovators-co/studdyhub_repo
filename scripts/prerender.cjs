const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const Prerenderer = require('@prerenderer/prerenderer');
const PuppeteerRenderer = require('@prerenderer/renderer-puppeteer');

const distDir = path.resolve(__dirname, '../dist');

const routes = [
  '/',
  '/about-us',
  '/contact',
  '/blogs',
  '/privacy-policy',
  '/terms-of-service',
  '/careers',
  '/integrations',
  '/api',
  '/documentation-page',
  '/user-guide-page',
];

async function prerender() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Dist directory not found: ${distDir}. Run "npm run build" first.`);
  }

  const prerenderer = new Prerenderer({
    staticDir: distDir,
    server: {
      port: 4173,
    },
    renderer: new PuppeteerRenderer({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      renderAfterElementExists: '#root',
      maxConcurrentRoutes: 4,
      renderAfterTime: 1000,
    }),
  });

  try {
    await prerenderer.initialize();
    const renderedRoutes = await prerenderer.renderRoutes(routes);

    for (const rendered of renderedRoutes) {
      const route = rendered.route || rendered.originalRoute;
      let outputPath;

      if (route === '/' || route === '') {
        outputPath = path.join(distDir, 'index.html');
      } else {
        const normalized = route.replace(/^\//, '').replace(/\/$/, '');
        outputPath = path.join(distDir, normalized, 'index.html');
      }

      if (rendered.outputPath) {
        outputPath = rendered.outputPath;
      }

      await mkdirp(path.dirname(outputPath));
      await fs.promises.writeFile(outputPath, rendered.html.trim(), 'utf8');
      console.log(`Prerendered: ${route} -> ${outputPath}`);
    }

    console.log('✅ Prerendering complete.');
  } finally {
    prerenderer.destroy();
  }
}

prerender().catch((error) => {
  console.error('Prerender failed:', error);
  process.exit(1);
});
