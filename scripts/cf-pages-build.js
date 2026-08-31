// Post-build script: prepare .open-next/assets for Cloudflare Pages deployment.
// OpenNext generates .open-next/worker.js (for Workers), but Cloudflare Pages
// expects _worker.js in the output directory.
// This script copies worker.js → _worker.js and the supporting folders
// (middleware, server-functions, cloudflare, cloudflare-templates, .build)
// into .open-next/assets/ so Pages can serve everything.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const openNext = path.join(root, '.open-next');
const assets = path.join(openNext, 'assets');

// Copy file or directory recursively
function copySync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copySync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// worker.js → _worker.js (CF Pages expects _worker.js)
const workerSrc = path.join(openNext, 'worker.js');
const workerDest = path.join(assets, '_worker.js');
if (fs.existsSync(workerSrc)) {
  copySync(workerSrc, workerDest);
  console.log('✅ Copied worker.js → assets/_worker.js');
} else {
  console.error('❌ .open-next/worker.js not found!');
  process.exit(1);
}

// Copy supporting directories that the worker imports
const dirsToCopy = ['middleware', 'server-functions', 'cloudflare', 'cloudflare-templates', '.build'];
for (const dir of dirsToCopy) {
  const src = path.join(openNext, dir);
  if (fs.existsSync(src)) {
    copySync(src, path.join(assets, dir));
    console.log(`✅ Copied ${dir}/ → assets/${dir}/`);
  }
}

console.log('\n🚀 Cloudflare Pages assets ready in .open-next/assets/');
