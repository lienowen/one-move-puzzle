import { getMachineLogic } from './machineLogic.js';
import { mountWorkshopRuntime } from './workshopRuntime.js';
import { mountSignalMatchRuntime } from './signalMatchRuntime.js';
import { mountMazePuzzleRuntime } from './mazePuzzleRuntime.js';
import { mountMazeVectorRuntime } from './mazeVectorRuntime.js';
import { mountMazeSlideRuntime } from './mazeSlideRuntime.js';
import { mountMazeMagnetRuntime } from './mazeMagnetRuntime.js';

function applyMazeHint(logic) {
  const hint=document.querySelector('#levelHint');
  if(!hint||!logic?.maze)return;
  const mode=logic.maze.mode;
  if(mode==='vector') hint.textContent='Aim the spring once. Predict the flight before you commit.';
  else if(mode==='slide-row') hint.textContent='Slide the whole rail row exactly once.';
  else if(mode==='magnet-field') hint.textContent='Turn the magnetic field once. Predict the steel ball path.';
  else if((logic.maze.rotators||[]).length>1) hint.textContent='Only one tile should change. Trace both choices first.';
  else hint.textContent='Rotate one tile once. Trace the full route first.';
}

export function mountMachineRuntime(options) {
  const logic=getMachineLogic(options.level.id);
  applyMazeHint(logic);
  if(logic?.maze?.mode==='magnet-field')return mountMazeMagnetRuntime(options);
  if(logic?.maze?.mode==='slide-row')return mountMazeSlideRuntime(options);
  if(logic?.maze?.mode==='vector')return mountMazeVectorRuntime(options);
  if(logic?.maze)return mountMazePuzzleRuntime(options);
  if(logic?.archetype==='signal-match')return mountSignalMatchRuntime(options);
  return mountWorkshopRuntime(options);
}
