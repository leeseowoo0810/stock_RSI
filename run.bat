@echo off
chcp 65001 >nul
title 미국 10대 주식 실시간 RSI & 매수 랭킹 모바일 트래커
cd /d "%~dp0"
echo ====================================================================
echo  [US Top 10 Stocks RSI Tracker] 미국 10대 주식 실시간 RSI 및 매수 랭킹
echo ====================================================================
echo.
echo 1. 필요한 패키지 확인 및 설치 중... (최초 1회 실행 시 약간의 시간이 소요될 수 있습니다)
pip install -r requirements.txt
echo.
echo 2. 기본 브라우저 자동 실행 중... (http://localhost:8000)
start "" http://localhost:8000
echo.
echo 3. 웹 서버 구동 중... (이 창을 닫지 말고 켜두세요)
echo.
python app.py
pause
