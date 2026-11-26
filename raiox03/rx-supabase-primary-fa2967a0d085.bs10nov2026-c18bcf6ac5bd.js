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
  campaignTag: "BS10NOV2026", // Tag comercial da Semana 17 cadastrada no Dash (20 a 26/10/2026).
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
  const cfg=w.RX_CONFIG={...oldConfig,version:'raiox-direct-v4.4-direct10',pageBuild:'raiox03-lead-first-20261031',entryVariant:'lead_first_v1',flowVersion:'raiox03-direct10-v1',
    webhookUrl:'https://nklqcamhkwqictdmictb.supabase.co/functions/v1/raiox03-collect',
    source:'quiz_raiox03',launch:'raiox03_2026_10',resumeSession:oldConfig.resumeSession!==false,
    testMode:oldConfig.testMode===true||new URLSearchParams(w.location.search).get('rx_test')==='1',
    consentVersion:oldConfig.consentVersion||'rx03-2026-10-07',maxRetries:2,webhookTimeoutMs:18000};
  if(w.__RX_DIRECT_V4_INSTALLED)throw new Error('rx_tracking_loaded_twice');
  w.__RX_DIRECT_V4_INSTALLED=true;
  const expectedSteps=["situation","judgment_error","attention_focus","emotional_value","recurring_signal","desired_discovery","first_result","intuition_ignored","learning_support","offer_interest"];
  const expectedQuestions=["situation","judgment_error","attention_focus","emotional_value","recurring_signal","desired_discovery","first_result","intuition_ignored","learning_support","offer_interest"];
  let registeredSteps=null,lastDeliveryError=null;
  function registerSteps(steps){
    if(!Array.isArray(steps)||steps.length!==10||steps.some((s,i)=>s?.id!==expectedSteps[i]))throw new Error('quiz_catalog_incompatible');
    for(const s of steps){if(expectedQuestions.includes(s.id)&&(!Array.isArray(s.options)||s.options.length!==4||
      s.options.some(o=>typeof o?.label!=='string'||!o.label.trim()||o.label.length>1000)))throw new Error('quiz_catalog_incompatible');}
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
        if(raw.length!==10||new Set(raw.map(x=>x?.question_id)).size!==10)throw new Error('incomplete_snapshot');
        v.answers=expectedQuestions.map(id=>{const a=raw.find(x=>x?.question_id===id);if(!a)throw new Error('incomplete_snapshot');return answerRecord(id,a.option_index,a);});
      }else{
        if(Object.keys(raw).length!==10||expectedQuestions.some(id=>!Object.prototype.hasOwnProperty.call(raw,id)))throw new Error('incomplete_snapshot');
        v.answers=expectedQuestions.map(id=>answerRecord(id,raw[id]));
      }
    }
    if(name==='quiz_answer'||name==='quiz_complete'){
      const a=v.completed_steps;
      if(!Array.isArray(a)||!a.length||a.length>10||a.some((id,i)=>id!==expectedSteps[i])||
        (name==='quiz_complete'&&a.length!==10)||(name==='quiz_answer'&&a[a.length-1]!==v.question_id))throw new Error('invalid_step_snapshot');
    }
    if(name==='quiz_insight_continue'&&!['insight_precision','insight_signals','insight_ready'].includes(v.step_id))throw new Error('invalid_step');
    return v;
  }
  function reportError(e,p){
    lastDeliveryError={code:String(e?.message||'delivery_failed').slice(0,100),status:Number(e?.status)||null,event_name:p.event_name,event_id:p.event_id};
    w.dispatchEvent(new CustomEvent('rx:delivery-error',{detail:{...lastDeliveryError}}));
  }
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16); });
  const storageKey='rx03_runtime_direct10_v1_'+cfg.launch+'_'+(cfg.testMode?'test':'prod');
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
    const ids=["situation","judgment_error","attention_focus","emotional_value","recurring_signal","desired_discovery","first_result","intuition_ignored","learning_support","offer_interest"];
    const qs=["situation","judgment_error","attention_focus","emotional_value","recurring_signal","desired_discovery","first_result","intuition_ignored","learning_support","offer_interest"];
    if(!value || value.leadSaved!==true || !['step','loading','result'].includes(value.screen))return;
    const completed=value.completedSteps;
    if(!Array.isArray(completed)||completed.length>10||completed.some((id,i)=>id!==ids[i]))return;
    const indexes={}; for(const q of qs){const i=value.answerIndexes?.[q];if(Number.isInteger(i)&&i>=0&&i<=3)indexes[q]=i;}
    checkpoint={screen:value.screen,stepIndex:Math.min(10,Math.max(0,Number(value.stepIndex)||0)),leadSaved:true,
      completedSteps:completed.slice(),answerIndexes:indexes,resultViewed:value.resultViewed===true,checkoutClicked:value.checkoutClicked===true};
    persistRuntime();
  }
  function getCheckpoint(){
    const x=checkpoint,ids=["situation","judgment_error","attention_focus","emotional_value","recurring_signal","desired_discovery","first_result","intuition_ignored","learning_support","offer_interest"];
    if(!token||!x||x.leadSaved!==true||!['step','loading','result'].includes(x.screen)
      ||!Array.isArray(x.completedSteps)||x.completedSteps.length>10||x.completedSteps.some((id,i)=>id!==ids[i])
      ||!x.answerIndexes||typeof x.answerIndexes!=='object'||Array.isArray(x.answerIndexes))return null;
    const indexes={};
    for(const q of ["situation","judgment_error","attention_focus","emotional_value","recurring_signal","desired_discovery","first_result","intuition_ignored","learning_support","offer_interest"]){
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
    if(name==='quiz_complete' && !cfg.testMode && (result.quiz_status?.finalizou!==true || result.quiz_status?.status!=='concluido' || result.quiz_status?.perguntas_respondidas!==10 || result.quiz_status?.etapas_concluidas!==10)){const e=new Error('completion_not_confirmed');reportError(e,pending.p);throw e;}
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
    if(digits.length===10||digits.length===11)return '+55'+digits;
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
  w.RX={registerSteps,getDiagnostics:()=>({collection_policy:telemetryPolicy.version,build:cfg.pageBuild,endpoint:cfg.webhookUrl,launch:cfg.launch,test_mode:cfg.testMode,session_id:sessionId,session_confirmed:!!token,status:latestStatus?{...latestStatus}:null,last_error:lastDeliveryError?{...lastDeliveryError}:null,catalog_ready:(()=>{try{getSteps();return true;}catch{return false;}})()}),emit,saveLead,stageProgress,saveProgress,saveCheckpoint,getCheckpoint,checkoutSck,getSavedStatus:()=>latestStatus,publicEvent,normalizePhone,setContext,bindVturb,showConsent,safeUrl,getAttribution:currentAttribution,getSessionId:()=>sessionId,getTestMode:()=>cfg.testMode===true};
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

/* SOURCE: raiox03.js */
const RAIOX_CONFIG = {
  checkoutUrl: "https://lastlink.com/p/CC503A9CD/checkout-payment/",
  leadWebhookUrl: window.RX_CONFIG.webhookUrl,
  source: "quiz_raiox03",
  workshopDateText: "Terça e quarta, às 20h · ao vivo",
  priceText: "R$37",
  ctaDelaySeconds: 60
};

function checkoutPrefillKey() {
  return `rx03_checkout_prefill_${state?.submissionId || window.RX.getSessionId()}`;
}

function saveCheckoutPrefill(lead) {
  if (!lead) return;
  try {
    sessionStorage.setItem(checkoutPrefillKey(), JSON.stringify({
      name: String(lead.name || "").trim(),
      email: String(lead.email || "").trim().toLowerCase(),
      phone: String(lead.phone || "").trim()
    }));
  } catch (_) {}
}

function getCheckoutPrefill() {
  if (state?.lead?.email) return state.lead;
  try {
    const raw = sessionStorage.getItem(checkoutPrefillKey());
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;
    const email = String(saved.email || "").trim().toLowerCase();
    const name = String(saved.name || "").trim();
    const phone = String(saved.phone || "").trim();
    if (!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return { name, email, phone };
  } catch (_) {
    return null;
  }
}

function splitBrazilPhoneForCheckout(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  return { areaCode: digits.slice(0, 2), number: digits.slice(2) };
}

const VSL_PLAYERS = {
  terapeuta: {
    id: "vid-6abe93baef1e567f6a5759c7",
    scriptUrl: "https://scripts.converteai.net/a07c65c7-f155-44ff-8522-402ada1630b9/players/6abe93baef1e567f6a5759c7/v4/player.js"
  },
  nao_terapeuta: {
    id: "vid-6abe93baef1e567f6a5759c7",
    scriptUrl: "https://scripts.converteai.net/a07c65c7-f155-44ff-8522-402ada1630b9/players/6abe93baef1e567f6a5759c7/v4/player.js"
  }
};

const STEPS = [
  {
    "id": "situation",
    "type": "question",
    "label": "Pergunta 1",
    "text": "Hoje, qual dessas opções mais combina com você?",
    "options": [
      {
        "label": "Sou terapeuta e atendo pessoas",
        "profile": "terapeuta"
      },
      {
        "label": "Trabalho com atendimento, vendas ou liderança",
        "profile": "profissional_de_pessoas"
      },
      {
        "label": "Ainda não atuo, mas quero entender melhor as pessoas",
        "profile": "futuro_terapeuta"
      },
      {
        "label": "Quero usar isso principalmente na minha vida pessoal",
        "profile": "vida_pessoal"
      }
    ]
  },
  {
    "id": "judgment_error",
    "type": "question",
    "label": "Pergunta 2",
    "text": "O que mais te incomoda quando você percebe que julgou uma pessoa errado?",
    "options": [
      {
        "label": "Descobrir tarde demais quem ela era"
      },
      {
        "label": "Não ter percebido sinais óbvios"
      },
      {
        "label": "Ter confiado além do que deveria"
      },
      {
        "label": "Não saber explicar por que algo parecia estranho"
      }
    ]
  },
  {
    "id": "attention_focus",
    "type": "question",
    "label": "Pergunta 3",
    "text": "Quando você conhece alguém, qual é a primeira coisa que costuma observar?",
    "options": [
      {
        "label": "No que ela fala"
      },
      {
        "label": "No comportamento"
      },
      {
        "label": "No rosto e expressões"
      },
      {
        "label": "Eu ainda não sei exatamente onde olhar"
      }
    ]
  },
  {
    "id": "emotional_value",
    "type": "question",
    "label": "Pergunta 4",
    "text": "Se você conseguisse identificar padrões emocionais rapidamente, onde isso teria mais valor para você?",
    "options": [
      {
        "label": "Nos meus atendimentos"
      },
      {
        "label": "Nos meus relacionamentos"
      },
      {
        "label": "Na minha vida profissional"
      },
      {
        "label": "Para entender melhor a mim mesmo"
      }
    ]
  },
  {
    "id": "recurring_signal",
    "type": "question",
    "label": "Pergunta 5",
    "text": "Qual é a sua maior dificuldade hoje ao tentar interpretar os sinais de uma pessoa?",
    "options": [
      {
        "label": "Percebo que algo não combina com o que ela fala"
      },
      {
        "label": "Só entendo o padrão depois de muito tempo"
      },
      {
        "label": "Percebo sinais, mas não sei o que eles significam"
      },
      {
        "label": "Fico em dúvida se posso confiar no que percebi"
      }
    ]
  },
  {
    "id": "desired_discovery",
    "type": "question",
    "label": "Pergunta 6",
    "text": "O que você mais gostaria de descobrir olhando uma pessoa?",
    "options": [
      {
        "label": "Como ela reage sob pressão"
      },
      {
        "label": "Quais padrões emocionais ela repete"
      },
      {
        "label": "Como ela se relaciona com outras pessoas"
      },
      {
        "label": "O que o corpo e o rosto revelam além do discurso"
      }
    ]
  },
  {
    "id": "first_result",
    "type": "question",
    "label": "Pergunta 7",
    "text": "Se você aprendesse essa habilidade, qual seria o primeiro resultado que gostaria de ter?",
    "options": [
      {
        "label": "Atender melhor meus pacientes"
      },
      {
        "label": "Evitar escolhas ruins em relacionamentos"
      },
      {
        "label": "Tomar decisões profissionais melhores"
      },
      {
        "label": "Entender melhor meu próprio comportamento"
      }
    ]
  },
  {
    "id": "intuition_ignored",
    "type": "question",
    "label": "Pergunta 8",
    "text": "Quando sua percepção diz que algo não está certo em alguém, o que costuma acontecer?",
    "options": [
      {
        "label": "Confio na minha percepção e observo melhor"
      },
      {
        "label": "Percebo, mas ainda fico em dúvida"
      },
      {
        "label": "Costumo ignorar e só confirmo depois"
      },
      {
        "label": "Raramente percebo esse tipo de sinal"
      }
    ]
  },
  {
    "id": "learning_support",
    "type": "question",
    "label": "Pergunta 9",
    "text": "O que mais ajudaria você a aplicar esse aprendizado na prática?",
    "options": [
      {
        "label": "Ver exemplos explicados de conversas e atendimentos."
      },
      {
        "label": "Ter uma sequência clara do que observar."
      },
      {
        "label": "Entender como levar o conteúdo para a minha rotina."
      },
      {
        "label": "Conhecer melhor a metodologia e seus limites."
      }
    ]
  },
  {
    "id": "offer_interest",
    "type": "question",
    "label": "Pergunta 10",
    "text": "O Workshop Raio-X Humano tem investimento de R$ 37. Qual próximo passo faz sentido para você?",
    "options": [
      {
        "label": "Quero conhecer os detalhes e garantir minha participação."
      },
      {
        "label": "Quero assistir à apresentação antes de decidir."
      },
      {
        "label": "Tenho interesse, mas ainda preciso esclarecer dúvidas."
      },
      {
        "label": "Por enquanto, estou apenas explorando o assunto."
      }
    ]
  }
];

const RESULTS = {
  terapeuta: {
    badge: "Perfil: terapeuta",
    title: "Seu atendimento pode começar antes da primeira pergunta.",
    paragraphs: [
      "Hoje, boa parte da sua compreensão provavelmente depende do que o paciente conta, da forma como ele se comporta durante a sessão e da sua experiência clínica.",
      "Mas o rosto e o corpo podem oferecer novos indícios antes mesmo do relato.",
      "Desenvolver esse olhar pode ajudar você a identificar traços de caráter, mecanismos de defesa, forças e possíveis dores emocionais para conduzir o atendimento com mais precisão."
    ]
  },
  futuro_terapeuta: {
    badge: "Perfil: nova atuação",
    title: "Você pode começar sua trajetória aprendendo a enxergar o que a maioria ainda não observa.",
    paragraphs: [
      "Suas respostas mostram que você não quer apenas acumular teoria sobre comportamento humano.",
      "Você deseja desenvolver uma habilidade prática: olhar para o rosto e para o corpo e saber quais características observar para levantar hipóteses sobre personalidade, traços de caráter e comportamento.",
      "Esse pode ser o primeiro passo para descobrir se essa habilidade faz sentido na sua futura atuação."
    ]
  },
  profissional_de_pessoas: {
    badge: "Perfil: leitura aplicada",
    title: "Você toma decisões sobre pessoas todos os dias, muitas vezes baseado apenas no que elas dizem.",
    paragraphs: [
      "Em contratações, negociações, vendas e liderança, o discurso é apenas uma parte da informação.",
      "Uma pessoa pode apresentar determinadas tendências no formato do corpo, no rosto e na maneira como sua estrutura física se organiza.",
      "Aprender a observar esses sinais pode trazer mais discernimento antes de contratar, delegar, negociar ou construir uma parceria."
    ]
  },
  vida_pessoal: {
    badge: "Perfil: escolhas e relacionamentos",
    title: "Talvez os sinais que você percebeu tarde demais já estivessem visíveis desde o início.",
    paragraphs: [
      "Suas respostas mostram que uma leitura mais treinada poderia ajudar você a escolher melhor quem entra na sua vida, compreender pessoas próximas e reconhecer determinados padrões antes de se envolver profundamente.",
      "A proposta não é viver desconfiando. É desenvolver critérios para enxergar além da primeira impressão e do discurso."
    ]
  }
};

const root = document.querySelector("#quiz-root");
const progressLabel = document.querySelector("#progress-label");
let state = createState();
// Resume only the state whose previous requests were acknowledged; no PII is restored.
const resumed=RX.getCheckpoint();
if(resumed && resumed.leadSaved && resumed.completedSteps.every((id,i)=>STEPS[i]?.id===id)){
  const count=resumed.completedSteps.length;
  const consistent=STEPS.filter(s=>s.type==='question'&&resumed.completedSteps.includes(s.id))
    .every(s=>Number.isInteger(resumed.answerIndexes[s.id])&&resumed.answerIndexes[s.id]>=0&&resumed.answerIndexes[s.id]<s.options.length);
  if(consistent){
    state={...state,...resumed,lead:null,stepIndex:count,screen:count<STEPS.length?'step':resumed.screen==='result'?'result':'loading'};
    for(const step of STEPS.filter(s=>s.type==='question')){
      const idx=state.answerIndexes[step.id];if(Number.isInteger(idx)&&step.options[idx])state.answers[step.id]=step.options[idx].label;
    }
    state.profile=STEPS.find(s=>s.id==='situation')?.options[state.answerIndexes.situation]?.profile||'';
  }
}


function createState() {
  const startedAt = new Date().toISOString();
  return {
    screen: "lead",
    stepIndex: 0,
    lead: null,
    leadSaved: false,
    answers: {},
    answerIndexes: {},
    completedSteps: [], // Etapas efetivamente respondidas/continuadas nesta tentativa.
    profile: "",
    utms: getTrackingParams(),
    submissionId: window.RX.getSessionId(),
    firstSentAt: startedAt,
    captureViewed: false,
    resultViewed: false,
    checkoutClicked: false
  };
}

let leadSavePromise = null;
let leadSaveInFlight = false;
let leadPersistenceBlocked = false;
let leadRetryTimer = null;
let leadRetryAttempt = 0;
let leadSaveErrorReported = false;
const LEAD_RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000, 60000];
const pendingOperationalSaves = new Map();
let lastAcknowledgedCheckpoint = null;

function makeAcknowledgedCheckpoint() {
  return {
    screen: state.screen,
    stepIndex: state.stepIndex,
    leadSaved: true,
    completedSteps: [...state.completedSteps],
    answerIndexes: {...state.answerIndexes},
    resultViewed: state.resultViewed === true,
    checkoutClicked: state.checkoutClicked === true
  };
}

function acknowledgeCheckpoint(snapshot) {
  if (lastAcknowledgedCheckpoint && snapshot.completedSteps.length < lastAcknowledgedCheckpoint.completedSteps.length) return;
  lastAcknowledgedCheckpoint = snapshot;
  if (state.leadSaved) RX.saveCheckpoint(snapshot);
}

function requireStoredAck(result) {
  if (!result || result.ok !== true || result.stored !== true) throw new Error("persistence_not_confirmed");
  return result;
}

function clearLeadRetryTimer() {
  if (leadRetryTimer) window.clearTimeout(leadRetryTimer);
  leadRetryTimer = null;
}

function scheduleLeadRetry() {
  if (state.leadSaved || leadPersistenceBlocked || !state.lead || leadRetryTimer) return;
  if (leadRetryAttempt >= LEAD_RETRY_DELAYS_MS.length) return;
  const delay = LEAD_RETRY_DELAYS_MS[leadRetryAttempt++];
  leadRetryTimer = window.setTimeout(() => {
    leadRetryTimer = null;
    void attemptLeadSave();
  }, delay);
}

function attemptLeadSave(honey = "") {
  if (state.leadSaved) return Promise.resolve(true);
  if (leadSaveInFlight && leadSavePromise) return leadSavePromise;
  if (leadPersistenceBlocked || !state.lead) return Promise.resolve(false);
  leadPersistenceBlocked = Boolean(String(honey || "").trim());
  leadSaveInFlight = true;
  const submittedLead = {...state.lead};
  // Saving is independent from screen navigation; RX keeps the same event ID on retry.
  leadSavePromise = RX.saveLead(submittedLead, honey)
    .then(result => {
      requireStoredAck(result);
      state.leadSaved = true;
      clearLeadRetryTimer();
      leadRetryAttempt = 0;
      if (lastAcknowledgedCheckpoint) RX.saveCheckpoint(lastAcknowledgedCheckpoint);
      clearSyncNotice();
      return true;
    })
    .catch(() => {
      state.leadSaved = false;
      if (!leadSaveErrorReported) {
        leadSaveErrorReported = true;
        RX.emit("rx_form_submit_error", {error_code:leadPersistenceBlocked ? "invalid_form" : "save_failed"});
      }
      showSyncNotice();
      scheduleLeadRetry();
      return false;
    })
    .finally(() => { leadSaveInFlight = false; });
  return leadSavePromise;
}

function queueOperationalSave(key, name, details, checkpoint, options = {}) {
  const requiresLead = options.requiresLead !== false;
  RX.stageProgress(name, details);
  const item = {name, details, checkpoint, requiresLead, promise: null};
  item.promise = (requiresLead ? ensureLeadSaved() : Promise.resolve(true))
    .then(() => RX.saveProgress(name, details))
    .then(() => {
      acknowledgeCheckpoint(checkpoint);
      pendingOperationalSaves.delete(key);
      return true;
    })
    .catch(() => { showSyncNotice(); scheduleProgressRetry(); return false; });
  pendingOperationalSaves.set(key, item);
}

async function ensureLeadSaved() {
  if (state.leadSaved) return true;
  if (leadSaveInFlight && leadSavePromise && await leadSavePromise) return true;
  throw new Error("lead_not_confirmed");
}

async function flushOperationalSaves() {
  await ensureLeadSaved();
  for (const [key, item] of [...pendingOperationalSaves.entries()]) {
    let saved = await item.promise;
    if (!saved) {
      try {
        if (item.requiresLead !== false) await ensureLeadSaved();
        await RX.saveProgress(item.name, item.details);
        saved = true;
      } catch (_) {
        saved = false;
      }
    }
    if (!saved) throw new Error("progress_not_confirmed");
    acknowledgeCheckpoint(item.checkpoint);
    pendingOperationalSaves.delete(key);
  }
}

window.addEventListener("online", () => {
  if (state.lead && !state.leadSaved && !leadPersistenceBlocked) void attemptLeadSave();
  if (state.leadSaved && pendingOperationalSaves.size) void flushOperationalSaves().catch(() => {});
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && state.lead && !state.leadSaved && !leadPersistenceBlocked) void attemptLeadSave();
});
window.addEventListener("pagehide", () => {
  if (state.lead && !state.leadSaved && !leadPersistenceBlocked) void attemptLeadSave();
});


// Network failures never stop an answer click; failed writes remain pending.
let progressRetryTimer = null;
let progressFlushPromise = null;
let progressRetryAttempt = 0;
function showSyncNotice() {
  if (document.getElementById('rx-sync-notice')) return;
  const notice = document.createElement('aside');
  notice.id = 'rx-sync-notice'; notice.setAttribute('role', 'status');
  notice.append('O envio está demorando. Você pode continuar; mantenha esta página aberta enquanto salvamos. ');
  const retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = 'Tentar enviar novamente';
  retry.onclick = () => {
    if (!state.leadSaved) void attemptLeadSave();
    void retryProgress();
    if (state.screen === 'result') keepFinalizingInBackground();
  };
  notice.append(retry); root.after(notice);
}
function clearSyncNotice() {
  if (state.leadSaved && !pendingOperationalSaves.size) document.getElementById('rx-sync-notice')?.remove();
}
function scheduleProgressRetry() {
  if (progressRetryTimer || progressRetryAttempt >= LEAD_RETRY_DELAYS_MS.length) return;
  progressRetryTimer = window.setTimeout(() => {
    progressRetryTimer = null; void retryProgress();
  }, LEAD_RETRY_DELAYS_MS[progressRetryAttempt++]);
}
function retryProgress() {
  if (progressFlushPromise) return progressFlushPromise;
  progressFlushPromise = flushOperationalSaves().then(() => {
    progressRetryAttempt = 0; clearSyncNotice();
  }).catch(() => { showSyncNotice(); scheduleProgressRetry(); })
    .finally(() => { progressFlushPromise = null; });
  return progressFlushPromise;
}
function getTrackingParams() {
  return window.RX.getAttribution();
}


const QUESTION_STEPS = STEPS.filter(step => step.type === "question");
const INSIGHT_STEPS = STEPS.filter(step => step.type === "insight");

function answeredQuestionCount() {
  return QUESTION_STEPS.filter(step => state.completedSteps.includes(step.id)).length;
}

function questionNumberFor(step) {
  return QUESTION_STEPS.findIndex(item => item.id === step.id) + 1;
}

function insightNumberFor(step) {
  return INSIGHT_STEPS.findIndex(item => item.id === step.id) + 1;
}

function questionProgressPercent() {
  return Math.round((answeredQuestionCount() / QUESTION_STEPS.length) * 100);
}

function responseValue(id, fallback = "Ainda não definido") {
  return state.answers[id] || fallback;
}

function deriveResultProfile() {
  const step = STEPS.find(item => item.id === "situation");
  const optionIndex = state.answerIndexes.situation;
  const option = Number.isInteger(optionIndex) ? step?.options?.[optionIndex] : null;
  return option?.profile || state.profile || "vida_pessoal";
}

function confirmationItems(stepId) {
  if (stepId === "insight_precision") {
    return [
      {label:"Onde essa leitura teria mais valor agora", value:responseValue("situation")},
      {label:"O que mais pesa quando você julga alguém errado", value:responseValue("judgment_error")}
    ];
  }
  if (stepId === "insight_signals") {
    return [
      {label:"Onde seu olhar vai primeiro", value:responseValue("attention_focus")},
      {label:"Onde identificar padrões teria mais valor", value:responseValue("emotional_value")},
      {label:"Sua maior dificuldade de interpretação", value:responseValue("recurring_signal")}
    ];
  }
  return [
    {label:"O que você mais quer descobrir", value:responseValue("desired_discovery")},
    {label:"O primeiro resultado que você busca", value:responseValue("first_result")},
    {label:"Como você reage à própria percepção", value:responseValue("intuition_ignored")}
  ];
}

function renderConfirmationItems(items) {
  return items.map(item => `
    <div class="confirmation-answer">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("");
}

function resultHighlights() {
  return [
    {label:"Onde essa habilidade teria mais valor", value:responseValue("emotional_value", responseValue("situation"))},
    {label:"O que você mais quer identificar", value:responseValue("desired_discovery")},
    {label:"Primeiro resultado que você procura", value:responseValue("first_result")}
  ];
}

function renderResultHighlights() {
  return resultHighlights().map(item => `
    <div class="result-highlight">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("");
}

function panel(content) { return `<section class="screen panel"><div class="panel-inner">${content}</div></section>`; }

let resultResourcesPrepared = false;
function prepareResultResources() {
  if (resultResourcesPrepared) return;
  resultResourcesPrepared = true;
  // Download only; the original renderResult still binds and starts the player.
  const hints = [{"href":"https://scripts.converteai.net/a07c65c7-f155-44ff-8522-402ada1630b9/players/6abe93baef1e567f6a5759c7/v4/player.js","as":"script"},{"href":"https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js","as":"script"},{"href":"https://cdn.converteai.net/a07c65c7-f155-44ff-8522-402ada1630b9/6abe931f60218bc6eafa5b96/main.m3u8","as":"fetch"}];
  for (const hint of hints) {
    if ([...document.querySelectorAll('link[rel="preload"]')].some(link => link.href === hint.href)) continue;
    const link = document.createElement("link");
    link.rel = "preload"; link.href = hint.href; link.as = hint.as;
    link.dataset.rxResultPreload = "1";
    document.head.appendChild(link);
  }
}

function render() {
  window.scrollTo({ top: 0, behavior: "instant" });
  updateProgress();
  const current=STEPS[state.stepIndex];
  RX.setContext({screen:state.screen,step_index:Math.min(STEPS.length,state.stepIndex+1),step_id:current?.id,step_type:current?.type});
  if (state.screen === "step" && state.stepIndex >= 8) prepareResultResources();
  if (state.screen === "lead") return renderLead();
  if (state.screen === "opening") return renderOpening();
  if (state.screen === "step") return renderStep();
  if (state.screen === "loading") return renderLoading();
  return renderResult();
}

function updateProgress() {
  if (state.screen !== "step") {
    progressLabel.textContent = "";
    return;
  }
  const step = STEPS[state.stepIndex];
  if (!step) {
    progressLabel.textContent = "";
    return;
  }
  progressLabel.textContent = step.type === "question"
    ? `Pergunta ${questionNumberFor(step)} de ${QUESTION_STEPS.length}`
    : `Análise ${insightNumberFor(step)} de ${INSIGHT_STEPS.length}`;
}

function renderLead() {
  const lead = state.lead || {};
  if (!root.querySelector("#lead-form")) root.innerHTML = panel(`
    <span class="eyebrow">Seu ponto de partida</span>
    <h1 class="opening-title">Comece seu <span>Raio-X.</span></h1>
    <p class="lead opening-promise">Preencha seu e-mail e WhatsApp para receber seu resultado ao final do quiz.</p>
    <div class="lead-capture-box">
      <form class="form" id="lead-form" novalidate>
        <div class="field"><label for="email">Digite seu melhor e-mail:</label><input id="email" name="email" type="email" inputmode="email" maxlength="254" autocomplete="email" placeholder="voce@email.com" value="${escapeHtml(lead.email || "")}" required></div>
        <div class="field">
          <label for="phone">Telefone (WhatsApp):</label>
          <div class="phone-field">
          <select id="country-code" name="country_code" aria-label="País e código DDI">
            <option value="+55" selected>🇧🇷 +55</option>
            <option value="+351">🇵🇹 +351</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+34">🇪🇸 +34</option>
            <option value="+54">🇦🇷 +54</option>
            <option value="+56">🇨🇱 +56</option>
            <option value="+598">🇺🇾 +598</option>
            <option value="+595">🇵🇾 +595</option>
            <option value="+52">🇲🇽 +52</option>
            <option value="+44">🇬🇧 +44</option>
            <option value="+39">🇮🇹 +39</option>
            <option value="+33">🇫🇷 +33</option>
            <option value="+49">🇩🇪 +49</option>
            <option value="+41">🇨🇭 +41</option>
            <option value="+43">🇦🇹 +43</option>
          </select>
          <input id="phone" name="phone" type="tel" inputmode="tel" maxlength="24" autocomplete="tel" placeholder="34 99999-9999" value="" required>
        </div>
      </div>
      <div class="rx-honey" aria-hidden="true"><label>Site<input name="company_website" tabindex="-1" autocomplete="off"></label></div>
      <div class="error" id="form-error" role="alert"></div>
        <div class="fixed-cta"><button class="button button-primary" id="lead-submit-button" type="submit">COMEÇAR MEU RAIO-X →</button></div>
      </form>
    </div>
    <p class="fine-print">Ao continuar, você solicita o cadastro no quiz e o uso dos dados e respostas para entregar o resultado e os próximos passos deste workshop. ${window.RX_CONFIG.privacyPolicyUrl ? `<a href="${escapeHtml(window.RX_CONFIG.privacyPolicyUrl)}" target="_blank" rel="noopener noreferrer">Política de privacidade</a>` : ""}</p>
  `);
  const leadForm=document.querySelector("#lead-form");
  const leadSubmitButton=document.querySelector("#lead-submit-button");
  leadForm.addEventListener("submit", handleLeadSubmit);
  leadForm.addEventListener("input", () => RX.emit("rx_form_start", {screen:"lead"}), {once:true});
  leadSubmitButton.addEventListener("pointerdown", (event) => {
    if (leadSubmitButton.disabled) return;
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      event.preventDefault();
      const active=document.activeElement;
      if(active && typeof active.blur==="function") active.blur();
      leadForm.requestSubmit(leadSubmitButton);
    }
  });
  delete root.dataset.rxPrerendered;
  RX.emit("rx_form_view", {screen:"lead", step_index:state.stepIndex+1});
  if(window.__RX03_PENDING_LEAD_SUBMIT){
    delete window.__RX03_PENDING_LEAD_SUBMIT;
    leadForm.requestSubmit(leadSubmitButton);
  }
}

async function handleLeadSubmit(event) {
  event.preventDefault();
  const element=event.currentTarget, button=element.querySelector('button[type="submit"]');
  if(button.disabled || leadSaveInFlight)return;
  RX.emit("rx_form_submit_attempt", {screen:"lead", step_index:state.stepIndex+1});
  const form=new FormData(element);
  const rawPhone=String(form.get("phone")||"").trim();
  const countryCode=String(form.get("country_code")||"+55").trim();
  const phoneDigits=rawPhone.replace(/\D/g,"");
  const combinedPhone=rawPhone.startsWith("+") ? rawPhone : countryCode + phoneDigits;
  const lead={name:"",email:String(form.get("email")||"").trim().toLowerCase(),phone:RX.normalizePhone(combinedPhone),marketing_contact:false};
  const error=validateLead(lead);
  if(error){document.querySelector("#form-error").textContent=error.message;RX.emit("rx_form_error",{error_code:error.code});return;}
  // Do not advance when the same anti-spam value would reject persistence.
  // Keep contact fields available and show a recoverable validation message.
  const honey=String(form.get("company_website")||"").trim();
  if(honey){
    document.querySelector("#form-error").textContent="Não foi possível validar o formulário. Atualize a página e tente novamente.";
    RX.emit("rx_form_error",{error_code:"invalid_form"});
    return;
  }
  button.disabled = true;
  document.querySelector("#form-error").textContent = "";
  state.lead = lead;
  state.leadSaved = false;
  saveCheckoutPrefill(lead);
  void attemptLeadSave(honey);
  state.captureViewed = true;
  state.screen="step";
  const active=document.activeElement;
  if(active && typeof active.blur==="function") active.blur();
  render();
  window.requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"auto"}));
}

function validateLead(lead) {
  if(!lead.email)return {code:"email_required",message:"Informe seu e-mail para continuar."};
  if(lead.email.length>254)return {code:"email_too_long",message:"O e-mail informado é muito longo."};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))return {code:"invalid_email",message:"Informe um e-mail válido."};
  if(!/^\+[1-9]\d{7,14}$/.test(lead.phone))return {code:"invalid_phone",message:"Confira o país e informe seu WhatsApp com DDD."};
  return null;
}

function renderOpening() {
  const step = STEPS[0];
  // Reuse the server-rendered first screen. Replacing it here restarts image/layout work.
  const openingButtons = [...root.querySelectorAll(".option[data-index]")];
  const canHydrateOpening = root.dataset.rxPrerendered === "direct-question-v2"
    && root.querySelector(".opening-title")
    && openingButtons.length === step.options.length
    && openingButtons.every((button, index) => Number(button.dataset.index) === index
      && button.textContent.trim() === step.options[index].label);
  if (!canHydrateOpening) root.innerHTML = panel(`
    <span class="eyebrow">Raio-X de Percepção</span>
    <h1 class="opening-title">Você percebe. <span>Mas sabe interpretar?</span></h1>
    <p class="lead opening-promise">Responda a 10 perguntas sobre o seu jeito de observar e o que você quer aprender. Conheça o resultado ao final.</p>
    <div class="quiz-progress-head">
      <span>Pergunta 1 de ${QUESTION_STEPS.length}</span>
      <strong>0% concluído</strong>
    </div>
    <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:0%"></div></div>
    <div class="start-cue" aria-hidden="true">
      <span class="start-cue-text">Escolha uma opção abaixo para começar</span>
      <span class="start-cue-arrow" style="color:#dc2626">↓</span>
    </div>
    <div class="question-number">${step.label}</div>
    <h2 class="question-title">${step.text}</h2>
    <div class="options" role="radiogroup" aria-label="${step.text}">
      ${step.options.map((option,index)=>`<button class="option" type="button" data-index="${index}">${option.label}</button>`).join("")}
    </div>
    <div class="diagnostic-promise">
      <strong>Seu resultado será montado com base nas suas respostas.</strong>
      <span>No final, você recebe o seu Raio-X de percepção.</span>
    </div>
    <p class="fine-print opening-result-note">Leva poucos minutos. Suas respostas serão usadas para montar o resultado exibido ao final.</p>
  `);
  delete root.dataset.rxPrerendered;
  document.querySelectorAll(".option").forEach((button)=>button.addEventListener("click",()=>{
    if(button.disabled)return;
    state.screen="step";
    RX.emit("quiz_start",{screen:"opening"});
    RX.emit("quiz_step_view",{step_id:step.id,step_index:1,step_type:step.type});
    answerStep(step,Number(button.dataset.index),button);
  }));
}
function renderStep() {
  const step = STEPS[state.stepIndex];
  const qNumber = questionNumberFor(step);
  const progress = Math.max(0, Math.round(((qNumber - 1) / QUESTION_STEPS.length) * 100));
  RX.emit("quiz_step_view", {step_id:step.id,step_index:state.stepIndex+1,step_type:step.type});
  if (step.type === "insight") return renderInsight(step, questionProgressPercent());
  root.innerHTML = panel(`
    <div class="quiz-progress-head">
      <span>Pergunta ${qNumber} de ${QUESTION_STEPS.length}</span>
      <strong>${progress}% concluído</strong>
    </div>
    <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${progress}%"></div></div>
    <div class="question-number">${step.label}</div>
    <h2 class="question-title">${step.text}</h2>
    <div class="options" role="radiogroup" aria-label="${step.text}">
      ${step.options.map((option, index) => `<button class="option" type="button" data-index="${index}">${option.label}</button>`).join("")}
    </div>
  `);
  document.querySelectorAll(".option").forEach((button) => button.addEventListener("click", () => answerStep(step, Number(button.dataset.index), button)));
}

function markStepCompleted(stepId) {
  if (!state.completedSteps.includes(stepId)) state.completedSteps.push(stepId);
}

function renderInsight(step, progress) {
  const analysisNumber = insightNumberFor(step);
  const items = confirmationItems(step.id);
  root.innerHTML = panel(`
    <div class="quiz-progress-head">
      <span>Análise ${analysisNumber} de ${INSIGHT_STEPS.length}</span>
      <strong>${progress}% do quiz respondido</strong>
    </div>
    <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${progress}%"></div></div>
    <span class="eyebrow">${step.eyebrow || "Confirmação"}</span>
    <h2 class="insight-title">${step.title}</h2>
    <p class="insight-body confirmation-lead">${step.body}</p>
    <div class="confirmation-grid">
      ${renderConfirmationItems(items)}
    </div>
    <div class="confirmation-next">
      <span>O que isso mostra até aqui</span>
      <strong>${step.footer}</strong>
    </div>
    <div class="fixed-cta"><button class="button button-primary" id="continue-button" type="button">${step.button}</button></div>
  `);
  RX.emit("quiz_insight_view", {step_id:step.id,step_index:state.stepIndex+1});
  document.querySelector("#continue-button").addEventListener("click", () => {
    const button=document.querySelector("#continue-button");
    if(!button || button.disabled || STEPS[state.stepIndex]?.id !== step.id)return;
    button.disabled=true;clearSaveError();
    const stepIndex=state.stepIndex+1;
    const details={step_id:step.id,step_index:stepIndex,step_type:step.type};
    markStepCompleted(step.id);
    state.stepIndex+=1;
    if(state.stepIndex>=STEPS.length)state.screen="loading";
    const checkpoint=makeAcknowledgedCheckpoint();
    queueOperationalSave("insight:"+step.id,"quiz_insight_continue",details,checkpoint);
    render();
  });
}

function clearSaveError(){document.querySelector("#quiz-save-error")?.remove();}
function showSaveError(message){
  clearSaveError();const box=document.createElement("p");box.id="quiz-save-error";box.className="error";box.setAttribute("role","alert");box.textContent=message;
  const target=document.querySelector(".panel-inner");if(target)target.appendChild(box);
}
function answerStep(step, optionIndex, button) {
  if(!button || button.disabled || STEPS[state.stepIndex]?.id !== step.id)return;
  const option=step.options[optionIndex];
  if(!option)return;
  document.querySelectorAll(".option").forEach(item=>item.disabled=true);button.classList.add("selected");clearSaveError();
  if(state.completedSteps.length===0 && step.id===STEPS[0].id) RX.emit("quiz_start",{screen:"step"});
  const stepIndex=state.stepIndex+1;
  const completed=state.completedSteps.includes(step.id)?[...state.completedSteps]:[...state.completedSteps,step.id];
  const details={question_id:step.id,option_index:optionIndex,answer_label:option.label,selected_profile:option.profile||undefined,step_index:stepIndex,option_count:step.options.length,completed_steps:completed};
  if(option.profile)state.profile=option.profile;
  state.answers[step.id]=option.label;
  state.answerIndexes[step.id]=optionIndex;
  markStepCompleted(step.id);
  const checkpoint=makeAcknowledgedCheckpoint();
  const isPreLeadQuestion = step.id === "situation" || step.id === "judgment_error";
  queueOperationalSave("answer:"+step.id,"quiz_answer",details,checkpoint,{requiresLead:!isPreLeadQuestion});
  RX.emit("quiz_step_complete",{step_id:step.id,step_index:stepIndex,step_type:step.type});
  state.stepIndex+=1;
  if(state.stepIndex>=STEPS.length) {
    state.screen="loading";
  }
  render();
}

let completionConfirmed=false;
let completionPromise=null;
let resultPreparationRunning=false;
let completionRetryTimer=null;
let completionRetryAttempt=0;
const COMPLETION_RETRY_DELAYS_MS=[1000,2000,5000,10000,20000,30000,60000];

function keepFinalizingInBackground(){
  if(completionConfirmed)return;
  if(completionRetryTimer)return;
  const run=async()=>{
    completionRetryTimer=null;
    if(completionConfirmed)return;
    const saved=await finalizeQuizInBackground();
    if(saved){
      completionRetryAttempt=0; clearSyncNotice();
      return;
    }
    const delay=COMPLETION_RETRY_DELAYS_MS[Math.min(completionRetryAttempt,COMPLETION_RETRY_DELAYS_MS.length-1)];
    completionRetryAttempt+=1;
    completionRetryTimer=window.setTimeout(run,delay);
  };
  void run();
}

async function finalizeQuizInBackground() {
  if(completionConfirmed)return true;
  if(completionPromise)return completionPromise;
  completionPromise=(async()=>{
    const finalAnswers=STEPS.filter(step=>step.type==="question").map(step=>{
      const optionIndex=state.answerIndexes[step.id],option=step.options[optionIndex];
      return {question_id:step.id,option_index:optionIndex,answer_label:option?.label||state.answers[step.id]||"",selected_profile:option?.profile||undefined};
    });
    const completionDetails={step_index:STEPS.length,answers:finalAnswers,completed_steps:[...state.completedSteps]};
    RX.stageProgress("quiz_complete",completionDetails);
    await ensureLeadSaved();
    await flushOperationalSaves();
    const result=await RX.saveProgress("quiz_complete",{step_index:STEPS.length,answers:finalAnswers,completed_steps:[...state.completedSteps]});
    if(!RX.getTestMode() && (result.quiz_status?.finalizou!==true || result.quiz_status?.status!=="concluido" || Number(result.quiz_status?.perguntas_respondidas)!==10 || Number(result.quiz_status?.etapas_concluidas)!==10))throw new Error("completion_not_confirmed");
    state.leadSaved=true;
    completionConfirmed=true;
    RX.saveCheckpoint({...state,screen:"result",resultViewed:true});
    return true;
  })().catch(()=>{
    window.addEventListener("online",()=>{void finalizeQuizInBackground();},{once:true});
    showSyncNotice();
    return false;
  }).finally(()=>{completionPromise=null;});
  return completionPromise;
}

function renderLoading() {
  // The result is local. Persistence and conversion confirmation continue independently.
  state.screen = "result";
  state.resultViewed = true;
  render();
  keepFinalizingInBackground();
}

function renderResult() {
  state.profile = deriveResultProfile();
  const result = RESULTS[state.profile] || RESULTS.vida_pessoal;
  const vslProfile = getVslProfile();
  const player = VSL_PLAYERS[vslProfile];
  root.innerHTML = panel(`
    <div class="result-simple result-vsl-reveal">
      <span class="result-badge">${result.badge}</span>
      <div class="result-vsl-intro">
        <span>Agora entenda o que suas respostas revelam</span>
        <strong>Assista ao vídeo abaixo para ver a explicação completa do seu resultado.</strong>
      </div>
      <div class="result-personal-context"><p><strong>Seu objetivo:</strong> ${escapeHtml(responseValue("first_result"))}.</p><p><strong>O apoio que você procura:</strong> ${escapeHtml(responseValue("learning_support").replace(/[.!?]+$/,""))}.</p></div>
      <div class="video-frame" aria-label="Vídeo do Workshop Raio-X Humano">
        <vturb-smartplayer id="${player.id}" style="display:block;margin:0 auto;width:100%;max-width:400px;">
          <div class="vturb-player-placeholder"></div>
        </vturb-smartplayer>
      </div>
      <div class="fixed-cta result-fixed-cta" id="checkout-cta">
        <a class="button button-primary" id="checkout-button" href="${buildCheckoutUrl()}" target="_blank" rel="noopener noreferrer">Garantir Minha Vaga</a>
        <div class="checkout-offer-copy">
          <span>Quer aprender a fazer essa leitura na prática?</span>
          <strong>No Workshop Raio-X Humano, você vai aprender ao vivo onde olhar e o que observar no rosto e no corpo.</strong>
          <p>Veja abaixo as condições do workshop.</p>
        </div>
        <div class="lot-grid" aria-label="Lotes do Workshop Raio-X Humano">
          <div class="lot-card lot-card-current">
            <span class="lot-label">1º lote</span>
            <strong>R$37</strong>
            <small>Encerra em breve</small>
          </div>
          <div class="lot-card">
            <span class="lot-label">2º lote</span>
            <strong>R$97</strong>
            <small>Em breve</small>
          </div>
          <div class="lot-card">
            <span class="lot-label">3º lote</span>
            <strong>R$197</strong>
            <small>Em breve</small>
          </div>
        </div>
      </div>
    </div>
  `);
  RX.bindVturb(document.getElementById(player.id));
  loadVturbPlayer(player);
  void ensureLeadSaved().then(() => RX.emit("quiz_result_view", {screen:"result"})).catch(() => {});
  RX.emit("view_item", {currency:"BRL",value:37,screen:"result"});
  window.setTimeout(() => {
    const cta=document.querySelector("#checkout-cta");
    if(cta){
      cta.classList.add("visible");
      RX.emit("rx_cta_view",{element_id:"checkout-button",cta_delay_seconds:RAIOX_CONFIG.ctaDelaySeconds});
      window.setTimeout(() => {
        const button=document.querySelector("#checkout-button");
        if(button){
          button.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "center"
          });
        }
      }, 250);
    }
  }, RAIOX_CONFIG.ctaDelaySeconds * 1000);
  document.querySelector("#checkout-button").addEventListener("click", () => {
    state.checkoutClicked = true;
    if (completionConfirmed) RX.saveCheckpoint(state);
    RX.emit("rx_checkout_click", {element_id:"checkout-button",link_domain:"lastlink.com",currency:"BRL",value:37});
  });
}

function getVslProfile() {
  return state.profile === "terapeuta" ? "terapeuta" : "nao_terapeuta";
}

function loadVturbPlayer(player) {
  if (!player || document.querySelector(`script[data-vturb-player="${player.id}"]`)) return;
  const script = document.createElement("script");
  script.src = player.scriptUrl;
  script.async = true;
  script.dataset.vturbPlayer = player.id;
  document.head.appendChild(script);
}

function buildCheckoutUrl() {
  const url = new URL(RAIOX_CONFIG.checkoutUrl);
  Object.entries(RX.getAttribution()).forEach(([key, value]) => url.searchParams.set(key, value));
  const pageMarker = "pg_raiox03";
  const currentContent = url.searchParams.get("utm_content") || "";
  if (!currentContent.split("~").filter(Boolean).includes(pageMarker)) url.searchParams.set("utm_content", currentContent ? currentContent + "~" + pageMarker : pageMarker);
  url.searchParams.set("src", RAIOX_CONFIG.source);
  if(RX_CONFIG.correlateCheckout)url.searchParams.set("sck",RX.checkoutSck(url.searchParams.get("sck")));

  const lead = getCheckoutPrefill();
  if (lead) {
    if (lead.name) url.searchParams.set("name", String(lead.name).trim());
    if (lead.email) url.searchParams.set("email", String(lead.email).trim().toLowerCase());

    const phone = splitBrazilPhoneForCheckout(lead.phone);
    if (phone) {
      if (url.hostname === "lastlink.com") {
        url.searchParams.set("phone", "+55" + phone.areaCode + phone.number);
      } else {
        url.searchParams.set("phoneac", phone.areaCode);
        url.searchParams.set("phonenumber", phone.number);
      }
    }
  }

  return url.toString();
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

render();

// Consume at most one opening click captured while the deferred runtime was downloading.
window.__rx03RuntimeReady = true;
if (window.__rx03EarlyClickHandler) {
  document.removeEventListener("click", window.__rx03EarlyClickHandler, true);
  delete window.__rx03EarlyClickHandler;
}
const rx03EarlyChoice = window.__rx03EarlyChoice;
delete window.__rx03EarlyChoice;
if (state.screen === "opening" && Number.isInteger(rx03EarlyChoice)) {
  const choice = root.querySelector('.option[data-index="' + rx03EarlyChoice + '"]');
  if (choice && !choice.disabled) choice.click();
}
try { performance.mark("rx03:runtime-ready"); } catch (_) {}

;

/* SOURCE: scripts/checkout-quality.js */
/* Quality evidence only. Never blocks navigation, changes page content or fires pixels. */
(() => {
  "use strict";
  const match = location.pathname.match(/^\/(pagina0[1-4]|raiox0[12])(?:\/|$)/i);
  if (!match || window.__RX_CHECKOUT_QUALITY_V1) return;
  window.__RX_CHECKOUT_QUALITY_V1 = true;
  const pageId = match[1].toLowerCase();
  const endpoint = "https://nklqcamhkwqictdmictb.supabase.co/functions/v1/sales-page-collect";
  const isUuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const inflight = new Set();
  let memory = {};
  let memorySession = "";
  const session = () => {
    try {
      const id = pageId.startsWith("raiox") ? window.RX?.getSessionId?.()
        : JSON.parse(sessionStorage.getItem(pageId + "_tracking_v1") || "null")?.session_id;
      return isUuid(id) ? id : null;
    } catch (_) { return null; }
  };
  const storageKey = sid => "rx_checkout_quality_v1_" + pageId + "_" + sid;
  const load = sid => {
    if (memorySession !== sid) { memory = {}; memorySession = sid; }
    try { const saved = JSON.parse(sessionStorage.getItem(storageKey(sid)) || "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) memory = saved;
    } catch (_) {}
    return memory;
  };
  const save = (sid, state) => { memory = state; try { sessionStorage.setItem(storageKey(sid), JSON.stringify(state)); } catch (_) {} };
  const send = async (sid, signature, record) => {
    if (inflight.has(record.payload.event_id)) return;
    inflight.add(record.payload.event_id);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(endpoint, {method:"POST",mode:"cors",credentials:"omit",keepalive:true,
            headers:{"Content-Type":"application/json"},body:JSON.stringify(record.payload),signal:controller.signal});
          const result = await response.json().catch(() => null);
          if(response.ok && result?.ok === true && result?.stored === true && result.event_id === record.payload.event_id && result.page_id === pageId) {
            const state = load(sid); state[signature] = {...record, delivered:true}; save(sid,state); return;
          }
          if (response.status < 500 && ![409,429].includes(response.status)) return;
        } catch (_) { /* Same event ID is retried; raw checkout is independent. */ }
        finally { clearTimeout(timer); }
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 400 * 2 ** attempt));
      }
    } finally { inflight.delete(record.payload.event_id); }
  };
  const retry = () => {
    const sid = session(); if (!sid) return;
    const state = load(sid);
    for(const [signature,record] of Object.entries(state).slice(0,8)) {
      if (record?.payload && !record.delivered && isUuid(record.payload.event_id)
        && record.payload.session_id === sid && record.payload.page_id === pageId
        && Date.now() - record.saved_at >= 0 && Date.now() - record.saved_at < 21600000) void send(sid,signature,record);
    }
  };
  const isCheckoutUrl = value => {
    try {
      const host = new URL(value, location.href).hostname.toLowerCase();
      return host === "lastlink.com" || host === "pay.hotmart.com" || host === "hub.la" || host.endsWith(".hub.la");
    } catch (_) {
      return false;
    }
  };
  document.addEventListener("click", event => {
    try {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!link || !isCheckoutUrl(link.href)) return;
      const sid = session(); if (!sid) return;
      const rect = link.getBoundingClientRect(), style = getComputedStyle(link);
      const properties = {
        quality_version:1, quality_evidence_only:true, cta_index:0,
        interaction_trusted:typeof event.isTrusted === "boolean" ? event.isTrusted : null,
        page_visible:typeof document.visibilityState === "string" ? document.visibilityState === "visible" : null,
        target_visible:style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
          && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth,
        automation_driver:typeof navigator.webdriver === "boolean" ? navigator.webdriver : null,
        user_activation:typeof navigator.userActivation?.isActive === "boolean" ? navigator.userActivation.isActive : null,
      };
      const signature = [properties.interaction_trusted,properties.page_visible,properties.target_visible,properties.automation_driver].map(String).join(":");
      const state = load(sid);
      if (!state[signature] && Object.keys(state).length >= 8) return;
      const testMode = window.RX?.getTestMode?.() === true || new URLSearchParams(location.search).get("rx_test") === "1";
      const record = state[signature] || {delivered:false,saved_at:Date.now(),payload:{
        event_id:crypto.randomUUID(), session_id:sid, event_name:"cta_click", page_id:pageId, source:pageId,
        lancamento:"QUALITY_EVIDENCE", occurred_at:new Date().toISOString(),
        page_url:location.origin + location.pathname, properties, test_mode:testMode,
      }};
      state[signature] = record; save(sid,state);
      if (!record.delivered) void send(sid,signature,record);
    } catch (_) { /* No interference with the customer's original click or payment. */ }
  }, {capture:true});
  window.addEventListener("online", retry);
  retry();
})();

;

/* SOURCE: gtm-bootstrap.js */
if (!window.RX_CONFIG?.testMode) {
// Same GTM bootstrap, kept after RX initialization by ordered defer.
/* GTM antigo (GTM-MZBZ9HCS) removido */

}

;