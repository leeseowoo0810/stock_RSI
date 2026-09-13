# 📈 US Top 10 Stocks RSI & Buy Opportunity Tracker
> **미국 10대 메가캡 주식의 실시간 14일 RSI 및 최적 매수 타이밍 순위 모바일 트래커**

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue?style=for-the-badge&logo=github)](https://pages.github.com/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![TailwindCSS](https://img.shields.io/badge/Style-Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Mobile-First](https://img.shields.io/badge/UI-Mobile--First-success?style=for-the-badge)](https://github.com/)

스마트폰 화면에 최적화된 심플하고 가독성 높은 디자인으로, 미국 10대 대표 주식의 **실시간 14일 RSI(Wilder's Smoothing)**, **매수 적합도 종합 순위(1위~10위)**, **미국 현지 시간(ET) 및 실시간 장 상태**를 한눈에 확인할 수 있는 웹 애플리케이션입니다.

---

## 🌟 핵심 특징

1. **미국 10대 대표 주식 트래킹**
   - 종목: `NVDA`(엔비디아), `AAPL`(애플), `MSFT`(마이크로소프트), `AMZN`(아마존), `GOOGL`(알파벳 구글), `META`(메타), `TSLA`(테슬라), `BRK-B`(버크셔 해서웨이), `AVGO`(브로드컴), `LLY`(일라이 릴리).
2. **정통 14일 Wilder's RSI 연산 & 시각적 게이지 바**
   - 트레이딩뷰 및 블룸버그 터미널과 100% 동일한 J. Welles Wilder 지수평활 공식 적용.
   - 0(과매도 녹색) ~ 30 ~ 70 ~ 100(과열 적색) 게이지 바 위에 현재 RSI 위치 핀 실시간 표시.
3. **종합 매수 기회 점수(0~100점) & 1위~10위 자동 정렬**
   - RSI 과매도(60%) + 20일 이평선(SMA20) 이격도(25%) + 당일 눌림폭(15%)을 결합한 과학적 평가.
   - 💎 **적극 매수 (RSI < 30)** / 🟢 **분할 매수 (30~40)** / 🟡 **중립 관망 (40~60)** / 🟠 **매수 주의 (60~70)** / 🔴 **과열 위험 (RSI > 70)**
4. **미국 동부 시간(ET) & 장 상태 실시간 카운트다운**
   - 뉴욕 현지 시각(서머타임 자동 계산)과 한국 시각(KST) 동시 표시.
   - 🟢 정규장 / 🟡 프리마켓 / 🔵 애프터마켓 / ⚪ 장 마감(주말) 판별 및 다음 세션까지 남은 시간 초 단위 카운트다운.
5. **장 마감/휴장 시 데이터 완전 고정 (Freeze)**
   - 미장이 닫혀있는 동안에는 직전 마지막 거래일 마감 종가 및 RSI를 기준으로 데이터를 안정적으로 고정하여 수치 출렁거림 방지.
6. **서버리스 100% 지원 (GitHub Pages 무료 호스팅)**
   - 브라우저 자체에 내장된 클라이언트 사이드 연산 엔진으로, 파이썬 서버 없이 GitHub Pages만으로 전 세계 어디서든 스마트폰으로 무료 이용 가능.

---

## 🌐 GitHub Pages 배포 방법 (서버 비용 0원)

1. 본 저장소를 본인의 GitHub 계정으로 Fork 또는 Push합니다.
2. 깃허브 저장소 상단 **Settings** 탭으로 이동합니다.
3. 좌측 사이드바에서 **Pages** 메뉴를 클릭합니다.
4. **Branch** 항목에서 `main` (또는 `master`) 브랜치와 `/(root)` 폴더를 선택하고 **Save**를 누릅니다.
5. 1분 뒤 생성되는 `https://<내아이디>.github.io/<저장소이름>/` 주소로 스마트폰이나 PC에서 바로 접속하시면 됩니다!

---

## 💻 로컬 실행 방법 (Windows PC)

### 방법 1. 원클릭 더블 클릭 실행
- `run.bat` 파일을 더블 클릭하면 자동으로 필요한 라이브러리를 체크하고 브라우저(`http://localhost:8000`)를 실행합니다.

### 방법 2. 터미널 명령어로 실행
```bash
# 1. 패키지 설치
pip install -r requirements.txt

# 2. 서버 실행
python app.py
```
- PC 브라우저: `http://localhost:8000`
- 스마트폰 브라우저 (같은 Wi-Fi): `http://[내PC-로컬IP]:8000`

---

## 📂 파일 구조

```
us-stock-rsi-tracker/
├── .gitignore          # 깃허브 업로드 제외 목록 (__pycache__, venv 등)
├── index.html          # 모바일 최적화 웹 메인 페이지 (GitHub Pages 진입점)
├── style.css           # 다크모드 및 RSI 게이지 바 커스텀 스타일
├── app.js              # 프론트엔드 로직 & 클라이언트 사이드 RSI 연산 엔진
├── app.py              # 로컬 FastAPI 백엔드 서버 (고속 캐싱)
├── requirements.txt    # 파이썬 의존성 패키지 명세
├── run.bat             # 윈도우 원클릭 자동 실행 스크립트
└── README.md           # 프로젝트 안내 문서
```

---

## ⚠️ 면책 조항 (Disclaimer)

본 서비스에서 제공하는 RSI 지표 및 매수 순위 평가는 수학적 알고리즘과 기술적 분석에 기반한 **투자 참고용 보조 지표**입니다. 금융 투자에 대한 직접적인 권유나 원금 보장을 의미하지 않으며, 모든 투자의 최종 결정과 책임은 투자자 본인에게 있습니다.
