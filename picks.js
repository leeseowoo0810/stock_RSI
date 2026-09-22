// 미국 주식 시장 대표 우량·주도주 35개 실시간 스캔 유니버스
const SCAN_UNIVERSE = [
  { symbol: "NVDA", name: "NVIDIA", nameKr: "엔비디아", sector: "AI/반도체" },
  { symbol: "AAPL", name: "Apple", nameKr: "애플", sector: "빅테크" },
  { symbol: "MSFT", name: "Microsoft", nameKr: "마이크로소프트", sector: "클라우드/AI" },
  { symbol: "AMZN", name: "Amazon", nameKr: "아마존", sector: "이커머스/클라우드" },
  { symbol: "GOOGL", name: "Alphabet", nameKr: "알파벳", sector: "검색/AI" },
  { symbol: "META", name: "Meta", nameKr: "메타", sector: "소셜/AI" },
  { symbol: "TSLA", name: "Tesla", nameKr: "테슬라", sector: "전기차/자율주행" },
  { symbol: "AMD", name: "AMD", nameKr: "AMD", sector: "AI/반도체" },
  { symbol: "PLTR", name: "Palantir", nameKr: "팔란티어", sector: "엔터프라이즈 AI" },
  { symbol: "ARM", name: "Arm Holdings", nameKr: "ARM", sector: "반도체 IP" },
  { symbol: "COIN", name: "Coinbase", nameKr: "코인베이스", sector: "가상자산/핀테크" },
  { symbol: "LLY", name: "Eli Lilly", nameKr: "일라이릴리", sector: "비만치료제" },
  { symbol: "CRWD", name: "CrowdStrike", nameKr: "크라우드스트라이크", sector: "사이버보안" },
  { symbol: "PANW", name: "Palo Alto", nameKr: "팔로알토", sector: "네트워크보안" },
  { symbol: "NFLX", name: "Netflix", nameKr: "넷플릭스", sector: "미디어/OTT" },
  { symbol: "UBER", name: "Uber", nameKr: "우버", sector: "모빌리티/플랫폼" },
  { symbol: "SPOT", name: "Spotify", nameKr: "스포티파이", sector: "음원 스트리밍" },
  { symbol: "APP", name: "AppLovin", nameKr: "앱러빈", sector: "AI 광고테크" },
  { symbol: "HOOD", name: "Robinhood", nameKr: "로빈후드", sector: "온라인금융" },
  { symbol: "QCOM", name: "Qualcomm", nameKr: "퀄컴", sector: "모바일/AI PC" },
  { symbol: "TSM", name: "TSMC", nameKr: "TSMC", sector: "파운드리" },
  { symbol: "ASML", name: "ASML", nameKr: "ASML", sector: "반도체 장비" },
  { symbol: "SNOW", name: "Snowflake", nameKr: "스노우플레이크", sector: "클라우드 데이터" },
  { symbol: "DIS", name: "Disney", nameKr: "디즈니", sector: "엔터테인먼트" },
  { symbol: "COST", name: "Costco", nameKr: "코스트코", sector: "필수소비재" },
  { symbol: "JPM", name: "JPMorgan", nameKr: "JP모건", sector: "금융/은행" },
  { symbol: "XOM", name: "ExxonMobil", nameKr: "엑슨모빌", sector: "에너지/정유" },
  { symbol: "IONQ", name: "IonQ", nameKr: "아이온큐", sector: "양자컴퓨팅" },
  { symbol: "RKLB", name: "Rocket Lab", nameKr: "로켓랩", sector: "우주/항공" },
  { symbol: "INTC", name: "Intel", nameKr: "인텔", sector: "반도체/파운드리" },
  { symbol: "PYPL", name: "PayPal", nameKr: "페이팔", sector: "핀테크/결제" },
  { symbol: "ORCL", name: "Oracle", nameKr: "오라클", sector: "클라우드/DB" },
  { symbol: "BA", name: "Boeing", nameKr: "보잉", sector: "방산/항공" },
  { symbol: "NKE", name: "Nike", nameKr: "나이키", sector: "소비재" },
  { symbol: "SBUX", name: "Starbucks", nameKr: "스타벅스", sector: "식음료" }
];

const RSI_PERIOD = 14;
const PRE_OPEN_MIN = 4 * 60;
const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;
const POST_CLOSE_MIN = 20 * 60;
const REFRESH_MS = 60_000;

const NY = "America/New_York";
const KR = "Asia/Seoul";

const els = {
  usTime: document.getElementById("us-time"),
  usDate: document.getElementById("us-date"),
  krTime: document.getElementById("kr-time"),
  krDate: document.getElementById("kr-date"),
  marketDot: document.getElementById("market-dot"),
  marketState: document.getElementById("market-state"),
  marketDetail: document.getElementById("market-detail"),
  dataBasis: document.getElementById("data-basis"),
  nextRefresh: document.getElementById("next-refresh"),
  briefText: document.getElementById("brief-text"),
  briefStats: document.getElementById("brief-stats"),
  grid: document.getElementById("stock-grid"),
  shortRankList: document.getElementById("short-rank-list"),
  midRankList: document.getElementById("mid-rank-list"),
  momentumRankList: document.getElementById("momentum-rank-list"),
  strategyTabs: document.getElementById("strategy-tabs"),
};

const state = {
  detectedPicks: [], // 실시간 추천 조건을 통과한 종목들만 수집
  allScannedCount: 0,
  filterMode: "all",
  nextRefreshAt: 0,
  proxyIndex: 0,
};

function nyParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: NY,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return { ...parts, ymd, minutes };
}

function formatZone(date, timeZone) {
  const d = new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
  const t = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return { date: d, time: t };
}

function formatCountdown(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}분`;
  return `${h}시간 ${m}분`;
}

function getMarketStatus(now = new Date()) {
  const ny = nyParts(now);
  const weekend = ny.weekday === "Sat" || ny.weekday === "Sun";

  if (weekend) {
    return {
      open: false,
      active: false,
      label: "주말 휴장",
      detail: "미국 증시 월요일 프리마켓 전까지 최신 일봉 종가 기준 스캔 결과를 제공합니다.",
      phase: "weekend",
      dotClass: "closed",
    };
  }

  if (ny.minutes < PRE_OPEN_MIN) {
    return {
      open: false,
      active: false,
      label: "야간 휴장",
      detail: `정규장(09:30 ET) 개장 전입니다. 전일 일봉 종가 기준 실시간 시그널 분석 중입니다.`,
      phase: "closed",
      dotClass: "closed",
    };
  }

  if (ny.minutes < OPEN_MIN) {
    return {
      open: false,
      active: false,
      label: "프리마켓 진행 중",
      detail: `정규장 개장까지 ${formatCountdown(OPEN_MIN - ny.minutes)} 남았습니다. 개장 시 실시간 일봉 반영.`,
      phase: "pre",
      dotClass: "pre",
    };
  }

  if (ny.minutes < CLOSE_MIN) {
    return {
      open: true,
      active: true,
      label: "정규장 진행 중 (실시간 일봉 스캔)",
      detail: `뉴욕 정규장 진행 중 · 당일 실시간 캔들 반영 스캔 중 · 폐장까지 ${formatCountdown(CLOSE_MIN - ny.minutes)}`,
      phase: "regular",
      dotClass: "open",
    };
  }

  return {
    open: false,
    active: false,
    label: "정규장 마감 (일봉 확정)",
    detail: "오늘 정규장이 마감되어 최신 일봉 종가 기준으로 시그널을 최종 집계했습니다.",
    phase: "closed",
    dotClass: "closed",
  };
}

// 1분봉/일봉과 100% 동일한 공식의 Wilder RSI(14)
function wilderRsi(closes, period = RSI_PERIOD) {
  const prices = closes.filter((v) => Number.isFinite(v));
  if (prices.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gain += diff;
    else if (diff < 0) loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < prices.length; i += 1) {
    const diff = prices[i] - prices[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) {
    return avgGain === 0 ? 50 : 100;
  }
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// 단순 이동평균(SMA) 계산
function calcMA(arr, period) {
  const valid = arr.filter((v) => Number.isFinite(v));
  if (valid.length < period) return null;
  const slice = valid.slice(valid.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function yahooUrl(symbol) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
}

const WORKER_PROXY = "https://white-meadow-2e49.po01033171881.workers.dev";

function proxyCandidates(url) {
  const enc = encodeURIComponent(url);
  const list = [];
  if (WORKER_PROXY) {
    list.push(`${WORKER_PROXY}/?url=${enc}`);
  }
  list.push(
    url,
    `https://api.allorigins.win/raw?url=${enc}`,
    `https://api.codetabs.com/v1/proxy/?quest=${enc}`,
    `https://corsproxy.io/?url=${enc}`
  );
  return list;
}

async function fetchChart(symbol) {
  const candidates = proxyCandidates(yahooUrl(symbol));
  let lastError = null;
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const index = (state.proxyIndex + offset) % candidates.length;
    try {
      const res = await fetch(candidates[index], {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const data = typeof payload?.contents === "string" ? JSON.parse(payload.contents) : payload;
      const result = data?.chart?.result?.[0];
      if (!result) throw new Error("empty chart");
      state.proxyIndex = index;
      return result;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("시세 수신 실패");
}

/**
 * 실시간 시그널 스캔 및 동적 근거 생성 엔진
 * 고정된 목록이 아니라, 실시간 데이터가 실제로 매수 조건에 부합할 때만 통과시킵니다.
 */
function evaluateRealtimeSignal(stock, pairs, volumes, meta) {
  if (!pairs || pairs.length < 50) return null;

  const closes = pairs.map((p) => p.close);
  const currentPrice = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2] ?? meta.chartPreviousClose ?? meta.previousClose;
  const change = currentPrice - prevPrice;
  const changePct = prevPrice ? (change / prevPrice) * 100 : 0;

  // 1. RSI 및 전일대비 RSI 변화량
  const rsi = wilderRsi(closes);
  const prevRsi = wilderRsi(closes.slice(0, -1));
  if (rsi == null) return null;
  const rsiDelta = prevRsi != null ? rsi - prevRsi : 0;

  // 2. 이동평균선 및 이격도
  const ma5 = calcMA(closes, 5);
  const ma20 = calcMA(closes, 20);
  const ma50 = calcMA(closes, 50);
  if (!ma20) return null;

  const disparity20 = ((currentPrice - ma20) / ma20) * 100; // 20일선 이격도(%)

  // 3. 거래량 급증률 (20일 평균 대비)
  const validVolumes = (volumes || []).filter((v) => Number.isFinite(v) && v > 0);
  const currentVol = validVolumes[validVolumes.length - 1] || 0;
  const avgVol20 = calcMA(validVolumes.slice(0, -1), 20) || currentVol || 1;
  const volumeRatio = Math.round((currentVol / avgVol20) * 100);

  // === 실시간 추천 조건 판별 ===
  let strategy = null;
  let strategyLabel = "";
  let score = 0;
  let scoreText = "";
  let reasonDynamic = "";
  let targetBuyRange = "";
  let targetPrice = "";
  let stopPrice = "";

  // [시그널 1] ⚡ 단기 과매도 반등 시그널
  // 조건: RSI <= 36 AND (RSI 반등 시작 OR 20일선 이격도 -6% 이하 과대낙폭 OR 거래량 유입)
  if (rsi <= 36) {
    const isExtreme = rsi <= 25;
    const isTurnAround = rsiDelta > 0.3;
    strategy = "short";
    strategyLabel = isExtreme ? "⚡ 극단 과매도 반등 포착" : "⚡ 단기 과매도 반등 포착";
    score = Math.min(98, Math.round(86 + (36 - rsi) * 0.8 + (isTurnAround ? 3 : 0)));
    scoreText = `${score}점 · 강력 반등 시그널`;

    const deltaSign = rsiDelta >= 0 ? "+" : "";
    const dispSign = disparity20 >= 0 ? "+" : "";

    reasonDynamic = `실시간 일봉 RSI가 ${rsi.toFixed(1)}(전일비 ${deltaSign}${rsiDelta.toFixed(1)}p)로 과매도권에 진입했습니다. 현재가 $${currentPrice.toFixed(2)}는 20일선($${ma20.toFixed(2)}) 대비 이격도 ${dispSign}${disparity20.toFixed(1)}%로 과도하게 벌어진 낙폭과대 상태입니다. ${
      isTurnAround
        ? "바닥권에서 RSI가 위로 돌아서며 기술적 반등이 실시간 시작되었습니다."
        : "기술적 지지선에서의 저가 매수세 유입 및 숏커버링 반등 타점이 실시간 포착되었습니다."
    }`;

    targetBuyRange = `$${(currentPrice * 0.995).toFixed(2)} ~ $${(currentPrice * 1.005).toFixed(2)}`;
    targetPrice = `$${(Math.max(currentPrice * 1.055, ma20 * 0.98)).toFixed(2)} (+${(((Math.max(currentPrice * 1.055, ma20 * 0.98) - currentPrice) / currentPrice) * 100).toFixed(1)}%)`;
    stopPrice = `$${(currentPrice * 0.95).toFixed(2)} (-5.0%)`;
  }

  // [시그널 2] 📈 중기 추세 건전한 눌림목 안착 시그널
  // 조건: RSI 39 ~ 53 AND 20일선 지지선 안착(이격도 -3.5% ~ +3.5%) AND 중기 정배열 유지
  else if (rsi >= 39 && rsi <= 53 && disparity20 >= -3.5 && disparity20 <= 3.5 && (ma50 ? ma20 >= ma50 * 0.97 : true)) {
    strategy = "mid";
    strategyLabel = "📈 중기 추세 눌림목 포착";
    const sweetDist = Math.abs(rsi - 46);
    score = Math.min(95, Math.round(87 - sweetDist * 0.8 + (disparity20 >= 0 ? 3 : 0)));
    scoreText = `${score}점 · 우량 눌림목 시그널`;

    const dispSign = disparity20 >= 0 ? "+" : "";
    reasonDynamic = `현재가 $${currentPrice.toFixed(2)}가 핵심 기준선인 20일 이동평균선($${ma20.toFixed(2)}, 이격도 ${dispSign}${disparity20.toFixed(1)}%) 지지선에 정확히 안착했습니다. 일봉 RSI가 ${rsi.toFixed(1)}로 단기 과열이 완전히 해소된 상태에서 하방 경직성을 확보하여, 중기 우상향 추세로 재출발하기 가장 안정적인 눌림목 타점입니다.`;

    targetBuyRange = `$${(currentPrice * 0.99).toFixed(2)} ~ $${(currentPrice * 1.01).toFixed(2)}`;
    targetPrice = `$${(currentPrice * 1.085).toFixed(2)} (+8.5%)`;
    stopPrice = `$${(ma20 * 0.97).toFixed(2)} (20일선 이탈 시)`;
  }

  // [시그널 3] 🚀 모멘텀 돌파 및 추세 추종 시그널
  // 조건: RSI 55 ~ 68 AND 5일선 > 20일선 골든크로스 상태 AND 거래량 105% 이상 또는 당일 양봉
  else if (rsi >= 55 && rsi <= 68 && ma5 && ma5 >= ma20 && (volumeRatio >= 105 || changePct > 0)) {
    strategy = "momentum";
    strategyLabel = "🚀 모멘텀 돌파 추종 포착";
    score = Math.min(96, Math.round(82 + (rsi - 55) * 0.85 + (volumeRatio > 120 ? 4 : 0)));
    scoreText = `${score}점 · 주도주 수급 시그널`;

    reasonDynamic = `5일선($${ma5.toFixed(2)})이 20일선($${ma20.toFixed(2)}) 상단에 위치하며 강한 정배열 상승 흐름을 유지 중입니다. 일봉 RSI가 ${rsi.toFixed(1)}로 매수세가 강력하게 유입되고 있으며, 20일 평균 대비 거래량 ${volumeRatio}%를 동반해 전고점 돌파 및 상승 탄력이 실시간 가속화되고 있습니다.`;

    targetBuyRange = `$${(currentPrice * 0.995).toFixed(2)} ~ $${currentPrice.toFixed(2)}`;
    targetPrice = `$${(currentPrice * 1.075).toFixed(2)} (+7.5%)`;
    stopPrice = `$${(ma5 * 0.98).toFixed(2)} (5일선 이탈 시)`;
  }

  // 매수 시그널 조건을 충족하지 못하면 추천 목록에서 제외 (null 반환)
  if (!strategy) return null;

  return {
    ...stock,
    price: currentPrice,
    change,
    changePct,
    rsi,
    rsiDelta,
    ma5,
    ma20,
    ma50,
    disparity20,
    volumeRatio,
    strategy,
    strategyLabel,
    score,
    scoreText,
    reasonDynamic,
    targetBuyRange,
    targetPrice,
    stopPrice,
    lastTs: pairs[pairs.length - 1].ts,
  };
}

function money(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rsiText(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

function formatDailyStamp(ts, isRegularOpen) {
  if (!ts) return "날짜 없음";
  const date = new Date(ts * 1000);
  const dateStr = new Intl.DateTimeFormat("ko-KR", {
    timeZone: NY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return `${dateStr} ${isRegularOpen ? "(장중)" : "(마감)"}`;
}

function renderSkeletons() {
  els.grid.innerHTML = Array.from({ length: 6 }).map(
    (_, i) => `
      <article class="card loading">
        <div>
          <div class="ticker">SCANNING…</div>
          <div class="name">미국 35개 핵심주 실시간 스캔 중…</div>
        </div>
        <p class="note">현재 매수 시그널 조건을 충족한 종목을 선별하고 있습니다.</p>
      </article>`
  ).join("");
}

function renderSummaryBoards(picks) {
  const shortPicks = picks
    .filter((p) => p.strategy === "short")
    .sort((a, b) => a.rsi - b.rsi)
    .slice(0, 2);

  const midPicks = picks
    .filter((p) => p.strategy === "mid")
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const momentumPicks = picks
    .filter((p) => p.strategy === "momentum")
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  function renderList(list, emptyText) {
    if (!list.length) {
      return `<div class="rank-loading">${emptyText}</div>`;
    }
    return list
      .map(
        (p, idx) => `
        <div class="rank-item">
          <div class="rank-left">
            <span class="rank-order ${idx === 0 ? "gold" : ""}">${idx + 1}</span>
            <div class="rank-info">
              <span class="rank-name">${p.nameKr} <span class="sector-tag">${p.sector}</span></span>
              <span class="rank-ticker">${p.symbol} · $${money(p.price)}</span>
            </div>
          </div>
          <div class="rank-right">
            <span class="rank-rsi cold">${rsiText(p.rsi)}</span>
            <span class="score-badge">${p.score}점</span>
          </div>
        </div>`
      )
      .join("");
  }

  els.shortRankList.innerHTML = renderList(shortPicks, "현재 과매도 시그널 종목 없음 (지수 견조)");
  els.midRankList.innerHTML = renderList(midPicks, "현재 20일선 안착 종목 없음");
  els.momentumRankList.innerHTML = renderList(momentumPicks, "현재 골든크로스 돌파 종목 없음");
}

function renderCards(picks) {
  let displayPicks = [...picks];

  if (state.filterMode === "short") {
    displayPicks = displayPicks.filter((p) => p.strategy === "short");
  } else if (state.filterMode === "mid") {
    displayPicks = displayPicks.filter((p) => p.strategy === "mid");
  } else if (state.filterMode === "momentum") {
    displayPicks = displayPicks.filter((p) => p.strategy === "momentum");
  }

  displayPicks.sort((a, b) => b.score - a.score);

  if (!displayPicks.length) {
    els.grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 56px 20px; color: var(--muted); background: var(--bg-elev); border: 1px solid var(--line);">
        <p style="font-size: 1.1rem; color: var(--ink); font-weight: 700; margin-bottom: 8px;">현재 실시간 시그널 조건을 만족하는 종목이 없습니다.</p>
        <p style="font-size: 0.88rem;">스캔 엔진이 1분마다 35개 주요 종목을 실시간 감시하며, 매수 타점이 포착되면 즉시 노출됩니다.</p>
      </div>`;
    return;
  }

  const market = getMarketStatus();
  const isRegularOpen = market.phase === "regular";

  els.grid.innerHTML = displayPicks
    .map((p) => {
      const up = p.changePct >= 0;
      const rsiWidth = Number.isFinite(p.rsi) ? Math.max(2, Math.min(100, p.rsi)) : 0;
      const rsiClass = p.rsi <= 36 ? "cold" : p.rsi >= 65 ? "hot" : "";
      const deltaSign = p.rsiDelta >= 0 ? "+" : "";
      const dispSign = p.disparity20 >= 0 ? "+" : "";

      return `
        <article class="card">
          <div class="card-top">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="live-indicator">
                  <span class="live-dot"></span> LIVE 포착
                </span>
                <span class="sector-tag">${p.sector}</span>
              </div>
              <div class="ticker" style="margin-top: 4px;">${p.symbol}</div>
              <div class="name">${p.nameKr}</div>
              <div style="margin-top: 6px; display: flex; gap: 6px; align-items: center;">
                <span class="strategy-badge ${p.strategy}">${p.strategyLabel}</span>
                <span class="score-badge">${p.scoreText}</span>
              </div>
            </div>
            <div class="price-wrap">
              <span class="session-badge ${isRegularOpen ? "open" : "closed"}">${isRegularOpen ? "1D 장중" : "1D 종가"}</span>
              <div class="price">$${money(p.price)}</div>
              <div class="chg ${up ? "up" : "down"}">${up ? "+" : ""}${p.changePct.toFixed(2)}%</div>
            </div>
          </div>

          <!-- 실시간 보조지표 요약 태그 그룹 -->
          <div class="metric-tag-group">
            <span class="metric-tag ${p.strategy === "short" ? "highlight" : ""}">
              RSI <strong>${rsiText(p.rsi)}</strong> (${deltaSign}${p.rsiDelta.toFixed(1)}p)
            </span>
            <span class="metric-tag ${p.strategy === "mid" ? "highlight" : ""}">
              20일선 이격 <strong>${dispSign}${p.disparity20.toFixed(1)}%</strong>
            </span>
            <span class="metric-tag ${p.strategy === "momentum" ? "highlight-hot" : ""}">
              거래량 <strong>${p.volumeRatio}%</strong>
            </span>
          </div>

          <div class="rsi-row" style="margin-top: 12px;">
            <div class="rsi-num ${rsiClass}">${rsiText(p.rsi)}</div>
            <div class="rsi-level">실시간 Wilder RSI(14)</div>
          </div>
          <div class="track"><div class="fill" style="width:${rsiWidth}%"></div></div>

          <!-- 100% 동적 실시간 근거 리포트 박스 -->
          <div class="reason-box">
            <div class="reason-title">
              <span>💡 실시간 시그널 분석 근거</span>
            </div>
            <p class="reason-text">${p.reasonDynamic}</p>

            <!-- 실시간 계산된 타겟 가격 가이드 -->
            <div class="price-targets">
              <div class="target-item">
                <span class="target-label">권장 진입 범위</span>
                <span class="target-val buy">${p.targetBuyRange}</span>
              </div>
              <div class="target-item">
                <span class="target-label">1차 목표가</span>
                <span class="target-val target">${p.targetPrice}</span>
              </div>
              <div class="target-item">
                <span class="target-label">손절 기준선</span>
                <span class="target-val stop">${p.stopPrice}</span>
              </div>
            </div>
          </div>

          <div class="action-bar" style="margin-top: 14px;">
            <span class="action-badge ${p.strategy === "short" ? "cold" : p.strategy === "momentum" ? "hot" : "neutral"}">
              ${p.strategyLabel}
            </span>
            <div class="stamp">${formatDailyStamp(p.lastTs, isRegularOpen)}</div>
          </div>
        </article>`;
    })
    .join("");
}

function renderBrief(picks, market) {
  const scanned = state.allScannedCount || SCAN_UNIVERSE.length;
  const detected = picks.length;
  const shortCount = picks.filter((p) => p.strategy === "short").length;
  const midCount = picks.filter((p) => p.strategy === "mid").length;
  const momentumCount = picks.filter((p) => p.strategy === "momentum").length;

  const bestPick = [...picks].sort((a, b) => b.score - a.score)[0];

  els.briefText.textContent = `미국 시장 대표 우량·주도주 총 ${scanned}개 종목을 실시간 스캔한 결과, 현재 매수 시그널 조건을 실제로 충족한 종목은 ${detected}개입니다. ⚡과매도 반등 ${shortCount}개, 📈중기 눌림목 ${midCount}개, 🚀모멘텀 돌파 ${momentumCount}개가 실시간 포착되었습니다.`;

  els.briefStats.innerHTML = `
    <span class="pill">스캔 대상 ${scanned}개 중 <strong>${detected}개 포착</strong></span>
    <span class="pill">⚡ 단기 반등 ${shortCount}개</span>
    <span class="pill">📈 중기 눌림목 ${midCount}개</span>
    <span class="pill">🚀 모멘텀 돌파 ${momentumCount}개</span>
    <span class="pill">🎯 최고 매력도 1위: ${bestPick ? `${bestPick.nameKr} (${bestPick.score}점)` : "—"}</span>
  `;

  const newest = Math.max(...picks.map((p) => p.lastTs || 0), Date.now() / 1000);
  const isRegularOpen = market.phase === "regular";
  const basisTag = isRegularOpen ? "정규장 실시간 캔들 스캔" : "최신 종가 확정 스캔";
  els.dataBasis.textContent = `${formatDailyStamp(newest, isRegularOpen)} · ${basisTag}`;
}

function renderClocks() {
  const now = new Date();
  const us = formatZone(now, NY);
  const kr = formatZone(now, KR);
  els.usTime.textContent = `${us.time} ET`;
  els.usDate.textContent = us.date;
  els.krTime.textContent = `${kr.time} KST`;
  els.krDate.textContent = kr.date;

  const market = getMarketStatus(now);
  els.marketDot.className = "dot " + (market.dotClass || "closed");
  els.marketState.textContent = market.label;
  els.marketDetail.textContent = market.detail;

  if (state.nextRefreshAt) {
    const remain = Math.max(0, Math.ceil((state.nextRefreshAt - now.getTime()) / 1000));
    els.nextRefresh.textContent = `${remain}초 후 재스캔`;
  }
}

function setupStrategyTabs() {
  if (!els.strategyTabs) return;
  const buttons = els.strategyTabs.querySelectorAll(".sort-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;
      if (state.filterMode === filter) return;
      state.filterMode = filter;
      buttons.forEach((b) => b.classList.toggle("active", b === btn));
      renderCards(state.detectedPicks);
    });
  });
}

async function scanUniverse() {
  const market = getMarketStatus();

  // 35개 유니버스를 안전하게 병렬 스캔 (Promise.allSettled)
  const results = await Promise.allSettled(
    SCAN_UNIVERSE.map(async (stock) => {
      const chart = await fetchChart(stock.symbol);
      const closes = chart.indicators?.quote?.[0]?.close || [];
      const volumes = chart.indicators?.quote?.[0]?.volume || [];
      const timestamps = chart.timestamp || [];
      const pairs = timestamps
        .map((ts, i) => ({ ts, close: closes[i] }))
        .filter((row) => Number.isFinite(row.close));

      const meta = chart.meta || {};

      // 실시간 시그널 충족 여부 판별 (충족하지 않으면 null)
      return evaluateRealtimeSignal(stock, pairs, volumes, meta);
    })
  );

  let successCount = 0;
  const detected = [];

  results.forEach((res) => {
    if (res.status === "fulfilled") {
      successCount += 1;
      if (res.value != null) {
        detected.push(res.value);
      }
    }
  });

  state.allScannedCount = successCount || SCAN_UNIVERSE.length;
  state.detectedPicks = detected;

  renderSummaryBoards(detected);
  renderCards(detected);
  renderBrief(detected, market);
  state.nextRefreshAt = Date.now() + REFRESH_MS;
}

function schedule() {
  setupStrategyTabs();
  renderSkeletons();
  renderClocks();
  scanUniverse();
  setInterval(renderClocks, 1000);
  setInterval(() => {
    scanUniverse();
  }, REFRESH_MS);
}

schedule();
