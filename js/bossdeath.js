// v0.7 Boss 擊敗演出（規格：game-assets/BOSS-DEATH-zh-TW.md，移植自 preview/boss-death.html）
// 時間軸用真實毫秒；timeScale 只給遊戲世界用。座標以 Boss 螢幕位置為中心，像素值依 960 寬設計稿乘上 U = W/960。
(function(root){
const PRESETS = {
 mid: { total:1600, bossScale:1.6,
  hitstop:{start:0,end:120,scale:0.0}, slowmo:{start:120,end:450,from:0.35,to:1},
  flashes:[{t:0,dur:90,a:0.85},{t:520,dur:80,a:0.6}],
  shakes:[{t:0,dur:450,amp:10},{t:520,dur:350,amp:14}],
  chain:{start:120,count:4,interval:110,frames:'boom_a/',scaleFrom:1.4,scaleTo:1.8,sfx:['bd_explosion_small_1','bd_explosion_small_2']},
  final:{t:520,boom:'boom_b/',booms:1,boomScale:2.6,sfx:['bd_explosion_mid','bd_bass_thud','bd_shatter']},
  shards:18, rings:[{t:520,dur:380,r:260,w0:18,col:'255,255,255'}],
  pillar:{start:600,end:1100,width:90,sfx:'bd_pillar_mid'},
  coins:{n:12,burst:560,flyEnd:900,magnetEnd:1350,sfx:'bd_coin_burst'},
  banner:{start:650,popEnd:800,settleEnd:900,fadeStart:1400,end:1600,peak:1.25,slam:'bd_banner_slam',slamAt:700},
  victory:{t:800,sfx:'bd_victory_mid'}, punch:'bd_hitstop_punch' },
 final: { total:2800, bossScale:2.4,
  hitstop:{start:0,end:200,scale:0.0}, slowmo:{start:200,end:1100,from:0.25,to:1},
  flashes:[{t:0,dur:120,a:1.0},{t:1200,dur:120,a:0.9},{t:1320,dur:80,a:0.4}],
  shakes:[{t:0,dur:1200,amp:16},{t:1200,dur:500,amp:24}],
  chain:{start:200,count:9,interval:110,frames:'boom_a/',scaleFrom:1.3,scaleTo:2.4,sfx:['bd_explosion_small_1','bd_explosion_small_2','bd_explosion_small_3']},
  final:{t:1200,boom:'boom_b/',booms:3,boomScale:3.6,sfx:['bd_explosion_big','bd_bass_thud','bd_shatter','bd_shatter_rock']},
  shards:36, rings:[{t:1200,dur:500,r:420,w0:26,col:'255,255,255'},{t:1300,dur:500,r:300,w0:14,col:'255,214,64'}],
  pillar:{start:1350,end:2100,width:160,sfx:'bd_pillar_final'},
  coins:{n:40,burst:1280,flyEnd:1800,magnetEnd:2400,sfx:'bd_coin_burst'},
  banner:{start:1500,popEnd:1680,settleEnd:1800,fadeStart:2600,end:2800,peak:1.4,slam:'bd_banner_slam',slamAt:1520,fanfare:'bd_banner_fanfare',fanfareAt:1550,pulse:0.04},
  victory:{t:1650,sfx:'bd_victory_final'}, punch:'bd_hitstop_punch' }
};
const SOUNDS=[...new Set(Object.values(PRESETS).flatMap(P=>[...P.chain.sfx,...P.final.sfx,P.pillar.sfx,P.coins.sfx,P.banner.slam,P.banner.fanfare,P.victory.sfx,P.punch,'bd_coin_ding'].filter(Boolean)))];
const clamp=(x,a,b)=>Math.max(a===undefined?0:a,Math.min(b===undefined?1:b,x)), lerp=(a,b,t)=>a+(b-a)*t;
const easeOutCubic=t=>1-Math.pow(1-t,3), easeInCubic=t=>t*t*t, easeOutBack=t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)};
function rng(seed){ seed=(seed>>>0)||7; return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}; }
const A=root.BOSS_DEATH_ATLAS||{frames:{}}; let img=null;
function image(){ if(!img&&typeof Image!=='undefined'){ img=new Image(); img.src='assets/atlas/boss-death.png'; } return img; }
const seqCache={}; const seq=p=>seqCache[p]||(seqCache[p]=Object.keys(A.frames).filter(k=>k.startsWith(p)).sort());
function build(P,seed,lite){ const R=rng(seed), ev=[]; const bs=P.bossScale/1.6;
  const chain=[...Array(P.chain.count)].map((_,i)=>({t:P.chain.start+i*P.chain.interval,x:(R()-.5)*170*bs,y:(R()-.5)*120*bs,s:lerp(P.chain.scaleFrom,P.chain.scaleTo,i/Math.max(1,P.chain.count-1)),rot:R()*6.28,sfx:P.chain.sfx[i%P.chain.sfx.length]}));
  chain.forEach(c=>ev.push({t:c.t,n:c.sfx,rate:0.9+R()*0.25}));
  const fb=[...Array(P.final.booms)].map((_,i)=>({t:P.final.t+i*70,x:i?(R()-.5)*120:0,y:i?(R()-.5)*80:0,s:P.final.boomScale*(i?0.7:1)}));
  P.final.sfx.forEach(n=>ev.push({t:P.final.t,n}));
  const nS=lite?Math.round(P.shards/2):P.shards;
  const shards=[...Array(nS)].map((_,i)=>{const a=i/nS*6.283+R()*0.3,sp=260+R()*420;return{vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-260,rot:R()*6.28,vr:(R()-.5)*14,sz:10+R()*22*bs,c:['#ff7a3d','#ffd23f','#e8433a','#ffffff'][i%4],sides:3+(i%3)}});
  const coins=[...Array(P.coins.n)].map((_,i)=>{const a=-Math.PI/2+(R()-.5)*2.4,sp=320+R()*420;return{vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,delay:R()*120,arrive:lerp(P.coins.flyEnd+60,P.coins.magnetEnd,(i+R()*.5)/P.coins.n),spin:R()*6}});
  coins.forEach((c,i)=>ev.push({t:c.arrive,n:'bd_coin_ding',rate:1+0.6*i/P.coins.n,vol:0.5,coin:1}));
  ev.push({t:0,n:P.punch},{t:P.pillar.start,n:P.pillar.sfx},{t:P.coins.burst,n:P.coins.sfx},{t:P.banner.slamAt,n:P.banner.slam},{t:P.victory.t,n:P.victory.sfx});
  if(P.banner.fanfare) ev.push({t:P.banner.fanfareAt,n:P.banner.fanfare});
  return {P,chain,fb,shards,coins,ev:ev.sort((a,b)=>a.t-b.t),lite}; }
function Fx(kind,seed,opt){ opt=opt||{}; this.kind=kind==='final'?'final':'mid'; this.P=PRESETS[this.kind]; this.S=build(this.P,seed,opt.lite); this.t=0; this.evI=0; this.done=false; this.skipped=false; this.sfx=opt.sfx||null; this.lastDing=-1; this.dings=[]; image(); }
Fx.prototype.timeScale=function(){ const P=this.P,t=this.t; if(this.done) return 1; if(t>=P.hitstop.start&&t<P.hitstop.end) return P.hitstop.scale; if(t>=P.slowmo.start&&t<P.slowmo.end) return lerp(P.slowmo.from,P.slowmo.to,easeInCubic((t-P.slowmo.start)/(P.slowmo.end-P.slowmo.start))); return 1; };
Fx.prototype.play=function(e){ const s=this.sfx; if(!s) return; if(e.coin){ this.dings=this.dings.filter(x=>this.t-x<190); if(this.dings.length>=6||this.t-this.lastDing<40) return; this.dings.push(this.t); this.lastDing=this.t; } s.ext('boss-death/'+e.n,e.rate||1,e.vol===undefined?1:e.vol,'bd'); };
Fx.prototype.update=function(ms){ if(this.done) return; this.t+=ms; const ev=this.S.ev; while(this.evI<ev.length&&ev[this.evI].t<=this.t) this.play(ev[this.evI++]); if(this.t>=this.P.total) this.done=true; };
Fx.prototype.skip=function(){ if(this.done) return; const v=this.P.victory.sfx; if(this.sfx){ this.sfx.extStop('bd','boss-death/'+v); if(this.t<this.P.victory.t) this.sfx.ext('boss-death/'+v,1,1,'bd'); } this.done=true; this.skipped=true; };
Fx.prototype.coinsGot=function(){ return this.done?this.S.coins.length:this.S.coins.filter(c=>this.t>=c.arrive).length; };
Fx.prototype.shake=function(U){ const P=this.P,t=this.t; if(this.done) return {x:0,y:0}; let a=0; P.shakes.forEach(s=>{const k=(t-s.t)/s.dur; if(k>=0&&k<1) a=Math.max(a,s.amp*Math.pow(1-k,2));}); a*=U; return {x:Math.sin(t*0.19)*a*Math.cos(t*0.05),y:Math.cos(t*0.23)*a}; };
Fx.prototype.bossVisible=function(){ return !this.done&&this.t<this.P.final.t; };
// 白剪影替代：遊戲 Boss 是程式繪製，用白色光暈蓋上去
Fx.prototype.whiteA=function(){ const P=this.P,t=this.t; return t<P.hitstop.end?0.8:clamp(0.5*Math.sin(t*0.06)+0.2); };
function drawF(ctx,n,x,y,s,alpha,rot){ const im=image(), f=A.frames[n]&&A.frames[n].frame; if(!f||!im||!im.complete||!im.naturalWidth) return; ctx.save(); ctx.globalAlpha=alpha===undefined?1:alpha; ctx.translate(x,y); if(rot) ctx.rotate(rot); ctx.drawImage(im,f.x,f.y,f.w,f.h,-f.w*s/2,-f.h*s/2,f.w*s,f.h*s); ctx.restore(); }
// 世界層（吃震屏）：Boss 白光、光柱、爆炸、碎片、衝擊波、金幣
Fx.prototype.drawWorld=function(ctx,W,H,boss,player,U){ if(this.done) return; const P=this.P,S=this.S,t=this.t, bx=boss.x, by=boss.y;
  if(this.bossVisible()){ const wa=this.whiteA(); if(wa>0){ const r=(boss.r||120*U); const g=ctx.createRadialGradient(bx,by,0,bx,by,r); g.addColorStop(0,`rgba(255,255,255,${wa})`); g.addColorStop(0.6,`rgba(255,255,255,${wa*0.6})`); g.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(bx,by,r*0.8,r,0,0,6.283); ctx.fill(); } }
  // 光柱
  { const p=P.pillar,k=(t-p.start)/(p.end-p.start); if(k>=0&&k<1){ const w=p.width*U*(k<0.25?easeOutBack(k/0.25):k>0.7?1-easeInCubic((k-0.7)/0.3):1);
    ctx.save(); ctx.globalCompositeOperation='lighter'; const gx=ctx.createLinearGradient(bx-w,0,bx+w,0); gx.addColorStop(0,'rgba(255,240,150,0)'); gx.addColorStop(0.35,'rgba(255,230,120,0.55)'); gx.addColorStop(0.5,'rgba(255,255,255,0.95)'); gx.addColorStop(0.65,'rgba(255,230,120,0.55)'); gx.addColorStop(1,'rgba(255,240,150,0)');
    ctx.fillStyle=gx; ctx.fillRect(bx-w,-20,w*2,by+60*U); const rg=ctx.createRadialGradient(bx,by+30*U,0,bx,by+30*U,Math.max(1,w*1.6)); rg.addColorStop(0,'rgba(255,255,220,0.8)'); rg.addColorStop(1,'rgba(255,220,120,0)'); ctx.fillStyle=rg; ctx.fillRect(bx-w*1.6,by-w,w*3.2,w*2.4); ctx.restore();
    if(!S.lite){ const el=(t-p.start)/1000; for(let i=0;i<24;i++){ const ph=(i*0.137)%1, yy=by+40*U-((el*(380+i*13)*U+ph*by)%(by+60*U)); drawF(ctx,i%2?'fx/star_06':'fx/star_07',bx+Math.sin(i*2.1+el*3)*w*0.6,yy,(0.35+0.25*(i%3)/2)*U,clamp(w/(p.width*U))); } } } }
  // 連爆／終爆
  const fa=seq(P.chain.frames), fbf=seq(P.final.boom);
  S.chain.forEach(c=>{ const i=Math.floor((t-c.t)/40); if(i>=0&&i<fa.length) drawF(ctx,fa[i],bx+c.x*U,by+c.y*U,c.s*U,1,c.rot); });
  S.fb.forEach(c=>{ const i=Math.floor((t-c.t)/50); if(i>=0&&i<fbf.length) drawF(ctx,fbf[i],bx+c.x*U,by+c.y*U,c.s*U); });
  // 碎片
  S.shards.forEach(s=>{ const dt=(t-P.final.t)/1000; if(dt<0||dt>1.1) return; const x=bx+s.vx*dt*U, y=by+(s.vy*dt+900*dt*dt)*U;
    ctx.save(); ctx.globalAlpha=clamp(1.1-dt); ctx.translate(x,y); ctx.rotate(s.rot+s.vr*dt); ctx.fillStyle=s.c; ctx.strokeStyle='#22313f'; ctx.lineWidth=3*U; ctx.beginPath();
    for(let k=0;k<s.sides;k++){ const a=k/s.sides*6.283; ctx[k?'lineTo':'moveTo'](Math.cos(a)*s.sz*U,Math.sin(a)*s.sz*0.7*U); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); });
  // 衝擊波
  P.rings.forEach((r,i)=>{ if(S.lite&&i>0) return; const k=(t-r.t)/r.dur; if(k<0||k>=1) return; const e=easeOutCubic(k); ctx.save(); ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=`rgba(${r.col},${1-k})`; ctx.lineWidth=lerp(r.w0,2,k)*U; ctx.beginPath(); ctx.ellipse(bx,by,Math.max(0.1,r.r*e*U),Math.max(0.1,r.r*e*0.55*U),0,0,6.283); ctx.stroke();
    ctx.strokeStyle=`rgba(${r.col},${(1-k)*0.35})`; ctx.lineWidth=lerp(r.w0,2,k)*2.2*U; ctx.stroke(); ctx.restore(); });
  // 金幣
  S.coins.forEach(c=>{ const p=coinPos(this,c,t,boss,player,H,U); if(!p) return; const sp=Math.abs(Math.cos(t/90+c.spin)); drawF(ctx,sp>0.35?'coin/coin_gold':'coin/coin_gold_side',p.x,p.y,(p.s||1)*0.8*Math.max(0.3,sp)*U,1); }); };
function coinPos(fx,c,t,boss,player,H,U){ const P=fx.P, t0=P.coins.burst+c.delay; if(t<t0) return null;
  const ft=Math.min(t,P.coins.flyEnd)-t0, s=Math.max(0,ft)/1000, drag=Math.exp(-2.2*s);
  let x=boss.x+c.vx*(1-drag)/2.2*U, y=boss.y+(c.vy*(1-drag)/2.2+700*s*s)*U; y=Math.min(y,boss.ground||H*0.8);
  if(t<=P.coins.flyEnd) return {x,y};
  const k=clamp((t-P.coins.flyEnd)/(c.arrive-P.coins.flyEnd)); if(k>=1) return null;
  const e=easeInCubic(k); return {x:lerp(x,player.x,e),y:lerp(y,player.y-40*U,e)-Math.sin(k*Math.PI)*80*U,s:lerp(1,0.6,e)}; }
// 螢幕層（不吃震屏）：白閃、「擊敗！」橫幅
Fx.prototype.drawScreen=function(ctx,W,H,U,sub){ if(this.done) return; const P=this.P,t=this.t;
  P.flashes.forEach(f=>{ const k=(t-f.t)/f.dur; if(k>=0&&k<1){ ctx.fillStyle=`rgba(255,255,255,${f.a*(1-easeOutCubic(k))})`; ctx.fillRect(0,0,W,H); } });
  const B=P.banner; if(t<B.start||t>=B.end) return;
  const s=t<B.popEnd?B.peak*easeOutBack((t-B.start)/(B.popEnd-B.start)):t<B.settleEnd?lerp(B.peak,1,easeOutCubic((t-B.popEnd)/(B.settleEnd-B.popEnd))):1+(B.pulse||0)*Math.sin((t-B.settleEnd)/120);
  const a=t>B.fadeStart?1-(t-B.fadeStart)/(B.end-B.fadeStart):1, bu=Math.min(U*1.0,W*0.92/660);
  ctx.save(); ctx.globalAlpha=clamp(a); ctx.translate(W/2,H*0.36); ctx.scale(s*bu,s*bu); ctx.rotate(-0.04);
  ctx.fillStyle='#a8232b'; [-1,1].forEach(d=>{ ctx.beginPath(); ctx.moveTo(d*250,-40); ctx.lineTo(d*330,-40); ctx.lineTo(d*300,0); ctx.lineTo(d*330,40); ctx.lineTo(d*250,40); ctx.fill(); });
  ctx.fillStyle='#e8433a'; ctx.strokeStyle='#22313f'; ctx.lineWidth=6; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(-270,-58,540,116,18); else ctx.rect(-270,-58,540,116); ctx.fill(); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(-258,-48,516,22);
  ctx.font='900 92px "Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineJoin='round'; ctx.lineWidth=16; ctx.strokeStyle='#22313f'; ctx.strokeText('擊敗！',0,4);
  const tg=ctx.createLinearGradient(0,-44,0,44); tg.addColorStop(0,'#fff6a8'); tg.addColorStop(0.5,'#ffd23f'); tg.addColorStop(1,'#ff9a1f'); ctx.fillStyle=tg; ctx.fillText('擊敗！',0,4);
  [[-300,-80],[300,-70],[0,-100]].forEach(([x,y],i)=>drawF(ctx,'fx/star_07',x,y,0.9+0.2*Math.sin(t/90+i),1,t/400));
  if(sub){ ctx.font='900 30px system-ui,sans-serif'; ctx.lineWidth=8; ctx.strokeStyle='#22313f'; ctx.strokeText(sub,0,92); ctx.fillStyle='#fff'; ctx.fillText(sub,0,92); }
  ctx.restore(); };
const BossDeath={PRESETS,SOUNDS,create:(kind,seed,opt)=>new Fx(kind,seed,opt)};
if(typeof module!=='undefined') module.exports=BossDeath; else root.BossDeath=BossDeath;
})(this);
