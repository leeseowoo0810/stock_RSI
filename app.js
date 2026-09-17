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
const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;
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
};

const state = {
  lastQuotes: [],
  nextRefreshAt: 0,
  proxyIndex: 0,
  wasOpen: null,
};

function pad(n) {
  return String(n).padStart(2, "0");
}

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
      label: "주말 휴장",
      detail: "정규장은 월요일 09:30 ET에 다시 열립니다.",
      phase: "weekend",
      ny,
    };
  }
  if (holiday) {
    return {
      open: false,
      label: "휴장일",
      detail: "오늘은 미국 증시 휴장일입니다. 최근 정규장 종가 세션을 표시합니다.",
      phase: "holiday",
      ny,
    };
  }
  if (ny.minutes < OPEN_MIN) {
    return {
      open: false,
      label: "장 마감 · 장전",
      detail: `정규장 개장까지 ${formatCountdown(OPEN_MIN - ny.minutes)} 남았습니다.`,
      phase: "pre",
      ny,
    };
  }
  if (ny.minutes >= closeMin) {
    return {
      open: false,
      label: "정규장 마감",
      detail: closeMin === 13 * 60
        ? "오늘은 조기 폐장일입니다. 마지막 정규장 1분봉 기준입니다."
        : "정규장이 끝났습니다. 가장 최근 마감 세션 기준입니다.",
      phase: "closed",
      ny,
    };
  }
  return {
    open: true,
    label: "정규장 개장 중",
    detail: `뉴욕 정규장 진행 중 · 폐장까지 ${formatCountdown(closeMin - ny.minutes)}`,
    phase: "regular",
    ny,
  };
}

function formatCountdown(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}분`;
  return `${h}시간 ${m}분`;
}

function wilderRsi(closes, period = RSI_PERIOD) {
  const prices = closes.filter((v) => Number.isFinite(v));
  if (prices.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
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
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function analyzeRsi(rsi, changePct) {
  if (rsi == null) {
    return { level: "데이터 부족", tone: "", note: "1분봉이 아직 충분하지 않습니다." };
  }
  const drift = changePct >= 0 ? "상승" : "하락";
  if (rsi >= 80) {
    return {
      level: "극단 과매수",
      tone: "hot",
      note: `RSI가 80을 넘었습니다. 단기 과열이며 ${drift} 탄력은 강하지만 되돌림 위험이 큽니다.`,
    };
  }
  if (rsi >= 70) {
    return {
      level: "과매수",
      tone: "hot",
      note: `매수세가 우세한 과매수 구간입니다. 추세가 이어질 수 있으나 차익 실현 매물이 나오기 쉽습니다.`,
    };
  }
  if (rsi >= 60) {
    return {
      level: "매수 우위",
      tone: "",
      note: `중립 상단입니다. 1분 모멘텀이 매수 쪽으로 기울어 있습니다.`,
    };
  }
  if (rsi >= 40) {
    return {
      level: "중립",
      tone: "",
      note: `40–60 박스권입니다. 방향성보다 단기 수급 공방이 강한 상태입니다.`,
    };
  }
  if (rsi >= 30) {
    return {
      level: "매도 우위",
      tone: "",
      note: `중립 하단입니다. 매도 압력이 조금 더 우세합니다.`,
    };
  }
  if (rsi >= 20) {
    return {
      level: "과매도",
      tone: "cold",
      note: `RSI 30 이하 과매도입니다. 낙폭이 컸지만 반등 타점을 노리는 수급이 유입될 수 있습니다.`,
    };
  }
  return {
    level: "극단 과매도",
    tone: "cold",
    note: `RSI가 20 아래로 내려갔습니다. 단기 패닉성 매도에 가깝습니다.`,
  };
}

function yahooUrl(symbol) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=5d&includePrePost=false`;
}

function proxyUrl(url, index) {
  const enc = encodeURIComponent(url);
  const factories = [
    () => url,
    () => `https://corsproxy.io/?${enc}`,
    () => `https://api.allorigins.win/raw?url=${enc}`,
    () => `https://api.codetabs.com/v1/proxy/?quest=${enc}`,
  ];
  return factories[index % factories.length]();
}

async function fetchChart(symbol) {
  let lastError = null;
  for (let offset = 0; offset < 4; offset += 1) {
    const index = (state.proxyIndex + offset) % 4;
    try {
      const res = await fetch(proxyUrl(yahooUrl(symbol), index), {
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

function parseQuote(stock, chart) {
  const closes = chart.indicators?.quote?.[0]?.close || [];
  const timestamps = chart.timestamp || [];
  const pairs = timestamps
    .map((ts, i) => ({ ts, close: closes[i] }))
    .filter((row) => Number.isFinite(row.close));
  const last = pairs[pairs.length - 1];
  const rsi = wilderRsi(pairs.map((row) => row.close));
  const meta = chart.meta || {};
  const price = last?.close ?? meta.regularMarketPrice;
  const prev = meta.chartPreviousClose ?? meta.previousClose;
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

function formatStamp(ts) {
  if (!ts) return "시각 없음";
  const date = new Date(ts * 1000);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: NY,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date) + " ET";
}

function renderSkeletons() {
  els.grid.innerHTML = STOCKS.map(
    (s) => `
      <article class="card loading">
        <div>
          <div class="ticker">${s.symbol}</div>
          <div class="name">${s.nameKr}</div>
        </div>
        <p class="note">1분봉을 불러오는 중…</p>
      </article>`
  ).join("");
}

function renderCards(quotes) {
  els.grid.innerHTML = quotes
    .map((q) => {
      const up = q.changePct >= 0;
      const rsiWidth = Number.isFinite(q.rsi) ? Math.max(2, Math.min(100, q.rsi)) : 0;
      return `
        <article class="card">
          <div class="card-top">
            <div>
              <div class="ticker">${q.symbol}</div>
              <div class="name">${q.nameKr}</div>
            </div>
            <div class="price-wrap">
              <div class="price">$${money(q.price)}</div>
              <div class="chg ${up ? "up" : "down"}">${up ? "+" : ""}${q.changePct.toFixed(2)}%</div>
            </div>
          </div>
          <div class="rsi-row">
            <div class="rsi-num ${q.analysis.tone}">${rsiText(q.rsi)}</div>
            <div class="rsi-level">${q.analysis.level}</div>
          </div>
          <div class="track"><div class="fill" style="width:${rsiWidth}%"></div></div>
          <p class="note">${q.error ? q.error : q.analysis.note}</p>
          <div class="stamp">${q.error ? "갱신 실패" : formatStamp(q.lastTs)}</div>
        </article>`;
    })
    .join("");
}

function renderBrief(quotes, market) {
  const valid = quotes.filter((q) => Number.isFinite(q.rsi));
  if (!valid.length) {
    els.briefText.textContent = "시세를 아직 집계하지 못했습니다. 네트워크 또는 시세 서버 상태를 확인하세요.";
    els.briefStats.innerHTML = "";
    return;
  }
  const avg = valid.reduce((sum, q) => sum + q.rsi, 0) / valid.length;
  const hot = valid.filter((q) => q.rsi >= 70).length;
  const cold = valid.filter((q) => q.rsi <= 30).length;
  const up = quotes.filter((q) => q.changePct > 0).length;
  const basis = market.open
    ? "정규장이 열려 있어 1분마다 최신 1분봉으로 다시 계산합니다."
    : "지금은 정규장이 닫혀 있어 가장 최근 마감 세션의 마지막 1분봉을 기준으로 고정합니다.";
  let color = "균형";
  if (avg >= 60) color = "단기 과열 쪽";
  else if (avg <= 40) color = "단기 위축 쪽";
  els.briefText.textContent = `10종목 평균 1분 RSI는 ${avg.toFixed(1)}로 ${color}입니다. 과매수 ${hot}종목, 과매도 ${cold}종목이며 전일 대비 상승은 ${up}종목입니다. ${basis}`;
  els.briefStats.innerHTML = `
    <span class="pill">평균 RSI ${avg.toFixed(1)}</span>
    <span class="pill">과매수 ${hot}</span>
    <span class="pill">과매도 ${cold}</span>
    <span class="pill">상승 ${up} / 하락 ${quotes.length - up}</span>
  `;
  const newest = Math.max(...valid.map((q) => q.lastTs || 0));
  els.dataBasis.textContent = market.open ? `${formatStamp(newest)} · 실시간` : `${formatStamp(newest)} · 마감 고정`;
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
  els.marketDot.classList.toggle("open", market.open);
  els.marketDot.classList.toggle("closed", !market.open);
  els.marketState.textContent = market.label;
  els.marketDetail.textContent = market.detail;

  if (state.nextRefreshAt) {
    const remain = Math.max(0, Math.ceil((state.nextRefreshAt - now.getTime()) / 1000));
    els.nextRefresh.textContent = market.open ? `${remain}초 후` : "장 개장 시 재개";
  }

  if (state.wasOpen === false && market.open) {
    loadQuotes();
  }
  state.wasOpen = market.open;
}

async function loadQuotes() {
  const market = getMarketStatus();
  const jobs = STOCKS.map(async (stock) => {
    try {
      const chart = await fetchChart(stock.symbol);
      return parseQuote(stock, chart);
    } catch (err) {
      return {
        ...stock,
        price: null,
        changePct: 0,
        rsi: null,
        analysis: { level: "수신 실패", tone: "", note: "" },
        error: "시세 서버에 연결하지 못했습니다.",
        lastTs: null,
      };
    }
  });
  const quotes = await Promise.all(jobs);
  state.lastQuotes = quotes;
  renderCards(quotes);
  renderBrief(quotes, market);
  state.nextRefreshAt = Date.now() + REFRESH_MS;
}

function schedule() {
  renderSkeletons();
  renderClocks();
  loadQuotes();
  setInterval(renderClocks, 1000);
  setInterval(() => {
    if (getMarketStatus().open) loadQuotes();
  }, REFRESH_MS);
}

schedule();
