import { getMachineLogic } from './machineLogic.js';
import { mountWorkshopRuntime } from './workshopRuntime.js';
import { mountSignalMatchRuntime } from './signalMatchRuntime.js';
import { mountMazeRuntime } from './mazeRuntime.js';

export function mountMachineRuntime(options) {
  const logic = getMachineLogic(options.level.id);
  if (logic?.archetype === 'maze-one-turn') return mountMazeRuntime(options);
  if (logic?.archetype === 'signal-match') return mountSignalMatchRuntime(options);
  return mountWorkshopRuntime(options);
}
