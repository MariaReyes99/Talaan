import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const r = await build({ entryPoints: ['src/main.tsx'], bundle: true, loader: { '.css': 'text' }, external: ['html2canvas', 'dompurify', 'canvg'], minify: true, format: 'iife', write: false, jsx: 'automatic', target: 'es2020', define: { 'process.env.NODE_ENV': '"production"' } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/styles.css', 'utf8');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Talaan</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
mkdirSync('dist', { recursive: true }); writeFileSync('dist/index.html', html);
console.log('Built dist/index.html (' + html.length + ' bytes). Open it in a browser, or run: npm start');
