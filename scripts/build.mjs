import {mkdir, cp} from 'node:fs/promises';
await mkdir('public/vendor', {recursive:true});
for (const name of ['pdf.mjs','pdf.worker.mjs']) await cp(`node_modules/pdfjs-dist/build/${name}`, `public/vendor/${name}`);
await cp('node_modules/pdfjs-dist/cmaps', 'public/vendor/cmaps', {recursive:true});
await cp('node_modules/pdfjs-dist/standard_fonts', 'public/vendor/standard_fonts', {recursive:true});
await cp('node_modules/pdfjs-dist/LICENSE', 'public/vendor/LICENSE');
