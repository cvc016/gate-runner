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
  if(u.burn>0) spr('flame_03','#ff8a1f',p.x,p.y-h*0.9,h*0.6,0.85);
  if(T.tag&&p.s>(LOD?0.38:0.2)){ ctx.font=`900 ${Math.max(10*D,15*p.s*D)}px sans-serif`; ctx.textAlign='center'; ctx.lineWidth=3*D; ctx.strokeStyle='#000c'; const ty=p.y-h-12*D; ctx.strokeText(T.name,p.x,ty); ctx.fillStyle=T.glow||'#fff'; ctx.fillText(T.name,p.x,ty); }
  // 血條：較大的敵人或已受傷者顯示
  if(u.maxHp&&(T.hp>=2||u.hp<u.maxHp)&&p.s>(LOD>1?0.45:0.25)){ const bw=Math.max(14*D,w*0.9), bh=Math.max(2*D,4*p.s*D), y=p.y-h-bh-2*D; ctx.fillStyle='#000a'; ctx.fillRect(p.x-bw/2,y,bw,bh); ctx.fillStyle=T.hp>=2?'#ff4040':'#ffb020'; ctx.fillRect(p.x-bw/2,y,bw*Math.max(0,u.hp/u.maxHp),bh); }
  return p; }
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
  bullets.push(b); return b; }
function fireGun(x,z,tx,tz,opt){ return bullet(x,z,tx,tz,opt.col||'#fff36b',opt.speed||85,null,0.25,opt); }
function updBullets(dt){ for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i];
  if(b.homing&&b.homing()){ const t=b.homing(); if(t){ const dx=t.x-b.x, dz=t.z-b.z, d=Math.max(0.01,Math.hypot(dx*12,dz));
    const wantX=dx*12/d*b.speed, wantZ=dz/d*b.speed; const k=Math.min(1,dt*3); b.vx+= (wantX-b.vx)*k; b.vz+=(wantZ-b.vz)*k; } }
  b.px=b.x; b.pz=b.z; b.x+=b.vx/12*dt; b.z+=b.vz*dt; b.life-=dt;
  if(b.life<=0||Math.abs(b.x)>1.2||b.dead){ if(b.onHit&&!b.dead) b.onHit(); bullets[i]=bullets[bullets.length-1]; bullets.pop(); pool.push(b); } } }
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
      dmgFn(hitU,b,b.dmg*mul); hits++; b.pierce--; if(b.pierce<0){ b.dead=1; bullets[i]=bullets[bullets.length-1]; bullets.pop(); pool.push(b); } }
  } return hits; }
// 範圍查詢：圓內所有單位（給 AOE 武器用）
function inRadius(units,x,z,rx,rz){ const out=[]; for(const u of units) if(!u.dead&&Math.abs(u.x-x)<rx&&Math.abs(u.z-z)<rz) out.push(u); return out; }
function drawBullets(){ // 批次：同顏色一次 stroke
  const by={}; for(const b of bullets) (by[b.col]=by[b.col]||[]).push(b);
  ctx.lineCap='round'; ctx.globalCompositeOperation='lighter';
  const w=BSZ;
  for(const col in by){ const L=by[col], seg=b=>{ const p=proj(b.z,b.x,b.h), q=proj(b.z-b.vz*0.05,b.x-b.vx/12*0.05,b.h); ctx.moveTo(q.x,q.y); ctx.lineTo(p.x,p.y); };
    ctx.strokeStyle=col; ctx.globalAlpha=0.35; ctx.lineWidth=9*D*w; ctx.beginPath(); L.forEach(seg); ctx.stroke(); // 外光暈
    ctx.globalAlpha=1; ctx.lineWidth=4*D*w; ctx.beginPath(); L.forEach(seg); ctx.stroke();
    ctx.fillStyle='#ffffff'; ctx.beginPath(); const r=2.6*D*w; for(const b of L){ const p=proj(b.z,b.x,b.h); ctx.moveTo(p.x+r,p.y); ctx.arc(p.x,p.y,r,0,7); } ctx.fill(); }
  ctx.globalCompositeOperation='source-over'; }
// ---------- 元素武器特效 ----------
// e: {type, t, dur, x,z (起點), tg:[{x,z,ref}], onHit, done, evo, seed}
function cast(type, from, tg, onHit, opt){ opt=opt||{}; if(effects.length>=MAXE){ if(onHit) onHit(); return; }
  const dur={fireball:0.45,ice:0.3,lightning:0.22,arcane:0.6,poison:1.8,laser:0.55,meteor:0.7,tornado:1.6,boomerang:1.0,saw:0.35,holy:0.5,shock:0.6,missile:0.7,blackhole:1.6}[type]||0.5;
  effects.push({type,t:0,dur,x:from.x,z:from.z,tg,onHit,done:false,evo:!!opt.evo,lv:opt.lvl||1,seed:Math.random()*100,hitAt:{poison:0.5,tornado:0.6,boomerang:0.45,blackhole:1.2,laser:0.15,meteor:0.6,shock:0.3}[type]||1}); SFX.elem(type); }
function updEffects(dt,burstFn){ for(let i=effects.length-1;i>=0;i--){ const e=effects[i]; e.t+=dt;
    if(!e.done && e.t>=e.dur*e.hitAt){ e.done=true; if(e.onHit) e.onHit(e.tg); if(e.type==='meteor') screenFlash('#ffb347',0.3); if(e.type==='blackhole') screenFlash('#5a2aa0',0.3); if(e.type==='shock') screenFlash('#ffd27a',0.18); const c={fireball:'#ff7a1f',ice:'#9fe8ff',lightning:'#fffb7a',arcane:'#c77dff',poison:'#7dff6a',laser:'#ff4fd8',meteor:'#ffb347',tornado:'#d0f0c0',boomerang:'#ffe066',saw:'#e0e0e0',holy:'#fff6b0',shock:'#ffd27a',missile:'#ff9a3c',blackhole:'#8a5cff'}[e.type];
      if(burstFn) for(const g of e.tg.slice(0,6)) burstFn(g.z,g.x,c,e.evo?14:7,1.3); }
    if(e.type==='blackhole'&&!e.done) for(const g of e.tg){ if(g.ref){ g.ref.x+=(e.tg[0].x-g.ref.x)*dt*3; g.ref.z+=(e.tg[0].z-g.ref.z)*dt*3; } }
    if(e.t>=e.dur){ effects[i]=effects[effects.length-1]; effects.pop(); } } }
const lerp=(a,b,k)=>a+(b-a)*k;
const AREA={meteor:1,blackhole:1,poison:1,tornado:1,arcane:1,shock:1};
function drawEffects(t){ ctx.globalCompositeOperation='lighter'; let MIN=30*D;
  const SP=(n,c,x,y,sz,a,r)=>spr(n,c,x,y,Math.max(sz,MIN),Math.min(1,(a===undefined?1:a)*1.25),r); // v0.4：所有特效有最小螢幕尺寸、更亮
  for(const e of effects){ const k=Math.min(1,e.t/(e.dur*e.hitAt)), T=e.tg, s0=proj(e.z,e.x,0.3), big=1.7*(e.evo?1.6:1)*(1+0.14*(e.lv-1)); MIN=(AREA[e.type]?80:34)*D*(e.evo?1.3:1); // 等級越高越大越亮
    switch(e.type){
    case 'fireball': for(const g of T.slice(0,4)){ const x=lerp(e.x,g.x,k), z=lerp(e.z,g.z,k), arc=Math.sin(k*Math.PI)*0.8; const p=proj(z,x,0.3+arc);
        for(let j=1;j<5;j++){ const q=proj(lerp(e.z,g.z,Math.max(0,k-j*0.06)),lerp(e.x,g.x,Math.max(0,k-j*0.06)),0.3+Math.sin(Math.max(0,k-j*0.06)*Math.PI)*0.8); SP('flame_03','#ff5a1f',q.x,q.y,(30-j*4)*p.s*D*big,0.5); }
        SP('flame_03','#ffb020',p.x,p.y,40*p.s*D*big,1,t*8); if(e.done){ const q=proj(g.z,g.x,0.2); SP('circle_05','#ff7a1f',q.x,q.y,(60+120*(e.t/e.dur))*q.s*D*big,1-e.t/e.dur); } } break;
    case 'ice': for(const [j,g] of T.slice(0,5).entries()){ const x=lerp(e.x,g.x,k), z=lerp(e.z,g.z,k); const p=proj(z,x,0.35); const a=Math.atan2(proj(g.z,g.x,0.3).y-s0.y,proj(g.z,g.x,0.3).x-s0.x);
        ctx.fillStyle='#bff4ff'; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(a); const L=18*p.s*D*big; ctx.beginPath(); ctx.moveTo(L,0); ctx.lineTo(-L,-L*0.28); ctx.lineTo(-L*0.6,0); ctx.lineTo(-L,L*0.28); ctx.fill(); ctx.restore(); SP('spark_04','#7fe0ff',p.x,p.y,26*p.s*D,0.6); } break;
    case 'lightning': { /* QA v3：移除 shadowBlur（大量跳躍時軟體繪製掉到 ~30fps），改用兩層描邊做光暈；最多畫 12 段 */ ctx.strokeStyle='#fffbd0'; ctx.lineWidth=(e.evo?5:3)*D; ctx.beginPath(); let a=s0;
        for(const g of T.slice(0,12)){ const b=proj(g.z,g.x,0.35); const n=6; ctx.moveTo(a.x,a.y); for(let j=1;j<=n;j++){ const xx=lerp(a.x,b.x,j/n)+(j<n?(Math.sin(e.seed+j*7+t*60)*14*D):0), yy=lerp(a.y,b.y,j/n)+(j<n?Math.cos(e.seed+j*5+t*50)*10*D:0); ctx.lineTo(xx,yy); } a=b; SP('spark_04','#fff36b',b.x,b.y,40*b.s*D,0.9,t*20); }
        const la=1-e.t/e.dur, lw=ctx.lineWidth; ctx.strokeStyle='#ffe94d'; ctx.globalAlpha=0.35*la; ctx.lineWidth=lw*4; ctx.stroke(); ctx.strokeStyle='#fffbd0'; ctx.globalAlpha=la; ctx.lineWidth=lw; ctx.stroke(); ctx.globalAlpha=1; } break;
    case 'arcane': for(const [j,g] of T.slice(0,6).entries()){ const side=(j%2?1:-1)*(0.6+j*0.1); const x=lerp(e.x,g.x,k)+Math.sin(k*Math.PI)*side*0.5, z=lerp(e.z,g.z,k); const p=proj(z,x,0.4+Math.sin(k*Math.PI)*0.6);
        SP('magic_02','#c77dff',p.x,p.y,34*p.s*D*big,1,t*6+j); SP('star_06','#ffffff',p.x,p.y,14*p.s*D*big,0.9); } break;
    case 'poison': { const g=T[0]; if(!g) break; const p=proj(g.z,g.x,0.05), a=Math.min(1,e.t*3)*(1-Math.max(0,(e.t-e.dur*0.7)/(e.dur*0.3)));
        for(let j=0;j<7;j++){ const q=proj(g.z+Math.sin(e.seed+j*2.1)*3,g.x+Math.cos(e.seed+j*1.7)*0.25,0.1+0.05*Math.sin(t*2+j)); SP('smoke_04','#5aff4a',q.x,q.y,90*q.s*D*big,0.35*a,t*0.5+j); } SP('circle_05','#3aff2a',p.x,p.y,140*p.s*D*big,0.25*a); } break;
    case 'laser': { const x=e.x+(Math.sin(e.seed)*0.3), a=proj(e.z+0.5,x,0.35), b=proj(e.z+80,x+Math.sin(e.t*3+e.seed)*0.25,0.35), al=1-Math.max(0,(e.t-e.dur*0.6)/(e.dur*0.4));
        ctx.strokeStyle='#ff4fd8'; ctx.globalAlpha=0.6*al; ctx.lineWidth=(e.evo?26:16)*D; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.strokeStyle='#ffffff'; ctx.globalAlpha=al; ctx.lineWidth=(e.evo?8:5)*D; ctx.stroke(); ctx.globalAlpha=1; SP('light_02','#ff8af0',a.x,a.y,60*D,al); } break;
    case 'meteor': { const g=T[0]; if(!g) break; const fall=Math.min(1,e.t/(e.dur*e.hitAt)); const p=proj(g.z,g.x+0.3*(1-fall),6*(1-fall));
        if(!e.done){ for(let j=1;j<6;j++){ const q=proj(g.z,g.x+0.3*(1-fall+j*0.05),6*(1-fall)+j*0.35); SP('flame_03','#ff6a1f',q.x,q.y,(70-j*10)*q.s*D*big,0.6); } SP('circle_05','#ffcc55',p.x,p.y,70*p.s*D*big,1); }
        else { const q=proj(g.z,g.x,0.05), r=(e.t-e.dur*e.hitAt)/(e.dur*(1-e.hitAt)); SP('scorch_02','#ff7a1f',q.x,q.y,200*q.s*D*big,0.8*(1-r)); SP('circle_05','#ffd27a',q.x,q.y,(80+300*r)*q.s*D*big,1-r); } } break;
    case 'tornado': { const z=lerp(e.z+2,e.z+60,e.t/e.dur), x=e.x+Math.sin(e.t*4+e.seed)*0.4; for(let j=0;j<6;j++){ const p=proj(z,x+Math.sin(t*10+j)*0.05,j*0.35); SP('twirl_02','#d8ffd0',p.x,p.y,(40+j*14)*p.s*D*big,0.55,t*12+j); }
        const base=proj(z,x,0); SP('smoke_04','#c0a080',base.x,base.y,90*base.s*D*big,0.5,t); } break;
    case 'boomerang': { const ph=e.t/e.dur, out=ph<0.5?ph*2:2-ph*2; const z=e.z+out*45, x=e.x+Math.sin(ph*Math.PI*2)*0.5; const p=proj(z,x,0.4); ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(t*25); const L=22*p.s*D*big;
        ctx.fillStyle='#ffe066'; ctx.fillRect(-L,-L*0.18,L*2,L*0.36); ctx.fillRect(-L*0.18,-L,L*0.36,L*2); ctx.restore(); SP('trace_04','#ffe066',p.x,p.y,50*p.s*D,0.4,t*25); } break;
    case 'saw': break; // 常駐環繞，由 drawSaws 處理
    case 'holy': for(const g of T.slice(0,5)){ const top=proj(g.z,g.x,9), bot=proj(g.z,g.x,0), a=Math.sin(Math.min(1,e.t/e.dur)*Math.PI); const w=(e.evo?60:36)*bot.s*D;
        const gr=ctx.createLinearGradient(0,top.y,0,bot.y); gr.addColorStop(0,'rgba(255,250,200,0)'); gr.addColorStop(1,`rgba(255,250,200,${0.85*a})`); ctx.fillStyle=gr; ctx.fillRect(bot.x-w/2,top.y,w,bot.y-top.y); SP('light_02','#fff6b0',bot.x,bot.y,w*3,a); } break;
    case 'shock': { const r=(e.t/e.dur)*(e.evo?1.8:1.2), p=proj(e.z+r*12,e.x,0); for(let j=0;j<24;j++){ const a=j/24*Math.PI*2; const q=proj(e.z+Math.sin(a)*r*14,e.x+Math.cos(a)*r,0); SP('spark_04','#ffd27a',q.x,q.y,30*q.s*D,1-e.t/e.dur); } } break;
    case 'missile': for(const [j,g] of T.slice(0,8).entries()){ const kk=Math.min(1,k*1.05); const x=lerp(e.x+(j%2?0.3:-0.3),g.x,kk), z=lerp(e.z,g.z,kk), h=0.4+Math.sin(kk*Math.PI)*(1.2+j*0.1); const p=proj(z,x,h);
        for(let m=1;m<4;m++){ const kq=Math.max(0,kk-m*0.07); const q=proj(lerp(e.z,g.z,kq),lerp(e.x+(j%2?0.3:-0.3),g.x,kq),0.4+Math.sin(kq*Math.PI)*(1.2+j*0.1)); SP('smoke_04','#c8c8c8',q.x,q.y,22*q.s*D,0.35); }
        SP('flame_03','#ff9a3c',p.x,p.y,24*p.s*D,1); ctx.fillStyle='#fff'; ctx.fillRect(p.x-2*D,p.y-2*D,4*D,4*D); } break;
    case 'blackhole': { const g=T[0]; if(!g) break; const p=proj(g.z,g.x,0.3), a=Math.sin(Math.min(1,e.t/e.dur)*Math.PI);
        ctx.globalCompositeOperation='source-over'; ctx.fillStyle=`rgba(10,0,25,${0.9*a})`; ctx.beginPath(); ctx.arc(p.x,p.y,30*p.s*D*big*a,0,7); ctx.fill(); ctx.globalCompositeOperation='lighter';
        SP('twirl_02','#8a5cff',p.x,p.y,150*p.s*D*big*a,a,-t*6); SP('twirl_02','#ff4fd8',p.x,p.y,100*p.s*D*big*a,a*0.7,t*9); } break;
    } }
  ctx.globalCompositeOperation='source-over'; }
function drawSaws(G,t,n,evo){ if(!n) return; ctx.globalCompositeOperation='lighter'; for(let i=0;i<n;i++){ const a=t*4+i*Math.PI*2/n; const p=proj(G.z+1+Math.sin(a)*2.2,G.x+Math.cos(a)*0.32,0.2); const r=(evo?22:15)*p.s*D;
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(t*20); ctx.fillStyle='#e8eef5'; ctx.beginPath(); for(let j=0;j<12;j++){ const aa=j/12*6.28, rr=j%2?r:r*0.7; ctx.lineTo(Math.cos(aa)*rr,Math.sin(aa)*rr); } ctx.fill(); ctx.restore(); spr('trace_04','#aee8ff',p.x,p.y,r*3,0.4,t*20); }
  ctx.globalCompositeOperation='source-over'; }
const pops=[]; let flash=null;
function pop(x,z,col,big){ if(pops.length>=80) pops.shift(); pops.push({x,z,col:col||'#ffffff',t:0,big:big?1.8:1}); }
function screenFlash(col,a){ flash={col,a:a||0.35,t:0}; }
function drawPops(dt){ ctx.globalCompositeOperation='lighter'; for(let i=pops.length-1;i>=0;i--){ const q=pops[i]; q.t+=dt; if(q.t>0.28){ pops.splice(i,1); continue; } const p=proj(q.z,q.x,0.4), k=q.t/0.28;
    spr('circle_05',q.col,p.x,p.y,Math.max(24*D,(40+90*k)*p.s*D)*q.big,1-k); spr('star_06','#ffffff',p.x,p.y,Math.max(16*D,30*p.s*D)*q.big*(1-k),1-k); } ctx.globalCompositeOperation='source-over';
  if(flash){ flash.t+=dt; const a=flash.a*(1-flash.t/0.35); if(a<=0) flash=null; else { ctx.fillStyle=flash.col; ctx.globalAlpha=a; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height); ctx.globalAlpha=1; } } }
const FX={ pop, screenFlash, setBulletSize(s){ BSZ=Math.max(1,Math.min(2.6,s||1)); }, init(o){ ctx=o.ctx; proj=o.proj; getG=o.getG; }, setD(d){ D=d; },
  setLod(n){ LOD=n; }, ETYPES, drawCharger, bullet, fireGun, cast, collide, inRadius, drawZombie, zombieSprite, spr, drawSheet, bullets,
  update(dt,burstFn){ updBullets(dt); updEffects(dt,burstFn); },
  draw(t){ drawBullets(); drawEffects(t); drawPops(1/60); }, drawSaws,
  clear(){ bullets.length=0; effects.length=0; }, get counts(){ return {bullets:bullets.length,effects:effects.length}; } };
root.FX=FX;
})(this);
