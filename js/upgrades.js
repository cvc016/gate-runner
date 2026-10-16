// v0.7 永久升級＋金幣收入（DESIGN-v7-zh-TW.md §1–§3）
(function(root){
const CONFIG=root.CONFIG||require('./config.js');
const V=()=>CONFIG.v7;
const NAMES={atk:['火力','⚔️','所有傷害 +12%'],rate:['射速','🔫','基礎槍射速與上限 +8%'],armor:['護甲','🛡️','損失 ×0.975（乘法）'],start:['起始兵力','👥','起始兵力 +4（隨階層成長）'],
  gate:['加法門','➕','加法門數值 +8%'],boss:['Boss 傷害','🐲','對 Boss 傷害 +10%'],crit:['爆擊','💥','爆擊率 +3%（上限 60%）'],coin:['金幣加成','🪙','金幣 +8%']};
const UP=()=>V().upgrades;
const KEYS=['atk','rate','armor','start','gate','boss','crit','coin'];
function item(k){ return UP().find(u=>u.k===k); }
function price(k,lv){ const u=item(k); return Math.round(u.c0*Math.pow(1+lv,V().priceExp)*Math.pow(V().priceGrowth,lv)); }
// 建議購買：價格／權重最低（金幣加成第 60 關後權重 ×0.3）
function nextBuy(meta,level){ let best=null,bv=1e99; for(const u of UP()){ const lv=meta[u.k]||0; if(lv>=u.max) continue; let w=u.w; if(u.k==='coin'&&level>60) w*=0.3; const v=price(u.k,lv)/w; if(v<bv){ bv=v; best=u.k; } } return best; }
// 套到基礎屬性（abilities.baseStats 呼叫）
function apply(s,meta){ meta=meta||{}; const g=k=>meta[k]||0;
  const F=V().fx; s.atk=1+F.atk*g('atk'); s.rateMul=1+F.rate*g('rate'); s.armor=1-Math.pow(F.armor,g('armor')); s.startAdd=F.start*g('start'); s.addMul=1+F.gate*g('gate');
  s.bossDmg=F.boss*g('boss'); s.crit=Math.min(0.6,0.05+F.crit*g('crit')); s.coinMul=1+0.08*g('coin'); return s; }
// v0.7.1：參考玩家的輸出倍率（火力×射速×爆擊期望；Boss 另乘 Boss 傷害）
function power(meta){ const F=V().fx, g=k=>meta[k]||0, cr=Math.min(0.6,0.05+F.crit*g('crit')); return {dps:(1+F.atk*g('atk'))*(1+F.rate*g('rate'))*(1+cr)/1.05, boss:1+F.boss*g('boss')}; }
// v0.7.1 升級掛鉤：第 6 關起，怪物 HP 跟著「建議配點的輸出倍率」成長（相對第 5 關），不升級的玩家會被血量拉開
const gateCache={};
function gate(L){ if(gateCache[L]) return gateCache[L]; let r={z:1,b:1}; if(L>5){ const p=power(recommended(L)), p5=power(recommended(5)), e=V().gateExp; const X=1+(V().gateX-1)*Math.min(1,(L-5)/5); r={z:Math.max(1,Math.pow(p.dps/p5.dps,e))*X, b:Math.max(1,Math.pow(p.boss/p5.boss,e))}; } /* v0.7.2：指數 gateExp＋第 6–10 關漸增到 ×gateX（壓平建議配點曲線） */ if(info(L).s===5) r={z:r.z,b:1+(r.b-1)*V().restPos5}; gateCache[L]=r; return r; }
// ---- 金幣（§2）----
function info(L){ const c=CONFIG.cycleLength; return {tier:Math.floor((L-1)/c), s:((L-1)%c)+1}; }
function coins(kind,L){ const c=V().coin, f=a=>Math.pow(L,a);
  if(kind==='clear') return Math.round((c.clearA+c.clearB*f(c.clearExp))*(info(L).s===10?c.pos10Mul:1)*(info(L).s===5?c.restBonus:1));
  if(kind==='wave') return Math.round(c.waveA+c.waveB*f(c.exp)); if(kind==='seg') return Math.round(c.segA+c.segB*f(c.exp)); if(kind==='rou') return Math.round(c.rouA+c.rouB*f(c.exp)); return 0; }
// 參考玩家：每關一次就過，照建議購買；回傳打第 L 關前的配點
function sections(L){ const s=info(L).s; return Math.min(8,2+Math.floor((L-1)/150))+(s>=6?1:0); }
function hordesIn(L){ const s=info(L).s; return (1+Math.floor((s+1)/4))*sections(L); }
function expIncome(L,coinLv){ const cm=1+0.08*(coinLv||0), n=sections(L); return (coins('clear',L)+hordesIn(L)*coins('wave',L)+(n-1)*coins('seg',L)+coins('rou',L)*1.47*(1-V().coin.permSlots/12))*cm; }
const recCache={};
function recommended(L){ if(recCache[L]) return Object.assign({},recCache[L]); const m={}; let c=0; for(let l=1;l<L;l++){ c+=expIncome(l,m.coin); for(;;){ const k=nextBuy(m,l); if(!k) break; const pr=price(k,m[k]||0); if(c<pr) break; c-=pr; m[k]=(m[k]||0)+1; } } recCache[L]=m; return Object.assign({},m); }
const total=meta=>KEYS.reduce((a,k)=>a+(meta[k]||0),0);
// ---- 難度門檻 W(L)（§3.1）----
function wall(L){ const A=V().wallAnchors; let v; if(L<=5) v=1; else if(L<=A[0][0]) v=1+(A[0][1]-1)*(L-5)/(A[0][0]-5); else if(L>=A[A.length-1][0]) v=A[A.length-1][1]*Math.pow(L/A[A.length-1][0],0.9);
  else { let i=0; while(A[i+1][0]<L) i++; const [l0,w0]=A[i],[l1,w1]=A[i+1]; v=Math.exp(Math.log(w0)+(Math.log(w1)-Math.log(w0))*(L-l0)/(l1-l0)); }
  if(info(L).s===5) v=1+(v-1)*V().restPos5; const gz=gate(L).z; return Math.max(1,v)*(info(L).s===5?1+(gz-1)*V().restPos5:gz); } /* 補給關：掛鉤也打 85 折 */
const Upgrades={KEYS,NAMES,item,price,nextBuy,apply,coins,expIncome,recommended,total,wall,power,gate};
if(typeof module!=='undefined') module.exports=Upgrades; else root.Upgrades=Upgrades;
})(this);
