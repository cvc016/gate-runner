// 復活次數：每日 50 次免費（裝置本地時間午夜重置），用完可「自願」看 1 支獎勵廣告換 10 次
(function(root){
const KEY='gr_revive_v1', FREE=50, AD_BONUS=10;
function dayKey(d){ d=d||new Date(); const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); } // 本地時間（台灣裝置 = Asia/Taipei）
function load(store,now){ let s; try{ s=JSON.parse(store.getItem(KEY)||'null'); }catch(e){ s=null; }
  const k=dayKey(now); if(!s||s.day!==k) s={day:k,used:0,bonus:0}; return s; }
function save(store,s){ store.setItem(KEY,JSON.stringify(s)); }
const Revive={ FREE, AD_BONUS, dayKey,
  // 復活兵力＝最後通過的數字閘門之後的兵力（沒有就用本關開場兵力），至少 10
  restoreCount(lastGateArmy, stageStartArmy){ const v=(lastGateArmy>0?lastGateArmy:stageStartArmy)||0; return Math.max(10,Math.round(v)); },
  status(store,now){ const s=load(store,now); return {freeLeft:Math.max(0,FREE-s.used), bonus:s.bonus, total:Math.max(0,FREE-s.used)+s.bonus, day:s.day}; },
  use(store,now){ const s=load(store,now); if(s.used<FREE) s.used++; else if(s.bonus>0) s.bonus--; else return false; save(store,s); return true; },
  grantBonus(store,now,n){ const s=load(store,now); s.bonus+=(n||AD_BONUS); save(store,s); return s.bonus; },
};
if (typeof module!=='undefined') module.exports=Revive; else root.Revive=Revive;
})(this);
