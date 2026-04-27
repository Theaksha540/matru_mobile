@echo off
echo Starting ADB logs for NIRIKHYANA-PURI Preview...
echo.
echo Make sure:
echo 1. Android device is connected via USB
echo 2. USB Debugging is enabled
echo 3. Preview APK is installed
echo.
pause

echo Clearing previous logs...
adb logcat -c

echo Starting live logs (Press Ctrl+C to stop)...
echo.
adb logcat | findstr /i "ReactNativeJS NIRIKHYANA com.akshay1998.NIRIKHYANAPURI"