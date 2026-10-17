(function(root){
const CONFIG = root.CONFIG || require('./config.js');
const RNG = root.RNG || require('./rng.js');
function info(stage){ const c=CONFIG.cycleLength; return { tier: Math.floor((stage-1)/c), s: ((stage-1)%c)+1 }; }
function startArmy(stage, bonus){ const {tier}=info(stage); return Math.round((CONFIG.baseStartArmy+(bonus||0))*Math.pow(CONFIG.tierPlayerScale,tier)); }
function tierGrowth(tier){ return 1+CONFIG.tierDifficultyGrowth*tier; }
function enemyPower(stage){ const {tier,s}=info(stage); return CONFIG.baseEnemyPower*Math.pow(CONFIG.tierEnemyScale,tier)*CONFIG.stageCurve[s-1]*tierGrowth(tier); }
function difficultyRatio(stage){ const {tier}=info(stage); return enemyPower(stage)/(CONFIG.baseEnemyPower*Math.pow(CONFIG.tierPlayerScale,tier)); }
const THEMES=['grass','desert','snow','lava','neon'];
function theme(stage){ return THEMES[info(stage).tier%THEMES.length]; }
function genGate(r, bad, tier){
  const m=Math.pow(CONFIG.tierPlayerScale,tier);
  if(!bad){ const PG=CONFIG.v7.plusGate, pm=(GH&&GH.plus)||1; return r()<0.7 ? {op:'+',v:Math.max(1,Math.round((PG[0]+r()*(PG[1]-PG[0]))*m*pm))} : {op:'x',v:r()<0.75?2:CONFIG.v7.mulGate.value}; } /* v0.7：+ 門 8–30；乘法門只有 ×2（限量在 Level.build） */
  if(GH){ const x=r(); if(x<GH.div3) return {op:'÷',v:3}; if(x<GH.div3+GH.div2) return {op:'÷',v:2}; return {op:'-',v:Math.round((GH.minus[0]+r()*(GH.minus[1]-GH.minus[0]))*m)}; } /* v0.7.4 困難化：負面門更常見、更痛（gateFloor 仍保底 40%） */
  return r()<0.7 ? {op:'-',v:Math.round((5+r()*15)*m)} : {op:'÷',v:2};
}
let GH=null;
function hardOf(stage){ const H=CONFIG.v7&&CONFIG.v7.hard; if(!H) return null; for(const b of H.bands) if(stage<=b.to) return b; return H.bands[H.bands.length-1]; }
const ELEM=['fire','ice','thunder'];
// v0.6（DESIGN-v6 §1）：殭屍血量以「基礎槍幾發」定義；每波固定隻數（擊殺當量），整關累計波次由少到多
function zombieHp(stage,forBoss){ const {tier,s}=info(stage); const V=CONFIG.v6, V7=CONFIG.v7; const Up=root.Upgrades||require('./upgrades.js');
  /* v0.7：v6 公式 × 1.3 × W(L)（Boss 走 combat.bossV6 再 ×1.4）；lateZombieHp、t0Late.hp 停用 */
  return CONFIG.gunDmg*Math.pow(CONFIG.tierPlayerScale,tier)*V.zombieHits[s-1]*(1+V.hitsTierGrowth*tier)*Up.wall(stage)*(forBoss?1:V7.zombieHpMul)*(stage<=V7.hpMul073Early.length?V7.hpMul073Early[stage-1]:V7.hpMul073)*((hardOf(stage)||{}).hp||1); } /* v0.7.4：分段 HP 倍率 */ /* v0.7.3 HP ×1.1（L1–3 ×1.05），Boss 也經由這裡 */
function waveCount(stage, wi){ const {tier,s}=info(stage); const V=CONFIG.v6; const e=stage<=V.earlyMul.length?V.earlyMul[stage-1]:1;
  /* v0.7：§4.2 waveBase × (1+0.03 tier) × waveRamp × earlyMul × (pos5 補給關 0.85)；t0Late.wave 停用 */
  return Math.max(1,Math.round(V.waveBase[s-1]*(1+V.waveTierGrowth*tier)*V.waveRamp[Math.min(wi||0,V.waveRamp.length-1)]*e*(s===5?CONFIG.v7.restPos5:1))); }
function waveDur(wi){ const D=CONFIG.v6.waveDur; return D[Math.min(wi||0,D.length-1)]; }
function hordeKE(stage, wi){ return waveCount(stage, wi); }
function spawnRate(stage){ return waveCount(stage,0)/waveDur(0); }
function enemyMul(stage, sections){ const {tier,s}=info(stage); const V=CONFIG.v6; const extra=Math.max(0,(sections||2)-2-(s>=6?1:0));
  return V.enemyMul[s-1]*(1+V.enemyTierGrowth*tier)/(1+CONFIG.tierDifficultyGrowth*tier)/(1+V.enemySegDecay*extra); }
function obstacleCount(stage){ const {tier,s}=info(stage); let n=CONFIG.obstacles[s-1]+Math.floor(tier/5)*(CONFIG.obsPer5Tier||1); (CONFIG.obsLateAt||[]).forEach((at,i)=>{ if(stage>=at) n+=CONFIG.obsLateAdd[i]; }); return Math.min(CONFIG.obsCap||14,n); }
function generateStage(seed, stage, lanes, kindOverride, opt){ opt=opt||{}; const W0=opt.waveOffset||0;
  lanes=lanes||2; const r=RNG.mulberry32(RNG.hash(seed,stage)); const {tier,s}=info(stage);
  const rowsN = CONFIG.gateRows[0] + Math.round((CONFIG.gateRows[1]-CONFIG.gateRows[0])*(s-1)/9);
  const gN = CONFIG.enemyGroups[0] + Math.round((CONFIG.enemyGroups[1]-CONFIG.enemyGroups[0])*(s-1)/9);
  let oN = CONFIG.obstacles[s-1] + Math.floor(tier/5)*(CONFIG.obsPer5Tier||1);
  (CONFIG.obsLateAt||[]).forEach((at,i)=>{ if(stage>=at) oN+=CONFIG.obsLateAdd[i]; }); oN=Math.min(CONFIG.obsCap||14,oN); // v0.5：後期路障更多
  const hasHorde = s>=CONFIG.horde.from && CONFIG.horde.spawnRate[s-1]>0;
  const P = enemyPower(stage); GH=opt.slots?null:hardOf(stage); const bad=GH&&GH.bad!=null?Math.max(GH.bad,CONFIG.badGateChance[s-1]):CONFIG.badGateChance[s-1], m=Math.pow(CONFIG.tierPlayerScale,tier);
  // 決定每個格子放什麼
  const slots=[]; slots.push('row','row'); for(let i=2;i<rowsN;i++) slots.push('row'); for(let i=0;i<gN;i++) slots.push('enemy'); for(let i=0;i<oN;i++) slots.push('obs');
  if(s!==5&&s!==10) slots.push('chest');
  for(let i=slots.length-1;i>2;i--){ const j=2+Math.floor(r()*(i-1)); [slots[i],slots[j]]=[slots[j],slots[i]]; }
  // 前兩格固定是閘門（先長兵再接敵）
  // v0.5：每關多波屍潮（1→3 波），後面的波越來越大（最後一波塞滿跑道）
  let nW = hasHorde ? 1+Math.floor((s+1)/4) : 0;
  if(opt.slots){ slots.length=0; slots.push(...opt.slots); nW=opt.slots.filter(k=>k==='horde').length; } // v0.6 無盡模式：自訂排程
  else for(let w=0; w<nW; w++) slots.splice(Math.floor(slots.length*(0.3+0.6*(w+1)/(nW+1)))+w,0,'horde');
  const lastSeg=opt.lastSeg!=null?!!opt.lastSeg:(kindOverride||(s===CONFIG.cycleLength?'boss':'normal'))==='boss';
  const rows=[], enemies=[], coins=[], obstacles=[], pickups=[]; let horde=null, chest=null; const hordes=[]; let z=20, idx=0;
  for(const k of slots){ const prog=(idx++)/slots.length;
    z+=CONFIG.rowSpacing;
    if(k==='enemy'){ const e={z, x:(r()*1.2-0.6), count:Math.max(1,Math.round(P*(0.25+r()*0.25)*(0.5+prog)*enemyMul(stage,opt.sections)*(opt.slots?1:Math.pow((root.Upgrades||require('./upgrades.js')).wall(stage),CONFIG.v7.enemyWallExp))*(!(opt.waveOffset)&&!opt.slots?CONFIG.v6.seg0EnemyMul:1)))}; if(r()<0.25) e.elem=ELEM[Math.floor(r()*3)]; enemies.push(e); }
    else if(k==='obs'){ const OU=(CONFIG.v7&&CONFIG.v7.unlocks&&!opt.slots)?CONFIG.v7.unlocks.obstacles:null; let types=s<6?['saw','pit']:['saw','hammer','pit','push']; if(OU){ types=types.filter(t=>stage>=(OU[t]||1)); if(!types.length) types=['saw']; } /* v0.7 開放表：鋸片 3、陷坑 4、巨鎚 6、推板 8 */ const type=types[Math.floor(r()*types.length)];
      obstacles.push({z,type,x:r()<0.5?-0.5:0.5,w:type==='push'?0.9:0.55,phase:r()*6.28,speed:0.8+r()*0.8}); }
    else if(k==='horde'){ z+=4; const wi=hordes.length; const gwi=W0+wi, dur=waveDur(gwi), ke=Math.max(1,Math.round(waveCount(stage,gwi)*(opt.slots?1:1))); /* v0.7：seg0HordeMul／stageHordeMul 停用（§4.2） */ /* v0.6.2：個別關卡屍潮倍率（L10 -10%） */ // v0.6：整關累計波次，由少到多
      const V7=CONFIG.v7||{}; let ke2=ke; if(!opt.slots&&GH&&GH.horde) ke2=Math.max(1,Math.round(ke2*GH.horde)); /* v0.7.6：分段屍潮數量倍率 */ if(!opt.slots&&!W0&&wi===0&&V7.firstHordeAdd) ke2+=V7.firstHordeAdd; /* v0.7：每關第一波 +10 隻 */ if(!opt.slots&&lastSeg&&wi===nW-1&&V7.lastHordeMin) ke2=Math.max(ke2,V7.lastHordeMin); /* v0.7：每關最後一波至少 50 隻 */
      const isLast=!opt.slots&&lastSeg&&wi===nW-1, dur2=isLast?Math.max(dur,V7.lastWaveDur||0):dur; const h={z,duration:dur2,ke:ke2,count:ke2,rate:ke2/dur2,wave:wi+1,waves:nW,gwi,big:wi===nW-1&&nW>2}; if(isLast&&stage<=(V7.lastWaveHpEarly||[]).length) h.hpMul=V7.lastWaveHpEarly[stage-1]; /* v0.7：末波至少 12 秒；第 1–3 關末波 HP 打折 */ hordes.push(h); if(!horde) horde=h; z+=8; }
    else if(k==='chest'){ chest={z,x:r()*1.2-0.6,hp:CONFIG.chestHp}; }
    else { const gates=[]; let hasGood=false;
      for(let l=0;l<lanes;l++){ const b=r()<bad; if(!b) hasGood=true; gates.push(genGate(r,b,tier)); }
      { const cap=Math.max(2,Math.round(startArmy(stage,0)*(0.5+0.5*rows.length))); gates.forEach(g=>{ if(g.op==='-'&&g.v>cap) g.v=cap; });
        if(rows.length<2&&!opt.slots&&!(opt.waveOffset)){ gates.forEach((g,i)=>{ if(g.op==='÷') gates[i]={op:'-',v:Math.max(2,Math.round(startArmy(stage,0)*0.3))}; else if(g.op==='-') g.v=Math.min(g.v,Math.max(2,Math.round(startArmy(stage,0)*0.2))); /* v0.6.1：前兩排每排最多扣 20% 起始兵 */ }); } } // v0.6 QA(f)：L1–10 前兩排只有溫和減法 // v0.6：前幾排的減法門不會一次扣光（固定關卡不出現必死門）
      if(!hasGood) gates[Math.floor(r()*lanes)]=genGate(r,false,tier);
      const row={z,gates};
      const roll=r();
      if(roll<CONFIG.timedGateChance[s-1]){ row.timed={period:1.6+r()*1.2,phase:r()*3}; row.alt=gates.map(g=>g.op==='+'||g.op==='x'?genGate(r,true,tier):genGate(r,false,tier)); if(!row.alt.some(g=>g.op==='+'||g.op==='x')) row.alt[Math.floor(r()*lanes)]=genGate(r,false,tier); }
      else if(roll<CONFIG.timedGateChance[s-1]+CONFIG.movingGateChance[s-1]){ row.moving={amp:0.35,speed:1+r(),phase:r()*6.28}; }
      gates.forEach(g=>{ if(g.op==='+'&&r()<CONFIG.shootGateChance){ g.shoot=0; g.step=Math.max(1,Math.round(CONFIG.shootGateStep*m)); } });
      rows.push(row); }
    if(r()<0.5) coins.push({z:z+9, x:r()*1.6-0.8});
    if(k==='row'&&r()<CONFIG.pickupChance*0.3) pickups.push({z:z+9,x:r()*1.2-0.6,type:r()<0.5?'elite':'weapon'});
  }
  // v0.7：乘法門稀有——本段最多 opt.xQuota 個（由 Level.build 依整關上限分配），超過的改成加法門（獨立亂數，不影響其他配置）
  { let left=opt.xQuota||0; /* v0.7.4：沒給配額 = 0 個（不再有不受限的乘法門） */ const r2=RNG.mulberry32(RNG.hash(seed,stage*31+7)); const rs=rows.slice().sort((a,b)=>a.z-b.z);
    for(const row of rs){ let used=false; for(const arr of [row.gates,row.alt]){ if(!arr) continue; arr.forEach((g,i)=>{ if(g.op!=='x') return; if(left>0&&!used){ used=true; g.v=opt.xVal||CONFIG.v7.mulGate.value; return; } arr[i]={op:'+',v:Math.round((CONFIG.v7.plusGate[0]+r2()*(CONFIG.v7.plusGate[1]-CONFIG.v7.plusGate[0]))*m)}; }); } if(used) left--; } }
  // 跑道上與閘門混在一起的殭屍群（每兩排閘門之間一群），數量取自本關屍潮強度
  const packs=[]; if(horde){ const rs=rows.slice().sort((a,b)=>a.z-b.z); for(let i=0;i+1<rs.length;i++){ const zz=(rs[i].z+rs[i+1].z)/2; if(hordes.some(h=>Math.abs(zz-h.z)<8)) continue; packs.push({z:zz, n:Math.max(1,Math.round(waveCount(stage,0)*CONFIG.horde.packFrac*(0.7+0.6*((i*7919)%10)/10)))}); } }
  const kind = kindOverride || (s===CONFIG.cycleLength?'boss': s===5?'mini':'normal');
  const boss = {z:z+30, hp:Math.round(P*CONFIG.bossHpMul[kind]), atk:P*CONFIG.bossAtkMul[kind], boss:kind==='boss', mini:kind==='mini', kind};
  return {stage,tier,s,theme:theme(stage),rows,enemies,coins,obstacles,pickups,horde,hordes,packs,chest,boss,length:z+30};
}
const Stage={hardOf,zombieHp,waveCount,waveDur,enemyMul,hordeKE,spawnRate,obstacleCount,tierGrowth,info,startArmy,enemyPower,difficultyRatio,generateStage,theme,THEMES};
if (typeof module!=='undefined') module.exports=Stage; else root.Stage=Stage;
})(this);
