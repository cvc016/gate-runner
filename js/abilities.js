(function(root){
// rarity: C 普通 / R 稀有 / E 史詩 / L 傳說
const A=(id,name,rar,desc,fx,max)=>({id,name,rar,desc,fx,max:max||5});
// 武器：每級 +1 武器等級；Boss 傷害 +4%/級
const WP=(id,name,rar,desc,max)=>({id,name,rar,desc:desc+'（升級＝傷害 +40%；投射物數靠「+1」卡）',weapon:true,max:max||5,fx:s=>{ s.weapons[id]=(s.weapons[id]||0)+1; s.bossDmg+=0.03; },proj:1});
// 武器視覺/元素設定（遊戲端使用）
const WEAPONS={ fireball:{elem:'fire',vis:'fireball',cd:1.1,k:1.6}, iceShard:{elem:'ice',vis:'ice',cd:1.0,k:1.4}, chainLightning:{elem:'thunder',vis:'lightning',cd:1.2,k:1.7},
  arcaneOrb:{elem:'arcane',vis:'arcane',cd:0.9,k:1.4}, poisonCloud:{elem:'nature',vis:'poison',cd:2.2,k:1.5}, laser:{elem:'thunder',vis:'laser',cd:1.8,k:2.0},
  meteorW:{elem:'fire',vis:'meteor',cd:2.4,k:2.2}, tornado:{elem:'nature',vis:'tornado',cd:2.6,k:2.0}, boomerang:{elem:'phys',vis:'boomerang',cd:1.4,k:1.3},
  orbitSaw:{elem:'phys',vis:'saw',cd:0.5,k:1.2}, holyLight:{elem:'holy',vis:'holy',cd:1.6,k:1.8}, shockwave:{elem:'phys',vis:'shock',cd:2.0,k:1.5},
  missiles:{elem:'phys',vis:'missile',cd:1.3,k:1.6}, blackHoleW:{elem:'arcane',vis:'blackhole',cd:3.5,k:2.8} };
const ABILITIES=[
 A('gateAdd','加法強化','C','+閘門數值 +20%',s=>s.addMul+=0.2),
 A('gateMul','乘法強化','R','x 閘門額外 +0.5',s=>s.mulAdd+=0.5,3),
 A('badHalf','厄運減半','C','負面閘門效果減半',s=>s.badMul*=0.5,2),
 A('badImmune','神聖庇護','L','完全無視 ÷ 閘門',s=>s.noDiv=true,1),
 A('shield','能量護盾','R','每關抵擋 1 次敵群傷害',s=>s.shields+=1,3),
 A('crit','致命一擊','C','爆擊率 +15%',s=>s.crit+=0.15),
 A('critDmg','爆擊傷害','R','爆擊倍率 +0.5',s=>s.critMul+=0.5),
 A('splash','濺射','R','戰鬥時額外擊殺 10% 敵人',s=>s.splash+=0.1,4),
 A('magnet','金幣磁鐵','C','吸取金幣範圍擴大',s=>s.magnet+=0.3,3),
 A('extraLane','第三車道','E','閘門變成 3 選 1',s=>s.lanes=3,1),
 A('regen','再生','C','每秒 +1% 兵力',s=>s.regen+=0.01),
 A('ranged','遠程射擊','R','自動射擊前方敵群（射速 +35%）',s=>s.ranged+=1),
 A('twinGun','雙槍','R','基礎槍固定 2 道彈道（人數不會增加彈道）',s=>s.twinGun=true,1),
 A('gunStream','加裝槍管','R','槍彈道 +1（上限 8）',s=>s.gunStreams=(s.gunStreams||0)+1,6),
 A('pierce','穿甲彈','R','子彈穿透 +1（每穿 1 隻傷害 ×0.85）',s=>s.pierce+=1,8),
 A('atk','鋒利武器','C','攻擊力 +15%',s=>s.atk+=0.15),
 A('armor','重甲','C','戰鬥損失 -10%',s=>s.armor=Math.min(0.7,s.armor+0.1)),
 A('recruit','徵兵令','C','每關起始兵力 +5',s=>s.startAdd+=5),
 A('coin','貪婪','C','金幣 +25%',s=>s.coinMul+=0.25),
 A('bossDmg','屠龍者','R','對 Boss 傷害 +30%',s=>s.bossDmg+=0.3),
 A('speed','疾行','C','移動速度 +10%',s=>s.speed+=0.1,3),
 A('vamp','吸血','R','擊殺敵人回復 5% 兵力',s=>s.vamp+=0.05,3),
 A('fire','火焰彈','R','射擊附加燃燒',s=>s.fire+=1,3),
 A('ice','冰霜','R','Boss 攻擊 -15%',s=>s.bossSlow+=0.15,3),
 A('lucky','幸運','C','負面閘門 10% 失效並變成 +3 金幣',s=>s.luck+=0.1,3),
 A('double','雙重閘門','E','10% 機率閘門觸發兩次',s=>s.doubleGate+=0.1,3),
 A('rage','狂怒','R','兵力 <20 時攻擊 x2',s=>s.rage=true,1),
 A('fortify','堡壘','R','關卡結束保留 10% 剩餘兵力',s=>s.carry+=0.1,3),
 A('thunder','雷擊','E','每 3 秒落雷擊殺敵人',s=>s.thunder+=1,3),
 A('clone','分身','E','+ 閘門 +2；x 閘門額外生出一支小隊（+5）',s=>s.cloneAdd+=2,3),
 A('banner','戰旗','R','Boss 戰開始兵力 +15%',s=>s.bossStart+=0.15,3),
 A('second','背水一戰','L','兵力歸零時以 10 兵復活一次',s=>s.revive+=1,1),
 A('gold','點金','E','x 閘門給金幣；負面閘門 30% 轉為金幣',s=>s.goldGate=true,1),
 A('scout','偵察','C','顯示更遠的閘門',s=>s.view+=0.3,2),
 A('drill','操練','C','所有閘門 +1',s=>s.flatGate+=1),
 A('mortar','迫擊砲','E','射擊造成範圍傷害',s=>s.aoe+=0.5,2),
 // ---- v3 元素武器（疊在基礎槍火之上，各自有獨立視覺）----
 WP('fireball','火球術','R','發射火球，爆炸並燃燒周圍敵人'),
 WP('iceShard','冰錐','R','扇形冰錐，凍結敵人使其減速'),
 WP('chainLightning','連鎖閃電','R','閃電在敵人之間跳躍'),
 WP('arcaneOrb','魔法飛彈','R','追蹤敵人的魔法光球'),
 WP('poisonCloud','毒霧','R','在敵群中留下持續毒雲'),
 WP('laser','雷射光束','E','貫穿整條跑道的光束'),
 WP('meteorW','隕石術','E','從天而降的隕石，大範圍爆炸'),
 WP('tornado','龍捲風','E','沿跑道前進捲起敵人'),
 WP('boomerang','迴旋鏢','C','飛出再飛回，來回切割'),
 WP('orbitSaw','環繞鋸刃','R','鋸刃環繞隊伍，絞碎靠近的敵人'),
 WP('holyLight','聖光','E','天降光柱淨化敵人'),
 WP('shockwave','震波','C','以隊伍為中心擴散的地面震波'),
 WP('missiles','追蹤飛彈','R','多枚飛彈自動鎖定'),
 WP('blackHoleW','黑洞','L','吸入周圍敵人後吞噬',3),
 // ---- v3 武器被動 ----
 A('burn','灼燒','C','火系武器傷害 +20%',s=>s.wElem.fire+=0.2),
 A('frostbite','凍傷','C','敵人移動 -15%（冰系 +20%）',s=>{s.slowZ=Math.min(0.6,s.slowZ+0.15);s.wElem.ice+=0.2;}),
 A('conductor','導體','R','閃電多跳 1 次、雷系 +20%',s=>{s.chain+=1;s.wElem.thunder+=0.2;},3),
 A('arcaneFocus','魔法專注','C','魔法武器傷害 +25%',s=>s.wElem.arcane+=0.25),
 A('toxin','劇毒','C','範圍 +15%、自然系 +20%',s=>{s.area+=0.15;s.wElem.nature+=0.2;}),
 A('lens','聚焦鏡','R','雷射傷害 +40%',s=>s.wMul.laser=(s.wMul.laser||1)+0.4,3),
 A('gravity','重力井','R','黑洞/震波範圍 +30%',s=>{s.area+=0.1;s.wMul.blackHoleW=(s.wMul.blackHoleW||1)+0.3;s.wMul.shockwave=(s.wMul.shockwave||1)+0.3;},3),
 A('wingman','僚機','R','飛彈 +1 枚',s=>s.wMul.missiles=(s.wMul.missiles||1)+0.35,3),
 A('sharpen','磨刃','C','鋸刃/迴旋鏢 +1 片',s=>{s.wMul.orbitSaw=(s.wMul.orbitSaw||1)+0.3;s.wMul.boomerang=(s.wMul.boomerang||1)+0.3;},3),
 A('blessing','祝福','R','聖光命中時回復兵力',s=>{s.holyHeal+=0.01;s.wElem.holy+=0.2;},3),
 A('quickCast','快速施法','C','所有武器頻率 +10%',s=>s.cdMul*=1.1),
 A('resAmp','共鳴增幅','L','元素共鳴只需 2 級',s=>s.resThr=2,1),
 // v0.5：各武器 +1 投射物卡（需已擁有該武器）
 ...[['fireball','+1 火球'],['iceShard','+1 冰錐'],['chainLightning','+1 閃電'],['arcaneOrb','+1 魔法飛彈'],['poisonCloud','+1 毒霧'],
   ['laser','+1 雷射'],['meteorW','+1 隕石'],['tornado','+1 龍捲'],['boomerang','+1 迴旋鏢'],['orbitSaw','+1 鋸刃'],
   ['holyLight','+1 聖光'],['shockwave','+1 震波'],['missiles','+1 飛彈'],['blackHoleW','+1 黑洞']]
   .map(([id,n])=>A('p_'+id,n,'C',n+'（投射物數 +1）',s=>{s.wProj[id]=(s.wProj[id]||0)+1;},4)),
];
// 組合技：同時擁有 req 中所有能力 → 觸發
// 特殊能力（組合技）：達成條件後「解鎖」→ 以候選卡出現在三選一（不自動獲得）→ 可升到 Lv5
// 條件：2 件組 = 第一件 Lv2 + 第二件 Lv1；3 件組 = 三件各 Lv1
const S=(id,name,req,desc,fx)=>({id,name,req,desc,fx,key:'syn_'+id,max:5,need:Object.fromEntries(req.map((r,i)=>[r,req.length===2&&i===0?2:1]))});
const fixNeed=()=>SYNERGIES.forEach(s=>{ if(s.needX){ s.need=Object.assign({},s.needX); return; } for(const r of s.req){ const a=ABILITIES.find(x=>x.id===r); if(a&&s.need[r]>a.max) s.need[r]=a.max; } if(s.req.length===2&&s.req.some(r=>{ const a=ABILITIES.find(x=>x.id===r); return a&&(a.rar==='E'||a.rar==='L'); })){ s.req.forEach(r=>s.need[r]=1); return; } /* QA 方案 F：含史詩/傳說的 2 件組門檻 Lv1+Lv1 */
  if(s.req.length===2&&s.req.every(r=>s.need[r]<2)){ const r=s.req.find(r=>ABILITIES.find(x=>x.id===r).max>=2); if(r) s.need[r]=2; } });
const SYNERGIES=[
 S('railgun','電磁砲',['crit','pierce'],'射擊必爆且無限穿透',s=>{s.pierce+=99;s.rangedCrit=true;}),
 S('phalanx','方陣',['shield','armor'],'護盾 +2，損失再 -15%',s=>{s.shields+=2;s.armor=Math.min(0.85,s.armor+0.15);}),
 S('blackhole','黑洞',['magnet','splash'],'濺射 +25%',s=>s.splash+=0.25),
 S('hydra','九頭蛇',['regen','vamp'],'再生 x3',s=>s.regen*=3),
 S('alchemy','煉金術',['gateMul','gold'],'x 閘門再 +1',s=>s.mulAdd+=1),
 S('meteor','隕石雨',['fire','mortar'],'範圍傷害 x2',s=>s.aoe*=2),
 S('frostfire','冰火交織',['fire','ice'],'Boss 攻擊再 -25%',s=>s.bossSlow+=0.25),
 S('storm','雷暴',['thunder','ranged'],'雷擊頻率 x2',s=>s.thunder*=2),
 S('legion','軍團',['recruit','clone'],'起始兵力 x1.5',s=>s.startMulX=1.5),
 S('berserk','狂戰士',['rage','atk'],'攻擊 +50%',s=>s.atk+=0.5),
 S('dragon','屠龍軍',['bossDmg','banner'],'Boss 傷害 +60%',s=>s.bossDmg+=0.6),
 S('phoenix','不死鳥',['second','regen'],'復活 +1 且兵力 30',s=>{s.revive+=1;s.reviveN=30;}),
 S('fortune','財神',['coin','lucky'],'金幣 x2',s=>s.coinMul*=2),
 S('mirror','鏡像',['double','gateAdd'],'雙重閘門機率 +20%',s=>s.doubleGate+=0.2),
 S('sniper','狙擊手',['scout','crit'],'爆擊率 +25%',s=>s.crit+=0.25),
 S('trident','三叉戟',['extraLane','pierce'],'射擊數 +2',s=>s.ranged+=2),
 S('holy','聖騎士',['badImmune','shield'],'負面閘門全免疫',s=>s.badMul=0),
 S('engine','戰爭機器',['mortar','armor','atk'],'攻擊 +40% 損失 -10%',s=>{s.atk+=0.4;s.armor=Math.min(0.85,s.armor+0.1);}),
 S('firestorm','火焰龍捲',['fireball','tornado'],'火球與龍捲風傷害 x1.5',s=>{wm(s,'fireball',1.5);wm(s,'tornado',1.5);}),
 S('shatter','碎冰',['iceShard','shockwave'],'震波粉碎冰凍敵人：兩者 x1.5',s=>{wm(s,'iceShard',1.5);wm(s,'shockwave',1.5);}),
 S('superconduct','超導',['chainLightning','iceShard'],'閃電 +2 跳、冰錐 x1.3',s=>{s.chain+=2;wm(s,'iceShard',1.3);}),
 S('arcaneStorm','魔法風暴',['arcaneOrb','chainLightning'],'魔法飛彈附帶閃電 x1.5',s=>{wm(s,'arcaneOrb',1.5);wm(s,'chainLightning',1.2);}),
 S('plague','瘟疫',['poisonCloud','vamp'],'毒霧 x1.6，擊殺回血',s=>{wm(s,'poisonCloud',1.6);s.vamp+=0.03;}),
 S('prism','稜鏡',['laser','holyLight'],'雷射分裂、聖光 x1.4',s=>{wm(s,'laser',1.5);wm(s,'holyLight',1.4);}),
 S('armageddon','末日',['meteorW','blackHoleW'],'隕石與黑洞 x1.8',s=>{wm(s,'meteorW',1.8);wm(s,'blackHoleW',1.8);}),
 S('returnBlade','回旋刃',['boomerang','orbitSaw'],'鋸刃與迴旋鏢 x1.6',s=>{wm(s,'boomerang',1.6);wm(s,'orbitSaw',1.6);}),
 S('judgement','審判',['holyLight','bossDmg'],'Boss 傷害再 +40%',s=>s.bossDmg+=0.4),
 S('barrage','飽和打擊',['missiles','ranged'],'飛彈 x1.6、射速 +20%',s=>{wm(s,'missiles',1.6);s.evoFire*=1.2;}),
 S('singularity','奇點',['blackHoleW','gravity'],'黑洞 x2',s=>wm(s,'blackHoleW',2)),
 S('wildfire','野火',['burn','poisonCloud'],'火系與自然系 +40%',s=>{s.wElem.fire+=0.4;s.wElem.nature+=0.4;}),
 S('tempest','暴風',['tornado','thunder'],'龍捲風帶電 x1.5、雷擊 x2',s=>{wm(s,'tornado',1.5);s.thunder*=2;}),
 // ===== 終極（傳說）特殊能力：全螢幕攻擊，冷卻長，等級越高越強 =====
 Object.assign(S('ultMeteor','終極・流星雨',['meteorW','fireball'],'🌟 全螢幕流星雨：每 14 秒砸遍整個畫面',s=>{s.ult.meteor=1;}),{ult:'meteor',needX:{meteorW:3,fireball:2}}),
 Object.assign(S('ultStorm','終極・雷霆風暴',['chainLightning','laser'],'🌟 全螢幕雷暴：每 13 秒落雷劈遍所有敵人',s=>{s.ult.storm=1;}),{ult:'storm',needX:{chainLightning:3,laser:2}}),
 Object.assign(S('ultBlizzard','終極・絕對零度',['iceShard','tornado'],'🌟 全螢幕暴風雪：每 15 秒凍結所有敵人並造成傷害',s=>{s.ult.blizzard=1;}),{ult:'blizzard',needX:{iceShard:3,tornado:2}}),
 Object.assign(S('ultJudgement','終極・神聖審判',['holyLight','shockwave'],'🌟 全螢幕聖光新星：每 14 秒淨化畫面上所有敵人',s=>{s.ult.judgement=1;}),{ult:'judgement',needX:{holyLight:3,shockwave:2}}),
 Object.assign(S('ultSingularity','終極・奇點坍縮',['blackHoleW','arcaneOrb'],'🌟 全螢幕黑洞：每 16 秒把所有敵人吸到中心壓碎',s=>{s.ult.singularity=1;}),{ult:'singularity',needX:{blackHoleW:2,arcaneOrb:3}}),
];
function wm(s,id,k){ s.wMul[id]=(s.wMul[id]||1)*k; }
function baseStats(meta){ meta=meta||{}; const U_=(typeof Upgrades!=='undefined'?Upgrades:(typeof root!=='undefined'&&root.Upgrades)||(typeof require!=='undefined'?require('./upgrades.js'):null)); const s0=baseStats0(meta); return U_?U_.apply(s0,meta):s0; }
function baseStats0(meta){ return {ult:{},gunStreams:0,wProj:{},addMul:1+(meta.gate||0)*0.05,mulAdd:0,badMul:1,noDiv:false,shields:0,crit:0.05+(meta.crit||0)*0.02,critMul:2,splash:0,magnet:0.15,lanes:2,regen:0,ranged:0,pierce:0,atk:1+(meta.atk||0)*0.05,armor:(meta.armor||0)*0.03,startAdd:(meta.start||0)*3,coinMul:1+(meta.coin||0)*0.1,bossDmg:0,speed:1,vamp:0,fire:0,bossSlow:0,luck:0,doubleGate:0,rage:false,carry:0,thunder:0,cloneAdd:0,bossStart:0,revive:0,reviveN:10,goldGate:false,view:0,flatGate:0,aoe:0,rangedCrit:false,startMulX:1,elem:{fire:0,ice:0,thunder:0,phys:0,arcane:0,nature:0,holy:0},evoFire:1,resonance:[],weapons:{},wMul:{},wElem:{fire:0,ice:0,thunder:0,arcane:0,nature:0,holy:0,phys:0},evoW:{},slowZ:0,chain:0,area:0,holyHeal:0,cdMul:1,resThr:3}; }
// 元素標籤：同元素 3 級以上觸發共鳴
const ELEM_TAG={fireball:'fire',meteorW:'fire',burn:'fire',iceShard:'ice',frostbite:'ice',chainLightning:'thunder',laser:'thunder',conductor:'thunder',lens:'thunder',arcaneOrb:'arcane',blackHoleW:'arcane',arcaneFocus:'arcane',gravity:'arcane',poisonCloud:'nature',tornado:'nature',toxin:'nature',holyLight:'holy',blessing:'holy',boomerang:'phys',orbitSaw:'phys',shockwave:'phys',missiles:'phys',sharpen:'phys',wingman:'phys',fire:'fire',mortar:'fire',rage:'fire',ice:'ice',armor:'ice',shield:'ice',thunder:'thunder',ranged:'thunder',speed:'thunder',atk:'phys',crit:'phys',critDmg:'phys',pierce:'phys',splash:'phys'};
const ELEM_NAME={fire:'🔥火',ice:'❄️冰',thunder:'⚡雷',phys:'🗡️物理',arcane:'🔮魔法',nature:'☠️自然',holy:'✨神聖'};
const RESONANCE={fire:['烈焰共鳴','攻擊 +25%',s=>s.atk+=0.25],ice:['寒冰共鳴','Boss 攻擊 -20%',s=>s.bossSlow+=0.2],thunder:['雷霆共鳴','射速 x1.3',s=>s.evoFire*=1.3],phys:['鋼鐵共鳴','爆擊傷害 +1',s=>s.critMul+=1],arcane:['魔法共鳴','所有武器 +20%',s=>{for(const k in s.wElem) s.wElem[k]+=0.2;}],nature:['自然共鳴','敵人移動 -20%',s=>s.slowZ=Math.min(0.7,s.slowZ+0.2)],holy:['神聖共鳴','每秒回復 1% 兵力',s=>s.regen+=0.01]};
// 進化（Vampire Survivors 式）：base 滿級 + 擁有 partner → 出現進化卡
const EV=(id,name,base,partner,desc,fx)=>({id,name,base,partner,desc,fx,rar:'EVO'});
const EVOLUTIONS=[
 EV('evoRanged','彈幕風暴','ranged','atk','射速 x2，Boss 傷害 +30%',s=>{s.evoFire*=2;s.bossDmg+=0.3;}),
 EV('evoCrit','死神之鐮','crit','critDmg','爆擊率 +30%，爆擊倍率 +1',s=>{s.crit+=0.3;s.critMul+=1;}),
 EV('evoGate','黃金比例','gateAdd','drill','+閘門再 +60%、所有閘門 +5',s=>{s.addMul+=0.6;s.flatGate+=5;}),
 EV('evoRegen','生命之樹','regen','vamp','再生 x2、吸血 +10%',s=>{s.regen*=2;s.vamp+=0.1;}),
 EV('evoArmor','不動要塞','armor','shield','損失再 -15%、護盾 +2',s=>{s.armor=Math.min(0.9,s.armor+0.15);s.shields+=2;}),
 EV('evoAtk','神兵','atk','splash','攻擊 +60%',s=>s.atk+=0.6),
 EV('evoCoin','點石成金','coin','magnet','金幣 x2',s=>s.coinMul*=2),
 EV('evoRecruit','百萬大軍','recruit','banner','起始兵力 x1.4、Boss 戰兵力 +25%',s=>{s.startMulX*=1.4;s.bossStart+=0.25;}),
 ...[['fireball','burn','炎龍吐息'],['iceShard','frostbite','絕對零度'],['chainLightning','conductor','雷神之怒'],['arcaneOrb','arcaneFocus','星辰隕落'],['poisonCloud','toxin','死亡沼澤'],
   ['laser','lens','殲滅光炮'],['meteorW','mortar','天火'],['tornado','speed','颶風'],['boomerang','critDmg','月輪'],['orbitSaw','sharpen','絞肉機'],
   ['holyLight','blessing','神域'],['shockwave','armor','大地震'],['missiles','wingman','蜂群飛彈'],['blackHoleW','gravity','事件視界']]
   .map(([b,p,n])=>EV('evo_'+b,n,b,p,'武器進化：傷害 x2.5、特效升級',s=>{ wm(s,b,2.5); s.evoW[b]=1; })),
];
const abById=id=>ABILITIES.find(a=>a.id===id);
function availableEvolutions(build){ return EVOLUTIONS.filter(e=>!build[e.id]&&(build[e.base]||0)>=abById(e.base).max&&(build[e.partner]||0)>0); }
fixNeed();
function synUnlocked(s,build){ return s.req.every(r=>(build[r]||0)>=s.need[r]); }
function unlockedSynergies(build){ return SYNERGIES.filter(s=>synUnlocked(s,build)); }
function activeSynergies(build){ return SYNERGIES.filter(s=>(build[s.key]||0)>0&&synUnlocked(s,build)); }
function unlockHint(s,build){ return s.req.map(r=>`${abById(r).name} Lv${s.need[r]}${(build[r]||0)>=s.need[r]?'✓':''}`).join(' + '); }
// 特殊能力的候選卡物件
function specialCard(s,build){ const lv=(build[s.key]||0)+1; return {ult:s.ult,id:s.key,name:(s.ult?'🌟 ':'★ ')+s.name,rar:'SP',max:s.max,desc:lv===1?s.desc:`${s.desc}；Lv${lv}：武器冷卻再 -10%、攻擊 +10%`,special:s.id}; }
function computeStats(build, meta){ const s=baseStats(meta); for(const a of ABILITIES){ for(let i=0;i<(build[a.id]||0);i++) a.fx(s);} for(const y of activeSynergies(build)){ y.fx(s); const lv=build[y.key]||1; if(lv>1){ s.cdMul*=1+0.1*(lv-1); s.atk*=1+0.1*(lv-1); } }
  for(const a of ABILITIES){ const e=ELEM_TAG[a.id]; if(e) s.elem[e]+=(build[a.id]||0); }
  for(const k in RESONANCE) if(s.elem[k]>=s.resThr){ RESONANCE[k][2](s); s.resonance.push(k); }
  for(const e of EVOLUTIONS) if(build[e.id]) e.fx(s);
  return s; }
const W={C:60,R:28,E:18,L:12}; // QA 方案 F
// 組合技補位：已擁有某組合技的部分需求時，缺的那張權重 x SYN_BOOST（讓 18 組在前 3 階內實際可湊齊）
const SYN_BOOST=5; // 溫和補位（不讓剛選的能力每次都出現）
function weightOf(a, build){ let w=W[a.rar]*((build[a.id]||0)>0?2:1); /* 已擁有 → 升級卡 x2（溫和） */ if(!(build[a.id]>0) && SYNERGIES.some(s=>s.req.includes(a.id)&&s.req.some(q=>q!==a.id&&build[q]>0))) w*=SYN_BOOST;
  /* 方案 F：已擁有但還沒到某組合技門檻、另一件已擁有 → x3 */ if(build[a.id]>0&&SYNERGIES.some(s=>s.req.includes(a.id)&&build[a.id]<s.need[a.id]&&s.req.some(q=>q!==a.id&&build[q]>0))) w*=3; return w; }
// 三選一：從整個候選池加權隨機抽（新能力、已擁有能力升級、已解鎖特殊能力、進化分支），不強制塞卡
const WX={SP:250,EVO:250}; // 已解鎖特殊能力、進化分支較常出現（但不保證）
function candidatePool(build){ const pool=ABILITIES.filter(a=>(build[a.id]||0)<a.max&&!(a.id.startsWith('p_')&&!(build[a.id.slice(2)]>0))).map(a=>({a,w:weightOf(a,build)*(a.id.startsWith('p_')||a.id==='gunStream'||a.id==='twinGun'?0.9:1)}));
  for(const s of unlockedSynergies(build)) if((build[s.key]||0)<s.max) pool.push({a:specialCard(s,build),w:WX.SP});
  for(const e of availableEvolutions(build)) pool.push({a:e,w:WX.EVO}); return pool; }
// 「有用的卡」：已解鎖的特殊卡，或某組合技還缺、且另一件已擁有的需求卡
function usefulCard(a,build){ return !!a.special || SYNERGIES.some(s=>s.req.includes(a.id)&&(build[a.id]||0)<s.need[a.id]&&s.req.some(q=>q!==a.id&&build[q]>0)); }
// 保底：連續 2 次三選一都沒有有用的卡 → 下一次強制塞 1 張（state.miss 由呼叫端保存）
function rollChoices(build, r, state){ const out=rollRaw(build,r); if(!state) return out;
  if(out.some(a=>usefulCard(a,build))){ state.miss=0; return out; }
  if((state.miss||0)>=2){ const u=candidatePool(build).filter(c=>usefulCard(c.a,build)&&!out.includes(c.a)); if(u.length){ out[out.length-1]=u[Math.floor(r()*u.length)].a; state.miss=0; state.forced=(state.forced||0)+1; return out; } }
  state.miss=(state.miss||0)+1; return out; }
function rollRaw(build, r){ const pool=candidatePool(build); const out=[];
  while(out.length<3&&pool.length){ let t=pool.reduce((x,y)=>x+y.w,0), p=r()*t, k=0; for(;k<pool.length;k++){p-=pool[k].w; if(p<=0)break;} out.push(pool.splice(Math.min(k,pool.length-1),1)[0].a); }
  return out; }
const Abil={usefulCard,synUnlocked,unlockedSynergies,unlockHint,specialCard,candidatePool,WEAPONS,ABILITIES,SYNERGIES,EVOLUTIONS,ELEM_TAG,ELEM_NAME,RESONANCE,computeStats,activeSynergies,availableEvolutions,rollChoices,baseStats};
if (typeof module!=='undefined') module.exports=Abil; else root.Abil=Abil;
})(this);
