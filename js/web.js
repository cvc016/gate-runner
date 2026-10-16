// 網頁版（GitHub Pages / iPhone Safari）外掛：Service Worker、版本字樣、iOS 手勢處理。由 tools/build-web.sh 注入
(function(){
  var V=(window.GR_BUILD&&window.GR_BUILD.version)||'';
  // 版本字樣：放在「攻略／提示」（含提示開關等設定）與暫停畫面底部
  ['guide','pause'].forEach(function(id){ var o=document.getElementById(id); if(!o) return; var d=document.createElement('div'); d.className='webver'; d.textContent='web '+V; o.appendChild(d); });
  // iOS：擋掉雙指縮放（gesture*）、雙擊放大、長按選單；不攔 touchend，避免連點 QTE 失效
  ['gesturestart','gesturechange','gestureend'].forEach(function(ev){ document.addEventListener(ev,function(e){ e.preventDefault(); },{passive:false}); });
  document.addEventListener('touchmove',function(e){ if(e.touches&&e.touches.length>1) e.preventDefault(); },{passive:false});
  document.addEventListener('dblclick',function(e){ e.preventDefault(); },{passive:false});
  document.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  document.addEventListener('selectstart',function(e){ e.preventDefault(); });
  // 下拉重新整理：不在可捲動清單內的單指拖曳一律取消預設捲動
  document.addEventListener('touchmove',function(e){ var t=e.target; while(t&&t!==document.body){ if(t.scrollHeight>t.clientHeight+1){ var cs=getComputedStyle(t); if(/(auto|scroll)/.test(cs.overflowY)) return; } t=t.parentElement; } if(e.cancelable) e.preventDefault(); },{passive:false});
  // Service Worker：版本化快取；新版啟用後自動重新載入一次
  if('serviceWorker' in navigator && location.protocol!=='file:'){
    var reloaded=false, had=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',function(){ if(!had){ had=true; return; } if(reloaded) return; reloaded=true; location.reload(); });
    window.addEventListener('load',function(){ navigator.serviceWorker.register('sw.js',{scope:'./'}).then(function(r){ r.update&&r.update(); }).catch(function(e){ console.warn('sw',e); }); });
  }
})();
