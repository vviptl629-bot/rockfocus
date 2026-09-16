
"use strict";
const LS_KEY="rockfocus_web_v1";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

const DEFAULTS={
  sessions:[],
  labels:[
    {id:"work",name:"工作",color:"#ffffff"},
    {id:"study",name:"学习",color:"#cfcfcf"},
    {id:"create",name:"创作",color:"#a6a6a6"},
    {id:"think",name:"思考",color:"#808080"},
    {id:"sport",name:"运动",color:"#5c5c5c"},
    {id:"rest",name:"休息",color:"#3f3f3f"}
  ],
  blockList:["抖音","微博","小红书","B站","微信","游戏"],
  settings:{haptic:true,alertMode:"both",soundType:"bell",goal:60,token:"",gistId:"",autoSync:true}
};

let state=load();
function load(){try{const r=JSON.parse(localStorage.getItem(LS_KEY));if(r&&r.labels)return r;}catch(e){}return JSON.parse(JSON.stringify(DEFAULTS));}
function save(){localStorage.setItem(LS_KEY,JSON.stringify(state));schedulePush();}

/* ---------- utils ---------- */
function dayKey(ts){const d=new Date(ts);return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();}
function fmtDur(ms){const s=Math.max(0,Math.round(ms/1000));const m=Math.floor(s/60),ss=s%60;return m+"<small>:"+String(ss).padStart(2,"0")+"</small>";}
function haptic(p){if(state.settings.haptic&&navigator.vibrate)try{navigator.vibrate(p);}catch(e){}}

/* ---------- sound alerts (Web Audio, no external file, offline) ---------- */
const SOUNDS={
  bell:{type:"sine",gap:0,dur:1.1,notes:[784,1046.5]},
  chime:{type:"triangle",gap:0.13,dur:0.5,notes:[659.25,783.99,987.77]},
  beep:{type:"sine",gap:0.18,dur:0.16,notes:[880,880]}
};
let audioCtx=null;
function getCtx(){
  try{
    if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;audioCtx=new AC();}
    if(audioCtx.state==="suspended")audioCtx.resume();
  }catch(e){return null;}
  return audioCtx;
}
function playTone(){
  if(state.settings.alertMode==="vibrate")return; // 仅震动模式不发声
  const ctx=getCtx();if(!ctx)return;
  const p=SOUNDS[state.settings.soundType]||SOUNDS.bell;const t=ctx.currentTime;
  p.notes.forEach((f,i)=>{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=p.type;o.frequency.value=f;
    const s=t+i*p.gap,d=p.dur;
    g.gain.setValueAtTime(0.0001,s);
    g.gain.linearRampToValueAtTime(0.2,s+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,s+d);
    o.connect(g);g.connect(ctx.destination);
    o.start(s);o.stop(s+d+0.05);
  });
}
function alert(){
  if(state.settings.alertMode==="sound"||state.settings.alertMode==="both")playTone();
  if(state.settings.alertMode==="vibrate"||state.settings.alertMode==="both")haptic([20,40,20]);
}
// iOS 自动播放策略：首个用户手势时创建并解锁 AudioContext
document.addEventListener("pointerdown",()=>{getCtx();},{passive:true});
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),1900);}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
const MONO=["#ffffff","#cfcfcf","#a6a6a6","#808080","#5c5c5c","#3f3f3f"];
function monoColor(id){const i=state.labels.findIndex(l=>l.id===id);return MONO[(i<0?0:i)%MONO.length];}

/* ---------- stats ---------- */
function stats(){
  const now=new Date();const todayK=dayKey(now);
  let stones=state.sessions.length, mins=0, today=0;
  const days=new Set();
  state.sessions.forEach(s=>{mins+=s.durationMin;days.add(dayKey(s.start));if(dayKey(s.start)===todayK)today+=s.durationMin;});
  // streak
  let streak=0;const d=new Date();
  if(!days.has(dayKey(d))) {d.setDate(d.getDate()-1);if(!days.has(dayKey(d)))streak=0;}
  while(days.has(dayKey(d))){streak++;d.setDate(d.getDate()-1);}
  return {stones,mins,today,streak};
}
function minutesOn(ts){const k=dayKey(ts);return state.sessions.filter(s=>dayKey(s.start)===k).reduce((a,s)=>a+s.durationMin,0);}

/* ---------- render: home ---------- */
let selLabel=state.labels[0].id, selDur=25;
function renderHome(){
  const st=stats();
  $("#s-stones").textContent=st.stones;
  $("#s-mins").textContent=st.mins;
  $("#s-streak").textContent=st.streak;
  $("#s-today").textContent=st.today;
  // labels
  const wrap=$("#labels");wrap.innerHTML="";
  state.labels.forEach(l=>{
    const c=document.createElement("div");c.className="chip"+(l.id===selLabel?" on":"");
    c.innerHTML=`<span class="dot" style="background:${monoColor(l.id)}"></span>${l.name}`;
    c.onclick=()=>{selLabel=l.id;renderHome();};
    wrap.appendChild(c);
  });
  const add=document.createElement("div");add.className="chip add";add.textContent="+ 标签";
  add.onclick=addLabel;wrap.appendChild(add);
  // durations
  const dw=$("#durs");dw.innerHTML="";
  [15,25,45,60,90].forEach(m=>{
    const b=document.createElement("div");b.className="dur"+(m===selDur?" on":"");b.textContent=m+"′";
    b.onclick=()=>{selDur=m;renderHome();};dw.appendChild(b);
  });
  const cust=document.createElement("div");cust.className="dur"+(![15,25,45,60,90].includes(selDur)?" on":"");cust.textContent="自定义";
  cust.onclick=()=>{const v=prompt("自定义时长（分钟）",selDur);if(v&&+v>0){selDur=Math.round(+v);renderHome();}};
  dw.appendChild(cust);
}
function addLabel(){
  const name=prompt("新标签名称");if(!name)return;
  const l={id:uid(),name,color:"#cccccc"};state.labels.push(l);l.color=monoColor(l.id);selLabel=l.id;save();renderHome();toast("已添加标签");
}

/* ---------- timer ---------- */
let timer={active:false,labelId:null,totalMs:0,startTs:0,elapsed:0,paused:false,tick:null,distract:0,pathLen:0,endDone:false};
function startFocus(){
  if(!state.labels.length){toast("请先添加标签");return;}
  timer={active:true,labelId:selLabel,totalMs:selDur*60000,startTs:Date.now(),elapsed:0,paused:false,distract:0,endDone:false};
  const lbl=state.labels.find(l=>l.id===selLabel);
  $("#f-label").textContent=lbl?lbl.name:"专注";
  const bl=state.blockList.filter(Boolean);
  $("#f-put").style.display=bl.length?"block":"none";
  $("#f-put").textContent=bl.length?("这次专注，先放下："+bl.join("、")):"";
  switchView("focus");
  // measure path
  const p=$("#hillPath");timer.pathLen=p.getTotalLength();
  $("#rock").setAttribute("transform","translate(0,0)");
  updateFocus();
  timer.tick=setInterval(updateFocus,250);
  alert();
}
function updateFocus(){
  if(!timer.active)return;
  const base=timer.paused?timer.elapsed:(Date.now()-timer.startTs);
  const rem=Math.max(0,timer.totalMs-base);
  $("#f-time").innerHTML=fmtDur(rem);
  const prog=Math.min(1,base/timer.totalMs);
  const p=$("#hillPath");const pt=p.getPointAtLength(prog*timer.pathLen);
  $("#rock").setAttribute("transform",`translate(${pt.x-170},${pt.y-90}) rotate(${prog*720} 170 90)`);
  $("#f-streak").textContent=`连续 ${stats().streak} 天 · 已离开 ${timer.distract} 次`;
  // auto finish
  if(!timer.paused&&base>=timer.totalMs){finishSession(true);}
}
function pauseToggle(){
  if(!timer.active)return;
  if(timer.paused){timer.paused=false;timer.startTs=Date.now()-timer.elapsed;clearInterval(timer.tick);timer.tick=setInterval(updateFocus,250);$("#pauseBtn").textContent="暂停";}
  else{timer.elapsed=Date.now()-timer.startTs;timer.paused=true;clearInterval(timer.tick);$("#pauseBtn").textContent="继续";}
}
function finishSession(auto){
  if(timer.endDone)return;timer.endDone=true;
  clearInterval(timer.tick);timer.active=false;
  const dur=Math.round((timer.paused?timer.elapsed:(Date.now()-timer.startTs))/60000*10)/10;
  timer._lastDur=dur;
  $("#c-title").textContent=auto?"时间到，石头登顶":"专注结束";
  $("#c-sub").textContent=`${state.labels.find(l=>l.id===timer.labelId)?.name||"专注"} · ${dur} 分钟 · 离开 ${timer.distract} 次`;
  $("#c-thought").value="";
  switchView("complete");alert();
  if(auto)toast("这一刻，石头到了山顶");
}
function commitThought(skip){
  const dur=timer._lastDur||0;
  const s={id:uid(),labelId:timer.labelId,start:timer.startTs,end:Date.now(),durationMin:dur,thought:skip?"":$("#c-thought").value.trim(),distractions:timer.distract};
  state.sessions.push(s);save();
  timer={active:false,labelId:null,totalMs:0,startTs:0,elapsed:0,paused:false,distract:0,endDone:false};
  renderHome();renderReview();renderThoughts();
  switchView("home");toast(skip?"已记录":"已保存想法");
}

/* ---------- shield ---------- */
let shieldShown=false;
document.addEventListener("visibilitychange",()=>{
  if(document.hidden&&timer.active&&!timer.paused){timer.distract++;}
  else if(!document.hidden&&timer.active&&!timer.paused&&timer.distract>0){
    $("#shield-txt").textContent=`你离开了 ${timer.distract} 次。深呼吸，这一刻还在等你。`;
    $("#shield").classList.add("show");shieldShown=true;alert();
  }
});
$("#shield-back").onclick=()=>{$("#shield").classList.remove("show");shieldShown=false;};

/* ---------- review ---------- */
let calY,calM;
function renderReview(){
  const st=stats();
  $("#rev-total").textContent=`${st.stones} 石头 · ${st.mins} 分钟`;
  const now=new Date();calY=calY??now.getFullYear();calM=calM??now.getMonth();
  drawCal();drawWeek();drawLstat();
}
function drawCal(){
  const d=new Date(calY,calM,1);const mName=calY+"年"+(calM+1)+"月";$("#calMonth").textContent=mName;
  const cal=$("#cal");cal.innerHTML="";
  ["日","一","二","三","四","五","六"].forEach(w=>{const e=document.createElement("div");e.className="dow";e.textContent=w;cal.appendChild(e);});
  const first=d.getDay();const days=new Date(calY,calM+1,0).getDate();
  for(let i=0;i<first;i++){const e=document.createElement("div");e.className="empty";cal.appendChild(e);}
  const maxM=Math.max(30,...state.sessions.map(s=>minutesOn(s.start)));
  for(let day=1;day<=days;day++){
    const ts=new Date(calY,calM,day).getTime();const m=minutesOn(ts);
    const e=document.createElement("div");e.className="cell"+(m>0?" t":" emp0");
    e.innerHTML=`<span>${day}</span>`+(m>0?`<span class="bar" style="opacity:${0.35+0.65*(m/maxM)}"></span>`:"");
    cal.appendChild(e);
  }
}
function drawWeek(){
  const wk=$("#week");wk.innerHTML="";
  const names=["日","一","二","三","四","五","六"];
  for(let i=6;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);const m=minutesOn(d.getTime());
    const h=Math.min(100,Math.round(m/ (state.settings.goal||60) *100));
    const e=document.createElement("div");e.className="wk";
    e.innerHTML=`<div class="v">${m||""}</div><div class="bar" style="height:${Math.max(4,h)}px"></div><div class="d">${names[d.getDay()]}</div>`;
    wk.appendChild(e);
  }
}
function drawLstat(){
  const ls=$("#lstat");ls.innerHTML="";
  const map={};state.labels.forEach(l=>map[l.id]={id:l.id,name:l.name,min:0,n:0});
  state.sessions.forEach(s=>{if(map[s.labelId]){map[s.labelId].min+=s.durationMin;map[s.labelId].n++;}});
  const arr=Object.values(map).filter(x=>x.min>0).sort((a,b)=>b.min-a.min);
  const max=Math.max(1,...arr.map(a=>a.min));
  if(!arr.length){ls.innerHTML='<div class="empty">还没有专注记录</div>';return;}
  arr.forEach(a=>{
    const r=document.createElement("div");r.className="lrow";
    r.innerHTML=`<span class="dot" style="background:${monoColor(a.id)}"></span><span class="nm">${a.name}</span>
      <span class="track"><span class="fill" style="width:${a.min/max*100}%;background:${monoColor(a.id)}"></span></span>
      <span class="vv">${a.min}分·${a.n}石</span>`;
    ls.appendChild(r);
  });
}

/* ---------- thoughts ---------- */
function renderThoughts(){
  const list=$("#th-list");list.innerHTML="";
  const withT=state.sessions.filter(s=>s.thought).sort((a,b)=>b.end-a.end);
  $("#th-count").textContent=withT.length+" 条";
  if(!withT.length){list.innerHTML='<div class="empty">还没有写下想法</div>';return;}
  withT.forEach(s=>{
    const l=state.labels.find(x=>x.id===s.labelId);
    const d=new Date(s.end);
    const dd=`${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    const e=document.createElement("div");e.className="th";
    e.innerHTML=`<div class="meta"><span class="tag"><span class="dot" style="background:${l?monoColor(l.id):"#888"}"></span>${l?l.name:"专注"}</span><span>${dd} · ${s.durationMin}分</span></div>
      <div class="body">${escapeHtml(s.thought)}</div>`;
    list.appendChild(e);
  });
}
function escapeHtml(t){return t.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

/* ---------- settings ---------- */
function renderSettings(){
  $("#in-goal").value=state.settings.goal;
  $("#in-token").value=state.settings.token;
  $("#in-gist").value=state.settings.gistId;
  $$("#alert-seg button").forEach(b=>b.classList.toggle("on",b.dataset.m===state.settings.alertMode));
  $$("#sound-seg button").forEach(b=>b.classList.toggle("on",b.dataset.s===state.settings.soundType));
  $("#sw-sync").classList.toggle("on",state.settings.autoSync);
  drawBlockList();
}
function drawBlockList(){
  const wrap=$("#bl-list");wrap.innerHTML="";
  if(!state.blockList.length){wrap.innerHTML='<div class="set-row" style="border:none;color:var(--faint);justify-content:center">（空）</div>';}
  state.blockList.forEach((b,i)=>{
    const r=document.createElement("div");r.className="set-row";
    r.innerHTML=`<span class="k">${escapeHtml(b)}</span>`;
    const x=document.createElement("span");x.textContent="✕";x.style.cssText="color:var(--faint);cursor:pointer;padding:0 6px";
    x.onclick=()=>{state.blockList.splice(i,1);save();drawBlockList();};
    r.appendChild(x);wrap.appendChild(r);
  });
  const add=document.createElement("div");add.className="set-row";add.style.cursor="pointer";
  add.innerHTML=`<span class="k" style="color:var(--purple)">+ 添加干扰项</span>`;
  add.onclick=()=>{const v=prompt("要放下的 App / 网站");if(v&&v.trim()){state.blockList.push(v.trim());save();drawBlockList();}};
  wrap.appendChild(add);
}

/* ---------- navigation ---------- */
function switchView(v){
  $$(".view").forEach(s=>s.classList.remove("show"));
  $("#"+v).classList.add("show");
  $$(".tab").forEach(t=>t.classList.toggle("on",t.dataset.v===v));
  if(v==="review")renderReview();
  if(v==="thoughts")renderThoughts();
  if(v==="settings")renderSettings();
  if(v==="home")renderHome();
  window.scrollTo(0,0);
}
$$(".tab").forEach(t=>t.onclick=()=>switchView(t.dataset.v));
$("#startBtn").onclick=startFocus;
$("#pauseBtn").onclick=pauseToggle;
$("#endBtn").onclick=()=>finishSession(false);
$("#skipThought").onclick=()=>commitThought(true);
$("#saveThought").onclick=()=>commitThought(false);
$("#label-edit").onclick=()=>{switchView("settings");};
$("#bl-edit").onclick=()=>{switchView("settings");};
$("#calPrev").onclick=()=>{calM--;if(calM<0){calM=11;calY--;}drawCal();};
$("#calNext").onclick=()=>{calM++;if(calM>11){calM=0;calY++;}drawCal();};

/* settings bindings */
$$("#alert-seg button").forEach(b=>b.onclick=()=>{
  state.settings.alertMode=b.dataset.m;save();renderSettings();
  const m={sound:"声音",vibrate:"震动","both":"声音+震动"}[b.dataset.m];
  toast("提醒方式："+m);
  if(b.dataset.m!=="vibrate")playTone();
});
$$("#sound-seg button").forEach(b=>b.onclick=()=>{
  state.settings.soundType=b.dataset.s;save();renderSettings();playTone();
});
$("#btn-test-sound").onclick=()=>{getCtx();playTone();};
$("#sw-sync").onclick=function(){state.settings.autoSync=!state.settings.autoSync;this.classList.toggle("on");save();if(state.settings.autoSync)startAutoSync();};
$("#in-goal").onchange=function(){state.settings.goal=Math.max(1,+this.value||60);save();};
$("#in-token").onchange=function(){state.settings.token=this.value.trim();save();};
$("#in-gist").onchange=function(){state.settings.gistId=this.value.trim();save();};
$("#btn-sync").onclick=async()=>{toast("同步中…");try{await gistPull();await gistPush();renderAll();toast("已同步");}catch(e){toast("同步失败："+e.message);}};
$("#btn-export").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="rockfocus-backup.json";a.click();};
$("#btn-reset").onclick=()=>{if(confirm("确定清空全部专注记录、标签与想法？此操作不可撤销。")){state=JSON.parse(JSON.stringify(DEFAULTS));save();renderAll();toast("已清空");switchView("home");}};

/* ---------- Gist sync ---------- */
let pushTimer=null;
function schedulePush(){if(!state.settings.token||!state.settings.autoSync)return;clearTimeout(pushTimer);pushTimer=setTimeout(gistPush,800);}
async function gistPush(){
  if(!state.settings.token)return;
  const content=JSON.stringify(state);
  const headers={"Authorization":"token "+state.settings.token,"Content-Type":"application/json"};
  try{
    if(state.settings.gistId){
      await fetch("https://api.github.com/gists/"+state.settings.gistId,{method:"PATCH",headers,body:JSON.stringify({files:{"rockfocus.json":{content}}})});
    }else{
      const r=await fetch("https://api.github.com/gists",{method:"POST",headers,body:JSON.stringify({public:false,description:"RockFocus web",files:{"rockfocus.json":{content}}})});
      const d=await r.json();if(d.id){state.settings.gistId=d.id;save();}
    }
  }catch(e){console.warn("push fail",e);}
}
async function gistPull(){
  if(!state.settings.token||!state.settings.gistId)return;
  try{
    const r=await fetch("https://api.github.com/gists/"+state.settings.gistId,{headers:{"Authorization":"token "+state.settings.token}});
    const d=await r.json();const c=d.files&&d.files["rockfocus.json"]&&d.files["rockfocus.json"].content;
    if(c){const inc=JSON.parse(c);mergeState(inc);save();}
  }catch(e){console.warn("pull fail",e);}
}
function mergeState(inc){
  const sIds=new Set(state.sessions.map(s=>s.id));
  (inc.sessions||[]).forEach(s=>{if(!sIds.has(s.id))state.sessions.push(s);});
  const lIds=new Set(state.labels.map(l=>l.id));
  (inc.labels||[]).forEach(l=>{if(!lIds.has(l.id))state.labels.push(l);});
  // keep local settings (token/gist) but adopt goal/haptic if present
  if(typeof inc.settings==="object"&&inc.settings){
    state.settings.goal=inc.settings.goal??state.settings.goal;
    state.settings.haptic=inc.settings.haptic??state.settings.haptic;
    state.settings.autoSync=inc.settings.autoSync??state.settings.autoSync;
  }
  if(Array.isArray(inc.blockList))state.blockList=inc.blockList;
}
function startAutoSync(){
  if(!state.settings.token||!state.settings.autoSync)return;
  setInterval(async()=>{await gistPull();renderAll();},45000);
}

/* ---------- init ---------- */
function renderAll(){renderHome();renderReview();renderThoughts();renderSettings();}
renderHome();
if(state.settings.token&&state.settings.autoSync){gistPull().then(()=>{renderAll();startAutoSync();});}
// keep title showing remaining during focus
document.addEventListener("visibilitychange",()=>{
  if(document.hidden&&timer.active){document.title="RockFocus · 专注中";}
  else{document.title="RockFocus · 专注记录";}
});

// register service worker (offline + installable PWA)
if("serviceWorker" in navigator && window===window.top && location.protocol.startsWith("http")){
  window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(()=>{});});
}
