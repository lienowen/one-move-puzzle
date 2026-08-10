import { getMachineLogic } from './machineLogic.js';
import { mountWorkshopRuntime } from './workshopRuntime.js';
import { mountSignalMatchRuntime } from './signalMatchRuntime.js';
import { mountMazePuzzleRuntime } from './mazePuzzleRuntime.js';
import { mountMazeVectorRuntime } from './mazeVectorRuntime.js';
import { mountMazeSlideRuntime } from './mazeSlideRuntime.js';

export function mountMachineRuntime(options) {
  const logic = getMachineLogic(options.level.id);
  if (logic?.maze?.mode === 'slide-row') return mountMazeSlideRuntime(options);
  if (logic?.maze?.mode === 'vector') return mountMazeVectorRuntime(options);
  if (logic?.maze) return mountMazePuzzleRuntime(options);
  if (logic?.archetype === 'signal-match') return mountSignalMatchRuntime(options);
  return mountWorkshopRuntime(options);
}
