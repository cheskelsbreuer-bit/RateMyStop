@echo off
REM Local dev server for the frontend (Windows).
REM Uses Python's built-in http.server. Run from inside C:\Users\chaya\Downloads\pp\ratemystop\frontend

echo Frontend serving on http://localhost:5500
echo Make sure the backend is running on http://localhost:8000
echo.
python -m http.server 5500
