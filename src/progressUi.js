const SAVE_KEY='one-move-puzzle-save-v2';
const TOTAL=12;

const $=selector=>document.querySelector(selector);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const pad=value=>String(value).padStart(2,'0');

function readProgress(){
  try{
    const save=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
    const unlocked=clamp(Number(save.unlocked||1),1,TOTAL);
    const cleared=Object.values(save.stars||{}).filter(value=>Number(value)>0).length;
    return{unlocked,cleared:clamp(cleared,0,TOTAL)};
  }catch{
    return{unlocked:1,cleared:0};
  }
}

function syncCampaign(){
  const {unlocked,cleared}=readProgress();
  const current=cleared>=TOTAL?TOTAL:unlocked;
  const currentNode=$('#campaignCurrent');
  const totalNode=$('#campaignTotal');
  const continueLabel=$('#continueLabel');
  const levelMeta=$('#levelCountMeta');
  const rail=$('#campaignRail');

  if(currentNode&&currentNode.textContent!==pad(current))currentNode.textContent=pad(current);
  if(totalNode&&totalNode.textContent!==String(TOTAL))totalNode.textContent=String(TOTAL);

  const continueCopy=cleared>=TOTAL?'ALL 12 PUZZLES CLEARED':`LEVEL ${pad(current)} OF ${TOTAL}`;
  if(continueLabel&&continueLabel.textContent!==continueCopy)continueLabel.textContent=continueCopy;

  const unlockedCopy=`${TOTAL} LEVELS · ${unlocked} UNLOCKED`;
  if(levelMeta&&levelMeta.textContent!==unlockedCopy)levelMeta.textContent=unlockedCopy;

  if(rail){
    const signature=`${unlocked}:${cleared}`;
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
  const span=button.querySelector('span');
  const small=button.querySelector('small');

  if(current>=TOTAL){
    if(span)span.textContent='WORKSHOP';
    if(small)small.textContent='ALL 12 PUZZLES';
    return;
  }

  const next=current+1;
  if(span)span.textContent=`NEXT · LEVEL ${pad(next)}`;
  if(small)small.textContent=`${pad(next)} / ${TOTAL} · KEEP GOING`;
}

function sync(){
  syncCampaign();
  syncResultButton();
}

let queued=false;
function queueSync(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;sync();});
}

const observer=new MutationObserver(queueSync);
observer.observe(document.querySelector('#app')||document.body,{subtree:true,childList:true,attributes:true,characterData:true,attributeFilter:['hidden','class']});

window.addEventListener('storage',event=>{if(event.key===SAVE_KEY)queueSync();});
window.addEventListener('pageshow',queueSync);
queueSync();
