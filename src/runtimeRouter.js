import { getMachineLogic } from './machineLogic.js';
import { mountWorkshopRuntime } from './workshopRuntime.js';
import { mountSignalMatchRuntime } from './signalMatchRuntime.js';
import { mountMazePuzzleRuntime } from './mazePuzzleRuntime.js';

export function mountMachineRuntime(options) {
  const logic = getMachineLogic(options.level.id);
  if (logic?.maze) return mountMazePuzzleRuntime(options);
  if (logic?.archetype === 'signal-match') return mountSignalMatchRuntime(options);
  return mountWorkshopRuntime(options);
}
