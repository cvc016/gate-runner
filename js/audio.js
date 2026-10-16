// 音效：CC0 音檔（Kenney / OpenGameArt，見 ASSETS-LICENSES.md）＋ WebAudio 合成備援 ＋ BGM 循環
// Android WebView 的 AudioContext 常處於 "suspended"，必須在使用者手勢中呼叫 resume()；這裡在每次觸控/點擊都嘗試解鎖。
(function(root){
let ac=null, master=null, sfxBus=null, musicBus=null, muted=localStorage.getItem('gr_mute')==='1';
const BF=root.GR_BUILD||{}, EXT=BF.audioExt||'ogg'; // 網頁版（iOS Safari）改用 m4a，且在第一次觸控時播放無聲 buffer 解鎖
let primed=false;
const buf={}, last={}; let bgmSrc=null, bgmWanted=false, loading=null;
const FILES=['gate_good','gate_bad','shot','hit','coin','explode','slam','warn','level','chest','shield','zap','laser','fire','ice','magic','poison','click','zombie','win','lose'];
function ctx(){ if(ac) return ac; try{ ac=new (root.AudioContext||root.webkitAudioContext)(); }catch(e){ return null; }
  master=ac.createGain(); master.gain.value=muted?0:0.9; master.connect(ac.destination);
  sfxBus=ac.createGain(); sfxBus.gain.value=0.7; sfxBus.connect(master); musicBus=ac.createGain(); musicBus.gain.value=0.35; musicBus.connect(master);
  return ac; }
function load(){ if(loading||!ac) return loading; const get=(u)=>fetch(u).then(r=>r.arrayBuffer()).then(a=>new Promise((ok,no)=>ac.decodeAudioData(a,ok,no)));
  loading=Promise.all([...FILES.map(n=>get('assets/sfx/'+n+'.'+EXT).then(b=>buf[n]=b).catch(()=>{})), get('assets/music/bgm_juhani_level1.'+EXT).then(b=>buf.bgm=b).catch(()=>{})]).then(()=>{ if(bgmWanted) startBgm(); });
  return loading; }
function unlock(){ const a=ctx(); if(!a) return; if(a.state!=='running') a.resume().catch(()=>{}); if(BF.web&&(!primed||a.state!=='running')){ primed=true; try{ const b=a.createBuffer(1,1,22050), s=a.createBufferSource(); s.buffer=b; s.connect(a.destination); s.start(0); }catch(e){} } load(); if(bgmWanted&&!bgmSrc) startBgm(); }
['pointerdown','touchstart','touchend','click','keydown'].forEach(ev=>root.addEventListener&&root.addEventListener(ev,unlock,{capture:true,passive:true}));
document.addEventListener('visibilitychange',()=>{ if(!ac) return; if(document.hidden) ac.suspend().catch(()=>{}); else ac.resume().catch(()=>{}); });
function startBgm(){ if(!ac||!buf.bgm||bgmSrc) return; bgmSrc=ac.createBufferSource(); bgmSrc.buffer=buf.bgm; bgmSrc.loop=true; bgmSrc.connect(musicBus); bgmSrc.start(); }
function play(n,vol,rate,minGap){ if(!ac||muted) return false; const b=buf[n]; if(!b) return false; const now=ac.currentTime; if(minGap&&now-(last[n]||-9)<minGap) return true; last[n]=now;
  const s=ac.createBufferSource(); s.buffer=b; s.playbackRate.value=rate||1; const g=ac.createGain(); g.gain.value=vol===undefined?1:vol; s.connect(g); g.connect(sfxBus); s.start(); return true; }
function tone(f, d, type, vol, slide, delay){ if(!ac) return; const t=ac.currentTime+(delay||0); const o=ac.createOscillator(), g=ac.createGain();
  o.type=type||'square'; o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f*slide),t+d);
  g.gain.setValueAtTime(vol||0.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+d); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t+d+0.02); }
const P=(n,v,r,gap,fb)=>()=>{ if(!play(n,v,r,gap)&&fb) fb(); };
const SFX={
  init:unlock, get muted(){return muted;}, get state(){ return ac?ac.state:'none'; }, get loaded(){ return Object.keys(buf).length; },
  toggle(){ muted=!muted; localStorage.setItem('gr_mute',muted?'1':'0'); if(master) master.gain.value=muted?0:0.9; return muted; },
  bgm(on){ bgmWanted=on!==false; if(bgmWanted) { unlock(); startBgm(); } else if(bgmSrc){ bgmSrc.stop(); bgmSrc=null; } },
  good(combo){ if(!play('gate_good',0.8,1+Math.min(12,combo||0)*0.05)) tone(440,0.12,'square',0.2,1.5); },
  bad:P('gate_bad',0.9,1,0,()=>tone(300,0.25,'sawtooth',0.2,0.4)),
  shot(){ play('shot',0.18,0.9+Math.random()*0.3,0.06); },
  hit:P('hit',0.6,1,0.05,()=>tone(150,0.08,'square',0.2)),
  coin:P('coin',0.5,1.2,0.04),
  clash:P('explode',0.6,1.1,0.08),
  slam:P('slam',1,1,0.2),
  warn:P('warn',0.8,1,0.3),
  level:P('level',0.8),
  chest:P('chest',0.8),
  win:P('win',0.8), lose:P('lose',0.8), evo:P('level',1,0.8),
  elem(type){ const m={fire:['fire',0.35,1.3],ice:['ice',0.5,1],lightning:['zap',0.5,1],arcane:['magic',0.35,1.2],poison:['poison',0.5,1],laser:['laser',0.3,1.2],meteor:['explode',0.6,0.8],holy:['level',0.25,1.6],shock:['slam',0.4,1.5],missile:['shot',0.4,0.6],blackhole:['magic',0.4,0.6],tornado:['fire',0.25,0.6],boomerang:['click',0.5,0.8],saw:['click',0.3,1.5]}[type]; if(m) play(m[0],m[1],m[2],0.12); },
  zombie(){ play('zombie',0.35,0.7+Math.random()*0.3,0.15); },
};
root.SFX=SFX;
})(this);
