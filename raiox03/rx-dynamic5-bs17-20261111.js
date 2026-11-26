/* RX delivery v2: Supabase principal; conserva IDs, tokens e contrato nativo. */
(function(w){if(w.RXContingency)return;const native=w.fetch.bind(w);w.RXContingency={fetch:(url,options)=>native(url,options)};})(window);

/* SOURCE: rx-config.js */
/* Configuração pública: NUNCA coloque senhas, Hottok ou service_role aqui. */
window.RX_CONFIG = {
  version: "raiox-v3.0", // Protocolo mantido: compatível com o workflow V3 já importado.
  pageBuild: "2026-10-07-raiox03-bs13out-tracking-v1",
  resumeSession: true, // Mesma aba, até 6 horas; sem nome/email/telefone no armazenamento local.
  sessionMaxAgeMs: 21600000,
  correlateCheckout: true, // Acrescenta marcador opaco ao sck, sem dados pessoais.
    heartbeatSeconds: 120, // Somente com medição opcional autorizada.
  webhookUrl: "https://nklqcamhkwqictdmictb.supabase.co/functions/v1/raiox03-collect",
  gtmId: "",
  testMode: false, // Produção. Use ?rx_test=1 para homologar sem gravar leads reais.
  source: "quiz_raiox03",
  launch: "raiox03_2026_10", // Contrato direto do Supabase. Não alterar sem atualizar a função de ingestão.
  campaignTag: "BS17NOV2026", // Tag comercial da Semana 17 cadastrada no Dash (20 a 26/10/2026).
  privacyPolicyUrl: "", // Insira a política real do controlador antes de publicar.
  consentVersion: "rx02-2026-09-29",
  enableVkAfterConsent: true,
  webhookTimeoutMs: 12000,
  maxRetries: 2
};

// Homologação opcional sem editar código. ?rx_test=1 isola dados e bloqueia GA4/Meta/VK.
if (new URLSearchParams(window.location.search).get("rx_test") === "1") window.RX_CONFIG.testMode = true;
;

/* SOURCE: rx-tracking.js */
/* Raio-X: coleta própria separada do dataLayer; nenhuma chave de banco no navegador. */
(function (w, d) {
  'use strict';
  // RX4: mantém a API RX do site salvo; troca somente o contrato/transporte.
  const oldConfig=w.RX_CONFIG||{};
  const cfg=w.RX_CONFIG={...oldConfig,version:'raiox-direct-v4.5-dynamic5',pageBuild:'raiox03-dynamic5-20261104',entryVariant:'lead_first_dynamic5_v1',flowVersion:'raiox03-dynamic5-v1',
    webhookUrl:'https://nklqcamhkwqictdmictb.supabase.co/functions/v1/raiox03-collect',
    source:'quiz_raiox03',launch:'raiox03_2026_10',resumeSession:oldConfig.resumeSession!==false,
    testMode:oldConfig.testMode===true||new URLSearchParams(w.location.search).get('rx_test')==='1',
    consentVersion:oldConfig.consentVersion||'rx03-2026-10-07',maxRetries:2,webhookTimeoutMs:18000};
  if(w.__RX_DIRECT_V4_INSTALLED)throw new Error('rx_tracking_loaded_twice');
  w.__RX_DIRECT_V4_INSTALLED=true;
  const expectedSteps=["situation","context_situation_v1","context_interest_v1","learning_support_v1","context_consequence_v1"];
  const expectedQuestions=["situation","context_situation_v1","context_interest_v1","learning_support_v1","context_consequence_v1"];
  let registeredSteps=null,lastDeliveryError=null;
  function registerSteps(steps){
    if(!Array.isArray(steps)||steps.length!==5||steps.some((s,i)=>s?.id!==expectedSteps[i]))throw new Error('quiz_catalog_incompatible');
    for(const s of steps){if(expectedQuestions.includes(s.id)&&(!Array.isArray(s.options)||s.options.length!==4||
      s.options.some(o=>typeof o?.label!=='string'||!o.label.trim()||o.label.length>500)))throw new Error('quiz_catalog_incompatible');}
    registeredSteps=steps;return true;
  }
  function getSteps(){
    if(registeredSteps)return registeredSteps;
    try{if(typeof STEPS!=='undefined')registerSteps(STEPS);}catch(e){if(e.message==='quiz_catalog_incompatible')throw e;}
    if(!registeredSteps&&Array.isArray(w.RX_QUIZ_CATALOG))registerSteps(w.RX_QUIZ_CATALOG);
    if(!registeredSteps)throw new Error('quiz_catalog_not_available');return registeredSteps;
  }
  function answerRecord(id,index,supplied){
    if(!expectedQuestions.includes(id)||!Number.isInteger(index)||index<0||index>3)throw new Error('invalid_answer');
    const option=getSteps().find(s=>s.id===id).options[index];
    if(supplied?.answer_label!=null&&supplied.answer_label!==option.label)throw new Error('answer_label_mismatch');
    return {question_id:id,option_index:index,answer_label:option.label,...(option.profile?{selected_profile:option.profile}:{})};
  }
  function normalizeProgress(name,details){
    const v={...details};
    if(name==='quiz_answer')Object.assign(v,answerRecord(v.question_id,v.option_index,v));
    if(name==='quiz_complete'){
      const raw=v.answers;if(!raw||typeof raw!=='object')throw new Error('answers_snapshot_required');
      if(Array.isArray(raw)){
        if(raw.length!==5||new Set(raw.map(x=>x?.question_id)).size!==5)throw new Error('incomplete_snapshot');
        v.answers=expectedQuestions.map(id=>{const a=raw.find(x=>x?.question_id===id);if(!a)throw new Error('incomplete_snapshot');return answerRecord(id,a.option_index,a);});
      }else{
        if(Object.keys(raw).length!==5||expectedQuestions.some(id=>!Object.prototype.hasOwnProperty.call(raw,id)))throw new Error('incomplete_snapshot');
        v.answers=expectedQuestions.map(id=>answerRecord(id,raw[id]));
      }
    }
    if(name==='quiz_answer'||name==='quiz_complete'){
      const a=v.completed_steps;
      if(!Array.isArray(a)||!a.length||a.length>5||a.some((id,i)=>id!==expectedSteps[i])||
        (name==='quiz_complete'&&a.length!==5)||(name==='quiz_answer'&&a[a.length-1]!==v.question_id))throw new Error('invalid_step_snapshot');
    }
    if(name==='quiz_insight_continue'&&!['insight_precision','insight_signals','insight_ready'].includes(v.step_id))throw new Error('invalid_step');
    return v;
  }
  function reportError(e,p){
    lastDeliveryError={code:String(e?.message||'delivery_failed').slice(0,100),status:Number(e?.status)||null,event_name:p.event_name,event_id:p.event_id};
    w.dispatchEvent(new CustomEvent('rx:delivery-error',{detail:{...lastDeliveryError}}));
  }
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16); });
  const storageKey='rx03_runtime_dynamic5_v1_'+cfg.launch+'_'+(cfg.testMode?'test':'prod');
  const validId=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  let saved=null;
  try {
    const x=JSON.parse(sessionStorage.getItem(storageKey)||'null');
    if(cfg.resumeSession && x && x.version===cfg.version && validId(x.session_id) && validId(x.client_key)
      && Number.isFinite(x.saved_at) && Date.now()-x.saved_at>=0 && Date.now()-x.saved_at<(cfg.sessionMaxAgeMs||21600000)
      && (validId(x.session_token) || (x.session_token === null && Array.isArray(x.pending_outbox) && x.pending_outbox.some(p=>p?.sequence===1&&p.event_name==='page_view'&&p.session_id===x.session_id))) && Number.isInteger(x.sequence) && x.sequence>=1 && x.sequence<1000000) saved=x;
    else sessionStorage.removeItem(storageKey);
  } catch(_) {}
  const sessionId=saved?.session_id||uid(), clientKey=saved?.client_key||uid(), openedAt=saved?.opened_at||new Date().toISOString();
  let token=validId(saved?.session_token)?saved.session_token:null, seq=saved?.sequence||0,
    checkpoint=saved?.checkpoint||null, latestStatus=null,
    context={screen:'opening',step_index:0}, queue=Promise.resolve(), consentListeners=[];
  // Tab-scoped delivery journal: survives a reload; expires with the existing six-hour session.
  // The form already stores checkout prefill in this same tab. No PII goes to dataLayer.
  const recoveryEntries = Array.isArray(saved?.pending_outbox) ? saved.pending_outbox.filter(p=>
    p && p.session_id===sessionId && p.client_key===clientKey && p.source===cfg.source && p.lancamento===cfg.launch &&
    p.test_mode===(cfg.testMode===true) && validId(p.event_id) && Number.isInteger(p.sequence) && p.sequence>=1 &&
    ['page_view','lead_submit','quiz_answer','quiz_insight_continue','quiz_complete'].includes(p.event_name)).slice(0,64) : [];
  const deliveryJournal = new Map(recoveryEntries.map(p=>[p.event_id,p]));
  function journal(p){
    if(!['page_view','lead_submit','quiz_answer','quiz_insight_continue','quiz_complete'].includes(p.event_name))return;
    deliveryJournal.set(p.event_id,p);persistRuntime();
  }
  function persistRuntime(){
    if(!cfg.resumeSession)return;
    try{sessionStorage.setItem(storageKey,JSON.stringify({version:cfg.version,session_id:sessionId,client_key:clientKey,
      session_token:token,sequence:seq,opened_at:openedAt,saved_at:Date.now(),checkpoint,pending_outbox:[...deliveryJournal.values()],attribution:storedAttribution()}));}catch(_){}
  }
  function saveCheckpoint(value){
    // Never persist PII, arbitrary payloads or URLs. Only acknowledged quiz state.
    const ids=["situation","context_situation_v1","context_interest_v1","learning_support_v1","context_consequence_v1"];
    const qs=["situation","context_situation_v1","context_interest_v1","learning_support_v1","context_consequence_v1"];
    if(!value || value.leadSaved!==true || !['step','loading','result'].includes(value.screen))return;
    const completed=value.completedSteps;
    if(!Array.isArray(completed)||completed.length>5||completed.some((id,i)=>id!==ids[i]))return;
    const indexes={}; for(const q of qs){const i=value.answerIndexes?.[q];if(Number.isInteger(i)&&i>=0&&i<=3)indexes[q]=i;}
    checkpoint={screen:value.screen,stepIndex:Math.min(5,Math.max(0,Number(value.stepIndex)||0)),leadSaved:true,
      completedSteps:completed.slice(),answerIndexes:indexes,resultViewed:value.resultViewed===true,checkoutClicked:value.checkoutClicked===true};
    persistRuntime();
  }
  function getCheckpoint(){
    const x=checkpoint,ids=["situation","context_situation_v1","context_interest_v1","learning_support_v1","context_consequence_v1"];
    if(!token||!x||x.leadSaved!==true||!['step','loading','result'].includes(x.screen)
      ||!Array.isArray(x.completedSteps)||x.completedSteps.length>5||x.completedSteps.some((id,i)=>id!==ids[i])
      ||!x.answerIndexes||typeof x.answerIndexes!=='object'||Array.isArray(x.answerIndexes))return null;
    const indexes={};
    for(const q of ["situation","context_situation_v1","context_interest_v1","learning_support_v1","context_consequence_v1"]){
      const n=x.answerIndexes[q];if(n!=null){if(!Number.isInteger(n)||n<0||n>3)return null;indexes[q]=n;}
    }
    return {screen:x.screen,stepIndex:x.completedSteps.length,leadSaved:true,completedSteps:x.completedSteps.slice(),
      answerIndexes:indexes,resultViewed:x.resultViewed===true,checkoutClicked:x.checkoutClicked===true};
  }

  // Site configuration on the new domain; never records a visitor's consent action.
  const automaticTracking=/^(?:www\.)?eventoraioxhumano\.com$/i.test(w.location.hostname);
  let consent={analytics:automaticTracking&&!cfg.testMode,advertising:automaticTracking&&!cfg.testMode,marketing_contact:false,decided:false};
  try { const old=JSON.parse(localStorage.getItem('rx03_consent_v1')||'null'); if(old && old.version===cfg.consentVersion && Date.now()-old.saved_at<180*864e5) consent={...consent,...old.choices}; localStorage.removeItem('raiox03_lead'); } catch (_) {}
  const incoming=new URLSearchParams(w.location.search);
  const utmKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','utm_adset','utm_ad','src','sck','meta_campaign_id','meta_campaign_name','meta_adset_id','meta_adset_name','meta_ad_id','meta_ad_name','meta_creative_id','meta_creative_name','vk_source','vk_ad_id','creative_code','meta_platform','meta_placement'];
  const clickKeys=['fbclid','gclid','gbraid','wbraid','ttclid','msclkid'];
  const safeText=v => {v=String(v||'').trim(); return v.length>250 || /@|(?:\+?\d[\s().-]*){10,}/.test(v) ? null:v;};
  const attribution={};
  // Keep the campaign for this six-hour session when a return URL has no campaign.
  const newCampaign=['utm_source','utm_medium','utm_campaign','utm_id',...clickKeys].some(k=>incoming.has(k));
  const validCampaignValue=v=>typeof v==='string' && v.length>0 && v.length<=250 && !v.includes('@');
  if(!newCampaign && saved?.attribution)utmKeys.concat(clickKeys).forEach(k=>{
    const v=saved.attribution[k];if(validCampaignValue(v))attribution[k]=v;
  });
  utmKeys.concat(clickKeys).forEach(k=>{const v=incoming.get(k);if(validCampaignValue(v))attribution[k]=v;});
  function storedAttribution(){
    const a={};utmKeys.forEach(k=>{if(attribution[k])a[k]=attribution[k];});
    if(consent.advertising)clickKeys.forEach(k=>{if(attribution[k])a[k]=attribution[k];});
    return a;
  }
  function safeUrl(v) {try {const u=new URL(v,w.location.href); return /^(http:|https:)$/.test(u.protocol)?u.origin+u.pathname:'';}catch(_){return '';}}
  function cookie(name) {const match=d.cookie.split('; ').find(c=>c.startsWith(name+'='));return match?decodeURIComponent(match.slice(name.length+1)):null;}
  function currentAttribution() {
    const a={};
    utmKeys.forEach(k=>{if(attribution[k])a[k]=attribution[k];});
    if(consent.advertising){
      clickKeys.forEach(k=>{if(attribution[k])a[k]=attribution[k];});
      a.fbp=cookie('_fbp');a.fbc=cookie('_fbc');
    }
    return a;
  }
  function mode(c){return {analytics_storage:c.analytics?'granted':'denied',ad_storage:c.advertising?'granted':'denied',ad_user_data:c.advertising?'granted':'denied',ad_personalization:c.advertising?'granted':'denied'};}
  w.RXConsent={get:()=>({...consent}),getMode:()=>mode(consent),subscribe:fn=>consentListeners.push(fn)};
  w.dataLayer=w.dataLayer||[];
  const dlSeen=new Set();
  const analyticKeys=['screen','step_id','step_index','step_type','question_id','question_index','option_count','error_code','element_id','link_domain','scroll_percent','active_seconds','video_id','video_percent','video_seconds','video_duration','is_autoplay','cta_delay_seconds','currency','value','load_ms','metric'];
  function publicEvent(name,id,details={},options={}) {
    if(cfg.testMode) return;
    const seenKey=id+':'+name;
    if(dlSeen.has(seenKey)&&options.force!==true)return;
    dlSeen.add(seenKey);
    const params={session_id:sessionId,flow_version:cfg.flowVersion};analyticKeys.forEach(k=>{const v=details[k];if(v===undefined||v===null)return;if(typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean')params[k]=v;else if(typeof v==='string'&&v.length<=100&&!v.includes('@'))params[k]=v;});
    const traffic={},a=currentAttribution();
    const trafficKeys={campaign_source:'utm_source',campaign_medium:'utm_medium',campaign_name:'utm_campaign',campaign_content:'utm_content',campaign_term:'utm_term',campaign_id:'utm_id'};
    Object.keys(trafficKeys).forEach(k=>{const raw=a[trafficKeys[k]],v=k==='campaign_id' && /^[A-Za-z0-9_-]{1,100}$/.test(raw||'') ? raw : safeText(raw);if(v)traffic[k]=v;});
    w.dataLayer.push({rx:null});
    w.dataLayer.push({event:'rx_event',rx:{name:name,event_id:id,session_id:sessionId,page_id:'raiox03',quiz_id:'raiox03',page_type:'quiz',launch:cfg.campaignTag||cfg.launch,technical_launch:cfg.launch,page_location:safeUrl(location.href),page_referrer:consent.analytics?safeUrl(d.referrer):'',source:'quiz_raiox03',analytics:options.analytics??consent.analytics,advertising:options.advertising??consent.advertising,test_mode:false,traffic:traffic,params:params}});
    if(name==='page_view'){pageTracked.analytics ||= options.analytics??consent.analytics;pageTracked.advertising ||= options.advertising??consent.advertising;}
  }
// Captures the existing Google tag's identifiers; never creates another page_view.
function makePurchaseAnalyticsContext(readConsent, isTest, notifyReady) {
  let clientId = null, sessionId = null, requestedAt = 0, lastNotified = '', epoch = 0;
  const measurementId = 'G-D4Y6SYSD4H';
  const enabledHost = /^(?:www\.)?eventoraioxhumano\.com$/.test(location.hostname);
  const cidValid = v => typeof v === 'string' && /^\d{1,20}\.\d{1,20}$/.test(v);
  const sidValid = v => /^\d{1,15}$/.test(String(v || '')) && Number(v) > 0;
  function snapshot() {
    const consent = readConsent() || {};
    if (!enabledHost) return null;
    if (consent.analytics !== true || isTest()) {
      clientId = null; sessionId = null; requestedAt = 0; lastNotified = ''; epoch += 1;
      return {measurement_id: measurementId, analytics: false, advertising: false};
    }
    if (Date.now() - requestedAt > 15000) {
      requestedAt = Date.now();
      const requestEpoch = epoch;
      const accept = (key, value) => {
        if (requestEpoch !== epoch || readConsent()?.analytics !== true || isTest()) return;
        if (key === 'client_id' && cidValid(value)) clientId = value;
        if (key === 'session_id' && sidValid(value)) sessionId = Number(value);
        if (clientId && sessionId) {
          const signature = clientId + ':' + sessionId;
          if (signature !== lastNotified) {
            lastNotified = signature;
            setTimeout(() => { if (readConsent()?.analytics === true && !isTest()) notifyReady(); }, 0);
          }
        }
      };
      window.dataLayer = window.dataLayer || [];
      const gtag = typeof window.gtag === 'function' ? window.gtag : function(){window.dataLayer.push(arguments);};
      gtag('get', measurementId, 'client_id', value => accept('client_id', value));
      gtag('get', measurementId, 'session_id', value => accept('session_id', value));
    }
    return {measurement_id: measurementId, analytics: true, advertising: consent.advertising === true,
      ...(clientId && sessionId ? {client_id: clientId, session_id: sessionId} : {})};
  }
  return snapshot;
}

  const purchaseAnalytics = makePurchaseAnalyticsContext(()=>consent,()=>cfg.testMode===true,()=>emit('rx_performance',{metric:'ga4_context_ready'}));
  function payload(name,details,lead) {
    seq+=1;persistRuntime();
    return {integration_version:'raiox-v3.0',client_key:clientKey,schema_version:1,event_id:uid(),event_name:name,session_id:sessionId,session_token:token,sequence:seq,occurred_at:new Date().toISOString(),source:cfg.source,lancamento:cfg.launch,test_mode:cfg.testMode===true,page_url:safeUrl(location.href),referrer:consent.analytics?safeUrl(d.referrer):'',context:{...context},properties:{...(details||{}),collection_policy:'lean_v1',flow_version:cfg.flowVersion,entry_variant:cfg.entryVariant,analytics_context:purchaseAnalytics()},attribution:currentAttribution(),consent:{analytics:consent.analytics,advertising:consent.advertising,marketing_contact:consent.marketing_contact,version:cfg.consentVersion,decided:consent.decided},device:consent.analytics?{language:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,viewport_width:innerWidth,viewport_height:innerHeight,screen_width:screen.width,screen_height:screen.height}:{},lead:lead||undefined};
  }
  async function request(p){
    let last;
    for(let attempt=0;attempt<=cfg.maxRetries;attempt++){
      const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),cfg.webhookTimeoutMs);
      try{
        // Retentativas mantêm o conteúdo, o ID e a sequência; só atualizam o token.
        const body={...p,session_token:token||p.session_token};
        const res=await (window.RXContingency?.fetch || fetch)(cfg.webhookUrl,{method:'POST',mode:'cors',credentials:'omit',
          headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:abort.signal,keepalive:true});
        const result=await res.json().catch(()=>null);
        const matches=result?.event_id===p.event_id||(Array.isArray(result?.event_ids)&&result.event_ids.includes(p.event_id));
        if(!res.ok||!result||result.ok!==true||result.stored!==true||!matches||result.test_mode!==p.test_mode){
          const e=new Error(result?.code||'invalid_ack');e.retryable=res.status===429||res.status>=500;e.status=res.status;throw e;
        }
        if(!validId(result.session_token)){const e=new Error('invalid_session_token_ack');e.retryable=false;throw e;}
        token=result.session_token;if(result.quiz_status)latestStatus={...result.quiz_status};
        lastDeliveryError=null;persistRuntime();
        w.dispatchEvent(new CustomEvent('rx:stored',{detail:{event_name:p.event_name,event_id:p.event_id,
          session_id:sessionId,test_mode:cfg.testMode,quiz_status:latestStatus?{...latestStatus}:null}}));
        return result;
      }catch(e){
        last=e;
        if(e.retryable===false||(e.status&&e.status<500&&e.status!==429)||attempt===cfg.maxRetries){reportError(e,p);throw e;}
        await new Promise(r=>setTimeout(r,600*Math.pow(2,attempt)));
      }finally{clearTimeout(timer);}
    }throw last;
  }
  // Cadastro/progresso são operações do serviço; pixels e métricas opcionais continuam sob consentimento.
  const essential=new Set(['page_view','quiz_start','rx_form_view','rx_form_start','rx_form_submit_attempt',
    'rx_form_error','rx_form_submit_error','lead_submit','quiz_step_view','quiz_step_complete','quiz_insight_view',
    'quiz_insight_continue','quiz_answer','quiz_complete','quiz_result_view','rx_cta_view','rx_checkout_click','consent_change']);
  const supported=new Set([...essential,'rx_page_hidden','rx_page_visible','rx_page_exit','view_item','rx_scroll','rx_engaged_time',
    'rx_outbound_click','rx_whatsapp_click','rx_video_ready','rx_video_preview','rx_video_start','rx_video_resume',
    'rx_video_pause','rx_video_progress','rx_video_complete','rx_video_pitch','rx_performance']);
  let bootstrapEvent;
  // Keep network writes ordered and idempotent, but let critical writes pass queued metrics.
  const criticalNames = new Set(['page_view','lead_submit','quiz_answer','quiz_insight_continue','quiz_complete','rx_checkout_click']);
  const criticalQueue = [], metricQueue = [], deliveries = new Map();
  let draining = false;
  function serial(p){
    if(deliveries.has(p.event_id))return deliveries.get(p.event_id);
    journal(p);
    let resolve, reject;
    const promise = new Promise((yes,no)=>{resolve=yes;reject=no;});
    deliveries.set(p.event_id,promise);
    (criticalNames.has(p.event_name)?criticalQueue:metricQueue).push({p,resolve,reject});
    void drainDeliveries();
    return promise;
  }
  async function drainDeliveries(){
    if(draining)return;
    draining=true;
    try{
      while(criticalQueue.length||metricQueue.length){
        const task=criticalQueue.shift()||metricQueue.shift(), p=task.p;
        try{
          if(!consent.analytics&&!essential.has(p.event_name)){task.resolve({skipped:true});continue;}
          if(!token&&p!==bootstrapEvent)await request(bootstrapEvent);
          const result=await request(p);
          if(p.event_name==='page_view'){deliveryJournal.delete(p.event_id);persistRuntime();}
          task.resolve(result);
        }catch(e){task.reject(e);}
        finally{deliveries.delete(p.event_id);}
      }
    }finally{draining=false;}
  }
  function createTelemetryPolicy({sessionId,storage,now=()=>Date.now()}){
 const key='rx_telemetry_lean_v1:'+sessionId;
 let seen={};try{const v=JSON.parse(storage?.getItem(key)||'null');if(v&&typeof v==='object'&&!Array.isArray(v))seen=v;}catch(_){}
 const once=(name,gap)=>{
  const t=now(),previous=seen[name];
  if(Number.isFinite(previous)&&(gap===Infinity||(t>=previous&&t-previous<gap)))return false;
  seen[name]=t;try{storage?.setItem(key,JSON.stringify(seen));}catch(_){}return true;
 };
 // Uniform deterministic session cohort. Sampling never applies to GA4 identity readiness.
 let hash=2166136261;for(const c of String(sessionId))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 const performanceSample=hash%10===0;
 return {
  version:'lean_v1',
  allow(name,p={}){
   if(name==='rx_scroll')return Number(p.scroll_percent)===75&&once('scroll75',Infinity);
   if(name==='rx_engaged_time')return p.metric==='quiz_heartbeat'||(Number(p.active_seconds)===60&&once('active60',Infinity));
   if(name==='rx_performance'&&p.metric==='dom_interactive')return performanceSample&&once('dom_interactive',Infinity);
   if(name==='rx_page_hidden'||name==='rx_page_visible')return once(name,30000);
   if(name==='rx_page_exit')return once(name,Infinity);
   if(name==='rx_video_ready'||name==='rx_video_preview')return once(name+':'+String(p.video_id||''),Infinity);
   if(name==='rx_video_pause'||name==='rx_video_resume')return once(name+':'+String(p.video_id||''),30000);
   if(name==='rx_video_progress')return [25,75].includes(Number(p.video_percent))&&once('video:'+String(p.video_id||'')+':'+p.video_percent,Infinity);
   return true;
  },
  performanceSample
 };
}
  const telemetryPolicy=createTelemetryPolicy({sessionId,storage:sessionStorage});
  function emit(name,details={},options={}){
    if(consent.analytics&&!telemetryPolicy.allow(name,details))return Promise.resolve({skipped:true,code:'telemetry_reduced'});
    if(!supported.has(name))return Promise.resolve({skipped:true,code:'event_not_allowed'});
    if(['quiz_answer','quiz_insight_continue','quiz_complete'].includes(name))return saveProgress(name,details);
    const id=uid();if(!options.noAnalytics)publicEvent(name,id,{...context,...details});
    if(!consent.analytics&&!essential.has(name))return Promise.resolve({skipped:true});
    const p=payload(name,{...context,...details,...(name==='rx_performance'&&details.metric==='dom_interactive'?{sample_rate:0.1}:{})});p.event_id=id;
    return serial(p).catch(e=>({ok:false,stored:false,code:e.message||'delivery_failed'}));
  }
  const pendingProgress=new Map();
  for(const p of recoveryEntries){
    if(!['quiz_answer','quiz_insight_continue','quiz_complete'].includes(p.event_name))continue;
    const details={...p.properties};delete details.analytics_context;
    const key=p.event_name+':'+(details.question_id||details.step_id||'final');
    pendingProgress.set(key,{snapshot:JSON.stringify(details),p});
  }
  function stageProgress(name,details={}){
    if(!['quiz_answer','quiz_insight_continue','quiz_complete'].includes(name))throw new Error('invalid_operational_event');
    details=normalizeProgress(name,details);
    const key=name+':'+(details.question_id||details.step_id||'final');
    const snapshot=JSON.stringify(details);
    let pending=pendingProgress.get(key);
    if(!pending || pending.snapshot!==snapshot){pending={snapshot,p:payload(name,details)};pendingProgress.set(key,pending);}
    journal(pending.p);
    return pending;
  }
  async function saveProgress(name,details={}) {
    const pending=stageProgress(name,details);
    const key=name+':'+(details.question_id||details.step_id||'final');
    const result=await serial(pending.p);
    if(name==='quiz_complete' && !cfg.testMode && (result.quiz_status?.finalizou!==true || result.quiz_status?.status!=='concluido' || result.quiz_status?.perguntas_respondidas!==5 || result.quiz_status?.etapas_concluidas!==5)){const e=new Error('completion_not_confirmed');reportError(e,pending.p);throw e;}
    // Completion/answers only reach analytics after the backend ACK. Details stay allowlisted.
    publicEvent(name,pending.p.event_id,{...pending.p.context,...details});
    deliveryJournal.delete(pending.p.event_id);persistRuntime();
    pendingProgress.delete(key);
    return result;
  }
  let pendingLead=recoveryEntries.find(p=>p.event_name==='lead_submit')||null;
  async function saveLead(lead,honey) {
    if(String(honey||'').trim())throw new Error('invalid_form');
    consent.marketing_contact=lead.marketing_contact===true;
    const normalized={nome:String(lead.name||'').trim().replace(/\s+/g,' '),email:String(lead.email||'').trim().toLowerCase(),telefone:normalizePhone(lead.phone),form_notice_version:cfg.consentVersion,honey:String(honey||'')};
    // Retentativa manual do mesmo cadastro conserva ID; dados alterados geram novo evento.
    if(!pendingLead||JSON.stringify(pendingLead.lead)!==JSON.stringify(normalized))pendingLead=payload('lead_submit',{},normalized);
    const p=pendingLead, result=await serial(p);
    publicEvent('lead_submit',p.event_id,{screen:'lead'});
    publicEvent(result.lead_created===true?'generate_lead':'rx_lead_existing',p.event_id,{screen:'lead'});
    deliveryJournal.delete(p.event_id);persistRuntime();
    pendingLead=null;
    return result;
  }
  function normalizePhone(v) {
    const s=String(v||'').trim(),digits=s.replace(/\D/g,'');
    if(s.startsWith('+'))return /^[1-9]\d{7,14}$/.test(digits)?'+'+digits:'';
    if(digits.startsWith('00'))return /^[1-9]\d{7,14}$/.test(digits.slice(2))?'+'+digits.slice(2):'';
    if((digits.length===12||digits.length===13)&&digits.startsWith('55'))return '+'+digits;
    if(digits.length===5||digits.length===11)return '+55'+digits;
    return '';
  }
  function setContext(c){context={...context,...c};}
  const pageTracked={analytics:false,advertising:false};
  function recordPage(){
    const analytics=consent.analytics&&!pageTracked.analytics,advertising=consent.advertising&&!pageTracked.advertising;
    if(!cfg.testMode&&(analytics||advertising)){
      // PageView para medição após consentimento, sem repetir a inicialização no banco.
      publicEvent('page_view',bootstrapEvent.event_id,{screen:context.screen},{force:true,analytics,advertising});
    }
  }
  function ensureMetaBase(){
    return; // Pixel da Meta antigo (866754926148360) desativado
    if(cfg.testMode||!consent.advertising||w.__rx26PixelBase)return;
    w.__rx26PixelBase=true;
    const pixel='866754926148360';
    if(!w.fbq){
      const n=w.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments);};
      w._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];
      const s=d.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';d.head.appendChild(s);
    }
    const f=w.fbq;
    if(!w.__rx26Pixel){
      f.disablePushState=true;
      f('set','autoConfig',false,pixel);
      f('init',pixel);
      w.__rx26Pixel=true;
    }
    f('consent',consent.advertising?'grant':'revoke');
  }
  function choose(analytics,advertising){
    consent={...consent,analytics:analytics===true,advertising:advertising===true,decided:true};
    try{localStorage.setItem('rx03_consent_v1',JSON.stringify({version:cfg.consentVersion,saved_at:Date.now(),choices:consent}));}catch(_){}
    consentListeners.forEach(fn=>fn(mode(consent)));
    ensureMetaBase();
    if(typeof w.fbq==='function')w.fbq('consent',consent.advertising?'grant':'revoke');
    d.querySelector('#rx-consent')?.remove();
    // Itens anteriores à autorização não são reproduzidos. Registra somente o estado atual.
    w.dataLayer.push({event:'rx_consent_changed'});
    persistRuntime();recordPage();emit('consent_change',{}, {noAnalytics:true});
  }
  function showConsent(){
    if(automaticTracking)return;
    if(d.querySelector('#rx-consent'))return;
    const el=d.createElement('section');el.id='rx-consent';el.setAttribute('aria-label','Preferências de privacidade');
    el.innerHTML='<strong>Suas preferências de privacidade</strong><p>O formulário funciona sem cookies opcionais. Podemos medir a navegação e usar pixels de publicidade somente com sua autorização.</p><label><input type="checkbox" id="rx-analytics"> Medição de navegação</label><label><input type="checkbox" id="rx-ads"> Publicidade (Meta e VK)</label><div><button type="button" id="rx-consent-save">Salvar escolhas</button><button type="button" id="rx-consent-no">Somente necessários</button><button type="button" id="rx-consent-all">Aceitar opcionais</button></div>';
    d.body.appendChild(el);el.querySelector('#rx-analytics').checked=consent.analytics;el.querySelector('#rx-ads').checked=consent.advertising;
    el.querySelector('#rx-consent-save').onclick=()=>choose(el.querySelector('#rx-analytics').checked,el.querySelector('#rx-ads').checked);
    el.querySelector('#rx-consent-no').onclick=()=>choose(false,false);el.querySelector('#rx-consent-all').onclick=()=>choose(true,true);
  }
  const scrollSeen=new Set();let scrollTimer;
  d.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{const max=d.documentElement.scrollHeight-innerHeight;if(max<100)return;const pct=Math.min(100,Math.round(scrollY/max*100));[75].forEach(n=>{const k=context.screen+':'+context.step_index+':'+n;if(pct>=n&&!scrollSeen.has(k)){scrollSeen.add(k);emit('rx_scroll',{scroll_percent:n});}});},180);},{passive:true});
  let active=0,last=performance.now(),timeSeen=new Set();
  setInterval(()=>{const now=performance.now(),delta=Math.min(2000,now-last);last=now;if(!d.hidden&&d.hasFocus())active+=delta;[60].forEach(n=>{if(active>=n*1000&&!timeSeen.has(n)){timeSeen.add(n);emit('rx_engaged_time',{active_seconds:n});}});},1000);
  d.addEventListener('visibilitychange',()=>{if(consent.analytics)emit(d.hidden?'rx_page_hidden':'rx_page_visible',{});});
  let lastInteraction=Date.now();
  ['pointerdown','keydown','touchstart','scroll'].forEach(name=>d.addEventListener(name,()=>{lastInteraction=Date.now();},{passive:true}));
  setInterval(()=>{
    if(consent.analytics&&checkpoint?.leadSaved&&!d.hidden&&d.hasFocus()&&Date.now()-lastInteraction<90000)
      emit('rx_engaged_time',{...context,metric:'quiz_heartbeat',active_seconds:Math.floor(active/1000)});
  },Math.max(15,Number(cfg.heartbeatSeconds)||30)*1000);
  function checkoutSck(existing){
    const marker=(cfg.testMode?'rx03test_':'rx03_')+sessionId.replace(/-/g,'');
    const source=String(existing||'').trim().replace(/(?:^|~)rx03(?:test)?_[0-9a-f]{32}(?=~|$)/gi,'').replace(/^~|~$/g,'');
    // Existing sck is preserved without truncation, provided it fits. Otherwise leave it
    // unchanged and use conservative email matching on the backend, not a guessed link.
    if(source.length+marker.length+1>255)return source;
    return source?source+'~'+marker:marker;
  }

  w.addEventListener('pagehide',()=>{
    // Saída não força conclusão. Respostas críticas já usam fetch keepalive e confirmação.
    if(consent.analytics&&token)emit('rx_page_exit',{...context,active_seconds:Math.floor(active/1000)});
  });
  d.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||a.id==='checkout-button')return;try{const u=new URL(a.href);if(/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/.test(u.hostname))emit('rx_whatsapp_click',{link_domain:u.hostname});else if(u.origin!==location.origin&&/^https?:$/.test(u.protocol))emit('rx_outbound_click',{link_domain:u.hostname});}catch(_){};});
  function bindVturb(player){
    if(!player||player.dataset.rxBound)return;player.dataset.rxBound='1';
    let started=false,marks=new Set(),smart=false;
    const base=()=>({video_id:player.id,video_duration:Number(player.duration)||0,video_seconds:Math.floor(Number(player.currentTime)||0),is_autoplay:smart||player.inSmartAutoPlay===true});
    player.addEventListener('smartautoplay:active',()=>{smart=true;emit('rx_video_preview',base());});
    player.addEventListener('smartautoplay:inactive',()=>{smart=false;});
    player.addEventListener('player:ready',()=>emit('rx_video_ready',base()));
    player.addEventListener('video:play',()=>{if(smart||player.inSmartAutoPlay===true)return;emit(started?'rx_video_resume':'rx_video_start',base());started=true;});
    player.addEventListener('video:pause',()=>{if(started)emit('rx_video_pause',base());});
    player.addEventListener('video:timeupdate',e=>{if(smart||player.inSmartAutoPlay===true)return;const duration=Number(player.duration),time=Number(e.detail?.time??player.currentTime);if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(time))return;const pct=Math.min(100,time/duration*100);[25,75].forEach(n=>{if(pct>=n&&!marks.has(n)){marks.add(n);emit('rx_video_progress',{...base(),video_seconds:Math.floor(time),video_percent:n});}});});
    player.addEventListener('video:ended',()=>{if(!smart)emit('rx_video_complete',{...base(),video_percent:100});});
    player.addEventListener('pitch:time',()=>emit('rx_video_pitch',base()));
  }
  w.RX={getPendingAnswers:()=>[...deliveryJournal.values()].filter(p=>p.event_name==='quiz_answer').sort((a,b)=>a.sequence-b.sequence).map(p=>({question_id:p.properties.question_id,option_index:p.properties.option_index})),registerSteps,getDiagnostics:()=>({collection_policy:telemetryPolicy.version,build:cfg.pageBuild,endpoint:cfg.webhookUrl,launch:cfg.launch,test_mode:cfg.testMode,session_id:sessionId,session_confirmed:!!token,status:latestStatus?{...latestStatus}:null,last_error:lastDeliveryError?{...lastDeliveryError}:null,catalog_ready:(()=>{try{getSteps();return true;}catch{return false;}})()}),emit,saveLead,stageProgress,saveProgress,saveCheckpoint,getCheckpoint,checkoutSck,getSavedStatus:()=>latestStatus,publicEvent,normalizePhone,setContext,bindVturb,showConsent,safeUrl,getAttribution:currentAttribution,getSessionId:()=>sessionId,getTestMode:()=>cfg.testMode===true};
  bootstrapEvent=(!token&&recoveryEntries.find(p=>p.sequence===1&&p.event_name==='page_view'))||payload('page_view',{screen:'opening'});
  publicEvent('page_view',bootstrapEvent.event_id,{screen:'opening'});
  serial(bootstrapEvent).catch(()=>{});
  let recoveryInFlight=false;
  async function recoverDeliveryJournal(){
    if(recoveryInFlight)return;
    recoveryInFlight=true;
    try{
      for(const p of [...recoveryEntries].sort((a,b)=>a.sequence-b.sequence)){
        if(p===bootstrapEvent||!deliveryJournal.has(p.event_id))continue;
        if(['quiz_answer','quiz_insight_continue','quiz_complete'].includes(p.event_name)){
          const details={...p.properties};delete details.analytics_context;
          await saveProgress(p.event_name,details);
        }else{
          const result=await serial(p);
          deliveryJournal.delete(p.event_id);persistRuntime();
          publicEvent(p.event_name,p.event_id,p.properties);
          if(p.event_name==='lead_submit')publicEvent(result.lead_created===true?'generate_lead':'rx_lead_existing',p.event_id,{screen:'lead'});
        }
      }
    }catch(_){/* Still journaled. Retry when connectivity returns. */}
    finally{recoveryInFlight=false;}
  }
  w.addEventListener('online',()=>{void recoverDeliveryJournal();});
  d.addEventListener('DOMContentLoaded',()=>{
    void recoverDeliveryJournal();
    if(cfg.testMode){const b=d.createElement('div');b.className='rx-test-banner';b.textContent='MODO DE TESTE — dados não entram na base de leads';d.body.prepend(b);}
    ensureMetaBase();
    if(!consent.decided&&!cfg.testMode)showConsent();
    recordPage();
    if(consent.analytics){const n=performance.getEntriesByType('navigation')[0];if(n)emit('rx_performance',{metric:'dom_interactive',load_ms:Math.round(n.domInteractive)});}
  });
})(window,document);

;


/* RaioX03 dinâmico: UI e catálogo da variante; transporte nativo preservado. */
(()=>{'use strict';
const data={"profiles": {"atendimento": {"name": "Atendimento", "situations": [{"title": "Você quer organizar melhor o que merece ser aprofundado no atendimento.", "text": "Você contou que, às vezes, termina uma conversa pensando em pontos do relato que poderia ter explorado melhor."}, {"title": "Você quer transformar o que percebe em perguntas melhores.", "text": "Você percebe mudanças nas reações de quem atende e quer compreender como aprofundar a conversa."}, {"title": "Você quer organizar um conhecimento que já construiu.", "text": "Você contou que já estudou bastante e quer organizar melhor como usa esse conhecimento."}, {"title": "Você quer ampliar um repertório que já construiu.", "text": "Você contou que atende com segurança. Seu interesse está em conhecer outras perspectivas e avaliar o que podem acrescentar."}], "goals": ["O avanço que você escolheu é ter mais clareza sobre o que observar e perguntar.", "Seu objetivo é compreender melhor as reações diante de pressão e conflitos.", "Você quer aprofundar o estudo de padrões emocionais e mecanismos de defesa.", "Você quer ver exemplos que ampliem seu repertório de atendimento."], "fit": "Você está avaliando uma experiência de aprendizado para conhecer outra perspectiva e compará-la com o repertório que já possui. Veja a programação e os exemplos para avaliar se o conteúdo atende ao seu objetivo.", "questions": [{"question": "Qual destas situações mais se parece com o seu momento nos atendimentos?", "options": ["Às vezes termino uma conversa pensando que havia algo no relato que eu poderia ter explorado melhor.", "Percebo mudanças na reação da pessoa, mas nem sempre sei como aprofundar a conversa.", "Já estudei bastante, mas quero organizar melhor como uso esse conhecimento.", "Atendo com segurança e quero conhecer outras perspectivas."]}, {"question": "Nos atendimentos, o que você mais gostaria de compreender melhor?", "options": ["Como a pessoa reage diante de pressão, críticas e conflitos.", "Padrões emocionais e mecanismos de defesa.", "Como ela se relaciona, demonstra afeto e cria vínculos.", "Suas dificuldades e a forma como toma decisões."]}], "final": {"question": "Nos seus atendimentos, qual situação você mais gostaria de evitar?", "options": ["Terminar uma conversa e perceber que deixei passar um ponto importante do relato.", "Tirar uma conclusão antes de compreender melhor o contexto da pessoa.", "Conhecer a teoria, mas não saber como aprofundar a conversa.", "Já me sinto seguro; quero ampliar meu repertório."]}, "interests": ["Seu interesse está em compreender: como a pessoa reage diante de pressão, críticas e conflitos.", "Seu interesse está em compreender: padrões emocionais e mecanismos de defesa.", "Seu interesse está em compreender: como ela se relaciona, demonstra afeto e cria vínculos.", "Seu interesse está em compreender: suas dificuldades e a forma como toma decisões."], "consequences": ["Você quer aprofundar o relato sem deixar passar pontos que considera importantes.", "Você quer compreender o contexto antes de formar uma conclusão.", "Você quer conectar o estudo a exemplos de como aprofundar uma conversa.", "Você já se sente seguro e quer avaliar novas perspectivas para o repertório que possui."], "bridge": "Na apresentação, conheça a abordagem de Bruno e os exemplos do Workshop Raio-X Humano. Compare a proposta com o que você quer aprofundar nos atendimentos."}, "inicio": {"name": "Início do aprendizado", "situations": [{"title": "Você já tem interesse. Seu próximo passo é conhecer um caminho de estudo.", "text": "Você contou que tem vontade de aprender, mas ainda não sabe qual seria um bom primeiro passo."}, {"title": "Você quer dar uma direção ao conteúdo que já acompanha.", "text": "Você contou que consome bastante conteúdo e quer organizar melhor seu estudo."}, {"title": "Você quer conhecer a proposta antes de escolher seu caminho.", "text": "Você se interessa por compreender pessoas e quer conhecer o conteúdo antes de decidir como aprofundar esse estudo."}, {"title": "Você quer ampliar um estudo que já começou.", "text": "Você contou que já começou a estudar e quer conhecer outra abordagem."}], "goals": ["Seu objetivo é entender por onde começar com o conhecimento que tem hoje.", "Você quer ver como esse conteúdo aparece em exemplos de aplicação.", "Você quer compreender como organizar uma sequência de estudo.", "Você quer avaliar se deseja aprofundar o estudo para uso pessoal ou para uma possível atuação futura."], "fit": "Você pode avaliar uma primeira experiência com a abordagem antes de decidir se deseja aprofundar o estudo. Confira o conteúdo e o nível dos encontros; a inscrição é no workshop, não em uma formação profissional completa.", "questions": [{"question": "Quando você pensa em começar esse aprendizado, o que mais se parece com o seu momento?", "options": ["Tenho vontade de aprender, mas ainda não sei qual seria um bom primeiro passo.", "Consumo bastante conteúdo, mas ainda não organizei meu estudo.", "Gosto de compreender pessoas, mas quero conhecer a proposta antes de escolher um caminho.", "Já comecei a estudar e quero conhecer outra abordagem."]}, {"question": "O que mais desperta seu interesse nesse aprendizado?", "options": ["Reações diante de pressão, críticas e conflitos.", "Padrões emocionais e mecanismos de defesa.", "Como as pessoas se comunicam e criam vínculos.", "Como compreender melhor minhas próprias reações e escolhas."]}], "final": {"question": "Ao começar esse aprendizado, o que você mais quer evitar?", "options": ["Acumular conteúdo sem saber como organizar meu estudo.", "Decorar conceitos sem entender os exemplos.", "Tirar conclusões sobre alguém sem compreender seu contexto.", "Já tenho uma direção; quero conhecer outra abordagem."]}, "interests": ["Seu interesse está em compreender: reações diante de pressão, críticas e conflitos.", "Seu interesse está em compreender: padrões emocionais e mecanismos de defesa.", "Seu interesse está em compreender: como as pessoas se comunicam e criam vínculos.", "Seu interesse está em compreender: como compreender melhor minhas próprias reações e escolhas."], "consequences": ["Você quer dar uma direção ao estudo, em vez de apenas acumular conteúdo.", "Você quer compreender os conceitos por meio de exemplos.", "Você quer aprender sem reduzir uma pessoa à primeira impressão.", "Você já tem uma direção e quer avaliar outra abordagem."], "bridge": "Na apresentação, conheça a abordagem de Bruno e os exemplos do Workshop Raio-X Humano. Avalie se esse é um primeiro contato que faz sentido para o estudo que você quer desenvolver."}, "trabalho": {"name": "Trabalho e comunicação", "situations": [{"title": "Você quer compreender melhor a conversa antes que o desencontro apareça depois.", "text": "Você contou que, às vezes, acha que a conversa foi clara e depois percebe que a outra pessoa entendeu diferente."}, {"title": "Você quer conduzir divergências com mais atenção à comunicação.", "text": "Você reconheceu situações em que uma divergência acaba virando uma discussão difícil de conduzir."}, {"title": "Você quer fazer perguntas melhores antes de concluir.", "text": "Você percebe reações e quer aprofundar a conversa em vez de tirar conclusões rápidas."}, {"title": "Você quer ampliar um repertório de comunicação que já possui.", "text": "Você contou que já se comunica bem e quer conhecer outras perspectivas."}], "goals": ["Você quer levar esse aprendizado para conversas com clientes e vendas.", "Seu objetivo está na comunicação com a equipe.", "Você quer compreender melhor as conversas em situações de divergência e conflito.", "Você quer prestar mais atenção à comunicação em negociações e parcerias."], "fit": "Compare o conteúdo e os exemplos com o contexto do seu trabalho. O objetivo desta proposta é conhecer uma abordagem de observação e comunicação; avalie a conexão com sua rotina antes de se inscrever.", "questions": [{"question": "Qual destas situações você mais reconhece nas suas conversas de trabalho?", "options": ["Às vezes acho que a conversa foi clara, mas depois percebo que a outra pessoa entendeu diferente.", "Algumas divergências acabam virando discussões difíceis de conduzir.", "Percebo reações, mas quero fazer perguntas melhores em vez de tirar conclusões rápidas.", "Já me comunico bem e quero ampliar meu repertório."]}, {"question": "Nas conversas de trabalho, o que você mais gostaria de compreender?", "options": ["Reações diante de pressão, críticas e conflitos.", "Como as pessoas comunicam o que precisam.", "Pontos fortes, dificuldades e formas de tomar decisões.", "Padrões de reação que se repetem nas conversas."]}], "final": {"question": "Nas suas conversas de trabalho, qual situação você mais quer evitar?", "options": ["Tomar uma decisão importante com base só na primeira impressão.", "Sair de uma conversa achando que houve entendimento, quando não houve.", "Deixar uma divergência virar um conflito difícil de conduzir.", "Já lido bem com essas situações; quero ampliar meu repertório."]}, "interests": ["Seu interesse está em compreender: reações diante de pressão, críticas e conflitos.", "Seu interesse está em compreender: como as pessoas comunicam o que precisam.", "Seu interesse está em compreender: pontos fortes, dificuldades e formas de tomar decisões.", "Seu interesse está em compreender: padrões de reação que se repetem nas conversas."], "consequences": ["Você quer compreender melhor o contexto antes de uma decisão importante.", "Você quer perceber se houve entendimento, em vez de apenas presumir que a conversa foi clara.", "Você quer prestar atenção às divergências antes de elas se tornarem conflitos difíceis.", "Você já lida bem com essas situações e quer ampliar seu repertório."], "bridge": "Na apresentação, conheça a abordagem de Bruno e os exemplos do Workshop Raio-X Humano. Avalie como o conteúdo se conecta às conversas e decisões da sua rotina profissional."}, "relacoes": {"name": "Relações pessoais", "situations": [{"title": "Você quer perceber o desencontro antes de a conversa virar uma discussão.", "text": "Você contou que, às vezes, começa uma conversa para resolver algo e termina em uma discussão que não queria."}, {"title": "Você quer compreender melhor as reações durante a conversa.", "text": "Você contou que, às vezes, só depois da conversa entende melhor a reação da outra pessoa ou a sua."}, {"title": "Você quer se fazer entender com mais clareza.", "text": "Você reconheceu momentos em que explicou o que queria, mas sentiu que não conseguiu se fazer entender."}, {"title": "Você quer continuar aprendendo sobre relações que já vão bem.", "text": "Você contou que suas relações vão bem e quer seguir aprendendo sobre elas e sobre si."}], "goals": ["Você escolheu aprender a perceber quando uma conversa começa a virar conflito.", "Seu objetivo é expressar o que pensa e escutar o outro com mais atenção.", "Você quer refletir sobre padrões de comunicação que se repetem.", "Você quer compreender melhor suas próprias reações e escolhas."], "fit": "Você está buscando compreender melhor suas relações e suas próprias reações. Conhecer a abordagem e os exemplos permite avaliar essa aplicação antes de decidir se deseja aprofundar o estudo.", "questions": [{"question": "Qual destas situações mais se parece com o que você vive nas suas relações?", "options": ["Às vezes tento conversar para resolver algo e termino em uma discussão que não queria.", "Só depois da conversa entendo melhor a reação da outra pessoa ou a minha.", "Sinto que expliquei o que queria, mas não consegui me fazer entender.", "Minhas relações vão bem e quero continuar aprendendo sobre elas e sobre mim."]}, {"question": "Nas suas relações, o que você mais gostaria de compreender?", "options": ["Como eu e a outra pessoa reagimos diante de críticas e conflitos.", "Padrões emocionais e mecanismos de defesa.", "Como expressamos afeto e construímos vínculos.", "Por que algumas reações e escolhas se repetem."]}], "final": {"question": "Nas suas relações, qual situação você mais gostaria de evitar?", "options": ["Repetir uma escolha e só perceber depois o que me incomodava.", "Tentar resolver algo e acabar numa discussão que não queria.", "Tirar conclusões antes de ouvir e compreender melhor o outro.", "Minhas relações vão bem; quero continuar aprendendo."]}, "interests": ["Seu interesse está em compreender: como eu e a outra pessoa reagimos diante de críticas e conflitos.", "Seu interesse está em compreender: padrões emocionais e mecanismos de defesa.", "Seu interesse está em compreender: como expressamos afeto e construímos vínculos.", "Seu interesse está em compreender: por que algumas reações e escolhas se repetem."], "consequences": ["Você quer refletir sobre escolhas que se repetem e sobre o que só percebe depois.", "Você quer prestar atenção ao momento em que uma conversa começa a virar discussão.", "Você quer ouvir e compreender o contexto antes de concluir.", "Você contou que suas relações vão bem e quer continuar aprendendo."], "bridge": "Na apresentação, conheça a abordagem de Bruno e os exemplos do Workshop Raio-X Humano. Avalie a conexão com o que você deseja compreender sobre suas relações e suas próprias reações."}}, "learning": {"question": "Para avançar nesse objetivo, qual apoio faria mais diferença para você?", "options": ["Ver exemplos explicados passo a passo.", "Ter uma sequência para organizar o que observar.", "Entender como esse aprendizado se conecta à minha rotina.", "Conhecer os fundamentos e os limites da abordagem antes de decidir."]}},paths=['atendimento','inicio','trabalho','relacoes'];
const profiles=['terapeuta','futuro_terapeuta','profissional_de_pessoas','vida_pessoal'];
const ids=['situation','context_situation_v1','context_interest_v1','learning_support_v1','context_consequence_v1'];
const first={question:'Em qual situação seria mais valioso compreender uma pessoa antes da primeira conversa?',options:['Antes ou durante um atendimento terapêutico.','Para começar uma nova atuação como terapeuta.','Ao contratar, liderar, negociar, vender ou trabalhar com pessoas.','Antes de confiar, me envolver ou tomar decisões na vida pessoal.']};
const quiz=document.getElementById('quiz-root'),RX=window.RX;
let state={screen:'lead',stepIndex:0,answerIndexes:{},completedSteps:[],leadSaved:false,resultViewed:false,checkoutClicked:false},selection=null,lead=null,leadPromise=null,completePromise=null,completeConfirmed=false,flushPromise=null;
const pending=new Map();let retryTimer=null,ctaTimer=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function path(){return paths[state.answerIndexes.situation]||paths[0];}
function steps(){const p=data.profiles[path()];return [first,...p.questions,data.learning,p.final].map((q,i)=>({id:ids[i],type:'question',text:q.question,options:q.options.map((label,j)=>({label,...(i===0?{profile:profiles[j]}:{})}))}));}
function register(){RX.registerSteps(steps());}
const resumed=RX.getCheckpoint();
if(resumed&&resumed.leadSaved&&resumed.completedSteps.every((id,i)=>id===ids[i])){state={...state,...resumed};if(state.completedSteps.every(id=>Number.isInteger(state.answerIndexes[id]))){state.screen=state.completedSteps.length===5?'result':'step';}else state={screen:'lead',stepIndex:0,answerIndexes:{},completedSteps:[],leadSaved:false};}
if(!resumed){const queued=RX.getPendingAnswers();if(queued.some(a=>a.question_id===ids[0])){try{const contact=JSON.parse(sessionStorage.getItem('rx03_checkout_prefill_'+RX.getSessionId())||'null');if(contact?.email&&contact?.phone){lead=contact;for(const a of queued)if(ids.includes(a.question_id)&&Number.isInteger(a.option_index)&&a.option_index>=0&&a.option_index<4)state.answerIndexes[a.question_id]=a.option_index;while(state.completedSteps.length<5&&Number.isInteger(state.answerIndexes[ids[state.completedSteps.length]]))state.completedSteps.push(ids[state.completedSteps.length]);state.stepIndex=state.completedSteps.length;state.screen=state.stepIndex===5?'result':'step';}}catch(_){}}}
completeConfirmed=state.completedSteps.length===5&&resumed?.resultViewed===true;
register();
const panel=body=>'<section class="screen panel"><div class="panel-inner">'+body+'</div></section>';
function checkpoint(){if(!state.leadSaved)return;RX.saveCheckpoint({...state,resultViewed:completeConfirmed,stepIndex:state.completedSteps.length});}
function syncNote(show){document.getElementById('sync-note')?.remove();if(show){const p=document.createElement('p');p.id='sync-note';p.className='sync-note';p.setAttribute('role','status');p.textContent='Estamos sincronizando suas respostas. Você pode continuar por aqui.';quiz.appendChild(p);}}
function scheduleRetry(){if(retryTimer)return;retryTimer=setTimeout(()=>{retryTimer=null;void flush();},5000);}
async function ensureLead(){if(state.leadSaved)return;if(!lead)throw Error('lead_not_available');if(!leadPromise)leadPromise=RX.saveLead(lead,'').then(()=>{state.leadSaved=true;checkpoint();}).finally(()=>leadPromise=null);return leadPromise;}
async function flush(){if(flushPromise)return flushPromise;flushPromise=(async()=>{try{await ensureLead();for(const [id,details] of pending){await RX.saveProgress('quiz_answer',details);if(pending.get(id)===details)pending.delete(id);}checkpoint();if(state.completedSteps.length===5)await finalize();syncNote(false);}catch(_){syncNote(true);scheduleRetry();}})().finally(()=>flushPromise=null);return flushPromise;}
function snapshot(){return steps().map(s=>{const index=state.answerIndexes[s.id];return {question_id:s.id,option_index:index,answer_label:s.options[index].label,...(s.id==='situation'?{selected_profile:profiles[index]}:{})};});}
async function finalize(){if(completeConfirmed)return;if(completePromise)return completePromise;const details={step_index:5,answers:snapshot(),completed_steps:ids.slice()};completePromise=RX.saveProgress('quiz_complete',details).then(()=>{completeConfirmed=true;checkpoint();return RX.emit('quiz_result_view',{screen:'result'});}).finally(()=>completePromise=null);return completePromise;}
function questionView(){const q=steps()[state.stepIndex];selection=state.answerIndexes[q.id]??null;quiz.innerHTML=panel(`<span class="eyebrow">${state.stepIndex===0?'Seu interesse':esc(data.profiles[path()].name)}</span><h1 class="question-title">${esc(q.text)}</h1><p class="question-instruction">Escolha a opção que mais combina com você e confirme para continuar.</p><div class="options" role="group" aria-label="${esc(q.text)}">${q.options.map((o,i)=>`<button class="option${selection===i?' selected':''}" type="button" data-choice="${i}" aria-pressed="${selection===i}">${esc(o.label)}</button>`).join('')}</div><div class="question-actions">${state.stepIndex>0?'<button class="back-button" id="back" type="button">← Voltar</button>':'<span></span>'}<button id="confirm" class="button button-primary" type="button" ${selection===null?'disabled':''}>${state.stepIndex===4?'VER MEU RESULTADO':'CONFIRMAR RESPOSTA'} →</button></div>`);
quiz.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>{selection=Number(b.dataset.choice);quiz.querySelectorAll('[data-choice]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});quiz.querySelector('#confirm').disabled=false;}));
quiz.querySelector('#back')?.addEventListener('click',()=>{state.stepIndex--;render();});
quiz.querySelector('#confirm').addEventListener('click',()=>{if(selection===null)return;const button=quiz.querySelector('#confirm');if(button.disabled)return;button.disabled=true;const i=state.stepIndex;
// Context is immutable after confirmation: changing it requires a new variant session,
// so a resumed/queued answer can never silently acquire labels from another branch.
if(i===0&&state.completedSteps.length&&state.answerIndexes.situation!==selection){quiz.querySelector('.question-instruction').textContent='Este contexto já foi confirmado nesta sessão. Continue com sua escolha inicial.';selection=state.answerIndexes.situation;questionView();return;}
state.answerIndexes[q.id]=selection;if(i===0)register();state.completedSteps=ids.slice(0,Math.max(state.completedSteps.length,i+1));const option=steps()[i].options[selection];const details={question_id:q.id,option_index:selection,answer_label:option.label,...(i===0?{selected_profile:profiles[selection]}:{}),step_index:i+1,option_count:4,completed_steps:ids.slice(0,i+1)};RX.stageProgress('quiz_answer',details);pending.set(q.id,details);state.stepIndex=i+1;if(i===4){state.screen='result';state.resultViewed=true;}render();void flush();});
if(state.stepIndex===0&&state.completedSteps.length)quiz.querySelectorAll('[data-choice]').forEach(b=>{if(Number(b.dataset.choice)!==state.answerIndexes.situation)b.disabled=true;});
RX.emit('quiz_step_view',{screen:'step',step_id:q.id,step_index:state.stepIndex+1,step_type:'question'});
}
function renderLead(){if(!quiz.querySelector('#lead-form'))throw Error('missing_prerendered_form');const form=quiz.querySelector('#lead-form');form.addEventListener('input',()=>RX.emit('rx_form_start',{screen:'lead'}),{once:true});form.addEventListener('submit',event=>{event.preventDefault();const button=form.querySelector('button[type="submit"]');if(button.disabled)return;const f=new FormData(form),email=String(f.get('email')||'').trim().toLowerCase(),phone=RX.normalizePhone(f.get('phone'));let error='';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)error='Informe um e-mail válido para continuar.';else if(!phone)error='Confira seu WhatsApp com DDD e código do país.';else if(String(f.get('company_website')||'').trim())error='Não foi possível validar o formulário. Atualize a página e tente novamente.';if(error){form.querySelector('#form-error').textContent=error;RX.emit('rx_form_error',{error_code:!phone?'invalid_phone':'invalid_form'});return;}button.disabled=true;lead={name:'',email,phone,marketing_contact:false};try{sessionStorage.setItem('rx03_checkout_prefill_'+RX.getSessionId(),JSON.stringify(lead));}catch(_){}state.screen='step';render();void flush();});RX.emit('rx_form_view',{screen:'lead'});}
function checkout(){const u=new URL('https://lastlink.com/p/CC503A9CD/checkout-payment/');Object.entries(RX.getAttribution()).forEach(([k,v])=>u.searchParams.set(k,v));const c=u.searchParams.get('utm_content')||'';if(!c.split('~').includes('pg_raiox03'))u.searchParams.set('utm_content',c?c+'~pg_raiox03':'pg_raiox03');u.searchParams.set('src','quiz_raiox03');u.searchParams.set('sck',RX.checkoutSck(u.searchParams.get('sck')));let contact=lead;try{contact=contact||JSON.parse(sessionStorage.getItem('rx03_checkout_prefill_'+RX.getSessionId())||'null');}catch(_){}if(contact?.email)u.searchParams.set('email',contact.email);if(contact?.phone)u.searchParams.set('phone',contact.phone);return u.toString();}
function resultView(){quiz.innerHTML=panel(`<div class="result-simple"><div class="result-copy-dynamic" id="personal-result"><h1 id="rx-result-title"></h1><h2 id="rx-result-subtitle"></h2></div><div class="video-frame" aria-label="Vídeo do Evento Raio-X Humano"><vturb-smartplayer id="vid-6abe93baef1e567f6a5759c7" style="display:block;width:100%"><div class="vturb-player-placeholder"></div></vturb-smartplayer></div><div class="result-fixed-cta" id="checkout-cta" hidden><h2>Último passo. Agora a escolha é sua.</h2><div class="lot-grid" aria-label="Lotes do evento"><div class="lot-card lot-card-current"><span class="lot-label">1º lote</span><strong>R$37</strong><small>Encerra em breve</small></div><div class="lot-card"><span class="lot-label">2º lote</span><strong>R$97</strong><small>Em breve</small></div><div class="lot-card"><span class="lot-label">3º lote</span><strong>R$197</strong><small>Em breve</small></div></div><a class="button button-primary" id="checkout-button" href="${esc(checkout())}" target="_blank" rel="noopener noreferrer">GARANTIR MINHA VAGA POR R$37</a></div></div>`);
{const root=quiz.querySelector('#personal-result'),profile=path(),answers=ids.slice(1).map(id=>state.answerIndexes[id]);function shortResult(profile,a){
 const titles={
 atendimento:['Aprofunde o que merece atenção no atendimento.','Transforme o que percebe em perguntas melhores.','Dê direção ao conhecimento que você já tem.','Amplie seu repertório de atendimento.'],
 inicio:['Dê o primeiro passo para compreender melhor as pessoas.','Transforme conteúdo em um caminho de aprendizado.','Conheça o método antes de escolher seu caminho.','Amplie o estudo que você já começou.'],
 trabalho:['Compreenda a conversa antes de tomar decisões.','Olhe para a divergência antes que vire conflito.','Faça perguntas melhores antes de concluir.','Amplie seu repertório de comunicação.'],
 relacoes:['Perceba o desencontro antes que vire discussão.','Compreenda melhor as reações durante a conversa.','Expresse o que pensa com mais clareza.','Amplie seu olhar sobre as suas relações.']};
 const interests={
 atendimento:['reações diante de pressão e conflitos','padrões emocionais e mecanismos de defesa','afeto e vínculos','dificuldades e formas de tomar decisões'],
 inicio:['reações diante de pressão e conflitos','padrões emocionais e mecanismos de defesa','comunicação e vínculos','suas próprias reações e escolhas'],
 trabalho:['reações diante de pressão e conflitos','como as pessoas comunicam o que precisam','dificuldades e formas de tomar decisões','padrões de reação nas conversas'],
 relacoes:['reações diante de críticas e conflitos','padrões emocionais e mecanismos de defesa','afeto e vínculos','reações e escolhas que se repetem']};
 const goals={
 atendimento:['aprofundar pontos importantes do relato','compreender o contexto antes de concluir','conectar a teoria às conversas de atendimento','ampliar o repertório que você já possui'],
 inicio:['organizar seu estudo','compreender os conceitos por exemplos','considerar o contexto antes de concluir','conhecer outra abordagem'],
 trabalho:['decidir além da primeira impressão','compreender se houve entendimento','lidar melhor com divergências','ampliar seu repertório'],
 relacoes:['refletir sobre escolhas que se repetem','perceber quando a conversa vira discussão','ouvir antes de concluir','continuar aprendendo sobre suas relações']};
 const bridges=['mostra exemplos de aplicação','explica como organiza sua observação','conecta os conceitos a exemplos de aplicação','apresenta a abordagem e o conteúdo do evento'];
 return {title:titles[profile][a[0]],subtitle:'Você quer compreender '+interests[profile][a[1]]+' para '+goals[profile][a[3]]+'. No vídeo, conheça o Evento Raio-X Humano: Bruno apresenta seu método, desenvolvido a partir de mais de 9 mil atendimentos, e '+bridges[a[2]]+'.'};
}
 const result=shortResult(profile,answers);root.querySelector('#rx-result-title').textContent=result.title;root.querySelector('#rx-result-subtitle').textContent=result.subtitle;}
const player=quiz.querySelector('vturb-smartplayer');RX.bindVturb(player);if(!document.querySelector('[data-rx-dynamic-player]')){const script=document.createElement('script');script.async=true;script.dataset.rxDynamicPlayer='true';script.src='https://scripts.converteai.net/a07c65c7-f155-44ff-8522-402ada1630b9/players/6abe93baef1e567f6a5759c7/v4/player.js';document.head.appendChild(script);}
// Same 60-second delay after the result as the current RaioX03; no offer timing change.
ctaTimer=setTimeout(()=>{const cta=quiz.querySelector('#checkout-cta');if(cta){cta.hidden=false;cta.classList.add('visible');RX.emit('rx_cta_view',{element_id:'checkout-button',cta_delay_seconds:60});}},60000);
quiz.querySelector('#checkout-button').addEventListener('click',e=>{if(RX.getTestMode()){e.preventDefault();return;}state.checkoutClicked=true;checkpoint();RX.emit('rx_checkout_click',{element_id:'checkout-button',link_domain:'lastlink.com',currency:'BRL',value:37});});void flush();}
function render(){if(ctaTimer)clearTimeout(ctaTimer);RX.setContext({screen:state.screen,step_index:Math.min(5,state.stepIndex+1),step_id:ids[state.stepIndex]});document.getElementById('progress-label').textContent='';if(state.screen==='lead')renderLead();else if(state.screen==='result')resultView();else questionView();window.scrollTo({top:0,behavior:'auto'});}
window.addEventListener('online',()=>void flush());render();
})();

/* SOURCE: gtm-bootstrap.js */
if (!window.RX_CONFIG?.testMode) {
// Same GTM bootstrap, kept after RX initialization by ordered defer.
/* GTM antigo (GTM-MZBZ9HCS) removido */

}

;