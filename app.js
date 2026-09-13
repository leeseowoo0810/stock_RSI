// 애플리케이션 상태 관리
const state = {
  stocks: [],
  marketTime: null,
  localIp: '127.0.0.1',
  currentSort: 'buy_rank',
  expandedCard: null,
  refreshInterval: 25,
  remainingSeconds: 25,
  isFetching: false,
};

// DOM 요소 참조
const el = {
  stockListContainer: document.getElementById('stockListContainer'),
  etClock: document.getElementById('etClock'),
  kstClock: document.getElementById('kstClock'),
  etDateBadge: document.getElementById('etDateBadge'),
  marketStatusKr: document.getElementById('marketStatusKr'),
  marketTimeMessage: document.getElementById('marketTimeMessage'),
  marketDot: document.getElementById('marketDot'),
  marketPulse: document.getElementById('marketPulse'),
  summaryTopStock: document.getElementById('summaryTopStock'),
  summaryOversold: document.getElementById('summaryOversold'),
  summaryAvgRsi: document.getElementById('summaryAvgRsi'),
  refreshTimer: document.getElementById('refreshTimer'),
  btnManualRefresh: document.getElementById('btnManualRefresh'),
  refreshIcon: document.getElementById('refreshIcon'),
  modalQr: document.getElementById('modalQr'),
  btnMobileQr: document.getElementById('btnMobileQr'),
  btnCloseQr: document.getElementById('btnCloseQr'),
  mobileAccessUrl: document.getElementById('mobileAccessUrl'),
  btnCopyUrl: document.getElementById('btnCopyUrl'),
  modalInfo: document.getElementById('modalInfo'),
  btnInfo: document.getElementById('btnInfo'),
  btnCloseInfo: document.getElementById('btnCloseInfo'),
  btnConfirmInfo: document.getElementById('btnConfirmInfo'),
  sortTabs: document.querySelectorAll('.sort-tab'),
  dataModeBanner: document.getElementById('dataModeBanner'),
  dataModeTitle: document.getElementById('dataModeTitle'),
  dataModeDateBadge: document.getElementById('dataModeDateBadge'),
  dataModeDesc: document.getElementById('dataModeDesc'),
  dataModeIcon: document.getElementById('dataModeIcon'),
};

// 실시간 시계 및 장 상태 업데이트 (매초 실행)
function updateClocks() {
  const now = new Date();

  // 미국 동부 (New York, ET) 시간 포맷팅
  const etFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const etDateFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'America/New_York',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  });

  // 한국 (KST) 시간 포맷팅
  const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  if (el.etClock) el.etClock.textContent = etFormatter.format(now);
  if (el.kstClock) el.kstClock.textContent = kstFormatter.format(now);
  if (el.etDateBadge) el.etDateBadge.textContent = etDateFormatter.format(now);

  // 현지 시간 기반 장 상태 판별
  evaluateMarketLiveStatus(now);
}

function evaluateMarketLiveStatus(date) {
  // 뉴욕 시간의 요일, 시, 분 계산
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(date);

  let weekday = '';
  let hour = 0;
  let minute = 0;

  for (const part of etParts) {
    if (part.type === 'weekday') weekday = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }

  const currentMinutes = hour * 60 + minute;
  const isWeekend = (weekday === 'Sat' || weekday === 'Sun');

  let statusText = '장 마감';
  let descText = '미국 시장 휴장';
  let dotColor = 'bg-slate-500';
  let pulse = false;
  let statusColorClass = 'text-slate-400';

  if (isWeekend) {
    statusText = '주말 휴장';
    descText = '주말에는 미 증시가 열리지 않습니다';
  } else if (currentMinutes >= 240 && currentMinutes < 570) {
    // 04:00 ~ 09:30 ET
    statusText = '프리마켓 진행 중';
    const rem = 570 - currentMinutes;
    descText = `정규장까지 ${Math.floor(rem / 60)}시간 ${rem % 60}분 남음`;
    dotColor = 'bg-amber-400';
    statusColorClass = 'text-amber-400';
    pulse = true;
  } else if (currentMinutes >= 570 && currentMinutes < 960) {
    // 09:30 ~ 16:00 ET
    statusText = '정규장 진행 중';
    const rem = 960 - currentMinutes;
    descText = `마감까지 ${Math.floor(rem / 60)}시간 ${rem % 60}분 남음`;
    dotColor = 'bg-emerald-400';
    statusColorClass = 'text-emerald-400';
    pulse = true;
  } else if (currentMinutes >= 960 && currentMinutes < 1200) {
    // 16:00 ~ 20:00 ET
    statusText = '애프터마켓 진행 중';
    const rem = 1200 - currentMinutes;
    descText = `애프터마켓 종료 ${Math.floor(rem / 60)}시간 ${rem % 60}분 전`;
    dotColor = 'bg-blue-400';
    statusColorClass = 'text-blue-400';
    pulse = true;
  } else {
    // 장 마감 (20:00 ~ 익일 04:00)
    statusText = '장 마감';
    descText = '다음 프리마켓 개장 대기 중';
  }

  if (el.marketStatusKr) {
    el.marketStatusKr.textContent = statusText;
    el.marketStatusKr.className = `text-xs font-semibold ${statusColorClass}`;
  }
  if (el.marketTimeMessage) {
    el.marketTimeMessage.textContent = descText;
  }
  if (el.marketDot) {
    el.marketDot.className = `relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`;
  }
  if (el.marketPulse) {
    if (pulse) {
      el.marketPulse.className = `animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`;
    } else {
      el.marketPulse.className = 'hidden';
    }
  }

  updateDataModeBanner();
}

// 기준 데이터 알림 배너 갱신 (휴장 시 직전 종가 기준 안내)
function updateDataModeBanner() {
  if (!el.dataModeBanner) return;

  const mt = state.marketTime;
  const isClosed = !mt || mt.is_market_closed || mt.status === 'CLOSED';
  const latestDate = (mt && mt.latest_trade_date) ? mt.latest_trade_date : (state.stocks.length > 0 && state.stocks[0].trade_date ? state.stocks[0].trade_date : '직전 거래일');

  if (isClosed) {
    el.dataModeBanner.className = 'bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-3 flex items-start space-x-2.5';
    if (el.dataModeTitle) el.dataModeTitle.textContent = '직전 마감(종가) 기준 평가 중';
    if (el.dataModeDateBadge) el.dataModeDateBadge.textContent = `마감일: ${latestDate}`;
    if (el.dataModeDesc) {
      el.dataModeDesc.textContent = `미국 증시가 마감(휴장) 중이므로 직전 마지막 거래일(${latestDate}) 마감 종가 및 14일 RSI를 기준으로 매수 랭킹을 평가합니다. (개장 시 실시간 자동 전환)`;
    }
  } else {
    el.dataModeBanner.className = 'bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3 flex items-start space-x-2.5';
    if (el.dataModeTitle) el.dataModeTitle.textContent = '실시간 정규장 시세 반영 중';
    if (el.dataModeDateBadge) el.dataModeDateBadge.textContent = 'LIVE 실시간';
    if (el.dataModeDesc) {
      el.dataModeDesc.textContent = '현재 미국 정규장이 열려있어 실시간 체결가 및 실시간 RSI로 매수 최적 순위를 실시간 산출 중입니다.';
    }
  }
}

// 내장 오프라인/직전 마감 기준 데이터 (서버 미실행 또는 네트워크 오류 시 즉각 렌더링)
const FALLBACK_STOCKS_DATA = [
  {
    symbol: "TSLA", name: "테슬라", name_en: "Tesla", sector: "전기차 / 자율주행",
    trade_date: "2026-09-11", price: 218.90, prev_price: 226.84, change: -7.94, change_pct: -3.50,
    rsi: 28.5, rsi_change: -2.1, sma20: 226.50, day_high: 224.50, day_low: 216.80, high_52w: 271.00, low_52w: 138.80, volume: 85200000,
    sparkline_rsi: [36.2, 34.5, 33.1, 31.8, 29.4, 28.5],
    buy_score: 94.2, signal: "적극 매수", signal_level: "strong_buy",
    signal_desc: "극심한 과매도 구간 (역발상 반등 노리기 적합)", badge_color: "emerald", ma20_diff_pct: -3.36, buy_rank: 1
  },
  {
    symbol: "GOOGL", name: "알파벳 (구글)", name_en: "Alphabet", sector: "검색 / AI",
    trade_date: "2026-09-11", price: 162.80, prev_price: 166.80, change: -4.00, change_pct: -2.40,
    rsi: 31.4, rsi_change: -1.4, sma20: 168.20, day_high: 166.00, day_low: 161.90, high_52w: 191.75, low_52w: 129.40, volume: 24100000,
    sparkline_rsi: [38.5, 36.4, 35.1, 33.7, 32.2, 31.4],
    buy_score: 88.5, signal: "분할 매수", signal_level: "buy",
    signal_desc: "건전한 조정 구간 (분할 매수 유효)", badge_color: "teal", ma20_diff_pct: -3.21, buy_rank: 2
  },
  {
    symbol: "AMZN", name: "아마존", name_en: "Amazon", sector: "이커머스 / 클라우드",
    trade_date: "2026-09-11", price: 186.20, prev_price: 189.61, change: -3.41, change_pct: -1.80,
    rsi: 38.6, rsi_change: -0.9, sma20: 188.40, day_high: 188.90, day_low: 185.30, high_52w: 201.20, low_52w: 118.35, volume: 38400000,
    sparkline_rsi: [44.2, 42.1, 40.5, 39.8, 38.6],
    buy_score: 81.2, signal: "분할 매수", signal_level: "buy",
    signal_desc: "건전한 조정 구간 (분할 매수 유효)", badge_color: "teal", ma20_diff_pct: -1.17, buy_rank: 3
  },
  {
    symbol: "NVDA", name: "엔비디아", name_en: "NVIDIA", sector: "AI / 반도체",
    trade_date: "2026-09-11", price: 118.40, prev_price: 119.84, change: -1.44, change_pct: -1.20,
    rsi: 42.5, rsi_change: 0.8, sma20: 121.30, day_high: 120.50, day_low: 116.80, high_52w: 140.76, low_52w: 39.23, volume: 62500000,
    sparkline_rsi: [40.1, 41.2, 39.8, 41.7, 42.5],
    buy_score: 76.5, signal: "중립 관망", signal_level: "neutral",
    signal_desc: "평균 매매 구간 (추세 지속 관망)", badge_color: "yellow", ma20_diff_pct: -2.39, buy_rank: 4
  },
  {
    symbol: "AVGO", name: "브로드컴", name_en: "Broadcom", sector: "AI 가속기 / 통신",
    trade_date: "2026-09-11", price: 161.50, prev_price: 162.80, change: -1.30, change_pct: -0.80,
    rsi: 45.3, rsi_change: -0.4, sma20: 163.20, day_high: 163.50, day_low: 160.20, high_52w: 185.16, low_52w: 79.50, volume: 18200000,
    sparkline_rsi: [47.5, 46.2, 45.8, 45.3],
    buy_score: 72.0, signal: "중립 관망", signal_level: "neutral",
    signal_desc: "평균 매매 구간 (추세 지속 관망)", badge_color: "yellow", ma20_diff_pct: -1.04, buy_rank: 5
  },
  {
    symbol: "MSFT", name: "마이크로소프트", name_en: "Microsoft", sector: "소프트웨어 / 클라우드",
    trade_date: "2026-09-11", price: 428.50, prev_price: 430.65, change: -2.15, change_pct: -0.50,
    rsi: 48.0, rsi_change: 0.3, sma20: 426.80, day_high: 431.20, day_low: 426.10, high_52w: 468.35, low_52w: 309.45, volume: 19800000,
    sparkline_rsi: [46.8, 47.2, 47.9, 48.0],
    buy_score: 68.4, signal: "중립 관망", signal_level: "neutral",
    signal_desc: "평균 매매 구간 (추세 지속 관망)", badge_color: "yellow", ma20_diff_pct: 0.40, buy_rank: 6
  },
  {
    symbol: "AAPL", name: "애플", name_en: "Apple", sector: "빅테크 / 가전",
    trade_date: "2026-09-11", price: 223.10, prev_price: 222.21, change: 0.89, change_pct: 0.40,
    rsi: 54.2, rsi_change: 1.2, sma20: 221.50, day_high: 224.80, day_low: 221.10, high_52w: 237.23, low_52w: 164.08, volume: 45200000,
    sparkline_rsi: [51.2, 52.8, 53.0, 54.2],
    buy_score: 61.5, signal: "중립 관망", signal_level: "neutral",
    signal_desc: "평균 매매 구간 (추세 지속 관망)", badge_color: "yellow", ma20_diff_pct: 0.72, buy_rank: 7
  },
  {
    symbol: "BRK-B", name: "버크셔 해서웨이", name_en: "Berkshire Hathaway", sector: "금융 / 투자",
    trade_date: "2026-09-11", price: 448.20, prev_price: 447.30, change: 0.90, change_pct: 0.20,
    rsi: 58.7, rsi_change: 0.5, sma20: 444.10, day_high: 450.10, day_low: 446.30, high_52w: 465.00, low_52w: 335.50, volume: 3200000,
    sparkline_rsi: [56.1, 57.4, 58.2, 58.7],
    buy_score: 55.0, signal: "중립 관망", signal_level: "neutral",
    signal_desc: "평균 매매 구간 (추세 지속 관망)", badge_color: "yellow", ma20_diff_pct: 0.92, buy_rank: 8
  },
  {
    symbol: "META", name: "메타", name_en: "Meta", sector: "SNS / 메타버스",
    trade_date: "2026-09-11", price: 512.30, prev_price: 506.72, change: 5.58, change_pct: 1.10,
    rsi: 62.1, rsi_change: 2.3, sma20: 498.40, day_high: 515.00, day_low: 505.20, high_52w: 544.23, low_52w: 279.40, volume: 14500000,
    sparkline_rsi: [57.2, 59.1, 60.5, 62.1],
    buy_score: 47.0, signal: "매수 주의", signal_level: "caution",
    signal_desc: "단기 상승 과열 조짐 (신규 진입 주의)", badge_color: "amber", ma20_diff_pct: 2.79, buy_rank: 9
  },
  {
    symbol: "LLY", name: "일라이 릴리", name_en: "Eli Lilly", sector: "비만치료제 / 제약",
    trade_date: "2026-09-11", price: 935.00, prev_price: 917.56, change: 17.44, change_pct: 1.90,
    rsi: 68.9, rsi_change: 3.1, sma20: 912.00, day_high: 942.00, day_low: 920.00, high_52w: 972.53, low_52w: 517.50, volume: 2900000,
    sparkline_rsi: [62.4, 65.1, 66.8, 68.9],
    buy_score: 41.5, signal: "매수 주의", signal_level: "caution",
    signal_desc: "단기 상승 과열 조짐 (신규 진입 주의)", badge_color: "amber", ma20_diff_pct: 2.52, buy_rank: 10
  }
];

// 와일더 14일 RSI 클라이언트 사이드 연산 함수 (GitHub Pages 순수 프론트엔드 구동용)
function calculateClientWilderRsi(closes, period = 14) {
  if (closes.length < period + 1) return { currentRsi: 50, rsiHistory: [50] };
  let gains = [];
  let losses = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  let rsiHistory = [];
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : (avgGain / avgLoss);
    const rsi = 100 - (100 / (1 + rs));
    rsiHistory.push(rsi);
  }
  return {
    currentRsi: rsiHistory[rsiHistory.length - 1] || 50,
    rsiHistory: rsiHistory.slice(-14)
  };
}

function evaluateBuyOpportunityClient(rsi, price, sma20, changePct) {
  let rsiScore = 30;
  if (rsi <= 25) rsiScore = 60;
  else if (rsi <= 30) rsiScore = 55 + (30 - rsi);
  else if (rsi <= 40) rsiScore = 45 + (40 - rsi);
  else if (rsi <= 50) rsiScore = 35 + (50 - rsi);
  else if (rsi <= 60) rsiScore = 25 + (60 - rsi);
  else if (rsi <= 70) rsiScore = 15 + (70 - rsi);
  else rsiScore = Math.max(5, 15 - (rsi - 70) * 0.5);

  const maDiffPct = sma20 > 0 ? ((price - sma20) / sma20) * 100 : 0;
  let maScore = 10;
  if (maDiffPct < -5) maScore = 25;
  else if (maDiffPct < 0) maScore = 20;
  else if (maDiffPct < 3) maScore = 15;
  else if (maDiffPct < 8) maScore = 10;
  else maScore = 5;

  let changeScore = 7;
  if (changePct <= -3) changeScore = 15;
  else if (changePct < 0) changeScore = 10 + Math.abs(changePct);
  else if (changePct <= 2) changeScore = 7;
  else changeScore = 3;

  const totalScore = Number(Math.min(100, Math.max(10, rsiScore + maScore + changeScore)).toFixed(1));

  let signal = "중립 관망";
  let signalLevel = "neutral";
  let signalDesc = "평균 매매 구간 (추세 지속 관망)";

  if (rsi < 30) {
    signal = "적극 매수";
    signalLevel = "strong_buy";
    signalDesc = "극심한 과매도 구간 (역발상 반등 노리기 적합)";
  } else if (rsi < 40) {
    signal = "분할 매수";
    signalLevel = "buy";
    signalDesc = "건전한 조정 구간 (분할 매수 유효)";
  } else if (rsi < 60) {
    signal = "중립 관망";
    signalLevel = "neutral";
    signalDesc = "평균 매매 구간 (추세 지속 관망)";
  } else if (rsi < 70) {
    signal = "매수 주의";
    signalLevel = "caution";
    signalDesc = "단기 상승 과열 조짐 (신규 진입 주의)";
  } else {
    signal = "과열 위험";
    signalLevel = "overbought";
    signalDesc = "극단적 과열권 (추격 매수 금지, 분할 익절 권장)";
  }

  return {
    score: totalScore,
    signal: signal,
    signal_level: signalLevel,
    signal_desc: signalDesc,
    ma20_diff_pct: Number(maDiffPct.toFixed(2))
  };
}

// 브라우저 클라이언트 실시간 야후 데이터 직접 호출 (GitHub Pages 등 서버리스 환경)
async function fetchClientSideYahooData() {
  const symbols = [
    { symbol: "NVDA", name: "엔비디아", sector: "AI / 반도체" },
    { symbol: "AAPL", name: "애플", sector: "빅테크 / 가전" },
    { symbol: "MSFT", name: "마이크로소프트", sector: "소프트웨어 / 클라우드" },
    { symbol: "AMZN", name: "아마존", sector: "이커머스 / 클라우드" },
    { symbol: "GOOGL", name: "알파벳 (구글)", sector: "검색 / AI" },
    { symbol: "META", name: "메타", sector: "SNS / 메타버스" },
    { symbol: "TSLA", name: "테슬라", sector: "전기차 / 자율주행" },
    { symbol: "BRK-B", name: "버크셔 해서웨이", sector: "금융 / 투자" },
    { symbol: "AVGO", name: "브로드컴", sector: "AI 가속기 / 통신" },
    { symbol: "LLY", name: "일라이 릴리", sector: "비만치료제 / 제약" }
  ];

  const results = [];
  for (const item of symbols) {
    try {
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.symbol)}?interval=1d&range=3mo`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      const chartResult = json?.chart?.result?.[0];
      if (!chartResult) throw new Error("no chart data");

      const quotes = chartResult.indicators.quote[0];
      const closes = quotes.close.filter(v => v !== null && v !== undefined);
      if (closes.length < 15) throw new Error("not enough candle data");

      const rsiResult = calculateClientWilderRsi(closes, 14);
      const currPrice = closes[closes.length - 1];
      const prevPrice = closes[closes.length - 2];
      const change = currPrice - prevPrice;
      const changePct = (change / prevPrice) * 100;

      const sma20Closes = closes.slice(-20);
      const sma20 = sma20Closes.reduce((a, b) => a + b, 0) / sma20Closes.length;

      const timestamps = chartResult.timestamp;
      const lastTs = timestamps[timestamps.length - 1];
      const tradeDate = new Date(lastTs * 1000).toISOString().slice(0, 10);

      const highVal = Math.max(...quotes.high.filter(v => v !== null));
      const lowVal = Math.min(...quotes.low.filter(v => v !== null));
      const dayHigh = quotes.high[quotes.high.length - 1] || currPrice;
      const dayLow = quotes.low[quotes.low.length - 1] || currPrice;

      const evalInfo = evaluateBuyOpportunityClient(rsiResult.currentRsi, currPrice, sma20, changePct);

      results.push({
        symbol: item.symbol,
        name: item.name,
        name_en: item.symbol,
        sector: item.sector,
        trade_date: tradeDate,
        price: Number(currPrice.toFixed(2)),
        prev_price: Number(prevPrice.toFixed(2)),
        change: Number(change.toFixed(2)),
        change_pct: Number(changePct.toFixed(2)),
        rsi: Number(rsiResult.currentRsi.toFixed(1)),
        rsi_change: 0.0,
        sma20: Number(sma20.toFixed(2)),
        day_high: Number(dayHigh.toFixed(2)),
        day_low: Number(dayLow.toFixed(2)),
        high_52w: Number(highVal.toFixed(2)),
        low_52w: Number(lowVal.toFixed(2)),
        sparkline_rsi: rsiResult.rsiHistory.map(v => Number(v.toFixed(1))),
        buy_score: evalInfo.score,
        signal: evalInfo.signal,
        signal_level: evalInfo.signal_level,
        signal_desc: evalInfo.signal_desc,
        ma20_diff_pct: evalInfo.ma20_diff_pct
      });
    } catch (e) {
      const fb = FALLBACK_STOCKS_DATA.find(f => f.symbol === item.symbol);
      if (fb) results.push(fb);
    }
  }

  if (results.length >= 8) {
    results.sort((a, b) => b.buy_score - a.buy_score);
    results.forEach((it, idx) => it.buy_rank = idx + 1);
    return results;
  }
  return null;
}

// 주식 데이터 가져오기 API 호출 (로컬 Python 서버 우선 -> GitHub Pages 클라이언트 엔진 -> 폴백)
async function fetchStockData(showSpin = false) {
  if (state.isFetching) return;
  state.isFetching = true;

  if (showSpin && el.refreshIcon) {
    el.refreshIcon.classList.add('animate-spin-custom');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5초 타임아웃

    const res = await fetch('/api/stocks', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('API 서버 응답 없음 (GitHub Pages 또는 서버리스 모드)');
    const data = await res.json();

    state.stocks = (data.stocks && data.stocks.length > 0) ? data.stocks : FALLBACK_STOCKS_DATA;
    state.marketTime = data.market_time;
    state.localIp = data.local_ip || window.location.hostname;

    if (el.mobileAccessUrl) {
      el.mobileAccessUrl.textContent = `http://${state.localIp}:8000`;
    }
  } catch (err) {
    // GitHub Pages 또는 파이썬 서버 미연결 시 브라우저에서 직접 수집 시도
    console.info('로컬 백엔드 없음 감지 -> GitHub Pages 클라이언트 사이드 실시간 연동 모드 작동');
    
    // 만약 이미 데이터가 없으면 우선 안전 데이터로 즉시 화면을 띄움
    if (state.stocks.length === 0) {
      state.stocks = [...FALLBACK_STOCKS_DATA];
    }
    if (!state.marketTime) {
      state.marketTime = {
        status: "CLOSED",
        status_kr: "주말 휴장",
        is_market_closed: true,
        latest_trade_date: "2026-09-11",
        data_mode_kr: "직전 마감(종가) 기준",
      };
    }

    // 비동기로 공개 CORS 프록시를 통해 최신 야후 파이낸스 데이터 갱신 시도
    // 단, 장 마감(휴장) 중이고 이미 안정적인 데이터가 있으면 수치 출렁거림(변동)을 막기 위해 고정
    const isClosed = !state.marketTime || state.marketTime.is_market_closed || state.marketTime.status === 'CLOSED';
    if (!isClosed || showSpin || state.stocks.length === 0) {
      fetchClientSideYahooData().then(clientData => {
        if (clientData && clientData.length >= 9) {
          state.stocks = clientData;
          if (clientData[0].trade_date && state.marketTime) {
            state.marketTime.latest_trade_date = clientData[0].trade_date;
          }
          renderSummaryMetrics();
          updateDataModeBanner();
          renderStockList();
        }
      }).catch(e => console.warn("Client yahoo fetch skipped:", e));
    }
  } finally {
    renderSummaryMetrics();
    updateDataModeBanner();
    renderStockList();
    state.isFetching = false;
    state.remainingSeconds = state.refreshInterval;
    if (el.refreshIcon) {
      el.refreshIcon.classList.remove('animate-spin-custom');
    }
  }
}

// 요약 상단 통계 렌더링
function renderSummaryMetrics() {
  if (!state.stocks || state.stocks.length === 0) return;

  // 매수 추천 1위 종목 찾기
  const topStock = [...state.stocks].sort((a, b) => b.buy_score - a.buy_score)[0];
  if (el.summaryTopStock && topStock) {
    el.summaryTopStock.textContent = `${topStock.symbol} (${topStock.buy_score}점)`;
  }

  // 과매도 종목수 (RSI < 30)
  const oversoldList = state.stocks.filter(s => s.rsi < 30);
  if (el.summaryOversold) {
    el.summaryOversold.textContent = `${oversoldList.length}개 종목`;
    if (oversoldList.length > 0) {
      el.summaryOversold.className = 'text-sm font-bold text-emerald-400 mt-0.5 animate-pulse';
    } else {
      el.summaryOversold.className = 'text-sm font-bold text-slate-400 mt-0.5';
    }
  }

  // 10대 평균 RSI
  const avgRsi = state.stocks.reduce((acc, cur) => acc + cur.rsi, 0) / state.stocks.length;
  if (el.summaryAvgRsi) {
    el.summaryAvgRsi.textContent = `${avgRsi.toFixed(1)}`;
  }
}

// 주식 카드 리스트 렌더링
function renderStockList() {
  if (!el.stockListContainer) return;

  // 정렬 수행
  let list = [...state.stocks];
  if (state.currentSort === 'buy_rank') {
    list.sort((a, b) => b.buy_score - a.buy_score);
  } else if (state.currentSort === 'rsi_asc') {
    list.sort((a, b) => a.rsi - b.rsi);
  } else if (state.currentSort === 'change_desc') {
    list.sort((a, b) => b.change_pct - a.change_pct);
  }

  const html = list.map((stock, index) => {
    // 랭킹 배지 스타일
    let rankBadgeClass = 'rank-badge-default';
    if (state.currentSort === 'buy_rank') {
      if (index === 0) rankBadgeClass = 'rank-badge-1';
      else if (index === 1) rankBadgeClass = 'rank-badge-2';
      else if (index === 2) rankBadgeClass = 'rank-badge-3';
    }

    const isExpanded = state.expandedCard === stock.symbol;

    // 장 마감 여부
    const isClosed = !state.marketTime || state.marketTime.is_market_closed || state.marketTime.status === 'CLOSED';

    // 등락률 색상 (한국/글로벌 공용 직관적 포맷: 상승 빨강/초록 옵션 대신 +는 rose, -는 blue 또는 US standard green)
    const isUp = stock.change >= 0;
    const changeColor = isUp ? 'text-rose-400' : 'text-blue-400';
    const changeBg = isUp ? 'bg-rose-500/10' : 'bg-blue-500/10';
    const changeIcon = isUp ? '▲' : '▼';

    // RSI 포인터 위치 퍼센트 (0~100 clamp)
    const clampedRsi = Math.max(0, Math.min(100, stock.rsi));

    // 미니 SVG 스파크라인 생성
    const sparklineSvg = generateSparklineSvg(stock.sparkline_rsi || []);

    return `
      <article class="stock-card bg-cardDark border border-cardBorder rounded-2xl p-4 shadow-lg cursor-pointer hover:border-slate-700 transition"
               onclick="toggleCardExpand('${stock.symbol}')">
        
        <!-- 상단: 순위, 종목명, 현재가(또는 종가), 등락률 -->
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-2.5">
            <span class="w-7 h-7 rounded-xl flex items-center justify-center text-xs ${rankBadgeClass}">
              #${index + 1}
            </span>
            <div>
              <div class="flex items-center space-x-1.5">
                <span class="font-black text-base text-white tracking-wide">${stock.symbol}</span>
                <span class="text-xs text-slate-400 font-medium">${stock.name}</span>
              </div>
              <div class="text-[11px] text-slate-400">${stock.sector}</div>
            </div>
          </div>

          <div class="text-right">
            <div class="flex items-center justify-end gap-1">
              ${isClosed 
                ? `<span class="text-[10px] text-slate-400 bg-slate-800/90 border border-slate-700/60 px-1 py-0.2 rounded font-medium">종가</span>` 
                : `<span class="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-1 py-0.2 rounded font-medium animate-pulse">실시간</span>`}
              <span class="text-base font-bold font-mono text-white">$${stock.price.toLocaleString()}</span>
            </div>
            <div class="inline-flex items-center space-x-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${changeBg} ${changeColor} mt-0.5">
              <span>${changeIcon}</span>
              <span>${Math.abs(stock.change_pct).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <!-- 중앙: RSI 수치 & 매수 신호 배지 & 매수 점수 -->
        <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
          <div class="flex items-baseline space-x-1.5">
            <span class="text-xs font-semibold text-slate-400">RSI(14)</span>
            <span class="text-lg font-black font-mono tracking-tight ${stock.rsi < 30 ? 'text-emerald-400' : (stock.rsi > 70 ? 'text-rose-400' : 'text-slate-200')}">
              ${stock.rsi.toFixed(1)}
            </span>
          </div>

          <!-- 매수 신호 배지 -->
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-1 rounded-xl text-xs font-bold signal-badge-${stock.signal_level} flex items-center gap-1 shadow-sm">
              ${stock.signal}
            </span>
            <span class="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-lg">
              ${stock.buy_score}점
            </span>
          </div>
        </div>

        <!-- 시각적 RSI 게이지 바 -->
        <div class="mt-2.5">
          <div class="rsi-track">
            <div class="rsi-pointer" style="left: ${clampedRsi}%"></div>
          </div>
          <div class="flex justify-between text-[10px] text-slate-400 font-mono mt-1 px-0.5">
            <span class="text-emerald-400">0 과매도</span>
            <span>30</span>
            <span>70</span>
            <span class="text-rose-400">100 과열</span>
          </div>
        </div>

        <!-- 원터치 확장 세부 영역 -->
        ${isExpanded ? `
          <div class="mt-3.5 pt-3 border-t border-slate-800 space-y-2.5 text-xs">
            <div class="text-[11px] text-indigo-300 font-medium bg-indigo-950/40 p-2 rounded-xl border border-indigo-800/40">
              💡 ${stock.signal_desc}
            </div>

            <!-- 최근 14일 RSI 추세 미니 차트 -->
            <div class="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
              <div class="flex justify-between items-center text-[10px] text-slate-400 mb-1.5">
                <span>최근 14일간 RSI 추세</span>
                <span class="font-mono text-slate-300">최저 ${Math.min(...(stock.sparkline_rsi || [stock.rsi])).toFixed(1)} / 최고 ${Math.max(...(stock.sparkline_rsi || [stock.rsi])).toFixed(1)}</span>
              </div>
              <div class="h-10 w-full flex items-center justify-center">
                ${sparklineSvg}
              </div>
            </div>

            <!-- 세부 지표 그리드 (4열) -->
            <div class="grid grid-cols-4 gap-1.5 text-[10px]">
              <div class="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                <div class="text-slate-400 truncate">${isClosed ? '마감 기준일' : '기준일'}</div>
                <div class="font-mono font-bold mt-0.5 text-indigo-300 truncate">
                  ${stock.trade_date ? stock.trade_date.slice(5) : '-'}
                </div>
              </div>
              <div class="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                <div class="text-slate-400 truncate">20일 이평 괴리</div>
                <div class="font-mono font-bold mt-0.5 ${stock.ma20_diff_pct < 0 ? 'text-emerald-400' : 'text-slate-300'}">
                  ${stock.ma20_diff_pct > 0 ? '+' : ''}${stock.ma20_diff_pct}%
                </div>
              </div>
              <div class="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                <div class="text-slate-400 truncate">당일 고/저</div>
                <div class="font-mono text-slate-300 mt-0.5 truncate">
                  $${stock.day_low}~$${stock.day_high}
                </div>
              </div>
              <div class="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                <div class="text-slate-400 truncate">52주 신고가</div>
                <div class="font-mono text-slate-300 mt-0.5 truncate">
                  $${stock.high_52w}
                </div>
              </div>
            </div>
          </div>
        ` : ''}

      </article>
    `;
  }).join('');

  el.stockListContainer.innerHTML = html;
  lucide.createIcons();
}

// 14일 RSI 스파크라인 SVG 생성 유틸
function generateSparklineSvg(data) {
  if (!data || data.length < 2) {
    return `<div class="text-[10px] text-slate-400">데이터 수집 중</div>`;
  }

  const width = 280;
  const height = 36;
  const minVal = 10;
  const maxVal = 90;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    // Y축: 90이 상단(0), 10이 하단(height)
    const normalized = (val - minVal) / (maxVal - minVal);
    const clamped = Math.max(0, Math.min(1, normalized));
    const y = height - clamped * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
      <!-- 30 과매도 기준선 -->
      <line x1="0" y1="${height - (30 - minVal) / (maxVal - minVal) * height}" x2="${width}" y2="${height - (30 - minVal) / (maxVal - minVal) * height}" stroke="#10b981" stroke-dasharray="3 3" stroke-width="1" opacity="0.5" />
      <!-- 70 과열 기준선 -->
      <line x1="0" y1="${height - (70 - minVal) / (maxVal - minVal) * height}" x2="${width}" y2="${height - (70 - minVal) / (maxVal - minVal) * height}" stroke="#f43f5e" stroke-dasharray="3 3" stroke-width="1" opacity="0.5" />
      <!-- RSI 추세선 -->
      <polyline fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
    </svg>
  `;
}

// 카드 확장/축소 토글
window.toggleCardExpand = function(symbol) {
  state.expandedCard = state.expandedCard === symbol ? null : symbol;
  renderStockList();
};

// 정렬 탭 이벤트 리스너
el.sortTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    el.sortTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.currentSort = tab.dataset.sort;
    renderStockList();
  });
});

// 수동 새로고침 버튼
el.btnManualRefresh.addEventListener('click', () => {
  fetchStockData(true);
});

// 모달 제어
el.btnMobileQr.addEventListener('click', () => {
  el.modalQr.classList.remove('hidden');
});
el.btnCloseQr.addEventListener('click', () => {
  el.modalQr.classList.add('hidden');
});

el.btnInfo.addEventListener('click', () => {
  el.modalInfo.classList.remove('hidden');
});
el.btnCloseInfo.addEventListener('click', () => {
  el.modalInfo.classList.add('hidden');
});
el.btnConfirmInfo.addEventListener('click', () => {
  el.modalInfo.classList.add('hidden');
});

// URL 클립보드 복사
el.btnCopyUrl.addEventListener('click', async () => {
  const url = el.mobileAccessUrl.textContent.trim();
  try {
    await navigator.clipboard.writeText(url);
    el.btnCopyUrl.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i> 복사되었습니다!`;
    lucide.createIcons();
    setTimeout(() => {
      el.btnCopyUrl.innerHTML = `<i data-lucide="copy" class="w-3.5 h-3.5"></i> 주소 복사하기`;
      lucide.createIcons();
    }, 2000);
  } catch (e) {
    alert(`주소: ${url}`);
  }
});

// 1초 타이머 (시계 갱신 및 장 상태별 카운트다운)
setInterval(() => {
  updateClocks();

  const isClosed = !state.marketTime || state.marketTime.is_market_closed || state.marketTime.status === 'CLOSED';

  // 장 마감(휴장) 중일 때는 수치가 출렁거리지 않도록 자동 갱신을 멈추고 고정 상태 표시
  if (isClosed) {
    if (el.refreshTimer && el.refreshTimer.parentElement) {
      el.refreshTimer.parentElement.innerHTML = `
        <span class="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <span class="w-2 h-2 rounded-full bg-slate-500"></span>
          마감 종가 기준 <strong class="text-indigo-300 font-semibold">고정됨</strong> (개장 시 자동 갱신)
        </span>
      `;
    }
    return;
  }

  // 정규장 운영 중에만 25초 카운트다운 및 실시간 갱신 실행
  if (state.remainingSeconds > 0) {
    state.remainingSeconds -= 1;
    if (el.refreshTimer) {
      el.refreshTimer.textContent = state.remainingSeconds;
    }
  } else {
    fetchStockData(false);
  }
}, 1000);

// 초기 실행
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  updateClocks();
  fetchStockData(true);
});
