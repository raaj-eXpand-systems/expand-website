// Vendored identically across independently deployed sites. No runtime dependencies.
import { lstatSync, readdirSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function isPrivateDocumentation(value) {
  for (let pass = 0; pass < 8; pass++) {
    if (/\.(?:mdx?|markdown)(?:$|[^a-z0-9])/i.test(value)) return true;
    const decoded = value.replace(/%([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    if (decoded === value) return false;
    value = decoded;
  }
  // Unresolved nested encodings are not valid public asset filenames.
  return /%[a-f0-9]{2}/i.test(value);
}

export function auditPublicTree(directory, { required = true } = {}) {
  if (!existsSync(directory)) {
    // lstat catches dangling links, which existsSync intentionally hides.
    try { lstatSync(directory); } catch (error) {
      if (error.code === 'ENOENT' && !required) return;
      throw error;
    }
  }
  if (!lstatSync(directory).isDirectory()) throw new Error(`Public root must be a directory: ${directory}`);
  const visit = file => {
    const relative = path.relative(directory, file);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error(`Public symlink prohibited: ${file}`);
    if (isPrivateDocumentation(relative)) throw new Error(`Private documentation in public output: ${file}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(file)) visit(path.join(file, name));
    } else if (!stat.isFile()) throw new Error(`Unsupported public asset: ${file}`);
  };
  visit(directory);
}

export function auditNextSources(root) {
  for (const name of ['public', 'static']) auditPublicTree(path.join(root, name), { required: false });
}
export function auditNextOutput(root) {
  auditNextSources(root);
  auditPublicTree(path.join(root, '.next/static'));
  for (const name of ['out', '.vercel/output/static']) auditPublicTree(path.join(root, name), { required: false });
}

// Publish only browser assets, never the repository root, tooling, tests, or docs.
export function buildStatic(root, directories) {
  auditNextSources(root);
  const output = path.join(root, 'dist');
  if (existsSync(output) && lstatSync(output).isSymbolicLink()) throw new Error('dist must not be a symlink');
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output);
  const allowed = /\.(?:html|css|js|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|txt|xml|webmanifest|pdf|mp4|webm|mp3|wav)$/i;
  const copy = (source, target) => {
    const stat = lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error(`Public symlink prohibited: ${source}`);
    if (stat.isDirectory()) {
      mkdirSync(target, { recursive: true });
      for (const name of readdirSync(source)) copy(path.join(source, name), path.join(target, name));
    } else if (stat.isFile() && allowed.test(source) && !/\.(?:test|spec)\.js$/i.test(source)) {
      if (isPrivateDocumentation(path.basename(source))) throw new Error(`Private documentation asset: ${source}`);
      copyFileSync(source, target);
    }
  };
  for (const name of readdirSync(root)) {
    const source = path.join(root, name);
    if (directories.includes(name)) {
      auditPublicTree(source);
      copy(source, path.join(output, name));
    } else if (allowed.test(name) && !isPrivateDocumentation(name) && lstatSync(source).isFile()) {
      copy(source, path.join(output, name));
    }
  }
  auditPublicTree(output);
  if (!existsSync(path.join(output, 'index.html'))) throw new Error('Missing static entry point');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...directories] = process.argv.slice(2);
  if (mode === 'next-source') auditNextSources(process.cwd());
  else if (mode === 'next-output') auditNextOutput(process.cwd());
  else if (mode === 'tree' && directories.length) for (const directory of directories) auditPublicTree(directory);
  else throw new Error('Expected next-source, next-output, or tree <directories>');
  console.log('Public documentation exclusion check passed.');
}
