// 共用戰鬥公式：遊戲與無頭模擬器使用同一套規則（確保測試反映真實遊戲）
(function(root){
const CONFIG = root.CONFIG || require('./config.js');
const tierM = t => Math.pow(CONFIG.tierPlayerScale,t);
const critExp = s => 1 + Math.min(1,s.crit)*(s.critMul-1);
function gateValue(g){ return g.v + (g.shoot||0)*(g.step||0); }
function applyGate(a, g, s, rnd){ if(g.op==='stone') return a; /* v0.7 石頭門：效果在 game.js 處理 */ rnd=rnd||Math.random; const reps=rnd()<s.doubleGate?2:1; const v=gateValue(g);
  for(let i=0;i<reps;i++){
    if(g.op==='+') a+=Math.round(v*s.addMul)+s.flatGate+s.cloneAdd;
    else if(g.op==='x'){ a=Math.round(a*(v+s.mulAdd))+s.flatGate+(s.cloneAdd>0?Math.round(5*s.cloneAdd/2):0); }
    else { if(rnd()<s.luck) continue; if(s.goldGate&&rnd()<0.3) continue;
      if(g.op==='-') a-=Math.round(v*s.badMul);
      else if(!s.noDiv) a=Math.round(a/(1+(v-1)*s.badMul)); } }
  return Math.max(0,a); }
function gateScore(a,g,s){ return applyGate(a,g,Object.assign({},s,{doubleGate:0,luck:0}),()=>0.5); }
// v0.5：兵力只加射速（遞減＋上限）；彈道數 = 基礎 + 卡片；傷害靠真實碰撞
function gunStreams(s){ const base=(s.twinGun?CONFIG.gunTwinStreams:CONFIG.gunBaseStreams); return Math.min(CONFIG.gunMaxStreams, base+(s.gunStreams||0)); }
function gunRate(army, s, tier, boost){
  const a=Math.max(0,army);
  const raw=CONFIG.baseFireRate + a*CONFIG.fireRatePerArmy;
  const rm=s.rateMul||1; /* v0.7 永久升級「射速」：射速與上限都 ×rateMul */ const rate=Math.min(CONFIG.fireRateCap*rm, raw*rm);
  return Math.min(CONFIG.fireRateCap*1.6*rm, rate*(1+0.15*(s.ranged||0))*(boost||1)*(s.evoFire||1)); } // 兵力只影響射速；卡片小幅加成，總上限 cap×1.6
function gunProfile(army, s, tier, boost){ const streams=gunStreams(s); const rate=gunRate(army,s,tier,boost); return { streams, spread:0.05*(streams-1), rate, bulletsPerSec:rate*streams, size:1+0.1*(streams-1), dmg:CONFIG.gunDmg*s.atk*tierM(tier) }; }
// 單位換算：1 隻基本殭屍（擊殺當量 1）= HP0 點血；子彈 10 點 × 階層倍率
const HP0=()=>CONFIG.gunDmg*CONFIG.horde.hitsPerZombie*CONFIG.horde.hpMul;
const HIT_EFF=0.85; // 模擬：子彈命中率（真實碰撞，會有少數落空）
function gunKillRate(army,s,tier,boost){ const g=gunProfile(army,s,tier,boost); return g.bulletsPerSec*g.dmg*HIT_EFF*(1+0.6*Math.min(CONFIG.maxPierce,s.pierce||0))/HP0(); }
// 元素武器：等級 = 投射物數；每發傷害固定 × 元素倍率（模擬用「投射物數/秒 × 單發傷害」）
function weaponProj(s, id){ return (s.weapons[id]>0?1:0) + (s.wProj[id]||0); } // 第 1 張 = 1 發；每張「+1」卡 +1 發（武器升級只加傷害）
function weaponRate(s, tier, id){ const W=(root.Abil||require('./abilities.js')).WEAPONS; let tot=0;
  for(const k in s.weapons){ if(id&&k!==id) continue; const w=W[k], lvl=s.weapons[k]; if(!w||!lvl) continue;
    const n=weaponProj(s,k); tot+=(n/w.cd)*w.k*(0.6+0.4*lvl)*tierM(tier)*(1+(s.wElem[w.elem]||0))*(s.wMul[k]||1)*s.cdMul*(1+s.area)*0.8; }
  return tot; }
function fireRate(army, s, tier, boost){ return gunKillRate(army,s,tier,boost) + weaponRate(s,tier); } // 每秒擊殺當量
const COUNTER={fire:'ice',ice:'fire',thunder:'thunder'}; // 敵屬性 → 剋制它的玩家屬性
function fightLoss(e, s, army, mult){ if(mult===undefined) mult=critExp(s);
  const n=e.count*(1-Math.min(0.9,s.splash)); let atk=s.atk*(s.rage&&army<20?2:1)*mult;
  if(e.elem && (s.elem[COUNTER[e.elem]]||0)>0) atk*=1.4;
  return Math.round(n/atk*(1-s.armor)); }
function obstacleLoss(o, army, s){ return Math.round(army*CONFIG.obstacleLoss[o.type==='push'?'saw':o.type]*(1-s.armor*0.5))+CONFIG.obstacleFlat; }
// v0.6：漏怪 KE ×（每 KE 士兵數 × 階層倍率）；可射擊時間 = 出怪時間 + 走近時間
function hordeLeakKE(rate, duration, army, s, tier){ const f=fireRate(army,s,tier); const ke=rate*duration*(1-(s.slowZ||0)*0.3); return Math.max(0, ke - f*(duration+CONFIG.horde.approach)); }
function hordeLeak(rate, duration, army, s, tier){ return hordeLeakKE(rate,duration,army,s,tier)*CONFIG.horde.contactSoldiers*tierM(tier)*(1-(s.armor||0)); }
// ---- Boss 戰：狀態機，每 dt 前進。slamHit(side) 回傳玩家是否被重擊命中 ----
function bossInit(boss, army, s){ return {hp:boss.hp, max:boss.hp, army:Math.round(army*(1+s.bossStart)), army0:Math.round(army*(1+s.bossStart)), t:0, phase:1, slamT:CONFIG.bossSlamEvery, tele:0, side:0, summonT:CONFIG.bossSummonEvery, events:[]}; }
// Boss 受到的每秒傷害（與遊戲內「每發子彈打中 Boss」同一公式：子彈數 × 單發 × 命中率 × 爆擊 × 屠龍）
function bossHitMul(s){ return critExp(s)*(1+s.bossDmg)*CONFIG.bossPlayerDps; }
function bossDps(army,s,tier){ const g=gunProfile(army,s,tier); return (g.bulletsPerSec*g.dmg*HIT_EFF + weaponRate(s,tier)*HP0())*bossHitMul(s); }
function bossUltEvery(tier){ return Math.max(CONFIG.bossUltEveryMin, CONFIG.bossUltEvery-Math.min(2.5,tier*CONFIG.bossUltEveryTier)); }
// 模擬用輸出（HP/秒）：基礎槍（命中率、穿透）＋武器（DESIGN-v6 sim 同式）
function simDps(army,s,tier){ const g=gunProfile(army,s,tier); return g.bulletsPerSec*g.dmg*HIT_EFF*(1+0.6*Math.min(CONFIG.maxPierce,s.pierce||0)) + weaponRate(s,tier)*HP0(); }
// v0.6 Boss 狀態機（DESIGN-v6 §3）：持續傷害 atkFrac、重擊、鎖血（無敵＋大招 QTE＋召喚），QTE 成功即解鎖；失敗→大招命中→清光召喚物或 12 秒保底
function bossStep(B, dt, s, tier, slamHit, boss, qteResult){
  const ev=B.events; ev.length=0; B.t+=dt; const V=CONFIG.v6.boss, fk=boss&&boss.boss?'final':'mini';
  let dmg=0; if(!B.noAbstract) dmg+=simDps(B.army,s,tier)*(1+(s.bossDmg||0))*(s.rage&&B.army<20?2:1)*dt; if(B.physDmg){ dmg+=B.physDmg; B.physDmg=0; }
  const slow=1-Math.min(0.8,s.bossSlow||0);
  if(B.lock){ const L=B.lock; if(dmg>0) ev.push({type:'immune',v:dmg}); dmg=0; L.t+=dt;
    if(!L.qteDone){ let ok=null;
      if(B.qteDone){ ok=!!B.qteOk; B.qteDone=false; }
      else if(!B.noAbstract&&L.t>=(B.qteTime||3.5)){ B.qn=(B.qn||0)+1; ok=(B.qok||0)/B.qn<CONFIG.simQteSuccess; if(ok) B.qok=(B.qok||0)+1; }
      else if(B.noAbstract&&!B.qtePending&&L.t>=(B.qteTime||3.5)+1.5) ok=false; // 遊戲端沒有開 QTE（保險）
      if(ok!==null){ L.qteDone=1; B.ultTele=0;
        if(ok){ ev.push({type:'ultBreak'}); B.lock=null; ev.push({type:'unlock',why:'qte'}); }
        else { const l=B.army*V.ultFail*(fk==='mini'?0.7:1)*slow; B.army-=l; ev.push({type:'ultHit',v:l}); L.failT=0; } } }
    else { L.failT+=dt; if(!B.noAbstract){ L.addHp-=simDps(B.army,s,tier)*dt; if(L.addHp<=0) L.addsDead=1; }
      if(L.addsDead||L.failT>=V.lockTimeout){ ev.push({type:'unlock',why:L.addsDead?'adds':'timer'}); B.lock=null; } } }
  else if(B.ultTele>0) B.ultTele=0;
  if(dmg>0){ B.hp-=dmg; ev.push({type:'dmg',v:dmg}); }
  const LK=boss&&(boss.boss||boss.mini)?V.locks[fk]:null;
  if(LK&&!B.lock){ B.lockI=B.lockI||0; const at=LK[B.lockI]; if(at!==undefined&&B.hp<=B.max*at){ /* 一次大傷害也不會跳過鎖血 */ B.hp=B.max*at; B.lockI++;
      const n=(boss.summonN||V.lockSummon[fk]); B.lock={t:0,at,n,addHp:n*(boss.summonHp||B.max/100)}; B.ultTele=B.qteTime||3.5;
      ev.push({type:'lock',at,n}); ev.push({type:'summon',v:n,hp:boss.summonHp,lock:1}); ev.push({type:'ultTele',dur:B.ultTele,lock:1}); } }
  if(B.lock&&B.ultTele>0&&!B.qtePending) B.ultTele=Math.max(0.0001,B.ultTele-dt);
  const prev=B.phase; B.phase=1+(B.lockI||0); if(B.phase>prev) ev.push({type:'phase',v:B.phase});
  const atk=boss&&boss.atkFrac?(B.army0||B.army)*boss.atkFrac:(boss?boss.atk:B.max*0.1); B.army-=atk*slow*(1-(s.armor||0))*dt;
  if(B.tele>0){ B.tele-=dt; if(B.tele<=0){ const hit=slamHit(B.side); if(hit){ const l=B.army*CONFIG.bossSlamFrac*slow; B.army-=l; ev.push({type:'slam',v:l,side:B.side}); } else ev.push({type:'dodge',side:B.side}); B.slamT=B.slamEvery||CONFIG.bossSlamEvery; } }
  else { B.slamT-=dt; if(B.slamT<=0){ B.tele=CONFIG.bossSlamTelegraph; B.side=(Math.floor(B.t*7)%2)?1:-1; ev.push({type:'tele',side:B.side}); } }
  return B.hp<=0?'win':B.army<=0?'lose':null; }
function simulateBoss(boss, army, s, tier, dodge){ dodge=dodge===undefined?CONFIG.simDodge:dodge; const B=bossInit(boss,army,s); let k=0, res=null, rev=s.revive;
  // 決定性閃避：以累積比例逼近 dodge 機率
  let slams=0,dodged=0; const hit=()=>{ slams++; if(dodged/slams<dodge){dodged++;return false;} return true; };
  while(!res && B.t<120){ res=bossStep(B,0.05,s,tier,hit,boss); if(res==='lose'&&rev>0){rev--;B.army=s.reviveN;res=null;} }
  return {win:res==='win', army:Math.max(0,B.army), entered:Math.round(army*(1+s.bossStart)), time:B.t}; }
// ---- 完整關卡模擬（貪婪：每排選最佳閘門；障礙依機率命中；屍潮；Boss） ----
function simulateStage(L, s, army, opts){ opts=opts||{}; const tier=L.tier, oh=opts.obstacleHit===undefined?CONFIG.simObstacleHit:opts.obstacleHit;
  const ev=[...L.rows.map(r=>({z:r.z,r})),...L.enemies.map(e=>({z:e.z,e})),...L.obstacles.map(o=>({z:o.z,o}))]; (L.hordes||(L.horde?[L.horde]:[])).forEach(h=>ev.push({z:h.z,h})); (L.packs||[]).forEach(p=>ev.push({z:p.z,h:{rate:p.n/3,duration:3}})); if(L.chest) ev.push({z:L.chest.z,c:L.chest});
  ev.sort((a,b)=>a.z-b.z); let a=army;
  for(const v of ev){
    if(v.r){ const sh=Math.min(CONFIG.shootGateMax, Math.floor(fireRate(a,s,tier)*1.2));
      a=Math.max(...v.r.gates.map(g=>gateScore(a, g.shoot!==undefined?Object.assign({},g,{shoot:sh}):g, s))); }
    else if(v.e){ a-=fightLoss(v.e,s,a); a+=Math.round(v.e.count*s.vamp); }
    else if(v.o){ a-=obstacleLoss(v.o,a,s)*oh; }
    else if(v.h){ const lk=hordeLeakKE(v.h.rate,v.h.duration,a,s,tier); const leak=lk*CONFIG.horde.contactSoldiers*tierM(tier)*(1-(s.armor||0)); const killed=v.h.rate*v.h.duration-lk; a-=leak;
      const lv=Math.floor(killed*CONFIG.xpPerGem/(CONFIG.xpPerLevel*tierM(tier))); a*=Math.pow(1+CONFIG.levelUpArmy,lv); }
    else if(v.c){ if(fireRate(a,s,tier)*2>=v.c.hp) a+=Math.round(a*CONFIG.chestRecruit); }
    a=Math.round(a); if(a<=0) return {win:false,army:0,stage:true};
  }
  const b=simulateBoss(L.boss,a,s,tier,opts.dodge); return {win:b.win,army:b.army,entered:b.entered,preBoss:a}; }
// 關卡 Boss 校準：以「無能力、貪婪路線」的預期兵力 A 為基準，二分搜尋 HP 使剩餘比例≈目標（險勝）
// v0.6（DESIGN-v6 §3）：Boss HP = 殭屍 HP × 當量 × (1+0.02×tier)；鎖血、接近上限、atkFrac
function bossV6(Stage, stage, kind, sections){ const V=CONFIG.v6.boss, {tier,s}=Stage.info(stage); let eq=V.miniEq[s-1];
  if(kind==='boss'){ eq*=V.finalMulByPos[s-1]+(s===10?V.finalPos10PerTier*tier:0); } else if((sections||2)>5) eq*=V.miniManySegMul;
  const fk=kind==='boss'?'final':'mini'; return { hp:Math.round(Stage.zombieHp(stage,1)*eq*(1+V.tierGrowth*tier)*v7BossMul(stage)), eq, atkFrac:V.atkFrac[fk]*(fk==='final'&&tier>=(CONFIG.v6.lateFinalFromTier||99)?CONFIG.v6.lateFinalAtkMul:1), preCap:V.preCap[fk], summonN:V.lockSummon[fk], summonHp:Stage.zombieHp(stage)*V.summonHpMul }; }
function v7BossMul(stage){ const V7=CONFIG.v7; if(!V7) return 1; const Up=(typeof Upgrades!=='undefined'?Upgrades:require('./upgrades.js')); return (stage<=V7.bossHpMulEarly.length?V7.bossHpMulEarly[stage-1]:V7.bossHpMul)*Up.gate(stage).b; } /* v0.7：Boss HP = 基礎 × W(L) × 1.4（第 1–3 關 1.2） */
function bossBoost(Stage,stage,kind){ if(CONFIG.v7) return 1; /* v0.7：停用逐關補丁表，改用 W(L) */  const B=CONFIG.bossHpBoost||{}; const I=Stage.info(stage), x=B[kind==='boss'?(I.tier>=1&&B.bossLater?'bossLater':'boss'):'mini']; let m=Array.isArray(x)?x[I.s-1]:(x||1); if(kind==='boss'&&I.tier>=1) m*=(I.tier<=2?B.finalTierMulEarly:B.finalTierMul)||1; if(kind!=='boss'&&I.tier===0&&I.s>=6) m*=B.miniT0Late||1; return m; }
function prepareStage(Stage, Abil, seed, stage, lanes, opt){ opt=opt||{}; const L=Stage.generateStage(seed,stage,lanes,opt.kind,{waveOffset:opt.waveOffset||0,sections:opt.sections,xQuota:opt.xQuota,lastSeg:opt.lastSeg}); const b=L.boss; if(b.kind==='normal') return L;
  const s0=Abil.baseStats({}); const entry=opt.entry||Stage.startArmy(stage,0);
  const pre=opt.noSim?entry:(simulateStage(Object.assign({},L,{boss:{hp:1,atk:0,kind:'normal'}}),s0,entry).preBoss||0);
  const A=Math.max(pre, entry*(opt.entry?1:4)); const v=bossV6(Stage,stage,b.kind,opt.sections);
  b.hp=Math.round(v.hp*bossBoost(Stage,stage,b.kind)); b.eq=v.eq; b.atkFrac=v.atkFrac; b.preCap=v.preCap; b.summonN=v.summonN; b.summonHp=v.summonHp;
  b.atk=A*v.atkFrac; b.summonKE=v.summonN; b.calibA=A; return L; }
// 大數字格式：1.2K / 3.4M / 5.6B / 7.8T / 之後 aa, ab...
function fmt(n){ if(!isFinite(n)) return '∞'; const neg=n<0; n=Math.abs(Math.round(n)); if(n<10000) return (neg?'-':'')+n;
  const U=['K','M','B','T']; let e=Math.floor(Math.log10(n)/3), v=n/Math.pow(1000,e); if(v>=999.95){v/=1000;e++;}
  let u=e<=4?U[e-1]:String.fromCharCode(97+Math.floor((e-5)/26))+String.fromCharCode(97+(e-5)%26);
  return (neg?'-':'')+(v<10?v.toFixed(2):v<100?v.toFixed(1):v.toFixed(0))+u; }
const Combat={simDps,bossV6,bossBoost,HP0,HIT_EFF,gunKillRate,bossDps,bossHitMul,bossUltEvery,gunProfile,gunRate,gunStreams,weaponProj,weaponRate,fmt,prepareStage,applyGate,gateValue,gateScore,fireRate,fightLoss,obstacleLoss,hordeLeak,hordeLeakKE,bossInit,bossStep,simulateBoss,simulateStage,critExp,COUNTER,tierM};
if (typeof module!=='undefined') module.exports=Combat; else root.Combat=Combat;
})(this);
