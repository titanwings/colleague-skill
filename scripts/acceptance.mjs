#!/usr/bin/env node
/**
 * 端到端验收（机械部分）。协议见 docs/v2/ACCEPTANCE.md §5。
 *
 * 断言：回执形状 / 幂等 / 确定性 / 锚点回指 / 单文件离线 / visual-check 八项。
 * 依赖的命令还不存在时**响亮失败**并指出缺哪个分支的产出，不静默跳过。
 *
 * usage:
 *   node scripts/acceptance.mjs [--corpus <dir>] [--person <slug>] [--keep] [--evidence <dir>]
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const has = (name) => process.argv.includes(`--${name}`);

const corpus = path.resolve(arg('corpus', path.join(root, 'tests/fixtures/public-corpus/synthetic-interview')));
const person = arg('person', 'lin-gong');
const keep = has('keep');
const evidenceDir = path.resolve(arg('evidence', '/tmp/dst-evidence/pr-acceptance'));

const results = [];
let failed = 0;
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const workdir = await mkdtemp(path.join(tmpdir(), 'dst-acceptance-'));
await mkdir(evidenceDir, { recursive: true });

function distilly(args, { allowMissing = false } = {}) {
  const res = spawnSync('node', [path.join(root, 'bin/distilly.mjs'), ...args], {
    cwd: workdir,
    encoding: 'utf8',
    env: { ...process.env, DISTILLY_HOME: path.join(workdir, '.distilly') },
  });
  const missing = /unknown command|not implemented|Cannot find module/i.test(res.stderr ?? '');
  if (res.status !== 0 && missing) {
    if (allowMissing) return { missing: true, stderr: res.stderr ?? '' };
    throw new Error(`命令不可用：distilly ${args.join(' ')}（缺 ds/01、ds/02 的产出）`);
  }
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function parseReceipt(out) {
  const start = out.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(out.slice(start));
  } catch {
    return null;
  }
}

async function hashDir(dir) {
  const names = (await readdir(dir)).sort();
  const hashes = {};
  for (const n of names) hashes[n] = sha256(await readFile(path.join(dir, n)));
  return hashes;
}

try {
  const personDir = path.join(workdir, 'skills', 'colleague', person);
  await mkdir(personDir, { recursive: true });
  await cp(corpus, path.join(workdir, 'corpus'), { recursive: true });
  console.log(`验收语料：${path.relative(root, corpus)}`);

  // 1. harvest + 幂等 + 回执形状
  const h1 = distilly(['harvest', path.join(workdir, 'corpus'), '--person', person, '--json']);
  const r1 = parseReceipt(h1.stdout);
  record('harvest 退出码 0 且回执可解析', h1.status === 0 && !!r1, r1 ? `${r1.outputs?.length ?? 0} 个产物` : '无回执');
  record(
    '回执形状（command/ok/inputs/outputs/sha256/bytes）',
    !!r1 &&
      typeof r1.command === 'string' &&
      typeof r1.ok === 'boolean' &&
      Array.isArray(r1.inputs) &&
      Array.isArray(r1.outputs) &&
      r1.outputs.every((o) => typeof o.sha256 === 'string' && typeof o.bytes === 'number'),
  );

  const ledgerPath = path.join(personDir, 'knowledge', 'index.json');
  const ledger1 = JSON.parse(await readFile(ledgerPath, 'utf8'));
  const h2 = distilly(['harvest', path.join(workdir, 'corpus'), '--person', person, '--json']);
  const ledger2 = JSON.parse(await readFile(ledgerPath, 'utf8'));
  record('重复 harvest 幂等', h2.status === 0 && ledger1.length === ledger2.length, `${ledger1.length} → ${ledger2.length} 条`);

  const anchors = ledger2.flatMap((e) => e.anchors ?? []).map((a) => (typeof a === 'string' ? a : a.id));
  record('账本里有锚点', anchors.length > 0, `${anchors.length} 个`);

  // 2. retrospect + 确定性 + 锚点回指
  const derivedDir = path.join(personDir, 'evidence', 'derived');
  distilly(['retrospect', '--person', person, '--json']);
  const d1 = await hashDir(derivedDir);
  distilly(['retrospect', '--person', person, '--json']);
  const d2 = await hashDir(derivedDir);
  record('retrospect 两次产物字节相同', JSON.stringify(d1) === JSON.stringify(d2), Object.keys(d1).join(', '));

  const known = new Set(anchors);
  let dangling = 0;
  for (const [name] of Object.entries(d1)) {
    const body = await readFile(path.join(derivedDir, name), 'utf8');
    for (const m of body.matchAll(/"?(k\d{4}(?::t\d+)?)"?/g)) if (!known.has(m[1])) dangling += 1;
  }
  record('派生结论锚点全部可回指', dangling === 0, dangling ? `${dangling} 个悬空` : '0 悬空');

  // 3. view check / render（view 模板里的锚点按序解析，模拟"模型写好的视图"）
  const template = await readFile(path.join(corpus, 'expected', 'view.template.json'), 'utf8');
  const resolved = template.replace(/\{\{ANCHOR:(\d+)\}\}/g, (_, n) => anchors[Number(n) - 1] ?? anchors[0]);
  const viewsDir = path.join(personDir, 'views');
  await mkdir(viewsDir, { recursive: true });
  await writeFile(path.join(viewsDir, `${person}.view.json`), resolved, 'utf8');

  record('view check 通过', distilly(['view', 'check', '--person', person, '--json']).status === 0);

  const htmlPath = path.join(viewsDir, `${person}.html`);
  distilly(['view', 'render', '--person', person, '--json']);
  const html1 = await readFile(htmlPath);
  distilly(['view', 'render', '--person', person, '--json']);
  const html2 = await readFile(htmlPath);
  record('render 两次产物字节相同', sha256(html1) === sha256(html2), `${html1.length} bytes`);
  const html = html1.toString('utf8');
  record('产物单文件无外链', !/https?:\/\//i.test(html.replace(/https?:\/\/www\.w3\.org[^"']*/g, '')), '');
  record('产物含 CSP', /Content-Security-Policy/i.test(html));

  // 4. visual-check（八项）
  const vc = spawnSync('node', [path.join(root, 'scripts/visual-check.mjs'), htmlPath, '--out', evidenceDir], {
    cwd: workdir,
    encoding: 'utf8',
  });
  if (/Cannot find module|ENOENT/.test(vc.stderr ?? '')) {
    record('visual-check 可用', false, 'scripts/visual-check.mjs 尚不存在（ds/03-render 的产出）');
  } else {
    record('visual-check 八项通过', vc.status === 0, (vc.stdout ?? '').trim().split('\n').slice(-3).join(' / '));
  }
} catch (error) {
  record('验收流程未中断', false, String(error.message).split('\n')[0]);
} finally {
  if (keep) console.log(`保留工作目录：${workdir}`);
  else await rm(workdir, { recursive: true, force: true });
}

console.log(`\n验收结果：${results.length - failed}/${results.length} 通过`);
if (failed) {
  console.log('未通过项（依赖未落地时属预期，落地后必须转绿）：');
  for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.name}: ${r.detail}`);
  process.exit(1);
}
