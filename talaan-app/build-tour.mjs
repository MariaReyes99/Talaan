// Builds the published guided tour as one self-contained HTML file: dist/talaan-guided-tour.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const r = await build({ entryPoints: ['src/tour/standalone.tsx'], bundle: true, loader: { '.css': 'text', '.png': 'dataurl', '.jpg': 'dataurl' }, minify: true, format: 'iife', write: false, jsx: 'automatic', target: 'es2020', define: { 'process.env.NODE_ENV': '"production"' } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const icon = readFileSync('assets/favicon-32.png').toString('base64');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Talaan guided tour</title><meta name="theme-color" content="#0B2350">
<meta name="description" content="Meet Tala: a three-minute guided tour of Talaan, payroll and compliance for bookkeeping firms. Every payslip. Every deadline.">
<link rel="icon" type="image/png" href="data:image/png;base64,${icon}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Montserrat:wght@600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:#0B2350}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
mkdirSync('dist', { recursive: true }); writeFileSync('dist/talaan-guided-tour.html', html);
console.log('Built dist/talaan-guided-tour.html (' + html.length + ' bytes)');
