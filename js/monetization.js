// 金流/廣告抽象層：瀏覽器 = stub；Android（Capacitor）= AdMob 底部自適應橫幅 + Play Billing（cordova-plugin-purchase）
// 原則：常駐只有底部橫幅；不自動跳出任何廣告、沒有插頁。唯一例外：玩家自己按下「看廣告換 10 次復活」才播 1 支獎勵影片。
(function(root){
const AD = { // Google 官方「測試用」ID（正式上架前替換）
  appId: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-3940256099942544/9214589741',
  rewarded: 'ca-app-pub-3940256099942544/5224354917', // 只在玩家自願點按「看廣告換復活」時播放
};
const SKU='remove_ads', FLAG='gr_adfree';
const isAdFree=()=>localStorage.getItem(FLAG)==='1';
const setAdFree=v=>{ if(v) localStorage.setItem(FLAG,'1'); else localStorage.removeItem(FLAG); };
const nb=()=>root.NativeBridge;
const WEB=!!(root.GR_BUILD&&root.GR_BUILD.web); // 網頁版建置旗標（tools/build-web.sh 注入）：沒有廣告、沒有內購
const isNative=()=>!!(nb()&&nb().Capacitor.isNativePlatform());
let el=null, bannerShown=false, storeReady=false, listeners=[];
function reserve(px){ document.documentElement.style.setProperty('--banner-h',px+'px'); if(root.dispatchEvent) root.dispatchEvent(new Event('resize')); }
const notify=()=>listeners.forEach(f=>{ try{f(isAdFree());}catch(e){} });
// ---------- Play Billing ----------
function initStore(){ const CP=root.CdvPurchase; if(!CP||!CP.store) return Promise.resolve(false);
  const store=CP.store, P=CP.Platform.GOOGLE_PLAY;
  store.register([{id:SKU,type:CP.ProductType.NON_CONSUMABLE,platform:P}]);
  store.when()
    .approved(t=>t.verify())                 // 無後端：本機驗證（cordova-plugin-purchase 預設接受）
    .verified(r=>r.finish())                  // finish() = acknowledge（Play 3 天內未 acknowledge 會自動退款）
    .finished(()=>{ refreshOwned(); })
    .productUpdated(()=>refreshOwned())
    .receiptUpdated(()=>refreshOwned());
  return store.initialize([P]).then(()=>{ storeReady=true; refreshOwned(); return true; }).catch(e=>{ console.warn('store init',e); return false; }); }
function refreshOwned(){ const CP=root.CdvPurchase; if(!CP) return; const owned=CP.store.owned(SKU);
  if(owned&&!isAdFree()){ setAdFree(true); M.hideBanner(); notify(); } }
// ---------- AdMob ----------
async function showNativeBanner(){ const {AdMob,BannerAdSize,BannerAdPosition,BannerAdPluginEvents,AdmobConsentStatus}=nb();
  await AdMob.initialize({ initializeForTesting:true });
  // UMP：先取得同意資訊，必要時顯示同意表單；canRequestAds 為 false 就不請求廣告
  let info=await AdMob.requestConsentInfo();
  if(!info.canRequestAds && info.isConsentFormAvailable && info.status===AdmobConsentStatus.REQUIRED) info=await AdMob.showConsentForm();
  if(!info.canRequestAds || isAdFree()){ reserve(0); return; } // 未同意 → 不請求廣告，也不留空白
  AdMob.addListener(BannerAdPluginEvents.SizeChanged, s=>reserve(Math.ceil(s.height||0)));
  await AdMob.showBanner({ adId:AD.banner, adSize:BannerAdSize.ADAPTIVE_BANNER, position:BannerAdPosition.BOTTOM_CENTER, margin:0, isTesting:true });
  bannerShown=true; }
const M = {
  provider:'stub', AD, SKU,
  isAdFree, isNative,
  onChange(f){ listeners.push(f); },
  isWeb:()=>WEB,
  async init(bannerEl){ el=bannerEl; if(WEB){ this.provider='web'; if(el) el.style.display='none'; reserve(0); return; } if(!isNative()){ this.showBanner(el); return; }
    this.provider='native'; if(el){ el.textContent=''; el.style.background='#000'; }
    reserve(isAdFree()?0:60);            // 先保留 60px，載入後依實際高度調整
    await initStore();                    // 啟動時還原購買（owned → 立即隱藏）
    if(!isAdFree()) { try{ await showNativeBanner(); }catch(e){ console.warn('banner',e); reserve(0); } } else reserve(0); },
  showBanner(e){ el=e||el; if(WEB){ if(el) el.style.display='none'; reserve(0); return; } if(isNative()) return; if(!el) return; if(isAdFree()){ el.style.display='none'; reserve(0); return; } el.style.display='flex'; el.textContent='廣告橫幅區（預留）'; reserve(60); },
  hideBanner(){ if(isNative()){ const a=nb()&&nb().AdMob; if(a&&bannerShown){ a.removeBanner().catch(()=>{}); bannerShown=false; } }
    if(el) el.style.display='none'; reserve(0); },
  async purchaseRemoveAds(){ if(WEB) return false;
    if(!isNative()){ const ok=confirm('【測試用 Stub】模擬購買「移除廣告」？（不會實際付款）'); if(ok){ setAdFree(true); this.hideBanner(); notify(); } return ok; }
    const CP=root.CdvPurchase; if(!CP||!storeReady){ alert('商店尚未就緒，請稍後再試'); return false; }
    const p=CP.store.get(SKU,CP.Platform.GOOGLE_PLAY); const offer=p&&p.getOffer(); if(!offer){ alert('找不到商品 remove_ads（測試軌是否已建立？）'); return false; }
    const err=await CP.store.order(offer); if(err&&err.code!==CP.ErrorCode.PAYMENT_CANCELLED) alert('購買失敗：'+err.message); return !err; },
  async restorePurchases(){ if(!isNative()) return isAdFree(); const CP=root.CdvPurchase; if(!CP) return false; await CP.store.restorePurchases(); refreshOwned(); return isAdFree(); },
  // 玩家主動點按才呼叫；回傳是否獲得獎勵
  async showRewarded(){ if(WEB) return false;
    if(!isNative()) return confirm('【測試用 Stub】模擬觀看一支獎勵廣告，獲得 10 次復活？');
    const {AdMob}=nb(); try{ const info=await AdMob.requestConsentInfo(); if(!info.canRequestAds){ alert('尚未取得廣告同意，可到「隱私/廣告同意設定」調整'); return false; }
      await AdMob.prepareRewardVideoAd({ adId:AD.rewarded, isTesting:true }); const r=await AdMob.showRewardVideoAd(); return !!r; }
    catch(e){ alert('廣告暫時無法載入，請稍後再試'); return false; } },
  async privacyOptions(){ if(!isNative()) return false; try{ await nb().AdMob.showPrivacyOptionsForm(); return true; }catch(e){ return false; } },
};
root.Monetization = M;
})(this);
