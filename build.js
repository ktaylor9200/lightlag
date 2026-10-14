// Inline everything into one self-contained lightlag.html. Run: node build.js
const fs = require('fs');
const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const levels = JSON.parse(fs.readFileSync(path.join(__dirname, 'reference/levels.json'), 'utf8'));
const js = [
  '"use strict";',
  'const LEVELS_JSON = ' + JSON.stringify(levels.levels) + ';',
  src('sim.js'), src('finale.js'), src('data.js'), src('audio.js'), src('render.js'), src('game.js'),
].join('\n');
let html = src('shell.html');
html = html.replace('/*CSS*/', () => src('style.css')).replace('/*JS*/', () => js.replace(/<\/script/gi, '<\\/script'));
fs.writeFileSync(path.join(__dirname, 'lightlag.html'), html);
console.log('wrote lightlag.html', html.length, 'bytes');
