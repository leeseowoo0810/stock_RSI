const STOCKS = [
  { symbol: "NVDA", name: "NVIDIA", nameKr: "엔비디아" },
  { symbol: "AAPL", name: "Apple", nameKr: "애플" },
  { symbol: "GOOGL", name: "Alphabet", nameKr: "알파벳" },
  { symbol: "MSFT", name: "Microsoft", nameKr: "마이크로소프트" },
  { symbol: "AMZN", name: "Amazon", nameKr: "아마존" },
  { symbol: "AVGO", name: "Broadcom", nameKr: "브로드컴" },
  { symbol: "META", name: "Meta", nameKr: "메타" },
  { symbol: "TSLA", name: "Tesla", nameKr: "테슬라" },
  { symbol: "BRK-B", name: "Berkshire", nameKr: "버크셔 해서웨이" },
  { symbol: "MU", name: "Micron", nameKr: "마이크론" },
];

const RSI_PERIOD = 14;
const PRE_OPEN_MIN = 4 * 60;      // 04:00 ET 프리마켓 시작
const OPEN_MIN = 9 * 60 + 30;     // 09:30 ET 정규장 시작
const CLOSE_MIN = 16 * 60;        // 16:00 ET 정규장 마감
const POST_CLOSE_MIN = 20 * 60;   // 20:00 ET 애프터마켓 마감
const REFRESH_MS = 60_000;

const HOLIDAYS = new Set([
  "2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26",
  "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

const EARLY_CLOSE = new Set([
  "2025-07-03", "2025-11-28", "2025-12-24",
  "2026-11-27", "2026-12-24",
  "2027-11-26",
]);

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
  buyRankList: document.getElementById("buy-rank-list"),
  sellRankList: document.getElementById("sell-rank-list"),
  sortTabs: document.getElementById("sort-tabs"),
};

const state = {
  lastQuotes: [],
  nextRefreshAt: 0,
  proxyIndex: 0,
  wasOpen: null,
  lastPhase: null,
  sortMode: "default",
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

function sessionCloseMinutes(ymd) {
  return EARLY_CLOSE.has(ymd) ? 13 * 60 : CLOSE_MIN;
}

function isWeekend(weekday) {
  return weekday === "Sat" || weekday === "Sun";
}

function getMarketStatus(now = new Date()) {
  const ny = nyParts(now);
  const closeMin = sessionCloseMinutes(ny.ymd);
  const holiday = HOLIDAYS.has(ny.ymd);
  const weekend = isWeekend(ny.weekday);

  if (weekend) {
    return {
      open: false,
      active: false,
      label: "주말 휴장",
      detail: "미국 증시는 월요일 프리마켓(04:00 ET)에 다시 열립니다.",
      phase: "weekend",
      dotClass: "closed",
      session: "CLOSED",
      sessionName: "주말 휴장",
      ny,
    };
  }
  if (holiday) {
    return {
      open: false,
      active: false,
      label: "휴장일",
      detail: "오늘은 미국 증시 휴장일입니다. 가장 최근 거래일 종가 기준입니다.",
      phase: "holiday",
      dotClass: "closed",
      session: "CLOSED",
      sessionName: "휴장일",
      ny,
    };
  }

  // 1. 야간 / 새벽 (00:00 ~ 04:00 ET)
  if (ny.minutes < PRE_OPEN_MIN) {
    return {
      open: false,
      active: false,
      label: "야간 휴장 (Overnight)",
      detail: `정규장 개장(09:30 ET) 전입니다. 최근 거래일 일봉 종가를 유지합니다.`,
      phase: "closed",
      dotClass: "closed",
      session: "CLOSED",
      sessionName: "야간 휴장",
      ny,
    };
  }

  // 2. 프리마켓 (04:00 ~ 09:30 ET)
  if (ny.minutes < OPEN_MIN) {
    return {
      open: false,
      active: false,
      label: "프리마켓 진행 중 (일봉: 직전 종가 기준)",
      detail: `정규장 개장(09:30 ET)까지 ${formatCountdown(OPEN_MIN - ny.minutes)} 남았습니다. 정규장 개장 시 당일 일봉이 갱신됩니다.`,
      phase: "pre",
      dotClass: "pre",
      session: "PRE",
      sessionName: "프리마켓",
      ny,
    };
  }

  // 3. 정규장 (09:30 ~ 16:00 ET 또는 조기폐장)
  if (ny.minutes < closeMin) {
    return {
      open: true,
      active: true,
      label: "정규장 진행 중 (실시간 일봉 반영)",
      detail: `뉴욕 정규장 진행 중 · 당일 일봉 실시간 반영 · 폐장까지 ${formatCountdown(closeMin - ny.minutes)}`,
      phase: "regular",
      dotClass: "open",
      session: "REG",
      sessionName: "정규장",
      ny,
    };
  }

  // 4. 애프터마켓 (16:00 ~ 20:00 ET)
  if (ny.minutes < POST_CLOSE_MIN) {
    return {
      open: false,
      active: false,
      label: "오늘 정규장 마감 (일봉 확정)",
      detail: `오늘 정규장이 마감되어 당일 일봉이 확정되었습니다. (애프터마켓 진행 중)`,
      phase: "post",
      dotClass: "post",
      session: "POST",
      sessionName: "애프터",
      ny,
    };
  }

  // 5. 모든 거래 마감 (20:00 ~ 24:00 ET)
  return {
    open: false,
    active: false,
    label: "정규·시간외 거래 마감 (일봉 확정)",
    detail: "오늘 거래가 모두 마감되었습니다. 최신 일봉 종가 기준입니다.",
    phase: "closed",
    dotClass: "closed",
    session: "CLOSED",
    sessionName: "장 마감",
    ny,
  };
}

function formatCountdown(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}분`;
  return `${h}시간 ${m}분`;
}

// 기존과 100% 동일한 Wilder's RSI(14) 계산 알고리즘
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

// RSI 수치에 따른 상태 분석 (일봉 관점의 해설)
function analyzeRsi(rsi, changePct) {
  if (rsi == null) {
    return { level: "데이터 부족", tone: "", note: "일봉 데이터가 아직 충분하지 않습니다." };
  }
  const drift = changePct >= 0 ? "상승" : "하락";
  if (rsi >= 80) {
    return {
      level: "극단 과매수",
      tone: "hot",
      note: `일봉 RSI가 80을 넘었습니다. 중단기 과열권이며 ${drift} 탄력은 강하나 급격한 되돌림에 유의해야 합니다.`,
    };
  }
  if (rsi >= 70) {
    return {
      level: "과매수",
      tone: "hot",
      note: `매수세가 지배하는 일봉 과매수 구간입니다. 추세 상승이 지속될 수 있으나 분할 차익 실현을 고려할 시점입니다.`,
    };
  }
  if (rsi >= 60) {
    return {
      level: "매수 우위",
      tone: "",
      note: `중립 상단입니다. 일봉 모멘텀이 상승 추세 쪽에 놓여 있어 긍정적 흐름을 유지하고 있습니다.`,
    };
  }
  if (rsi >= 40) {
    return {
      level: "중립",
      tone: "",
      note: `40–60 박스권입니다. 뚜렷한 추세보다는 수급 공방과 기간 조정이 진행 중인 구간입니다.`,
    };
  }
  if (rsi >= 30) {
    return {
      level: "매도 우위",
      tone: "",
      note: `중립 하단입니다. 일봉상 매도 압력이 우세하므로 지지선 확인이 필요합니다.`,
    };
  }
  if (rsi >= 20) {
    return {
      level: "과매도",
      tone: "cold",
      note: `일봉 RSI 30 이하 과매도 구간입니다. 주가 낙폭이 컸으나 기술적 스윙 반등 타점을 노릴 수 있습니다.`,
    };
  }
  return {
    level: "극단 과매도",
    tone: "cold",
    note: `일봉 RSI가 20 아래로 급락했습니다. 과도한 패닉 매도 구간으로 바닥권 반등 잠재력이 높습니다.`,
  };
}

// Yahoo Finance 일봉(1d, 1년치) URL
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
  throw lastError || new Error("시세를 불러오지 못했습니다.");
}

function parseQuote(stock, chart, marketStatus) {
  const closes = chart.indicators?.quote?.[0]?.close || [];
  const timestamps = chart.timestamp || [];
  const pairs = timestamps
    .map((ts, i) => ({ ts, close: closes[i] }))
    .filter((row) => Number.isFinite(row.close));

  const last = pairs[pairs.length - 1];
  const rsi = wilderRsi(pairs.map((row) => row.close));
  const meta = chart.meta || {};

  const market = marketStatus || getMarketStatus();
  const isRegularOpen = market.phase === "regular";

  // 최신 일봉 종가 (장중이면 실시간 현재가/마지막 일봉 체결가)
  let price = last?.close;
  if (price == null) {
    price = meta.regularMarketPrice ?? meta.chartPreviousClose;
  }

  // 전일 일봉 종가 대비 등락폭/등락률 계산
  // pairs의 마지막에서 두 번째 봉이 전일 일봉 종가
  let prev = pairs.length >= 2 ? pairs[pairs.length - 2].close : null;
  if (prev == null) {
    prev = meta.chartPreviousClose ?? meta.previousClose;
  }

  const change = price != null && prev != null ? price - prev : 0;
  const changePct = prev ? (change / prev) * 100 : 0;
  const analysis = analyzeRsi(rsi, changePct);

  return {
    ...stock,
    price,
    change,
    changePct,
    rsi,
    analysis,
    session: isRegularOpen ? "REG" : "CLOSED",
    sessionName: isRegularOpen ? "1D 장중" : "1D 종가",
    lastTs: last?.ts ?? meta.regularMarketTime,
    currency: meta.currency || "USD",
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
  els.grid.innerHTML = STOCKS.map(
    (s) => `
      <article class="card loading">
        <div>
          <div class="ticker">${s.symbol}</div>
          <div class="name">${s.nameKr}</div>
        </div>
        <p class="note">일봉을 불러오는 중…</p>
      </article>`
  ).join("");
}

// 기존과 100% 동일한 매수/매도 순위 및 시그널 산출 알고리즘
function calculateRankingsAndSignals(quotes) {
  const valid = quotes.filter((q) => Number.isFinite(q.rsi));

  // 매수 순위: RSI 낮은 순 (과매도 우선, 기술적 스윙 반등 잠재력)
  const buySorted = [...valid].sort((a, b) => a.rsi - b.rsi);
  const buyRankMap = new Map();
  buySorted.forEach((q, idx) => {
    buyRankMap.set(q.symbol, idx + 1);
  });

  // 매도 순위: RSI 높은 순 (과매수 우선, 차익 실현 경계)
  const sellSorted = [...valid].sort((a, b) => b.rsi - a.rsi);
  const sellRankMap = new Map();
  sellSorted.forEach((q, idx) => {
    sellRankMap.set(q.symbol, idx + 1);
  });

  return quotes.map((q) => {
    if (!Number.isFinite(q.rsi)) {
      return {
        ...q,
        buyRank: null,
        sellRank: null,
        signal: { type: "neutral", label: "데이터 없음", desc: "일봉 수신 실패" },
      };
    }
    const buyRank = buyRankMap.get(q.symbol);
    const sellRank = sellRankMap.get(q.symbol);

    let signal = {
      type: "neutral",
      label: "중립 · 박스권",
      desc: "40~60 박스권입니다. 일간 방향성 탐색 구간으로 관망이 유리합니다.",
    };

    if (q.rsi <= 25) {
      signal = {
        type: "cold",
        label: "🚨 적극 매수 타점 (극단 과매도)",
        desc: "일봉 RSI 25 이하 단기 급락권입니다. 기술적 스윙 반등 잠재력이 가장 높은 구간입니다.",
      };
    } else if (q.rsi <= 35) {
      signal = {
        type: "cold",
        label: "🟢 분할 매수 타점 (과매도)",
        desc: "일봉 RSI 35 이하 진입. 일간 낙폭과대로 저가 매수세 유입 가능성이 높습니다.",
      };
    } else if (q.rsi >= 75) {
      signal = {
        type: "hot",
        label: "🚨 적극 매도 경계 (극단 과열)",
        desc: "일봉 RSI 75 이상 과열권입니다. 급격한 되돌림 및 차익 실현 리스크에 유의하세요.",
      };
    } else if (q.rsi >= 65) {
      signal = {
        type: "hot",
        label: "🔴 분할 익절 검토 (과매수)",
        desc: "일봉 RSI 65 이상 상승 지속. 고점 부담으로 분할 차익 실현이 유리한 구간입니다.",
      };
    } else if (q.rsi >= 55) {
      signal = {
        type: "hot",
        label: "🟠 매수 우위 (상승 모멘텀)",
        desc: "중립 상단으로 일간 매수세가 살아있으나 추격 매수는 신중해야 합니다.",
      };
    } else if (q.rsi <= 45) {
      signal = {
        type: "cold",
        label: "🟡 매도 우위 (눌림목 탐색)",
        desc: "중립 하단으로 매도 압력이 우세하나 지지선 형성 여부를 주시하세요.",
      };
    }

    return {
      ...q,
      buyRank,
      sellRank,
      signal,
    };
  });
}

function renderRankBoard(quotes) {
  if (!els.buyRankList || !els.sellRankList) return;
  const valid = quotes.filter((q) => Number.isFinite(q.rsi) && q.buyRank != null);
  if (!valid.length) {
    els.buyRankList.innerHTML = `<div class="rank-loading">시세 수신 중…</div>`;
    els.sellRankList.innerHTML = `<div class="rank-loading">시세 수신 중…</div>`;
    return;
  }

  const buyTop3 = [...valid].sort((a, b) => a.buyRank - b.buyRank).slice(0, 3);
  const sellTop3 = [...valid].sort((a, b) => a.sellRank - b.sellRank).slice(0, 3);

  els.buyRankList.innerHTML = buyTop3
    .map(
      (q) => `
      <div class="rank-item">
        <div class="rank-left">
          <span class="rank-order ${q.buyRank === 1 ? "gold" : ""}">${q.buyRank}</span>
          <div class="rank-info">
            <span class="rank-name">${q.nameKr}</span>
            <span class="rank-ticker">${q.symbol} · $${money(q.price)}</span>
          </div>
        </div>
        <div class="rank-right">
          <span class="rank-rsi cold">${rsiText(q.rsi)}</span>
          <span class="rank-tag ${q.signal.type}">${q.signal.label}</span>
        </div>
      </div>`
    )
    .join("");

  els.sellRankList.innerHTML = sellTop3
    .map(
      (q) => `
      <div class="rank-item">
        <div class="rank-left">
          <span class="rank-order ${q.sellRank === 1 ? "gold" : ""}">${q.sellRank}</span>
          <div class="rank-info">
            <span class="rank-name">${q.nameKr}</span>
            <span class="rank-ticker">${q.symbol} · $${money(q.price)}</span>
          </div>
        </div>
        <div class="rank-right">
          <span class="rank-rsi hot">${rsiText(q.rsi)}</span>
          <span class="rank-tag ${q.signal.type}">${q.signal.label}</span>
        </div>
      </div>`
    )
    .join("");
}

function renderCards(quotes) {
  let displayQuotes = [...quotes];
  if (state.sortMode === "buy") {
    displayQuotes.sort((a, b) => {
      if (a.buyRank == null) return 1;
      if (b.buyRank == null) return -1;
      return a.buyRank - b.buyRank;
    });
  } else if (state.sortMode === "sell") {
    displayQuotes.sort((a, b) => {
      if (a.sellRank == null) return 1;
      if (b.sellRank == null) return -1;
      return a.sellRank - b.sellRank;
    });
  }

  const market = getMarketStatus();
  const isRegularOpen = market.phase === "regular";

  els.grid.innerHTML = displayQuotes
    .map((q) => {
      const up = q.changePct >= 0;
      const rsiWidth = Number.isFinite(q.rsi) ? Math.max(2, Math.min(100, q.rsi)) : 0;
      const buyPillClass = q.buyRank <= 3 ? "rank-pill buy top" : "rank-pill buy";
      const sellPillClass = q.sellRank <= 3 ? "rank-pill sell top" : "rank-pill sell";
      const buyBadge = q.buyRank ? `<span class="${buyPillClass}">매수 #${q.buyRank}위</span>` : "";
      const sellBadge = q.sellRank ? `<span class="${sellPillClass}">매도 #${q.sellRank}위</span>` : "";
      const sessionClass = isRegularOpen ? "open" : "closed";
      const sessionLabel = q.sessionName || (isRegularOpen ? "1D 장중" : "1D 종가");

      return `
        <article class="card">
          <div class="card-top">
            <div>
              <div class="ticker">${q.symbol}</div>
              <div class="name">${q.nameKr}</div>
              <div class="card-ranks">
                ${buyBadge}
                ${sellBadge}
              </div>
            </div>
            <div class="price-wrap">
              <span class="session-badge ${sessionClass}">${sessionLabel}</span>
              <div class="price">$${money(q.price)}</div>
              <div class="chg ${up ? "up" : "down"}">${up ? "+" : ""}${q.changePct.toFixed(2)}%</div>
            </div>
          </div>
          <div class="rsi-row">
            <div class="rsi-num ${q.analysis.tone}">${rsiText(q.rsi)}</div>
            <div class="rsi-level">${q.analysis.level}</div>
          </div>
          <div class="track"><div class="fill" style="width:${rsiWidth}%"></div></div>
          <p class="note">${q.error ? q.error : (q.signal?.desc || q.analysis.note)}</p>
          <div class="action-bar">
            <span class="action-badge ${q.signal?.type || "neutral"}">${q.signal?.label || "신호 대기"}</span>
            <div class="stamp">${q.error ? "갱신 실패" : formatDailyStamp(q.lastTs, isRegularOpen)}</div>
          </div>
        </article>`;
    })
    .join("");
}

function renderBrief(quotes, market) {
  const valid = quotes.filter((q) => Number.isFinite(q.rsi));
  if (!valid.length) {
    els.briefText.textContent = "일봉 시세를 아직 집계하지 못했습니다. 네트워크 또는 시세 서버 상태를 확인하세요.";
    els.briefStats.innerHTML = "";
    return;
  }
  const avg = valid.reduce((sum, q) => sum + q.rsi, 0) / valid.length;
  const hot = valid.filter((q) => q.rsi >= 70).length;
  const cold = valid.filter((q) => q.rsi <= 30).length;
  const up = quotes.filter((q) => q.changePct > 0).length;

  let basis = "";
  if (market.phase === "regular") {
    basis = "현재 뉴욕 정규장이 진행 중이며 실시간 당일 일봉을 반영해 RSI를 계산합니다.";
  } else {
    basis = "정규장 마감 상태이며 가장 최근 확정된 일봉 종가를 기준으로 분석합니다.";
  }

  let color = "균형";
  if (avg >= 60) color = "일간 과열 쪽";
  else if (avg <= 40) color = "일간 침체 쪽";

  const buyTop = [...valid].sort((a, b) => (a.buyRank ?? 99) - (b.buyRank ?? 99))[0];
  const sellTop = [...valid].sort((a, b) => (a.sellRank ?? 99) - (b.sellRank ?? 99))[0];

  els.briefText.textContent = `10종목 평균 일봉 RSI는 ${avg.toFixed(1)}로 ${color}입니다. 일봉 과매수 ${hot}종목, 과매도 ${cold}종목이며 전일 대비 상승은 ${up}종목입니다. ${basis}`;
  els.briefStats.innerHTML = `
    <span class="pill">평균 일봉 RSI ${avg.toFixed(1)}</span>
    <span class="pill">과매수 ${hot}</span>
    <span class="pill">과매도 ${cold}</span>
    <span class="pill">상승 ${up} / 하락 ${quotes.length - up}</span>
    <span class="pill">🟢 매수 1위: ${buyTop ? `${buyTop.nameKr} (${rsiText(buyTop.rsi)})` : "—"}</span>
    <span class="pill">🔴 매도 1위: ${sellTop ? `${sellTop.nameKr} (${rsiText(sellTop.rsi)})` : "—"}</span>
  `;
  const newest = Math.max(...valid.map((q) => q.lastTs || 0));
  const isRegularOpen = market.phase === "regular";
  const basisTag = isRegularOpen ? "정규장 실시간 반영" : "일봉 종가 확정";
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
    els.nextRefresh.textContent = market.active ? `${remain}초 후` : "1분 주기 확인 중";
  }

  if (state.lastPhase && state.lastPhase !== market.phase) {
    loadQuotes();
  }
  state.lastPhase = market.phase;
}

function setupSortTabs() {
  if (!els.sortTabs) return;
  const buttons = els.sortTabs.querySelectorAll(".sort-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.sort;
      if (state.sortMode === mode) return;
      state.sortMode = mode;
      buttons.forEach((b) => b.classList.toggle("active", b === btn));
      if (state.lastQuotes && state.lastQuotes.length) {
        renderCards(state.lastQuotes);
      }
    });
  });
}

async function loadQuotes() {
  const market = getMarketStatus();
  const jobs = STOCKS.map(async (stock) => {
    try {
      const chart = await fetchChart(stock.symbol);
      return parseQuote(stock, chart, market);
    } catch (err) {
      return {
        ...stock,
        price: null,
        changePct: 0,
        rsi: null,
        analysis: { level: "수신 실패", tone: "", note: "" },
        session: "CLOSED",
        sessionName: "일봉 수신 오류",
        error: "일봉 시세 서버에 연결하지 못했습니다.",
        lastTs: null,
      };
    }
  });
  const quotes = await Promise.all(jobs);
  const rankedQuotes = calculateRankingsAndSignals(quotes);
  state.lastQuotes = rankedQuotes;
  renderRankBoard(rankedQuotes);
  renderCards(rankedQuotes);
  renderBrief(rankedQuotes, market);
  state.nextRefreshAt = Date.now() + REFRESH_MS;
}

function schedule() {
  setupSortTabs();
  renderSkeletons();
  renderClocks();
  loadQuotes();
  setInterval(renderClocks, 1000);
  setInterval(() => {
    loadQuotes();
  }, REFRESH_MS);
}

schedule();
