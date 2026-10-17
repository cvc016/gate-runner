// 視覺特效系統：殭屍精靈圖、基礎槍火子彈池、14 種元素武器特效。全部有上限 + 物件池，維持中階手機效能。
(function(root){
let ctx, proj, D=1, getG;
const MAXB=640, MAXE=90; // 子彈 / 特效上限
const bullets=[], effects=[], pool=[];
// ---------- 素材（Kenney Particle Pack, CC0）----------
const IMG={}, TINT={};
['flame_03','spark_04','magic_02','star_06','smoke_04','light_02','circle_05','twirl_02','trace_04','scorch_02'].forEach(n=>{ const i=new Image(); i.src='assets/fx/'+n+'.png'; IMG[n]=i; });
// v0.5 追加：IceMaan / CodeManu / Akami（CodeManu 需署名，見 credits）
const XV=['hit_fire','hit_ice','hit_spark','hit_crit','boom','chain_lt','codemanu_vortex','codemanu_fire','codemanu_freeze','codemanu_hit','icon_freeze','icon_stun','icon_poison','icon_burn','icon_slow'];
XV.forEach(n=>{ const i=new Image(); i.src='assets/vfx-extra/'+n+'.png'; IMG[n]=i; });
function sheet(n,fi,cols,sz){ const i=IMG[n]; if(!i||!i.complete||!i.naturalWidth) return null; const c=cols||4; const fw=i.naturalWidth/c|0, fh=i.naturalHeight/(Math.ceil((i.naturalWidth*i.naturalHeight)/(fw*fw*c))||c)|0 || fw;
  // 簡化：正方形格
  const side=i.naturalWidth/c|0; return {i,side,col:fi%c,row:(fi/c)|0}; }
function drawSheet(n,fi,cols,x,y,size,alpha){ const s=sheet(n,fi,cols); if(!s) return; ctx.globalAlpha=alpha===undefined?1:alpha; ctx.imageSmoothingEnabled=false;
  ctx.drawImage(s.i,s.col*s.side,s.row*s.side,s.side,s.side,x-size/2,y-size/2,size,size); ctx.globalAlpha=1; ctx.imageSmoothingEnabled=true; }
function tint(n,col){ const k=n+col; if(TINT[k]) return TINT[k]; const i=IMG[n]; if(!i||!i.complete||!i.naturalWidth) return null; const c=document.createElement('canvas'); c.width=c.height=96; const x=c.getContext('2d');
  x.drawImage(i,0,0,96,96); x.globalCompositeOperation='source-in'; x.fillStyle=col; x.fillRect(0,0,96,96); return TINT[k]=c; }
function spr(n,col,x,y,size,alpha,rot){ const c=tint(n,col); if(!c){ ctx.globalAlpha=alpha||1; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,size*0.3,0,7); ctx.fill(); ctx.globalAlpha=1; return; }
  ctx.globalAlpha=alpha===undefined?1:alpha; if(rot){ ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.drawImage(c,-size/2,-size/2,size,size); ctx.restore(); } else ctx.drawImage(c,x-size/2,y-size/2,size,size); ctx.globalAlpha=1; }
// ---------- 殭屍精靈圖（程序繪製後快取）----------
const ZS={};
// Kenney Toon Characters 殭屍走路影格（CC0）
const ZW=[0,2,4,6].map(i=>{ const im=new Image(); im.src='assets/chars/zombie_walk'+i+'.png'; return im; });
// 敵人種類：hp=相對血量（以基本殭屍為 1）、sp=速度倍率、sz=體型
// 敵人種類由 design-v3.json（js/design-data.js）驅動：hp/速度/接觸殺傷/出現權重/出現關卡都讀資料；這裡只放外觀
const LOOK={ zombie:{skin:'#7fbf5a',shirt:'#6a4a8a'}, runner:{skin:'#a8d860',shirt:'#c0392b',tint:'#ff3020',sz:0.85}, fatty:{skin:'#8fae5a',shirt:'#d9b38c',tint:'#d9b38c',sz:1.6,fat:1},
  shield:{skin:'#7fbf5a',shirt:'#445',acc:'shield',sz:1.1}, spitter:{skin:'#5ad8a0',shirt:'#2a6a4a',acc:'acid',tint:'#20ffa0'}, skeleton:{skin:'#eee',shirt:'#bbb',tint:'#ffffff',acc:'bones'},
  slime:{atlas:['enemy/slime_normal_walk_a','enemy/slime_normal_walk_b'],sz:0.9}, bat:{skin:'#4a3a6a',shirt:'#2a1a3a',acc:'bat',sz:0.7,fly:1}, armored:{skin:'#9aa5b5',shirt:'#5a6070',acc:'helm',tint:'#9aa5b5',sz:1.3},
  ghost:{skin:'#cfe',shirt:'#9ab',tint:'#c8f0ff',ghost:1,fly:1}, bomber:{skin:'#d8603a',shirt:'#5a1a1a',acc:'bomb',tint:'#ff5a00'}, healer:{skin:'#5a8',shirt:'#2a4',acc:'staff',tint:'#40ff80'} };
const ETYPES={}; const DM=(root.DESIGN&&root.DESIGN.monsters)||[{key:'zombie',name:'殭屍',baseHp:30,speed:1.2,contactKill:0.15,spawnWeight:40,fromStage:1}];
const base=DM.find(m=>m.key==='zombie')||DM[0];
for(const m of DM){ const L=LOOK[m.key]||LOOK.zombie; ETYPES[m.key]=Object.assign({name:m.name,hp:m.baseHp/base.baseHp,sp:m.speed/base.speed,contact:Math.min(3,m.contactKill/base.contactKill),weight:m.spawnWeight,from:m.fromStage,trait:m.trait,sz:1},L); }
ETYPES.basic=ETYPES.zombie;
// v0.4 特殊怪物（design-v3.json 沒有，這裡補上；數值以基本殭屍為 1）
Object.assign(ETYPES,{
 crawler:{name:'爬行屍',hp:0.8,sp:0.55,sz:0.75,weight:8,from:2,tint:'#6a5a3a',crawl:1},
 leaper:{name:'跳躍屍',hp:0.7,sp:1.5,sz:0.9,weight:6,from:4,tint:'#ffaa00',leap:1},
 gold:{name:'黃金寶藏屍',hp:3,sp:1.3,sz:1.1,weight:0.25,from:3,tint:'#ffd23f',tag:1,gold:1,glow:'#ffd23f'},
 elite:{name:'精英指揮官',hp:6,sp:0.8,sz:1.35,weight:1.5,from:6,tint:'#ff2bd6',tag:1,acc:'helm',elite:1,glow:'#ff2bd6'},
 carrier:{name:'背屍巨人',hp:9,sp:0.45,sz:2.0,weight:1,from:8,tint:'#7a5a3a',tag:1,fat:1,carrier:1},
 teleghost:{name:'瞬移幽靈',hp:1.5,sp:0.8,sz:1,weight:2,from:10,tint:'#b080ff',tag:1,ghost:1,fly:1,tele:1,glow:'#b080ff'},
 bull:{name:'衝鋒蠻牛',hp:4,sp:0.9,sz:1.4,weight:2,from:7,tint:'#c0392b',tag:1,acc:'horns',bull:1},
 summoner:{name:'召喚師',hp:3,sp:0.6,sz:1.15,weight:1.2,from:9,tint:'#40a0ff',tag:1,acc:'staff',summon:1,glow:'#40a0ff'} });
if(ETYPES.healer){ ETYPES.healer.tag=1; ETYPES.healer.glow='#40ff80'; }
// Kenney 平台怪物圖集（CC0）
let ATL=null; const ATI=new Image(); ATI.src='assets/atlas/enemies.png'; try{ fetch('assets/atlas/enemies.json').then(r=>r.json()).then(j=>ATL=j.frames).catch(()=>{}); }catch(e){}
function zombieSprite(kind,frame,state){ frame=(((frame|0)%4)+4)%4; const T0=ETYPES[kind]||ETYPES.zombie;
  if(T0.atlas){ if(!ATL||!ATI.complete||!ATI.naturalWidth) return zombieSprite('zombie',frame,state); const f=ATL[T0.atlas[frame%2]]; if(!f) return zombieSprite('zombie',frame,state); const kk='A'+kind+frame%2+(state||''); if(ZS[kk]) return ZS[kk];
    const c=document.createElement('canvas'); c.width=48; c.height=72; const g=c.getContext('2d'); const F=f.frame; g.drawImage(ATI,F.x,F.y,F.w,F.h,0,72-48,48,48); if(state==='frozen'){ g.globalCompositeOperation='source-atop'; g.globalAlpha=0.5; g.fillStyle='#9fe8ff'; g.fillRect(0,0,48,72);} return ZS[kk]=c; }
  const kw=ZW[frame]; const useK=T0.acc!=='bat'&&kw.complete&&kw.naturalWidth>0; const k=kind+frame+(state||'')+(useK?'K':''); if(ZS[k]) return ZS[k]; const T=ETYPES[kind]||ETYPES.basic; const c=document.createElement('canvas'); c.width=48; c.height=72; const g=c.getContext('2d');
  if(useK){ const fat=!!T.fat; const w=fat?48:Math.min(48,kw.naturalWidth*72/kw.naturalHeight), h=72; g.drawImage(kw,(48-w)/2,0,w,h);
    const tintC=T.tint||(state==='frozen'?'#9fe8ff':state==='burn'?'#ff8a1f':state==='cos'?'#c45ad8':null);
    if(state==='frozen') { g.globalCompositeOperation='source-atop'; g.globalAlpha=0.55; g.fillStyle='#9fe8ff'; g.fillRect(0,0,48,72); }
    else if(tintC){ g.globalCompositeOperation='source-atop'; g.globalAlpha=0.38; g.fillStyle=tintC; g.fillRect(0,0,48,72); }
    g.globalCompositeOperation='source-over'; g.globalAlpha=1; drawAcc(g,T,frame%2); return ZS[k]=c; }
  let skin=T.skin, shirt=T.shirt; if(state==='frozen'){ skin='#bff4ff'; shirt='#5a8ab0'; } if(state==='burn'){ skin='#e0903a'; } if(state==='cos'){ skin='#c45ad8'; shirt='#4a1a5a'; }
  const sw=frame?5:-5; g.lineCap='round';
  if(T.acc==='bat'){ g.fillStyle=skin; g.beginPath(); g.ellipse(24,36,8,10,0,0,7); g.fill(); const wy=frame?24:42; g.beginPath(); g.moveTo(18,34); g.quadraticCurveTo(4,wy-6,0,wy); g.lineTo(10,wy-2); g.lineTo(16,40); g.moveTo(30,34); g.quadraticCurveTo(44,wy-6,48,wy); g.lineTo(38,wy-2); g.lineTo(32,40); g.fill();
    g.fillStyle='#ff3030'; g.fillRect(19,31,3,3); g.fillRect(26,31,3,3); return ZS[k]=c; }
  const fat=!!T.fat;
  g.strokeStyle='#3a3a4a'; g.lineWidth=fat?9:6; g.beginPath(); g.moveTo(20,50); g.lineTo(18+sw*0.6,70); g.moveTo(28,50); g.lineTo(30-sw*0.6,70); g.stroke();
  g.fillStyle=shirt; g.beginPath(); if(fat){ g.ellipse(24,40,17,15,0,0,7); } else { g.moveTo(13,28); g.lineTo(35,28); g.lineTo(36,52); g.lineTo(30,49); g.lineTo(25,53); g.lineTo(19,49); g.lineTo(12,52); g.closePath(); } g.fill();
  g.strokeStyle=skin; g.lineWidth=5.5; g.beginPath(); g.moveTo(15,32); g.lineTo(4+sw*0.3,36); g.moveTo(33,32); g.lineTo(44-sw*0.3,35); g.stroke();
  g.fillStyle=skin; g.beginPath(); g.ellipse(24,17,10,11,0.15,0,7); g.fill();
  g.fillStyle='#ff3030'; g.beginPath(); g.arc(20,15,2.4,0,7); g.arc(28.5,16,2.4,0,7); g.fill();
  g.fillStyle='#2a1a1a'; g.fillRect(19,22,10,3); g.fillStyle='#fff'; g.fillRect(20,22,2,2); g.fillRect(25,22,2,2);
  if(T.acc==='helm'){ g.fillStyle='#c8d0dc'; g.beginPath(); g.arc(24,14,11,Math.PI,0); g.fill(); g.fillRect(13,14,22,3); g.fillStyle='#9aa5b5'; g.fillRect(14,28,20,16); g.strokeStyle='#ddd'; g.lineWidth=2; g.strokeRect(14,28,20,16); }
  if(T.acc==='shield'){ g.fillStyle='#8a5a2a'; g.fillRect(4,24,16,28); g.strokeStyle='#d0d0d0'; g.lineWidth=2.5; g.strokeRect(4,24,16,28); g.beginPath(); g.moveTo(12,26); g.lineTo(12,50); g.stroke(); }
  if(T.acc==='bomb'){ g.fillStyle='#222'; g.beginPath(); g.arc(24,40,8,0,7); g.fill(); g.fillStyle=frame?'#ffea00':'#ff5a00'; g.beginPath(); g.arc(30,31,3,0,7); g.fill(); }
  if(T.acc==='acid'){ g.fillStyle='#7dff6a'; g.beginPath(); g.ellipse(24,26,4,frame?5:3,0,0,7); g.fill(); g.fillStyle='#2a6a4a'; g.beginPath(); g.ellipse(24,8,9,4,0,0,7); g.fill(); }
  if(T.acc==='staff'){ g.strokeStyle='#8a5a2a'; g.lineWidth=3; g.beginPath(); g.moveTo(42,10); g.lineTo(40,64); g.stroke(); g.fillStyle='#40ff80'; g.beginPath(); g.arc(42,9,5,0,7); g.fill(); }
  if(T.acc==='bones'){ g.strokeStyle='#555'; g.lineWidth=1.5; for(let y=30;y<48;y+=5){ g.beginPath(); g.moveTo(16,y); g.lineTo(32,y); g.stroke(); } }
  if(T.acc==='horns'){ g.fillStyle='#f0e0c0'; g.beginPath(); g.moveTo(14,10); g.lineTo(4,2); g.lineTo(16,6); g.moveTo(34,10); g.lineTo(44,2); g.lineTo(32,6); g.fill(); }
  if(T.acc==='split'){ g.strokeStyle='#ffd0ff'; g.lineWidth=2; g.beginPath(); g.moveTo(24,6); g.lineTo(24,52); g.stroke(); }
  return ZS[k]=c; }
function drawAcc(g,T,frame){
  if(T.acc==='helm'){ g.fillStyle='#c8d0dc'; g.beginPath(); g.arc(24,13,12,Math.PI,0); g.fill(); g.fillRect(12,13,24,4); }
  if(T.acc==='shield'){ g.fillStyle='#8a5a2a'; g.fillRect(2,26,18,30); g.strokeStyle='#e0e0e0'; g.lineWidth=3; g.strokeRect(2,26,18,30); g.beginPath(); g.moveTo(11,28); g.lineTo(11,54); g.stroke(); }
  if(T.acc==='bomb'){ g.fillStyle='#222'; g.beginPath(); g.arc(24,42,9,0,7); g.fill(); g.fillStyle=frame?'#ffea00':'#ff5a00'; g.beginPath(); g.arc(31,32,3.5,0,7); g.fill(); }
  if(T.acc==='acid'){ g.fillStyle='#7dff6a'; g.beginPath(); g.ellipse(24,26,5,frame?6:3,0,0,7); g.fill(); }
  if(T.acc==='staff'){ g.strokeStyle='#8a5a2a'; g.lineWidth=3; g.beginPath(); g.moveTo(42,10); g.lineTo(40,64); g.stroke(); g.fillStyle='#40ff80'; g.beginPath(); g.arc(42,9,5,0,7); g.fill(); }
  if(T.acc==='bones'){ g.strokeStyle='#555'; g.lineWidth=1.5; for(let y=30;y<48;y+=5){ g.beginPath(); g.moveTo(16,y); g.lineTo(32,y); g.stroke(); } }
  if(T.acc==='split'){ g.strokeStyle='#ffd0ff'; g.lineWidth=2.5; g.beginPath(); g.moveTo(24,4); g.lineTo(24,60); g.stroke(); } }
let LOD=0; // v0.5：大量敵人時遠處用便宜繪製（0=全部細節；越大越早降級）
function drawZombieFar(u,t,T){ const p=proj(u.z,u.x,0); const h=84*p.s*D*(u.big||1)*T.sz, w=h*0.66; if(h<6*D){ ctx.fillStyle=u.hitT>0?'#fff':(T.tint||'#5f9a3a'); ctx.fillRect(p.x-w/2,p.y-h,w,h); return p; }
  const im=zombieSprite(u.type||'basic',(Math.floor(t*7+u.ph)%4),u.frozen>0?'frozen':''); ctx.drawImage(im,p.x-w/2,p.y-h,w,h); return p; }
// v0.6.4：護盾衝鋒屍——金色護盾泡泡＋前衝箭頭
function drawCharger(u,t){ const p=proj(u.z,u.x,0); const h=Math.max(16*D,84*p.s*D*(u.big||1)), w=h*0.75; ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.55+0.25*Math.sin(t*10+u.ph); ctx.fillStyle='rgba(255,210,63,0.18)'; ctx.strokeStyle='#ffd23f'; ctx.lineWidth=Math.max(1.5*D,h*0.05); ctx.beginPath(); ctx.ellipse(p.x,p.y-h*0.5,w*0.6,h*0.62,0,0,7); ctx.fill(); ctx.stroke(); ctx.globalAlpha=0.9; ctx.fillStyle='#ffd23f'; const a=h*0.16; ctx.beginPath(); ctx.moveTo(p.x,p.y+a*1.4); ctx.lineTo(p.x-a,p.y+a*0.4); ctx.lineTo(p.x+a,p.y+a*0.4); ctx.fill(); ctx.restore(); }
function tintSpr(im,col){ const c0=im._tn||(im._tn={}); if(c0[col]) return c0[col]; const c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const g=c.getContext('2d'); g.drawImage(im,0,0); g.globalCompositeOperation='source-atop'; g.globalAlpha=0.7; g.fillStyle=col; g.fillRect(0,0,c.width,c.height); return c0[col]=c; }
function drawZombie(u,t){ const T=ETYPES[u.type]||ETYPES.basic; if(LOD&&!T.tag){ const far=getG().z; if(u.z-far>(LOD>1?14:26)) return drawZombieFar(u,t,T); } const p=proj(u.z,u.x,T.fly?0.9+0.15*Math.sin(t*8+u.ph):T.leap?Math.abs(Math.sin(t*3+u.ph))*0.9:0); if(T.ghost&&u.invis>0) ctx.globalAlpha=0.25; else if(T.ghost) ctx.globalAlpha=0.75; const st=u.frozen>0?'frozen':u.burn>0?'burn':u.cos?'cos':'';
  const im=zombieSprite(u.type||'basic',(Math.floor(t*7+u.ph)%4),st); const h=84*p.s*D*(u.big||1)*T.sz*(T.crawl?0.6:1), w=h*0.66*(T.crawl?1.5:1);
  if(T.glow){ ctx.globalCompositeOperation='lighter'; spr('light_02',T.glow,p.x,p.y-h*0.5,Math.max(40*D,h*1.6),0.55); ctx.globalCompositeOperation='source-over'; }
  const sh=u.stun>0?(Math.random()-0.5)*4*D:0; ctx.drawImage(im,p.x-w/2+sh,p.y-h,w,h); ctx.globalAlpha=1;
  // 狀態效果：中毒(綠)、緩速(藍)、冰凍(冰塊)、麻痺(電火花)
  if(u.poison>0){ ctx.globalCompositeOperation='lighter'; spr('smoke_04','#5aff4a',p.x,p.y-h*0.5,h*0.9,0.45); ctx.globalCompositeOperation='source-over'; }
  if(u.slow>0&&!(u.frozen>0)){ ctx.strokeStyle='#4fa8ff'; ctx.lineWidth=2*D; ctx.beginPath(); ctx.ellipse(p.x,p.y,w*0.6,w*0.2,0,0,7); ctx.stroke(); }
  if(u.frozen>0){ ctx.fillStyle='rgba(170,230,255,0.45)'; ctx.strokeStyle='#e8fbff'; ctx.lineWidth=1.5*D; ctx.fillRect(p.x-w*0.6,p.y-h*1.02,w*1.2,h*1.04); ctx.strokeRect(p.x-w*0.6,p.y-h*1.02,w*1.2,h*1.04); }
  if(u.stun>0){ ctx.globalCompositeOperation='lighter'; spr('spark_04','#fff36b',p.x+(Math.random()-0.5)*w,p.y-h*(0.4+Math.random()*0.6),Math.max(14*D,h*0.5),0.9,Math.random()*6); ctx.globalCompositeOperation='source-over'; }
  if(u.hitT>0){ ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=Math.min(1,u.hitT*8); ctx.drawImage(im,p.x-w/2,p.y-h,w,h); ctx.drawImage(im,p.x-w/2,p.y-h,w,h); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; }
  if(u.tcU>t){ /* v0.7.5：被武器打中 → 短暫染成該武器的顏色（冰錐＝藍霜、毒＝綠…） */ ctx.globalAlpha=Math.min(1,(u.tcU-t)*6)*0.8; ctx.drawImage(tintSpr(im,u.tc),p.x-w/2,p.y-h,w,h); ctx.globalAlpha=1; }
  if(u.burn>0) spr('flame_03','#ff8a1f',p.x,p.y-h*0.9,h*0.6,0.85);
  if(T.tag&&p.s>(LOD?0.38:0.2)){ ctx.font=`900 ${Math.max(10*D,15*p.s*D)}px sans-serif`; ctx.textAlign='center'; ctx.lineWidth=3*D; ctx.strokeStyle='#000c'; const ty=p.y-h-12*D; ctx.strokeText(T.name,p.x,ty); ctx.fillStyle=T.glow||'#fff'; ctx.fillText(T.name,p.x,ty); }
  // 血條：較大的敵人或已受傷者顯示
  if(u.maxHp&&(T.hp>=2||u.hp<u.maxHp)&&p.s>(LOD>1?0.45:0.25)){ const bw=Math.max(14*D,w*0.9), bh=Math.max(2*D,4*p.s*D), y=p.y-h-bh-2*D; ctx.fillStyle='#000a'; ctx.fillRect(p.x-bw/2,y,bw,bh); ctx.fillStyle=T.hp>=2?'#ff4040':'#ffb020'; ctx.fillRect(p.x-bw/2,y,bw*Math.max(0,u.hp/u.maxHp),bh); }
  return p; }
// ---------- 武器識別色（v0.7.5 VFX：HUD 色塊、傷害數字、特效共用；每把武器一個獨特色相）----------
const VCOL={fireball:'#ff8a1a',ice:'#8ff0ff',lightning:'#f4ff3a',arcane:'#b44dff',poison:'#6ee03a',laser:'#ff3fb0',meteor:'#ff3a1e',tornado:'#b8d8e8',boomerang:'#2ee69a',saw:'#d0d6de',holy:'#ffd23a',shock:'#e0b070',missile:'#4d8cff',blackhole:'#6a3dff'};
function wcol(id){ const A=root.Abil, w=A&&A.WEAPONS[id]; return w?VCOL[w.vis]:'#ffffff'; }
// 視覺用範圍（與 game.js castWeapons 的 areaR 相同：x 車道單位、z 公尺）；只用來畫預警圈/雲/地面環
const AR={fireball:[0.35,5],meteor:[0.7,8],poison:[0.5,6],blackhole:[0.9,10],shock:[1.1,12],holy:[0.25,4],tornado:[0.35,14],ice:[0.3,4]};
for(const k in AR) AR[k][1]=Math.min(AR[k][1],AR[k][0]*8); // 視覺深度上限：透視下 z 範圍太長會變成直立的橢圓，看不出是地面圈
// 快取的光暈貼圖（避免每幀 createRadialGradient）
const GLW={}; function glow(col){ let c=GLW[col]; if(c) return c; c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); const gr=g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,col); gr.addColorStop(0.3,col+'b0'); gr.addColorStop(1,col+'00'); g.fillStyle=gr; g.fillRect(0,0,64,64); return GLW[col]=c; }
function gl(col,x,y,r,a){ if(a<=0||r<=0) return; ctx.globalAlpha=Math.min(1,a); ctx.drawImage(glow(col),x-r,y-r,r*2,r*2); ctx.globalAlpha=1; }
let PILLAR=null; function pillarTex(){ if(PILLAR) return PILLAR; const c=document.createElement('canvas'); c.width=48; c.height=8; const g=c.getContext('2d'); const gr=g.createLinearGradient(0,0,48,0); gr.addColorStop(0,'rgba(255,200,40,0)'); gr.addColorStop(0.25,'rgba(255,200,40,0.75)'); gr.addColorStop(0.45,'rgba(255,250,210,1)'); gr.addColorStop(0.55,'rgba(255,255,255,1)'); gr.addColorStop(0.75,'rgba(255,200,40,0.75)'); gr.addColorStop(1,'rgba(255,200,40,0)'); g.fillStyle=gr; g.fillRect(0,0,48,8); return PILLAR=c; }
// 地面橢圓：世界範圍 (rx 車道, rz 公尺) → 螢幕橢圓
function gE(x,z,rx,rz,h){ const p=proj(z,x,h||0), a=proj(z-rz,x,h||0), b=proj(z+rz,x,h||0); const r=Math.abs(proj(z,x+rx,h||0).x-p.x); return {x:p.x,y:(a.y+b.y)/2,rx:Math.max(4,r),ry:Math.max(2,Math.abs(a.y-b.y)/2),s:p.s}; }
function ell(E,k){ ctx.beginPath(); ctx.ellipse(E.x,E.y,E.rx*(k||1),E.ry*(k||1),0,0,7); }
// ---------- 粒子池（武器特效專用；硬上限，敵人多時自動降）----------
const MAXP=220; let PCAP=MAXP; const parts=[], ppool=[];
function P(k,x,z,h,vx,vz,vh,life,sz,col,g){ if(parts.length>=PCAP) return null; const p=ppool.pop()||{}; p.k=k; p.x=x; p.z=z; p.h=h; p.vx=vx; p.vz=vz; p.vh=vh; p.life=p.max=life; p.sz=sz; p.col=col; p.g=g||0; p.rot=Math.random()*6.28; p.vr=(Math.random()-0.5)*12; p.cx=undefined; parts.push(p); return p; }
const R_=(a)=>(Math.random()-0.5)*2*(a||1);
function updParts(dt){ for(let i=parts.length-1;i>=0;i--){ const p=parts[i]; p.life-=dt; if(p.life<=0){ parts[i]=parts[parts.length-1]; parts.pop(); ppool.push(p); continue; }
  if(p.cx!==undefined){ p.ang+=dt*(5+3/(0.3+p.rad)); p.rad*=Math.max(0,1-dt*2.6); p.x=p.cx+Math.cos(p.ang)*p.rad*p.ax; p.z=p.cz+Math.sin(p.ang)*p.rad*p.az; continue; }
  p.x+=p.vx*dt; p.z+=p.vz*dt; p.h+=p.vh*dt; p.vh-=p.g*dt; if(p.h<0){ p.h=0; p.vh*=-0.35; p.vx*=0.6; p.vz*=0.6; } p.rot+=p.vr*dt; } }
function star4(x,y,r){ ctx.beginPath(); ctx.moveTo(x,y-r); ctx.lineTo(x+r*0.28,y-r*0.28); ctx.lineTo(x+r,y); ctx.lineTo(x+r*0.28,y+r*0.28); ctx.lineTo(x,y+r); ctx.lineTo(x-r*0.28,y+r*0.28); ctx.lineTo(x-r,y); ctx.lineTo(x-r*0.28,y-r*0.28); ctx.closePath(); }
function drawParts(){ ctx.globalCompositeOperation='source-over';
  for(const p of parts){ const q=proj(p.z,p.x,p.h); if(q.d<-2) continue; const a=p.life/p.max, S=q.s*D; const s=Math.max(1.6*D,p.sz*S);
    switch(p.k){
    case 'spark': { ctx.strokeStyle=p.col; ctx.globalAlpha=a; ctx.lineWidth=Math.max(1.5*D,s*0.35); const L=s*1.8; ctx.beginPath(); ctx.moveTo(q.x,q.y); ctx.lineTo(q.x-Math.cos(p.rot)*L,q.y-Math.sin(p.rot)*L); ctx.stroke(); break; }
    case 'shard': { ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(p.rot); ctx.globalAlpha=Math.min(1,a*1.5); ctx.fillStyle=p.col; ctx.strokeStyle='#1a5a90'; ctx.lineWidth=Math.max(1,0.9*D); ctx.beginPath(); ctx.moveTo(s,0); ctx.lineTo(-s*0.6,-s*0.45); ctx.lineTo(-s*0.4,s*0.5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); break; }
    case 'smoke': gl(p.col,q.x,q.y,s*(1+(1-a)*1.6),a*0.55); break;
    case 'dust': gl(p.col,q.x,q.y,s*(1+(1-a)*2),a*0.5); break;
    case 'flash': gl(p.col,q.x,q.y,s*(0.6+(1-a)*1.2),a); break;
    case 'ember': gl(p.col,q.x,q.y,s*1.6,a*0.7); ctx.globalAlpha=a; ctx.fillStyle='#fff6c0'; ctx.fillRect(q.x-s*0.25,q.y-s*0.25,s*0.5,s*0.5); break;
    case 'bubble': { const r=s*(0.6+0.4*(1-a)); ctx.globalAlpha=Math.min(1,a*2)*0.9; ctx.fillStyle=p.col+'66'; ctx.strokeStyle='#1f6a10'; ctx.lineWidth=Math.max(1,1.2*D); ctx.beginPath(); ctx.arc(q.x,q.y,r,0,7); ctx.fill(); ctx.stroke(); ctx.fillStyle='#e8ffd8'; ctx.beginPath(); ctx.arc(q.x-r*0.35,q.y-r*0.35,r*0.25,0,7); ctx.fill(); break; }
    case 'star': { ctx.globalAlpha=a; gl(p.col,q.x,q.y,s*1.8,a*0.6); ctx.fillStyle='#ffffff'; star4(q.x,q.y,s*(0.5+0.5*a)); ctx.fill(); break; }
    case 'debris': { ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(p.rot); ctx.globalAlpha=Math.min(1,a*2); ctx.fillStyle=p.col; ctx.strokeStyle='#2a1a10'; ctx.lineWidth=Math.max(1,D); ctx.fillRect(-s*0.5,-s*0.4,s,s*0.8); ctx.strokeRect(-s*0.5,-s*0.4,s,s*0.8); ctx.restore(); break; }
    case 'pull': { ctx.globalAlpha=Math.min(1,a*2); ctx.fillStyle=p.col; ctx.beginPath(); ctx.arc(q.x,q.y,s*0.5,0,7); ctx.fill(); break; }
    case 'ring': { const E=gE(p.x,p.z,p.sz*(1-a*0.85+0.15),p.sz*9*(1-a*0.85+0.15),p.h); ctx.globalAlpha=a; ctx.strokeStyle=p.col; ctx.lineWidth=Math.max(2*D,5*E.s*D*a); ell(E); ctx.stroke(); break; }
    case 'slash': { ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(p.rot*0.2); ctx.globalAlpha=a; ctx.strokeStyle='#ffffff'; ctx.lineWidth=Math.max(2*D,s*0.25); ctx.beginPath(); ctx.arc(0,0,s*1.6,-1.2,1.2*(1.4-a)); ctx.stroke(); ctx.strokeStyle=p.col; ctx.lineWidth=Math.max(1.2*D,s*0.12); ctx.stroke(); ctx.restore(); break; }
    } }
  ctx.globalAlpha=1; }
// ---------- 地面印記（焦痕、霜地、隕石坑、毒沼、聖印、震裂）：畫在殭屍底下，上限 24 ----------
const decals=[];
function decal(k,x,z,rx,rz,dur){ if(decals.length>=24) decals.shift(); decals.push({k,x,z,rx,rz,t:0,dur:dur||2}); }
function drawDecals(dt){ if(!ctx) return; for(let i=decals.length-1;i>=0;i--){ const d=decals[i]; if(d.t>=d.dur){ decals.splice(i,1); continue; } }
  for(const d of decals){ const a=Math.min(1,(1-d.t/d.dur)*2), E=gE(d.x,d.z,d.rx,d.rz); if(E.s<0.05) continue;
    switch(d.k){
    case 'scorch': ctx.globalAlpha=0.55*a; ctx.fillStyle='#1a0e08'; ell(E); ctx.fill(); ctx.globalAlpha=0.6*a; ctx.strokeStyle='#ff6a1a'; ctx.lineWidth=2*D; ell(E,0.8); ctx.stroke(); break;
    case 'frost': ctx.globalAlpha=0.5*a; ctx.fillStyle='#d8f8ff'; ell(E); ctx.fill(); ctx.strokeStyle='#4fb8ff'; ctx.lineWidth=2*D; ell(E); ctx.stroke(); ctx.strokeStyle='#ffffff'; ctx.beginPath(); for(let j=0;j<6;j++){ const an=j/6*6.28+d.x*9; ctx.moveTo(E.x,E.y); ctx.lineTo(E.x+Math.cos(an)*E.rx*0.9,E.y+Math.sin(an)*E.ry*0.9); } ctx.stroke(); break;
    case 'crater': ctx.globalAlpha=0.65*a; ctx.fillStyle='#2a1408'; ell(E); ctx.fill(); ctx.globalAlpha=0.8*a; ctx.strokeStyle='#ff4a1a'; ctx.lineWidth=3*D; ell(E,0.7); ctx.stroke(); gl('#ff6a1a',E.x,E.y,E.rx*0.6,0.5*a); break;
    case 'toxic': ctx.globalAlpha=0.45*a; ctx.fillStyle='#3a9a1a'; ell(E); ctx.fill(); ctx.globalAlpha=0.5*a; ctx.fillStyle='#1f5a0a'; ell(E,0.6); ctx.fill(); break;
    case 'glyph': ctx.globalAlpha=0.85*a; ctx.strokeStyle='#ffd23a'; ctx.lineWidth=2.5*D; ell(E); ctx.stroke(); ell(E,0.7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(E.x-E.rx*0.7,E.y); ctx.lineTo(E.x+E.rx*0.7,E.y); ctx.moveTo(E.x,E.y-E.ry*0.7); ctx.lineTo(E.x,E.y+E.ry*0.7); ctx.stroke(); break;
    case 'crack': ctx.globalAlpha=0.7*a; ctx.strokeStyle='#4a2a10'; ctx.lineWidth=2.5*D; ctx.beginPath(); for(let j=0;j<10;j++){ const an=j/10*6.28+d.z, r1=0.25+0.15*Math.sin(j*3.1+d.z); ctx.moveTo(E.x+Math.cos(an)*E.rx*r1,E.y+Math.sin(an)*E.ry*r1); ctx.lineTo(E.x+Math.cos(an+0.12)*E.rx*0.65,E.y+Math.sin(an+0.12)*E.ry*0.65); ctx.lineTo(E.x+Math.cos(an-0.05)*E.rx,E.y+Math.sin(an-0.05)*E.ry); } ctx.stroke(); break;
    } }
  ctx.globalAlpha=1; }
// ---------- 共用造型（彈道版與 cast 版共用，確保同一把武器長得一樣）----------
function drawOrb(x,y,R,evo){ // 魔法飛彈：紫色發光球；進化＝粉金星形
  ctx.strokeStyle=evo?'#ff9af0':'#d9a0ff'; ctx.lineWidth=Math.max(1.5,R*0.14); ctx.globalAlpha=0.8; ctx.beginPath(); ctx.arc(x,y,R*(1.55+0.15*Math.sin(performance.now()/60)),0,7); ctx.stroke(); ctx.globalAlpha=1;
  gl(evo?'#ff7ae0':'#b44dff',x,y,R*3.2,0.85); ctx.fillStyle=evo?'#c040ff':'#7a1fd6'; ctx.strokeStyle='#2a0650'; ctx.lineWidth=Math.max(1.5,R*0.16);
  if(evo){ star4(x,y,R*1.5); ctx.fill(); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(x,y,R,0,7); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle='#f3dcff'; ctx.beginPath(); ctx.arc(x,y,R*0.48,0,7); ctx.fill(); ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(x-R*0.2,y-R*0.2,R*0.2,0,7); ctx.fill(); }
function drawRocket(x,y,R,ang,evo){ ctx.save(); ctx.translate(x,y); ctx.rotate(ang); gl('#ff9a3c',-R*1.6,0,R*1.6,0.9); ctx.fillStyle='#ffe066'; ctx.beginPath(); ctx.moveTo(-R*1.1,-R*0.3); ctx.lineTo(-R*2.2-Math.random()*R*0.6,0); ctx.lineTo(-R*1.1,R*0.3); ctx.fill();
  ctx.fillStyle=evo?'#ff4f4f':'#4d8cff'; ctx.strokeStyle='#101830'; ctx.lineWidth=Math.max(1.2,R*0.14); ctx.beginPath(); ctx.moveTo(R*1.3,0); ctx.lineTo(R*0.6,-R*0.38); ctx.lineTo(-R*1.1,-R*0.38); ctx.lineTo(-R*1.1,R*0.38); ctx.lineTo(R*0.6,R*0.38); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.moveTo(R*1.3,0); ctx.lineTo(R*0.6,-R*0.38); ctx.lineTo(R*0.6,R*0.38); ctx.closePath(); ctx.fill(); ctx.fillStyle='#202840'; ctx.beginPath(); ctx.moveTo(-R*0.6,-R*0.38); ctx.lineTo(-R*1.2,-R*0.85); ctx.lineTo(-R*1.1,-R*0.38); ctx.moveTo(-R*0.6,R*0.38); ctx.lineTo(-R*1.2,R*0.85); ctx.lineTo(-R*1.1,R*0.38); ctx.fill(); ctx.restore(); }
function drawBlade(x,y,R,rot,evo){ ctx.save(); ctx.translate(x,y); ctx.rotate(rot); gl(evo?'#fff2a0':'#2ee69a',0,0,R*2.2,0.55); ctx.fillStyle=evo?'#ffd84a':'#2ee69a'; ctx.strokeStyle=evo?'#6a4a00':'#0a4a2a'; ctx.lineWidth=Math.max(1.5,R*0.13);
  if(evo){ ctx.beginPath(); ctx.arc(0,0,R*1.25,0.3,Math.PI*2-0.3); ctx.arc(R*0.35,0,R*0.95,Math.PI*2-0.45,0.45,true); ctx.closePath(); ctx.fill(); ctx.stroke(); } // 月輪：新月刃
  else { ctx.beginPath(); ctx.moveTo(-R*1.2,-R*0.25); ctx.quadraticCurveTo(0,-R*0.9,R*1.2,-R*0.25); ctx.lineTo(R*0.2,R*0.15); ctx.lineTo(R*0.25,R*1.1); ctx.quadraticCurveTo(-R*0.5,R*0.2,-R*1.2,-R*0.25); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle='#ffffff'; ctx.lineWidth=Math.max(1,R*0.08); ctx.beginPath(); ctx.moveTo(-R,-R*0.32); ctx.quadraticCurveTo(0,-R*0.78,R,-R*0.32); ctx.stroke(); }
  ctx.restore(); }
function drawSaw(x,y,R,rot,evo){ ctx.save(); ctx.translate(x,y); ctx.rotate(rot); if(evo) gl('#ff3a1e',0,0,R*2.2,0.7); ctx.fillStyle=evo?'#ffb0a0':'#e8eef5'; ctx.strokeStyle='#30343a'; ctx.lineWidth=Math.max(1.2,R*0.1); ctx.beginPath(); const n=evo?16:12; for(let j=0;j<n;j++){ const a=j/n*6.283, a2=(j+0.5)/n*6.283; ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R); ctx.lineTo(Math.cos(a2)*R*0.72,Math.sin(a2)*R*0.72); } ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#6a7280'; ctx.beginPath(); ctx.arc(0,0,R*0.4,0,7); ctx.fill(); ctx.fillStyle='#30343a'; ctx.beginPath(); ctx.arc(0,0,R*0.15,0,7); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=Math.max(1,R*0.08); ctx.beginPath(); ctx.arc(0,0,R*0.6,-0.8,0.6); ctx.stroke(); ctx.restore(); }
function drawShard(x,y,L,ang,evo){ ctx.save(); ctx.translate(x,y); ctx.rotate(ang); gl('#8ff0ff',0,0,L*1.3,0.6); ctx.strokeStyle='rgba(120,220,255,0.6)'; ctx.lineWidth=L*0.2; ctx.beginPath(); ctx.moveTo(-L*0.6,0); ctx.lineTo(-L*2.4,0); ctx.stroke();
  ctx.fillStyle=evo?'#7fe8ff':'#5fd8ff'; ctx.strokeStyle='#0a3a7a'; ctx.lineWidth=Math.max(2,L*0.11); ctx.beginPath(); ctx.moveTo(L,0); ctx.lineTo(0,-L*0.26); ctx.lineTo(-L*0.75,0); ctx.lineTo(0,L*0.26); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.moveTo(L,0); ctx.lineTo(0,-L*0.26); ctx.lineTo(-L*0.2,0); ctx.closePath(); ctx.fill(); ctx.strokeStyle='#4fb8ff'; ctx.lineWidth=Math.max(1,L*0.05); ctx.beginPath(); ctx.moveTo(L*0.9,0); ctx.lineTo(-L*0.7,0); ctx.stroke(); ctx.restore(); }
function drawFireball(x,y,R,t,evo){ gl('#ff6a1a',x,y,R*3,0.8); spr('flame_03',evo?'#4fa8ff':'#ff5a1f',x,y,R*2.8,0.95,t*9); ctx.fillStyle=evo?'#bfe8ff':'#ffb020'; ctx.strokeStyle='#8a2a00'; ctx.lineWidth=Math.max(1.2,R*0.1); ctx.beginPath(); ctx.arc(x,y,R*0.85,0,7); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff8d0'; ctx.beginPath(); ctx.arc(x,y,R*0.45,0,7); ctx.fill(); }
// ---------- 命中特效（每把武器不同；彈道類由 collide 觸發）----------
function hitFx(kind,x,z,evo,miss){ const m=evo?1.6:1, n=miss?0.4:1;
  switch(kind){
  case 'arcane': P('flash',x,z,0.4,0,0,0,0.25,34*m,evo?'#ff7ae0':'#b44dff'); P('ring',x,z,0.3,0,0,0,0.3,0.22*m,'#c77dff'); for(let i=0;i<7*n;i++) P('star',x,z,0.4,R_(0.9),R_(6),2+Math.random()*3,0.45,7*m,evo?'#ffd0f0':'#c77dff',6); break;
  case 'missile': P('flash',x,z,0.3,0,0,0,0.25,46*m,'#ff9a3c'); for(let i=0;i<5*n;i++) P('ember',x,z,0.3,R_(0.8),R_(5),2+Math.random()*3,0.5,5,'#ff7a1f',8); for(let i=0;i<3*n;i++) P('smoke',x,z,0.4,R_(0.3),R_(2),0.8,0.8,22,'#6a6a6a'); break;
  case 'boomerang': P('slash',x,z,0.4,0,0,0,0.22,14*m,evo?'#ffd23a':'#2ee69a'); for(let i=0;i<4*n;i++) P('spark',x,z,0.4,R_(0.6),R_(4),1+Math.random()*2,0.25,6,evo?'#fff2a0':'#7dffc0',4); break;
  case 'saw': for(let i=0;i<6*n;i++){ const p=P('spark',x,z,0.3,R_(0.7),R_(5),1+Math.random()*3,0.25,6,'#fff6a0',6); if(p) p.vr=0; } P('slash',x,z,0.3,0,0,0,0.18,11*m,evo?'#ff5a3a':'#d0d6de'); break;
  default: P('flash',x,z,0.3,0,0,0,0.2,30,VCOL[kind]||'#ffffff'); }
}
// ---------- 子彈池 ----------
let BSZ=1; // 子彈粗細（依兵力，300 人以上越粗越亮）
let BID=1;
// v0.5：真實彈道。dmg/pierce/radius 由發射端帶入；命中只經 collide()，禁止發射當下扣血
function bullet(x,z,tx,tz,col,speed,onHit,h,opts){ if(bullets.length>=MAXB){ if(onHit) onHit(); return null; }
  opts=opts||{}; const b=pool.pop()||{}; const dx=tx-x, dz=tz-z, d=Math.max(0.01,Math.hypot(dx*12,dz));
  const sp=speed||(opts.speed)||70; b.id=BID++; b.x=x; b.z=z; b.vx=dx*12/d*sp; b.vz=dz/d*sp; /* v0.6.1 N1：x 以 ×12 正規化 */ b.speed=sp;
  b.life=opts.life!==undefined?opts.life:Math.min(1.2,d/sp); b.col=col||'#fff36b'; b.onHit=onHit||null; // onHit 僅視覺／舊相容，數值碰撞走 collide
  b.h=h===undefined?0.25:h; b.w=BSZ; b.dmg=opts.dmg||0; b.pierce=opts.pierce|0; b.radius=opts.radius||0.06;
  b.kind=opts.kind||'gun'; b.st=opts.st||null; b.hitSet=null; b.dead=0; b.homing=opts.homing||null; b.owner=opts.owner||'player';
  b.evo=!!opts.evo; b.lv=opts.lv||1; b.max=b.life; b.ret=0; b.em=0; if(b.tr) b.tr.length=0; else b.tr=[];
  /* v0.7.5 VFX：追蹤類一出膛先往側邊甩，再由追蹤拉回 → 弧線軌跡（只改飛行外觀，目標與傷害不變） */
  if(b.kind==='arcane'||b.kind==='missile'){ const an=(Math.random()<0.5?-1:1)*(b.kind==='arcane'?0.9+Math.random()*0.4:0.3+Math.random()*0.25), c=Math.cos(an), s=Math.sin(an), vx=b.vx; b.vx=vx*c-b.vz*s; b.vz=vx*s+b.vz*c; }
  bullets.push(b); return b; }
function fireGun(x,z,tx,tz,opt){ return bullet(x,z,tx,tz,opt.col||'#fff36b',opt.speed||85,null,0.25,opt); }
function updBullets(dt){ const G=getG&&getG(); for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i];
  if(b.homing&&b.homing()){ const t=b.homing(); if(t){ const dx=t.x-b.x, dz=t.z-b.z, d=Math.max(0.01,Math.hypot(dx*12,dz));
    const wantX=dx*12/d*b.speed, wantZ=dz/d*b.speed; const k=Math.min(1,dt*3); b.vx+= (wantX-b.vx)*k; b.vz+=(wantZ-b.vz)*k; } }
  /* 迴旋鏢：後半段飛回隊伍（穿透數不變、同一隻不重複命中） */ if(b.kind==='boomerang'&&G&&b.life<b.max*0.5){ const dx=G.x-b.x, dz=G.z+1-b.z, d=Math.max(0.01,Math.hypot(dx*12,dz)); const k=Math.min(1,dt*7); b.vx+=(dx*12/d*b.speed-b.vx)*k; b.vz+=(dz/d*b.speed-b.vz)*k; if(dz>-0.5) b.life=Math.min(b.life,0.02); }
  b.px=b.x; b.pz=b.z; b.x+=b.vx/12*dt; b.z+=b.vz*dt; b.life-=dt;
  if(b.kind!=='gun'){ const tr=b.tr; tr.push(b.x,b.z); if(tr.length>16) tr.splice(0,2); b.em+=dt;
    if(b.kind==='arcane'&&b.em>0.025){ b.em=0; P('star',b.x+R_(0.02),b.z,b.h+R_(0.1),R_(0.08),R_(1),0.4,0.4,b.evo?7:5,b.evo?'#ffb0f0':'#d9a0ff'); }
    else if(b.kind==='missile'&&b.em>0.03){ b.em=0; P('smoke',b.x,b.z,b.h,R_(0.04),-b.vz*0.04,0.5,0.8,16,'#505050'); }
    else if(b.kind==='saw'&&b.em>0.06){ b.em=0; const p=P('spark',b.x,b.z,b.h,R_(0.2),R_(2),1,0.18,4,'#fff6a0',3); if(p) p.vr=0; } }
  if(b.life<=0||Math.abs(b.x)>1.2||b.dead){ if(b.onHit&&!b.dead) b.onHit(); if(!b.dead&&(b.kind==='arcane'||b.kind==='missile')) hitFx(b.kind,b.x,b.z,b.evo,true); bullets[i]=bullets[bullets.length-1]; bullets.pop(); pool.push(b); } } }
// 空間網格（z 桶寬 2）＋圓形碰撞；回傳命中次數。dmgFn(target, bullet) 由遊戲端結算
function collide(units, boss, dmgFn){ if(!bullets.length) return 0;
  const BW=2, buckets={}; let hits=0;
  for(const u of units){ if(u.dead||u.invis>0) continue; const k=Math.floor(u.z/BW); (buckets[k]=buckets[k]||[]).push(u); }
  for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i]; if(!b.dmg||b.owner!=='player') continue;
    // 掃掠碰撞：本幀線段（上一位置 → 目前位置）與目標圓的最近距離，避免高速子彈穿過
    const ax=(b.px===undefined?b.x:b.px)*12, az=b.pz===undefined?b.z:b.pz, bx2=b.x*12, bz2=b.z, sx=bx2-ax, sz=bz2-az, sl=sx*sx+sz*sz||1e-9;
    const segD2=(ux,uz)=>{ const X=ux*12, k=Math.max(0,Math.min(1,((X-ax)*sx+(uz-az)*sz)/sl)); const dx=X-(ax+sx*k), dz=uz-(az+sz*k); return [dx*dx+dz*dz,k]; };
    const zlo=Math.floor(Math.min(az,bz2)/BW)-1, zhi=Math.floor(Math.max(az,bz2)/BW)+1; let hitU=null, bestK=2;
    for(let k=zlo;k<=zhi;k++){ const L=buckets[k]; if(!L) continue;
      for(const u of L){ if(b.hitSet&&b.hitSet.has(u)) continue; const rr=((u.hitR||0.18)+b.radius)*6; // 規格半徑（車道寬 1）→ 世界公尺
        const [d2,kk]=segD2(u.x,u.z); if(d2<=rr*rr){ const ke=kk-Math.sqrt(rr*rr-d2)/Math.sqrt(sl); if(ke<bestK){ bestK=ke; hitU=u; } } } } /* v0.6.2：依「進入圓的位置」排序，取路徑上最先碰到（最近）的殭屍，不會穿過較近的 */
    if(boss&&boss.hp>0&&!(b.hitSet&&b.hitSet.has(boss))){ const rr=((boss.hitR||0.55)+b.radius)*6; const [d2,kk]=segD2(boss.x||0,boss.z); if(d2<=rr*rr&&kk-Math.sqrt(rr*rr-d2)/Math.sqrt(sl)<bestK){ hitU=boss; } }
    if(hitU){ if(!b.hitSet) b.hitSet=new Set(); b.hitSet.add(hitU); const mul=Math.pow(0.85, Math.max(0,(b.hitSet.size-1)));
      dmgFn(hitU,b,b.dmg*mul); hits++; if(b.kind!=='gun') hitFx(b.kind,hitU.x!==undefined?hitU.x:b.x,hitU.z!==undefined?hitU.z:b.z,b.evo); /* v0.7.5：武器彈命中特效 */ b.pierce--; if(b.pierce<0){ b.dead=1; bullets[i]=bullets[bullets.length-1]; bullets.pop(); pool.push(b); } }
  } return hits; }
// 範圍查詢：圓內所有單位（給 AOE 武器用）
function inRadius(units,x,z,rx,rz){ const out=[]; for(const u of units) if(!u.dead&&Math.abs(u.x-x)<rx&&Math.abs(u.z-z)<rz) out.push(u); return out; }
function drawBullets(t){ // 基礎槍：批次（同顏色一次 stroke，維持樸素的黃色曳光）；武器彈：各自造型
  const by={}; let nw=0; for(const b of bullets){ if(b.kind==='gun') (by[b.col]=by[b.col]||[]).push(b); else nw++; }
  ctx.lineCap='round'; ctx.globalCompositeOperation='lighter';
  const w=BSZ;
  for(const col in by){ const L=by[col], seg=b=>{ const p=proj(b.z,b.x,b.h), q=proj(b.z-b.vz*0.05,b.x-b.vx/12*0.05,b.h); ctx.moveTo(q.x,q.y); ctx.lineTo(p.x,p.y); };
    ctx.strokeStyle=col; ctx.globalAlpha=0.35; ctx.lineWidth=9*D*w; ctx.beginPath(); L.forEach(seg); ctx.stroke(); // 外光暈
    ctx.globalAlpha=1; ctx.lineWidth=4*D*w; ctx.beginPath(); L.forEach(seg); ctx.stroke();
    ctx.fillStyle='#ffffff'; ctx.beginPath(); const r=2.6*D*w; for(const b of L){ const p=proj(b.z,b.x,b.h); ctx.moveTo(p.x+r,p.y); ctx.arc(p.x,p.y,r,0,7); } ctx.fill(); }
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  if(nw) for(const b of bullets) if(b.kind!=='gun') drawWBullet(b,t); }
function drawWBullet(b,t){ const p=proj(b.z,b.x,b.h); if(p.d<-1) return; const S=p.s*D, lk=1+0.04*((b.lv||1)-1), tr=b.tr, n=tr.length/2;
  let ang=0; if(n>=3){ const q=proj(tr[(n-3)*2+1],tr[(n-3)*2],b.h); ang=Math.atan2(p.y-q.y,p.x-q.x); } else { const q=proj(b.z-b.vz*0.03,b.x-b.vx/12*0.03,b.h); ang=Math.atan2(p.y-q.y,p.x-q.x); }
  switch(b.kind){
  case 'arcane': { const R=Math.max(13*D,22*S)*(b.evo?1.35:1)*lk; if(n>1){ ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle=b.evo?'#ff7ae0':'#9a3aff'; ctx.globalAlpha=0.55; ctx.lineWidth=R*0.9; ctx.beginPath(); for(let j=0;j<n;j++){ const q=proj(tr[j*2+1],tr[j*2],b.h); j?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y); } ctx.stroke(); ctx.strokeStyle='#f3dcff'; ctx.globalAlpha=0.8; ctx.lineWidth=R*0.3; ctx.stroke(); ctx.globalAlpha=1; }
    drawOrb(p.x,p.y,R,b.evo); break; }
  case 'missile': { const R=Math.max(10*D,17*S)*(b.evo?1.25:1)*lk; drawRocket(p.x,p.y,R,ang,b.evo); break; }
  case 'boomerang': { const R=Math.max(12*D,21*S)*(b.evo?1.45:1)*lk; for(let j=Math.max(0,n-7);j<n-1;j+=3){ const q=proj(tr[j*2+1],tr[j*2],b.h); ctx.globalAlpha=0.3; drawBlade(q.x,q.y,R*0.9,t*26-(n-j)*0.4,b.evo); } ctx.globalAlpha=1; drawBlade(p.x,p.y,R,t*26,b.evo); break; }
  case 'saw': { const R=Math.max(10*D,18*S)*(b.evo?1.35:1)*lk; ctx.globalAlpha=0.35; ctx.strokeStyle='#ffffff'; ctx.lineWidth=R*0.35; ctx.beginPath(); ctx.arc(p.x,p.y,R*1.15,ang+2.2,ang+4.1); ctx.stroke(); ctx.globalAlpha=1; drawSaw(p.x,p.y,R,t*30,b.evo); break; }
  default: { const R=Math.max(6*D,11*S); gl(b.col,p.x,p.y,R*2.4,0.8); ctx.fillStyle=b.col; ctx.beginPath(); ctx.arc(p.x,p.y,R*0.7,0,7); ctx.fill(); }
  } }
// ---------- 元素武器特效 ----------
// e: {type, t, dur, x,z (起點), tg:[{x,z,ref}], onHit, done, evo, seed}
// v0.7.5：dur/hitAt 調整只延長「命中後」的特效殘留；命中時間（dur×hitAt）與原本相同。黑洞原本 hitAt=1.2>1 → 永遠不觸發傷害（bug），改 0.75（=1.2 秒，原設計值）
const DUR={fireball:0.75,ice:0.55,lightning:0.4,arcane:0.6,poison:1.8,laser:0.55,meteor:1.0,tornado:1.6,boomerang:1.0,saw:0.35,holy:0.85,shock:0.6,missile:0.7,blackhole:1.6};
const HIT={fireball:0.6,ice:0.3/0.55,lightning:0.22/0.4,poison:0.5,tornado:0.6,boomerang:0.45,blackhole:0.75,laser:0.15,meteor:0.42,shock:0.3,holy:0.5/0.85};
function cast(type, from, tg, onHit, opt){ opt=opt||{}; if(effects.length>=MAXE){ if(onHit) onHit(); return; }
  effects.push({type,t:0,dur:DUR[type]||0.5,x:from.x,z:from.z,tg,onHit,done:false,evo:!!opt.evo,lv:opt.lvl||1,seed:Math.random()*100,hitAt:HIT[type]||1,em:0}); SFX.elem(type); }
const lerp=(a,b,k)=>a+(b-a)*k;
const fbPos=(e,g,k)=>({x:lerp(e.x,g.x,k),z:lerp(e.z,g.z,k),h:0.3+Math.sin(k*Math.PI)*0.8});
// 命中瞬間：每種武器自己的爆點（粒子＋地面印記）
function impact(e){ const m=e.evo?1.35:1, T=e.tg;
  switch(e.type){
  case 'fireball': for(const g of T.slice(0,4)){ decal('scorch',g.x,g.z,AR.fireball[0]*m*0.8,AR.fireball[1]*m*0.8,2.2); P('flash',g.x,g.z,0.4,0,0,0,0.3,90*m,'#ffb020'); for(let i=0;i<10*m;i++) P('ember',g.x,g.z,0.3,R_(0.8),R_(6),2+Math.random()*4,0.6,6,'#ff7a1a',9); for(let i=0;i<4;i++) P('smoke',g.x+R_(0.1),g.z+R_(1),0.6,R_(0.15),R_(1),0.8,1.0,30*m,'#4a3a30'); } break;
  case 'ice': for(const g of T.slice(0,5)){ decal('frost',g.x,g.z,AR.ice[0]*m,AR.ice[1]*m,1.6); P('ring',g.x,g.z,0.1,0,0,0,0.35,AR.ice[0]*m,'#e8fbff'); for(let i=0;i<10*m;i++) P('shard',g.x,g.z,0.5,R_(0.7),R_(6),2+Math.random()*3,0.6,8*m,Math.random()<0.5?'#bff4ff':'#ffffff',10); } break;
  case 'lightning': for(const g of T.slice(0,12)){ for(let i=0;i<4;i++){ const p=P('spark',g.x,g.z,0.4,R_(0.6),R_(5),R_(3),0.22,6,i%2?'#ffffff':'#f4ff3a'); if(p) p.vr=0; } P('flash',g.x,g.z,0.4,0,0,0,0.2,50,'#f4ff3a'); } break;
  case 'arcane': case 'missile': case 'boomerang': case 'saw': for(const g of T.slice(0,8)) hitFx(e.type,g.x,g.z,e.evo); break;
  case 'poison': { const g=T[0]; if(g) decal('toxic',g.x,g.z,AR.poison[0]*m,AR.poison[1]*m,1.6); break; }
  case 'meteor': { const g=T[0]; if(!g) break; decal('crater',g.x,g.z,AR.meteor[0]*m*0.8,AR.meteor[1]*m*0.8,3); for(let i=0;i<14*m;i++) P('debris',g.x+R_(0.1),g.z+R_(1),0.3,R_(1.2),R_(10),3+Math.random()*5,0.9,7*m,Math.random()<0.5?'#6a3a1a':'#8a5a2a',14); for(let i=0;i<12*m;i++) P('ember',g.x,g.z,0.3,R_(1),R_(8),3+Math.random()*5,0.7,7,'#ff5a1a',10); for(let i=0;i<6;i++) P('dust',g.x+R_(0.3),g.z+R_(3),0.2,R_(0.3),R_(2),0.6,1.0,40*m,'#a07050'); break; }
  case 'holy': for(const g of T.slice(0,5)){ decal('glyph',g.x,g.z,AR.holy[0]*m*1.6,AR.holy[1]*m*1.2,1.4); for(let i=0;i<8*m;i++) P('star',g.x+R_(0.15),g.z+R_(1.5),0.2,R_(0.1),R_(0.5),2+Math.random()*3,0.8,8,'#ffd23a',0); } break;
  case 'shock': { const g=T[0]; if(g) decal('crack',g.x,g.z,AR.shock[0]*m*0.6,AR.shock[1]*m*0.6,2); break; }
  case 'blackhole': { const g=T[0]; if(!g) break; P('flash',g.x,g.z,0.4,0,0,0,0.35,140*m,'#c8a8ff'); P('ring',g.x,g.z,0.3,0,0,0,0.4,AR.blackhole[0]*m,'#ffffff'); for(let i=0;i<14;i++) P('star',g.x,g.z,0.4,R_(1.2),R_(10),R_(3),0.5,7,'#b48cff'); break; }
  } }
// 飛行／持續期間的拖尾粒子（每種武器不同）
function emit(e,dt){ e.em+=dt; if(e.em<0.03) return; const st=e.em; e.em=0; const T=e.tg, m=e.evo?1.35:1, k=Math.min(1,e.t/(e.dur*e.hitAt));
  switch(e.type){
  case 'fireball': if(!e.done) for(const g of T.slice(0,4)){ const f=fbPos(e,g,k); P('smoke',f.x,f.z,f.h,R_(0.05),R_(0.5),0.6,0.6,e.evo?20:14,'#4a4038'); P('ember',f.x,f.z,f.h,R_(0.2),R_(2),R_(1),0.35,4,'#ffb020',2); } break;
  case 'ice': if(!e.done) for(const g of T.slice(0,5)){ const p=P('spark',lerp(e.x,g.x,k),lerp(e.z,g.z,k),0.3,R_(0.1),R_(1),0,0.2,4,'#ffffff'); if(p) p.vr=0; } break;
  case 'poison': { const g=T[0]; if(!g) break; for(let i=0;i<Math.ceil(st*(e.evo?40:26));i++) P('bubble',g.x+R_(AR.poison[0]*m*0.8),g.z+R_(AR.poison[1]*m*0.8),0.05,0,0,0.8+Math.random()*1.4,0.6+Math.random()*0.5,e.evo?9:7,Math.random()<0.3?'#c8ff6a':'#6ee03a'); break; }
  case 'laser': if(e.done&&e.t<e.dur*0.7) for(let i=0;i<3;i++){ const p=P('spark',e.x+R_(0.06),e.z+3+Math.random()*35,0.35,R_(0.5),R_(3),1+Math.random()*2,0.25,6,i%2?'#ffffff':'#ff7ad0',4); } break;
  case 'meteor': if(!e.done){ const g=T[0]; if(g){ const fall=k; P('ember',g.x+0.35*(1-fall),g.z,9*(1-fall),R_(0.1),R_(1),2,0.3,6,'#ff7a1a'); } } break;
  case 'tornado': { const g=T[0]||{x:e.x,z:e.z+20}, ph=e.t/e.dur, z=lerp(g.z-8,g.z+4,ph), x=g.x+Math.sin(e.t*4+e.seed)*0.15; P('debris',x+R_(0.15*m),z+R_(1.5),0.1,R_(0.6),R_(2),2+Math.random()*4,0.6,5,Math.random()<0.5?'#8a6a4a':'#6a8a5a',3); P('dust',x+R_(0.1),z,0.05,R_(0.3),R_(1),0.3,0.6,30*m,'#c8a070'); break; }
  case 'holy': for(const g of T.slice(0,5)) P('star',g.x+R_(0.12*m),g.z+R_(1),0.2+Math.random(),0,0,1.5+Math.random()*2,0.5,6,'#ffe680'); break;
  case 'shock': { const g=T[0]; if(!g) break; const ph=Math.min(1,e.t/e.dur*1.15); for(let i=0;i<4;i++){ const an=Math.random()*6.28; P('dust',g.x+Math.cos(an)*AR.shock[0]*m*ph,g.z+Math.sin(an)*AR.shock[1]*m*ph,0.1,0,0,0.4,0.5,26,'#c8a070'); } break; }
  case 'missile': if(!e.done) for(const [j,g] of T.slice(0,8).entries()){ const kk=Math.min(1,k*1.05), x=lerp(e.x+(j%2?0.3:-0.3),g.x,kk), z=lerp(e.z,g.z,kk), h=0.4+Math.sin(kk*Math.PI)*(1.2+j*0.1); P('smoke',x,z,h,R_(0.04),R_(0.5),0.4,0.5,9,'#7a7a7a'); } break;
  case 'arcane': if(!e.done) for(const [j,g] of T.slice(0,6).entries()){ const side=(j%2?1:-1)*(0.6+j*0.1); P('star',lerp(e.x,g.x,k)+Math.sin(k*Math.PI)*side*0.5,lerp(e.z,g.z,k),0.4+Math.sin(k*Math.PI)*0.6,R_(0.05),R_(0.5),0.3,0.35,5,'#d9a0ff'); } break;
  case 'blackhole': { const g=T[0]; if(!g||e.done) break; for(let i=0;i<Math.ceil(st*(e.evo?50:34));i++){ const p=P('pull',g.x,g.z,0.3,0,0,0,0.7,e.evo?6:4.5,['#b48cff','#ff7ae0','#ffffff'][i%3]); if(p){ p.cx=g.x; p.cz=g.z; p.ang=Math.random()*6.28; p.rad=1; p.ax=AR.blackhole[0]*m*1.2; p.az=AR.blackhole[1]*m*1.2; } } break; }
  } }
function updEffects(dt,burstFn){ for(let i=effects.length-1;i>=0;i--){ const e=effects[i]; e.t+=dt;
    if(!e.done && e.t>=e.dur*e.hitAt){ e.done=true; if(e.onHit) e.onHit(e.tg); if(e.type==='meteor') screenFlash('#ffb347',0.3); if(e.type==='blackhole') screenFlash('#5a2aa0',0.3); if(e.type==='shock') screenFlash('#ffd27a',0.18); impact(e); }
    emit(e,dt);
    if(e.type==='blackhole'&&!e.done) for(const g of e.tg){ if(g.ref&&!g.ref.dead){ g.ref.x+=(e.tg[0].x-g.ref.x)*dt*3; g.ref.z+=(e.tg[0].z-g.ref.z)*dt*3; } }
    if(e.t>=e.dur){ effects[i]=effects[effects.length-1]; effects.pop(); } } }
function drawEffects(t){ ctx.globalCompositeOperation='source-over';
  for(const e of effects){ const k=Math.min(1,e.t/(e.dur*e.hitAt)), T=e.tg, s0=proj(e.z,e.x,0.3), sz=(e.evo?1.5:1)*(1+0.06*(e.lv-1)), m=e.evo?1.35:1, hT=e.dur*e.hitAt, post=e.done?Math.min(1,(e.t-hT)/Math.max(0.01,e.dur-hT)):0;
    switch(e.type){
    case 'fireball': for(const g of T.slice(0,4)){ if(!e.done){ const f=fbPos(e,g,k), p=proj(f.z,f.x,f.h); drawFireball(p.x,p.y,Math.max(12*D,24*p.s*D)*sz,t,e.evo); }
        else { const E=gE(g.x,g.z,AR.fireball[0]*m,AR.fireball[1]*m); gl('#ff7a1a',E.x,E.y-E.ry*0.6,E.rx*(1.1+0.7*post),1-post); gl(e.evo?'#bfe8ff':'#ffe066',E.x,E.y-E.ry*0.5,E.rx*0.8*(1-post),1-post); ctx.globalAlpha=1-post; ctx.strokeStyle='#ff5a00'; ctx.lineWidth=4*D*(1-post)+1; ell(E,0.5+0.7*post); ctx.stroke(); ctx.globalAlpha=1; } } break;
    case 'ice': { const ns=e.evo?5:3; for(const g of T.slice(0,5)){ if(!e.done){ const gp=proj(g.z,g.x,0.3); for(let i=0;i<ns;i++){ const off=(i-(ns-1)/2)*0.07, x=lerp(e.x,g.x+off,k), z=lerp(e.z,g.z,k)+(i%2)*0.5, p=proj(z,x,0.35-0.1*k); drawShard(p.x,p.y,Math.max(22*D,40*p.s*D)*sz,Math.atan2(gp.y-s0.y,gp.x+off*40*D-s0.x),e.evo); } }
        else { const E=gE(g.x,g.z,AR.ice[0]*m,AR.ice[1]*m); gl('#8ff0ff',E.x,E.y-E.ry*0.5,E.rx*(1+post),0.9*(1-post)); ctx.globalAlpha=1-post; ctx.strokeStyle='#ffffff'; ctx.lineWidth=3*D; ell(E,0.6+0.6*post); ctx.stroke(); ctx.globalAlpha=1; } } break; }
    case 'lightning': { const la=e.done?1-post:1, fl=Math.floor(t*25), lw=(e.evo?6:3.5)*D; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.beginPath(); let a=s0; const pts=[];
        for(const g of T.slice(0,12)){ const b=proj(g.z,g.x,0.45); const n=7; ctx.moveTo(a.x,a.y); for(let j=1;j<=n;j++){ const jx=j<n?Math.sin(e.seed+j*7.3+fl*1.7)*16*D:0, jy=j<n?Math.cos(e.seed+j*5.1+fl*2.3)*10*D:0, xx=lerp(a.x,b.x,j/n)+jx, yy=lerp(a.y,b.y,j/n)+jy; ctx.lineTo(xx,yy);
            if(j===3||(e.evo&&j===5)){ const fa=Math.sin(e.seed*3+j+fl)*2.2; ctx.lineTo(xx+Math.cos(fa)*22*D,yy+Math.sin(fa)*18*D); ctx.moveTo(xx,yy); } } a=b; pts.push(b); }
        ctx.strokeStyle='#14145a'; ctx.globalAlpha=0.6*la; ctx.lineWidth=lw*2.6; ctx.stroke(); ctx.globalCompositeOperation='lighter'; ctx.strokeStyle=e.evo?'#c89aff':'#f4ff3a'; ctx.globalAlpha=0.7*la; ctx.lineWidth=lw*1.7; ctx.stroke(); ctx.strokeStyle='#ffffff'; ctx.globalAlpha=la; ctx.lineWidth=lw*0.6; ctx.stroke(); ctx.globalAlpha=1;
        for(const b of pts) gl('#f4ff3a',b.x,b.y,Math.max(16*D,36*b.s*D)*sz*0.6,la); gl('#f4ff3a',s0.x,s0.y,20*D,la); ctx.globalCompositeOperation='source-over'; } break;
    case 'arcane': if(!e.done) for(const [j,g] of T.slice(0,6).entries()){ const side=(j%2?1:-1)*(0.6+j*0.1); const x=lerp(e.x,g.x,k)+Math.sin(k*Math.PI)*side*0.5, z=lerp(e.z,g.z,k); const p=proj(z,x,0.4+Math.sin(k*Math.PI)*0.6); drawOrb(p.x,p.y,Math.max(13*D,22*p.s*D)*sz/1.2,e.evo); } break;
    case 'poison': { const g=T[0]; if(!g) break; const a=Math.min(1,e.t*3)*(1-Math.max(0,(e.t-e.dur*0.7)/(e.dur*0.3))), E=gE(g.x,g.z,AR.poison[0]*m,AR.poison[1]*m);
        ctx.globalAlpha=0.35*a; ctx.fillStyle=e.evo?'#2a6a10':'#4fbf2a'; ell(E,0.95); ctx.fill();
        for(let j=0;j<9;j++){ const an=e.seed+j*0.7+t*0.6*(j%2?1:-1), rr=0.25+0.5*((j*37)%10)/10, bx=E.x+Math.cos(an)*E.rx*rr*0.75, by=E.y+Math.sin(an)*E.ry*rr*0.75-E.ry*0.7, br=E.rx*(0.32+0.08*Math.sin(t*2+j));
          ctx.globalAlpha=0.3*a; ctx.fillStyle=j%3?(e.evo?'#3a8a1a':'#6ee03a'):'#a8ff5a'; ctx.beginPath(); ctx.arc(bx,by,br,0,7); ctx.fill(); }
        ctx.globalAlpha=0.75*a; ctx.strokeStyle='#2f8a16'; ctx.lineWidth=2.5*D; ell(E); ctx.stroke(); ctx.globalAlpha=1; } break;
    case 'laser': { const x0=e.x, z0=e.z+0.5, z1=e.z+60, hw=0.1*sz, al=e.done?1-Math.max(0,(e.t-e.dur*0.55)/(e.dur*0.45)):0.7;
        const quad=(w,h)=>{ const a=proj(z0,x0-w,h), b=proj(z0,x0+w,h), c=proj(z1,x0+w,h), d=proj(z1,x0-w,h); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.closePath(); };
        const mz=proj(z0,x0,0.35);
        if(!e.done){ ctx.globalAlpha=0.8; ctx.fillStyle='#ff3fb0'; quad(hw*0.15,0.35); ctx.fill(); gl('#ff3fb0',mz.x,mz.y,(20+60*k)*D,0.9); }
        else { ctx.globalAlpha=0.3*al; ctx.fillStyle='#ff3fb0'; quad(hw*2.6,0.35); ctx.fill(); ctx.globalAlpha=0.9*al; ctx.fillStyle='#ff3fb0'; quad(hw,0.35); ctx.fill(); ctx.strokeStyle='#7a0a4a'; ctx.lineWidth=1.5*D; ctx.stroke(); ctx.globalAlpha=al; ctx.fillStyle='#ffffff'; quad(hw*0.38,0.35); ctx.fill();
          if(e.evo){ ctx.strokeStyle='#ffd0f0'; ctx.lineWidth=2.5*D; for(const sg of [1,-1]){ ctx.beginPath(); for(let j=0;j<=24;j++){ const z=z0+(z1-z0)*j/24*j/24, q=proj(z,x0+Math.sin(j*0.9+t*20)*hw*1.8*sg,0.35+Math.cos(j*0.9+t*20)*0.15*sg); j?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y); } ctx.stroke(); } }
          gl('#ff3fb0',mz.x,mz.y,36*D*sz,al); gl('#ffffff',mz.x,mz.y,16*D*sz,al); }
        ctx.globalAlpha=1; } break;
    case 'meteor': { const g=T[0]; if(!g) break; const E=gE(g.x,g.z,AR.meteor[0]*m,AR.meteor[1]*m);
        if(!e.done){ const pul=0.5+0.5*Math.sin(t*30); ctx.globalAlpha=0.15+0.25*k; ctx.fillStyle='#ff2a1a'; ell(E); ctx.fill(); ctx.globalAlpha=0.65+0.35*pul; ctx.strokeStyle='#ff1a1a'; ctx.lineWidth=3*D; ctx.setLineDash([8*D,6*D]); ell(E); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle='#ffffff'; ctx.lineWidth=2*D; ell(E,Math.max(0.05,1-k)); ctx.stroke(); ctx.globalAlpha=1;
          const p=proj(g.z,g.x+0.35*(1-k),9*(1-k)), R=Math.max(12*D,26*p.s*D)*sz; for(let j=1;j<6;j++){ const q=proj(g.z,g.x+0.35*(1-k)+j*0.035,9*(1-k)+j*0.5); spr('flame_03','#ff6a1f',q.x,q.y,R*(2.4-j*0.3),0.75,t*6+j); }
          gl('#ff5a1a',p.x,p.y,R*2.6,0.9); ctx.fillStyle='#5a2a1a'; ctx.strokeStyle='#ffb020'; ctx.lineWidth=Math.max(2,R*0.15); ctx.beginPath(); ctx.arc(p.x,p.y,R,0,7); ctx.fill(); ctx.stroke(); ctx.fillStyle='#8a4a2a'; ctx.beginPath(); ctx.arc(p.x-R*0.3,p.y-R*0.25,R*0.3,0,7); ctx.fill(); }
        else { gl('#ffd27a',E.x,E.y-E.ry*0.6,E.rx*(0.9+0.6*post),1-post); ctx.globalAlpha=1-post; ctx.strokeStyle='#ffffff'; ctx.lineWidth=6*D*(1-post)+1; ell(E,0.4+post); ctx.stroke(); ctx.strokeStyle='#ff5a00'; ctx.lineWidth=3*D; ell(E,0.3+0.85*post); ctx.stroke(); ctx.globalAlpha=1; } } break;
    case 'tornado': { const g=T[0]||{x:e.x,z:e.z+20}, ph=e.t/e.dur, z=lerp(g.z-8,g.z+4,ph), x=g.x+Math.sin(e.t*4+e.seed)*0.15, fade=Math.min(1,e.t*5)*Math.min(1,(e.dur-e.t)*4), base=proj(z,x,0), S=Math.max(0.45,base.s)*D*sz;
        gl('#c8a070',base.x,base.y,60*S,0.5*fade); ctx.lineCap='round';
        for(let j=0;j<10;j++){ const q=proj(z,x+Math.sin(t*7+j*0.7)*0.05*j/10,j*0.42), rx=(5+j*j*0.7)*S+3*D, ry=rx*0.3;
          ctx.globalAlpha=0.45*fade; ctx.strokeStyle='#3a4a5a'; ctx.lineWidth=4.5*D; ctx.beginPath(); ctx.ellipse(q.x,q.y,rx,ry,0,0,7); ctx.stroke(); if(j%3===0){ ctx.globalAlpha=0.2*fade; ctx.fillStyle=e.evo?'#a8c8ff':'#dceaf4'; ctx.fill(); }
          ctx.globalAlpha=0.95*fade; ctx.strokeStyle=e.evo?'#e0ecff':'#f4fbff'; ctx.lineWidth=2.4*D; const sa=t*14*(e.evo?1.4:1)+j; ctx.beginPath(); ctx.ellipse(q.x,q.y,rx,ry,0,sa,sa+3.6); ctx.stroke(); }
        if(e.evo&&Math.sin(t*40)>0.3){ const a1=proj(z,x,4), a2=proj(z,x+0.1,1); ctx.globalAlpha=fade; ctx.strokeStyle='#f4ff3a'; ctx.lineWidth=2.5*D; ctx.beginPath(); ctx.moveTo(a1.x,a1.y); ctx.lineTo((a1.x+a2.x)/2+12*D,(a1.y+a2.y)/2); ctx.lineTo(a2.x,a2.y); ctx.stroke(); }
        ctx.globalAlpha=1; } break;
    case 'boomerang': { const ph=e.t/e.dur, out=ph<0.5?ph*2:2-ph*2; const z=e.z+out*45, x=e.x+Math.sin(ph*Math.PI*2)*0.5; const p=proj(z,x,0.4); drawBlade(p.x,p.y,Math.max(12*D,21*p.s*D)*(e.evo?1.45:1),t*26,e.evo); break; }
    case 'saw': { const g=T[0]; if(!g) break; const p=proj(lerp(e.z,g.z,k),lerp(e.x,g.x,k),0.3); drawSaw(p.x,p.y,Math.max(8*D,15*p.s*D)*(e.evo?1.35:1),t*30,e.evo); break; }
    case 'holy': for(const g of T.slice(0,5)){ const bot=proj(g.z,g.x,0), w0=Math.max(16*D,2*Math.abs(proj(g.z,g.x+AR.holy[0]*m,0).x-bot.x)), a=e.done?1-post:0.35+0.65*k, w=e.done?w0*(1-post*0.4):w0*(0.25+0.5*k*k), yb=bot.y; if(!e.done){ const E=gE(g.x,g.z,AR.holy[0]*m*1.6,AR.holy[1]*m*1.2); ctx.globalAlpha=0.5+0.5*k; ctx.strokeStyle='#ffd23a'; ctx.lineWidth=3*D; ell(E,1.2-0.4*k); ctx.stroke(); }
        ctx.globalAlpha=a; ctx.drawImage(pillarTex(),bot.x-w/2,0,w,Math.max(1,yb)); ctx.globalAlpha=1; gl('#ffd23a',bot.x,yb,w*1.3,a); gl('#ffffff',bot.x,yb,w*0.5,a);
        if(e.done&&e.evo){ ctx.globalAlpha=1-post; ctx.strokeStyle='#ffd23a'; ctx.lineWidth=3*D; for(let r=0;r<3;r++){ const hh=0.5+r*0.9+((t*1.5)%0.9); const c=proj(g.z,g.x,hh); ctx.beginPath(); ctx.ellipse(c.x,c.y,w*0.8,w*0.22,0,0,7); ctx.stroke(); } ctx.globalAlpha=1; } } break;
    case 'shock': { const g=T[0]||{x:e.x,z:e.z}, ph=e.t/e.dur; const ring=(k2,al)=>{ if(k2<=0.02||k2>1) return; const E=gE(g.x,g.z,AR.shock[0]*m*k2,AR.shock[1]*m*k2), f=1-k2*0.5; ctx.globalAlpha=al*(1-k2*0.5); ctx.strokeStyle='#5a3414'; ctx.lineWidth=12*D*f; ell(E); ctx.stroke(); ctx.strokeStyle='#ffe0a0'; ctx.lineWidth=6*D*f; ell(E); ctx.stroke(); ctx.strokeStyle='#ffffff'; ctx.lineWidth=2*D; ell(E,0.97); ctx.stroke(); ctx.globalAlpha=al*0.15*(1-k2); ctx.fillStyle='#ffe0a0'; ell(E); ctx.fill(); };
        ring(Math.min(1,ph*1.15),1); if(e.evo) ring(ph*1.15-0.3,0.85); ctx.globalAlpha=1; } break;
    case 'missile': if(!e.done) for(const [j,g] of T.slice(0,8).entries()){ const kk=Math.min(1,k*1.05), x0=e.x+(j%2?0.3:-0.3), pos=q=>proj(lerp(e.z,g.z,q),lerp(x0,g.x,q),0.4+Math.sin(q*Math.PI)*(1.2+j*0.1)); const p=pos(kk), pq=pos(Math.max(0,kk-0.04)); drawRocket(p.x,p.y,Math.max(10*D,17*p.s*D)*(e.evo?1.25:1),Math.atan2(p.y-pq.y,p.x-pq.x),e.evo); } break;
    case 'blackhole': { const g=T[0]; if(!g) break; const grow=Math.min(1,e.t/0.3), a=grow*(1-post), E=gE(g.x,g.z,AR.blackhole[0]*m,AR.blackhole[1]*m), sh=1-post*0.7;
        ctx.globalAlpha=0.4*a; ctx.fillStyle='#1a0638'; ell(E,0.95*sh); ctx.fill(); ctx.lineCap='round';
        ctx.lineWidth=3*D; ctx.strokeStyle='#8a5cff'; for(let arm=0;arm<(e.evo?6:4);arm++){ ctx.globalAlpha=0.7*a; ctx.beginPath(); for(let s=0;s<=14;s++){ const f=s/14, an=arm*6.283/(e.evo?6:4)-t*5+f*3.8, r=((1-f)*0.95+0.1)*sh; s?ctx.lineTo(E.x+Math.cos(an)*E.rx*r,E.y+Math.sin(an)*E.ry*r):ctx.moveTo(E.x+Math.cos(an)*E.rx*r,E.y+Math.sin(an)*E.ry*r); } ctx.stroke(); }
        for(let j=0;j<(e.evo?5:3);j++){ const rr=(0.3+j*0.17)*sh, sp=t*(6-j)*(j%2?-1:1); ctx.globalAlpha=0.9*a; ctx.strokeStyle=['#ff4fd8','#ffffff','#b48cff','#ff9af0','#ffffff'][j]; ctx.lineWidth=(3.5-j*0.4)*D; ctx.beginPath(); ctx.ellipse(E.x,E.y,E.rx*rr,E.ry*rr,0,sp,sp+4); ctx.stroke(); }
        const R=Math.max(12*D,E.rx*0.28)*(0.6+0.4*grow)*(1-post*0.8); ctx.globalAlpha=Math.min(1,a*1.3); ctx.fillStyle='#05000c'; ctx.beginPath(); ctx.ellipse(E.x,E.y-R*0.25,R,R*0.8,0,0,7); ctx.fill(); ctx.strokeStyle=e.evo?'#ffffff':'#c8a8ff'; ctx.lineWidth=(e.evo?3.5:2.2)*D; ctx.stroke(); ctx.globalAlpha=1;
        if(post>0) gl('#c8a8ff',E.x,E.y,E.rx*(0.5+post*1.2),1-post); } break;
    } }
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1; }
// 環繞鋸刃：與飛出的鋸刃同一造型（銀色齒輪刃＋金屬火花）
function sawPos(G,t,n,i){ const a=t*4+i*Math.PI*2/n; return {x:G.x+Math.cos(a)*0.32,z:G.z+1+Math.sin(a)*2.2}; }
function drawSaws(G,t,n,evo){ if(!n) return; ctx.globalCompositeOperation='source-over'; for(let i=0;i<n;i++){ const sp=sawPos(G,t,n,i), p=proj(sp.z,sp.x,0.2); const r=Math.max(7*D,(evo?22:15)*p.s*D);
  ctx.globalAlpha=0.3; ctx.strokeStyle='#ffffff'; ctx.lineWidth=r*0.3; ctx.beginPath(); ctx.arc(p.x,p.y,r*1.2,t*20,t*20+2); ctx.stroke(); ctx.globalAlpha=1; drawSaw(p.x,p.y,r,t*20,evo); }
  ctx.globalCompositeOperation='source-over'; }
// ---------- 終極技：全螢幕覆蓋（一眼就知道放了大招）----------
const ults=[];
function ult(k){ ults.push({k,t:0,dur:k==='singularity'?2.2:1.8,seed:Math.random()*100}); if(ults.length>3) ults.shift(); }
function drawUlts(dt){ if(!ults.length) return; const W=ctx.canvas.width, H=ctx.canvas.height, cx=W/2, cy=H*0.42;
  for(let i=ults.length-1;i>=0;i--){ const u=ults[i]; u.t+=dt; if(u.t>=u.dur){ ults.splice(i,1); continue; } const ph=u.t/u.dur, a=Math.min(1,u.t*5)*Math.min(1,(u.dur-u.t)*2.5);
    ctx.globalCompositeOperation='source-over'; ctx.lineCap='round';
    switch(u.k){
    case 'meteor': { const gr=ctx.createLinearGradient(0,0,0,H); gr.addColorStop(0,`rgba(255,50,10,${0.6*a})`); gr.addColorStop(0.55,`rgba(255,120,30,${0.2*a})`); gr.addColorStop(1,`rgba(120,20,0,${0.35*a})`); ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
      for(let j=0;j<16;j++){ const tt=(u.t*1.3+((j*0.37+u.seed)%1))%1, x=W*(0.1+((j*37)%100)/100*1.1)-tt*W*0.45, y=-H*0.08+tt*H*0.95, r=(9+(j*13)%9)*D;
        ctx.globalAlpha=0.75*a; ctx.strokeStyle='#ffb020'; ctx.lineWidth=r*1.1; ctx.beginPath(); ctx.moveTo(x+W*0.11,y-H*0.22); ctx.lineTo(x,y); ctx.stroke(); ctx.strokeStyle='#fff3c0'; ctx.lineWidth=r*0.4; ctx.stroke(); gl('#ff5a1a',x,y,r*3.2,a); ctx.globalAlpha=a; ctx.fillStyle='#4a2010'; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); ctx.strokeStyle='#ffd27a'; ctx.lineWidth=2*D; ctx.stroke(); } break; }
    case 'storm': { ctx.globalAlpha=0.5*a; ctx.fillStyle='#0a1030'; ctx.fillRect(0,0,W,H); const fl=Math.floor(u.t*11); if(fl%3===0){ ctx.globalAlpha=0.3*a; ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H); }
      ctx.beginPath(); for(let j=0;j<7;j++){ let x=W*(((j*0.29+fl*0.137+u.seed)%1)), y=0; const yE=H*(0.4+((j*0.21+fl*0.07)%0.45)); ctx.moveTo(x,y); while(y<yE){ y+=H*0.05; x+=Math.sin(j*9.1+y*0.05+fl*3.3)*W*0.05; ctx.lineTo(x,y); } }
      ctx.globalAlpha=0.7*a; ctx.strokeStyle='#14145a'; ctx.lineWidth=14*D; ctx.stroke(); ctx.globalAlpha=0.85*a; ctx.strokeStyle='#f4ff3a'; ctx.lineWidth=8*D; ctx.stroke(); ctx.globalAlpha=a; ctx.strokeStyle='#ffffff'; ctx.lineWidth=3*D; ctx.stroke(); break; }
    case 'blizzard': { ctx.globalAlpha=0.3*a; ctx.fillStyle='#bff0ff'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1; const gr=ctx.createRadialGradient(cx,H/2,Math.min(W,H)*0.25,cx,H/2,Math.max(W,H)*0.65); gr.addColorStop(0,'rgba(230,250,255,0)'); gr.addColorStop(1,`rgba(230,250,255,${0.9*a})`); ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=3*D; ctx.globalAlpha=0.9*a; ctx.beginPath(); for(let j=0;j<90;j++){ const sx=((j*0.6180339+u.seed)%1), sy=((j*0.4142+u.t*1.6)%1); const x=(sx*1.3-0.15+sy*0.3)*W, y=sy*H; ctx.moveTo(x,y); ctx.lineTo(x-W*0.04,y-H*0.03); } ctx.stroke();
      ctx.strokeStyle='#4fb8ff'; ctx.lineWidth=4*D; for(const [x,y] of [[0,0],[W,0],[0,H],[W,H]]){ for(let j=0;j<6;j++){ const an=j/6*6.28+ph; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(an)*W*0.22*a,y+Math.sin(an)*W*0.22*a); ctx.stroke(); } } break; }
    case 'judgement': { ctx.globalAlpha=0.28*a; ctx.fillStyle='#ffdc5a'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=0.35*a; ctx.fillStyle='#fff6c0'; const L=Math.max(W,H)*1.2; ctx.beginPath(); for(let j=0;j<16;j++){ const an=j/16*6.283+u.t*0.8; ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(an-0.07)*L,cy+Math.sin(an-0.07)*L); ctx.lineTo(cx+Math.cos(an+0.07)*L,cy+Math.sin(an+0.07)*L); ctx.closePath(); } ctx.fill();
      const r=ph*Math.max(W,H)*1.1; ctx.globalAlpha=a; ctx.strokeStyle='#ffd23a'; ctx.lineWidth=28*D*(1-ph)+4*D; ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.stroke(); ctx.strokeStyle='#ffffff'; ctx.lineWidth=6*D; ctx.stroke(); gl('#ffffff',cx,cy,W*0.3*(1-ph*0.5),a); ctx.fillStyle='#ffd23a'; ctx.globalAlpha=a*(1-ph); ctx.fillRect(cx-6*D,cy-60*D,12*D,120*D); ctx.fillRect(cx-40*D,cy-30*D,80*D,12*D); break; }
    case 'singularity': { const gr=ctx.createRadialGradient(cx,cy,W*0.1,cx,cy,Math.max(W,H)*0.75); gr.addColorStop(0,`rgba(40,0,80,${0.25*a})`); gr.addColorStop(1,`rgba(10,0,25,${0.9*a})`); ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
      const R=W*0.6*(1-ph*0.55); ctx.lineWidth=5*D; for(let arm=0;arm<6;arm++){ ctx.globalAlpha=0.8*a; ctx.strokeStyle=arm%2?'#ff4fd8':'#8a5cff'; ctx.beginPath(); for(let s=0;s<=20;s++){ const f=s/20, an=arm*1.047-u.t*6+f*4.2, rr=R*((1-f)+0.08); s?ctx.lineTo(cx+Math.cos(an)*rr,cy+Math.sin(an)*rr*0.6):ctx.moveTo(cx+Math.cos(an)*rr,cy+Math.sin(an)*rr*0.6); } ctx.stroke(); }
      ctx.globalAlpha=a; ctx.fillStyle='#000000'; ctx.beginPath(); ctx.arc(cx,cy,W*0.09*(0.6+ph),0,7); ctx.fill(); ctx.strokeStyle='#ffffff'; ctx.lineWidth=4*D; ctx.stroke(); break; }
    } }
  ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; }
const pops=[]; let flash=null;
function pop(x,z,col,big){ if(pops.length>=80) pops.shift(); pops.push({x,z,col:col||'#ffffff',t:0,big:big?1.8:1}); }
function screenFlash(col,a){ flash={col,a:a||0.35,t:0}; }
function drawPops(dt){ ctx.globalCompositeOperation='lighter'; for(let i=pops.length-1;i>=0;i--){ const q=pops[i]; q.t+=dt; if(q.t>0.28){ pops.splice(i,1); continue; } const p=proj(q.z,q.x,0.4), k=q.t/0.28;
    spr('circle_05',q.col,p.x,p.y,Math.max(24*D,(40+90*k)*p.s*D)*q.big,1-k); spr('star_06','#ffffff',p.x,p.y,Math.max(16*D,30*p.s*D)*q.big*(1-k),1-k); } ctx.globalCompositeOperation='source-over';
  if(flash){ flash.t+=dt; const a=flash.a*(1-flash.t/0.35); if(a<=0) flash=null; else { ctx.fillStyle=flash.col; ctx.globalAlpha=a; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height); ctx.globalAlpha=1; } } }
const FX={ pop, screenFlash, setBulletSize(s){ BSZ=Math.max(1,Math.min(2.6,s||1)); }, init(o){ ctx=o.ctx; proj=o.proj; getG=o.getG; }, setD(d){ D=d; },
  setLod(n){ LOD=n; PCAP=n>=2?90:n===1?150:MAXP; }, ETYPES, drawCharger, bullet, fireGun, cast, collide, inRadius, drawZombie, zombieSprite, spr, drawSheet, bullets, effects,
  VCOL, wcol, hitFx, ult, sawPos, get ultsActive(){ return ults.map(u=>u.k+':'+u.t.toFixed(2)); }, drawDecals:()=>drawDecals(0),
  update(dt,burstFn){ updBullets(dt); updEffects(dt,burstFn); updParts(dt); for(const d of decals) d.t+=dt; for(const u of ults) u.t+=dt; },
  draw(t){ drawBullets(t); drawEffects(t); drawParts(); drawPops(1/60); drawUlts(0); }, drawSaws,
  clear(){ bullets.length=0; effects.length=0; parts.length=0; decals.length=0; ults.length=0; }, get counts(){ return {bullets:bullets.length,effects:effects.length,parts:parts.length,decals:decals.length}; } };
root.FX=FX;
})(this);
