import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isPrivateDocumentation, auditPublicTree, buildStatic } from './private-documentation.mjs';

const blocked = ['README.md', 'notes.MD', 'a.MdX', 'a.markDOWN', 'x.md.bak', 'x.md/child', 'x%2e%6d%64', 'x%252eMD', 'x.md;raw', 'x%2E%4D%44', 'x%25252eMd', 'x.MARKDOWN/child'];
test('Markdown variants and encoded paths are private', () => {
  for (const name of blocked) assert.equal(isPrivateDocumentation(name), true, name);
  for (const name of ['theme.js', 'image.svg', 'model.mdl', 'index.html']) assert.equal(isPrivateDocumentation(name), false, name);
});
test('public artifact audit fails closed for nested documentation and symlinks', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'private-docs-'));
  try {
    const publicDir = path.join(root, 'public'); mkdirSync(publicDir);
    writeFileSync(path.join(publicDir, 'index.html'), 'safe'); auditPublicTree(publicDir);
    for (const name of blocked.filter(name => !name.includes('/'))) {
      const file = path.join(publicDir, name); writeFileSync(file, 'private');
      assert.throws(() => auditPublicTree(publicDir)); rmSync(file);
    }
    writeFileSync(path.join(root, 'secret.md'), 'private');
    symlinkSync(path.join(root, 'secret.md'), path.join(publicDir, 'innocent.txt'));
    assert.throws(() => auditPublicTree(publicDir), /symlink/);
    assert.throws(() => auditPublicTree(path.join(root, 'missing')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('isolated static output preserves source documentation and removes stale output', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'static-docs-'));
  try {
    for (const directory of ['docs', 'images', 'dist', 'api', 'scripts']) mkdirSync(path.join(root, directory));
    for (const name of ['README.md', 'docs/notes.md', 'dist/leaked.md', 'api/private.js', 'scripts/internal.js']) writeFileSync(path.join(root, name), 'private');
    writeFileSync(path.join(root, 'index.html'), 'home');
    writeFileSync(path.join(root, 'images/logo.svg'), 'logo');
    buildStatic(root, ['images']);
    assert.equal(readFileSync(path.join(root, 'dist/index.html'), 'utf8'), 'home');
    assert.ok(existsSync(path.join(root, 'README.md')));
    assert.ok(existsSync(path.join(root, 'docs/notes.md')));
    for (const name of ['leaked.md', 'README.md', 'docs', 'api', 'scripts']) assert.equal(existsSync(path.join(root, 'dist', name)), false);
    writeFileSync(path.join(root, 'images/SECRET.MD'), 'private');
    assert.throws(() => buildStatic(root, ['images']), /documentation/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('deployment denies Markdown before serving assets', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const route = config.routes[0]; assert.equal(route.status, 404);
  const matcher = new RegExp(`^(?:${route.src})$`);
  for (const name of blocked) assert.ok(matcher.test('/images/' + name), name);
  assert.equal(matcher.test('/images/logo.svg'), false);
});
