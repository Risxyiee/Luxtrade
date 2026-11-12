import { validatePineSource } from '../src/lib/pine/pine-runner';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const src = readFileSync(path.join(process.cwd(), 'src/lib/pine/champion-v6-original.pine'), 'utf8');
const r = await validatePineSource(src);
console.log('VALIDASI PINE ASLI:', r.ok ? 'LOLOS' : 'GAGAL');
console.log('errors:', JSON.stringify(r.errors));
console.log('warnings:', JSON.stringify(r.warnings.slice(0, 3)));
