import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative, extname, basename } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import pc from 'picocolors';
import { load as yamlLoad } from 'js-yaml';
import { validateComponentManifest } from '../schema-validator.js';
import type { ComponentManifest } from '@folio/core';

export interface InferOptions {
  path: string;
  output?: string;
  apiKey?: string;
  quiet?: boolean;
}

// ── Context collection ────────────────────────────────────────────────────────

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'vendor', '__pycache__',
  '.pnpm-store', 'coverage', '.next', '.nuxt', 'out',
]);

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.java', '.rb', '.rs', '.cs', '.php',
]);

const MANIFEST_FILES = [
  'package.json', 'requirements.txt', 'pyproject.toml',
  'go.mod', 'Cargo.toml', 'Gemfile', 'pom.xml',
];

interface CoderbaseContext {
  dirTree: string;
  manifests: Array<{ name: string; content: string }>;
  sourceFiles: Array<{ path: string; lines: string[] }>;
  importSummary: Map<string, number>;
  detectedLanguage: string;
}

function buildDirTree(dir: string, rootDir: string, depth = 0, maxDepth = 4): string {
  if (depth > maxDepth) return '';
  const indent = '  '.repeat(depth);
  const name = depth === 0 ? relative(resolve(dir, '..'), dir) || basename(dir) : basename(dir);
  let result = `${indent}${name}/\n`;

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result += buildDirTree(fullPath, rootDir, depth + 1, maxDepth);
    } else {
      result += `${indent}  ${entry.name}\n`;
    }
  }

  return result;
}

function collectSourceFiles(dir: string, max = 20): Array<{ path: string; lines: string[] }> {
  const results: Array<{ path: string; lines: string[] }> = [];

  function walk(current: string): void {
    if (results.length >= max) return;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= max) return;
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) walk(join(current, entry.name));
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (SOURCE_EXTENSIONS.has(ext)) {
          try {
            const content = readFileSync(join(current, entry.name), 'utf-8');
            results.push({
              path: join(current, entry.name),
              lines: content.split('\n').slice(0, 60),
            });
          } catch {
            // skip unreadable files
          }
        }
      }
    }
  }

  walk(dir);
  return results;
}

function extractImports(lines: string[]): Set<string> {
  const pkgs = new Set<string>();
  const tsImport = /from\s+['"]([^'"./][^'"]*)['"]/g;
  const requireStmt = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;
  const pyImport = /^(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
  const goImport = /"([^"./][^"]*?)(?:\/[^"]*)?"/g;

  for (const line of lines) {
    for (const m of line.matchAll(tsImport)) {
      const pkg = m[1]?.split('/').slice(0, m[1].startsWith('@') ? 2 : 1).join('/');
      if (pkg) pkgs.add(pkg);
    }
    for (const m of line.matchAll(requireStmt)) {
      const pkg = m[1]?.split('/').slice(0, m[1].startsWith('@') ? 2 : 1).join('/');
      if (pkg) pkgs.add(pkg);
    }
    const pyM = line.match(pyImport);
    if (pyM?.[1] && !['os', 'sys', 'json', 'typing', 're', 'datetime', 'pathlib', 'abc', 'collections', 'io', 'itertools', 'functools', 'logging'].includes(pyM[1])) {
      pkgs.add(pyM[1]);
    }
    for (const m of line.matchAll(goImport)) {
      if (m[1]) pkgs.add(m[1]);
    }
  }
  return pkgs;
}

function detectLanguage(dir: string): string {
  for (const [manifest, lang] of [
    ['package.json', 'typescript'],
    ['pyproject.toml', 'python'],
    ['requirements.txt', 'python'],
    ['go.mod', 'go'],
    ['Cargo.toml', 'rust'],
    ['pom.xml', 'java'],
    ['build.gradle', 'java'],
    ['Gemfile', 'ruby'],
  ] as const) {
    if (existsSync(join(dir, manifest))) return lang;
  }
  return 'other';
}

function gatherContext(rootDir: string): CoderbaseContext {
  const dirTree = buildDirTree(rootDir, rootDir);

  const manifests: Array<{ name: string; content: string }> = [];
  for (const name of MANIFEST_FILES) {
    const p = join(rootDir, name);
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf-8');
        manifests.push({ name, content: raw.slice(0, 3000) });
      } catch {
        // skip
      }
    }
  }

  const sourceFiles = collectSourceFiles(rootDir);

  const importSummary = new Map<string, number>();
  for (const sf of sourceFiles) {
    for (const pkg of extractImports(sf.lines)) {
      importSummary.set(pkg, (importSummary.get(pkg) ?? 0) + 1);
    }
  }

  const detectedLanguage = detectLanguage(rootDir);

  return { dirTree, manifests, sourceFiles, importSummary, detectedLanguage };
}

// ── Prompt assembly ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert software architect analyzing a codebase to produce a Folio architectural manifest (folio.yaml).

Folio validates source code against architectural constraints. Your job is to infer meaningful constraints from the actual codebase and express them as a valid folio.yaml.

## folio.yaml schema

\`\`\`yaml
kind: Component
apiVersion: folio/v1alpha1

metadata:
  name: <component-name>       # lowercase, kebab-case, e.g. "payment-service"
  owner: <owner>               # team or email
  description: "<description>"
  tags: [<tag>, ...]           # optional

spec:
  type: <type>                 # service | library | gateway | frontend | worker | database | infrastructure
  language: <language>         # typescript | javascript | python | go | java | rust | csharp | ruby | other
  path: ./src                  # relative path to source directory

  constraints:
    # dependency rule: checks package names in import/require statements
    - id: <id>                 # lowercase kebab-case
      description: "<MUST/MUST NOT ...>"
      rule:
        type: dependency
        deny: [<pkg>, ...]     # forbidden packages
        # allow_only: [<pkg>, ...]  # OR whitelist (not both)
      severity: strategic      # strategic | tactical
      rationale: "<why>"

    # pattern rule: regex applied line-by-line across source files
    - id: <id>
      description: "<MUST/MUST NOT ...>"
      rule:
        type: pattern
        must_not_match:
          - pattern: "<regex>"
            message: "<guidance>"
        # must_match:          # OR assert pattern EXISTS somewhere
        #   - pattern: "<regex>"
        #     message: "<guidance>"
      severity: tactical

    # module rule: checks relative import paths as written in source
    - id: <id>
      description: "<layer> MUST NOT import from <layer>"
      rule:
        type: module
        deny_imports_from:
          - "../<dir>"
          - "../../<dir>"
        # allow_imports_from: ["../shared"]  # OR whitelist
      severity: strategic
\`\`\`

## Rules for generating constraints

1. Write 3–6 high-value constraints that reflect real patterns visible in the codebase.
2. Only write constraints that are meaningful given what you actually see in the code.
3. For dependency rules: focus on frameworks and libraries that signal architectural boundaries (DB drivers, HTTP clients, infrastructure SDKs).
4. For pattern rules: focus on things that should genuinely never appear (console.log in a backend service, hardcoded secrets, TODO markers, etc.).
5. For module rules: only write them if you can see distinct directory layers (domain/, infra/, application/, etc.).
6. severity: strategic means violations block CI with no exception. severity: tactical means advisory unless covered by an ADR.
7. Use strategic for critical boundaries (DB access, security, cross-layer imports). Use tactical for style/quality rules.
8. Do NOT add a violations: section. The user will add those manually for any existing violations.
9. Output ONLY valid YAML — no markdown fences, no prose, no explanation. Just the folio.yaml content.
10. The metadata.name MUST match the pattern ^[a-z][a-z0-9-]*$ (lowercase letters, digits, hyphens only).
11. Constraint id values MUST match the same pattern.`;

function buildUserPrompt(rootDir: string, ctx: CoderbaseContext): string {
  const componentName = basename(rootDir).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '') || 'my-component';

  const topImports = [...ctx.importSummary.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([pkg, count]) => `  ${pkg} (${count} files)`)
    .join('\n');

  const sourceSample = ctx.sourceFiles
    .slice(0, 8)
    .map(sf => `### ${relative(rootDir, sf.path)}\n${sf.lines.join('\n')}`)
    .join('\n\n');

  const manifestSection = ctx.manifests
    .map(m => `### ${m.name}\n\`\`\`\n${m.content}\n\`\`\``)
    .join('\n\n');

  return `Analyze this codebase and produce a folio.yaml manifest.

## Target directory
${rootDir}
Suggested component name: ${componentName}

## Directory structure
\`\`\`
${ctx.dirTree}
\`\`\`

## Package manifests
${manifestSection || '(none found)'}

## Detected language
${ctx.detectedLanguage}

## External packages imported (package → file count)
${topImports || '(none detected)'}

## Source file samples
${sourceSample || '(no source files found)'}

Produce a complete, valid folio.yaml for this component. Output ONLY the YAML content — no prose, no markdown code fences.`;
}

// ── Claude API call ───────────────────────────────────────────────────────────

async function callClaude(systemPrompt: string, userPrompt: string, apiKey?: string, quiet = false): Promise<string> {
  const client = new Anthropic({ apiKey });

  if (!quiet) {
    process.stderr.write(pc.dim('Analyzing codebase with Claude...'));
  }

  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  let dotInterval: ReturnType<typeof setInterval> | undefined;
  if (!quiet) {
    dotInterval = setInterval(() => process.stderr.write('.'), 2000);
  }

  const message = await stream.finalMessage();

  if (dotInterval) clearInterval(dotInterval);
  if (!quiet) process.stderr.write('\n');

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  // Strip any markdown fences Claude might have added despite instructions
  let yaml = textBlock.text.trim();
  const fenceMatch = yaml.match(/^```(?:yaml)?\n([\s\S]*?)```$/m);
  if (fenceMatch?.[1]) {
    yaml = fenceMatch[1].trim();
  }

  return yaml;
}

// ── Main command ──────────────────────────────────────────────────────────────

export async function runInfer(opts: InferOptions): Promise<number> {
  const rootDir = resolve(opts.path);

  if (!existsSync(rootDir)) {
    console.error(pc.red(`Path does not exist: ${rootDir}`));
    return 2;
  }

  if (!opts.quiet) {
    console.log(pc.bold('\nFolio — Architecture Inference'));
    console.log(pc.dim(`Target: ${rootDir}`));
    console.log('');
  }

  // Collect codebase context
  if (!opts.quiet) console.log(pc.dim('Collecting codebase context...'));
  const ctx = gatherContext(rootDir);

  if (!opts.quiet) {
    const fileCount = ctx.sourceFiles.length;
    const pkgCount = ctx.importSummary.size;
    console.log(pc.dim(`  ${fileCount} source file(s) sampled, ${pkgCount} external package(s) detected`));
    console.log('');
  }

  // Build prompts
  const systemPrompt = SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(rootDir, ctx);

  // Call Claude
  let generatedYaml: string;
  try {
    generatedYaml = await callClaude(systemPrompt, userPrompt, opts.apiKey, opts.quiet);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('API key') || msg.includes('authentication') || msg.includes('401')) {
      console.error(pc.red('Authentication error: set ANTHROPIC_API_KEY or use --api-key'));
    } else {
      console.error(pc.red(`Claude API error: ${msg}`));
    }
    return 2;
  }

  // Validate the generated YAML
  let parsed: unknown;
  try {
    parsed = yamlLoad(generatedYaml);
  } catch (err) {
    console.error(pc.red(`Generated YAML is not valid YAML: ${String(err)}`));
    if (!opts.quiet) {
      console.error(pc.dim('\nGenerated content:'));
      console.error(generatedYaml);
    }
    return 2;
  }

  const schemaErrors = validateComponentManifest(parsed as ComponentManifest);
  if (schemaErrors.length > 0) {
    if (!opts.quiet) {
      console.error(pc.yellow(`Schema validation warnings (${schemaErrors.length}):`));
      for (const e of schemaErrors) {
        console.error(pc.yellow(`  ${e.message}`));
      }
      console.error('');
      console.error(pc.dim('The manifest may still be useful as a starting point.'));
      console.error('');
    }
  }

  // Output
  if (opts.output) {
    const outPath = resolve(opts.output);
    writeFileSync(outPath, generatedYaml + '\n', 'utf-8');
    if (!opts.quiet) {
      console.log(pc.green('✓') + ` Written to ${outPath}`);
      console.log('');
      console.log(pc.bold('Next steps:'));
      console.log(`  1. Review and refine the generated ${pc.cyan('folio.yaml')}`);
      console.log(`  2. Run ${pc.cyan('folio validate .')} to confirm the schema is correct`);
      console.log(`  3. Run ${pc.cyan('folio check .')} to see existing violations`);
      console.log(`  4. For each BLOCKING finding: fix the code or document the exception with an ADR`);
      console.log('');
    }
  } else {
    console.log(generatedYaml);
  }

  return schemaErrors.length > 0 ? 1 : 0;
}
