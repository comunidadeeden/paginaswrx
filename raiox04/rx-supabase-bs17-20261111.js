/* RX delivery v2: Supabase principal; conserva IDs, tokens e contrato nativo. */
(function(w){if(w.RXContingency)return;const native=w.fetch.bind(w);w.RXContingency={fetch:(url,options)=>native(url,options)};})(window);
/* rx-config.js */

/* Configuração pública: NUNCA coloque senhas, Hottok ou service_role aqui. */
window.RX_CONFIG = {
  version: "raiox-v3.0", // Protocolo mantido: compatível com o workflow V3 já importado.
  pageBuild: "2026-11-08-raiox04-heartbeat120",
  resumeSession: true, // Mesma aba, até 6 horas; sem nome/email/telefone no armazenamento local.
  sessionMaxAgeMs: 21600000,
  correlateCheckout: true, // Acrescenta marcador opaco ao sck, sem dados pessoais.
  heartbeatSeconds: 120, // Somente com medição opcional autorizada.
  webhookUrl: "https://nklqcamhkwqictdmictb.supabase.co/functions/v1/raiox04-collect",
  gtmId: "",
  testMode: false, // Produção. Use ?rx_test=1 para homologar sem gravar leads reais.
  source: "quiz_raiox04",
  launch: "raiox04_2026_10", // Contrato direto do Supabase. Não alterar sem atualizar a função de ingestão.
  campaignTag: "BS24NOV2026", // Tag comercial da Semana 17 cadastrada no Dash (20 a 26/10/2026).
  privacyPolicyUrl: "", // Insira a política real do controlador antes de publicar.
  consentVersion: "rx04-2026-09-29",
  webhookTimeoutMs: 12000,
  maxRetries: 2
};

// Homologação opcional sem editar código. ?rx_test=1 isola dados e bloqueia GA4/Meta.
if (new URLSearchParams(window.location.search).get("rx_test") === "1") window.RX_CONFIG.testMode = true;

/* rx-tracking.js */
/* Raio-X: coleta própria separada do dataLayer; nenhuma chave de banco no navegador. */
(function (w, d) {
  'use strict';
  // RX4: mantém a API RX do site salvo; troca somente o contrato/transporte.
  const oldConfig=w.RX_CONFIG||{};
  const cfg=w.RX_CONFIG={...oldConfig,version:'raiox-direct-v4.4',pageBuild:'rx4.4-tracking-clean-r1',
    webhookUrl:'https://nklqcamhkwqictdmictb.supabase.co/functions/v1/raiox04-collect',
    source:'quiz_raiox04',launch:'raiox04_2026_10',resumeSession:oldConfig.resumeSession!==false,
    testMode:oldConfig.testMode===true||new URLSearchParams(w.location.search).get('rx_test')==='1',
    consentVersion:oldConfig.consentVersion||'rx04-2026-09-29',maxRetries:2,webhookTimeoutMs:18000};
  if(w.__RX_DIRECT_V4_INSTALLED)throw new Error('rx_tracking_loaded_twice');
  w.__RX_DIRECT_V4_INSTALLED=true;
  const expectedSteps=['profile','body_reading','insight_body','desired_reading','face_reading','insight_face','consequence'];
  const expectedQuestions=['profile','body_reading','desired_reading','face_reading','consequence'];
  let registeredSteps=null,lastDeliveryError=null;
  function registerSteps(steps){
    if(!Array.isArray(steps)||steps.length!==7||steps.some((s,i)=>s?.id!==expectedSteps[i]))throw new Error('quiz_catalog_incompatible');
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
        if(raw.length!==5||new Set(raw.map(x=>x?.question_id)).size!==5)throw new Error('incomplete_snapshot');
        v.answers=expectedQuestions.map(id=>{const a=raw.find(x=>x?.question_id===id);if(!a)throw new Error('incomplete_snapshot');return answerRecord(id,a.option_index,a);});
      }else{
        if(Object.keys(raw).length!==5||expectedQuestions.some(id=>!Object.prototype.hasOwnProperty.call(raw,id)))throw new Error('incomplete_snapshot');
        v.answers=expectedQuestions.map(id=>answerRecord(id,raw[id]));
      }
    }
    if(name==='quiz_answer'||name==='quiz_complete'){
      const a=v.completed_steps;
      if(!Array.isArray(a)||!a.length||a.length>7||a.some((id,i)=>id!==expectedSteps[i])||
        (name==='quiz_complete'&&a.length!==7)||(name==='quiz_answer'&&a[a.length-1]!==v.question_id))throw new Error('invalid_step_snapshot');
    }
    if(name==='quiz_insight_continue'&&!['insight_body','insight_face'].includes(v.step_id))throw new Error('invalid_step');
    return v;
  }
  function reportError(e,p){
    lastDeliveryError={code:String(e?.message||'delivery_failed').slice(0,100),status:Number(e?.status)||null,event_name:p.event_name,event_id:p.event_id};
    w.dispatchEvent(new CustomEvent('rx:delivery-error',{detail:{...lastDeliveryError}}));
  }
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16); });
  const storageKey='rx04_runtime_v4_'+cfg.launch+'_'+(cfg.testMode?'test':'prod');
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
    const ids=['profile','body_reading','insight_body','desired_reading','face_reading','insight_face','consequence'];
    const qs=['profile','body_reading','desired_reading','face_reading','consequence'];
    if(!value || value.leadSaved!==true || !['step','loading','result'].includes(value.screen))return;
    const completed=value.completedSteps;
    if(!Array.isArray(completed)||completed.length>7||completed.some((id,i)=>id!==ids[i]))return;
    const indexes={}; for(const q of qs){const i=value.answerIndexes?.[q];if(Number.isInteger(i)&&i>=0&&i<=3)indexes[q]=i;}
    checkpoint={screen:value.screen,stepIndex:Math.min(7,Math.max(0,Number(value.stepIndex)||0)),leadSaved:true,
      completedSteps:completed.slice(),answerIndexes:indexes,resultViewed:value.resultViewed===true,checkoutClicked:value.checkoutClicked===true};
    persistRuntime();
  }
  function getCheckpoint(){
    const x=checkpoint,ids=['profile','body_reading','insight_body','desired_reading','face_reading','insight_face','consequence'];
    if(!token||!x||x.leadSaved!==true||!['step','loading','result'].includes(x.screen)
      ||!Array.isArray(x.completedSteps)||x.completedSteps.length>7||x.completedSteps.some((id,i)=>id!==ids[i])
      ||!x.answerIndexes||typeof x.answerIndexes!=='object'||Array.isArray(x.answerIndexes))return null;
    const indexes={};
    for(const q of ['profile','body_reading','desired_reading','face_reading','consequence']){
      const n=x.answerIndexes[q];if(n!=null){if(!Number.isInteger(n)||n<0||n>3)return null;indexes[q]=n;}
    }
    return {screen:x.screen,stepIndex:x.completedSteps.length,leadSaved:true,completedSteps:x.completedSteps.slice(),
      answerIndexes:indexes,resultViewed:x.resultViewed===true,checkoutClicked:x.checkoutClicked===true};
  }

  // Site configuration on the new domain; never records a visitor's consent action.
  const automaticTracking=/^(?:www\.)?eventoraioxhumano\.com$/i.test(w.location.hostname);
  let consent={analytics:automaticTracking&&!cfg.testMode,advertising:automaticTracking&&!cfg.testMode,marketing_contact:false,decided:false};
  try { const old=JSON.parse(localStorage.getItem('rx04_consent_v1')||'null'); if(old && old.version===cfg.consentVersion && Date.now()-old.saved_at<180*864e5) consent={...consent,...old.choices}; localStorage.removeItem('raiox04_lead'); } catch (_) {}
  const incoming=new URLSearchParams(w.location.search);
  const utmKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','utm_adset','utm_ad','src','sck','meta_campaign_id','meta_campaign_name','meta_adset_id','meta_adset_name','meta_ad_id','meta_ad_name','meta_creative_id','meta_creative_name','creative_code','meta_platform','meta_placement'];
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
    const params={session_id:sessionId};analyticKeys.forEach(k=>{const v=details[k];if(v===undefined||v===null)return;if(typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean')params[k]=v;else if(typeof v==='string'&&v.length<=100&&!v.includes('@'))params[k]=v;});
    const traffic={},a=currentAttribution();
    const trafficKeys={campaign_source:'utm_source',campaign_medium:'utm_medium',campaign_name:'utm_campaign',campaign_content:'utm_content',campaign_term:'utm_term',campaign_id:'utm_id'};
    Object.keys(trafficKeys).forEach(k=>{const raw=a[trafficKeys[k]],v=k==='campaign_id' && /^[A-Za-z0-9_-]{1,100}$/.test(raw||'') ? raw : safeText(raw);if(v)traffic[k]=v;});
    w.dataLayer.push({rx:null});
    w.dataLayer.push({event:'rx_event',rx:{name:name,event_id:id,session_id:sessionId,quiz_id:'raiox04',page_id:'raiox04',page_type:'quiz',launch:cfg.campaignTag||cfg.launch,technical_launch:cfg.launch,page_location:safeUrl(location.href),page_referrer:consent.analytics?safeUrl(d.referrer):'',source:'quiz_raiox04',analytics:options.analytics??consent.analytics,advertising:options.advertising??consent.advertising,test_mode:false,traffic:traffic,params:params}});
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
    return {integration_version:'raiox-v3.0',client_key:clientKey,schema_version:1,event_id:uid(),event_name:name,session_id:sessionId,session_token:token,sequence:seq,occurred_at:new Date().toISOString(),source:cfg.source,lancamento:cfg.launch,test_mode:cfg.testMode===true,page_url:safeUrl(location.href),referrer:consent.analytics?safeUrl(d.referrer):'',context:{...context},properties:{...(details||{}),collection_policy:'lean_v1',analytics_context:purchaseAnalytics()},attribution:currentAttribution(),consent:{analytics:consent.analytics,advertising:consent.advertising,marketing_contact:consent.marketing_contact,version:cfg.consentVersion,decided:consent.decided},device:consent.analytics?{language:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,viewport_width:innerWidth,viewport_height:innerHeight,screen_width:screen.width,screen_height:screen.height}:{},lead:lead||undefined};
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
    if(name==='quiz_complete' && !cfg.testMode && (result.quiz_status?.finalizou!==true || result.quiz_status?.status!=='concluido' || result.quiz_status?.perguntas_respondidas!==5 || result.quiz_status?.etapas_concluidas!==7)){const e=new Error('completion_not_confirmed');reportError(e,pending.p);throw e;}
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
    const normalized={email:String(lead.email||'').trim().toLowerCase(),telefone:normalizePhone(lead.phone),form_notice_version:cfg.consentVersion,honey:String(honey||'')};
    // Retentativa manual do mesmo cadastro conserva ID; dados alterados geram novo evento.
    if(!pendingLead||JSON.stringify(pendingLead.lead)!==JSON.stringify(normalized))pendingLead=payload('lead_submit',{},normalized);
    const p=pendingLead, result=await serial(p);
    publicEvent('lead_submit',p.event_id,{screen:'opening'});
    publicEvent(result.lead_created===true?'generate_lead':'rx_lead_existing',p.event_id,{screen:'opening'});
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
    if(!w.RXBoot.isReady()){w.RXBoot.afterPaint(ensureMetaBase);return;}
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
    try{localStorage.setItem('rx04_consent_v1',JSON.stringify({version:cfg.consentVersion,saved_at:Date.now(),choices:consent}));}catch(_){}
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
    el.innerHTML='<strong>Suas preferências de privacidade</strong><p>O formulário funciona sem cookies opcionais. Podemos medir a navegação e usar pixels de publicidade somente com sua autorização.</p><label><input type="checkbox" id="rx-analytics"> Medição de navegação</label><label><input type="checkbox" id="rx-ads"> Publicidade (Meta)</label><div><button type="button" id="rx-consent-save">Salvar escolhas</button><button type="button" id="rx-consent-no">Somente necessários</button><button type="button" id="rx-consent-all">Aceitar opcionais</button></div>';
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
    const marker=(cfg.testMode?'rx04test_':'rx04_')+sessionId.replace(/-/g,'');
    const source=String(existing||'').trim().replace(/(?:^|~)rx04(?:test)?_[0-9a-f]{32}(?=~|$)/gi,'').replace(/^~|~$/g,'');
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

/* raiox04.js */

const RAIOX_CONFIG = {
  checkoutUrl: "https://lastlink.com/p/CC503A9CD/checkout-payment/",
  leadWebhookUrl: window.RX_CONFIG.webhookUrl,
  source: "quiz_raiox04",
  workshopDateText: "Terça e quarta, às 20h · ao vivo",
  priceText: "R$37",
  ctaDelaySeconds: 60
};

function checkoutPrefillKey() {
  return `rx04_checkout_prefill_${state?.submissionId || window.RX.getSessionId()}`;
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
    id: "profile",
    type: "question",
    label: "Perfil",
    text: "Em qual situação seria mais valioso compreender uma pessoa antes da primeira conversa?",
    options: [
      { label: "Antes ou durante um atendimento terapêutico.", profile: "terapeuta" },
      { label: "Para começar uma nova atuação como terapeuta.", profile: "futuro_terapeuta" },
      { label: "Ao contratar, liderar, negociar, vender ou trabalhar com pessoas.", profile: "profissional_de_pessoas" },
      { label: "Antes de confiar, me envolver ou tomar decisões na vida pessoal.", profile: "vida_pessoal" }
    ]
  },
  {
    id: "body_reading",
    type: "question",
    label: "Seu olhar hoje",
    text: "Hoje, apenas olhando para o corpo de uma pessoa, você conseguiria identificar se ela tende a ser mais racional, emocional, estratégica, resistente ou perfeccionista?",
    options: [
      { label: "Sim, consigo identificar com alguma precisão." },
      { label: "Às vezes tenho uma impressão, mas não sei explicar de onde ela vem." },
      { label: "Consigo perceber algumas características, mas ainda tenho muitas dúvidas." },
      { label: "Não. Eu nem sabia que o formato do corpo poderia revelar esses traços." }
    ]
  },
  {
    id: "insight_body",
    type: "insight",
    title: "O corpo não mostra apenas aparência.",
    body: "Na metodologia apresentada no Workshop Raio-X Humano, diferentes formatos, proporções e características corporais são organizados em cinco grandes traços de caráter.",
    bullets: ["forças naturais", "dores emocionais", "mecanismos de defesa", "maneira de pensar", "forma de se relacionar", "tendências de comportamento"],
    footer: "Isso permite começar uma leitura antes mesmo de ouvir a história da pessoa.",
    button: "Continuar"
  },
  {
    id: "desired_reading",
    type: "question",
    label: "O que você busca",
    text: "O que você mais gostaria de conseguir identificar antes de uma pessoa falar?",
    options: [
      { label: "Como ela tende a reagir diante de pressão, críticas e conflitos." },
      { label: "Como ela se relaciona, demonstra afeto e cria vínculos." },
      { label: "Seus pontos fortes, suas dificuldades e a forma como toma decisões." },
      { label: "Possíveis marcas emocionais e mecanismos de defesa que ela carrega." }
    ]
  },
  {
    id: "face_reading",
    type: "question",
    label: "Leitura do rosto",
    text: "Se você recebesse agora a fotografia do rosto de uma pessoa, o que saberia observar?",
    options: [
      { label: "Diferenças entre o lado materno e o lado paterno do rosto." },
      { label: "Sinais na região dos olhos relacionados a peso, ausência ou manipulação." },
      { label: "Assimetrias que podem indicar experiências emocionais diferentes." },
      { label: "Sinceramente, eu não saberia por onde começar." }
    ]
  },
  {
    id: "insight_face",
    type: "insight",
    title: "O rosto também pode ser analisado por regiões.",
    body: "No Workshop, você vai conhecer uma leitura que divide o rosto em:",
    bullets: ["lado direito, relacionado à referência paterna", "lado esquerdo, relacionado à referência materna"],
    footer: "Você também vai aprender a observar indícios na região dos olhos que a metodologia associa a experiências como peso, ausência e manipulação. Não é apenas olhar para uma pessoa e sentir alguma coisa. É saber onde olhar e o que comparar.",
    button: "Quero continuar"
  },
  {
    id: "consequence",
    type: "question",
    label: "O erro que você evita",
    text: "Se você aprendesse a identificar personalidade e tendências de comportamento antes da primeira palavra, qual erro gostaria de evitar?",
    options: [
      { label: "Perder tempo confiando ou me envolvendo com a pessoa errada." },
      { label: "Conduzir um atendimento sem perceber o que existe por trás do relato." },
      { label: "Contratar, negociar ou construir uma parceria baseado apenas no discurso." },
      { label: "Repetir escolhas nos relacionamentos e só enxergar os sinais tarde demais." }
    ]
  }
];

const RESULTS = {
  terapeuta: {
    badge: "Perfil: terapeuta",
    title: "AMPLIE SEU REPERTÓRIO DE OBSERVAÇÃO.",
    paragraphs: [
      "Hoje, boa parte da sua compreensão provavelmente depende do que o paciente conta, da forma como ele se comporta durante a sessão e da sua experiência clínica.",
      "Mas o rosto e o corpo podem oferecer novos indícios antes mesmo do relato.",
      "Desenvolver esse olhar pode ajudar você a identificar traços de caráter, mecanismos de defesa, forças e possíveis dores emocionais para conduzir o atendimento com mais precisão."
    ]
  },
  futuro_terapeuta: {
    badge: "Perfil: nova atuação",
    title: "UM NOVO OLHAR PODE SER O SEU PRIMEIRO PASSO.",
    paragraphs: [
      "Suas respostas mostram que você não quer apenas acumular teoria sobre comportamento humano.",
      "Você deseja desenvolver uma habilidade prática: olhar para o rosto e para o corpo e saber quais características observar para levantar hipóteses sobre personalidade, traços de caráter e comportamento.",
      "Esse pode ser o primeiro passo para descobrir se essa habilidade faz sentido na sua futura atuação."
    ]
  },
  profissional_de_pessoas: {
    badge: "Perfil: leitura aplicada",
    title: "OBSERVE MAIS. DECIDA COM MAIS CONTEXTO.",
    paragraphs: [
      "Em contratações, negociações, vendas e liderança, o discurso é apenas uma parte da informação.",
      "Uma pessoa pode apresentar determinadas tendências no formato do corpo, no rosto e na maneira como sua estrutura física se organiza.",
      "Aprender a observar esses sinais pode trazer mais discernimento antes de contratar, delegar, negociar ou construir uma parceria."
    ]
  },
  vida_pessoal: {
    badge: "Perfil: escolhas e relacionamentos",
    title: "UM NOVO OLHAR PARA AS SUAS RELAÇÕES.",
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
    state={...state,...resumed,lead:null,stepIndex:count,screen:count<7?'step':'loading'};
    for(const step of STEPS.filter(s=>s.type==='question')){
      const idx=state.answerIndexes[step.id];if(Number.isInteger(idx)&&step.options[idx])state.answers[step.id]=step.options[idx].label;
    }
    state.profile=STEPS[0].options[state.answerIndexes.profile]?.profile||'';
  }
}


function createState() {
  const startedAt = new Date().toISOString();
  return {
    screen: "opening",
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


function panel(content) { return `<section class="screen panel"><div class="panel-inner">${content}</div></section>`; }

function render() {
  window.scrollTo({ top: 0, behavior: "instant" });
  updateProgress();
  const current=STEPS[state.stepIndex];
  RX.setContext({screen:state.screen,step_index:Math.min(7,state.stepIndex+1),step_id:current?.id,step_type:current?.type});
  if (state.screen === "opening") return renderOpening();
  if (state.screen === "step") return renderStep();
  if (state.screen === "loading") return renderLoading();
  return renderResult();
}

function updateProgress() {
  progressLabel.textContent = state.screen === "step" ? `Etapa ${state.stepIndex + 1} de ${STEPS.length}` : "";
}

async function handleLeadSubmit(event) {
  event.preventDefault();
  const element=event.currentTarget, button=element.querySelector('button[type="submit"]');
  if(button.disabled || leadSaveInFlight)return;
  RX.emit("rx_form_submit_attempt", {screen:"opening"});
  const form=new FormData(element);
  const lead={email:String(form.get("email")||"").trim().toLowerCase(),phone:RX.normalizePhone(form.get("phone")),marketing_contact:false};
  const error=validateLead(lead);
  if(error){document.querySelector("#form-error").textContent=error.message;RX.emit("rx_form_error",{error_code:error.code});return;}
  button.disabled = true;
  state.lead = lead;
  state.leadSaved = false;
  saveCheckoutPrefill(lead);
  void attemptLeadSave(form.get("company_website"));
  RX.emit("quiz_start", {screen:"opening"});
  state.screen = "step";
  const active = document.activeElement;
  if (active && typeof active.blur === "function") active.blur();
  render();
}

function validateLead(lead) {
  if(lead.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(lead.email))return {code:"invalid_email",message:"Informe um e-mail válido."};
  if(!/^\+[1-9]\d{7,14}$/.test(lead.phone))return {code:"invalid_phone",message:"Informe seu WhatsApp com DDD. Para outro país, inclua + e o código do país."};
  return null;
}

function renderOpening() {
  const lead = state.lead || {};
  if(root.dataset.rxPrerendered!=="opening-speed-v1" || !root.querySelector("#lead-form")) root.innerHTML = panel(`
    <div class="opening-grid">
      <div class="opening-story">
        <span class="eyebrow">WORKSHOP RAIO-X HUMANO · COM BRUNO SIMPLÍCIO</span>
        <h1 class="opening-title"><span class="opening-line">VOCÊ ESTÁ OLHANDO.</span><span class="opening-line"><em>MAS ESTÁ<br>ENXERGANDO?</em></span></h1>
        <p class="opening-subtitle">A primeira impressão não conta a história inteira.<br><strong>Responda a 5 perguntas</strong> sobre o seu olhar para as pessoas e conheça a proposta do Workshop Raio-X Humano.</p>
        <figure class="raiox-hero-visual">
          <div class="hero-blue-block" aria-hidden="true"></div>
          <img class="hero-investigation" src="design-20261027/mapa-facial.jpg" width="694" height="750" fetchpriority="high" decoding="async" alt="Material visual do workshop com mapa de observação facial">
          <img class="hero-portrait" src="design-20261027/bruno.jpg" width="776" height="1224" fetchpriority="high" decoding="async" alt="Bruno Simplício, apresentador do Workshop Raio-X Humano">
        </figure>
        <div class="opening-facts" aria-label="Como funciona"><div><strong>5 perguntas</strong><span>Sobre o seu olhar hoje</span></div><div><strong>Seu perfil</strong><span>Um ponto de partida</span></div><div><strong>2 noites</strong><span>Workshop ao vivo</span></div></div>
      </div>
      <aside class="capture-sheet" aria-labelledby="capture-title">
        <div class="form-intro"><span class="eyebrow">ANTES DE COMEÇAR</span><h2 id="capture-title">DESCUBRA SEU PONTO DE PARTIDA.</h2><p>Comece com seu e-mail e WhatsApp. Depois, responda às 5 perguntas.</p></div>
        <form class="form opening-form" id="lead-form" novalidate>
          <div class="field"><label for="email">Seu melhor e-mail</label><input id="email" name="email" type="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="254" autocomplete="email" placeholder="voce@email.com" value="${escapeHtml(lead.email || "")}" required></div>
          <div class="field"><label for="phone">Seu WhatsApp com DDD</label><input id="phone" name="phone" type="tel" inputmode="tel" maxlength="30" autocomplete="tel" placeholder="+55 11 99999-9999" value="${escapeHtml(lead.phone || "")}" required><small class="field-hint">Se estiver fora do Brasil, inclua o código do país.</small></div>
          <div class="rx-honey" aria-hidden="true"><label>Site<input name="company_website" tabindex="-1" autocomplete="off"></label></div>
          <div class="error" id="form-error" role="alert"></div>
          <div class="fixed-cta"><button class="button button-primary" id="start-button" type="submit">COMEÇAR MEU RAIO-X <span aria-hidden="true">→</span></button></div>
        </form>
        <p class="capture-reassurance"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 12 3 3 7-7" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/></svg>Sem respostas certas ou erradas.</p>
        <p class="fine-print">Ao continuar, você solicita o cadastro no quiz e o uso dos dados e respostas para entregar o resultado e os próximos passos deste workshop. ${window.RX_CONFIG.privacyPolicyUrl ? `<a href="${escapeHtml(window.RX_CONFIG.privacyPolicyUrl)}" target="_blank" rel="noopener noreferrer">Política de privacidade</a>` : ""}</p>
        <div class="capture-footnote">OBSERVAR É O COMEÇO.<br>ENTENDER EXIGE CONTEXTO.</div>
      </aside>
    </div>
  `);
  delete root.dataset.rxPrerendered;
  const form = document.querySelector("#lead-form");
  form.addEventListener("submit", handleLeadSubmit);
  form.addEventListener("input", () => RX.emit("rx_form_start", {screen:"opening"}), {once:true});
  state.captureViewed = true;
  RX.emit("rx_form_view", {screen:"opening"});
  window.__RX04_RUNTIME_READY=true;
  if(window.__RX04_SUBMIT_PENDING){window.__RX04_SUBMIT_PENDING=false;form.requestSubmit();}
}

function renderStep() {
  const step = STEPS[state.stepIndex];
  const progress = ((state.stepIndex + 1) / STEPS.length) * 100;
  RX.emit("quiz_step_view", {step_id:step.id,step_index:state.stepIndex+1,step_type:step.type});
  if (step.type === "insight") return renderInsight(step, progress);
  root.innerHTML = panel(`
    <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${progress}%"></div></div>
    <div class="question-number">${step.label} · etapa ${state.stepIndex + 1} de ${STEPS.length}</div>
    <h2 class="question-title">${step.text}</h2>
    <p class="question-instruction">Escolha a alternativa que mais se aproxima de você.</p>
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
  root.innerHTML = panel(`
    <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${progress}%"></div></div>
    <span class="eyebrow insight-eyebrow">UM NOVO JEITO DE OBSERVAR</span>
    <h2 class="insight-title">${step.title}</h2>
    <div class="insight-card">
      <p class="insight-body">${step.body}</p>
      <ul class="opening-list insight-list">${step.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>
      <p class="insight-footer"><strong>${step.footer}</strong></p>
    </div>
    <div class="fixed-cta"><button class="button button-primary" id="continue-button" type="button">${step.button}</button></div>
  `);
  RX.emit("quiz_insight_view", {step_id:step.id,step_index:state.stepIndex+1});
  document.querySelector("#continue-button").addEventListener("click", () => {
    const button = document.querySelector("#continue-button");
    if (!button || button.disabled || STEPS[state.stepIndex]?.id !== step.id) return;
    button.disabled = true;
    const details = {step_id:step.id, step_index:state.stepIndex+1, step_type:step.type};
    markStepCompleted(step.id);
    state.stepIndex += 1;
    if (state.stepIndex >= STEPS.length) state.screen = "loading";
    queueOperationalSave("insight:"+step.id, "quiz_insight_continue", details, makeAcknowledgedCheckpoint());
    render();
  });
}

function clearSaveError(){document.querySelector("#quiz-save-error")?.remove();}
function showSaveError(message){
  clearSaveError();const box=document.createElement("p");box.id="quiz-save-error";box.className="error";box.setAttribute("role","alert");box.textContent=message;
  const target=document.querySelector(".panel-inner");if(target)target.appendChild(box);
}
function answerStep(step, optionIndex, button) {
  if (!button || button.disabled || STEPS[state.stepIndex]?.id !== step.id) return;
  const option = step.options[optionIndex];
  if (!option) return;
  document.querySelectorAll(".option").forEach(item => item.disabled = true);
  button.classList.add("selected");
  const stepIndex = state.stepIndex + 1;
  const completed = [...state.completedSteps, step.id];
  const details = {question_id:step.id, option_index:optionIndex, answer_label:option.label,
    selected_profile:option.profile||undefined, step_index:stepIndex, option_count:step.options.length, completed_steps:completed};
  if (option.profile) state.profile = option.profile;
  state.answers[step.id] = option.label;
  state.answerIndexes[step.id] = optionIndex;
  markStepCompleted(step.id);
  state.stepIndex += 1;
  if (state.stepIndex >= STEPS.length) state.screen = "loading";
  queueOperationalSave("answer:"+step.id, "quiz_answer", details, makeAcknowledgedCheckpoint());
  RX.emit("quiz_step_complete", {step_id:step.id,step_index:stepIndex,step_type:step.type});
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
    if(!RX.getTestMode() && (result.quiz_status?.finalizou!==true || result.quiz_status?.status!=="concluido" || Number(result.quiz_status?.perguntas_respondidas)!==5 || Number(result.quiz_status?.etapas_concluidas)!==7))throw new Error("completion_not_confirmed");
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
  const result = RESULTS[state.profile] || RESULTS.vida_pessoal;
  const vslProfile = getVslProfile();
  const player = VSL_PLAYERS[vslProfile];
  root.innerHTML = panel(`
    <div class="result-simple">
      <span class="result-badge">${result.badge}</span>
      <h1>${result.title}</h1>
      <p class="result-summary">A partir do perfil que você escolheu, veja como a proposta do Workshop pode se conectar aos seus interesses.</p>
      <div class="video-frame" aria-label="Vídeo do Workshop Raio-X Humano">
        <vturb-smartplayer id="${player.id}" style="display:block;margin:0 auto;width:100%;max-width:400px;">
          <div class="vturb-player-placeholder"></div>
        </vturb-smartplayer>
      </div>
      <div class="workshop-date-card"><span>Workshop Raio-X Humano</span><strong>${RAIOX_CONFIG.workshopDateText}</strong></div>
      <div class="fixed-cta result-fixed-cta" id="checkout-cta">
        <div class="lot-grid" aria-label="Lotes do Workshop Raio-X Humano">
          <div class="lot-card lot-card-current">
            <span class="lot-label">1º lote</span>
            <strong>R$37</strong>
            <small>Encerra em breve</small>
          </div>
          <div class="lot-card">
            <span class="lot-label">2º lote</span>
            <strong>R$79</strong>
            <small>Em breve</small>
          </div>
          <div class="lot-card">
            <span class="lot-label">3º lote</span>
            <strong>R$147</strong>
            <small>Em breve</small>
          </div>
        </div>
        <a class="button button-primary" id="checkout-button" href="${buildCheckoutUrl()}" target="_blank" rel="noopener noreferrer">GARANTIR MINHA VAGA POR R$37</a>
      </div>
    </div>
  `);
  RX.bindVturb(document.getElementById(player.id));
  loadVturbPlayer(player);
  void ensureLeadSaved().then(() => RX.emit("quiz_result_view", {screen:"result"})).catch(() => {});
  RX.emit("view_item", {currency:"BRL",value:37,screen:"result"});
  window.setTimeout(() => {const cta=document.querySelector("#checkout-cta");if(cta){cta.classList.add("visible");RX.emit("rx_cta_view",{element_id:"checkout-button",cta_delay_seconds:RAIOX_CONFIG.ctaDelaySeconds});}}, RAIOX_CONFIG.ctaDelaySeconds * 1000);
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
  const pageMarker = "pg_raiox04";
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


/* checkout observer */

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


window.RXBoot.afterPaint(function(){

if (!window.RX_CONFIG?.testMode) {/* GTM antigo (GTM-MZBZ9HCS) removido */}

});
