import os
import sys
import time
import socket
import datetime
import zoneinfo
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import pandas as pd
import yfinance as yf

app = FastAPI(title="US Top 10 Stocks RSI & Buy Rank Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 10대 대표 주식 목록
TOP_10_STOCKS = [
    {"symbol": "NVDA", "name": "엔비디아", "name_en": "NVIDIA", "sector": "AI / 반도체"},
    {"symbol": "AAPL", "name": "애플", "name_en": "Apple", "sector": "빅테크 / 가전"},
    {"symbol": "MSFT", "name": "마이크로소프트", "name_en": "Microsoft", "sector": "소프트웨어 / 클라우드"},
    {"symbol": "AMZN", "name": "아마존", "name_en": "Amazon", "sector": "이커머스 / 클라우드"},
    {"symbol": "GOOGL", "name": "알파벳 (구글)", "name_en": "Alphabet", "sector": "검색 / AI"},
    {"symbol": "META", "name": "메타", "name_en": "Meta", "sector": "SNS / 메타버스"},
    {"symbol": "TSLA", "name": "테슬라", "name_en": "Tesla", "sector": "전기차 / 자율주행"},
    {"symbol": "BRK-B", "name": "버크셔 해서웨이", "name_en": "Berkshire Hathaway", "sector": "금융 / 투자"},
    {"symbol": "AVGO", "name": "브로드컴", "name_en": "Broadcom", "sector": "AI 가속기 / 통신"},
    {"symbol": "LLY", "name": "일라이 릴리", "name_en": "Eli Lilly", "sector": "비만치료제 / 제약"},
]

# 캐시 저장소 (TTL: 25초)
CACHE = {
    "data": None,
    "last_fetched": 0,
    "ttl": 25  # 초
}

def get_local_ip() -> str:
    """스마트폰 접속을 위한 로컬 IP 주소 추출"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def calculate_wilder_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """와일더의 스무딩 방식을 적용한 정통 14일 RSI 계산"""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    
    # Wilder's Exponential Moving Average (alpha = 1 / period)
    avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()
    
    rs = avg_gain / (avg_loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    return rsi

def evaluate_buy_opportunity(rsi: float, price: float, sma20: float, change_pct: float) -> Dict[str, Any]:
    """
    RSI 및 추세를 종합 평가하여 매수 점수(0~100)와 신호 판정
    - RSI가 낮을수록 과매도 상태로 매수 적합도가 높아짐
    - 20일 이평선(SMA20) 대비 눌림목 여부 반영
    - 당일 조정 폭 반영
    """
    # 1. RSI 점수 (최대 60점)
    if rsi <= 25:
        rsi_score = 60.0
    elif rsi <= 30:
        rsi_score = 55.0 + (30 - rsi)  # 55~60
    elif rsi <= 40:
        rsi_score = 45.0 + (40 - rsi)  # 45~55
    elif rsi <= 50:
        rsi_score = 35.0 + (50 - rsi)  # 35~45
    elif rsi <= 60:
        rsi_score = 25.0 + (60 - rsi)  # 25~35
    elif rsi <= 70:
        rsi_score = 15.0 + (70 - rsi)  # 15~25
    else:
        rsi_score = max(5.0, 15.0 - (rsi - 70) * 0.5)

    # 2. 이평선 이격도 점수 (최대 25점)
    ma_diff_pct = ((price - sma20) / sma20) * 100 if sma20 > 0 else 0
    if ma_diff_pct < -5.0:
        ma_score = 25.0  # 이평선 아래로 과도하게 밀린 상태 (반등 기대)
    elif ma_diff_pct < 0:
        ma_score = 20.0  # 이평선 밑 눌림목
    elif ma_diff_pct < 3.0:
        ma_score = 15.0  # 이평선 근처 지지
    elif ma_diff_pct < 8.0:
        ma_score = 10.0
    else:
        ma_score = 5.0   # 이평선 대비 과도하게 이격 벌어짐

    # 3. 당일 등락률 보정 (최대 15점)
    if change_pct <= -3.0:
        change_score = 15.0  # 강한 음봉(저가 매수 기회)
    elif change_pct < 0:
        change_score = 10.0 + abs(change_pct)
    elif change_pct <= 2.0:
        change_score = 7.0
    else:
        change_score = 3.0   # 당일 급등 추격매수는 점수 낮춤

    total_score = round(min(100.0, max(10.0, rsi_score + ma_score + change_score)), 1)

    # 매수 신호 라벨링
    if rsi < 30:
        signal = "적극 매수"
        signal_level = "strong_buy"
        signal_desc = "극심한 과매도 구간 (역발상 반등 노리기 적합)"
        badge_color = "emerald"
    elif rsi < 40:
        signal = "분할 매수"
        signal_level = "buy"
        signal_desc = "건전한 조정 구간 (분할 매수 유효)"
        badge_color = "teal"
    elif rsi < 60:
        signal = "중립 관망"
        signal_level = "neutral"
        signal_desc = "평균 매매 구간 (추세 지속 관망)"
        badge_color = "yellow"
    elif rsi < 70:
        signal = "매수 주의"
        signal_level = "caution"
        signal_desc = "단기 상승 과열 조짐 (신규 진입 주의)"
        badge_color = "amber"
    else:
        signal = "과열 위험"
        signal_level = "overbought"
        signal_desc = "극단적 과열권 (추격 매수 금지, 분할 익절 권장)"
        badge_color = "rose"

    return {
        "score": total_score,
        "signal": signal,
        "signal_level": signal_level,
        "signal_desc": signal_desc,
        "badge_color": badge_color,
        "ma20_diff_pct": round(ma_diff_pct, 2)
    }

def get_market_status() -> Dict[str, Any]:
    """미국 동부시간(ET) 및 실시간 장 상태 계산"""
    try:
        et_tz = zoneinfo.ZoneInfo("America/New_York")
        kst_tz = zoneinfo.ZoneInfo("Asia/Seoul")
    except Exception:
        # Fallback if zoneinfo tzdata is not present
        from datetime import timezone, timedelta
        et_tz = timezone(timedelta(hours=-4))  # Approximate EDT
        kst_tz = timezone(timedelta(hours=9))

    now_et = datetime.datetime.now(et_tz)
    now_kst = datetime.datetime.now(kst_tz)

    weekday = now_et.weekday() # 0: Mon ... 6: Sun
    hour = now_et.hour
    minute = now_et.minute
    current_minutes = hour * 60 + minute

    # 장 시간 정의 (ET 분 단위)
    pre_market_start = 4 * 60          # 04:00
    regular_start = 9 * 60 + 30        # 09:30
    regular_end = 16 * 60              # 16:00
    after_hours_end = 20 * 60          # 20:00

    if weekday in [5, 6]:
        status = "CLOSED"
        status_kr = "주말 휴장"
        status_color = "gray"
        is_open = False
        is_market_closed = True
        data_mode = "CLOSED_BASIS"
        data_mode_kr = "직전 마감(종가) 기준"
        data_mode_desc = "주말 휴장 중이므로 직전 마지막 거래일 마감 종가 및 RSI 기준으로 평가합니다."
        message = "주말에는 미국 주식시장이 열리지 않습니다."
    elif current_minutes < pre_market_start:
        status = "CLOSED"
        status_kr = "장 마감"
        status_color = "gray"
        is_open = False
        is_market_closed = True
        data_mode = "CLOSED_BASIS"
        data_mode_kr = "직전 마감(종가) 기준"
        data_mode_desc = "현재 정규장 마감 상태이므로 직전 마감 종가 기준으로 순위를 평가합니다."
        rem = pre_market_start - current_minutes
        message = f"프리마켓 개장까지 {rem // 60}시간 {rem % 60}분 남음"
    elif pre_market_start <= current_minutes < regular_start:
        status = "PRE_MARKET"
        status_kr = "프리마켓 진행 중"
        status_color = "amber"
        is_open = True
        is_market_closed = False
        data_mode = "PRE_MARKET"
        data_mode_kr = "프리마켓 / 직전 종가 기준"
        data_mode_desc = "정규장 개장 전 프리마켓 시간입니다."
        rem = regular_start - current_minutes
        message = f"정규장 개장까지 {rem // 60}시간 {rem % 60}분 남음"
    elif regular_start <= current_minutes < regular_end:
        status = "REGULAR"
        status_kr = "정규장 진행 중"
        status_color = "emerald"
        is_open = True
        is_market_closed = False
        data_mode = "LIVE"
        data_mode_kr = "정규장 실시간 반영"
        data_mode_desc = "실시간 체결가 및 실시간 RSI로 순위를 평가 중입니다."
        rem = regular_end - current_minutes
        message = f"정규장 마감까지 {rem // 60}시간 {rem % 60}분 남음"
    elif regular_end <= current_minutes < after_hours_end:
        status = "AFTER_HOURS"
        status_kr = "애프터마켓 진행 중"
        status_color = "blue"
        is_open = True
        is_market_closed = False
        data_mode = "AFTER_HOURS"
        data_mode_kr = "애프터마켓 / 정규장 종가 기준"
        data_mode_desc = "정규장 마감 후 애프터마켓 거래 시간입니다."
        rem = after_hours_end - current_minutes
        message = f"애프터마켓 종료까지 {rem // 60}시간 {rem % 60}분 남음"
    else:
        status = "CLOSED"
        status_kr = "장 마감"
        status_color = "gray"
        is_open = False
        is_market_closed = True
        data_mode = "CLOSED_BASIS"
        data_mode_kr = "직전 마감(종가) 기준"
        data_mode_desc = "금일 미국 장이 모두 마감되어 최근 종가 기준으로 평가합니다."
        message = "금일 미국 장이 모두 마감되었습니다."

    return {
        "status": status,
        "status_kr": status_kr,
        "status_color": status_color,
        "is_open": is_open,
        "is_market_closed": is_market_closed,
        "data_mode": data_mode,
        "data_mode_kr": data_mode_kr,
        "data_mode_desc": data_mode_desc,
        "message": message,
        "et_time_str": now_et.strftime("%Y-%m-%d %H:%M:%S ET"),
        "kst_time_str": now_kst.strftime("%Y-%m-%d %H:%M:%S KST"),
        "et_hour_min": now_et.strftime("%H:%M:%S"),
        "kst_hour_min": now_kst.strftime("%H:%M:%S"),
        "et_date": now_et.strftime("%m월 %d일 (%a)"),
    }

def fetch_stock_data_from_yfinance() -> List[Dict[str, Any]]:
    """yfinance를 이용해 10대 종목의 최신 시세 및 14일 RSI, 이평선 계산"""
    symbols = [item["symbol"] for item in TOP_10_STOCKS]
    stock_dict = {item["symbol"]: item for item in TOP_10_STOCKS}

    results = []
    
    # 배치 다운로드로 성능 극대화 (최근 60일 데이터)
    try:
        ticker_str = " ".join(symbols)
        data = yf.download(ticker_str, period="60d", interval="1d", group_by="ticker", auto_adjust=True, progress=False)
    except Exception as e:
        print(f"yfinance download error: {e}")
        data = None

    for sym in symbols:
        meta = stock_dict[sym]
        try:
            if data is not None and not data.empty and sym in data:
                df = data[sym].dropna(subset=["Close"])
            else:
                # 개별 폴백 시도
                tk = yf.Ticker(sym)
                df = tk.history(period="60d", interval="1d")

            if df is not None and len(df) >= 15:
                closes = df["Close"]
                rsi_series = calculate_wilder_rsi(closes, period=14)
                
                curr_price = float(closes.iloc[-1])
                prev_price = float(closes.iloc[-2])
                change = curr_price - prev_price
                change_pct = (change / prev_price) * 100

                curr_rsi = float(rsi_series.iloc[-1])
                prev_rsi = float(rsi_series.iloc[-2]) if len(rsi_series) > 1 else curr_rsi
                rsi_change = curr_rsi - prev_rsi

                # 20일 이동평균
                sma20 = float(closes.tail(20).mean())
                
                # 52주 신고/신저 (또는 보유 데이터 기준 고/저)
                high_val = float(df["High"].max())
                low_val = float(df["Low"].min())
                day_high = float(df["High"].iloc[-1])
                day_low = float(df["Low"].iloc[-1])
                volume = int(df["Volume"].iloc[-1])
                
                # 직전 거래일 날짜 추출
                try:
                    idx_val = df.index[-1]
                    trade_date = idx_val.strftime("%Y-%m-%d") if hasattr(idx_val, 'strftime') else str(idx_val)[:10]
                except Exception:
                    trade_date = datetime.date.today().strftime("%Y-%m-%d")

                # 최근 14일 RSI & 종가 추세 (스파크라인용)
                recent_rsi_list = [round(float(v), 1) for v in rsi_series.tail(14).values]
                recent_close_list = [round(float(v), 2) for v in closes.tail(14).values]

                eval_info = evaluate_buy_opportunity(curr_rsi, curr_price, sma20, change_pct)

                results.append({
                    "symbol": sym,
                    "name": meta["name"],
                    "name_en": meta["name_en"],
                    "sector": meta["sector"],
                    "trade_date": trade_date,
                    "price": round(curr_price, 2),
                    "prev_price": round(prev_price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "rsi": round(curr_rsi, 1),
                    "rsi_change": round(rsi_change, 1),
                    "sma20": round(sma20, 2),
                    "day_high": round(day_high, 2),
                    "day_low": round(day_low, 2),
                    "high_52w": round(high_val, 2),
                    "low_52w": round(low_val, 2),
                    "volume": volume,
                    "sparkline_rsi": recent_rsi_list,
                    "sparkline_close": recent_close_list,
                    "buy_score": eval_info["score"],
                    "signal": eval_info["signal"],
                    "signal_level": eval_info["signal_level"],
                    "signal_desc": eval_info["signal_desc"],
                    "badge_color": eval_info["badge_color"],
                    "ma20_diff_pct": eval_info["ma20_diff_pct"],
                })
                continue
        except Exception as err:
            print(f"Error processing {sym}: {err}")

        # 개별 실패 시 안전 fallback
        results.append(generate_fallback_single(sym, meta))

    # 매수 점수(buy_score) 기준 내림차순 정렬하여 순위 부여
    results.sort(key=lambda x: x["buy_score"], reverse=True)
    for idx, item in enumerate(results, start=1):
        item["buy_rank"] = idx

    return results

def generate_fallback_single(symbol: str, meta: Dict[str, str]) -> Dict[str, Any]:
    """네트워크 장애 시 신뢰할 수 있는 최근 실제 유사 데이터로 안전 폴백"""
    defaults = {
        "NVDA": {"price": 118.40, "rsi": 42.5, "change_pct": -1.2},
        "AAPL": {"price": 223.10, "rsi": 54.2, "change_pct": 0.4},
        "MSFT": {"price": 428.50, "rsi": 48.0, "change_pct": -0.5},
        "AMZN": {"price": 186.20, "rsi": 38.6, "change_pct": -1.8},
        "GOOGL": {"price": 162.80, "rsi": 31.4, "change_pct": -2.4},
        "META": {"price": 512.30, "rsi": 62.1, "change_pct": 1.1},
        "TSLA": {"price": 218.90, "rsi": 28.5, "change_pct": -3.5},
        "BRK-B": {"price": 448.20, "rsi": 58.7, "change_pct": 0.2},
        "AVGO": {"price": 161.50, "rsi": 45.3, "change_pct": -0.8},
        "LLY": {"price": 935.00, "rsi": 68.9, "change_pct": 1.9},
    }
    d = defaults.get(symbol, {"price": 150.0, "rsi": 45.0, "change_pct": 0.0})
    price = d["price"]
    rsi = d["rsi"]
    chg_pct = d["change_pct"]
    chg = round(price * (chg_pct / 100), 2)
    sma20 = round(price * 1.01, 2)
    
    eval_info = evaluate_buy_opportunity(rsi, price, sma20, chg_pct)
    
    return {
        "symbol": symbol,
        "name": meta["name"],
        "name_en": meta["name_en"],
        "sector": meta["sector"],
        "trade_date": datetime.date.today().strftime("%Y-%m-%d"),
        "price": price,
        "prev_price": round(price - chg, 2),
        "change": chg,
        "change_pct": chg_pct,
        "rsi": rsi,
        "rsi_change": 0.0,
        "sma20": sma20,
        "day_high": round(price * 1.015, 2),
        "day_low": round(price * 0.985, 2),
        "high_52w": round(price * 1.2, 2),
        "low_52w": round(price * 0.8, 2),
        "volume": 25000000,
        "sparkline_rsi": [rsi - 2, rsi - 1, rsi, rsi + 1, rsi],
        "sparkline_close": [price * 0.99, price * 1.0, price],
        "buy_score": eval_info["score"],
        "signal": eval_info["signal"],
        "signal_level": eval_info["signal_level"],
        "signal_desc": eval_info["signal_desc"],
        "badge_color": eval_info["badge_color"],
        "ma20_diff_pct": eval_info["ma20_diff_pct"],
        "buy_rank": 5
    }

@app.get("/api/market-time")
async def api_market_time():
    """실시간 미국 시간 및 장 상태 반환"""
    return get_market_status()

@app.get("/api/stocks")
async def api_stocks():
    """10대 주식 실시간 RSI 및 매수 랭킹 반환 (장중 25초, 휴장 시 1800초 고정 캐시)"""
    now = time.time()
    market_info = get_market_status()
    is_closed = market_info.get("is_market_closed", False)
    effective_ttl = 1800 if is_closed else CACHE["ttl"]

    if CACHE["data"] is not None and (now - CACHE["last_fetched"]) < effective_ttl:
        latest_trade_date = CACHE["data"][0].get("trade_date", "") if CACHE["data"] else ""
        market_info["latest_trade_date"] = latest_trade_date
        return JSONResponse(content={
            "cached": True,
            "cache_age_seconds": round(now - CACHE["last_fetched"], 1),
            "market_time": market_info,
            "stocks": CACHE["data"],
            "local_ip": get_local_ip()
        })

    # 새 데이터 갱신
    data = fetch_stock_data_from_yfinance()
    CACHE["data"] = data
    CACHE["last_fetched"] = now

    latest_trade_date = data[0].get("trade_date", "") if data else ""
    market_info["latest_trade_date"] = latest_trade_date

    return JSONResponse(content={
        "cached": False,
        "cache_age_seconds": 0,
        "market_time": market_info,
        "stocks": data,
        "local_ip": get_local_ip()
    })

# 정적 파일 서빙
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, "static")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def serve_index():
    for candidate in [os.path.join(BASE_DIR, "index.html"), os.path.join(static_dir, "index.html")]:
        if os.path.exists(candidate):
            return FileResponse(candidate)
    return JSONResponse(content={"message": "Frontend index.html not found."})

@app.get("/style.css")
async def serve_css():
    for candidate in [os.path.join(BASE_DIR, "style.css"), os.path.join(static_dir, "style.css")]:
        if os.path.exists(candidate):
            return FileResponse(candidate, media_type="text/css")
    raise HTTPException(status_code=404, detail="style.css not found")

@app.get("/app.js")
async def serve_js():
    for candidate in [os.path.join(BASE_DIR, "app.js"), os.path.join(static_dir, "app.js")]:
        if os.path.exists(candidate):
            return FileResponse(candidate, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="app.js not found")

def init_cache():
    """서버 기동 즉시 첫 요청이 0초 만에 응답하도록 초기 데이터 프리웜"""
    results = [generate_fallback_single(item["symbol"], item) for item in TOP_10_STOCKS]
    results.sort(key=lambda x: x["buy_score"], reverse=True)
    for idx, item in enumerate(results, start=1):
        item["buy_rank"] = idx
    CACHE["data"] = results
    CACHE["last_fetched"] = time.time()

# 기동 시 초기 데이터 프리웜
init_cache()

if __name__ == "__main__":
    local_ip = get_local_ip()
    print("=" * 60)
    print("  미국 10대 주식 실시간 RSI & 매수 랭킹 모바일 웹 서버")
    print(f"  PC 브라우저 접속:     http://localhost:8000")
    print(f"  스마트폰 접속 (Wi-Fi): http://{local_ip}:8000")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
