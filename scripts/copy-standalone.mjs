import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');

if (!existsSync(standalone)) {
  console.error('.next/standalone not found. Run `next build` first.');
  process.exit(1);
}

mkdirSync(join(standalone, '.next'), { recursive: true });

if (existsSync(join(root, '.next', 'static'))) {
  cpSync(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });
  console.log('Copied .next/static -> .next/standalone/.next/static');
}
if (existsSync(join(root, 'public'))) {
  cpSync(join(root, 'public'), join(standalone, 'public'), { recursive: true });
  console.log('Copied public -> .next/standalone/public');
}
if (existsSync(join(root, '.env'))) {
  cpSync(join(root, '.env'), join(standalone, '.env'));
  console.log('Copied .env -> .next/standalone/.env');
}
