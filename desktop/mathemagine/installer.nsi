; Mathemagine (platform) per-user Windows installer (no admin needed).
; Package: npx @electron/packager . "Mathemagine Platform" --platform=win32 --arch=x64 --icon=icon.ico
; Build: makensis -DSRC=<"Mathemagine Platform-win32-x64" dir> -DICON=icon.ico -DVER=1.0.0 installer.nsi
; Every path, key and shortcut differs from desktop/academia/installer.nsi so the
; two apps install side by side and never uninstall or overwrite each other.
Unicode true
!include "MUI2.nsh"
Name "Mathemagine"
OutFile "Mathemagine-Platform-Setup-${VER}.exe"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\Mathemagine Platform"
SetCompressor /SOLID lzma
!define EXE "Mathemagine Platform.exe"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Open Mathemagine"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\MathemaginePlatform"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
VIProductVersion "${VER}.0"
VIAddVersionKey "ProductName" "Mathemagine"
VIAddVersionKey "FileDescription" "Mathemagine installer"
VIAddVersionKey "FileVersion" "${VER}"
VIAddVersionKey "ProductVersion" "${VER}"
VIAddVersionKey "CompanyName" "Mathemagine"
VIAddVersionKey "LegalCopyright" "Mathemagine"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  File "/oname=Mathemagine.ico" "${ICON}"
  WriteUninstaller "$INSTDIR\Uninstall Mathemagine Platform.exe"
  CreateShortcut "$DESKTOP\Mathemagine Platform.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\Mathemagine.ico"
  CreateShortcut "$SMPROGRAMS\Mathemagine Platform.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\Mathemagine.ico"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "Mathemagine (platform)"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VER}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "Mathemagine"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\Mathemagine.ico"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall Mathemagine Platform.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Mathemagine Platform.lnk"
  Delete "$SMPROGRAMS\Mathemagine Platform.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNKEY}"
  ; Only this app's own data folder; never $APPDATA\Mathemagine (offline Academia).
  RMDir /r "$APPDATA\Mathemagine Platform"
SectionEnd
