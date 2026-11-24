import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml', import.meta.url), 'utf8');

test('production deployment is restricted to main', () => {
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
});

test('deployment waits for tests and bundle validation', () => {
  assert.match(workflow, /needs: validate/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /deploy --dry-run/);
});

test('deployment requires explicit Cloudflare credentials', () => {
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /Missing CLOUDFLARE_API_TOKEN secret/);
  assert.match(workflow, /Missing CLOUDFLARE_ACCOUNT_ID secret/);
});

test('deploy uses the repository Wrangler configuration', () => {
  assert.match(workflow, /wrangler@4 deploy --config wrangler\.jsonc/);
});
