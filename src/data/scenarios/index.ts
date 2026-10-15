import type { Scenario } from '../../types';
import { accountScenarios } from './accounts';
import { networkScenarios } from './network';
import { hardwareScenarios } from './hardware';
import { softwareScenarios } from './software';
import { emailScenarios, securityScenarios } from './email-security';

export const BUILTIN_SCENARIOS: Scenario[] = [
  ...accountScenarios,
  ...networkScenarios,
  ...hardwareScenarios,
  ...softwareScenarios,
  ...emailScenarios,
  ...securityScenarios,
];

export function allScenarios(custom: Scenario[] = []): Scenario[] {
  return [...BUILTIN_SCENARIOS, ...custom];
}

export function findScenario(id: string, custom: Scenario[] = []): Scenario | undefined {
  return allScenarios(custom).find((s) => s.id === id);
}
