import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pc from 'picocolors';

export interface InitOptions {
  path: string;
  name?: string;
  owner?: string;
  type?: string;
  language?: string;
}

const COMPONENT_TEMPLATE = (
  name: string,
  owner: string,
  type: string,
  language: string,
) => `kind: Component
apiVersion: folio/v1alpha1
metadata:
  name: ${name}
  owner: ${owner}
  description: ""

spec:
  type: ${type}
  language: ${language}
  path: ./src

  constraints:
    # Example: deny direct database driver imports
    # - id: no-direct-db
    #   description: "This service MUST NOT import database drivers directly"
    #   rule:
    #     type: dependency
    #     deny:
    #       - pg
    #       - mysql2
    #       - sequelize
    #   severity: strategic
    #   rationale: "All data access must flow through the shared data-access layer"

    # Example: disallow console.log in production code
    # - id: no-console-log
    #   description: "Source files MUST NOT contain console.log statements"
    #   rule:
    #     type: pattern
    #     must_not_match:
    #       - pattern: "console\\.log"
    #         message: "Use the structured logger instead"
    #   severity: tactical

  # violations:
  #   tactical:
  #     - id: v-001
  #       constraint: no-direct-db
  #       adr: ADR-001
  #       expires: "${oneYearFromNow()}"
  #       owner: your.name@example.com
  #       reason: "Describe why this exception is needed"
  #       max_age_days: 90
  #
  #   strategic:
  #     - id: v-002
  #       constraint: some-constraint
  #       rfc: RFC-2026-01
  #       approval: architecture-board
  #       approver: arch-lead@example.com
  #       reason: "Describe the board-approved exception"
`;

const ADR_TEMPLATE = (componentName: string) => `kind: ArchDecision
apiVersion: folio/v1alpha1
metadata:
  name: ADR-001
  created: "${today()}"

spec:
  title: "Short description of the architectural decision"
  status: active

  component: ${componentName}
  constraints:
    - constraint-id-here

  decision: >
    Describe what was decided in present tense.

  rationale: >
    Explain why this decision was made and what circumstances
    necessitated the exception.

  consequences: >
    Describe what must happen before the expiry date and
    what the consequences of not resolving it are.

  expires: "${oneYearFromNow()}"
  owner: your.name@example.com
  approver: tech-lead@example.com

  tags:
    - migration

  links:
    - https://github.com/your-org/your-repo/pull/1
`;

export async function runInit(opts: InitOptions): Promise<number> {
  const rootDir = resolve(opts.path);
  const name = opts.name ?? inferName(rootDir);
  const owner = opts.owner ?? 'your-team';
  const type = opts.type ?? 'service';
  const language = opts.language ?? 'typescript';

  const folioYamlPath = join(rootDir, 'folio.yaml');
  const decisionsDir = join(rootDir, 'decisions');
  const adrPath = join(decisionsDir, 'ADR-001.yaml');

  console.log(pc.bold('\nFolio — Init'));
  console.log('');

  // folio.yaml
  if (existsSync(folioYamlPath)) {
    console.log(
      pc.yellow(`folio.yaml already exists at ${folioYamlPath}. Skipping.`),
    );
  } else {
    writeFileSync(
      folioYamlPath,
      COMPONENT_TEMPLATE(name, owner, type, language),
      'utf-8',
    );
    console.log(pc.green('✓') + ` Created ${folioYamlPath}`);
  }

  // decisions/ADR-001.yaml
  if (!existsSync(decisionsDir)) {
    mkdirSync(decisionsDir, { recursive: true });
  }

  if (existsSync(adrPath)) {
    console.log(pc.yellow(`ADR-001.yaml already exists at ${adrPath}. Skipping.`));
  } else {
    writeFileSync(adrPath, ADR_TEMPLATE(name), 'utf-8');
    console.log(pc.green('✓') + ` Created ${adrPath}`);
  }

  console.log('');
  console.log(pc.bold('Next steps:'));
  console.log(
    `  1. Edit ${pc.cyan('folio.yaml')} — declare your component's constraints`,
  );
  console.log(
    `  2. Run ${pc.cyan('folio validate .')} — check your files against the schema`,
  );
  console.log(`  3. Run ${pc.cyan('folio check .')} — run the full analysis`);
  console.log('');

  return 0;
}

function inferName(dir: string): string {
  return dir.split('/').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '-') ?? 'my-component';
}

function today(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function oneYearFromNow(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0] ?? '';
}
