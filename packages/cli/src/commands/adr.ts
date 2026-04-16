import { resolve } from 'node:path';
import pc from 'picocolors';
import { loadArchDecisions, applyExpiryTransitions } from '@folio/core';
import type { ArchDecision } from '@folio/core';

export interface AdrListOptions {
  decisions: string;
}

export interface AdrStatusOptions {
  decisions: string;
  name: string;
}

const STATUS_COLORS: Record<string, (s: string) => string> = {
  active: pc.green,
  expired: pc.red,
  superseded: pc.yellow,
  revoked: pc.red,
  draft: pc.dim,
};

const STATUS_ICONS: Record<string, string> = {
  active: '●',
  expired: '✗',
  superseded: '→',
  revoked: '✗',
  draft: '○',
};

export async function runAdrList(opts: AdrListOptions): Promise<number> {
  const decisionsDir = resolve(opts.decisions);
  const adrs = loadArchDecisions(decisionsDir);

  if (adrs.length === 0) {
    console.log(pc.yellow('No ArchDecision files found in ' + decisionsDir));
    return 0;
  }

  applyExpiryTransitions(adrs);

  console.log(pc.bold('\nFolio — ArchDecision Status'));
  console.log(pc.dim(`Directory: ${decisionsDir}`));
  console.log('');

  // Sort: expired/revoked first, then active, then draft/superseded
  const sortedAdrs = [...adrs].sort((a, b) => {
    const order = ['expired', 'revoked', 'active', 'draft', 'superseded'];
    const aStatus = a._effectiveStatus ?? a.spec.status;
    const bStatus = b._effectiveStatus ?? b.spec.status;
    return order.indexOf(aStatus) - order.indexOf(bStatus);
  });

  for (const adr of sortedAdrs) {
    renderAdrRow(adr);
  }

  console.log('');
  return 0;
}

export async function runAdrStatus(opts: AdrStatusOptions): Promise<number> {
  const decisionsDir = resolve(opts.decisions);
  const adrs = loadArchDecisions(decisionsDir);
  applyExpiryTransitions(adrs);

  const adr = adrs.find((a) => a.metadata.name === opts.name);

  if (!adr) {
    console.error(pc.red(`ADR '${opts.name}' not found in ${decisionsDir}`));
    return 2;
  }

  const effectiveStatus = adr._effectiveStatus ?? adr.spec.status;
  const colorFn = STATUS_COLORS[effectiveStatus] ?? pc.white;
  const icon = STATUS_ICONS[effectiveStatus] ?? '·';

  console.log('');
  console.log(pc.bold(`${adr.metadata.name} — ${adr.spec.title}`));
  console.log(pc.dim('─'.repeat(60)));
  console.log(`Status:     ${colorFn(`${icon} ${effectiveStatus.toUpperCase()}`)}`);
  console.log(`Component:  ${adr.spec.component}`);
  console.log(`Constraints: ${adr.spec.constraints.join(', ')}`);
  console.log(`Owner:      ${adr.spec.owner}`);
  console.log(`Approver:   ${adr.spec.approver}`);
  console.log(`Created:    ${adr.metadata.created}`);
  console.log(`Expires:    ${adr.spec.expires}`);

  if (effectiveStatus === 'active') {
    const daysLeft = daysUntil(adr.spec.expires);
    if (daysLeft <= 30) {
      console.log(pc.yellow(`            ⚠ Expires in ${daysLeft} day(s)`));
    }
  }

  if (adr.spec.status === 'expired' || effectiveStatus === 'expired') {
    console.log(pc.red(`            ✗ Expired ${daysSince(adr.spec.expires)} day(s) ago`));
  }

  if (adr.spec.superseded_by) {
    console.log(`Superseded by: ${adr.spec.superseded_by}`);
  }

  if (adr.spec.revoked_reason) {
    console.log(`Revoked:    ${adr.spec.revoked_reason}`);
  }

  console.log('');
  console.log(pc.bold('Decision:'));
  console.log(`  ${adr.spec.decision.trim()}`);
  console.log('');
  console.log(pc.bold('Rationale:'));
  console.log(`  ${adr.spec.rationale.trim()}`);

  if (adr.spec.consequences) {
    console.log('');
    console.log(pc.bold('Consequences:'));
    console.log(`  ${adr.spec.consequences.trim()}`);
  }

  if (adr.spec.links && adr.spec.links.length > 0) {
    console.log('');
    console.log(pc.bold('Links:'));
    for (const link of adr.spec.links) {
      console.log(`  ${pc.dim(link)}`);
    }
  }

  console.log('');

  return effectiveStatus === 'expired' || effectiveStatus === 'revoked' ? 1 : 0;
}

function renderAdrRow(adr: ArchDecision): void {
  const effectiveStatus = adr._effectiveStatus ?? adr.spec.status;
  const colorFn = STATUS_COLORS[effectiveStatus] ?? pc.white;
  const icon = STATUS_ICONS[effectiveStatus] ?? '·';

  const nameCol = adr.metadata.name.padEnd(12);
  const statusCol = colorFn(`${icon} ${effectiveStatus.padEnd(10)}`);
  const componentCol = adr.spec.component.padEnd(25);

  let expiry = adr.spec.expires;
  if (effectiveStatus === 'active') {
    const days = daysUntil(expiry);
    if (days <= 30) {
      expiry = pc.yellow(`${expiry} (${days}d left)`);
    } else {
      expiry = pc.dim(expiry);
    }
  } else if (effectiveStatus === 'expired') {
    expiry = pc.red(expiry);
  } else {
    expiry = pc.dim(expiry);
  }

  console.log(`  ${nameCol} ${statusCol} ${componentCol} ${expiry}`);
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((target.getTime() - now.getTime()) / msPerDay);
}

function daysSince(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.abs(Math.floor((now.getTime() - target.getTime()) / msPerDay));
}
