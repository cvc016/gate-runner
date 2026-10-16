// 1000 個可選關卡：每關是一場完整的 run，由多個「段落」組成。
// 段落 = 閘門 → 殭屍潮 → 閘門 → Boss（前面的段落是中 Boss，最後一段是最終 Boss）。
// 段落數隨關卡成長；每 10 關一組，第 1–5 關較輕鬆（割草），第 6–10 關較難（多一段），基準難度一路上升到 1000。
(function(root){
const CONFIG=root.CONFIG||require('./config.js'), Stage=root.Stage||require('./stage.js'), Combat=root.Combat||require('./combat.js'), RNG=root.RNG||require('./rng.js');
const MAX=1000;
function sections(level){ const s=((level-1)%10)+1; return Math.min(8, 2+Math.floor((level-1)/150)) + (s>=6?1:0); }
// 依序校準每段 Boss：下一段的入場兵力 = 上一段無能力貪婪玩家擊敗 Boss 後的剩餘兵力（決定性，不依玩家表現調整）
function build(seed, level, lanes, Abil){ Abil=Abil||root.Abil||require('./abilities.js'); const n=sections(level), segs=[]; let entry=Stage.startArmy(level,0);
  const s0=Abil.baseStats({}); let wo=0;
  for(let j=0;j<n;j++){ const kind=j===n-1?'boss':'mini'; const L=Combat.prepareStage(Stage,Abil,RNG.hash(seed,level*16+j),level,lanes,{kind,entry:j?entry:0,waveOffset:wo,sections:n}); wo+=L.hordes.length; L.waveOffset=wo-L.hordes.length;
    { const DS=(root.DESIGN||(typeof require!=='undefined'?require('./design-data.js'):null)); if(DS){ const pool=DS.bosses.filter(b=>b.fromStage<=level&&(kind==='boss'||/mini/.test(b.role))); const r=RNG.mulberry32(RNG.hash(seed,level*97+j)); const bb=pool[Math.floor(r()*pool.length)]||DS.bosses[0]; L.boss.name=bb.name; L.boss.key=bb.key; L.boss.skill=bb.skills[0]; L.boss.vi=DS.bosses.indexOf(bb); } }
    L.seg=j; L.segs=n; L.level=level; L.entry=j?entry:0; L.lanes=lanes||2; L.segSeed=RNG.hash(seed,level*16+j); segs.push(L);
    entry=Math.max(Stage.startArmy(level,0), Math.round(L.boss.calibA*CONFIG.bossEntryCarry)); } // v0.6：下一段入場兵力 = 本段預期兵力 × 0.55
  return segs; }
// 星等：0 次復活 = 3 星；1 次 = 2 星；更多 = 1 星
function stars(revivesUsed){ return revivesUsed<=0?3:revivesUsed===1?2:1; }
// 進度：通關第 L 關解鎖 L+1；記錄最佳星等與最佳剩餘兵力
function recordClear(meta, level, starsGot, army){ meta.unlocked=Math.max(meta.unlocked||1, Math.min(MAX, level+1)); meta.stars=meta.stars||{}; meta.bestArmy=meta.bestArmy||{};
  meta.stars[level]=Math.max(meta.stars[level]||0, starsGot); meta.bestArmy[level]=Math.max(meta.bestArmy[level]||0, Math.round(army)); if(level===MAX) meta.cleared=1; return meta; }
function isUnlocked(meta, level){ return level>=1 && level<=Math.max(1,meta.unlocked||1); }
// 關內保底選卡次數：開局 2 + 每段殭屍潮 2 + 每個中 Boss 3（另有經驗升級的額外選卡，未計入）
function picks(level){ const n=sections(level); return 2+2*n+3*(n-1); }
const Level={MAX,sections,picks,build,stars,recordClear,isUnlocked};
if (typeof module!=='undefined') module.exports=Level; else root.Level=Level;
})(this);
