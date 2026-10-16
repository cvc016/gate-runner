// Boss 大招 QTE：7 種觸控小遊戲。成功 → BREAK；失敗 → 大招命中。
(function(root){
const KINDS=['grid_1to9','shrink_ring','mash_meter','swipe_arrows','memory_colors','find_impostor','charge_green'];
function tierOf(stage){ return Math.min(10, Math.floor(Math.min(1,Math.max(0,(stage-1)/999))*10)); }
function params(stage){ const t=tierOf(stage); return { t, timeMul:1-0.035*t, judgeMul:1-0.04*t, failFrac:0.12+0.01*t }; }
function pick(seed,stage,ultIndex){ let x=((seed^stage*0x9e37^ultIndex*0xb055)>>>0)||1; x^=x<<13; x^=x>>>17; x^=x<<5; return KINDS[(x>>>0)%KINDS.length]; }
function make(kind, stage, onDone){
  const P=params(stage); const el=document.createElement('div'); el.id='qte'; el.className='qte on';
  const state={kind, done:false, ok:false, P, el, stage};
  const finish=ok=>{ if(state.done) return; state.done=true; state.ok=ok; el.classList.remove('on'); setTimeout(()=>el.remove(),200); onDone(ok,state); };
  state.finish=finish;
  if(kind==='grid_1to9') grid(state);
  else if(kind==='shrink_ring') ring(state);
  else if(kind==='mash_meter') mash(state);
  else if(kind==='swipe_arrows') swipe(state);
  else if(kind==='memory_colors') memory(state);
  else if(kind==='find_impostor') impostor(state);
  else charge(state);
  document.getElementById('wrap').appendChild(el);
  // 逾時
  const lim=state.timeLimit; state.deadline=performance.now()+lim*1000;
  state.timer=setInterval(()=>{ if(state.done) return clearInterval(state.timer); const left=(state.deadline-performance.now())/1000;
    const bar=el.querySelector('.qte-time'); if(bar) bar.style.width=(100*Math.max(0,left)/lim)+'%';
    if(left<=0) finish(false); },50);
  return state;
}
function head(el,title,P){ el.innerHTML=`<div class=qte-box><div class=qte-title>${title}</div><div class=qte-bar><i class=qte-time></i></div><div class=qte-body></div></div>`; return el.querySelector('.qte-body'); }
function grid(S){ S.timeLimit=6.5*S.P.timeMul; const body=head(S.el,'依序點 1→9',S.P); let next=1; const order=[1,2,3,4,5,6,7,8,9];
  // 後期亂排但依數字值
  for(let i=order.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [order[i],order[j]]=[order[j],order[i]]; }
  body.className='qte-body grid3'; order.forEach(n=>{ const b=document.createElement('button'); b.textContent=n; b.onclick=()=>{ if(n===next){ b.disabled=true; b.className='ok'; if(++next>9) S.finish(true); } else S.finish(false); }; body.appendChild(b); }); }
function ring(S){ S.timeLimit=3.2*S.P.timeMul; const body=head(S.el,'在圈上點擊！',S.P); body.className='qte-body ring';
  const c=document.createElement('div'); c.className='ring-c'; const o=document.createElement('div'); o.className='ring-o'; body.appendChild(c); body.appendChild(o);
  const w=0.18*S.P.judgeMul; let r=1; const t0=performance.now();
  S._tick=setInterval(()=>{ if(S.done) return clearInterval(S._tick); r=1-((performance.now()-t0)/(S.timeLimit*1000)); o.style.transform=`scale(${Math.max(0.05,r)})`; if(r<=0) S.finish(false); },16);
  body.onclick=()=>{ const ok=Math.abs(r-0.45)<=w; S.finish(ok); }; }
function mash(S){ S.timeLimit=4*S.P.timeMul; const need=Math.round(18*(1+0.08*S.P.t)); const body=head(S.el,`連點！ ${need} 次`,S.P); body.className='qte-body mash';
  const meter=document.createElement('div'); meter.className='mash-m'; const fill=document.createElement('i'); meter.appendChild(fill); body.appendChild(meter);
  const btn=document.createElement('button'); btn.textContent='連點！'; body.appendChild(btn); let n=0, drain=2.5+0.3*S.P.t;
  S._tick=setInterval(()=>{ if(S.done) return clearInterval(S._tick); n=Math.max(0,n-drain*0.05); fill.style.height=(100*n/need)+'%'; },50);
  btn.onclick=()=>{ n++; fill.style.height=(100*n/need)+'%'; if(n>=need) S.finish(true); }; }
function swipe(S){ const n=4+Math.floor(S.P.t/3); S.timeLimit=n*0.85*S.P.timeMul; const dirs=['U','D','L','R'], map={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]}, glyph={U:'↑',D:'↓',L:'←',R:'→'};
  const seq=[]; for(let i=0;i<n;i++) seq.push(dirs[(Math.random()*4)|0]);
  const body=head(S.el,'依序滑動',S.P); body.className='qte-body swipe'; body.innerHTML=seq.map((d,i)=>`<span class=ar data-i=${i}>${glyph[d]}</span>`).join('');
  let i=0, sx,sy; const ang=35*S.P.judgeMul*Math.PI/180;
  const hit=(dx,dy)=>{ const [tx,ty]=map[seq[i]]; const L=Math.hypot(dx,dy); if(L<40) return; const dot=(dx*tx+dy*ty)/L; if(Math.acos(Math.min(1,Math.max(-1,dot)))<ang){ body.children[i].className='ar ok'; if(++i>=n) S.finish(true); } else S.finish(false); };
  body.ontouchstart=e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; e.preventDefault(); };
  body.ontouchend=e=>{ const t=e.changedTouches[0]; hit(t.clientX-sx,t.clientY-sy); };
  body.onmousedown=e=>{ sx=e.clientX; sy=e.clientY; };
  body.onmouseup=e=>hit(e.clientX-sx,e.clientY-sy); }
function memory(S){ const N=3+Math.floor(S.P.t/3); const cols=['#ff4d4d','#4dff7a','#4da6ff','#ffd23f','#c77dff','#fff'];
  const seq=[]; for(let i=0;i<N;i++) seq.push((Math.random()*4)|0);
  S.timeLimit=(0.55*N+2.8*S.P.timeMul); const body=head(S.el,'記住顏色順序',S.P); body.className='qte-body mem';
  const pads=[]; for(let i=0;i<4;i++){ const b=document.createElement('button'); b.style.background=cols[i]; b.disabled=true; body.appendChild(b); pads.push(b); }
  let step=0; (async()=>{ for(const c of seq){ if(S.done) return; pads[c].className='lit'; await wait(450); pads[c].className=''; await wait(120); }
    pads.forEach(b=>b.disabled=false); })();
  pads.forEach((b,i)=>b.onclick=()=>{ if(seq[step]===i){ if(++step>=N) S.finish(true); } else S.finish(false); }); }
function impostor(S){ const cell=3+Math.floor(S.P.t/4); S.timeLimit=3.5*S.P.timeMul; const body=head(S.el,'找出不一樣的！',S.P); body.className='qte-body gridN'; body.style.gridTemplateColumns=`repeat(${cell},1fr)`;
  const odd=(Math.random()*cell*cell)|0; const base='●', alt='◆';
  for(let i=0;i<cell*cell;i++){ const b=document.createElement('button'); b.textContent=i===odd?alt:base; b.style.color=i===odd?`hsl(${(S.P.t*20)%360} 80% 60%)`:'#ddd';
    b.onclick=()=>S.finish(i===odd); body.appendChild(b); } }
function charge(S){ S.timeLimit=2.8*S.P.timeMul; const body=head(S.el,'綠區鬆手！',S.P); body.className='qte-body charge';
  const track=document.createElement('div'); track.className='ch-track'; const green=document.createElement('i'); green.className='ch-g';
  const ptr=document.createElement('b'); ptr.className='ch-p'; track.appendChild(green); track.appendChild(ptr); body.appendChild(track);
  const btn=document.createElement('button'); btn.textContent='按住…'; body.appendChild(btn);
  const gw=0.22*S.P.judgeMul; const g0=0.4-gw/2; green.style.left=(g0*100)+'%'; green.style.width=(gw*100)+'%';
  let p=0, dir=1, hold=false; const spd=1.4*(1+0.07*S.P.t);
  S._tick=setInterval(()=>{ if(S.done) return clearInterval(S._tick); if(hold){ p+=dir*spd*0.016; if(p>1||p<0){ dir*=-1; p=Math.max(0,Math.min(1,p)); } ptr.style.left=(p*100)+'%'; } },16);
  const down=e=>{ e.preventDefault(); hold=true; }; const up=e=>{ e.preventDefault(); if(!hold) return; hold=false; S.finish(p>=g0&&p<=g0+gw); };
  btn.addEventListener('touchstart',down,{passive:false}); btn.addEventListener('touchend',up); btn.addEventListener('mousedown',down); btn.addEventListener('mouseup',up); }
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
const QTE={KINDS,tierOf,params,pick,make};
if(typeof module!=='undefined') module.exports=QTE; else root.QTE=QTE;
})(this);
