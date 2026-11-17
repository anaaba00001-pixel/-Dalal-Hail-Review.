(function(){
 'use strict';
 const URL_BASE='https://vxwyzrgvopggoaxggtuy.supabase.co';
 const API_KEY='sb_publishable_GdKCSMY2tbxH5CaRac97mA_EPxcpXZI';
 const {merge,same,copy}=DalalMerge;
 const defaults=JSON.parse(document.getElementById('cloud-defaults').textContent);
 const keys=Object.keys(defaults), journalKey='dalal-cloud-pending-v1', backupKey='dalal-before-cloud-v1';
 const pending=new Map(), confirmed=new Map(), views=new Map();
 let loading=false, sending=false, ready=false, lastError='', callback;
 const label=document.getElementById('sync-status');
 const conflictButton=document.getElementById('sync-discard');
 const importButton=document.getElementById('sync-import');
 function parse(text,fallback){try{return text?JSON.parse(text):copy(fallback);}catch{return copy(fallback);}}
 function local(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{lastError='مساحة المتصفح ممتلئة؛ احتفظي بنسخة من التعديلات.';}}
 function current(key){return confirmed.get(key)?.value??defaults[key];}
 function effective(key){return pending.get(key)?.desired??current(key);}
 function snapshot(){return Object.fromEntries(keys.map(key=>[key,copy(effective(key))]));}
 function checkpoint(){
  try{localStorage.setItem(journalKey,JSON.stringify(Object.fromEntries(pending)));}
  catch{lastError='تعذّر حفظ النسخة المحلية؛ نزّلي نسخة قبل إغلاق الصفحة.';}
 }
 function paint(){
  const blocked=[...pending.values()].some(p=>p.blocked);
  conflictButton.hidden=!blocked;
  label.textContent=blocked?'يوجد تعديلان مختلفان لنفس البيانات. نزّلي نسختك قبل اعتماد نسخة الفريق.':
   lastError?lastError:!ready?'جارٍ الاتصال بالحفظ المشترك…':
   pending.size?'جارٍ حفظ التعديلات للجميع…':'متصل — التعديلات محفوظة للجميع';
  label.dataset.state=blocked||lastError?'error':pending.size||!ready?'pending':'saved';
 }
 async function request(path,options={}){
  const response=await fetch(URL_BASE+'/rest/v1/'+path,{
   ...options,headers:{apikey:API_KEY,'Content-Type':'application/json',...options.headers},
   signal:AbortSignal.timeout(15000),cache:'no-store'
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok){
   const e=new Error(result?.message||'HTTP '+response.status);e.code=result?.code;throw e;
  }
  return result;
 }
 function recordError(error){
  lastError=['PGRST205','PGRST202','42P01','42883','42501'].includes(error.code)?
   'الحفظ المشترك ينتظر الإعداد: افتحي «تفعيل الحفظ» وشغّلي الكود في Supabase.':
   'تعذّر الاتصال. التعديلات تنتظر الحفظ؛ اضغطي «إعادة الاتصال» أو نزّلي نسخة.';
  paint();
 }
 function cache(){for(const key of keys)local(key,effective(key));}
 function deliver(){
  if(!ready)return;
  const data=snapshot();
  for(const id of ['project','places']){
   const frame=document.getElementById(id), relevant=id==='project'?[keys[0]]:keys.slice(1);
   if(!frame?.contentWindow?.dalalReceive)continue;
   const view=views.get(id)||{};
   if(relevant.every(key=>same(view[key],data[key])))continue;
   try{if(frame.contentWindow.dalalReceive(copy(data)))views.set(id,copy(data));}catch{/* A frame can be loading. */}
  }
 }
 function reconcile(key,document){
  const remote=document??{key,value:copy(defaults[key]),revision:0};
  confirmed.set(key,remote);
  const p=pending.get(key);
  if(p&&!p.blocked){
   try{p.desired=merge(p.base,p.desired,remote.value);p.base=copy(remote.value);}
   catch(error){if(error.conflict)p.blocked=true;else throw error;}
   if(!p.blocked&&same(p.desired,remote.value))pending.delete(key);
  }
 }
 async function pull(){
  if(loading||sending)return;
  loading=true;
  try{
   const rows=await request('dalal_shared_documents?select=key,value,revision,updated_at');
   if(!Array.isArray(rows))throw new Error('Invalid response');
   for(const key of keys)reconcile(key,rows.find(row=>row.key===key));
   ready=true;lastError='';checkpoint();cache();deliver();
  }catch(error){recordError(error);}finally{loading=false;paint();}
 }
 async function flush(){
  if(sending||loading||!ready)return;
  sending=true;
  try{
   for(const key of keys){
    for(let attempt=0;attempt<4;attempt++){
     const p=pending.get(key);if(!p||p.blocked)break;
     // Capture one operation; later edits remain in the pending document.
     const sent=copy(p.desired), expected=confirmed.get(key)?.revision??0;
     const result=await request('rpc/dalal_save_document',{
      method:'POST',body:JSON.stringify({p_key:key,p_value:sent,p_expected_revision:expected})
     });
     if(!result||typeof result.ok!=='boolean')throw new Error('Invalid save response');
     if(result.ok){
      const live=pending.get(key);
      confirmed.set(key,result.document);
      if(live&&!live.blocked){
       live.desired=merge(sent,live.desired,result.document.value);
       live.base=copy(result.document.value);
       if(same(live.desired,result.document.value))pending.delete(key);
      }
     }else reconcile(key,result.document);
     lastError='';checkpoint();cache();deliver();paint();
    }
   }
  }catch(error){recordError(error);}finally{sending=false;paint();}
 }
 function save(key,base,value,frameId){
  if(!keys.includes(key))throw new Error('Unknown storage key');
  base=copy(base);value=copy(value);
  const old=pending.get(key);
  if(old?.blocked){old.desired=value;}
  else{
   try{
    const desired=merge(base,value,effective(key));
    pending.set(key,{base:copy(current(key)),desired,blocked:false});
   }catch(error){
    if(!error.conflict)throw error;
    pending.set(key,{base,desired:value,blocked:true});
   }
  }
  const view=views.get(frameId)||{};view[key]=copy(value);views.set(frameId,view);
  checkpoint();cache();paint();void flush();
 }
 function download(){
  const data={format:'dalal-shared-backup-v1',savedAt:new Date().toISOString(),documents:snapshot(),
   pending:Object.fromEntries(pending),previousLocal:parse(localStorage.getItem(backupKey),{})};
  const a=document.createElement('a');a.download='dalal-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 }
 function importLocal(){
  const previous=parse(localStorage.getItem(backupKey),{});
  if(!Object.keys(previous).length)return;
  if(!confirm('سيتم دمج نسخة هذا المتصفح السابقة مع بيانات الفريق. عند اختلاف نفس الحقل سيظهر تنبيه ولن نستبدل بيانات الفريق. متابعة؟'))return;
  for(const key of keys)if(previous[key])save(key,defaults[key],previous[key],'import');
  deliver();
 }
 function importBackup(file){
  if(!file)return;
  if(file.size>16000000){lastError='اختاري نسخة احتياطية أصغر من ١٦ ميغابايت.';paint();return;}
  file.text().then(text=>{
   const data=JSON.parse(text);
   if(data.format!=='dalal-shared-backup-v1'||!data.documents)throw new Error('Invalid backup');
   if(!confirm('دمج هذه النسخة مع بيانات الفريق؟ الاختلاف في نفس الحقل يحتاج مراجعة.'))return;
   for(const key of keys)if(data.documents[key])save(key,defaults[key],data.documents[key],'import');
   deliver();
  }).catch(()=>{lastError='ملف النسخة غير صالح.';paint();});
 }
 async function start(showPage){
  callback=showPage;
  const previous={};
  for(const key of keys){
   const value=parse(localStorage.getItem(key),null);
   if(value)previous[key]=value;
   confirmed.set(key,{key,value:copy(defaults[key]),revision:0});
  }
  // Keep the original per-device work available even after cloud hydration.
  if(!localStorage.getItem(backupKey)&&Object.keys(previous).length)local(backupKey,previous);
  importButton.hidden=!localStorage.getItem(backupKey);
  const journal=parse(localStorage.getItem(journalKey),{});
  for(const key of keys)if(journal[key]?.desired)pending.set(key,journal[key]);
  // Before first read, the frame shows the existing per-device data, not an empty board.
  for(const [id,relevant] of [['project',[keys[0]]],['places',keys.slice(1)]]){
   views.set(id,Object.fromEntries(relevant.map(key=>[key,previous[key]??defaults[key]])));
  }
  paint();
  await pull();
  if(!ready){
   // Offline edits must compare against the exact version visible in the frame.
   for(const key of keys)if(previous[key])confirmed.set(key,{key,value:previous[key],revision:0});
  }
  callback();
  for(const id of ['project','places'])document.getElementById(id).addEventListener('load',()=>{
   views.delete(id);deliver();
  });
  void flush();
  setInterval(async()=>{if(document.hidden)return;await pull();await flush();deliver();},4000);
 }
 document.getElementById('sync-retry').addEventListener('click',async()=>{await pull();await flush();});
 document.getElementById('sync-export').addEventListener('click',download);
 importButton.addEventListener('click',importLocal);
 document.getElementById('sync-restore').addEventListener('click',()=>document.getElementById('sync-file').click());
 document.getElementById('sync-file').addEventListener('change',event=>{importBackup(event.target.files[0]);event.target.value='';});
 conflictButton.addEventListener('click',()=>{
  if(!confirm('نزّلي نسختك أولًا إذا أردت الاحتفاظ بتعديلك. هل تعتمدين نسخة الفريق وتلغين التعديلات المتعارضة المحلية؟'))return;
  for(const [key,p] of pending)if(p.blocked)pending.delete(key);
  checkpoint();cache();deliver();paint();
 });
 window.addEventListener('online',async()=>{await pull();await flush();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void pull();});
 window.addEventListener('beforeunload',event=>{if(pending.size){event.preventDefault();event.returnValue='';}});
 window.dalalSync={start,save};
})();
