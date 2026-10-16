(function(root){
function hash(a,b){ let h=2166136261^a; h=Math.imul(h^b,16777619); h^=h>>>13; h=Math.imul(h,0x5bd1e995); return (h^(h>>>15))>>>0; }
function mulberry32(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const RNG={hash,mulberry32};
if (typeof module!=='undefined') module.exports=RNG; else root.RNG=RNG;
})(this);
