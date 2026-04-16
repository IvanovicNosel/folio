import type { FolioReport, ClassifiedFinding } from '@folio/core';

interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations?: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: { startLine: number; startColumn?: number };
    };
  }>;
  properties?: Record<string, unknown>;
}

interface SarifLog {
  version: '2.1.0';
  $schema: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: Array<{
          id: string;
          name: string;
          shortDescription: { text: string };
          defaultConfiguration: { level: string };
        }>;
      };
    };
    results: SarifResult[];
  }>;
}

const LEVEL_MAP: Record<string, 'error' | 'warning' | 'note'> = {
  BLOCKING: 'error',
  WARNING: 'warning',
  ADVISORY: 'warning',
  TACTICAL: 'note',
  STRATEGIC_APPROVED: 'note',
};

export function renderSarif(report: FolioReport, toolVersion = '0.1.0'): string {
  const ruleIds = new Set(report.findings.map((f) => f.constraint));
  const rules = Array.from(ruleIds).map((id) => ({
    id,
    name: id
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(''),
    shortDescription: { text: `Folio constraint: ${id}` },
    defaultConfiguration: { level: 'error' },
  }));

  const results: SarifResult[] = report.findings.map((f) => {
    const level = LEVEL_MAP[f.classification] ?? 'warning';
    const result: SarifResult = {
      ruleId: f.constraint,
      level,
      message: { text: f.message },
      properties: {
        classification: f.classification,
        component: f.component,
        agent: f.agent,
        violation_type: f.violation_type,
        confidence: f.confidence,
        ...(f.adr ? { adr: f.adr } : {}),
        ...(f.tolerance_id ? { tolerance_id: f.tolerance_id } : {}),
      },
    };

    if (f.file) {
      result.locations = [
        {
          physicalLocation: {
            artifactLocation: {
              uri: f.file.startsWith('/') ? `file://${f.file}` : f.file,
            },
            ...(f.line
              ? {
                  region: {
                    startLine: f.line,
                    ...(f.column ? { startColumn: f.column } : {}),
                  },
                }
              : {}),
          },
        },
      ];
    }

    return result;
  });

  const sarif: SarifLog = {
    version: '2.1.0',
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'folio',
            version: toolVersion,
            informationUri: 'https://github.com/ivanovicnosel/folio',
            rules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
