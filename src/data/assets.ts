import type { Scenario } from '../types';

export type AssetType = 'Laptop' | 'Desktop' | 'Dock' | 'Monitor' | 'Phone' | 'Power adapter';
export type AssetStatus = 'In use' | 'In stock' | 'Loaned' | 'In repair';

export interface Asset {
  tag: string;
  type: AssetType;
  model: string;
  assignedTo: string;
  status: AssetStatus;
  warrantyEnd: string;
  hostname?: string;
  scenarioId?: string;
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const warranty = (seed: string) => {
  const h = Math.abs(hash(seed));
  return `${2025 + (h % 4)}-${String(1 + (h % 12)).padStart(2, '0')}-${String(1 + (h % 27)).padStart(2, '0')}`;
};

const STOCK: Asset[] = [
  { tag: 'LN-0410', type: 'Laptop', model: 'Standard Laptop L14 (Gen 3)', assignedTo: 'Loaner pool', status: 'Loaned', warrantyEnd: '2027-03-14' },
  { tag: 'LN-0411', type: 'Laptop', model: 'Standard Laptop L14 (Gen 3)', assignedTo: 'Loaner pool', status: 'In repair', warrantyEnd: '2027-03-14' },
  { tag: 'LN-0412', type: 'Laptop', model: 'Standard Laptop L14 (Gen 3)', assignedTo: 'Loaner pool', status: 'In stock', warrantyEnd: '2027-06-02' },
  { tag: 'LN-0413', type: 'Laptop', model: 'Standard Laptop L14 (Gen 4)', assignedTo: 'Loaner pool', status: 'In stock', warrantyEnd: '2028-01-20' },
  { tag: 'PA-65W-x6', type: 'Power adapter', model: '65 W USB-C adapter (6 in stock)', assignedTo: 'Service desk stock', status: 'In stock', warrantyEnd: '–' },
  { tag: 'DK-D3-x2', type: 'Dock', model: 'USB-C Dock D3 (2 in stock)', assignedTo: 'Service desk stock', status: 'In stock', warrantyEnd: '–' },
  { tag: 'MN-27-x3', type: 'Monitor', model: '27" monitor (3 in stock)', assignedTo: 'Service desk stock', status: 'In stock', warrantyEnd: '–' },
];

/** Every managed asset: one device per ticket user, docks and phones where the ticket mentions them, plus stock. */
export function allAssets(scenarios: Scenario[]): Asset[] {
  const seen = new Set<string>();
  const out: Asset[] = [];
  for (const sc of scenarios) {
    const d = sc.device;
    if (seen.has(d.hostname)) continue;
    seen.add(d.hostname);
    const owner = sc.accountOwner?.name ?? sc.requester.name;
    const desktop = /Desktop/i.test(d.model) || d.hostname.includes('-DT-');
    out.push({
      tag: `AT-${d.hostname.replace(/\D/g, '').padStart(4, '0')}`,
      type: desktop ? 'Desktop' : 'Laptop',
      model: d.model,
      assignedTo: owner,
      status: 'In use',
      warrantyEnd: warranty(d.hostname),
      hostname: d.hostname,
      scenarioId: sc.id,
    });
    if ((d.installedNotes ?? []).some((n) => /dock/i.test(n)))
      out.push({ tag: `DK-${d.hostname.slice(-4)}`, type: 'Dock', model: 'USB-C Dock D3', assignedTo: owner, status: 'In use', warrantyEnd: warranty(`dock${d.hostname}`), scenarioId: sc.id });
    if (/phone|mfa|authenticator|mobile/i.test(`${sc.title} ${sc.description}`))
      out.push({ tag: `MB-${d.hostname.slice(-4)}`, type: 'Phone', model: 'Company smartphone', assignedTo: owner, status: 'In use', warrantyEnd: warranty(`ph${d.hostname}`), scenarioId: sc.id });
  }
  return [...out.sort((a, b) => a.assignedTo.localeCompare(b.assignedTo)), ...STOCK];
}
