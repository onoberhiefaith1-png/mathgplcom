; Mathemagine per-user Windows installer (no admin needed).
; Build: makensis -DSRC=<packaged Mathemagine-win32-x64 dir> -DICON=icon.ico -DVER=1.0.1 installer.nsi
Unicode true
!include "MUI2.nsh"
Name "Mathemagine"
OutFile "Mathemagine-Setup-${VER}.exe"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\Mathemagine"
SetCompressor /SOLID lzma
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\Mathemagine.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Open Mathemagine"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mathemagine"
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
VIAddVersionKey "CompanyName" "MathGPL"
VIAddVersionKey "LegalCopyright" "MathGPL"

Section "Install"
  ; Close a running copy so files can be replaced on upgrade.
  nsExec::Exec 'taskkill /IM Mathemagine.exe /F'
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  File "/oname=Mathemagine.ico" "${ICON}"
  WriteUninstaller "$INSTDIR\Uninstall Mathemagine.exe"
  CreateShortcut "$DESKTOP\Mathemagine.lnk" "$INSTDIR\Mathemagine.exe" "" "$INSTDIR\Mathemagine.ico"
  CreateShortcut "$SMPROGRAMS\Mathemagine.lnk" "$INSTDIR\Mathemagine.exe" "" "$INSTDIR\Mathemagine.ico"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "Mathemagine"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VER}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "MathGPL"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\Mathemagine.ico"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall Mathemagine.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM Mathemagine.exe /F'
  Delete "$DESKTOP\Mathemagine.lnk"
  Delete "$SMPROGRAMS\Mathemagine.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNKEY}"
  ; Saved schools and progress are kept unless the student says otherwise.
  MessageBox MB_YESNO|MB_DEFBUTTON1 "Keep your saved schools and progress on this computer?$\r$\n$\r$\nChoose Yes if you might install Mathemagine again." IDYES keep
  RMDir /r "$APPDATA\Mathemagine"
  keep:
SectionEnd
