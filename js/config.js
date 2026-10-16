// ===== 可調參數：難度曲線集中在此（v0.5 對齊 DESIGN-v5-zh-TW.md）=====
(function(root){
const CONFIG = {
  maxStage: 1000,
  tierDifficultyGrowth: 0.03,
  cycleLength: 10,
  stageCurve: [0.35, 0.4, 0.45, 0.5, 0.55, 0.8, 0.95, 1.1, 1.25, 1.45],
  badGateChance: [0.1, 0.12, 0.15, 0.18, 0.2, 0.3, 0.35, 0.4, 0.45, 0.5],
  tierEnemyScale: 1.8,
  tierPlayerScale: 1.8,
  tierRewardAbilityPicks: 1,
  baseStartArmy: 10,
  baseEnemyPower: 40,
  gateRows: [5, 9],
  enemyGroups: [2, 4],
  rowSpacing: 18, runSpeed: 9,
  coinPerStage: 10, coinPerTier: 50,
  movingGateChance: [0,0,0,0.25,0.3,0.3,0.35,0.35,0.4,0.4],
  timedGateChance:  [0,0,0,0,0,0.2,0.25,0.25,0.3,0.3],
  shootGateChance: 0.35,
  shootGateStep: 1, shootGateMax: 12,
  // 路障：基礎 byPos；實際數量在 stage.js 加階層／後期加成，上限 14
  obstacles: [0,0,1,1,2,2,3,3,4,5],
  obstacleLoss: { saw:0.15, hammer:0.25, pit:0.2 },
  obstacleFlat: 2,
  simObstacleHit: 0.3,
  // v0.5 槍火：人數只加射速；彈道只靠卡
  baseFireRate: 3.0,
  fireRatePerArmy: 0.035,
  fireRateCap: 28,
  gunBaseStreams: 1,
  gunTwinStreams: 2,
  gunMaxStreams: 8,
  gunDmg: 10,
  gunSpeed: 85,
  gunRange: 36,
  gunRadius: 0.06,
  pierceDmgMul: 0.85,
  maxPierce: 8,
  // 碰撞半徑
  hit: { gun:0.06, proj:0.12, boom:0.10, beam:0.08, orbit:0.14, mob:0.18, runner:0.14, fat:0.28, boss:0.55, gate:0.25 },
  horde: {
    from: 1, duration: 6,
    // v0.6：屍潮大小以「擊殺當量 KE」定義（1 KE = 1 隻基本殭屍血量）。關內逐波成長、跨關成長；第 1–3 關溫和
    keBase: [14,15,16,18,20, 22,24,26,28,26],   // 依關卡位置（每 10 關循環）第 1 波的 KE（階層 0）
    earlyMul: [0.5,0.65,0.8],                   // 第 1/2/3 關額外縮小
    waveMul: [1,1.6,2.3,3.0],                   // 第 1/2/3/4 波
    approach: 8,                                // 模擬：殭屍走到隊伍前可射擊的秒數
    minUnitW: 0.4,                              // 畫面上每隻殭屍至少代表 0.4 KE（前期少量、好打）
    contactSoldiers: 3,                         // v0.6：每 1 KE 碰到隊伍 = 損失 3 名士兵（× 階層倍率）
    leakDmg: 3,                                 // 同 contactSoldiers（模擬用名稱）
    spawnRate: [28,32,38,44,50, 62,72,85,100,78], // （舊）僅保留給圖表；實際用 keBase
    killPerShot: 1,
    packFrac: 0.12,                             // 跑道小殭屍群 = 第 1 波隻數 × packFrac
    hitsPerZombie: 3.2,
    hpMul: 1.12,
    maxParticles: 150,   // v0.6.2：粒子硬上限（原本軟上限約 250）
    maxVisible: 400,
    maxVisibleBig: 600,
    spawnDist: [20, 42],
    gunRange: 36,
    mobDmgPerShot: 0.55,
    tierCoef: 0.015,
    latePer250: 0.12,
  },
  xpPerGem: 0.15, xpPerLevel: 12, levelUpArmy: 0.1,
  chestHp: 25, chestCoins: 15, chestRecruit: 0.15,
  pickupChance: 0.5,
  // Boss 血量（相對預期兵力）
  bossHpMul: { normal: 5, mini: 4.5, boss: 5 },
  bossHpPerArmy: { mini:18, boss:28 },
  cycleBossMul: [0,0,0,0,0.55,1,1,1,1.15,1.35],
  bossAtkMul: { normal: 0.6, mini: 0.3, boss: 0.3 },
  bossPlayerDps: 0.55,
  bossMargin: { mini: 0.28, boss: 0.12 },
  bossAtkOfArmy: { mini: 0.012, boss: 0.014 }, // v0.5：Boss 更肉（戰鬥更長）但每秒攻擊下修
  bossSlamEvery: 2.6, bossSlamTelegraph: 1.1, bossSlamFrac: 0.12,
  bossEnrage: 1.35, bossSummonEvery: 4, bossSummonFrac: 0.4,
  bossUltEvery: 8.0, bossUltEveryTier: 0.02, bossUltEveryMin: 5.5,
  bossUltFromPhase: 2,
  bossUltFailBase: 0.12, bossUltFailPerTier: 0.01,
  // v0.6 Boss 鎖血與血量
  // v0.6 鎖血參數在 v6.boss
  bossPreFightCap: 0.15,
  bossEntryCarry: 0.55,      // 進戰前最多被打掉 15%
  bossHpBoost: { mini: [1.6,1.6,1.6,1.6,1.6,1.4,1.4,1.3,1.3,1.3], boss: [1.5,1.5,1.6,1.7,1.8,7,13,11,2.8,4.3], bossLater: [1.5,1.5,1.6,1.7,1.8,3.6,3.6,3.4,2.8,3.6], endlessMini: 2, endlessBoss: 3, finalTierMul: 1.35, finalTierMulEarly: 1.3, miniT0Late: 0.55 },   // v0.6 瀏覽器機器人實測後的 Boss HP 倍率（依關卡位置 1–10）
  bossFightTime: { mini: 14, boss: 22 }, // 只用基礎槍（兵力 A）打完所需秒數（不含鎖血時間）
  bossAbilityFactor: { mini: 2.0, boss: 2.6 }, // 預期玩家到 Boss 時的能力加成
  simDodge: 0.5, simQteSuccess: 0.6,
  // 路障後期加成
  obsPer5Tier: 1, obsCap: 14,
  obsLateAt: [100,300,600,900], obsLateAdd: [1,1,2,2],
  // ===== v0.6（DESIGN-v6-zh-TW.md；含第二輪：pos6 waveBase 23、pos10 關底 +0.01/tier、>5 段中 Boss ×0.85）=====
  v6: {
    seg0EnemyMul: 0.45, seg0HordeMul: [1,1,1,1,1,1,1,0.75,0.6,0.75],   // 第一段（卡少、兵少）跑道殭屍群數量放寬
    t0Late: { from: 8, wave: 0.8, hp: 0.85 },   // v0.6 機器人實測：第 8–10 關（尚無階層加成、卡少）額外放寬

    zombieHits: [1.4,1.6,1.8,2.0,2.2, 2.6,2.8,3.0,3.2,3.4], hitsTierGrowth: 0.01,
    waveBase:   [8,10,12,15,15, 23,22,24,26,24],   // v0.6.1：L5 -15%（QA N8）
    stageHordeMul: { 10: 0.9 },   // v0.6.2：L10 亂選門 60%、死因多為殭屍接觸 → 屍潮 -10%
    lateZombieHp: { from: 50, mul: 1.25 },   // v0.6.2：QA v0.6.1 建議（子彈修正後 DPS 變高）
    lateFinalAtkMul: 0.8, lateFinalFromTier: 5,   // v0.6.1：高階層最終 Boss 攻擊 ×0.8（QA N7 建議 0.85，L100 實測再降）
    gateFloor: 0.4,   // v0.6.1：負面閘門最多扣到剩 40%（一般關卡）
    waveTierGrowth: 0.03,
    waveRamp:   [1.0,1.35,1.75,2.2,2.7,3.2], earlyMul: [0.6,0.75,0.9],
    waveDur:    [6,7,8,9,10,11], approachSec: 7,
    contact: { zombie:1, runner:1, fatty:3, shield:1, spitter:1, skeleton:1, slime:1, bat:1, armored:4, ghost:2, bomber:5, healer:1, summon:1,
               crawler:1, leaper:1, gold:0, elite:3, carrier:4, teleghost:2, bull:3, summoner:1 },
    contactTick: 0.25, contactCapFrac: 0.06, contactCapMin: 2,
    enemyMul: [0.5,0.5,0.55,0.6,0.6, 0.75,0.8,0.85,0.9,0.9], enemyTierGrowth: 0.01, enemySegDecay: 0.2,
    boss: {
      miniEq: [30,34,38,42,46, 55,60,65,70,80], miniManySegMul: 0.85,
      finalMulByPos: [2.2,2.2,2.2,2.2,2.0, 3.0,3.0,3.2,3.2,3.4], finalPos10PerTier: 0.01, tierGrowth: 0.02,
      locks: { mini:[0.5], final:[0.66,0.33] }, lockSummon: { mini:6, final:12 },
      summonHpMul: 1.5, lockTimeout: 12, ultFail: 0.18, qteAt: 0.4,
      atkFrac: { mini:0.010, final:0.022 }, slamFrac: 0.12,
      preCap: { mini:0.08, final:0.05 },
    },
    endless: { unlockStage:30, miniEvery:5, finalEvery:25, maxRevive:3, revivePenalty:0.1,
      hitsA:1.6, hitsB:0.12, hitsExp:0.85, waveA:12, waveB:0.06, miniEqA:40, miniEqB:0.05, finalMul:3,
      score:{ kill:10, waveSq:50, mini:2000, final:10000, qte:500, qtePerfect:800, army:5 }, coinPer:1000, coinDailyCap:300, zCountA: 12, zCountB: 2, zCountMax: 60, lateFrom: 20, zCountMaxLate: 90, hpGrowLate: 1.09, finalSlamMul: 1.25, threatCap: 0.5, hordeLossLo: 0.05, hordeLossHi: 0.2, adjUp: 1.15, adjDown: 0.87, adjExp: 0.3, lossEmaK: 0.5, hordeLossTarget: 0.12, chargerFrom: 6, chargerFrac: 0.12, chargerMin: 3, chargerSp: 3.0, adjMin: 0.5, adjMax: 3, regTarget: 0.05, regLo: 0.02, regHi: 0.08, chargeFullBelow:0.02, chargeMinFrac: 0.03, chargeEmaK: 0.5, chargeExp: 0.8, chargeUp: 1.5, chargeDown: 0.67, chargeKMin: 0.1, chargeKMax: 4, chargeAfter: 12, chargeSpeed: 2.5, hordeLossSoft: 0.2, hordeLossSoftMul: 0.25, bossLossSoft: 0.45, bossLossSoftMul: 0.2, hpOverDps: 1.6, simFrac: 0.75, simRamp0: 0.45, simRampN: 0.07, hpGrow: 1.05, threatFrac: 0.8, threatGrow: 1.13, armySoft: 1e9, armyHard: 1e15, bossSecMini: 25, bossSecFinal: 45 },
  },
  // ===== v0.7（DESIGN-v7-zh-TW.md）=====
  v7: {
    upgrades: [ {k:'atk',per:0.06,max:200,c0:40,w:1.0}, {k:'rate',per:0.04,max:100,c0:50,w:0.8},
      {k:'armor',per:0.015,max:60,c0:40,w:0.7}, {k:'start',per:2,max:60,c0:30,w:0.5},
      {k:'gate',per:0.04,max:60,c0:35,w:0.5}, {k:'boss',per:0.05,max:80,c0:45,w:0.5},
      {k:'crit',per:0.015,max:30,c0:45,w:0.35}, {k:'coin',per:0.08,max:25,c0:60,w:0.6} ],
    priceExp: 1.5, priceGrowth: 1.04,
    coin: { clearA:15, clearB:2.4, clearExp:1.15, pos10Mul:2, waveA:2, waveB:0.3, segA:5, segB:0.9, exp:1.1, failClearFrac:0.3, rouA:10, rouB:1.2, permSlots:2, restBonus:1.2 },
    wallAnchors: [[10,1.1],[20,1.8],[30,2.7],[40,3.6],[50,4.6],[60,5.4],[70,6.3],[80,7.1],[90,7.9],[100,8.7],[150,12.5],[200,17.5],[300,29],[500,60],[750,95],[1000,130]],
    restPos5: 0.85, enemyWallExp: 0.5,
    zombieHpMul: 1.3, bossHpMul: 1.4, bossHpMulEarly: [1.2,1.2,1.2],
    firstHordeAdd: 10, lastHordeMin: 50, lastWaveDur: 12, lastWaveHpEarly: [0.6,0.7,0.8],
    mulGate: { value: 2, capEarly: 2, capHard: 1, capEarlyAfter100: 3 }, plusGate: [8, 30],
    stoneGate: { from:11, tapsA:3, tapsStep:20, tapsMax:10, hardFrom:151, hardChance:0.15, hardExtra:3,
      hitExpand:1.4, hitMinPx:88, tapMaxMs:280, tapSlopPx:14, tapMinGapMs:60, tapRange:[8,40],
      penalty:{ lossFrac:0.12, lossFlat:3, stunSec:0.6, halfIfTapped:0.5, hardLossFrac:0.15, hardStun:0.8 },
      bossLevelMax:1, pGood:[[1,0.85],[41,0.75],[101,0.65],[301,0.55]], restBonus:0.10, newBoost:{ mul:3, levels:3 },
      unlockMap:{21:11,26:14,31:17,41:21,51:26,61:31,71:41,81:51,91:61} }, // v0.7 特殊門企劃 §8；威霆：石頭門第 11 關起，開放關卡等比例提前
    unlocks:{ upgrades:{ atk:2, armor:2, start:2, rate:3, gate:5, coin:8, boss:10, crit:15 }, qte:{ mash_meter:1, shrink_ring:1, charge_green:3, grid_1to9:10, swipe_arrows:15, memory_colors:25, find_impostor:35 }, obstacles:{ saw:3, pit:4, hammer:6, push:8 } }, // 特殊門企劃 §6／§8
    endless: { hitsA:1.6, hitsG:1.06, waveA:12, waveB:1.5, waveMax:90, pickEvery:2, miniPicks:1, finalPicks:2, armyG:1.04, miniEqA:40, miniEqB:0.05, finalMul:3 },
  },
  // 輪盤
  rouletteSlots: 12, rouletteOwned: 1.35, rouletteRecent: 5, rouletteRecentMul: 0.4, rouletteNewPity: 3, rouletteAutoClaim: 3,
};
if (typeof module !== 'undefined') module.exports = CONFIG; else root.CONFIG = CONFIG;
})(this);
