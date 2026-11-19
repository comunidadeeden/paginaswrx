/* First content gets a paint opportunity before third-party measurement starts.
   dataLayer events and operational requests remain in their original runtime. */
(function(w,d){
  'use strict';
  let ready=false;
  const waiting=[];
  function flush(){
    if(ready)return;
    ready=true;
    for(const callback of waiting.splice(0)){
      try{callback();}catch(error){w.setTimeout(function(){throw error;},0);}
    }
  }
  function painted(){w.requestAnimationFrame(function(){w.requestAnimationFrame(flush);});}
  function contentReady(){
    const hero=d.querySelector('#quiz-root img[fetchpriority="high"]');
    if(!hero||hero.complete){painted();return;}
    hero.addEventListener('load',painted,{once:true});
    hero.addEventListener('error',painted,{once:true});
  }
  w.RXBoot={afterPaint:function(callback){if(ready)callback();else waiting.push(callback);},isReady:function(){return ready;}};
  // Guarantees page measurement even without interaction, and in hidden tabs.
  w.setTimeout(flush,1200);
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',contentReady,{once:true});else contentReady();
  w.addEventListener('pointerdown',flush,{once:true,capture:true,passive:true});
  w.addEventListener('keydown',flush,{once:true,capture:true});
  w.addEventListener('pagehide',flush,{once:true});
})(window,document);

/* UI draft only. Never represents an acknowledged lead or operational save. */
(function(w){
  'use strict';
  const version='rx03-prelead-20261027',ttl=21600000;
  function key(session,test){return version+':'+(test?'test:':'live:')+session;}
  function normalize(value,steps){
    if(!value||!Array.isArray(value.completedSteps)||value.completedSteps.length<1||value.completedSteps.length>2)return null;
    const count=value.completedSteps.length,indexes={};
    for(let i=0;i<count;i++){
      const step=steps[i],index=value.answerIndexes?.[step?.id];
      if(!step||value.completedSteps[i]!==step.id||!Number.isInteger(index)||index<0||index>=step.options.length)return null;
      indexes[step.id]=index;
    }
    if(value.stepIndex!==count)return null;
    return {screen:count===2?'lead':'step',stepIndex:count,completedSteps:value.completedSteps.slice(),answerIndexes:indexes};
  }
  function clear(session,test){try{w.sessionStorage.removeItem(key(session,test));}catch(_){} }
  function read(session,test,steps){
    try{
      const raw=JSON.parse(w.sessionStorage.getItem(key(session,test))||'null');
      if(!raw||raw.version!==version||!Number.isFinite(raw.saved_at)||Date.now()-raw.saved_at<0||Date.now()-raw.saved_at>=ttl){clear(session,test);return null;}
      const draft=normalize(raw,steps);if(!draft)clear(session,test);return draft;
    }catch(_){return null;}
  }
  function save(session,test,state,steps){
    if(state.leadSaved===true){clear(session,test);return;}
    const draft=normalize(state,steps);if(!draft)return;
    try{w.sessionStorage.setItem(key(session,test),JSON.stringify({...draft,version:version,saved_at:Date.now()}));}catch(_){}
  }
  w.RX03Draft={read:read,save:save,clear:clear};
})(window);
