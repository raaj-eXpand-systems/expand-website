import { buildStatic } from './private-documentation.mjs';
import { spawnSync } from 'node:child_process';
for (const [command, ...args] of [["node", "--test", "scripts/private-documentation.test.mjs"], ["node", "scripts/verify-csp.mjs"], ["node", "scripts/verify-seo.mjs"]]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
buildStatic(process.cwd(), ["images"]);
