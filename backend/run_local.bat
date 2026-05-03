@echo off
REM Local dev launcher for the RateMyStop backend (Windows).
REM Run this from inside C:\Users\chaya\Downloads\pp\ratemystop\backend

if not exist .venv (
    echo Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo Installing dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if not exist .env (
    copy .env.example .env
    echo Created .env from .env.example. Edit it if you want to enable Resend etc.
)

if not exist ratemystop.db (
    echo Seeding initial demo data...
    python seed.py
)

echo.
echo Backend starting on http://localhost:8000
echo API docs:                http://localhost:8000/docs
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
