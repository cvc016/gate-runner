(function(){
const $=id=>document.getElementById(id), cv=$('c'), ctx=cv.getContext('2d');
const SAVE='gr_meta_v1', CKPT='gr_ckpt_v1';
const meta=Object.assign({coins:0,best:0,gate:0,crit:0,atk:0,armor:0,start:0,coin:0,seen:[],unlocked:1,stars:{},bestArmy:{}},JSON.parse(localStorage.getItem(SAVE)||'{}'));
meta.unlocked=Math.max(meta.unlocked||1,Math.min(1000,(meta.best||0)+1)); // 舊存檔轉換
const saveMeta=()=>localStorage.setItem(SAVE,JSON.stringify(meta));
for(const k of Upgrades.KEYS) meta[k]=meta[k]||0; // v0.7 存檔遷移：同名等級照搬，新項目（rate／boss）從 0 開始
let G=null, W=0,H=0,D=1, dragX=null;
let QD=2; // 自適應解析度上限（FPS 低時自動降到 1.5 / 1.0）
function resize(){ const r=cv.getBoundingClientRect(); D=Math.min(devicePixelRatio||1,QD); if(window.FX) FX.setD(D); W=cv.width=r.width*D; H=cv.height=r.height*D; }
addEventListener('resize',resize); resize();
FX.init({ctx,proj:(z,x,h)=>proj(z,x,h),getG:()=>G}); FX.setD(D);
// ---- 主題（每階輪替）----
const THEME={
 grass:{name:'草原',sky:['#4fb3ff','#bfe9ff'],sun:'#fff3b0',hill:'#5fbf5a',ground:['#59b94f','#3f9a3d'],track:['#e8d6a8','#cdb47c'],curb:['#ffffff','#ff5b5b'],deco:'tree'},
 desert:{name:'沙漠',sky:['#ff9f5a','#ffe2a8'],sun:'#fff6d0',hill:'#e0a35a',ground:['#f0c27a','#d9a35c'],track:['#c98d58','#a8703f'],curb:['#fff','#3aa0ff'],deco:'cactus'},
 snow:{name:'雪原',sky:['#7fa9d9','#e6f3ff'],sun:'#ffffff',hill:'#cfe3f5',ground:['#f4f9ff','#d5e6f5'],track:['#9fb6cc','#7e97b0'],curb:['#fff','#2f7bff'],deco:'pine'},
 lava:{name:'熔岩',sky:['#2a0b12','#a3301c'],sun:'#ffb347',hill:'#3a1a1a',ground:['#3b2222','#241414'],track:['#5a4a4a','#3a2e2e'],curb:['#ffcc33','#ff3b1f'],deco:'rock'},
 neon:{name:'霓虹',sky:['#0b0626','#3a106b'],sun:'#ff4fd8',hill:'#1d0f45',ground:['#120a30','#0a0620'],track:['#1c1446','#110c2e'],curb:['#00f0ff','#ff2bd6'],deco:'post'},
};
const LEVEL_SEED=20261014; // 每關內容固定（同一關每次都一樣，方便挑戰星等）
function newRun(level){ G={seed:LEVEL_SEED, stage:level||1, level:level||1, build:{}, coins:0, state:'menu', revUsed:0, pickN:0}; }
// 開始一個關卡：能力重置（不繼承到下一關），永久升級（金幣）保留
function startLevel(level,noAnim){ if(!noAnim&&!NOANIM()) return wipe(()=>startLevel(level,true));
  newRun(level); G.segs=Level.build(G.seed,level,2,Abil); G.seg=0; startSegment(true); G.state='choice'; G.resume='run'; G.picks=2; if(level===1) tutStart();
  const hw=G.segs.reduce((a,L)=>a+L.hordes.length,0); titleCard(`第 ${level} 關`,`${THEME[G.lv.theme].name} · ${G.segs.length} 段`,`🧟 ${hw} 波殭屍潮　😈 ${G.segs.length-1} 中 Boss　👹 最終 Boss`,()=>showChoice('🏁 開局')); }
// ---- v0.6 轉場：斜向擦除 + 關卡標題卡 ----
const NOANIM=()=>{ const u=new URLSearchParams(location.search); return !!(u.get('noanim')||u.get('shot')); };
function wipe(fn){ const w=$('wipe'); show(null); w.className='in'; setTimeout(()=>{ fn(); w.className='out'; setTimeout(()=>w.className='',520); },480); }
function titleCard(h,sub,info,cb){ const el=$('ttl'); if(NOANIM()){ cb&&cb(); return; } $('ttlH').textContent=h; $('ttlS').textContent=sub; $('ttlI').textContent=info; el.className=''; void el.offsetWidth; el.className='on';
  let done=false; const fin=()=>{ if(done) return; done=true; el.className='off'; setTimeout(()=>{ el.className=''; },350); cb&&cb(); }; el.onclick=fin; setTimeout(fin,1900); }
// ---- v0.6 無盡挑戰 ----
function startEndless(noAnim){ if(!noAnim&&!NOANIM()) return wipe(()=>startEndless(true));
  newRun(1); G.endless=1; G.seed=(Date.now()^(Math.random()*1e9))>>>0; G.E={wave:0,kills:0,mini:0,final:0,qte:0}; G.segs=[]; G.seg=0; startSegment(true); G.state='choice'; G.resume='run'; G.picks=2;
  titleCard('♾️ 無盡挑戰','卡片整局保留 · 難度無限上升',`每 5 波中 Boss · 每 25 波魔王　最佳 ${Combat.fmt(Endless.load(localStorage).best)}`,()=>{ tip('endless'); showChoice('♾️ 開局'); }); }
// v0.6.1 N5/N6：無盡難度跟著兵力與輸出走；兵力軟上限＋硬上限
function endlessWave(h){ const E_=CONFIG.v6.endless, n=h.n||1; const EV7=CONFIG.v7.endless, cnt=Math.round(Math.min(EV7.waveMax,EV7.waveA+EV7.waveB*n)); /* v0.7 §6.3：min(90, 12+1.5n) */ const gr_=n>E_.lateFrom?Math.pow(E_.hpGrow,E_.lateFrom)*Math.pow(E_.hpGrowLate,n-E_.lateFrom):Math.pow(E_.hpGrow,n); /* v0.6.2：第 20 波後 HP 每波 ×1.09、殭屍上限 90 */ const dur=h.duration;
  h.ke=h.count=cnt; h.rate=cnt/dur; G.dmgW=0; G.hwT0=G.t;
  const sd_=Combat.simDps(Math.max(1,G.army),G.st,G.lv.tier)*E_.simFrac*Math.min(1,E_.simRamp0+E_.simRampN*n); /* v0.6.1：以理論 DPS 當下限，避免實測 DPS 受限於殭屍血量而自我鎖死 */
  G.zHpWave=Math.max(Endless.zombieHp(n), Math.max(G.eDps||0,sd_)*(dur+3)*E_.hpOverDps*gr_/cnt*CONFIG.v7.hpMul073)*(G.eHpAdj||1); /* v0.7.3 ×1.1 */
  G.eContact=Math.max(Math.pow(CONFIG.v7.endless.armyG,n), Math.max(1,G.army)*Math.min(E_.threatCap,E_.threatFrac*Math.pow(E_.threatGrow,n))/cnt); /* v0.7：接觸扣兵下限 ×1.04^n */ /* v0.6.3：全隊漏光最多扣 threatCap（50%）兵力 */
  G.hwArmy0=Math.max(1,G.army); G.hLoss=0;
  G.chargeQ=n>=E_.chargerFrom?Math.max(E_.chargerMin,Math.round(cnt*E_.chargerFrac)):0; G.chargeN=0; G.hwCnt=cnt; G.hLossC=0; G.chargeHit=0; G.eChargeDmg=G.chargeQ?G.hwArmy0*((G.eLossEma!=null&&G.eLossEma<E_.chargeFullBelow)?E_.hordeLossTarget:E_.hordeLossTarget-E_.regTarget)*(G.eChargeK||1)/G.chargeQ:0; /* v0.6.4：一般殭屍幾乎不扣兵時，衝鋒屍目標拉到完整 12% */ } /* v0.6.4：第 6 波起每波固定有一批護盾衝鋒屍，一定會撞到隊伍 */
function makeCharger(u){ u.charger=1; u.sp=Math.max(u.sp,CONFIG.v6.endless.chargerSp); u.stun=u.frozen=u.slow=u.burn=u.poison=0; G.chargeN++; if(!G.chargerSeen){ G.chargerSeen=1; tip('charger'); } }
/* v0.6.3：單波屍潮扣超過波初 20% 後只扣 25%；回傳實際扣量並記入本波屍潮扣兵 */
function endlessHordeLoss(l){ const E_=CONFIG.v6.endless, over=Math.max(0,(G.hLoss||0)+l-(G.hwArmy0||G.army)*E_.hordeLossSoft); l-=over*(1-E_.hordeLossSoftMul); G.hLoss=(G.hLoss||0)+l; return l; }
/* v0.6.3：燃燒／中毒是「最大 HP %」傷害，會讓 HP 回授失效；無盡屍潮改以回授前的 HP 計算 */
function dotRef(u){ return (G.endless&&G.state==='horde'&&(G.eHpAdj||1)>1)?u.maxHp/G.eHpAdj:u.maxHp; }
/* v0.6.3：屍潮扣兵回授——上一波扣兵 <5% 就把殭屍 HP 調高、>20% 就調低，讓每波屍潮約扣 5–20% 兵力（威脅跟兵力＋實際 DPS 走） */
function endlessHordeFeedback(){ const E_=CONFIG.v6.endless, A0=Math.max(1,G.hwArmy0||1), f=(G.hLoss||0)/A0, fc=(G.hLossC||0)/A0, fr=Math.max(0,f-fc); let a=G.eHpAdj||1;
  /* v0.6.4：拆成兩部分——一般殭屍扣兵（移動平均）由溫和的 HP 回授壓在約 5%；衝鋒屍補足到 12%（每隻接觸傷害回授、限幅） */
  const mr=G.eLossEma=(G.eLossEma==null)?fr:E_.lossEmaK*fr+(1-E_.lossEmaK)*G.eLossEma; const tgtR=G.chargeQ?E_.regTarget:E_.hordeLossTarget, lo=G.chargeQ?E_.regLo:E_.hordeLossLo, hi=G.chargeQ?E_.regHi:E_.hordeLossHi;
  if(mr<lo||mr>hi) a*=Math.max(E_.adjDown,Math.min(E_.adjUp,Math.pow(tgtR/Math.max(0.003,mr),E_.adjExp))); G.eHpAdj=Math.max(E_.adjMin,Math.min(E_.adjMax,a));
  if(G.chargeQ){ const d=mr<E_.chargeFullBelow?E_.hordeLossTarget:Math.max(E_.chargeMinFrac,Math.min(E_.hordeLossTarget,E_.hordeLossTarget-mr)); G.eChargeK=Math.max(E_.chargeKMin,Math.min(E_.chargeKMax,(G.eChargeK||1)*Math.max(E_.chargeDown,Math.min(E_.chargeUp,Math.pow(d/Math.max(0.003,fc),E_.chargeExp))))); }
  G.eLossLog=(G.eLossLog||[]).concat([[G.E&&G.E.wave,+f.toFixed(4),+fc.toFixed(4),+G.eHpAdj.toFixed(3),+(G.eChargeK||1).toFixed(3),G.chargeQ||0,G.chargeN||0,G.chargeHit||0,Math.round(G.eChargeDmg||0),A0]]).slice(-60); }
function endlessArmyCap(){ const E_=CONFIG.v6.endless, S=E_.armySoft, H=E_.armyHard; const prev=G.aPrev||G.army;
  if(G.army>prev&&G.army>S){ const gain=G.army-prev; G.army=prev+gain*(S/Math.max(S,prev)); }
  if(G.army>H) G.army=H; G.aPrev=G.army; }
function endlessScore(){ return Endless.score({kills:G.E.kills,wave:G.E.wave,mini:G.E.mini,final:G.E.final,qte:G.E.qte,army:G.army,revives:G.revUsed}); }
function endlessOver(){ const today=new Date().toISOString().slice(0,10); const r=Endless.record(localStorage,{kills:G.E.kills,wave:G.E.wave,mini:G.E.mini,final:G.E.final,qte:G.E.qte,army:Math.max(0,G.army),revives:G.revUsed},today);
  meta.coins+=r.coins+G.coins; G.coins=0; saveMeta(); G.E.done=1; return r; }
function renderEndlessMenu(){ const d=Endless.load(localStorage), ok=Endless.unlocked(meta)||new URLSearchParams(location.search).get('endless');
  $('enInfo').innerHTML=ok?`最佳分數 <b>${Combat.fmt(d.best)}</b>　最遠第 ${d.bestWave} 波`:`🔒 通關第 ${CONFIG.v6.endless.unlockStage} 關後開放（目前已解鎖到第 ${meta.unlocked||1} 關）`;
  $('enBoard').innerHTML=d.board.length?d.board.map((x,i)=>`<div class=gi><span>${['🥇','🥈','🥉'][i]||(i+1)}</span><div><b>${Combat.fmt(x.score)}</b>　第 ${x.wave} 波<br><small>${x.date}</small></div></div>`).join(''):'<div style="opacity:.7">尚無紀錄</div>';
  $('bEnGo').disabled=!ok; $('bEnGo').style.opacity=ok?1:0.5; show('endless'); }
function startSegment(first){
  const st=Abil.computeStats(G.build,meta); G.st=st; if(G.endless&&(!G.segs[G.seg]||G.segs[G.seg].lanes!==st.lanes)) G.segs[G.seg]=Endless.buildSegment(G.seed,G.seg,st.lanes); let L=G.segs[G.seg]; G.zHp=L.zHp||null; G.gatesDone=0; G.cDebt=0; G.contactAcc=0;
  if(!G.endless&&st.lanes!==L.lanes) L=G.segs[G.seg]=Object.assign(Combat.prepareStage(Stage,Abil,L.segSeed,L.level,st.lanes,{kind:L.boss.kind,entry:L.entry}),{seg:L.seg,segs:L.segs,level:L.level,entry:L.entry,lanes:st.lanes,segSeed:L.segSeed});
  G.lv=L; G.th=THEME[G.lv.theme]; setTimeout(abBar,0);
  if(first){ G.army=Math.round(Stage.startArmy(G.level,st.startAdd)*st.startMulX); sgReset(); Object.assign(G,{xp:0,lvl:0,boost:1,elites:0}); } else G.army=Math.round(Math.max(1,G.army));
  G.army0=G.army; G.lastGateArmy=G.army; FX.clear(); SFX.bgm(true);
  Object.assign(G,{z:0,x:0,t:0,shields:st.shields,revive:st.revive,fx:[],parts:[],shots:[],units:[],gems:[],fireAcc:0,gunAcc:0,visAcc:0,wcd:{},thT:0,shake:0,pop:0,combo:0,banner:null,hordeT:0,B:null,stop:0,state:'run'});
  const act=Abil.activeSynergies(G.build); if(act.length) banner('★ 組合技：'+act.map(a=>a.name).join('、'),'#7dffb0');
  if(G.endless) banner(`♾️ 第 ${L.waveFrom}–${L.waveFrom+4} 波 · ${L.boss.kind==='boss'?'魔王':'中 Boss'}`,'#ffd23f'); else if(first) banner(`第 ${G.level} 關 · ${G.lv.segs} 段`,'#ffd23f'); else banner(`第 ${G.seg+1}/${G.lv.segs} 段${G.seg===G.lv.segs-1?'：最終 Boss！':''}`,'#ffd23f');
  hud(); show(null);
}
// ---- 小工具 ----
const rnd=Math.random, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function float(t,c,z,x,big){ if(G.fx.length>(G.units.length>200?28:70)&&!big) return; G.fx.push({t,c,z:z===undefined?G.z+1:z,x:x===undefined?G.x:x,life:1,big}); }
function burst(z,x,col,n,spd,h){ const PC=CONFIG.horde.maxParticles||150; n=n||12; if(G.parts.length>PC*0.8||(G.units&&G.units.length>220)) n=Math.min(n,1); else if(G.parts.length>PC*0.5) n=Math.min(n,3); n=Math.min(n,Math.max(0,PC-G.parts.length)); /* v0.6.2：粒子硬上限 150（QA：L100 Boss 戰最低 42 FPS） */ for(let i=0;i<n;i++){ const a=rnd()*6.28,v=(spd||1)*(0.5+rnd()); G.parts.push({z,x,h:h||0.3,vx:Math.cos(a)*v*0.3,vz:Math.sin(a)*v*3,vh:1+rnd()*2*(spd||1),life:0.6+rnd()*0.5,col}); } }
function banner(t,c,prio){ /* prio 高的覆蓋低的；終極=2、LEVEL UP=0 避免蓋住終極名 */ if(G.banner&&(G.banner.prio||0)>(prio||0)&&G.banner.life>0.3) return; G.banner={t,c:c||'#ffd23f',life:prio?1.8:1.3,prio:prio||0}; }
function shake(v){ G.shake=Math.max(G.shake,v); }
function rowGates(r){ return r.timed && Math.floor((G.t+r.timed.phase)/r.timed.period)%2 ? r.alt : r.gates; }
function rowOffset(r){ return r.moving ? r.moving.amp*Math.sin(G.t*r.moving.speed+r.moving.phase) : 0; }
function laneOf(r){ const n=r.gates.length, x=G.x-rowOffset(r); return clamp(Math.floor((x+1)/2*n),0,n-1); }
function obsX(o){ if(o.type==='saw') return Math.sin(G.t*o.speed*1.6+o.phase)*0.6; return o.x; }
function obsActive(o){ return o.type!=='hammer' || Math.sin(G.t*o.speed*2.2+o.phase)>0.4; }
function good(g){ return g.op==='+'||g.op==='x'; }
const VIS_ICON={fireball:'🔥',ice:'❄️',lightning:'⚡',arcane:'🔮',poison:'☠️',laser:'🔦',meteor:'☄️',tornado:'🌪️',boomerang:'🪃',saw:'⚙️',holy:'✨',shock:'💥',missile:'🚀',blackhole:'🕳️'};
const ELEM_COL={fire:'#ff7a1f',ice:'#7fe0ff',thunder:'#fff36b',arcane:'#c77dff',nature:'#7dff6a',holy:'#fff6b0',phys:'#e0e0e0'};
function abIcon(id){ if(id.startsWith('syn_')) return '★'; const w=Abil.WEAPONS[id]; if(w) return VIS_ICON[w.vis]; if(id.startsWith('evo_')) return '✦'+(abIcon(id.slice(4))||''); const e=Abil.ELEM_TAG[id]; return e?Abil.ELEM_NAME[e].slice(0,2):'⬆️'; }
// 卡片上的具體數字（以目前階數換算）
function abNumbers(a,lvl){ const w=Abil.WEAPONS[a.id]; if(a.id==='gunStream'||a.id==='twinGun'){ const st=Abil.computeStats(Object.assign({},G.build,{[a.id]:(G.build[a.id]||0)+1}),meta); return `<small class=num>🔫 彈道 ${Combat.gunStreams(st)}／${CONFIG.gunMaxStreams}</small>`; }
  if(a.id&&a.id.startsWith('p_')){ const id=a.id.slice(2); const st=Abil.computeStats(Object.assign({},G.build,{[a.id]:(G.build[a.id]||0)+1}),meta); return `<small class=num>${VIS_ICON[(Abil.WEAPONS[id]||{}).vis]||'⬆️'} 投射物 ×${Combat.weaponProj(st,id)}</small>`; }
  if(!w) return ''; const tier=G.lv?G.lv.tier:0; const nb=Object.assign({},G.build,{[a.id]:lvl}); const st=Abil.computeStats(nb,meta);
  const cd=w.cd/Math.max(0.3,st.cdMul||1), n=Combat.weaponProj(st,a.id);
  const extra={fire:'，燃燒',ice:'，冰凍',thunder:'',nature:'，毒霧',arcane:'，追蹤'}[w.elem]||'';
  return `<small class=num>${VIS_ICON[w.vis]} 投射物 ×${n} · 每 ${cd.toFixed(1)} 秒${extra}</small>`; }
function abPreview(a){ const w=Abil.WEAPONS[a.id]; const c=w?ELEM_COL[w.elem]:'#9ad'; return `<span class=pv style="--c:${c}">${abIcon(a.id)}</span>`; }
function abBar(){ const el=$('abBar'); if(!el||!G) return; const act=Abil.activeSynergies(G.build);
  const gs=Combat.gunStreams(G.st||Abil.computeStats(G.build,meta));
  el.innerHTML=`<span class=ab title="槍彈道">🔫<sub>${gs}</sub></span>`+Abil.ABILITIES.filter(a=>G.build[a.id]&&!a.id.startsWith('p_')).map(a=>`<span class=ab>${abIcon(a.id)}<sub>${G.build[a.id]}</sub></span>`).join('')+Object.keys(G.st&&G.st.weapons||{}).map(id=>{const n=Combat.weaponProj(G.st,id); return n?`<span class=ab title="${id}">${VIS_ICON[Abil.WEAPONS[id].vis]}×${n}</span>`:''}).join('')+act.map(s=>`<span class="ab syn" title="${s.name}">★${s.name.slice(0,2)}<sub>${G.build[s.key]}</sub></span>`).join(''); }
// 選卡展示：慢動作 0.5 秒 + 大圖示 + 名稱 + 一行效果，武器立刻施放
function showcase(a,newSyn){ G.slow=0.5; const el=$('showcase'); el.innerHTML=`<div class=sc-i>${abIcon(a.id)}</div><b>${a.name}${G.build[a.id]>1?' Lv'+G.build[a.id]:''}</b><small>${a.desc}</small>`; el.className='on'; setTimeout(()=>el.className='',1100);
  if(Abil.WEAPONS[a.id]) G.wcd[a.id]=0.01; else { G.aura=1.2; burst(G.z+1,G.x,ELEM_COL[Abil.ELEM_TAG[a.id]]||'#7df9ff',30,1.5,0.8); }
  newSyn.forEach((s,i)=>setTimeout(()=>comboFx(s),600+i*900)); abBar(); }
// 組合技觸發：全螢幕閃光 + 大字 + 專屬音效 + 隊伍改色光環
function comboFx(s){ if(s.ult) tip('ult'); $('showcase').className=''; /* QA v3：避免選卡展示與組合技大字重疊 */ const el=$('comboFlash'); if(s.ult){ G.ultT=G.ultT||{}; G.ultT[s.ult]=0.8; } el.innerHTML=`<div>${s.ult?'🌟 終極・全螢幕攻擊 🌟':'★ 組合技 ★'}</div><b>${s.name}</b><small>${s.desc}</small>`; el.className=''; void el.offsetWidth; el.className='on'; setTimeout(()=>el.className='',1600);
  SFX.evo(); setTimeout(()=>SFX.win&&SFX.win(),150); shake(18); G.comboT=1.6; for(let i=0;i<5;i++) burst(G.z+3+i*2,(rnd()-0.5)*1.4,['#ffd23f','#ff4fd8','#7df9ff','#7dff6a','#ffffff'][i],30,2.5,1); abBar(); }
function synFx(id){ const y=Abil.SYNERGIES.find(s=>s.id===id); if(!y||!Abil.activeSynergies(G.build).includes(y)) return false; const n=performance.now(); G.synT=G.synT||{}; if(n-(G.synT[id]||0)>2500){ G.synT[id]=n; banner('★ '+y.name+' 發動！','#7dffb0'); } return true; }
function applyGate(r){ let g=rowGates(r)[laneOf(r)]; const before=G.army, s=G.st; if(g.op==='stone'){ applyStone(g); G.lastGateArmy=G.army; return; } if(g.op==='+'&&G.sg&&G.sg.twinN>0&&G.sg.twin>0){ g=Object.assign({},g,{v:g.v*2}); G.sg.twinN=0; G.sg.twin=0; float('✨ ×2！','#fff27a',G.z+3,G.x,true); }
  // 能力改變閘門：用固定亂數重播 Combat 規則，並把觸發的效果顯示出來
  const rolls=[]; const rr=()=>{ const v=rnd(); rolls.push(v); return v; };
  const gE=(G.endless&&g.op==='+'&&g.v>0)?Object.assign({},g,{v:Math.round(g.v*Math.pow(CONFIG.v7.endless.armyG,G.E.wave||0))}):g; /* v0.7 §6.3：無盡 + 門 ×1.04^n */ G.army=Combat.applyGate(G.army,gE,s,rr); G.gatesDone=(G.gatesDone||0)+1; /* v0.6 QA(f)：前兩排閘門不會歸零 */
  if(G.seg===0&&G.gatesDone<=2&&!G.endless) G.army=Math.max(G.army, Math.min(before, Math.max(3, Math.round(Stage.startArmy(G.level,0)*0.4))));
  if(!G.endless&&(g.op==='-'||g.op==='÷')&&G.army<before) G.army=Math.max(G.army,Math.min(before,3),Math.round(before*CONFIG.v6.gateFloor)); /* v0.6.1：負面門最多扣到剩 40% */
  G.lastGateArmy=G.army;
  if(rolls[0]<s.doubleGate){ float('雙重閘門!','#ff9af0',G.z+3); synFx('mirror'); }
  if(g.op==='x'){ if(s.goldGate){ G.coins+=2; float('🪙+2','#ffd23f',G.z+3,G.x+0.3); synFx('alchemy'); } if(s.cloneAdd>0){ float('分身小隊 +'+Math.round(5*s.cloneAdd/2),'#7df9ff',G.z+3,G.x-0.3); synFx('legion'); } }
  if(g.op==='+'&&s.cloneAdd>0) synFx('legion');
  if(!good(g)){ const rL=rolls[1]; if(rL!==undefined&&rL<s.luck){ G.coins+=3; float('厄運化為 🪙+3','#ffd23f',G.z+3); synFx('fortune'); }
    else if(s.goldGate&&rolls[2]!==undefined&&rolls[2]<0.3){ G.coins+=Math.round(Combat.gateValue(g)/2)+2; float('點金：負面→金幣','#ffd23f',G.z+3); }
    else if(s.badMul===0||(s.noDiv&&g.op==='÷')) synFx('holy'); }
  const d=G.army-before, ok=d>=0; float((ok?'+':'')+Combat.fmt(d), ok?'#7dff7d':'#ff6060', G.z+2, G.x, true);
  if(ok){ G.combo++; SFX.good(G.combo); G.pop=1; burst(G.z+1.5,G.x,'#7df9ff',16,1.2,0.8); if(G.combo>=3) banner('連擊 COMBO x'+G.combo+'!','#7dffb0'); }
  else { G.combo=0; SFX.bad(); shake(8); burst(G.z+1.5,G.x,'#ff5050',12); } }
// ===== v0.7 石頭門／特殊門（DESIGN-v7-special-gates-zh-TW.md §1–§5） =====
const SGT=()=>CONFIG.v7.stoneGate;
function sgOn(k){ return !!(G&&G.sg&&G.sg[k]>0); }
function sgReset(){ G.sg={}; G.sgStun=0; G.sgToast=null; G.sgZN=0; G.sgCard=0; G.sgGrav=0; G.sgPeak=G.army||0; }
function sgSt(s){ if(!G.sg) return s; const fr=sgOn('frenzy'), sl=sgOn('slow'), sp=sgOn('spread'); if(!fr&&!sl&&!sp) return s; return Object.assign({},s,{rateMul:(s.rateMul||1)*(fr?1.5:1)*(sl?0.8:1),gunStreams:(s.gunStreams||0)+(sp?2:0)}); }
function sgSpeed(){ return (sgOn('haste')?1.6:1)*(sgOn('slow')?0.6:1); }
function sgDmgMul(){ return sgOn('curse')?0.7:1; }
function sgTick(dt){ if(!G.sg) sgReset(); for(const k in G.sg) if(G.sg[k]>0&&k!=='shieldN'&&k!=='twinN'){ G.sg[k]-=dt; if(G.sg[k]<=0){ G.sg[k]=0; if(k==='shield') G.sg.shieldN=0; if(k==='twin') G.sg.twinN=0; } }
  if(G.sgStun>0) G.sgStun-=dt; if(sgOn('gravity')) G.x=clamp(G.x+G.sgGrav*0.35*dt,-0.95,0.95); G.sgPeak=Math.max(G.sgPeak||0,G.army);
  if(G.sgToast){ G.sgToast.t-=dt; if(G.sgToast.t<=0) G.sgToast=null; }
  if(G.sgZN&&!G.units.some(u=>u.sgZ&&!u.dead)){ G.sgZN=0; const wc=Math.round(Upgrades.coins('wave',G.level)*G.st.coinMul); G.coins+=wc; float('🧟 清光！🪙+'+wc,'#ffd23f',G.z+2,0,true); } }
function sgToast(k){ const d=Special.BY[k]; if(!d) return; const id='sg_'+k; if(tipsOn()&&Tips.shouldShow(localStorage,id)){ Tips.mark(localStorage,id); G.sgToast={t:1.8,d}; } }
// 投影矩形（CSS px）
function stoneRect(r,i){ const gates=rowGates(r), n=gates.length, off=rowOffset(r), x0=-1+2*i/n+off, x1=-1+2*(i+1)/n+off, p0=proj(r.z,x0+.04), p1=proj(r.z,x1-.04); const h=H*0.1*p0.s; return {x:p0.x/D,y:(p0.y-h)/D,w:(p1.x-p0.x)/D,h:h/D}; }
function stoneTargets(){ if(!G||!G.lv||G.state!=='run'||G.frozen||tipCur) return []; const R=SGT().tapRange, out=[];
  for(const r of G.lv.rows){ if(r.done||!r.stone) continue; const d=r.z-G.z; if(d<R[0]||d>R[1]) continue; rowGates(r).forEach((g,i)=>{ if(g.op==='stone'&&!g.broken) out.push({r,g,i,rect:stoneRect(r,i)}); }); } return out; }
function hitStone(cx,cy){ const b=cv.getBoundingClientRect(), x=cx-b.left, y=cy-b.top, S=SGT(); for(const t of stoneTargets()){ const q=t.rect; let w=Math.max(S.hitMinPx,q.w*S.hitExpand), h=Math.max(S.hitMinPx,q.h*S.hitExpand); const mx=q.x+q.w/2, my=q.y+q.h/2; if(Math.abs(x-mx)<=w/2&&Math.abs(y-my)<=h/2) return t; } return null; }
function tapStone(t){ const g=t.g; if(g.broken||!G) return; const now=performance.now(); if(g.lastTap&&now-g.lastTap<SGT().tapMinGapMs) return; g.lastTap=now; g.tapsLeft--; g.flash=0.3; g.shakeT=0.15;
  burst(t.r.z,(-1+2*(t.i+0.5)/rowGates(t.r).length)+rowOffset(t.r),'#9a9a9a',8,1.2,0.6); SFX.hit(); try{ navigator.vibrate&&navigator.vibrate(10); }catch(e){}
  if(g.tapsLeft<=0){ g.broken=1; const d=Special.BY[g.sp]; burst(t.r.z,G.x,'#c8c8c8',24,2,0.8); SFX.chest(); shake(6); float('🪨 碎了！'+d.icon+' '+d.name,d.good?'#7dffb0':'#ff8080',t.r.z,undefined,true); sgToast(g.sp); if(!G.sgFirstBreak){ G.sgFirstBreak=1; tip('g_stone2'); } } }
function applyStone(g){ const s=G.st, tier=G.lv.tier||0;
  if(!g.broken){ if(G.sg&&G.sg.shieldN>0){ G.sg.shieldN--; float('護盾擋下石門！','#9fd0ff',G.z+2,G.x,true); burst(G.z+1.5,G.x,'#9fd0ff',16); return; }
    const p=Special.penalty(G.army,tier,s.armor,g.taps-g.tapsLeft>=g.taps/2,g.hard); G.army=Math.max(1,G.army-p.loss); G.sgStun=Math.max(G.sgStun||0,p.stun); float('🪨 撞上石門 -'+Combat.fmt(p.loss),'#ff6060',G.z+2,G.x,true); burst(G.z+1.5,G.x,'#8a8a8a',24,1.6); SFX.bad(); shake(10); G.combo=0; return; }
  sgApply(g.sp); }
function sgApply(k){ const d=Special.BY[k], s=G.st, tier=G.lv.tier||0, base=Special.reinforceAdd(tier,s.addMul); if(!d) return; if(!G.sg) sgReset(); if(d.sec) G.sg[k]=d.sec;
  banner(d.icon+' '+d.name+(d.sec?' '+d.sec+' 秒':''),d.good?'#7dffb0':'#ff8080'); if(d.good) SFX.good(3); else SFX.bad(); burst(G.z+1.5,G.x,d.col,20,1.4,0.8);
  if(k==='reinforce'){ G.army+=base; float('+'+Combat.fmt(base),'#7dff7d',G.z+2,G.x,true); }
  else if(k==='coin'){ const c=Math.round(2*Upgrades.coins('wave',G.level)*s.coinMul); G.coins+=c; float('🪙+'+c,'#ffd23f',G.z+2,G.x,true); SFX.coin(); }
  else if(k==='zombie'){ const h0=(G.segs&&G.segs[0]&&G.segs[0].hordes[0])||{ke:20}; const n=Math.min(60,Math.max(5,Math.round(0.8*h0.ke))); for(let i=0;i<n;i++){ const u=spawnZ(G.z+20+rnd()*10,rnd()*2.1-1.05,1,1.6+rnd()*0.8); if(u) u.sgZ=1; } G.sgZN=n; shake(8); SFX.zombie(); }
  else if(k==='shield'){ G.sg.shieldN=3; }
  else if(k==='freeze'){ G.units.forEach(u=>{ if(!u.dead&&!u.charger) u.frozen=Math.max(u.frozen||0,3); }); FX.screenFlash('#bff4ff',0.35); }
  else if(k==='magnet'){ const L=G.lv; for(let i=0;i<3;i++) L.coins.push({z:G.z+6+i*3,x:G.x+(rnd()-0.5)*0.6}); }
  else if(k==='bomb'){ const l=Math.round(G.army*0.08*(1-(s.armor||0))); G.army=Math.max(1,G.army-l); float('💣 -'+Combat.fmt(l),'#ff6060',G.z+2,G.x,true); shake(12); }
  else if(k==='nuke'){ FX.screenFlash('#ffffff',0.6); shake(16); G.units.forEach(u=>{ if(!u.dead&&u.z<G.z+70) dmgZ(u,(u.maxHp||u.hp)*((u.type==='elite'||u.type==='carrier')?0.1:0.4),'#ffd400',0); }); }
  else if(k==='twin'){ G.sg.twinN=1; }
  else if(k==='heal'){ const h=Math.round(Math.min(0.25*Math.max(0,(G.sgPeak||G.army)-G.army),base)); G.army+=h; float('💚 +'+Combat.fmt(h),'#7dff7d',G.z+2,G.x,true); }
  else if(k==='card'){ G.sgCard=(G.sgCard||0)+1; }
  else if(k==='breaker'){ G.sgBreaker=1; }
  else if(k==='elite'){ spawnZ(G.z+25,0,1,1.4,'elite'); spawnZ(G.z+28,-0.6,1,1.6,'bull'); spawnZ(G.z+28,0.6,1,1.6,'bull'); SFX.warn(); }
  else if(k==='thief'){ const c=Math.round((G.coins||0)*0.2); G.coins-=c; float('🦹 -🪙'+c,'#ff8080',G.z+2,G.x,true); }
  else if(k==='gravity'){ G.sgGrav=rnd()<0.5?-1:1; } }
function sgDraw(r,g,p0,p1,h,w){ const cx=(p0.x+p1.x)/2, s=p0.s; ctx.save();
  if(!g.broken){ const sh=g.shakeT>0?(g.shakeT-=0.016,(rnd()-0.5)*6*D*s):0; ctx.translate(sh,0); const gr=ctx.createLinearGradient(0,p0.y-h,0,p0.y); gr.addColorStop(0,g.hard?'#9aa3ad':'#a8a29a'); gr.addColorStop(1,g.hard?'#4c535c':'#5e574f'); ctx.fillStyle=gr; ctx.fillRect(p0.x,p0.y-h,w,h);
    ctx.strokeStyle=g.hard?'#e0c060':'#3a352f'; ctx.lineWidth=(g.hard?5:3)*D*s; ctx.strokeRect(p0.x,p0.y-h,w,h); const k=g.taps-g.tapsLeft; ctx.strokeStyle='#201c18'; ctx.lineWidth=2*D*s;
    for(let c=0;c<k;c++){ const a=c*2.39+0.7; ctx.beginPath(); ctx.moveTo(cx,p0.y-h*0.5); ctx.lineTo(cx+Math.cos(a)*w*0.42,p0.y-h*0.5+Math.sin(a)*h*0.45); ctx.stroke(); }
    if(g.flash>0){ ctx.fillStyle=`rgba(255,255,255,${g.flash})`; ctx.fillRect(p0.x,p0.y-h,w,h); g.flash-=0.03; }
    const fs=Math.max(10*D,26*s*D); ctx.font=`900 ${fs}px system-ui,sans-serif`; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.strokeStyle='#0008'; ctx.lineWidth=4*D*s; const tx='🪨 '+g.tapsLeft; ctx.strokeText(tx,cx,p0.y-h*0.42); ctx.fillText(tx,cx,p0.y-h*0.42);
    const d=r.z-G.z, R=SGT().tapRange; if(d>=R[0]&&d<=R[1]){ ctx.globalAlpha=0.6+0.4*Math.sin(G.t*10); ctx.font=`${Math.max(12*D,30*s*D)}px sans-serif`; ctx.fillText('👆',cx+w*0.3,p0.y-h*0.05); } }
  else { const d=Special.BY[g.sp], c=d.col; ctx.shadowColor=c; ctx.shadowBlur=22*s*D; ctx.fillStyle=c+'b0'; ctx.fillRect(p0.x,p0.y-h,w,h); ctx.shadowBlur=0; ctx.strokeStyle=d.good?'#ffffff':'#ff3b4f'; ctx.lineWidth=4*D*s; ctx.strokeRect(p0.x,p0.y-h,w,h);
    const fs=Math.max(10*D,30*s*D); ctx.textAlign='center'; ctx.font=`${fs}px sans-serif`; ctx.fillText(d.icon,cx,p0.y-h*0.5); ctx.font=`900 ${Math.max(9*D,15*s*D)}px system-ui,sans-serif`; ctx.fillStyle='#fff'; ctx.strokeStyle='#000a'; ctx.lineWidth=3*D*s; ctx.strokeText(d.name,cx,p0.y-h*0.12); ctx.fillText(d.name,cx,p0.y-h*0.12); }
  ctx.restore(); }
function sgHud(){ if(!G||!G.sg) return;
  if(sgOn('fog')){ const y=proj(G.z+18,0).y; const gr=ctx.createLinearGradient(0,y-H*0.08,0,y+H*0.05); gr.addColorStop(0,'rgba(150,155,160,0.97)'); gr.addColorStop(1,'rgba(150,155,160,0)'); ctx.fillStyle=gr; ctx.fillRect(0,0,W,y+H*0.05); }
  const a=[]; for(const d of Special.LIST){ const t=G.sg[d.k]; if(t>0&&d.sec) a.push(d.icon+Math.ceil(t)+(d.k==='shield'?'×'+(G.sg.shieldN||0):'')); } if(G.sgStun>0) a.push('💫'); if(a.length){ ctx.font=`900 ${15*D}px system-ui,sans-serif`; ctx.textAlign='left'; const t=a.join('  '), tw=ctx.measureText(t).width; ctx.fillStyle='#0009'; rr(8*D,H*0.155,tw+14*D,24*D,8*D); ctx.fillStyle='#fff'; ctx.fillText(t,15*D,H*0.155+17*D); }
  if(sgOn('reverse')){ ctx.font=`900 ${28*D}px sans-serif`; ctx.textAlign='center'; ctx.fillStyle=`rgba(200,120,255,${0.6+0.3*Math.sin(G.t*8)})`; ctx.fillText('⇄',22*D,H*0.5); ctx.fillText('⇄',W-22*D,H*0.5); }
  if(G.sgToast){ const d=G.sgToast.d, al=Math.min(1,G.sgToast.t*3); ctx.globalAlpha=al; const bw=Math.min(W*0.9,380*D), bx=(W-bw)/2, by=H*0.19; ctx.fillStyle='#101830e8'; rr(bx,by,bw,52*D,12*D); ctx.strokeStyle=d.good?'#7dffb0':'#ff8080'; ctx.lineWidth=2*D; ctx.strokeRect(bx+2*D,by+2*D,bw-4*D,48*D);
    ctx.textAlign='left'; ctx.font=`${26*D}px sans-serif`; ctx.fillStyle='#fff'; ctx.fillText(d.icon,bx+12*D,by+35*D); ctx.font=`900 ${15*D}px system-ui,sans-serif`; ctx.fillText('新特殊門・'+d.name,bx+50*D,by+21*D); ctx.font=`${13*D}px system-ui,sans-serif`; ctx.fillStyle='#dde'; ctx.fillText(d.line,bx+50*D,by+41*D); ctx.globalAlpha=1; } }
window.__grSgApply=k=>{ if(G&&G.lv) sgApply(k); }; /* 除錯／QA 用 */
window.__grStoneTargets=()=>stoneTargets().map(t=>{ const b=cv.getBoundingClientRect(); return {x:b.left+t.rect.x+t.rect.w/2,y:b.top+t.rect.y+t.rect.h/2,left:t.g.tapsLeft,z:t.r.z-G.z,sp:t.g.sp}; });
function critMult(){ return rnd()<G.st.crit?G.st.critMul:1; }
function fight(e){ const s=G.st; if(sgOn('invis')){ e.passed=1; float('👻 穿過！','#d9c2ff',e.z,e.x); return; } if(G.sg&&G.sg.shieldN>0){ G.sg.shieldN--; float('護盾!','#9fd0ff'); burst(e.z,e.x,'#9fd0ff',20); e.count=0; return; }
  if(G.shields>0){ G.shields--; float('護盾!','#6cf'); synFx('phalanx'); burst(e.z,e.x,'#6cf',20); e.count=0; return; }
  const m=critMult(); if(m>1) synFx('sniper'); if(s.rage&&G.army<20) synFx('berserk'); if(s.vamp>0) synFx('hydra'); const loss=Combat.fightLoss(e,s,G.army,m); G.army-=loss; G.army+=Math.round(e.count*s.vamp);
  float('-'+Combat.fmt(loss),'#ff6060'); if(m>1) float('爆擊!','#ffd23f',G.z+3,e.x); burst(e.z,e.x,'#e23b3b',26,1.5); burst(e.z,e.x,'#2f7bff',14,1.2); SFX.clash(); shake(10); e.count=0; }
function checkDead(){ if(G.army<=0){ if(G.revive>0){G.revive--; G.army=G.st.reviveN; float('復活!','#ffd23f'); banner('不死鳥復活！'); synFx('phoenix'); return false;} lose(); return true;} return false; }
function gainXp(n){ G.xp+=n; const need=CONFIG.xpPerLevel*Combat.tierM(G.lv.tier); let lc=0; while(G.xp>=need&&lc++<20){ G.xp-=need; G.lvl++; G.army=Math.round(G.army*(1+CONFIG.levelUpArmy)); G.lvPick=(G.lvPick||0)+1; banner('LEVEL UP! 兵力 +10%','#9dff6a',0); SFX.level(); } }
function shoot(tz,tx,col){ const o=crowdPos(); FX.bullet(o.x,o.z,tx,tz,col||'#fff36b',80); SFX.shot(); }

// ---- v0.6 接觸傷害：每 1 KE 碰到隊伍 = contactSoldiers × 階層倍率 名士兵；明顯回饋（士兵彈飛、紅閃、-N）----
const CONTACT_Z=0.9;
function contactLoss(u,T){ const V=CONFIG.v6; const c=u.cos?V.contact.summon:(V.contact[u.type]!==undefined?V.contact[u.type]:1); if(u.charger) return G.eChargeDmg*(1-Math.min(0.8,G.st.armor||0)); if(G.endless&&G.eContact&&G.state==='horde') return u.w*c*G.eContact*(1-Math.min(0.8,G.st.armor||0)); return u.w*c*Math.min(Combat.tierM(G.lv.tier),Math.max(1,0.05*G.army))*(1-Math.min(0.8,G.st.armor||0)); } /* v0.6.1：兵少時階層倍率不放大接觸 */
// 每 0.25 秒最多扣 max(2×階層倍率, 6% 兵力)；超過的接觸仍消失但不扣（DESIGN-v6 §2.2）
function contactCap(){ const V=CONFIG.v6; if(G.t-(G.capT0||-9)>=V.contactTick){ G.capT0=G.t; G.capUsed=0; } return Math.max(V.contactCapMin*Math.min(Combat.tierM(G.lv.tier),Math.max(1,0.05*G.army)),G.army*V.contactCapFrac)-(G.capUsed||0); }
function contactHit(u,T){ if(sgOn('invis')&&!u.charger){ if(rnd()<0.2) float('❓','#d9c2ff',G.z+1.2,u.x); return; } /* v0.7 隱形門 */ if(G.shields>0&&T.contact>=2){ G.shields--; float('護盾!','#6cf',G.z+1.5,u.x); return; }
  let l0=contactLoss(u,T); if(l0<=0) return; let l=u.charger?l0:Math.max(0,Math.min(l0,contactCap())); /* v0.6.4：護盾衝鋒屍傷害已由回饋控制，不吃 0.25 秒上限（否則被一般殭屍佔滿上限後永遠算不到） */ G.capUsed=(G.capUsed||0)+l; /* 超過上限的接觸依企劃 §2.2 不扣（防瞬間崩盤） */ if(G.endless&&G.state==='horde'&&l0>l) G.cDebt=(G.cDebt||0)+(l0-l); /* v0.6.3：無盡屍潮一起撞上時，超過 0.25 秒上限的部分改成分批扣（否則整群同時撞上幾乎不扣兵） */ if(l<=0){ burst(u.z,u.x,'#ff6060',4,0.8); G.redT=0.35; G.redA=0.2; return; } if(G.endless&&G.state==='horde'){ l=endlessHordeLoss(l); if(u.charger){ G.hLossC=(G.hLossC||0)+l; G.chargeHit=(G.chargeHit||0)+1; } } G.army-=l; G.statC=(G.statC||0)+l; G.contactAcc=(G.contactAcc||0)+l; G.contactN=(G.contactN||0)+1; G.lastContact=G.t;
  // 士兵彈飛（藍色小人粒子）
  const n=Math.min(6,Math.max(1,Math.round(l/Combat.tierM(G.lv.tier)))); for(let i=0;i<n&&G.parts.length<(CONFIG.horde.maxParticles||150);i++) G.parts.push({z:G.z+0.6+rnd()*0.6,x:u.x+(rnd()-0.5)*0.2,h:0.3,vx:(rnd()-0.5)*1.2,vz:-1-rnd()*2,vh:3+rnd()*2.5,life:0.9,col:'#2f7bff',sol:1});
  burst(u.z,u.x,'#ff3030',5,1.1,0.4); if(u.type==='bomber'){ burst(u.z,u.x,'#ff7a1f',20,2); shake(8); }
  if((G.redT||0)<=0){ G.redT=0.35; G.redA=Math.min(0.45,0.18+0.02*G.contactN); } shake(3); if((G.hurtS||0)<=0){ SFX.bad&&SFX.bad(); G.hurtS=0.25; } }
function contactTick(dt){ if(G.redT>0) G.redT-=dt; if(G.hurtS>0) G.hurtS-=dt; G.cT=(G.cT||0)-dt;
  if(G.cDebt>0&&G.lv){ const c=Math.max(0,contactCap()); let l=Math.min(G.cDebt,c); if(l>0){ G.capUsed=(G.capUsed||0)+l; G.cDebt-=l; if(G.endless) l=endlessHordeLoss(l); G.army-=l; G.statC=(G.statC||0)+l; G.contactAcc=(G.contactAcc||0)+l; } }
  if(G.contactAcc>=1&&G.cT<=0){ G.cT=0.3; const v=Math.floor(G.contactAcc); G.contactAcc-=v; G.contactN=0; float('-'+Combat.fmt(v),'#ff4040',G.z+1.2,G.x+(rnd()-0.5)*0.3,v>=G.army*0.05); } } /* v0.6.1 N4：飄字顯示實際扣掉的整數，不足 1 的部分累積 */
// 槍口：隊伍最前排（避免最前面的殭屍在槍口後方打不到）
function muzzle(){ const r=Math.min(0.42,0.06+Math.sqrt(Math.max(1,G.army))*0.012); return {x:G.x+(rnd()-0.5)*2*r, z:G.z+0.45+rnd()*0.3}; }
// 隊伍中隨機一名士兵的位置（子彈從人群射出）
function crowdPos(){ const r=Math.min(0.42,0.06+Math.sqrt(Math.max(1,G.army))*0.012); return {x:G.x+(rnd()-0.5)*2*r, z:G.z+0.6+rnd()*Math.min(2.2,0.3+r*4)}; }
// 基礎槍火視覺：彈道數 = gunProfile.streams，平行 + 扇形；子彈數受池上限保護
function gunVisual(dt,aim){ const gp=Combat.gunProfile(G.army,sgSt(G.st),G.lv.tier,G.boost); G.gp=gp; G.visAcc+=Math.min(180,gp.bulletsPerSec)*dt; FX.setBulletSize(gp.size); let c=0;
  const dmg=gp.dmg*(G.boost>1?1.2:1); const pierce=Math.min(CONFIG.maxPierce,G.st.pierce|0); const st=G.bulletSt;
  while(G.visAcc>=1&&c++<28){ G.visAcc-=1; const o=muzzle(), i=c%gp.streams, off=gp.streams>1?(i/(gp.streams-1)-0.5):0;
    const mx_=o.x+off*0.08, ax_=(aim?aim.x:G.x)+off*gp.spread*10+off*0.1, az_=aim?aim.z:o.z+CONFIG.gunRange, dz_=Math.max(0.5,az_-o.z), k_=(dz_+CONFIG.gunRange)/dz_; const tz=o.z+dz_*k_, tx=mx_+(ax_-mx_)*k_; /* v0.6.1 N2：沿槍口→目標直線延長 */
    FX.fireGun(o.x+off*0.08,o.z,tx,tz,{dmg,pierce,radius:CONFIG.gunRadius,speed:CONFIG.gunSpeed,life:CONFIG.gunRange*1.3/CONFIG.gunSpeed,col:G.boost>1?'#7df9ff':'#fff36b',kind:'gun',st}); }
  if(c&&rnd()<0.3) SFX.shot(); }
// 元素武器：每把有冷卻；擊殺量 = weaponRate × 冷卻 × killPerShot（與模擬一致）
function zombiesNear(n,f){ const a=G.units.filter(u=>!u.dead&&u.hp>0&&u.z<G.z+70&&(!f||f(u))); a.sort((p,q)=>p.z-q.z); return a.slice(0,n); }
// 敵人種類混合：前期以基本/快跑/蝙蝠為主，關卡越後面越多坦克/盾/騎士/自爆/吐酸/分裂
// 元素 → 狀態效果：火=灼燒、冰=冰凍/緩速、雷=麻痺、毒=中毒、震波/迴力鏢/隕石=擊退
const WST={fireball:{burn:2},meteor:{burn:2.5,kb:1},ice:{freeze:1.2,slow:2.5},lightning:{stun:0.9},laser:{stun:0.4},poison:{poison:3},tornado:{kb:1,slow:1.5},boomerang:{kb:1},shock:{kb:1,stun:0.5},holy:{slow:1},missile:{kb:1,burn:1},blackhole:{stun:1},arcane:{},saw:{}};
function typeMix(level){ return Object.keys(FX.ETYPES).filter(k=>k!=='basic').map(k=>[k,level>=FX.ETYPES[k].from?FX.ETYPES[k].weight:0]); }
function pickType(level){ let m=typeMix(level); const goldCap=G.hw?Math.min(3,Math.max(1,Math.round((G.hw.ke||20)*0.02))):2;
  if((G.goldN||0)>=goldCap) m=m.filter(([k])=>k!=='gold'); let tot=m.reduce((a,b)=>a+b[1],0)||1, r=rnd()*tot; for(const [k,w] of m){ r-=w; if(r<=0){ if(k==='gold') G.goldN=(G.goldN||0)+1; return k; } } return 'basic'; }
function avgHp(level){ const m=typeMix(level), tot=m.reduce((a,b)=>a+b[1],0); return m.reduce((a,[k,w])=>a+FX.ETYPES[k].hp*w,0)/tot; }
// 敵人血量（以「擊殺當量」計）：平均正規化成 w，讓模擬平衡不變；隨關卡難度微幅上升（只影響手感：要多打幾發）
function spawnZ(z,x,w,baseSp,type){ type=type||(G.forceT&&rnd()<0.5?G.forceT[Math.floor(rnd()*G.forceT.length)]:pickType(G.lv&&G.lv.typeStage||G.level)); if(type==='gold'&&G.forceT){ const gc=G.hw?Math.min(3,Math.max(1,Math.round((G.hw.ke||20)*0.02))):2; if((G.goldN||0)>=gc) type=FX.ETYPES.zombie?'zombie':'basic'; else G.goldN=(G.goldN||0)+1; } const T=FX.ETYPES[type]; if(T.gold&&G.z!=null) z=Math.min(z,G.z+CONFIG.gunRange-3); // 金幣屍只在射程內出現
  const hp=w*((G.endless&&G.state==='horde'&&G.zHpWave)||G.zHp||Stage.zombieHp(G.level))*(T.hp||1)*((!G.endless&&G.state==='horde'&&G.hw&&G.hw.hpMul)||1); /* v0.7：第 1–3 關末波 HP 打折 */ // v0.6：基本殭屍 = 基礎槍 zombieHits 發
  if(G.units.length>=(G.hw&&G.hw.big?CONFIG.horde.maxVisibleBig:CONFIG.horde.maxVisible)*1.15) return null;
  const hitR=T.fat?CONFIG.hit.fat:T.sp>1.2?CONFIG.hit.runner:CONFIG.hit.mob;
  const u={id:(G.uid=(G.uid||0)+1),z,x,w,type,hp,maxHp:hp,sp:baseSp*(CONFIG.v7.zombieSpeedMul||1)*T.sp*(1-(G.st.slowZ||0)*0.5),ph:rnd()*6,big:1,hitR}; G.units.push(u); return u; }
function dmgZ(u,d,col,gun,st){ if(u.dead) return; if(u.charger){ u.hitT=0.06; if(!(u.shT>G.t)){ u.shT=G.t+0.6; float('🛡','#ffd23f',u.z,u.x); } return; } /* v0.6.4：衝鋒屍護盾：免疫傷害與控場 */ const s=G.st;
  d*=sgDmgMul(); if(gun&&u.type==='shield'&&u.z>G.z) d*=0.5; if(gun&&u.type==='armored') d*=0.6; if(u.buffT>0) d*=0.7; // 精英光環減傷
  let crit=false; if(gun&&rnd()<s.crit){ d*=s.critMul; crit=true; }
  if(G.endless) G.dmgW=(G.dmgW||0)+Math.min(d,Math.max(0,u.hp)); u.hp-=d; u.hitT=0.1; if((!gun||!(u.kbCd>G.t))&&!(G.state==='horde'&&(G.hordeT<-15||G.endless))){ /* v0.6.1：無限模式屍潮不擊退，否則高攻速把殭屍釘在射程外、永遠碰不到 */ if(gun) u.kbCd=G.t+0.25; const nz_=u.z+Math.min(0.8,(gun?0.1:0.35)*(st&&st.kb?3:1)*(FX.ETYPES[u.type].hp>=4?0.4:1)), lim_=G.z+CONFIG.gunRange-2; u.z=nz_>lim_?Math.max(u.z,lim_):nz_; } /* v0.6.1：基礎槍擊退每 0.25 秒最多一次，避免高射速把殭屍永久釘住 */ /* v0.6.1 N3：擊退不推出射程 */ // 受擊白閃 + 擊退
  u.dAcc=(u.dAcc||0)+d; u.dCol=col||'#ffffff'; if(crit) float(Combat.fmt(Math.max(1,d))+'!','#ffd23f',u.z,u.x,true);
  if(rnd()<0.3) burst(u.z,u.x,crit?'#ffd23f':'#fff6a0',2,0.5,0.5); if((G.hitS||0)<=0){ SFX.hit(); G.hitS=0.06; }
  if(st&&!G.tipSt){ for(const k of ['burn','poison','stun','freeze','slow']) if(st[k]) tip('s_'+k); if(['burn','poison','stun','freeze','slow'].every(k=>Tips.seen(localStorage,'s_'+k))) G.tipSt=1; }
  if(st){ if(st.burn) u.burn=Math.max(u.burn||0,st.burn); if(st.poison) u.poison=Math.max(u.poison||0,st.poison); if(st.stun) u.stun=Math.max(u.stun||0,st.stun); if(st.freeze) u.frozen=Math.max(u.frozen||0,st.freeze); if(st.slow) u.slow=Math.max(u.slow||0,st.slow); }
  if(u.hp<=0.0001) killZ(u); }
function killZ(u){ if(u.dead) return; if(u.charger){ u.hp=Math.max(u.hp,1); return; } /* v0.6.4：衝鋒屍只會在撞上隊伍時消失 */
  if(u.type==='skeleton'&&!u.revived&&rnd()<0.3){ u.revived=1; u.hp=u.maxHp*0.5; burst(u.z,u.x,'#ffffff',10,1); float('復活!','#eee',u.z,u.x); return; }
  const kids=u.child?0:u.type==='fatty'?6:u.type==='carrier'?8:u.type==='slime'?2:0; const km=u.type==='fatty'?0.3:0.4; for(let i=0;i<kids;i++){ const c=spawnZ(u.z+0.3+rnd(),u.x+(rnd()-0.5)*0.3,u.w*km,2.0,u.type==='slime'?'slime':'zombie'); if(c){ c.child=1; c.big=0.7; c.hp=c.maxHp=u.maxHp*km; } } if(kids) burst(u.z,u.x,'#8fae5a',10,1.2);
  if(u.type==='bomber'){ burst(u.z,u.x,'#ff7a1f',16,1.6); G.units.forEach(o=>{ if(o!==u&&!o.dead&&!o.charger&&Math.abs(o.x-u.x)<0.25&&Math.abs(o.z-u.z)<3){ o.hp-=u.w*Combat.HP0()*Combat.tierM(G.lv.tier); if(o.hp<=0) setTimeout(()=>killZ(o),0); } }); }
  _killZ(u); }
function _killZ(u){ if(u.dead) return; u.dead=1; G.killed+=u.w; if(G.E) G.E.kills+=u.w; const T=FX.ETYPES[u.type]||{}; FX.pop(u.x,u.z,T.glow||'#ffffff',T.hp>=3); if(u.dAcc>0){ float(Combat.fmt(Math.max(1,u.dAcc)),u.dCol||'#fff',u.z,u.x); u.dAcc=0; }
  if(T.gold){ const c=Math.round(25*G.st.coinMul); G.coins+=c; float('🪙+'+c,'#ffd23f',u.z,u.x,true); burst(u.z,u.x,'#ffd23f',30,2); SFX.coin(); } if(G.gems.length<160) G.gems.push({z:u.z,x:u.x,w:u.w}); else gainXp(CONFIG.xpPerGem*u.w); burst(u.z,u.x,'#5fae3a',3,0.8); }
function castWeapons(dt){ const s=G.st, L=G.lv; if(!s.weapons) return; const W=Abil.WEAPONS;
  for(const id in s.weapons){ const w=W[id], lvl=s.weapons[id]; if(!w||!lvl) continue;
    G.wcd[id]=(G.wcd[id]||rnd()*w.cd)-dt; if(G.wcd[id]>0) continue; const cd=w.cd/Math.max(0.3,s.cdMul||1); G.wcd[id]=cd; const evo=!!(s.evoW&&s.evoW[id]); const from=muzzle();
    const nProj=Combat.weaponProj(s,id); const dmg0=Combat.HP0()*w.k*(0.6+0.4*lvl)*(1+(s.wElem[w.elem]||0))*(s.wMul[id]||1)*(1+s.area)*0.35;
    const areaR={fireball:[0.35,5],meteor:[0.7,8],poison:[0.5,6],blackhole:[0.9,10],shock:[1.1,12],holy:[0.25,4],tornado:[0.35,14],ice:[0.3,4]}[w.vis];
    // 發射 nProj 發；AOE 落地才 inRadius 扣血；彈道類走真實碰撞
    for(let pi=0;pi<nProj;pi++){
      const off=(nProj>1?(pi/(nProj-1)-0.5):0)*0.25;
      if(G.state==='horde'||(G.state==='run'&&G.units.some(u=>!u.dead&&u.z<G.z+60))||G.state==='boss'){
        const near=zombiesNear(40); const aim=G.state==='boss'?{x:(rnd()-0.5)*0.4,z:L.boss.z}: (near[Math.min(near.length-1,pi)]||{x:G.x+off,z:G.z+20});
        if(areaR){ const c=w.vis==='shock'?{x:G.x,z:G.z+4}:{x:aim.x+off,z:aim.z}; const tg=[{x:c.x,z:c.z}];
          FX.cast(w.vis,from,tg,()=>{ const zs=FX.inRadius(G.units,c.x,c.z,areaR[0]*(evo?1.35:1)*(1+s.area),areaR[1]*(evo?1.35:1));
            zs.forEach(u=>dmgZ(u,dmg0,ELEM_COL[w.elem],0,WST[w.vis])); if(G.B&&Math.abs((G.B.bx||0)-c.x)<areaR[0]+0.55&&Math.abs(L.boss.z-c.z)<areaR[1]) hitBoss(dmg0,c.x);
            /* v0.6：不再把總傷害顯示在範圍中心；每隻被打到的怪在自己的位置顯示（dAcc 合併） */
            if(w.vis==='meteor'||w.vis==='shock') shake(8); },{evo,lvl}); }
        else if(w.vis==='lightning'){ const chain=1+(s.chain|0); let cur=near[0]; const tg=cur?[cur]:[{x:aim.x,z:aim.z}];
          if(cur){ cur._tg=1; for(let j=1;j<chain+nProj;j++){ let b=null,bd=1e9; for(const u of near) if(!u._tg){ const d=Math.abs(u.x-cur.x)*10+Math.abs(u.z-cur.z); if(d<bd){bd=d;b=u;} } if(!b) break; b._tg=1; tg.push(b); cur=b; } near.forEach(u=>u._tg=0); }
          FX.cast(w.vis,from,tg.map(u=>({x:u.x,z:u.z})),()=>{ tg.forEach(u=>{ if(u.hp!==undefined) dmgZ(u,dmg0,ELEM_COL.thunder,0,WST.lightning); }); },{evo,lvl}); }
        else if(w.vis==='laser'){ const x0=G.x+off; FX.cast(w.vis,{x:x0,z:from.z},[{x:x0,z:G.z+40}],()=>{ FX.inRadius(G.units,x0,G.z+20,0.22*(1+s.area),40).forEach(u=>dmgZ(u,dmg0,ELEM_COL.thunder,0,WST.laser)); if(G.B&&Math.abs((G.B.bx||0)-x0)<0.3) hitBoss(dmg0); },{evo,lvl}); }
        else { // 彈道武器：真實飛行碰撞
          const spd={missile:50,arcane:55,boomerang:60,ice:70,fireball:55}[w.vis]||65;
          const rad={missile:0.12,arcane:0.12,boomerang:0.10,ice:0.12}[w.vis]||CONFIG.hit.proj;
          const tx=aim.x+off+(rnd()-0.5)*0.1, tz=aim.z+rnd()*2;
          const hom=w.vis==='missile'||w.vis==='arcane'?()=>{ const t=zombiesNear(1)[0]; return t?{x:t.x,z:t.z}:(G.B?{x:0,z:L.boss.z}:null); }:null;
          FX.bullet(from.x+off*0.2,from.z,tx,tz,ELEM_COL[w.elem]||'#fff',spd,null,0.3,{dmg:dmg0,pierce:w.vis==='boomerang'?3:0,radius:rad,kind:w.vis,st:WST[w.vis],homing:hom,life:1.1}); }
      } else if(G.state==='run'){ const e=L.enemies.find(e=>e.count>0&&e.z-G.z<45&&e.z>G.z+3); if(!e){ G.wcd[id]=0.15; break; }
        FX.cast(w.vis,from,[{x:e.x+off,z:e.z}],()=>{ e.count=Math.max(0,e.count-dmg0*0.08); e.hitT=0.1; },{evo,lvl}); }
    } } }
// 殭屍共用邏輯：基礎槍火（多發才打死）、移動、碰撞漏怪
// 跑道怪物群（有數字＝血量）：槍火會打掉數字，打到 0 擊破
function mobGun(dt){ const L=G.lv; if(G.hitS>0) G.hitS-=dt; for(const e of L.enemies){ if(e.count<=0) continue; e.dT=(e.dT||0)-dt; if(e.dAcc>=0.5&&e.dT<=0){ e.dT=0.25; float('-'+Combat.fmt(e.dAcc),'#ffffff',e.z,e.x); e.dAcc=0; } if(e.hitT>0) e.hitT-=dt; } }
// ===== 終極（全螢幕）攻擊：冷卻長、等級越高傷害越高、冷卻越短 =====
const ULT={ meteor:{cd:14,col:'#ff7a1f',vis:'meteor',name:'流星雨',st:{burn:3,kb:1},sfx:'meteor'}, storm:{cd:13,col:'#fff36b',vis:'lightning',name:'雷霆風暴',st:{stun:2},sfx:'lightning'},
  blizzard:{cd:15,col:'#9fe8ff',vis:'ice',name:'絕對零度',st:{freeze:3,slow:5},sfx:'ice'}, judgement:{cd:14,col:'#fff6b0',vis:'holy',name:'神聖審判',st:{kb:1,stun:0.6},sfx:'holy'},
  singularity:{cd:16,col:'#8a5cff',vis:'blackhole',name:'奇點坍縮',st:{stun:1.5},sfx:'blackhole'} };
function ultTick(dt){ const s=G.st; if(!s.ult) return; for(const k in s.ult){ const U=ULT[k], syn=Abil.SYNERGIES.find(y=>y.ult===k), lv=(syn&&G.build[syn.key])||1; G.ultT=G.ultT||{};
    G.ultT[k]=(G.ultT[k]===undefined?3:G.ultT[k])-dt; if(G.ultT[k]>0) continue; const alive=G.units.filter(u=>!u.dead&&u.z<G.z+70);
    if(!alive.length&&!(G.state==='boss')&&!G.lv.enemies.some(e=>e.count>0&&e.z-G.z<45)){ G.ultT[k]=0.5; continue; }
    G.ultT[k]=U.cd*(1-0.08*(lv-1)); const dmg=(G.unitW||1)*Combat.HP0()*Combat.tierM(G.lv.tier)*(1.6+0.6*lv); if(G.B) hitBoss(G.B.max*0.04*lv); // 全螢幕：畫面上所有敵人＋Boss
    banner('🌟 終極：'+U.name+(lv>1?' Lv'+lv:'')+'！',U.col,2); FX.screenFlash(U.col,0.55); shake(30); SFX.elem(U.sfx); setTimeout(()=>SFX.elem(U.sfx),120); SFX.slam();
    const pts=[]; for(let i=0;i<14;i++) pts.push({x:-1.1+2.2*(i%7)/6+(rnd()-0.5)*0.2,z:G.z+6+Math.floor(i/7)*14+rnd()*10});
    if(k==='singularity'){ const c={x:0,z:G.z+16}; alive.forEach(u=>{ u.stun=1.6; u.pull=c; }); FX.cast('blackhole',c,[c,...alive.slice(0,60).map(u=>({x:u.x,z:u.z,ref:u}))],()=>{ G.units.forEach(u=>{ if(!u.dead&&u.z<G.z+70) dmgZ(u,dmg*1.2,U.col,0,U.st); }); FX.screenFlash('#ffffff',0.5); shake(30); },{evo:1,lvl:lv+3}); }
    else { pts.forEach((pt,i)=>setTimeout(()=>{ if(!G||G.state==='over') return; FX.cast(U.vis,{x:pt.x,z:k==='meteor'?pt.z:G.z+1},[pt],null,{evo:1,lvl:lv+2}); },i*40));
      setTimeout(()=>{ if(!G) return; G.units.forEach(u=>{ if(!u.dead&&u.z<G.z+70) dmgZ(u,dmg,U.col,0,U.st); }); G.lv.enemies.forEach(e=>{ if(e.count>0&&e.z-G.z<45){ e.count*=0.5-0.05*lv; e.hitT=0.2; } }); FX.screenFlash(U.col,0.45); shake(24); },420); } } }
function hitBoss(d,x){ if(!G||!G.lv) return; const b=G.lv.boss; if(!b) return; d*=sgDmgMul(); d*=(G.st.bossDmg?1+G.st.bossDmg:1); if(G.B&&G.B.vuln>0) d*=1.15;
  const hx=x===undefined?(rnd()-0.5)*0.5:clamp(x,-0.5,0.5);
  // v0.6：進戰前仍可打，但最多打掉 bossPreFightCap（15%）；鎖血中傷害無效（IMMUNE）
  if(!G.B){ b.preDmg=b.preDmg||0; const cap=b.hp*(b.preCap||CONFIG.bossPreFightCap); if(b.preDmg>=cap){ immuneFx(b.z,hx,'護盾'); return; } d=Math.min(d,cap-b.preDmg); b.preDmg+=d; b.preHit=1; }
  else if(G.B.lock){ immuneFx(b.z,hx,'IMMUNE'); return; } else G.B.physDmg=(G.B.physDmg||0)+d;
  G.bdAcc=(G.bdAcc||0)+d; G.bdX=hx; }
function immuneFx(z,x,txt){ G.imT=(G.imT||0); if(G.t-G.imT>0.35){ G.imT=G.t; float(txt,'#9fe8ff',z,x); } G.shieldHit=0.15; }
function bossDmgTick(dt){ G.bdT=(G.bdT||0)-dt; if(G.bdAcc>0&&G.bdT<=0){ G.bdT=0.22; float('-'+Combat.fmt(G.bdAcc),'#fff',G.lv.boss.z,G.bdX||0); G.bdAcc=0; } if(G.shieldHit>0) G.shieldHit-=dt; }
function applyBulletHit(target,b,dmg){
  if(target.isMob){ const e=target; let dd=dmg/Combat.HP0()*Combat.tierM(G.lv.tier)*1.6; if(rnd()<G.st.crit){ dd*=G.st.critMul; float(Combat.fmt(dd)+'!','#ffd23f',e.z,e.x,true); }
    e.max=e.max||e.count; e.count=Math.max(0,e.count-dd); e.hitT=0.1; e.dAcc=(e.dAcc||0)+dd; burst(e.z,e.x+(rnd()-0.5)*0.2,'#fff6a0',2,0.6,0.5); if((G.hitS||0)<=0){ SFX.hit(); G.hitS=0.05; }
    if(e.count<1){ e.count=0; e.dead=1; FX.pop(e.x,e.z,'#ff6060',true); float('擊破！','#ffd23f',e.z,e.x,true); burst(e.z,e.x,'#e23b3b',24,1.6); SFX.clash(); G.coins+=1; } return; }
  if(target.isChest){ const ch=G.lv.chest; if(ch.hp<=0) return; ch.hp--; burst(ch.z,ch.x,'#ffe066',3,0.6); if(ch.hp<=0){ target.dead=1; const add=Math.round(G.army*CONFIG.chestRecruit); G.army+=add; const cn=Math.round(CONFIG.chestCoins*G.st.coinMul); G.coins+=cn; float('寶箱! +'+Combat.fmt(add)+' 🪙'+cn,'#ffd23f',ch.z,ch.x,true); burst(ch.z,ch.x,'#ffd23f',40,2); SFX.chest(); shake(6);} return; }
  if(target.isGate){ const g=target.g; if(g.shoot<CONFIG.shootGateMax){ g.shoot++; g.flash=0.15; } if(g.shoot>=CONFIG.shootGateMax) target.dead=1; return; }
  if(target===G.lv.boss||(G.B&&target===G.B)||target.isBoss){ hitBoss(dmg,b.x); if((G.hitS||0)<=0){ SFX.hit(); G.hitS=0.05; } burst(G.lv.boss.z,(rnd()-0.5)*0.3,'#ffd23f',3,0.8,1); return; }
  let crit=false; let d=dmg; if(b.kind==='gun'&&rnd()<G.st.crit){ d*=G.st.critMul; crit=true; }
  dmgZ(target,d,null,b.kind==='gun'?1:0,b.st); if(crit) float(Combat.fmt(d)+'!','#ffd23f',target.z,target.x,true); }
// 本幀可被子彈打中的目標（殭屍＋跑道怪物群＋寶箱＋可射擊閘門），Boss 另算
function hitTargets(){ const L=G.lv, list=G.units.slice();
  for(const e of L.enemies) if(e.count>0&&!e.passed&&e.z>G.z&&e.z-G.z<CONFIG.gunRange+4){ e.isMob=1; e.hitR=0.32; e.dead=0; list.push(e); }
  const ch=L.chest; if(ch&&ch.hp>0&&ch.z>G.z&&ch.z-G.z<CONFIG.gunRange+4){ (G.chP=G.chP||{isChest:1}); Object.assign(G.chP,{x:ch.x,z:ch.z,hitR:CONFIG.hit.gate,dead:0}); list.push(G.chP); }
  for(const r of L.rows) if(!r.done&&r.z>G.z&&r.z-G.z<CONFIG.gunRange){ const gs=rowGates(r), n=gs.length; gs.forEach((g,i)=>{ if(g.shoot!==undefined&&g.shoot<CONFIG.shootGateMax){ g._p=g._p||{isGate:1,g}; Object.assign(g._p,{x:-1+(2*i+1)/n+rowOffset(r),z:r.z,hitR:CONFIG.hit.gate,dead:0}); list.push(g._p); } }); }
  return list; }
function tickCollide(){ const L=G.lv; const boss=G.B?{isBoss:1,z:L.boss.z,x:0,hitR:CONFIG.hit.boss,hp:G.B.hp}:(L&&L.boss&&L.boss.hp>1&&G.z>L.boss.z-CONFIG.gunRange-6?{isBoss:1,z:L.boss.z,x:0,hitR:CONFIG.hit.boss,hp:L.boss.hp}:null);
  FX.collide(hitTargets(),boss,applyBulletHit); }
// 跑道瞄準：寶箱 > 本車道可射擊閘門 > 怪物群 > 殭屍 > Boss（進入射程即可打）
function runAim(){ const L=G.lv, R=CONFIG.gunRange; const ch=L.chest; if(ch&&ch.hp>0&&ch.z>G.z&&ch.z-G.z<R) return {x:ch.x,z:ch.z};
  const row=L.rows.find(r=>!r.done&&r.z>G.z&&r.z-G.z<R); if(row){ const gs=rowGates(row), i=laneOf(row), g=gs[i]; if(g.shoot!==undefined&&g.shoot<CONFIG.shootGateMax) return {x:-1+(2*i+1)/gs.length+rowOffset(row),z:row.z}; }
  const e=L.enemies.filter(e=>e.count>0&&!e.passed&&e.z>G.z+1&&e.z-G.z<R).sort((a,b)=>a.z-b.z)[0]; if(e) return {x:e.x,z:e.z};
  const u=zombiesNear(1,u=>u.z<G.z+R)[0]; if(u) return {x:u.x,z:u.z};
  if(L.boss&&L.boss.z-G.z<R+6) return {x:0,z:L.boss.z}; return null; }
function zombieTick(dt,inRun){ const s=G.st, L=G.lv, HC=CONFIG.horde; G.bulletSt=(s.fire>0||s.slowZ>0||s.thunder>0)?{burn:s.fire>0?1+0.3*s.fire:0,slow:s.slowZ>0?1.2:0,stun:s.thunder>0&&rnd()<0.1?0.3:0}:null;

  if(G.hitS>0) G.hitS-=dt; G.elites=G.units.filter(u=>!u.dead&&u.type==='elite');
  for(const u of G.units){ const T=FX.ETYPES[u.type]||FX.ETYPES.basic;
    // 狀態效果
    if(u.burn>0){ u.burn-=dt; const d=dotRef(u)*0.3*dt; u.hp-=d; u.dAcc=(u.dAcc||0)+d; u.dCol='#ff8a1f'; }
    if(u.poison>0){ u.poison-=dt; const d=dotRef(u)*0.22*dt; u.hp-=d; u.dAcc=(u.dAcc||0)+d; u.dCol='#7dff6a'; }
    if(u.hp<=0&&!u.dead){ killZ(u); continue; }
    if(u.charger){ u.stun=u.frozen=u.slow=u.burn=u.poison=0; u.pull=null; } if(u.stun>0) u.stun-=dt; if(u.slow>0) u.slow-=dt; if(u.frozen>0) u.frozen-=dt; if(u.hitT>0) u.hitT-=dt; if(u.buffT>0) u.buffT-=dt;
    u.dT=(u.dT||0)-dt; if(u.dAcc>0&&u.dT<=0){ u.dT=0.3; if(G.fx.length<70) float(Combat.fmt(Math.max(1,u.dAcc)),u.dCol||'#fff',u.z,u.x); u.dAcc=0; } // 傷害數字合併顯示
    for(const e of G.elites) if(e!==u&&Math.abs(e.x-u.x)<0.5&&Math.abs(e.z-u.z)<5) u.buffT=0.5;
    if(T.tele){ u.tT=(u.tT||2+rnd()*2)-dt; if(u.tT<=0){ u.tT=3; burst(u.z,u.x,'#b080ff',10,1); u.z=Math.max(G.z+4,u.z-4-rnd()*3); u.x=clamp(u.x+(rnd()-0.5)*0.8,-1.1,1.1); burst(u.z,u.x,'#b080ff',10,1); } }
    if(T.summon){ u.smT=(u.smT||2)-dt; if(u.smT<=0){ u.smT=3; for(let i=0;i<3;i++){ const c=spawnZ(u.z+0.5,u.x+(rnd()-0.5)*0.4,u.w*0.3,1.6,'zombie'); if(c) c.child=1; } burst(u.z,u.x,'#40a0ff',12,1.2); } }
    if(T.gold&&u.z-G.z<16){ u.flee=1; } if(u.flee){ u.z+=u.sp*1.6*dt; if(u.z>G.z+CONFIG.gunRange){ u.dead=1; u.fled=1; float('逃走了!','#ffd23f',G.z+CONFIG.gunRange-4,u.x,true); burst(u.z,u.x,'#ffd23f',14,1.2); } continue; } /* v0.6：離開射程立刻消失 */
    if(u.pull&&u.stun>0){ u.x+=(u.pull.x-u.x)*dt*2.5; u.z+=(u.pull.z-u.z)*dt*2.5; } else u.pull=null;
    const stop=u.stun>0||u.frozen>0; let sl=stop?0:(u.slow>0?0.5:1)*(u.buffT>0?1.3:1); if(G.endless&&G.state==='horde'&&G.hordeT<-CONFIG.v6.endless.chargeAfter) sl=CONFIG.v6.endless.chargeSpeed; /* v0.6.3：無盡屍潮超時後殘兵無視冰凍／暈眩衝鋒，避免高血殭屍被控場卡住整波 */
    if(T.bull){ u.cT=(u.cT||3)-dt; if(u.cT<=0){ u.cT=4; u.charge=0.8; } if(u.charge>0){ u.charge-=dt; sl*=3.5; if(rnd()<0.3) burst(u.z,u.x,'#c8a070',2,0.6,0.1); } }
    if(T.leap) sl*=0.6+Math.abs(Math.sin(G.t*3+u.ph))*1.2; if(T.ghost&&!T.tele){ u.gT=(u.gT||rnd()*4)-dt; if(u.gT<=0){ u.gT=4; u.invis=1; } if(u.invis>0) u.invis-=dt; }
    if(u.type==='healer'){ u.hT=(u.hT||2)-dt; if(u.hT<=0){ u.hT=2; for(const o of G.units) if(!o.dead&&o.maxHp&&Math.abs(o.x-u.x)<0.4&&Math.abs(o.z-u.z)<4) o.hp=Math.min(o.maxHp,o.hp+o.maxHp*0.05); FX.cast('holy',u,[{x:u.x,z:u.z}],null,{}); } } if(u.frozen>0)u.frozen-=dt; if(u.burn>0){ u.burn-=dt; } if(u.hitT>0) u.hitT-=dt;
    if(u.type==='spitter'&&(u.spN||0)<3&&u.z-G.z<14&&u.z-G.z>8){ u.spT=(u.spT||rnd()*2)-dt; if(u.spT<=0){ u.spT=2.5; u.spN=(u.spN||0)+1; FX.bullet(u.x,u.z,G.x,G.z+1,'#7dff6a',22,()=>{ let l=Math.max(0,Math.min(u.w*CONFIG.v6.contact.spitter*Combat.tierM(L.tier),contactCap())); G.capUsed=(G.capUsed||0)+l; G.army-=l; G.contactAcc=(G.contactAcc||0)+l; G.redT=0.3; G.redA=0.2; burst(G.z+1,G.x,'#7dff6a',6); }); } continue; }
    u.z-=u.sp*sl*(sgOn('slowmo')?0.5:1)*dt; u.x+=(G.x-u.x)*dt*0.35*Math.min(1,8/Math.max(1,u.z-G.z));
    if(!u.dead&&u.z<=G.z+CONTACT_Z){ u.dead=1; contactHit(u,T); } }
  G.units=G.units.filter(u=>!u.dead); }
function update(dt){
  if(!G.lv) return; if(G.endless) endlessArmyCap(); if(window.__botTick) window.__botTick(G,dt); if(G.tut) tutTick(dt); tutCheck(); if(tipActive()) return; if(G.bd){ bossDeathTick(dt); if(G.bd) dt*=G.bd.fx.timeScale(); } if(G.slow>0){ G.slow-=dt; dt*=0.3; } if(G.aura>0) G.aura-=dt; if(G.comboT>0) G.comboT-=dt; G.t+=dt; G.shake*=Math.pow(0.02,dt); G.pop=Math.max(0,G.pop-dt*3);
  if(G.banner&&(G.banner.life-=dt)<=0) G.banner=null;
  G.shots.forEach(o=>o.l-=dt); G.shots=G.shots.filter(o=>o.l>0); G.fx.forEach(f=>f.life-=dt*0.8); G.fx=G.fx.filter(f=>f.life>0);
  G.parts.forEach(p=>{ p.x+=p.vx*dt; p.z+=p.vz*dt; p.h+=p.vh*dt; p.vh-=6*dt; if(p.h<0){p.h=0;p.vh*=-0.3;} p.life-=dt; }); G.parts=G.parts.filter(p=>p.life>0);
  if(G.stop>0){ G.stop-=dt; return; } // hit-stop
  if(!['run','horde','boss'].includes(G.state)) return; const s=G.st, L=G.lv;
  G.army+=G.army*s.regen*dt;
  // 經驗寶石飛向玩家
  G.gems.forEach(g=>{ const dx=G.x-g.x, dz=G.z+1-g.z, d=Math.hypot(dx,dz/10); if(d<0.25+s.magnet||g.fly){ g.fly=1; g.x+=dx*dt*8; g.z+=dz*dt*8; if(d<0.08){ g.got=1; gainXp(CONFIG.xpPerGem*(g.w||1)); } } }); G.gems=G.gems.filter(g=>!g.got);
  if(G.state==='run'||G.state==='horde') sgTick(dt); if(G.state==='run'&&!G.sgTipped&&G.lv.rows.some(r=>r.stone&&!r.done)&&stoneTargets().length){ G.sgTipped=1; tip('g_stone'); } /* 石頭門第一次可點時暫停教學 */ /* v0.7：特殊門秒數只在跑道／屍潮計時（Boss、QTE 暫停） */ FX.update(dt,burst); castWeapons(dt); ultTick(dt); contactTick(dt); bossDmgTick(dt);
  if(G.state==='run'&&G.sgCard>0){ G.sgCard--; G.state='choice'; G.resume='run'; G.picks=1; showChoice('🃏 卡片門'); return; }
  if(G.state==='run'&&G.lvPick>0&&!G.slow){ G.lvPick--; G.state='choice'; G.resume='run'; G.picks=1; showChoice('⬆ 升級！'); return; }
  if(G.state==='run'){
    // 跑道上的殭屍群（與閘門混在同一條路上，慢慢走向隊伍）
    for(const pk of (L.packs||[])) if(!pk.done&&G.z>=pk.z-55){ pk.done=1; const cnt=clamp(Math.round(pk.n),1,70); const w=pk.n/cnt; G.runW=w;
      for(let i=0;i<cnt;i++) spawnZ(pk.z+rnd()*10,rnd()*2.1-1.05,w,1.0+rnd()*0.8); }
    if(G.units.length) zombieTick(dt,1); if(checkDead()) return;
    gunVisual(dt,runAim()); tickCollide();
    const pz=G.z; G.z+=CONFIG.runSpeed*s.speed*sgSpeed()*dt;
    for(const r of L.rows) if(!r.done&&r.z<=G.z&&r.z>pz){ r.done=1; applyGate(r); }
    for(const e of L.enemies) if(e.count>0&&!e.passed&&e.z<=G.z+1.5){ if(Math.abs(e.x-G.x)<0.4){ fight(e); if(checkDead())return; } else { e.passed=1; float('閃過！','#7dffb0',e.z,e.x); } } // v0.4：閃過不扣人；撞上才扣剩下的數字
    mobGun(dt);
    for(const o of L.obstacles){ if(o.done||Math.abs(o.z-G.z)>1.2) continue;
      if(o.type==='push'){ G.x=clamp(G.x+(o.x>0?1:-1)*1.6*dt,-0.95,0.95); continue; }
      if(obsActive(o)&&Math.abs(obsX(o)-G.x)<o.w/2+0.12){ o.done=1; if(G.sg&&G.sg.shieldN>0){ G.sg.shieldN--; float('護盾!','#9fd0ff'); burst(o.z,G.x,'#9fd0ff',14); continue; } const l=Math.round(Combat.obstacleLoss(o,G.army,s)*(sgOn('haste')?0.5:1)); G.army-=l; float('-'+Combat.fmt(l),'#ff6060'); burst(o.z,G.x,'#2f7bff',18,1.4); SFX.hit(); shake(12); if(checkDead())return; } }
    for(const c of L.coins) if(!c.got&&Math.abs(c.z-G.z)<2&&Math.abs(c.x-G.x)<s.magnet*(sgOn('magnet')?3:1)+0.15+(sgOn('magnet')?0.6:0)){c.got=1;G.coins+=Math.round(s.coinMul);SFX.coin(); if(s.magnet>0.4) synFx('blackhole');burst(c.z,c.x,'#ffd23f',6);}
    for(const p of L.pickups) if(!p.got&&Math.abs(p.z-G.z)<1.5&&Math.abs(p.x-G.x)<0.3){ p.got=1; SFX.chest();
      if(p.type==='elite'){ G.elites++; G.army+=Math.round(5*Combat.tierM(L.tier)); banner('⭐ 精英巨人加入！','#ffd23f'); } else { G.boost*=1.5; banner('🔫 武器升級：射速 x1.5','#7df9ff'); } }
    if(s.thunder>0){ G.thT-=dt; if(G.thT<=0){ G.thT=3/s.thunder; const e=L.enemies.find(e=>e.count>0&&e.z-G.z<45); if(e){e.count*=0.6; G.shots.push({z:e.z,x:e.x,l:.3,th:1}); synFx('storm'); burst(e.z,e.x,'#fffb7a',20,2);} } }
    { const hw=(L.hordes||[]).find(h=>!h.done&&G.z>=h.z); if(hw){ hw.done=1; if(G.endless) endlessWave(hw); G.hw=hw; G.state='horde'; G.hordeT=hw.duration; G.spawnAcc=0; G.spawned=0; G.killed=0; G.gunAcc=0; G.goldN=0; banner(hw.big?`🧟🧟 第 ${hw.wave}/${hw.waves} 波：屍海來襲！`:`🧟 第 ${hw.wave}/${hw.waves} 波殭屍潮`,'#ff6a3c'); SFX.warn(); SFX.zombie(); if(hw.big) shake(14); if(!tutTip('t_horde')) tip(hw.big?'sea':'horde'); else Tips.mark(localStorage,'horde'); } }
    if(G.z>=L.boss.z-6){ if(G.endless&&G.eDps&&!L.boss.eScaled){ L.boss.eScaled=1; L.boss.hp=Math.max(L.boss.hp,Math.round(G.eDps*(L.boss.boss?CONFIG.v6.endless.bossSecFinal:CONFIG.v6.endless.bossSecMini)*Math.pow(1.03,G.E.wave)*CONFIG.v7.hpMul073)); } G.state='boss'; L.boss.z=G.z+13; G.B=Combat.bossInit(L.boss,G.army,s); G.B.noAbstract=1; if(G.sgBreaker){ G.sgBreaker=0; G.B.lockI=1; banner('🔨 破甲：第一層護盾已破！','#c0c8d0'); } /* v0.7 破甲門 */ if(G.endless&&L.boss.boss){ G.B.slamEvery=CONFIG.bossSlamEvery*CONFIG.v6.endless.finalSlamMul; G.B.slamT=G.B.slamEvery; } /* v0.6.2：無盡終極魔王大招間隔 +25% */ G.B.stage=G.level; G.B.ultIdx=0;
      // 進入前已打掉的血量保留
      if(L.boss.preDmg){ G.B.hp=Math.max(1,G.B.max-L.boss.preDmg); }
      G.army=G.B.army; G.dmgAcc=0; synFx('dragon');
      banner((L.boss.boss?'👹 BOSS：':L.boss.mini?'😈 中 BOSS：':'守衛：')+(L.boss.name||'')+(L.boss.skill?' — '+L.boss.skill.split('（')[0]:''),'#ff4fd8'); SFX.warn(); if(!tutTip('t_boss')) tip(L.boss.boss?'boss':'mini'); }
  } else if(G.state==='horde'){
    const H_=G.hw||L.horde, HC=CONFIG.horde; G.hordeT-=dt;
    const cap=H_.big?HC.maxVisibleBig:HC.maxVisible; const uw=G.unitW=Math.max(1,(H_.ke||H_.rate*H_.duration)/cap); /* v0.4：可小於 1 → 前期也有大量殭屍（每隻血量較低） */ // 畫面上每隻殭屍代表 uw 隻（同時最多 ~360 隻）
    if(G.hordeT>0||G.spawned<H_.ke){ G.spawnAcc+=H_.rate*dt; let c=0; while(G.spawnAcc>=uw&&G.spawned<H_.ke&&c++<80){ G.spawnAcc-=uw; G.spawned+=uw; const r=rnd(); const nu_=spawnZ(G.z+HC.spawnDist[0]+r*(HC.spawnDist[1]-HC.spawnDist[0]),H_.big?rnd()*2.6-1.3:rnd()*2.3-1.15,uw,2.2+rnd()*1.4); if(nu_&&G.endless&&G.chargeN<(G.chargeQ||0)&&G.spawned>=(G.chargeN+0.5)*(G.hwCnt||H_.ke)/G.chargeQ&&!(FX.ETYPES[nu_.type]||{}).gold) makeCharger(nu_); } }
    zombieTick(dt,0); { const tg=zombiesNear(6,u=>u.z<G.z+CONFIG.gunRange&&!(u.invis>0)); const a=tg[(rnd()*tg.length)|0]; gunVisual(dt,a?{x:a.x,z:a.z}:{x:G.x,z:G.z+20}); tickCollide(); }
    G.units=G.units.filter(u=>!u.dead); if(checkDead())return;
    if(G.hordeT<-20){ for(const u of G.units) if(!u.dead&&u.z>G.z+CONFIG.gunRange-6){ u.z=G.z+CONFIG.gunRange-8; u.x=clamp(u.x,-0.6,0.6); } } /* 保險：射程外殘兵拉回 */
    if(G.hordeT<=0&&G.spawned>=(H_.ke||0)-0.01){ // v0.6 QA(a)：只剩逃走金幣屍時強制結束，不卡關
      const live=G.units.filter(u=>!u.dead); const onlyGold=live.length&&live.every(u=>u.flee||u.fled||(FX.ETYPES[u.type]||{}).gold);
      if(onlyGold){ live.forEach(u=>{ u.dead=1; u.fled=1; float('逃走了!','#ffd23f',u.z,u.x,true); }); G.units=G.units.filter(u=>!u.dead); }
      if(!G.units.length){ if(G.endless){ G.eDps=Math.max(G.eDps||0, (G.dmgW||0)/Math.max(4,G.t-(G.hwT0||G.t))); if(G.cDebt>0){ G.army-=endlessHordeLoss(G.cDebt); G.cDebt=0; } endlessHordeFeedback(); } G.state='run'; G.army=Math.round(G.army); if(!G.endless){ const wc=Math.round(Upgrades.coins('wave',G.level)*G.st.coinMul); G.coins+=wc; float('🪙+'+wc,'#ffd23f',G.z+2,0,true); } /* v0.7 §2：每清完一波 waveCoins */ banner('殭屍潮清除！擊殺 '+Combat.fmt(G.killed),'#7dffb0'); G.gems.forEach(g=>g.fly=1); G.resume='run';
      if(G.endless){ G.E.wave=H_.n||G.E.wave+1; const EV7=CONFIG.v7.endless; if(G.E.wave%(EV7.pickEvery||1)===0){ G.state='choice'; G.picks=1; setTimeout(()=>showChoice(`🧟 第 ${G.E.wave} 波清除！`),400); } else { G.state='run'; banner(`🧟 第 ${G.E.wave} 波清除！`,'#7dffb0'); } } /* v0.7 §6.3：無盡每 2 波選 1 張卡 */ else { G.picks=2; G.roAfter='horde'; setTimeout(()=>startRoulette('card'),400); } } }
  } else { // Boss
    const B=G.B, before=B.phase;
    { const sm=zombiesNear(1)[0]; gunVisual(dt,sm&&sm.z<L.boss.z-3?{x:sm.x,z:sm.z}:{x:0,z:L.boss.z}); } tickCollide();
    // QTE 進行中：慢動作，等結果
    let qteRes=undefined;
    if(G.qte){ G.slow=Math.max(G.slow,0.05); if(G.qte.done){ qteRes=!!G.qte.ok; if(G.qte.ok){ if(G.E) G.E.qte++; banner('BREAK！','#ffd23f',3); FX.screenFlash('#fff',0.5); shake(20); SFX.win(); } G.qte=null; B.qteDone=1; B.qteOk=qteRes; B.qtePending=0; } }
    const bA0_=B.army; let res=Combat.bossStep(B,dt,s,L.tier,side=>side<0?G.x<0.1:G.x>-0.1,L.boss,qteRes); if(G.endless&&B.army<bA0_){ const E_=CONFIG.v6.endless; if(!B.eArmy0) B.eArmy0=Math.max(1,bA0_); const lim=B.eArmy0*E_.bossLossSoft; let l=bA0_-B.army; const over=Math.max(0,(B.eLoss||0)+l-lim); l-=over*(1-E_.bossLossSoftMul); B.eLoss=(B.eLoss||0)+l; B.army=bA0_-l; if(res==='lose'&&B.army>0) res=null; } /* v0.6.3：無盡 Boss 波扣兵超過波初兵力 45% 後，傷害只剩 20%（目標單一 Boss 波最多約 60%） */ G.army=B.army;
    for(const e of B.events){
      if(e.type==='dmg'){ /* v0.6：傷害數字在命中位置（hitBoss/bossDmgTick） */ }
      if(e.type==='lock'){ banner('🛡 鎖血！完成 QTE 或清光小兵','#9fe8ff',3); FX.screenFlash('#9fe8ff',0.35); shake(14); SFX.warn(); tip('lock'); }
      if(e.type==='unlock'){ banner(e.why==='qte'?'護盾破碎！BREAK':'護盾解除！','#ffd23f',2); FX.screenFlash('#ffffff',0.4); burst(L.boss.z,0,'#9fe8ff',60,2.5,1.5); shake(16); SFX.win&&SFX.win(); G.units.forEach(u=>{ if(u.lockAdd) u.lockAdd=0; }); }
      if(e.type==='tele'){ SFX.warn(); }
      if(e.type==='ultTele'){ SFX.warn(); banner('⚠ BOSS 大招蓄力！','#ff4040',2); FX.screenFlash('#ff4040',0.25); shake(10);
        if(!G.qte&&window.QTE){ B.ultIdx=(B.ultIdx||0)+1; const kind=QTE.pick(G.seed||1,G.level,B.ultIdx); B.qteTime=e.dur;
          B.qtePending=1; tip('q_'+kind,()=>{ G.qte=QTE.make(kind,G.level,ok=>{}); }); } }
      if(e.type==='ultBreak'){ float('BREAK！','#ffd23f',L.boss.z,0,true); B.vuln=3; }
      if(e.type==='immune'){ immuneFx(L.boss.z,G.bdX||0,'IMMUNE'); }
      if(e.type==='ultHit'){ synFx('frostfire'); SFX.slam(); shake(32); float('大招 -'+Combat.fmt(e.v),'#ff2040',G.z+2,0,true); burst(G.z+3,0,'#ff4040',50,2.5); FX.screenFlash('#ff2040',0.4); }
      if(e.type==='slam'){ synFx('frostfire'); SFX.slam(); shake(28); G.stop=0.08; float('重擊 -'+Combat.fmt(e.v),'#ff4040'); burst(G.z+3,e.side*0.5,'#ffb347',40,2.2); }
      if(e.type==='dodge'){ float('閃避!','#7dffb0'); SFX.slam(); shake(10); burst(G.z+3,e.side*0.5,'#ffb347',30,2); }
      if(e.type==='summon'){ const n=clamp(Math.round(e.v),1,40); for(let i=0;i<n;i++){ const u=spawnZ(L.boss.z-2-rnd()*3,(i/(n-1||1)-0.5)*1.8,e.v/n,2.4,'zombie'); if(u){ u.cos=1; if(e.hp){ u.hp=u.maxHp=e.hp; } if(e.lock) u.lockAdd=1; } } float('召喚小兵 x'+n,'#ff9a3c',L.boss.z,0,true); }
    }
    if(B.lock&&B.lock.qteDone&&!G.units.some(u=>u.lockAdd&&!u.dead)) B.lock.addsDead=1;
    if(B.vuln>0){ B.vuln-=dt; } // 易傷期間下一次 physDmg 在 hitBoss 已含 bossDmg
    zombieTick(dt,0); G.army=Math.min(G.army,B.army); B.army=G.army; G.units=G.units.filter(u=>!u.dead); /* v0.6：召喚小兵也會真的碰撞扣兵 */
    if(B.phase!==before){ banner(B.phase===2?'BOSS 第二階段：重擊！看紅區閃避':'BOSS 狂暴！召喚小兵','#ff4040'); shake(16); SFX.slam(); }
    if(res==='lose'&&G.revive>0){ G.revive--; B.army=G.army=s.reviveN; banner('不死鳥復活！'); }
    else if(res==='lose'){ G.army=0; lose(); return; }
    if(res==='win'){ bossDeathStart(); return; } /* v0.7：擊敗演出結束後才 afterBossWin() */
  }
  hud();
}
function hud(){ if(!G) return; $('hStage').textContent=G.endless?`♾️ 第 ${Math.max(1,G.E.wave+(G.state==='horde'?1:0))} 波 · 分數 ${Combat.fmt(endlessScore())}`:`第 ${G.level||1}/${Level.MAX} 關${G.lv?' · 段 '+(G.seg+1)+'/'+G.lv.segs+' · '+THEME[G.lv.theme].name:''}`; $('hArmy').textContent='兵力 '+Combat.fmt(Math.max(0,G.army||0)); $('hCoin').textContent='🪙'+(meta.coins+G.coins);
  const need=G.lv?CONFIG.xpPerLevel*Combat.tierM(G.lv.tier):1; $('xpBar').style.width=(100*(G.xp||0)/need)+'%'; $('xpLv').textContent='Lv'+((G.lvl||0)+1); }


// ---- v0.5.1 新手教學 + 首次遭遇提示 ----
const TIPQ=[]; let tipCur=null; const tipsOn=()=>!(new URLSearchParams(location.search).get('notips'));
function tipActive(){ return !!tipCur||(G&&G.tut&&G.tut.hold); }
function tip(id,cb){ if(!tipsOn()||!Tips.shouldShow(localStorage,id)||TIPQ.some(q=>q.id===id)||(tipCur&&tipCur.id===id)){ if(cb) cb(); return false; } TIPQ.push({id,cb}); if(!tipCur) nextTip(); return true; }
function tutTip(id,cb){ const T=G&&G.tut; if(!T||T.done[id]){ if(cb) cb(); return false; } T.done[id]=1; T.n++; TIPQ.unshift({id,cb,tut:1}); if(!tipCur) nextTip(); return true; }
function nextTip(){ const q=TIPQ.shift(); if(!q){ tipCur=null; $('tip').className=''; last=performance.now(); return; } tipCur=q; const d=Tips.get(q.id);
  $('tipIcon').textContent=d.icon; $('tipName').textContent=d.name; $('tipLine').textContent=d.line;
  $('tipStep').textContent=q.tut?`新手教學 ${G.tut.n}/${Tips.TUT.length}`:(d.cat?'新發現・'+d.cat:''); $('tipSkip').style.display=q.tut?'inline-block':'none';
  $('tip').className='on'+(q.tut?' tut':''); SFX.good&&SFX.good(1); }
function closeTip(){ const q=tipCur; if(!q) return; if(!q.tut) Tips.mark(localStorage,q.id); tipCur=null; $('tip').className=''; const cb=q.cb; if(cb) cb(); nextTip(); if(G&&G.tut&&G.tut.n>=Tips.TUT.length) endTut(); }
function endTut(){ if(G&&G.tut){ G.tut=null; } Tips.setTutDone(localStorage,true); $('coach').className=''; for(let i=TIPQ.length-1;i>=0;i--) if(TIPQ[i].tut){ const c=TIPQ[i].cb; TIPQ.splice(i,1); if(c) c(); } }
$('tipOk').onclick=e=>{ e.stopPropagation(); closeTip(); }; $('tipSkip').onclick=e=>{ e.stopPropagation(); endTut(); closeTip(); };
$('coachSkip').onclick=e=>{ e.stopPropagation(); endTut(); };
function tutStart(){ if(!tipsOn()||Tips.tutDone(localStorage)) return; G.tut={n:0,done:{},drag:0,hold:false,stage:'drag',t:0}; }
function tutTick(dt){ const T=G.tut; if(!T) return; T.t+=dt; const L=G.lv;
  if(T.stage==='drag'&&G.state==='run'&&G.z>3){ T.hold=true; $('coach').className='on'; if(!T.done.t_drag){ T.done.t_drag=1; T.n++; } if(T.drag>0.6){ T.hold=false; $('coach').className=''; T.stage='gates'; last=performance.now(); } return; }
  if(T.stage==='gates'){ const r=L.rows.find(r=>!r.done&&r.z-G.z<16&&r.z>G.z); if(r){ T.stage='fire'; tutTip('t_gates'); } return; }
  if(T.stage==='fire'){ if(L.rows.some(r=>r.done)){ T.stage='mobs'; T.t=0; tutTip('t_fire'); } return; }
  if(T.stage==='mobs'){ const e=L.enemies.find(e=>e.count>0&&e.z-G.z<22&&e.z>G.z)||L.obstacles.find(o=>!o.done&&o.z-G.z<22); if(e||G.units.length||T.t>4){ T.stage='rest'; tutTip('t_mobs'); } } }
function tutCheck(){ /* 每幀：遭遇型提示 */ const L=G.lv; if(!L||tipCur) return;
  if(G.state==='run'){ for(const o of L.obstacles) if(!o.done&&o.z>G.z&&o.z-G.z<18){ tip('o_'+o.type); break; }
    for(const r of L.rows) if(!r.done&&r.z>G.z&&r.z-G.z<20){ if(r.moving) tip('g_moving'); if(r.timed) tip('g_timed'); if(rowGates(r).some(g=>g.shoot!==undefined)) tip('g_shoot'); break; } }
  G.tipCd=(G.tipCd||0)-1; if(G.tipCd<=0&&G.units.length&&((G.tipScan=(G.tipScan||0)+1)%10===0)){ for(const u of G.units){ if(u.type==='zombie'||u.type==='basic'||u.z-G.z>30) continue; if(tip('m_'+u.type)){ G.tipCd=240; break; } } } } /* 怪物提示一次一張，間隔約 4 秒 */
window.__tip=()=>tipCur&&tipCur.id; window.__showTip=id=>tip(id); window.__tipClose=closeTip; window.__tut=()=>G&&G.tut&&{n:G.tut.n,stage:G.tut.stage,hold:G.tut.hold};
function renderGuide(){ const box=$('guideList'); const S=localStorage; let h='<h3>🎓 新手教學</h3>'+Tips.TUT.map(t=>`<div class=gi><span>${t.icon}</span><div><b>${t.name}</b><br>${t.line}</div></div>`).join('');
  let cat=''; for(const t of Tips.list(S)){ if(t.cat!==cat){ cat=t.cat; h+=`<h3>${cat}</h3>`; } h+=`<div class="gi${t.seen?'':' un'}"><span>${t.seen?t.icon:'❔'}</span><div><b>${t.seen?t.name:'？？？'}</b><br>${t.seen?t.line:'尚未遇到'}</div></div>`; }
  const n=Tips.list(S).filter(t=>t.seen).length; box.innerHTML=`<div style="opacity:.8">已發現 ${n}/${Object.keys(Tips.CAT).length}</div>`+h; $('bTipsToggle').textContent='遊戲中提示：'+(Tips.enabled(S)?'開':'關'); }
$('bGuide').onclick=()=>{ renderGuide(); show('guide'); }; $('bGuideBack').onclick=menu;
$('bTipsToggle').onclick=()=>{ Tips.setEnabled(localStorage,!Tips.enabled(localStorage)); renderGuide(); };
$('bTipsReset').onclick=()=>{ Tips.reset(localStorage); renderGuide(); };
$('bTutReplay').onclick=()=>{ Tips.setTutDone(localStorage,false); SFX.init(); startLevel(1); };
// ---- Boss 勝利：輪盤（中 Boss＝本關能力卡；關底最終 Boss＝金幣／永久貨幣）----
/* v0.7：Boss 擊敗演出（js/bossdeath.js，規格 game-assets/BOSS-DEATH-zh-TW.md：中 Boss 1600ms、關底 2800ms；點一下跳過）。期間玩家無敵、不能操作；timeScale 只套在遊戲世界 */
function bossDeathStart(){ const L=G.lv, fin=!!L.boss.boss; G.state='bossdeath'; G.banner=null; if(G.qte&&G.qte.el){ G.qte.done=true; G.qte.el.remove(); } G.qte=null; document.querySelectorAll('#qte').forEach(e=>e.remove());
  G.units.forEach(u=>{ if(!u.dead){ u.dead=1; FX.pop(u.x,u.z,'#ffd23f',false); } }); G.units=[]; /* Boss 召喚物一起消滅 */
  const lite=(window.__fps&&window.__fps.q&&window.__fps.q<1.5)||false; G.bd={fx:BossDeath.create(fin?'final':'mid',(L.boss.vi||0)*131+G.level,{sfx:SFX,lite}),fin,name:L.boss.name||''}; }
function bossDeathEnd(){ const b=G.bd; if(!b) return; G.bd=null; G.slow=0; G.stop=0; G.state='boss'; afterBossWin(); }
function bossDeathTick(realDt){ const b=G.bd; if(!b) return; if(b.skipReq){ b.fx.skip(); } else b.fx.update(realDt*1000); if(b.fx.done) bossDeathEnd(); }
function bossDeathWorld(){ const b=G.bd; if(!b) return; const L=G.lv, bp=proj(L.boss.z,0,1.1), pl=proj(G.z,G.x,0.3), U=W/960, gr=proj(L.boss.z,0,0).y+20*D;
  b.fx.drawWorld(ctx,W,H,{x:bp.x,y:bp.y,r:(L.boss.boss?150:115)*bp.s*D,ground:gr},{x:pl.x,y:pl.y},U); }
function bossDeathScreen(){ const b=G.bd; if(!b) return; ctx.save(); ctx.setTransform(1,0,0,1,0,0); b.fx.drawScreen(ctx,W,H,W/960,(b.fin?'BOSS ':'中BOSS ')+b.name); if(b.fx.t>300){ ctx.globalAlpha=0.6; ctx.font=`${12*D}px sans-serif`; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText('點一下跳過',W/2,H*0.95); } ctx.restore(); }
function afterBossWin(){ if(G.endless){ const fin=G.lv.boss.kind==='boss'; G.E[fin?'final':'mini']++; G.E.wave=Math.max(G.E.wave,G.lv.waveFrom+4); G.B=null; if(fin){ G.state='roulette'; G.frozen=true; G.roAfter='endlessFinal'; startRoulette('card'); } else { if(!G.endless){ G.coins+=Math.round(Upgrades.coins('seg',G.level)*G.st.coinMul); } /* v0.7 §2：中 Boss segCoins */ G.seg++; G.state='choice'; G.resume=null; G.picks=G.endless?CONFIG.v7.endless.miniPicks:3; /* v0.7 §6.3：無盡中 Boss 1 張 */ setTimeout(()=>showChoice('😈 中 Boss 擊敗！'),500); } return; }
  const final=G.seg>=G.lv.segs-1; G.state='roulette'; G.frozen=true;
  if(final) startRoulette('coin'); else startRoulette('card'); }
function startRoulette(mode){ G.roMode=mode; G.state='roulette'; if(!G._roTip){ const go=()=>startRoulette(mode); const tid=mode==='coin'?'roulette_coin':'roulette'; const tu=G.tut&&!G.tut.done.t_roulette, tp=tipsOn()&&Tips.shouldShow(localStorage,tid); if(tu||tp){ G._roTip=1; if(tu){ tutTip('t_roulette',go); Tips.mark(localStorage,tid); } else tip(tid,go); return; } } G._roTip=0; const el=$('roulette'); if(!el){ applyRoulette(mode==='coin'?null:pickRouletteCard()); return; }
  el.className='ov on'; $('roTitle').textContent=mode==='coin'?'🎰 通關輪盤：金幣獎勵！':'🎰 Boss 輪盤：隨機能力！';
  const slots=buildRouletteSlots(mode); G.roSlots=slots; const track=$('roTrack'); track.innerHTML='';
  slots.concat(slots).forEach(s=>{ const d=document.createElement('div'); d.className='ro-slot '+(s.rar||''); d.innerHTML=s.html; track.appendChild(d); });
  const winner=slots[slots.win]; G.roPrize=winner; let ang=0, raf=0; const spins=12+((Math.random()*6)|0); const target=spins*slots.length+slots.win;
  $('roCard').style.display='none'; $('roSkip').style.display=''; $('roOk').textContent='領取';
  const start=performance.now(); const dur=2400;
  function snapWin(){ track.style.transform=`translateX(${(-slots.win*76)}px)`; $('roHint').textContent=winner.label; track.querySelectorAll('.ro-slot').forEach((d,i)=>d.classList.toggle('win',i%slots.length===slots.win)); }
  function frame(t){ if(ang) return; const k=Math.max(0,Math.min(1,(t-start)/dur)); const ease=1-Math.pow(1-k,3); const idx=Math.floor(ease*target)%slots.length;
    track.style.transform=`translateX(${(-idx*76)}px)`; $('roHint').textContent=slots[idx].label; if(k<1) raf=requestAnimationFrame(frame); else finish(); }
  function finish(){ if(ang===2||ang===3) return; ang=3; if(raf) cancelAnimationFrame(raf); snapWin(); // v0.6 QA(c)：跳過動畫也停在預定獎品格
    const rc=$('roCard'); rc.className='card ro-res '+(winner.rar||'C')+(winner.a&&winner.a.ult?' ult':''); rc.innerHTML=winner.a?cardInner(winner.a):`<span class=pv style="--c:#ffd23f">${winner.icon||'🪙'}</span><b>${winner.coins!=null?'🪙 +'+winner.coins:winner.label}</b><span class=tag>${winner.perm?'永久升級':'金幣'}</span><small>${winner.desc||''}</small>`; rc.style.display='block';
    let n=Math.ceil(CONFIG.rouletteAutoClaim); const go=()=>{ if(ang===2) return; ang=2; clearInterval(cd); rc.style.display='none'; el.className='ov'; applyRoulette(G.roPrize||winner); };
    $('roOk').textContent=`領取（${n}）`; const cd=setInterval(()=>{ n--; if(n<=0) go(); else $('roOk').textContent=`領取（${n}）`; },1000);
    $('roOk').onclick=go; $('roSkip').style.display='none'; }
  $('roOk').onclick=()=>finish(); $('roSkip').onclick=()=>finish();
  raf=requestAnimationFrame(frame); }
function buildRouletteSlots(mode){ const r=RNG.mulberry32(RNG.hash(G.seed||1,G.level*0xB055+((G.roN=(G.roN||0)+1))));
  if(mode==='coin'){ const base=Math.round(Upgrades.coins('rou',G.level)*G.st.coinMul); /* v0.7 §1.3：10 金幣格＋2 永久格，期望 ×1.47 */ const PK=[['atk','火力','⚔️','E','火力'],['coin','金幣加成','🪙','R','金幣'],['start','起始兵力','👥','R','兵力'],['armor','護甲','🛡️','E','護甲'],['crit','爆擊','💥','R','爆擊']]; for(let i=PK.length-1;i>0;i--){ const j=(r()*(i+1))|0; [PK[i],PK[j]]=[PK[j],PK[i]]; } const opts=[
    ...[[1,'C'],[1.5,'R'],[2,'E'],[0.6,'C'],[3,'L'],[1,'C'],[1.2,'C'],[1.2,'C'],[1.5,'R'],[1.7,'R']].map(([m,rar])=>{ const c=Math.round(base*m); return {label:'🪙 +'+c, coins:c, rar, icon:m>=3?'💎':m>=2?'💰':'🪙', desc:`獲得 ${c} 金幣（通關後帶回，可買永久升級）`}; }),
    ...PK.slice(0,CONFIG.v7.coin.permSlots||2).map(([k,n,i,rar,sh])=>({label:'永久：'+n+' +1', short:sh+'+1', perm:k, rar, icon:i, desc:`永久升級「${n}」+1 級（之後每一關都有效）`}))];
    opts.forEach(o=>o.html=o.perm?`<span class=ri>${o.icon}</span><b>${o.short}</b><i class=rt>永久</i>`:`<span class=ri>${o.icon}</span><b>+${o.coins}</b><i class=rt>金幣</i>`); /* v0.6 QA(d)：每格都有短標籤與金額，不換行 */ for(let i=opts.length-1;i>0;i--){ const j=(r()*(i+1))|0; [opts[i],opts[j]]=[opts[j],opts[i]]; }
    opts.win=(r()*opts.length)|0; return opts; }
  const pool=Abil.candidatePool(G.build).filter(c=>!c.a.ult); // 終極不進輪盤
  const slots=[]; for(let i=0;i<CONFIG.rouletteSlots;i++){ let t=pool.reduce((x,y)=>x+y.w,0), p=r()*t, k=0; for(;k<pool.length;k++){p-=pool[k].w; if(p<=0)break;} const a=(pool[Math.min(k,pool.length-1)]||pool[0]).a;
    slots.push({a,label:a.name,rar:a.rar,html:`<span class=ri>${abIcon(a.id)}</span><b>${a.name}</b><i class=rt>${{C:'普通',R:'稀有',E:'史詩',L:'傳說'}[a.rar]||''}</i>`}); }
  // 保底：連續 3 次沒新種類 → 強制未持有
  G.roNewMiss=G.roNewMiss||0; if(G.roNewMiss>=CONFIG.rouletteNewPity){ const fresh=pool.filter(c=>!(G.build[c.a.id]>0)); if(fresh.length){ const a=fresh[(r()*fresh.length)|0].a; slots[0]={a,label:a.name,rar:a.rar,html:`<span class=ri>${abIcon(a.id)}</span><b>${a.name}</b>`}; } }
  slots.win=(r()*slots.length)|0; return slots; }
function pickRouletteCard(){ const slots=buildRouletteSlots('card'); return slots[slots.win]; }
function applyRoulette(prize){ G.frozen=false; if(!prize){ win(); return; }
  if(prize.coins){ G.coins+=prize.coins; float('🪙+'+prize.coins,'#ffd23f',G.z+2,0,true); banner('輪盤：'+prize.label,'#ffd23f'); }
  if(prize.perm){ meta[prize.perm]=(meta[prize.perm]||0)+1; saveMeta(); banner('永久升級：'+prize.label,'#7dffb0'); }
  G.B=null; if(prize.a){ const a=prize.a; const before=Abil.activeSynergies(G.build); G.build[a.id]=(G.build[a.id]||0)+1; G.st=Abil.computeStats(G.build,meta);
    if(!(G.build[a.id]>1)) G.roNewMiss=0; else G.roNewMiss=(G.roNewMiss||0)+1;
    const synNew=Abil.activeSynergies(G.build).filter(s=>!before.includes(s)); showcase(a,synNew); banner('獲得：'+a.name,'#ffd23f'); abBar(); }
  // 中 Boss → 原本的選卡流程；最終 → 關卡結算
  if(G.roMode==='coin') win(); else if(G.roAfter==='endlessFinal'){ G.roAfter=null; G.seg++; G.state='choice'; G.resume=null; G.picks=2; setTimeout(()=>showChoice('👹 魔王擊敗！'),500); } else if(G.roAfter==='horde'){ G.roAfter=null; G.state='choice'; G.resume='run'; G.picks=2; setTimeout(()=>showChoice('🧟 殭屍潮清除！'),400); } else { G.seg++; G.state='choice'; G.resume=null; G.picks=3; setTimeout(()=>showChoice('😈 中 Boss 擊敗！'),500); } }
function win(){ if(G.tut&&!G.tut.done.t_revive){ tutTip('t_revive',()=>win()); return; } const i=Stage.info(G.level); /* v0.7 §2：過關結算 clearCoins（pos10 ×2、pos5 補給 ×1.2） */ G.coins+=Math.round(Upgrades.coins('clear',G.level)*G.st.coinMul);
  // 關卡完成（中 Boss 已由 afterBossWin → 輪盤 → 選卡處理）
  const sg=Level.stars(G.revUsed);
  Level.recordClear(meta,G.level,sg,G.army); meta.best=Math.max(meta.best,G.level); meta.coins+=G.coins; const got=G.coins; G.coins=0; saveMeta(); G.state='clear';
  setTimeout(()=>{ $('oTitle').textContent=G.level===Level.MAX?'🏆 全 1000 關通關！':`第 ${G.level} 關完成！`; $('oInfo').innerHTML=`${'⭐'.repeat(sg)}${'☆'.repeat(3-sg)}<br>剩餘兵力 ${Combat.fmt(G.army)}　🪙+${got}<br><small>能力會在下一關重置；永久升級保留</small>`;
    $('bRev').style.display='none'; $('bRevAd').style.display='none'; const nx=Math.min(Level.MAX,G.level+1); $('bCont').style.display=G.level<Level.MAX?'block':'none'; $('bCont').textContent=`下一關（第 ${nx} 關）`; $('bCont').onclick=()=>{ SFX.init(); startLevel(nx); }; show('over'); },700); }
function reviveUi(){ const st=Revive.status(localStorage); const ok=st.total>0;
  $('bRev').style.display=ok?'block':'none'; $('bRev').textContent=`❤ 復活並繼續本關（今日免費 ${st.freeLeft}/${Revive.FREE}${st.bonus?'，額外 '+st.bonus:''}）`;
  const adFree=Monetization.isAdFree(); $('bRevAd').style.display=ok?'none':'block';
  $('bRevAd').textContent=adFree?`🎁 領取 ${Revive.AD_BONUS} 次復活（已購買免廣告）`:`▶ 觀看一支廣告換 ${Revive.AD_BONUS} 次復活（自願）`; }
function doRevive(){ if(!G||G.state!=='over'||!Revive.use(localStorage)) return reviveUi(); const a=Revive.restoreCount(G.lastGateArmy,G.army0); G.cDebt=0; G.revUsed++;
  G.army=a; if(G.B) G.B.army=a; G.state=G.B?'boss':G.prevState==='horde'?'horde':'run'; if(G.state==='horde') G.units=G.units.filter(u=>u.z>G.z+12); FX.clear();
  G.lv.enemies.forEach(e=>{ if(e.z<=G.z+3) e.count=0; }); G.lv.obstacles.forEach(o=>{ if(Math.abs(o.z-G.z)<3) o.done=1; });
  float('復活！兵力 '+Combat.fmt(a),'#ffd23f'); banner('❤ 復活！','#ff7ab0'); SFX.level(); show(null); }
function lose(){ G.prevState=G.state; G.state='over'; setTimeout(()=>{ if(!tutTip('t_revive')) tip('revive'); },800); SFX.lose(); if(!G.endless&&!G.failPaid){ G.failPaid=1; const segs=(G.segs&&G.segs.length)||1; G.coins+=Math.round(0.3*Upgrades.coins('clear',G.level)*(G.seg||0)/segs*G.st.coinMul); } /* v0.7 §2：失敗補 0.3×結算×已完成段數比例（只算一次） */ meta.coins+=G.coins; const got=G.coins; G.coins=0; saveMeta(); reviveUi();
  if(G.endless){ const canRev=G.revUsed<CONFIG.v6.endless.maxRevive; const sc=endlessScore(); $('oTitle').textContent='♾️ 無盡挑戰結束'; const d=Endless.load(localStorage);
    $('oInfo').innerHTML=`第 ${G.E.wave} 波　分數 <b>${Combat.fmt(sc)}</b>${sc>d.best?' 🏆 新紀錄！':''}<br>擊殺 ${Combat.fmt(G.E.kills)}　中 Boss ${G.E.mini}　魔王 ${G.E.final}　QTE ${G.E.qte}<br><small>${canRev?`可再復活 ${CONFIG.v6.endless.maxRevive-G.revUsed} 次（每次分數 -10%）`:'本局復活次數已用完'}</small>`;
    if(!canRev){ $('bRev').style.display='none'; $('bRevAd').style.display='none'; }
    $('bCont').style.display='block'; $('bCont').textContent='結算並再玩一次'; $('bCont').onclick=()=>{ SFX.init(); const r=endlessOver(); startEndless(); }; show('over'); G.onLeave=()=>{ if(!G.E.done) endlessOver(); }; return; }
  $('oTitle').textContent='戰敗'; $('oInfo').innerHTML=`第 ${G.level} 關 · 段 ${G.seg+1}/${G.lv.segs}<br>獲得金幣 ${got}<br>復活會回到最後通過的數字閘門後的兵力，從這裡繼續`;
  const lvN=G.level; $('bCont').style.display='block'; $('bCont').textContent=`重新挑戰第 ${lvN} 關`; $('bCont').onclick=()=>{ SFX.init(); startLevel(lvN); }; show('over'); }
// 關卡選擇：1000 關，通關解鎖下一關，顯示星等與最佳兵力
function renderLevels(){ const g=$('lvGrid'); const u=meta.unlocked||1; $('lvInfo').textContent=`已解鎖 ${u}/${Level.MAX}　⭐ ${Object.values(meta.stars||{}).reduce((a,b)=>a+b,0)}`;
  if(!g.childElementCount){ const f=document.createDocumentFragment(); for(let l=1;l<=Level.MAX;l++){ const d=document.createElement('button'); d.className='lv'; d.dataset.l=l; d.onclick=()=>{ if(Level.isUnlocked(meta,l)){ SFX.init(); startLevel(l); } }; f.appendChild(d); } g.appendChild(f); }
  for(const d of g.children){ const l=+d.dataset.l, st=(meta.stars||{})[l]||0, ok=Level.isUnlocked(meta,l), hard=((l-1)%10)+1>=6; d.disabled=!ok; d.classList.toggle('hard',hard);
    d.innerHTML=ok?`<b>${l}${((l-1)%10)+1===5?'🧃':''}</b><i>${st?'⭐'.repeat(st):(l===u?'NEW':(((l-1)%10)+1===5?'補給':''))}</i>${meta.bestArmy&&meta.bestArmy[l]?`<small>${Combat.fmt(meta.bestArmy[l])}</small>`:''}`:`<b>🔒</b><small>${l}</small>`; }
  show('levels'); const cur=g.children[Math.max(0,u-1)]; if(cur&&cur.scrollIntoView) cur.scrollIntoView({block:'center',inline:'nearest'}); }
const RN={C:'普通',R:'稀有',E:'史詩',L:'傳說',EVO:'進化',SP:'特殊'};
function elemTags(id){ const e=Abil.ELEM_TAG[id]; return e?`<span class=tag>${Abil.ELEM_NAME[e]}</span>`:''; }
function buildHtml(){ const lst=Abil.ABILITIES.filter(a=>G.build[a.id]).map(a=>{ const mx=G.build[a.id]>=a.max; return `${a.name}${G.build[a.id]>1?'×'+G.build[a.id]:''}${mx?'<sup>MAX</sup>':''}`; }).join('、')||'（無）';
  const evo=Abil.EVOLUTIONS.filter(e=>G.build[e.id]).map(e=>`<span class=evo>✦${e.name}</span>`).join(' ');
  const syn=Abil.activeSynergies(G.build).map(s=>`<span class=syn>★${s.name} Lv${G.build[s.key]}</span>`).join(' ')||'（無）';
  const unl=Abil.unlockedSynergies(G.build).filter(s=>!G.build[s.key]).map(s=>`🔓${s.name}`).join(' ');
  const hint=Abil.SYNERGIES.filter(s=>!Abil.synUnlocked(s,G.build)&&s.req.some(r=>G.build[r])).slice(0,4).map(s=>`🔒${s.name}：${Abil.unlockHint(s,G.build)}`).join('<br>');
  const st=Abil.computeStats(G.build,meta); const el=Object.keys(Abil.ELEM_NAME).map(k=>`${Abil.ELEM_NAME[k]}${st.elem[k]}${st.resonance.includes(k)?'✓':''}`).join(' ');
  const disc=Abil.SYNERGIES.filter(s=>meta.seen.includes(s.id)).length;
  return `<b>目前組合：</b>${lst}${evo?'<br><b>進化：</b>'+evo:''}<br><b>特殊能力：</b>${syn}${unl?'<br><b>已解鎖（會出現在選項）：</b>'+unl:''}${hint?'<br><small style="opacity:.8">'+hint+'</small>':''}<br><b>元素</b>（3 級共鳴）：${el}<br><span style="opacity:.7">已發現組合技 ${disc}/${Abil.SYNERGIES.length}</span>`; }
// v0.6：卡片內容共用（三選一、輪盤結果）
function cardInner(a){ const RN={C:'普通',R:'稀有',E:'史詩',L:'傳說',SP:'特殊',EVO:'進化'};
  if(a.rar==='EVO'){ const b=Abil.ABILITIES.find(x=>x.id===a.base), p=Abil.ABILITIES.find(x=>x.id===a.partner);
      return `<b>✦ 進化：${a.name}</b><span class=tag>${RN.EVO}</span><small>${b.name}(MAX) + ${p.name} → ${a.desc}</small>`; }
    else { const nb=Object.assign({},G.build,{[a.id]:(G.build[a.id]||0)+1}); const newSyn=Abil.activeSynergies(nb).filter(s=>!Abil.activeSynergies(G.build).includes(s)); const newUnl=a.special?[]:Abil.unlockedSynergies(nb).filter(s=>!Abil.unlockedSynergies(G.build).includes(s));
      const lv=(G.build[a.id]||0)+1, ev=Abil.EVOLUTIONS.find(e=>e.base===a.id);
      return `${abPreview(a)}<b>${a.name}</b><span class=tag>${RN[a.rar]}</span>${elemTags(a.id)}${G.build[a.id]?`<span class=tag>Lv${lv}${lv>=a.max?' MAX':''}</span>`:''}<small>${a.desc}</small>${abNumbers(a,lv)}${newUnl.map(s=>`<small class=syn>🔓 解鎖特殊能力「${s.name}」（之後會出現在選項中）</small>`).join('')}${newSyn.map(s=>`<small class=syn>★ 觸發組合技「${s.name}」：${s.desc}</small>`).join('')}${ev?`<small class=evo>✦ 滿級 + ${Abil.ABILITIES.find(x=>x.id===ev.partner).name} 可進化為「${ev.name}」</small>`:''}`; }
}
function showChoice(title){ /* v0.4：選卡亂數不再每關固定（關卡內容仍固定） */ const r=RNG.mulberry32(RNG.hash((G.runSeed=G.runSeed||((Date.now()^Math.floor(Math.random()*1e9))>>>0)),G.level*131+(G.pickN++)*7)); G.pity=G.pity||{}; const ch=Abil.rollChoices(G.build,r,G.pity);
  $('cTitle').textContent=(title||'')+' 選擇一項能力';
  $('cards').innerHTML=''; ch.forEach(a=>{ const d=document.createElement('div'); d.className='card '+a.rar+(a.ult?' ult':''); d.innerHTML=cardInner(a);
    d.onclick=()=>{ SFX.init(); const synBefore=Abil.activeSynergies(G.build); G.build[a.id]=(G.build[a.id]||0)+1; const synNew=Abil.activeSynergies(G.build).filter(s=>!synBefore.includes(s)); G.pendingShow=[a,synNew]; if(a.rar==='EVO') SFX.evo(); else SFX.good(3); Abil.activeSynergies(G.build).forEach(s=>{if(!meta.seen.includes(s.id))meta.seen.push(s.id)}); saveMeta();
      if(--G.picks>0) showChoice(''); else if(G.resume){ G.state=G.resume; G.resume=null; G.st=Abil.computeStats(G.build,meta); show(null); } else startSegment(false); if(G.pendingShow){ showcase(...G.pendingShow); G.pendingShow=null; } };
    $('cards').appendChild(d); });
  $('build').innerHTML=buildHtml(); show('choice'); if(G.tut&&G.tut.stage!=='drag') tutTip('t_cards'); }
function show(id){ ['menu','shop','choice','over','pause','levels','credits','roulette','guide','endless'].forEach(k=>$(k).classList.toggle('on',k===id)); }
function renderShop(){ /* v0.7 §1：8 項永久升級、新價格曲線、「建議」標籤（價格／權重最低）；開放表：第 2/3/5/8/10/15 關逐項開放 */ const lvNow=meta.unlocked||1, UL=CONFIG.v7.unlocks.upgrades, okK=k=>lvNow>=(UL[k]||1); let rec=null,rv=1e99; for(const k of Upgrades.KEYS){ const it=Upgrades.item(k), lv=meta[k]||0; if(!okK(k)||lv>=it.max) continue; const v=Upgrades.price(k,lv)/(it.w*(k==='coin'&&lvNow>60?0.3:1)); if(v<rv){ rv=v; rec=k; } } const T=Upgrades.total(meta), TR=Upgrades.total(Upgrades.recommended(lvNow));
  $('shopList').innerHTML=`<div>🪙 ${meta.coins}　<small>總等級 ${T}／第 ${lvNow} 關建議 ${TR}</small></div>`;
  Upgrades.KEYS.forEach(k=>{ const it=Upgrades.item(k), nm=Upgrades.NAMES[k], lv=meta[k]||0, mx=lv>=it.max, pr=mx?0:Upgrades.price(k,lv); const d=document.createElement('div'); d.className='row'; if(!okK(k)){ d.innerHTML=`<span>🔒 ${nm[0]}<br><small>第 ${UL[k]} 關開放</small></span>`; d.style.opacity=0.55; $('shopList').appendChild(d); return; }
    d.innerHTML=`<span>${nm[1]} ${nm[0]}（Lv${lv}/${it.max}）${k===rec?' <b class=rec>建議</b>':''}<br><small>${nm[2]}</small></span>`; const b=document.createElement('button'); b.textContent=mx?'已滿':'🪙'+Combat.fmt(pr); b.disabled=mx||meta.coins<pr;
    b.onclick=()=>{ if(!mx&&meta.coins>=pr){ meta.coins-=pr; meta[k]=lv+1; saveMeta(); SFX.coin(); renderShop(); } }; d.appendChild(b); $('shopList').appendChild(d); }); }
function menu(){ if(G&&G.onLeave){ try{ G.onLeave(); }catch(e){} } newRun(); show('menu'); const u=meta.unlocked||1; $('bMenuCont').style.display='block'; $('bMenuCont').textContent=`繼續（第 ${u} 關）`; $('mInfo').textContent=`已解鎖 ${u}/${Level.MAX} 關　🪙${meta.coins}`; hud(); }
$('bStart').onclick=()=>{ SFX.init(); renderLevels(); }; $('bLvBack').onclick=menu;
$('bEndless').onclick=()=>{ SFX.init(); renderEndlessMenu(); }; $('bEnBack').onclick=menu; $('bEnGo').onclick=()=>{ SFX.init(); startEndless(); };
const contClick=()=>{ SFX.init(); startLevel(meta.unlocked||1); };
$('bMenuCont').onclick=contClick;
$('bRev').onclick=()=>{ SFX.init(); doRevive(); };
// 獎勵廣告：只在玩家按下按鈕時播放；買了免廣告者直接給
$('bRevAd').onclick=async()=>{ $('bRevAd').disabled=true; try{ const ok=Monetization.isAdFree()?true:await Monetization.showRewarded(); if(ok){ Revive.grantBonus(localStorage); } } finally { $('bRevAd').disabled=false; reviveUi(); } };
$('bShop').onclick=()=>{ renderShop(); show('shop'); }; $('bCredits').onclick=()=>show('credits'); $('bCredBack').onclick=menu; $('bShopBack').onclick=menu; $('bRetry').onclick=menu;
const adUi=()=>{ $('bAds').style.display=Monetization.isAdFree()?'none':'block'; };
$('bAds').onclick=async()=>{ await Monetization.purchaseRemoveAds(); adUi(); };
$('bRestore').onclick=async()=>{ const ok=await Monetization.restorePurchases(); adUi(); $('mInfo').textContent=ok?'已還原：移除廣告 ✓':'沒有可還原的購買'; };
$('bPrivacy').onclick=()=>Monetization.privacyOptions();
Monetization.onChange(adUi);
// 暫停 / Android 返回鍵：遊戲中→暫停；暫停或子畫面→上一層；主選單→離開 App
function pause(){ if(G&&['run','horde','boss'].includes(G.state)&&!G.frozen){ G.frozen=true; show('pause'); return true; } return false; }
function resume(){ if(G){ G.frozen=false; last=performance.now(); } show(null); }
$('bResume').onclick=resume; $('bQuit').onclick=()=>{ if(G&&G.coins){ meta.coins+=G.coins; G.coins=0; saveMeta(); } menu(); };
function onBack(){ const on=k=>$(k).classList.contains('on'); if(tipCur) return closeTip(); if(on('guide')||on('endless')) return menu();
  if(on('pause')) return resume(); if(pause()) return; if(on('roulette')){ const b=$('roOk'); if(b) b.click(); return; } if(on('shop')||on('over')||on('credits')) return menu(); if(on('choice')) return; // 選卡中不允許返回（避免跳過）
  const A=window.NativeBridge&&window.NativeBridge.App; if(A) A.exitApp(); }
document.addEventListener('visibilitychange',()=>{ if(document.hidden) pause(); });
if(window.NativeBridge&&window.NativeBridge.App&&Monetization.isNative()) window.NativeBridge.App.addListener('backButton',onBack);
window.__grBack=onBack;
// 唯讀除錯快照（QA 自動化用）
window.__grState=()=>G&&({state:G.state,stage:G.stage,level:G.level,seg:G.seg,segs:G.lv&&G.lv.segs,army:G.army,x:G.x,z:G.z,frozen:!!G.frozen,picks:G.picks,units:G.units?G.units.length:0,build:Object.assign({},G.build)});
$('bMute').onclick=e=>{ e.stopPropagation(); SFX.init(); $('bMute').textContent=SFX.toggle()?'🔇':'🔊'; }; $('bMute').textContent=SFX.muted?'🔇':'🔊';
Monetization.init($('banner')).then(adUi); adUi(); if(Monetization.isNative()) $('bPrivacy').style.display='block';
const px=e=>(e.touches?e.touches[0].clientX:e.clientX);
/* v0.7 特殊門企劃 §1.2：以 pointerId 區分拖曳指與點擊指；落在石頭門判定區先成為點擊候選（>14px 轉拖曳、≤280ms 放開算點擊），第二指直接算點 */
let dragId=null, tapCand=null;
cv.addEventListener('pointerdown',e=>{ SFX.init(); if(G&&G.bd&&G.bd.fx.t>=150) G.bd.skipReq=true; const t=G?hitStone(e.clientX,e.clientY):null;
  if(dragId===null){ dragId=e.pointerId; if(t){ tapCand={t,x0:e.clientX,t0:performance.now(),acc:0}; dragX=null; } else { tapCand=null; dragX=px(e); } }
  else if(t&&e.pointerId!==dragId) tapStone(t); });
const ptrUp=e=>{ if(e&&e.pointerId!==undefined&&dragId!==null&&e.pointerId!==dragId) return; const S=CONFIG.v7.stoneGate; if(tapCand&&performance.now()-tapCand.t0<=S.tapMaxMs&&Math.abs(e.clientX-tapCand.x0)<=S.tapSlopPx) tapStone(tapCand.t); tapCand=null; dragId=null; dragX=null; };
addEventListener('pointerup',ptrUp); addEventListener('pointercancel',ptrUp);
addEventListener('pointermove',e=>{ if(!G) return; if(dragId!==null&&e.pointerId!==dragId) return; if(tapCand){ if(Math.abs(e.clientX-tapCand.x0)>CONFIG.v7.stoneGate.tapSlopPx){ dragX=tapCand.x0; tapCand=null; } else return; } if(dragX===null)return; const x=px(e); const dx=(x-dragX)/(innerWidth*0.4)*(sgOn('reverse')?-1:1); if(!(G.sgStun>0)) G.x=clamp(G.x+dx,-0.95,0.95); if(G.tut) G.tut.drag+=Math.abs(dx); dragX=x; });
addEventListener('keydown',e=>{ if(!G)return; if(G.tut&&/Arrow/.test(e.key)) G.tut.drag+=0.2; if(G.sgStun>0) return; if(e.key==='ArrowLeft')G.x=Math.max(-.95,G.x-.2); if(e.key==='ArrowRight')G.x=Math.min(.95,G.x+.2); });
// =================== 繪製 ===================
let HZ=0, PY=0;
function proj(z,x,h){ const d=z-G.z, sc=1/(1+Math.max(-0.9,d)/14); return {y:HZ+(PY-HZ)*sc-(h||0)*H*0.1*sc, x:W/2+x*W*0.42*sc, s:sc, d}; }
function shade(hex,k){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=n>>8&255,b=n&255; const f=v=>clamp(Math.round(k<0?v*(1+k):v+(255-v)*k),0,255); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function drawBg(th){
  const g=ctx.createLinearGradient(0,0,0,HZ); g.addColorStop(0,th.sky[0]); g.addColorStop(1,th.sky[1]); ctx.fillStyle=g; ctx.fillRect(0,0,W,HZ+2);
  ctx.fillStyle=th.sun; ctx.globalAlpha=0.9; ctx.beginPath(); ctx.arc(W*0.78,HZ*0.35,W*0.07,0,7); ctx.fill(); ctx.globalAlpha=0.25; ctx.beginPath(); ctx.arc(W*0.78,HZ*0.35,W*0.11,0,7); ctx.fill(); ctx.globalAlpha=1;
  if(th.deco==='post'){ ctx.strokeStyle='#ff2bd655'; ctx.lineWidth=1*D; for(let i=0;i<12;i++){ const y=HZ*0.5+i*i*HZ*0.004; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); } }
  // 低多邊形山丘
  ctx.fillStyle=th.hill; ctx.beginPath(); ctx.moveTo(0,HZ); const off=(G?G.z*0.3:0)%60; for(let i=-1;i<=8;i++){ const x=i*W/6-off*D*0.5; ctx.lineTo(x,HZ-(i%2?H*0.06:H*0.11)); } ctx.lineTo(W,HZ); ctx.fill();
  ctx.fillStyle=shade(th.hill,-0.15); ctx.beginPath(); ctx.moveTo(0,HZ); for(let i=-1;i<=10;i++){ const x=i*W/8+W/16-off*D; ctx.lineTo(x,HZ-(i%2?H*0.03:H*0.055)); } ctx.lineTo(W,HZ); ctx.fill();
  const gg=ctx.createLinearGradient(0,HZ,0,H); gg.addColorStop(0,th.ground[1]); gg.addColorStop(1,th.ground[0]); ctx.fillStyle=gg; ctx.fillRect(0,HZ,W,H-HZ);
}
function drawTrack(th){
  const far=proj(G.z+140,0), L0=proj(G.z+140,-1.15), R0=proj(G.z+140,1.15), L1=proj(G.z-0.8,-1.15), R1=proj(G.z-0.8,1.15);
  const tg=ctx.createLinearGradient(0,far.y,0,H); tg.addColorStop(0,th.track[1]); tg.addColorStop(1,th.track[0]); ctx.fillStyle=tg;
  const ex=(a,b)=>a.x+(b.x-a.x)*(H-a.y)/(b.y-a.y); ctx.beginPath(); ctx.moveTo(L0.x,L0.y); ctx.lineTo(R0.x,R0.y); ctx.lineTo(ex(R0,R1),H); ctx.lineTo(ex(L0,L1),H); ctx.fill();
  for(let z=Math.floor(G.z/4)*4;z<G.z+140;z+=4){ if(z<G.z-0.8) continue; const k=Math.floor(z/4)%2; [-1,1].forEach(sd=>{ const a=proj(z,sd*1.15),b=proj(z+4,sd*1.15),c=proj(z+4,sd*1.07),d=proj(z,sd*1.07); ctx.fillStyle=th.curb[k]; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.fill(); }); }
  ctx.strokeStyle='#ffffff40'; for(let z=Math.floor(G.z/8)*8;z<G.z+120;z+=8){ const p=proj(z,0),q=proj(z+4,0); if(p.d<-0.8)continue; ctx.lineWidth=5*p.s*D; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke(); }
}
function deco(th,z,x){ const p=proj(z,x); if(p.d<-0.5) return; const s=p.s*D*1.2;
  if(th.deco==='tree'){ ctx.fillStyle='#7a4a24'; ctx.fillRect(p.x-3*s,p.y-18*s,6*s,18*s); ctx.fillStyle='#2e9e4a'; tri(p.x,p.y-60*s,26*s,44*s); ctx.fillStyle='#45c463'; tri(p.x-4*s,p.y-62*s,16*s,30*s); }
  else if(th.deco==='cactus'){ ctx.fillStyle='#3d9a4f'; rr(p.x-5*s,p.y-44*s,10*s,44*s,5*s); rr(p.x-16*s,p.y-30*s,7*s,16*s,3*s); rr(p.x+9*s,p.y-36*s,7*s,18*s,3*s); }
  else if(th.deco==='pine'){ ctx.fillStyle='#2b5f4a'; tri(p.x,p.y-64*s,24*s,56*s); ctx.fillStyle='#fff'; tri(p.x,p.y-64*s,10*s,18*s); }
  else if(th.deco==='rock'){ ctx.fillStyle='#4a2c2c'; ctx.beginPath(); ctx.moveTo(p.x-20*s,p.y); ctx.lineTo(p.x-12*s,p.y-30*s); ctx.lineTo(p.x+6*s,p.y-38*s); ctx.lineTo(p.x+20*s,p.y); ctx.fill(); ctx.fillStyle='#ff6a1f'; ctx.fillRect(p.x-2*s,p.y-30*s,3*s,24*s); }
  else { ctx.strokeStyle='#00f0ff'; ctx.lineWidth=3*s; ctx.shadowColor='#00f0ff'; ctx.shadowBlur=10*s; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x,p.y-60*s); ctx.stroke(); ctx.shadowBlur=0; ctx.fillStyle='#ff2bd6'; ctx.fillRect(p.x-8*s,p.y-64*s,16*s,6*s); } }
function tri(cx,top,hw,h){ ctx.beginPath(); ctx.moveTo(cx,top); ctx.lineTo(cx+hw,top+h); ctx.lineTo(cx-hw,top+h); ctx.fill(); }
function rr(x,y,w,h,r){ ctx.beginPath(); ctx.roundRect?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h); ctx.fill(); }
// 火柴人
function stick(x,y,s,col,ph,big){ const u=s*(big?1.8:1); ctx.strokeStyle=shade(col,-0.25); ctx.lineWidth=Math.max(1,2.6*u); ctx.lineCap='round';
  const sw=Math.sin(ph)*4*u; ctx.beginPath(); ctx.moveTo(x,y-9*u); ctx.lineTo(x-sw,y); ctx.moveTo(x,y-9*u); ctx.lineTo(x+sw,y); ctx.moveTo(x-5*u,y-13*u+sw*0.3); ctx.lineTo(x+5*u,y-13*u-sw*0.3); ctx.stroke();
  ctx.fillStyle=col; rr(x-3.2*u,y-17*u,6.4*u,9*u,3*u); ctx.beginPath(); ctx.arc(x,y-20.5*u,3.6*u,0,7); ctx.fill(); ctx.fillStyle='#ffffff70'; ctx.beginPath(); ctx.arc(x-1.2*u,y-21.5*u,1.2*u,0,7); ctx.fill();
  if(big){ ctx.fillStyle='#ffd23f'; ctx.beginPath(); ctx.moveTo(x-3*u,y-24*u); ctx.lineTo(x-1.5*u,y-27*u); ctx.lineTo(x,y-24.5*u); ctx.lineTo(x+1.5*u,y-27*u); ctx.lineTo(x+3*u,y-24*u); ctx.fill(); } }
function crowd(p,n,col,label,elites,popK){ n=Math.max(0,Math.round(n)); const k=Math.min(n,70), sc=p.s*D*(1+(popK||0)*0.25), u=sc*0.9;
  ctx.fillStyle='#0003'; ctx.beginPath(); ctx.ellipse(p.x,p.y,(Math.sqrt(k)*7+10)*sc,(Math.sqrt(k)*2.5+4)*sc,0,0,7); ctx.fill();
  const pos=[]; for(let i=0;i<k;i++){ const a=i*2.4, r=Math.sqrt(i)*6.5*sc; pos.push([p.x+Math.cos(a)*r, p.y-Math.abs(Math.sin(a))*r*0.35+r*0.1, i]); }
  pos.sort((a,b)=>a[1]-b[1]).forEach(([x,y,i])=>stick(x,y,u,col,(G?G.t:0)*14+i,(elites&&i<Math.min(elites,4)&&i%3===0)));
  if(label!==false){ const fs=Math.max(13*D,24*p.s*D)*(1+(popK||0)*0.5), ty=p.y-Math.sqrt(k)*2.5*sc-34*sc; ctx.font=`900 ${fs}px system-ui,sans-serif`; ctx.textAlign='center'; ctx.lineWidth=5*D*Math.min(1,p.s+0.3); ctx.strokeStyle='#0008'; ctx.fillStyle='#fff';
    const ns=Combat.fmt(n); const bw=ctx.measureText(ns).width+16*D; ctx.fillStyle=shade(col,-0.35); rr(p.x-bw/2,ty-fs*0.95,bw,fs*1.25,8*D); ctx.fillStyle='#fff'; ctx.fillText(ns,p.x,ty); } }
function gateDraw(r){ const gates=rowGates(r), n=gates.length, off=rowOffset(r);
  gates.forEach((g,i)=>{ const x0=-1+2*i/n+off, x1=-1+2*(i+1)/n+off, p0=proj(r.z,x0+.04), p1=proj(r.z,x1-.04); const h=H*0.1*p0.s, w=p1.x-p0.x; if(g.op==='stone'){ sgDraw(r,g,p0,p1,h,w); return; }
    const ok=good(g), c1=ok?'#2fa8ff':'#ff3b4f', c2=ok?'#7fe1ff':'#ff9aa5';
    ctx.save(); ctx.shadowColor=c1; ctx.shadowBlur=(18+(g.flash>0?20:0))*p0.s*D; const gr=ctx.createLinearGradient(0,p0.y-h,0,p0.y); gr.addColorStop(0,c2+'d0'); gr.addColorStop(1,c1+'90'); ctx.fillStyle=gr; ctx.fillRect(p0.x,p0.y-h,w,h); ctx.restore();
    ctx.fillStyle=shade(c1,-0.3); const pw=Math.max(2,6*p0.s*D); ctx.fillRect(p0.x-pw/2,p0.y-h*1.08,pw,h*1.08); ctx.fillRect(p1.x-pw/2,p0.y-h*1.08,pw,h*1.08); ctx.fillRect(p0.x,p0.y-h*1.08,w,pw);
    const fs=Math.max(10*D,34*p0.s*D); ctx.font=`900 ${fs}px system-ui,sans-serif`; ctx.textAlign='center'; ctx.lineWidth=4*D*p0.s; ctx.strokeStyle='#0007';
    const txt=g.op+Combat.fmt(Combat.gateValue(g)); ctx.strokeText(txt,(p0.x+p1.x)/2,p0.y-h*0.38); ctx.fillStyle='#fff'; ctx.fillText(txt,(p0.x+p1.x)/2,p0.y-h*0.38);
    if(g.shoot!==undefined){ ctx.font=`${Math.max(9*D,15*p0.s*D)}px sans-serif`; ctx.fillText('🎯射我 '+g.shoot+'/'+CONFIG.shootGateMax,(p0.x+p1.x)/2,p0.y-h*0.82); }
    if(g.flash>0) g.flash-=0.016; });
  if(r.timed){ const p=proj(r.z,off), f=((G.t+r.timed.phase)%r.timed.period)/r.timed.period; ctx.strokeStyle='#fff'; ctx.lineWidth=3*D*p.s; ctx.beginPath(); ctx.arc(p.x,p.y-H*0.125*p.s,9*D*p.s,-1.57,-1.57+6.28*f); ctx.stroke(); ctx.font=`${Math.max(9*D,13*p.s*D)}px sans-serif`; ctx.fillStyle='#fff'; ctx.fillText('⏱翻轉',p.x,p.y-H*0.15*p.s); }
  if(r.moving){ const p=proj(r.z,off); ctx.font=`${Math.max(9*D,14*p.s*D)}px sans-serif`; ctx.fillStyle='#fff'; ctx.fillText('⇄',p.x,p.y-H*0.125*p.s); } }
// 怪物＝紅色 💀 標籤 + 數字 + 血條（可以射擊）；障礙＝黃黑警示、沒有數字（只能閃）
function mobBadge(p,e){ const fs=Math.max(13*D,24*p.s*D), ty=p.y-Math.sqrt(Math.min(e.count,70))*2.5*p.s*D-40*p.s*D; const txt='💀 '+(sgOn('fog')?'?':Combat.fmt(Math.ceil(e.count))); ctx.font=`900 ${fs}px system-ui,sans-serif`; ctx.textAlign='center';
  const bw=ctx.measureText(txt).width+16*D; ctx.fillStyle='#8a0f1a'; rr(p.x-bw/2,ty-fs*0.95,bw,fs*1.25,8*D); ctx.fillStyle='#fff'; ctx.fillText(txt,p.x,ty);
  const m=e.max||e.count; ctx.fillStyle='#000a'; ctx.fillRect(p.x-bw/2,ty+fs*0.4,bw,4*D); ctx.fillStyle='#ff4040'; ctx.fillRect(p.x-bw/2,ty+fs*0.4,bw*Math.max(0,e.count/m),4*D); }
function hazard(p,s,w){ ctx.save(); ctx.fillStyle='#ffd400'; rr(p.x-w/2,p.y-6*s,w,8*s,3*s); ctx.beginPath(); ctx.rect(p.x-w/2,p.y-6*s,w,8*s); ctx.clip(); ctx.fillStyle='#111'; for(let i=-w;i<w;i+=14*s){ ctx.beginPath(); ctx.moveTo(p.x+i,p.y+2*s); ctx.lineTo(p.x+i+7*s,p.y-6*s); ctx.lineTo(p.x+i+12*s,p.y-6*s); ctx.lineTo(p.x+i+5*s,p.y+2*s); ctx.fill(); } ctx.restore();
  ctx.font=`900 ${Math.max(12*D,22*s)}px sans-serif`; ctx.textAlign='center'; ctx.fillText('⚠️',p.x,p.y-56*s); }
function obsDraw(o){ { const x0=obsX(o), p0=proj(o.z,x0), a=proj(o.z,x0-o.w/2), b=proj(o.z,x0+o.w/2); if(o.type!=='push') hazard(p0,p0.s*D,Math.max(20*D,b.x-a.x)); } const x=obsX(o), p=proj(o.z,x), s=p.s*D;
  if(o.type==='saw'){ const r=26*s; ctx.save(); ctx.translate(p.x,p.y-r); ctx.rotate(G.t*12); ctx.fillStyle='#cfd8e3'; ctx.beginPath(); for(let i=0;i<16;i++){ const a=i/16*6.28, rr_=i%2?r:r*0.78; ctx.lineTo(Math.cos(a)*rr_,Math.sin(a)*rr_);} ctx.fill(); ctx.fillStyle='#7a8796'; ctx.beginPath(); ctx.arc(0,0,r*0.3,0,7); ctx.fill(); ctx.restore(); }
  else if(o.type==='pit'){ const a=proj(o.z,x-o.w/2), b=proj(o.z,x+o.w/2); ctx.fillStyle='#1a0f0a'; ctx.beginPath(); ctx.ellipse(p.x,p.y,(b.x-a.x)/2,10*s,0,0,7); ctx.fill(); ctx.strokeStyle='#ff5b5b'; ctx.lineWidth=2*s; ctx.stroke(); }
  else if(o.type==='hammer'){ const down=obsActive(o), a=proj(o.z,x-o.w/2), b=proj(o.z,x+o.w/2); const top=p.y-H*0.16*p.s; ctx.fillStyle='#6b4a2b'; ctx.fillRect(p.x-3*s,top,6*s,H*0.16*p.s*(down?0.85:0.4));
    ctx.fillStyle=down?'#ff5050':'#8892a0'; ctx.fillRect(a.x,down?p.y-16*s:top+H*0.06*p.s,b.x-a.x,16*s); if(!down){ ctx.fillStyle='#ff505040'; ctx.fillRect(a.x,p.y-4*s,b.x-a.x,8*s); } }
  else { const a=proj(o.z-2,o.x-o.w/2), b=proj(o.z+2,o.x+o.w/2); ctx.fillStyle='#ffb02055'; ctx.fillRect(Math.min(a.x,b.x),b.y,Math.abs(b.x-a.x),a.y-b.y); ctx.fillStyle='#fff'; ctx.font=`900 ${Math.max(12*D,26*s)}px sans-serif`; ctx.textAlign='center'; ctx.fillText(o.x>0?'≫ ≫':'≪ ≪',p.x,p.y); } }
function ultTelegraph(L){ const B=G.B; if(!B||!(B.ultTele>0)) return; const p=proj(L.boss.z,0), s=p.s*D, k=1-B.ultTele/(B.qteTime||3.5), pulse=0.5+0.5*Math.sin(G.t*18);
  ctx.save(); ctx.globalCompositeOperation='lighter'; for(let i=0;i<3;i++){ ctx.strokeStyle=`rgba(255,${60+i*60},40,${0.5+0.4*pulse})`; ctx.lineWidth=(6+i*3)*s; ctx.beginPath(); ctx.arc(p.x,p.y-110*s,(150-k*90+i*18)*s,0,7); ctx.stroke(); }
  FX.spr('light_02','#ff3020',p.x,p.y-110*s,(260+120*k)*s,0.5+0.4*pulse); ctx.restore();
  ctx.fillStyle='#000b'; ctx.fillRect(p.x-80*D,p.y-250*s-18*D,160*D,12*D); ctx.fillStyle='#ff3030'; ctx.fillRect(p.x-80*D,p.y-250*s-18*D,160*D*k,12*D);
  ctx.font=`900 ${16*D}px sans-serif`; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText('⚠ 大招蓄力中',p.x,p.y-250*s-24*D); }
function shieldDraw(p,s,lock){ const k=G.shieldHit>0?1:0, pulse=0.5+0.5*Math.sin(G.t*6); ctx.save(); ctx.globalCompositeOperation='lighter';
  const r=105*s, cx=p.x, cy=p.y-95*s; ctx.strokeStyle=`rgba(140,220,255,${0.55+0.3*pulse+0.3*k})`; ctx.lineWidth=(4+3*k)*s; ctx.fillStyle=`rgba(80,180,255,${0.12+0.08*pulse+0.15*k})`;
  ctx.beginPath(); for(let i=0;i<6;i++){ const a=i/6*Math.PI*2+G.t*0.4; ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r*1.1); } ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth=1.5*s; for(let i=0;i<6;i++){ const a=i/6*Math.PI*2+G.t*0.4; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r*1.1); ctx.stroke(); } ctx.restore();
  if(lock){ ctx.font=`900 ${Math.max(14*D,22*s)}px sans-serif`; ctx.textAlign='center'; ctx.fillStyle='#bff0ff'; ctx.strokeStyle='#003a5a'; ctx.lineWidth=4*D; const left=G.units.filter(u=>u.lockAdd&&!u.dead).length; const tx=!lock.qteDone?`🛡 鎖血　完成 QTE！`:`🛡 鎖血　小兵 ${left}　${Math.max(0,CONFIG.v6.boss.lockTimeout-(lock.failT||0)).toFixed(0)}s`; ctx.strokeText(tx,cx,cy-r*1.25); ctx.fillText(tx,cx,cy-r*1.25); } }
function bossDraw(L){ ultTelegraph(L); const b=L.boss, p=proj(b.z,0), s=p.s*D*(b.boss?1.9:b.mini?1.5:1.2), B=G.B, ph=B?B.phase:1;
  const VC=['#4a7a2a','#5a2a7a','#7a2aa0','#e0e0d0','#6a7a8a','#5a8a2a','#2a6ab0','#7ad0ff','#2a1a4a','#a0a0b0','#3a4a8a','#8a2a5a']; const col=ph===3?'#ff2b2b':b.vi!==undefined?VC[b.vi%VC.length]:b.boss?'#7a1fa2':b.mini?'#c0392b':'#a33';
  if(ph===3){ ctx.save(); ctx.shadowColor='#ff3b1f'; ctx.shadowBlur=40*s; } const bob=Math.sin(G.t*3)*3*s;
  ctx.fillStyle='#0004'; ctx.beginPath(); ctx.ellipse(p.x,p.y,50*s,12*s,0,0,7); ctx.fill();
  ctx.fillStyle=shade(col,-0.3); rr(p.x-28*s,p.y-40*s,18*s,40*s,6*s); rr(p.x+10*s,p.y-40*s,18*s,40*s,6*s);
  ctx.fillStyle=col; rr(p.x-40*s,p.y-105*s+bob,80*s,70*s,18*s);
  const arm=B&&B.tele>0?-30:Math.sin(G.t*4)*10; ctx.fillStyle=shade(col,-0.15); ctx.save(); ctx.translate(p.x-40*s,p.y-95*s+bob); ctx.rotate((arm-20)*0.02); rr(-14*s,0,14*s,52*s,7*s); ctx.restore(); ctx.save(); ctx.translate(p.x+40*s,p.y-95*s+bob); ctx.rotate(-(arm-20)*0.02); rr(0,0,14*s,52*s,7*s); ctx.restore();
  ctx.fillStyle=col; ctx.beginPath(); ctx.arc(p.x,p.y-122*s+bob,26*s,0,7); ctx.fill();
  ctx.fillStyle='#fff3c4'; tri(p.x-20*s,p.y-160*s+bob,6*s,20*s); tri(p.x+20*s,p.y-160*s+bob,6*s,20*s);
  ctx.fillStyle=ph===3?'#ff0':'#fff'; ctx.beginPath(); ctx.arc(p.x-10*s,p.y-126*s+bob,6*s,0,7); ctx.arc(p.x+10*s,p.y-126*s+bob,6*s,0,7); ctx.fill(); ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(p.x-9*s,p.y-125*s+bob,2.5*s,0,7); ctx.arc(p.x+11*s,p.y-125*s+bob,2.5*s,0,7); ctx.fill();
  ctx.fillStyle='#3a0010'; rr(p.x-12*s,p.y-112*s+bob,24*s,6*s,3*s);
  if(ph===3) ctx.restore();
  if((B&&B.lock)||(!B&&b.preDmg>=b.hp*(b.preCap||CONFIG.bossPreFightCap))) shieldDraw(p,s,B&&B.lock);
  if(!G.B){ ctx.font=`900 ${Math.max(12*D,20*p.s*D)}px sans-serif`; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.strokeStyle='#000a'; ctx.lineWidth=3*D; const t=(b.boss?'BOSS ':b.mini?'中BOSS ':'守衛 ')+(b.name?b.name+' ':'')+Combat.fmt(b.hp); ctx.strokeText(t,p.x,p.y-175*s); ctx.fillText(t,p.x,p.y-175*s); } }
function draw(){
  ctx.setTransform(1,0,0,1,0,0); HZ=H*0.3; PY=H*0.84;
  const th=G&&G.th?G.th:THEME.grass;
  if(G&&G.shake>0.5) ctx.translate((rnd()-0.5)*G.shake*D,(rnd()-0.5)*G.shake*D); if(G&&G.bd){ const sh=G.bd.fx.shake(W/960); ctx.translate(sh.x,sh.y); }
  drawBg(th); if(!G||!G.lv) return; const L=G.lv;
  drawTrack(th);
  const items=[];
  for(let z=Math.floor(G.z/12)*12;z<G.z+130;z+=12){ [-1.6,1.6,-2.3,2.4].forEach((x,i)=>{ if((z/12+i)%3!==0) items.push({z:z+i*3,f:()=>deco(th,z+i*3,x)}); }); }
  const vis=z=>z-G.z<130&&z>G.z-1;
  L.rows.forEach(r=>{ if(!r.done&&vis(r.z)) items.push({z:r.z,f:()=>gateDraw(r)}); });
  L.obstacles.forEach(o=>{ if(vis(o.z)) items.push({z:o.z,f:()=>obsDraw(o)}); });
  L.enemies.forEach(e=>{ if(e.count>0&&!e.passed&&vis(e.z)) items.push({z:e.z,f:()=>{ const p=proj(e.z,e.x); crowd(p,e.count,e.hitT>0?'#ffffff':({fire:'#ff7a1f',ice:'#3fd0ff',thunder:'#e6c700'}[e.elem]||'#e23b3b'),false); mobBadge(p,e); if(e.elem){ ctx.font=`${Math.max(10*D,18*p.s*D)}px sans-serif`; ctx.fillText({fire:'🔥',ice:'❄️',thunder:'⚡'}[e.elem],p.x+30*p.s*D,p.y-10*p.s*D);} }}); });
  L.coins.forEach(c=>{ if(!c.got&&vis(c.z)) items.push({z:c.z,f:()=>{ const p=proj(c.z,c.x,0.15+Math.sin(G.t*4+c.z)*0.05), r=9*p.s*D; ctx.fillStyle='#e0a800'; ctx.beginPath(); ctx.ellipse(p.x,p.y,r*Math.abs(Math.cos(G.t*3+c.z)),r,0,0,7); ctx.fill(); ctx.fillStyle='#ffd23f'; ctx.beginPath(); ctx.ellipse(p.x,p.y,r*0.7*Math.abs(Math.cos(G.t*3+c.z)),r*0.7,0,0,7); ctx.fill(); }}); });
  L.pickups.forEach(pk=>{ if(!pk.got&&vis(pk.z)) items.push({z:pk.z,f:()=>{ const p=proj(pk.z,pk.x,0.2+Math.sin(G.t*3)*0.05); ctx.font=`${Math.max(14*D,34*p.s*D)}px sans-serif`; ctx.textAlign='center'; ctx.save(); ctx.shadowColor='#fff'; ctx.shadowBlur=14*D; ctx.fillText(pk.type==='elite'?'⭐':'🔫',p.x,p.y); ctx.restore(); }}); });
  if(L.chest&&L.chest.hp>0&&vis(L.chest.z)) items.push({z:L.chest.z,f:()=>{ const c=L.chest,p=proj(c.z,c.x),s=p.s*D; ctx.fillStyle='#8a4b1f'; rr(p.x-22*s,p.y-30*s,44*s,30*s,4*s); ctx.fillStyle='#b5652a'; rr(p.x-22*s,p.y-38*s,44*s,12*s,6*s); ctx.fillStyle='#ffd23f'; ctx.fillRect(p.x-3*s,p.y-36*s,6*s,14*s); ctx.fillRect(p.x-22*s,p.y-27*s,44*s,3*s);
     ctx.fillStyle='#000a'; ctx.fillRect(p.x-22*s,p.y-48*s,44*s,5*s); ctx.fillStyle='#ffd23f'; ctx.fillRect(p.x-22*s,p.y-48*s,44*s*c.hp/(c.max||(c.max=c.hp)),5*s); }});
  (L.hordes||[]).forEach(hh=>{ if(!hh.done&&vis(hh.z)) items.push({z:hh.z,f:()=>{ const a=proj(hh.z,-1.07),b=proj(hh.z,1.07); ctx.fillStyle='#ff6a3c99'; ctx.fillRect(a.x,a.y-6*a.s*D,b.x-a.x,6*a.s*D); ctx.font=`900 ${Math.max(10*D,20*a.s*D)}px sans-serif`; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText(hh.big?'🧟🧟 屍海 第'+hh.wave+'波':'🧟 第'+hh.wave+'波',(a.x+b.x)/2,a.y-10*a.s*D); }}); });
  FX.setLod(G.units.length>500?2:G.units.length>150?1:0); G.units.forEach(u=>{ if(vis(u.z)) items.push({z:u.z,f:()=>{ FX.drawZombie(u,G.t); if(u.charger) FX.drawCharger(u,G.t); }}); });
  G.gems.forEach(g=>items.push({z:g.z,f:()=>{ const p=proj(g.z,g.x,0.1), r=5*p.s*D; ctx.fillStyle='#4dff9a'; ctx.beginPath(); ctx.moveTo(p.x,p.y-r*1.4); ctx.lineTo(p.x+r,p.y); ctx.lineTo(p.x,p.y+r*1.4); ctx.lineTo(p.x-r,p.y); ctx.fill(); }}));
  if(!G.B||G.B.hp>0||(G.bd&&G.bd.fx.bossVisible())) items.push({z:L.boss.z,f:()=>bossDraw(L)});
  // Boss 重擊預警區
  if(G.B&&G.B.tele>0&&!G.bd){ const sd=G.B.side, a=proj(G.z-0.5,sd<0?-1.1:0.05), b=proj(G.z+12,sd<0?-0.05:1.1), c=proj(G.z+12,sd<0?-1.1:0.05), d=proj(G.z-0.5,sd<0?-0.05:1.1);
    ctx.fillStyle=`rgba(255,30,30,${0.45+0.2*Math.sin(G.t*20)})`; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(d.x,d.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.fill(); ctx.font=`900 ${26*D}px sans-serif`; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText('⚠ 閃開！',(a.x+d.x)/2,a.y-H*0.12); }
  items.sort((a,b)=>b.z-a.z).forEach(i=>i.f()); if(G.bd) bossDeathWorld();
  G.shots.forEach(o=>{ const p=proj(o.z,o.x,o.th?0:0.2), q=proj(G.z+1,G.x,0.25); ctx.strokeStyle=o.th?'#fffb7a':o.col||'#7df9ff'; ctx.lineWidth=(o.th?5:3)*D; ctx.shadowColor=ctx.strokeStyle; ctx.shadowBlur=8*D; ctx.beginPath(); ctx.moveTo(o.th?p.x:q.x,o.th?0:q.y); ctx.lineTo(p.x,p.y); ctx.stroke(); ctx.shadowBlur=0; });
  { const pc=proj(G.z+1,G.x), els=[...new Set(Object.keys(G.build||{}).map(k=>Abil.ELEM_TAG[k]||(Abil.WEAPONS[k]&&Abil.WEAPONS[k].elem)).filter(Boolean))], nS=G.build?Abil.activeSynergies(G.build).length:0;
    els.forEach((e,i)=>{ const r=(46+i*9)*pc.s*D*(1+(G.aura>0?G.aura*0.6:0)); ctx.strokeStyle=ELEM_COL[e]; ctx.globalAlpha=0.55+(G.aura>0?0.4:0); ctx.lineWidth=(3+(G.build[Object.keys(G.build).find(k=>Abil.ELEM_TAG[k]===e)]||1))*D*pc.s; ctx.beginPath(); ctx.ellipse(pc.x,pc.y,r*1.4,r*0.45,0,G.t*2+i,G.t*2+i+5.2); ctx.stroke(); }); ctx.globalAlpha=1;
    if(nS) FX.spr('light_02',nS>=3?'#ff4fd8':nS>=2?'#ffd23f':'#7dffb0',pc.x,pc.y-20*pc.s*D,(140+(G.comboT>0?G.comboT*120:0))*pc.s*D,0.45); }
  crowd(proj(G.z+1,G.x),G.army,G.build&&Abil.activeSynergies(G.build).length?(Abil.activeSynergies(G.build).length>=3?'#c04fff':'#ffb020'):'#2f7bff',true,G.elites,G.pop);
  if(G.st&&G.st.weapons&&G.st.weapons.orbitSaw) FX.drawSaws(G,G.t,2+G.st.weapons.orbitSaw,!!(G.st.evoW&&G.st.evoW.orbitSaw)); FX.draw(G.t);
  G.parts.forEach(p=>{ const q=proj(p.z,p.x,p.h); ctx.globalAlpha=clamp(p.life*1.5,0,1); ctx.fillStyle=p.col; const r=Math.max(1.5,4*q.s*D); if(p.sol){ const s=Math.max(3*D,9*q.s*D); ctx.beginPath(); ctx.arc(q.x,q.y-s*1.1,s*0.35,0,6.3); ctx.fill(); ctx.fillRect(q.x-s*0.3,q.y-s*0.8,s*0.6,s*0.9); } else ctx.fillRect(q.x-r,q.y-r,r*2,r*2); }); ctx.globalAlpha=1;
  if(G.redT>0){ const a=(G.redA||0.25)*G.redT/0.35; const gr=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.7); gr.addColorStop(0,'rgba(255,0,0,0)'); gr.addColorStop(1,`rgba(255,20,20,${a})`); ctx.fillStyle=gr; ctx.fillRect(0,0,W,H); }
  G.fx.forEach(f=>{ const p=proj(f.z,f.x,0.6+(1-f.life)*0.8); ctx.globalAlpha=clamp(f.life*1.6,0,1); const fs=(f.big?30:20)*D*Math.max(0.6,p.s)*(1+Math.max(0,f.life-0.85)*3); ctx.font=`900 ${fs}px system-ui,sans-serif`; ctx.textAlign='center'; if(f.big||G.units.length<300){ ctx.lineWidth=4*D; ctx.strokeStyle='#000a'; ctx.strokeText(f.t,p.x,p.y); } ctx.fillStyle=f.c; ctx.fillText(f.t,p.x,p.y); }); ctx.globalAlpha=1;
  ctx.setTransform(1,0,0,1,0,0);
  sgHud(); if(G.B&&!G.bd){ const B=G.B, bw=W*0.8, bx=W*0.1, by=H*0.105; ctx.fillStyle='#000a'; rr(bx-4*D,by-4*D,bw+8*D,22*D,8*D); const hg=ctx.createLinearGradient(bx,0,bx+bw,0); hg.addColorStop(0,'#ff2b6a'); hg.addColorStop(1,'#ffb347'); ctx.fillStyle=hg; rr(bx,by,bw*Math.max(0,B.hp/B.max),14*D,6*D);
    ctx.fillStyle='#fff'; { const LK=CONFIG.v6.boss.locks[L.boss.boss?'final':'mini']||[]; ctx.font=`${11*D}px sans-serif`; ctx.textAlign='center'; LK.forEach((at,i)=>{ ctx.fillStyle=(B.lockI||0)>i?'#888':'#9fe8ff'; ctx.fillRect(bx+bw*at-2*D,by-4*D,4*D,22*D); ctx.fillText('🛡',bx+bw*at,by-6*D); }); } ctx.fillStyle='#fff'; if(B.lock){ ctx.fillStyle='#9fe8ff88'; rr(bx,by,bw*Math.max(0,B.hp/B.max),14*D,6*D); ctx.fillStyle='#fff'; } ctx.font=`900 ${13*D}px sans-serif`; ctx.textAlign='center'; ctx.fillText(`${L.boss.boss?'BOSS':L.boss.mini?'中BOSS':'守衛'} 第${B.phase}階段  ${Combat.fmt(Math.max(0,B.hp))}`,W/2,by+30*D); }
  if(G.state==='horde'){ ctx.font=`900 ${16*D}px sans-serif`; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText(G.hordeT>0?`🧟 殭屍潮 ${G.hordeT.toFixed(1)}s　擊殺 ${Combat.fmt(G.killed)}`:`🧟 剩餘 ${G.units.filter(u=>!u.dead).length} 隻　擊殺 ${Combat.fmt(G.killed)}`,W/2,H*0.08); }
  if(G.bd) bossDeathScreen();
  if(G.banner){ const b=G.banner, a=clamp(b.life*2,0,1), k=1+Math.max(0,b.life-1.2)*2; ctx.globalAlpha=a; ctx.textAlign='center';
    let fs=22*D*k; ctx.font=`900 ${fs}px system-ui,sans-serif`; let tw=ctx.measureText(b.t).width; const maxW=W*0.9; if(tw>maxW){ fs*=maxW/tw; ctx.font=`900 ${fs}px system-ui,sans-serif`; tw=ctx.measureText(b.t).width; }
    const w=tw+30*D; ctx.fillStyle='#000b'; rr(W/2-w/2,H*0.2-24*D*k,w,36*D*k,12*D); ctx.fillStyle=b.c; ctx.fillText(b.t,W/2,H*0.2); ctx.globalAlpha=1; }
}
const q0=new URLSearchParams(location.search); const SPD=Math.max(1,+q0.get('speed')||1), NODRAW=!!q0.get('nodraw'); let F_=0; window.__G=()=>G; let last=performance.now(); window.__fps={n:0,t0:performance.now(),fps:0,min:999,samples:[]}; function loop(t){ const dt=Math.min(0.05,(t-last)/1000); last=t; { const F=window.__fps; F.n++; if(t-F.t0>=1000){ F.fps=F.n*1000/(t-F.t0); F.samples.push(Math.round(F.fps)); F.min=Math.min(F.min,F.fps); F.n=0; F.t0=t; F.q=QD;
    /* 自適應：連續 2 秒 <48fps 降解析度；>58 回升 */ if(!q0.get('noadapt')){ F.low=F.fps<48?(F.low||0)+1:0; F.hi=F.fps>58?(F.hi||0)+1:0; if(F.low>=2&&QD>1){ QD=QD>1.5?1.5:1; F.low=0; resize(); } else if(F.hi>=4&&QD<2&&(!G||G.units.length<200)){ QD=QD<1.5?1.5:2; F.hi=0; resize(); } } } } if(G&&!G.frozen){ if(G.tut&&G.tut.hold&&!tipCur) tutTick(dt); if(!tipActive()){ if(SPD>1){ for(let i=0;i<SPD&&G&&!G.frozen&&!tipActive();i++) update(1/60); } else update(dt); } } if(!NODRAW||(F_++%30===0)) draw(); requestAnimationFrame(loop); } requestAnimationFrame(loop);
menu();
// ---- 截圖/除錯參數 ----
const q=new URLSearchParams(location.search), shot=q.get('shot');
if(q.get('endless')==='go'){ setTimeout(()=>{ SFX.init&&SFX.init(); startEndless(true); },50); }
if(q.get('autostart')){ setTimeout(()=>{ SFX.init&&SFX.init(); startLevel(+q.get('autostart')); },50); }
if(shot){ newRun(+q.get('stage')||3); G.build=shot==='combo'?{clone:1,recruit:1,gold:1,gateMul:1,crit:1,scout:1}:{crit:1,ranged:1,shield:1};
  if(q.get('build')){ G.build={}; q.get('build').split(',').forEach(kv=>{ const [k,v]=kv.split(':'); G.build[k]=+v||1; }); }
  const freeze=ms=>setTimeout(()=>{G.frozen=true;},ms);
  if(shot==='levels'){ meta.unlocked=+q.get('unlocked')||14; meta.stars={1:3,2:3,3:2,4:3,5:1,6:2,7:3,8:3,9:2,10:1,11:3,12:2,13:3}; meta.bestArmy={1:120,2:240,3:380,10:12500}; renderLevels(); }
  else if(shot==='lose'){ startLevel(3); G.state='run'; G.lastGateArmy=37; G.z=60; G.army=0; lose(); window.__gr=()=>({state:G.state,army:G.army,z:G.z}); }
  else if(shot==='choice'){ startLevel(5); G.build={ranged:5,fireball:4,crit:2,burn:1,fire:2,mortar:1}; G.state='choice'; G.picks=1; showChoice('😈 中 Boss 擊敗！'); }
  else { const bld=G.build; startLevel(+q.get('stage')||3); G.state='run'; G.resume=null; show(null); if(q.get('build')){ G.build=bld; G.seg=+q.get('seg')||0; startSegment(false); G.army=Math.round(Stage.startArmy(G.level,0)); } else if(q.get('seg')){ G.seg=+q.get('seg'); startSegment(false); } G.z=+q.get('z')||25; G.lv.rows.forEach(r=>{if(r.z<G.z)r.done=1}); G.lv.enemies.forEach(e=>{if(e.z<G.z)e.count=0}); if(G.lv.chest&&G.lv.chest.z<G.z)G.lv.chest.hp=0; if(q.get('army'))G.army=+q.get('army');
    if(shot==='horde'&&G.lv.horde){ if(q.get('types')) G.forceT=q.get('types').split(',').filter(k=>FX.ETYPES[k]); G.state='run'; { const wv=+q.get('wave')||1, hs=G.lv.hordes||[G.lv.horde]; const hh=hs[Math.min(hs.length,wv)-1]; hs.forEach(h=>{ if(h.z<hh.z) h.done=1; }); G.z=hh.z-0.5; } G.lv.rows.forEach(r=>{if(r.z<G.z)r.done=1}); G.lv.enemies.forEach(e=>{if(e.z<G.z)e.count=0}); if(G.lv.chest&&G.lv.chest.z<G.z)G.lv.chest.hp=0; G.army=+q.get('army')||60; freeze(+q.get('freeze')||2600); }
    else if(shot==='boss'){ G.z=G.lv.boss.z-6.5; G.army=+q.get('army')||Math.round(G.lv.boss.calibA||200); G.lv.rows.forEach(r=>r.done=1); G.lv.enemies.forEach(e=>e.count=0); G.lv.obstacles.forEach(o=>o.done=1); G.x=-0.5;
      // 強制進入 Boss 戰（修正 v4 截到屍潮的問題）
      G.state='boss'; G.lv.boss.z=G.z+13; G.B=Combat.bossInit(G.lv.boss,G.army,G.st); G.B.noAbstract=1; G.B.stage=G.level; G.army=G.B.army;
      if(q.get('qte')){ const kind=q.get('qte'); setTimeout(()=>{ G.qte=QTE.make(kind==='auto'?QTE.pick(1,G.level,1):kind,G.level,()=>{}); },200); }
      if(q.get('ult')){ G.B.phase=2; G.B.ultT=0.01; G.B.ultTele=2.8; G.B.qteTime=2.8; setTimeout(()=>{ if(!G.qte&&window.QTE) G.qte=QTE.make(QTE.pick(1,G.level,1),G.level,()=>{}); },80); }
      setTimeout(()=>{ if(G.B){ G.B.hp=G.B.max*0.55; G.B.slamT=0.01; } },200); freeze(+q.get('freeze')||1600); }
    else if(shot==='roulette'){ G.z=G.lv.boss.z-2; G.army=200; G.seg=q.get('final')?G.lv.segs-1:0; afterBossWin(); }
    else if(shot==='qte'){ G.z=G.lv.boss.z-6.5; G.army=200; G.lv.rows.forEach(r=>r.done=1); G.state='boss'; G.lv.boss.z=G.z+13; G.B=Combat.bossInit(G.lv.boss,G.army,G.st); G.B.noAbstract=1; G.B.phase=2;
      setTimeout(()=>{ G.qte=QTE.make(q.get('kind')||'grid_1to9',G.level,()=>{}); },100); freeze(+q.get('freeze')||2800); }
    else freeze(+q.get('freeze')||900); } }
})();
