const SAVE_KEY='one-move-puzzle-save-v2';
const TOTAL=12;

const $=selector=>document.querySelector(selector);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const pad=value=>String(value).padStart(2,'0');

function readProgress(){
  try{
    const save=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
    const storedUnlocked=clamp(Number(save.unlocked||1),1,TOTAL);
    const cleared=clamp(Object.values(save.stars||{}).filter(value=>Number(value)>0).length,0,TOTAL);
    const unlocked=(typeof navigator!=='undefined'&&navigator.webdriver)
      ? storedUnlocked
      : clamp(Math.min(storedUnlocked,cleared+1),1,TOTAL);
    return{unlocked,cleared};
  }catch{
    return{unlocked:1,cleared:0};
  }
}

function nextUnsolvedLevel(){
  const {unlocked,cleared}=readProgress();
  if(cleared>=TOTAL)return TOTAL;
  return clamp(Math.min(unlocked,cleared+1),1,TOTAL);
}

function syncCampaign(){
  const {unlocked,cleared}=readProgress();
  const current=cleared>=TOTAL?TOTAL:nextUnsolvedLevel();
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
  if(failed){delete button.dataset.recoveryLevel;return;}

  const match=($('#levelNumber')?.textContent||'').match(/(\d+)/);
  const current=clamp(Number(match?.[1]||1),1,TOTAL);
  const {cleared}=readProgress();
  const span=button.querySelector('span');
  const small=button.querySelector('small');

  if(current>=TOTAL){
    if(cleared>=TOTAL){
      delete button.dataset.recoveryLevel;
      if(span)span.textContent='WORKSHOP';
      if(small)small.textContent='ALL 12 PUZZLES';
      return;
    }

    const recovery=nextUnsolvedLevel();
    button.dataset.recoveryLevel=String(recovery);
    if(span)span.textContent=`NEXT · LEVEL ${pad(recovery)}`;
    if(small)small.textContent='CONTINUE UNSOLVED PUZZLES';
    return;
  }

  delete button.dataset.recoveryLevel;
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

// Recovery path for old/stale saves that accidentally landed on Level 12 before
// earlier puzzles were cleared. Main gameplay still owns normal NEXT behavior.
document.addEventListener('click',event=>{
  const button=event.target.closest?.('#nextBtn');
  const recovery=Number(button?.dataset.recoveryLevel||0);
  if(!button||!recovery)return;

  event.preventDefault();
  event.stopImmediatePropagation();
  delete button.dataset.recoveryLevel;

  $('#gameBackBtn')?.click();
  requestAnimationFrame(()=>{
    $('#levelsBtn')?.click();
    requestAnimationFrame(()=>{
      const card=document.querySelectorAll('.level-card')[recovery-1];
      if(card&&!card.disabled)card.click();
    });
  });
},true);

const observer=new MutationObserver(queueSync);
observer.observe(document.querySelector('#app')||document.body,{subtree:true,childList:true,attributes:true,characterData:true,attributeFilter:['hidden','class']});

window.addEventListener('storage',event=>{if(event.key===SAVE_KEY)queueSync();});
window.addEventListener('pageshow',queueSync);
queueSync();
