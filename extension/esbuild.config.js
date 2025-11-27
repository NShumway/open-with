import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const isWatch = process.argv.includes('--watch');

const backgroundOptions = {
  entryPoints: ['src/background/index.ts'],
  bundle: true,
  outfile: 'dist/background.js',
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  sourcemap: true,
  minify: !isWatch,
};

const popupOptions = {
  entryPoints: ['src/popup/popup.ts'],
  bundle: true,
  outfile: 'dist/popup.js',
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  sourcemap: true,
  minify: !isWatch,
};

// Copy static popup files
function copyPopupFiles() {
  const files = [
    ['src/popup/popup.html', 'dist/popup.html'],
    ['src/popup/popup.css', 'dist/popup.css'],
  ];

  for (const [src, dest] of files) {
    const destDir = dirname(dest);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    copyFileSync(src, dest);
  }
}

if (isWatch) {
  const bgCtx = await esbuild.context(backgroundOptions);
  const popupCtx = await esbuild.context(popupOptions);
  await Promise.all([bgCtx.watch(), popupCtx.watch()]);
  copyPopupFiles();
  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build(backgroundOptions),
    esbuild.build(popupOptions),
  ]);
  copyPopupFiles();
  console.log('Build complete');
}
