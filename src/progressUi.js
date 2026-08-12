import { levels } from './levels.js';

const SAVE_KEY='one-move-puzzle-save-v3';
const LEGACY_KEY='one-move-puzzle-save-v2';
const TOTAL=levels.length;
const $=selector=>document.querySelector(selector);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const pad=value=>String(value).padStart(2,'0');

function parse(key){
  try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}
}

function contiguousProgress(raw={}){
  let cleared=0;
  for(const level of levels){
    if(Number(raw.stars?.[level.id]||0)<=0)break;
    cleared+=1;
  }
  return{cleared,unlocked:clamp(cleared+1,1,TOTAL)};
}

function readProgress(){
  return contiguousProgress(parse(SAVE_KEY)||parse(LEGACY_KEY)||{});
}

function nextUnsolvedLevel(){
  const {cleared}=readProgress();
  return cleared>=TOTAL?TOTAL:cleared+1;
}

function syncCampaign(){
  const {unlocked,cleared}=readProgress();
  const current=cleared>=TOTAL?TOTAL:nextUnsolvedLevel();
  const currentNode=$('#campaignCurrent');
  const totalNode=$('#campaignTotal');
  const continueLabel=$('#continueLabel');
  const levelMeta=$('#levelCountMeta');
  const rail=$('#campaignRail');

  if(currentNode)currentNode.textContent=pad(current);
  if(totalNode)totalNode.textContent=String(TOTAL);
  if(continueLabel)continueLabel.textContent=cleared>=TOTAL?'ALL 12 PUZZLES CLEARED':`LEVEL ${pad(current)} OF ${TOTAL}`;
  if(levelMeta)levelMeta.textContent=`${TOTAL} LEVELS · ${unlocked} UNLOCKED`;

  if(rail){
    const signature=`${unlocked}:${cleared}:${current}`;
    if(rail.dataset.signature!==signature){
      rail.dataset.signature=signature;
      rail.innerHTML=Array.from({length:TOTAL},(_,index)=>{
        const number=index+1;
        const cls=number<=cleared?'cleared':number===current?'current':number<=unlocked?'unlocked':'locked';
        return `<i class="${cls}" title="Level ${pad(number)}"></i>`;
      }).join('');
    }
  }
}

function syncResultButton(){
  const sheet=$('#resultSheet');
  const button=$('#nextBtn');
  if(!sheet||sheet.hidden||!button)return;
  const title=($('#resultTitle')?.textContent||'').trim();
  const failed=/wrong/i.test(title)||$('#resultBadge')?.classList.contains('fail');
  if(failed)return;

  const match=($('#levelNumber')?.textContent||'').match(/(\d+)/);
  const current=clamp(Number(match?.[1]||1),1,TOTAL);
  const {cleared}=readProgress();
  const span=button.querySelector('span');
  const small=button.querySelector('small');

  if(cleared>=TOTAL&&current>=TOTAL){
    if(span)span.textContent='WORKSHOP';
    if(small)small.textContent='ALL 12 PUZZLES';
    return;
  }

  const next=clamp(current+1,1,TOTAL);
  if(span)span.textContent=`NEXT · LEVEL ${pad(next)}`;
  if(small)small.textContent=`${pad(next)} / ${TOTAL} · KEEP GOING`;
}

function sync(){syncCampaign();syncResultButton();}
let queued=false;
function queueSync(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});}

const observer=new MutationObserver(queueSync);
observer.observe(document.querySelector('#app')||document.body,{subtree:true,childList:true,attributes:true,characterData:true,attributeFilter:['hidden','class']});
window.addEventListener('storage',event=>{if([SAVE_KEY,LEGACY_KEY].includes(event.key))queueSync();});
window.addEventListener('pageshow',queueSync);
queueSync();
