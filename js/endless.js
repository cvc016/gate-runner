// v0.6 無盡挑戰（DESIGN-v6 §4）：卡片整局保留、波次無限、難度隨波次上升、本機排行榜
(function(root){
const CONFIG=root.CONFIG||require('./config.js'), Stage=root.Stage||require('./stage.js'), RNG=root.RNG||require('./rng.js');
const E=()=>CONFIG.v6.endless; const KEY='gr_endless_v1';
// 第 n 波（從 1 起算）
function hits(n){ const e=E(), V7=CONFIG.v7&&CONFIG.v7.endless; if(V7) return V7.hitsA*Math.pow(V7.hitsG,Math.max(1,n)); /* v0.7 §6.3：指數成長 1.6×1.06^n */ return e.hitsA+e.hitsB*Math.pow(Math.max(1,n),e.hitsExp); }
function zombieHp(n){ return CONFIG.gunDmg*hits(n); }                    // 無盡模式固定在階層 0 的數值單位
function waveCount(n){ const e=E(), V7=CONFIG.v7&&CONFIG.v7.endless; if(V7) return Math.round(Math.min(V7.waveMax,V7.waveA+V7.waveB*n)); return Math.round(e.waveA*(1+e.waveB*n)); }
function waveDur(n){ return Math.min(11,6+Math.floor(n/10)); }
function miniEq(n){ const e=E(), V7=CONFIG.v7&&CONFIG.v7.endless; if(V7) return V7.miniEqA*(1+V7.miniEqB*n); return e.miniEqA*(1+e.miniEqB*n); }
// 每段 = 5 波屍潮 + Boss；第 5×k 波後中 Boss，第 25×k 波後關底 Boss
function bossKind(segIdx){ const e=E(); return ((segIdx+1)*e.miniEvery)%e.finalEvery===0?'boss':'mini'; }
// 怪種：依 fromStage 換算 fromWave = ceil(fromStage/4) → 對應的「虛擬關卡」給 pickType 用
function typeStage(n){ return Math.max(1,Math.min(1000,n*4)); }
const SLOTS=['row','row','horde','row','enemy','horde','obs','row','horde','row','enemy','horde','row','obs','horde','row'];
function buildSegment(seed, segIdx, lanes){ const e=E(); const n0=segIdx*e.miniEvery; const kind=bossKind(segIdx); const vs=1+Math.min(9,Math.floor(segIdx/2)); // 虛擬關卡：路障/移動門隨段數增加（階層 0）
  const L=Stage.generateStage(RNG.hash(seed,9000+segIdx),vs,lanes||2,kind,{slots:SLOTS,sections:2});
  L.hordes.forEach((h,i)=>{ const n=n0+i+1; h.n=n; h.ke=h.count=waveCount(n); h.duration=waveDur(n); h.rate=h.ke/h.duration; h.wave=i+1; h.waves=L.hordes.length; h.big=i===L.hordes.length-1&&kind==='boss'; });
  L.packs=[]; const nB=n0+e.miniEvery; const eq=miniEq(nB)*(kind==='boss'?(CONFIG.v7?CONFIG.v7.endless.finalMul:e.finalMul):1); const V=CONFIG.v6.boss, fk=kind==='boss'?'final':'mini';
  Object.assign(L.boss,{hp:Math.round(zombieHp(nB)*eq*(CONFIG.v7?1:((CONFIG.bossHpBoost||{})[kind==='boss'?'endlessBoss':'endlessMini']||1))) /* v0.7：無盡 Boss 不再額外 ×2／×3 */,eq,atkFrac:V.atkFrac[fk],preCap:V.preCap[fk],summonN:V.lockSummon[fk],summonHp:zombieHp(nB)*V.summonHpMul,summonKE:V.lockSummon[fk],name:kind==='boss'?'無盡魔王':'無盡守衛',calibA:60});
  L.boss.atk=60*L.boss.atkFrac; L.enemies.forEach(en=>{ en.count=Math.max(1,Math.round(en.count*(1+0.04*n0))); });
  L.seg=segIdx; L.endless=1; L.segs=Infinity; L.level=vs; L.lanes=lanes||2; L.tier=0; L.zHp=zombieHp(nB); L.waveFrom=n0+1; L.typeStage=typeStage(nB);
  return L; }
function score(s){ const c=E().score; const base=(s.kills||0)*c.kill+Math.pow(s.wave||0,2)*c.waveSq+(s.mini||0)*c.mini+(s.final||0)*c.final+(s.qte||0)*c.qte+(s.qtePerfect||0)*(c.qtePerfect-c.qte)+Math.max(0,s.army||0)*c.army;
  return Math.round(base*Math.max(0,1-E().revivePenalty*(s.revives||0))); }
function load(S){ try{ return Object.assign({best:0,bestWave:0,board:[],coinDay:'',coinToday:0},JSON.parse(S.getItem(KEY)||'{}')); }catch(e){ return {best:0,bestWave:0,board:[],coinDay:'',coinToday:0}; } }
function save(S,d){ S.setItem(KEY,JSON.stringify(d)); }
// 結算：寫入排行榜（前 10）、最佳、金幣（每日上限）
function record(S, run, today){ const d=load(S); const sc=score(run); const isBest=sc>d.best; d.best=Math.max(d.best,sc); d.bestWave=Math.max(d.bestWave,run.wave||0);
  d.board.push({score:sc,wave:run.wave||0,date:today}); d.board.sort((a,b)=>b.score-a.score); d.board=d.board.slice(0,10); const rank=d.board.findIndex(x=>x.score===sc&&x.wave===(run.wave||0))+1;
  if(d.coinDay!==today){ d.coinDay=today; d.coinToday=0; } const want=Math.floor(sc/E().coinPer); const coins=Math.max(0,Math.min(want,E().coinDailyCap-d.coinToday)); d.coinToday+=coins; save(S,d);
  return {score:sc,isBest,rank,coins,best:d.best,board:d.board}; }
function unlocked(meta){ return (meta.unlocked||1)>E().unlockStage || (meta.best||0)>=E().unlockStage; }
const Endless={hits,zombieHp,waveCount,waveDur,miniEq,bossKind,buildSegment,score,load,record,unlocked,typeStage,SLOTS};
root.Endless=Endless; if(typeof module!=='undefined') module.exports=Endless;
})(typeof window!=='undefined'?window:globalThis);
