// v0.7 石頭門＋特殊門（DESIGN-v7-special-gates-zh-TW.md；開放關卡依威霆指示提前：L11/14/17/21/26/31/41/51/61）
(function(root){
const CONFIG=root.CONFIG||require('./config.js'), RNG=root.RNG||require('./rng.js');
const SG=()=>CONFIG.v7.stoneGate;
// key, 名稱, 圖示, 好門?, 秒數, 權重, 原企劃開放關, 顏色, 第一次提示
const D=(k,n,i,g,sec,w,from0,col,line)=>({k,name:n,icon:i,good:g,sec,w,from0,col,line});
const LIST=[
  D('haste','加速門','💨',1,5,12,21,'#38e8ff','5 秒內前進速度 ×1.6！'),
  D('reinforce','援軍門','📯',1,0,12,21,'#3d7bff','立刻增援一批士兵！'),
  D('coin','金幣門','🪙',1,0,8,21,'#ffc61a','直接獲得一筆金幣！'),
  D('invis','隱形門','👻',1,5,9,26,'#b98cff','5 秒內殭屍撞不到你！'),
  D('frenzy','火力門','🔥',1,6,10,26,'#ff7a1a','6 秒內射速 ×1.5！'),
  D('zombie','殭屍門','🧟',0,0,10,26,'#4f9a2a','糟糕，引來一大波殭屍！看清楚再穿過。'),
  D('shield','護盾門','🛡',1,20,8,31,'#9fd0ff','抵擋 3 次撞擊！'),
  D('freeze','冰凍門','🧊',1,3,7,31,'#bff4ff','畫面上的殭屍全部凍住 3 秒！'),
  D('slow','泥沼門','🟫',0,5,8,31,'#8a5a2b','泥沼：5 秒內變慢、射速下降。'),
  D('spread','散彈門','🔫',1,6,7,41,'#ffe14d','6 秒內彈道 +2！'),
  D('magnet','磁鐵門','🧲',1,8,6,41,'#ff4f6a','金幣自動吸過來！'),
  D('bomb','炸彈門','💣',0,0,7,41,'#333333','炸彈：損失 8% 兵力！'),
  D('nuke','爆破門','☢️',1,0,5,51,'#ffd400','全畫面殭屍重創！'),
  D('slowmo','時緩門','⏳',1,4,6,51,'#6aa8ff','殭屍慢動作 4 秒！'),
  D('fog','迷霧門','🌫',0,6,7,51,'#9aa0a6','迷霧：6 秒內看不遠。'),
  D('twin','雙倍門','✨',1,15,5,61,'#fff27a','下一扇加法門數值 ×2！'),
  D('heal','治療門','💚',1,0,6,61,'#3fd77a','找回 25% 損失的兵力！'),
  D('reverse','反轉門','🔄',0,4,5,61,'#a03cff','反轉：4 秒內左右顛倒！'),
  D('card','卡片門','🃏',1,0,3,71,'#ffcf4d','立刻多選一張能力卡！'),
  D('curse','詛咒門','💀',0,8,5,71,'#8a1020','詛咒：8 秒內傷害 −30%。'),
  D('breaker','破甲門','🔨',1,0,3,81,'#c0c8d0','下一隻 Boss 的第一層護盾直接破！'),
  D('elite','精英門','👑',0,0,5,81,'#d4142c','精英部隊來襲！'),
  D('thief','竊賊門','🦹',0,0,4,91,'#555a66','竊賊偷走本關 20% 金幣！'),
  D('gravity','重力門','🌀',0,5,5,91,'#7a5cff','重力：隊伍會一直往一邊滑，反向拖住！'),
];
const BY={}; LIST.forEach(d=>BY[d.k]=d);
// 開放關卡：原企劃 21/26/31/41/51/61/71/81/91 → 11/14/17/21/26/31/41/51/61
function from(k){ const m=SG().unlockMap; return m[BY[k].from0]; }
function info(L){ const c=CONFIG.cycleLength; return {tier:Math.floor((L-1)/c), s:((L-1)%c)+1}; }
// 要點幾下：L11–15 2 下、L16–20 3 下（威霆：L11–20 2–3 下）；21 起照企劃 3 + floor((L−21)/20)，上限 10
function taps(L){ const g=SG(); if(L<g.from) return 0; if(L<21) return L<16?2:3; return Math.max(g.tapsA,Math.min(g.tapsMax,g.tapsA+Math.floor((L-21)/g.tapsStep))); }
// 每關石頭門數（全關合計）
function count(L,r){ const g=SG(), s=info(L).s; if(L<g.from) return 0; if(L<=30) return 1; if(L<=60) return s>=6?2:1; if(s===10) return g.bossLevelMax; if(L<=150) return 2; if(L<=400) return 2+(r()<0.5?1:0); return 3; }
function pGood(L){ const t=SG().pGood; let p=t[0][1]; for(const [l,v] of t) if(L>=l) p=v; if(info(L).s===5) p+=SG().restBonus; return Math.min(1,p); }
function unlocked(L){ return LIST.filter(d=>from(d.k)<=L); }
function pick(L,r){ const un=unlocked(L); const goods=un.filter(d=>d.good), bads=un.filter(d=>!d.good); const nb=SG().newBoost;
  const pool=(bads.length&&r()>=pGood(L))?bads:goods; const ws=pool.map(d=>d.w*(L-from(d.k)<nb.levels?nb.mul:1)); let t=ws.reduce((a,b)=>a+b,0), x=r()*t;
  for(let i=0;i<pool.length;i++){ x-=ws[i]; if(x<=0) return pool[i].k; } return pool[pool.length-1].k; }
// 放到關卡：只放在閘門排（非移動／變換、沒有乘法門、沒有射擊門），每段前兩排不放；第 11 關固定第 1 段第 1 個可放的排（教學）
function place(segs,L,seed){ const n0=count(L,RNG.mulberry32(RNG.hash(seed,L*53+1))); if(!n0) return 0; const r=RNG.mulberry32(RNG.hash(seed,L*53+2)); const cand=[];
  segs.forEach((sg,j)=>sg.rows.forEach((row,i)=>{ if(i<2||row.timed||row.gates.some(g=>g.op==='x')||row.gates.length<2) return; cand.push({j,i,row}); }));
  let placed=0; const used=new Set(); const g=SG(); const hardOk=L>=g.hardFrom;
  for(let k=0,tries=0;placed<n0&&cand.length&&tries<n0*6;tries++,k=placed){ let c; if(L===g.from&&k===0) c=cand.find(x=>x.j===0)||cand[0]; else { const left=cand.filter(x=>!used.has(x.j+':'+x.i)&&!used.has('seg'+x.j)); c=left.length?left[Math.floor(r()*left.length)]:null; } if(!c) break;
    used.add(c.j+':'+c.i); if(n0<=segs.length) used.add('seg'+c.j); const row=c.row; const goodIdx=row.gates.map((x,i)=>i).filter(i=>row.gates[i].op==='+'); const lane=row.gates.length>1?(goodIdx.length>1?goodIdx[Math.floor(r()*goodIdx.length)]:row.gates.findIndex((x,i)=>!(goodIdx.length===1&&i===goodIdx[0]))):0;
    const hard=hardOk&&r()<g.hardChance; const t=taps(L)+(hard?g.hardExtra:0);
    if(goodIdx.length===1&&lane===goodIdx[0]) continue; // 保證同排還有一扇一般好門可以選
    row.gates[lane]={op:'stone',v:0,taps:t,tapsLeft:t,hard:hard?1:0,sp:pick(L,r)}; row.stone=1; placed++; }
  return placed; }
// 數值
function reinforceAdd(tier,addMul){ return Math.round(1.5*19*Math.pow(CONFIG.tierPlayerScale,tier)*(addMul||1)); }
function penalty(army,tier,armor,tapped,hard){ const p=SG().penalty; if(hard) return {loss:Math.round(army*p.hardLossFrac*(1-(armor||0))),stun:p.hardStun};
  let loss=Math.max(p.lossFlat*Math.pow(CONFIG.tierPlayerScale,tier),army*p.lossFrac)*(1-(armor||0)); let stun=p.stunSec; if(tapped){ loss*=p.halfIfTapped; stun=0; } return {loss:Math.round(Math.min(loss,army*0.5)),stun}; }
const Special={LIST,BY,from,taps,count,pGood,unlocked,pick,place,reinforceAdd,penalty};
if(typeof module!=='undefined') module.exports=Special; else root.Special=Special;
})(this);
