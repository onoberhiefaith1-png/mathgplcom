; Academia per-user Windows installer (no admin needed).
; Package: npx @electron/packager . Academia --platform=win32 --arch=x64 --icon=icon.ico
; Build: makensis -DSRC=<packaged Academia-win32-x64 dir> -DICON=icon.ico -DVER=1.0.2 installer.nsi
; The app was published as "Mathemagine" up to 1.0.1. The install folder,
; uninstall key, app id and data folder keep that earlier name on purpose, so
; an upgrade replaces the old install in place and keeps saved schools and
; progress. Only the names people see change to Academia.
Unicode true
!include "MUI2.nsh"
Name "Academia"
OutFile "Academia-Setup-${VER}.exe"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\Mathemagine"
SetCompressor /SOLID lzma
!define EXE "Academia.exe"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Open Academia"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mathemagine"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
VIProductVersion "${VER}.0"
VIAddVersionKey "ProductName" "Academia"
VIAddVersionKey "FileDescription" "Academia installer"
VIAddVersionKey "FileVersion" "${VER}"
VIAddVersionKey "ProductVersion" "${VER}"
VIAddVersionKey "CompanyName" "Mathemagine"
VIAddVersionKey "LegalCopyright" "Mathemagine"

Section "Install"
  ; Close a running copy (old Mathemagine.exe or new Academia.exe) so files can be replaced.
  nsExec::Exec 'taskkill /IM Mathemagine.exe /F'
  nsExec::Exec 'taskkill /IM Academia.exe /F'
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  File "/oname=Academia.ico" "${ICON}"
  WriteUninstaller "$INSTDIR\Uninstall Academia.exe"
  ; Shortcuts from 1.0.1 were called Mathemagine; replace them with Academia.
  ; (The Mathemagine platform app uses "Mathemagine Platform.lnk", never these.)
  Delete "$DESKTOP\Mathemagine.lnk"
  Delete "$SMPROGRAMS\Mathemagine.lnk"
  CreateShortcut "$DESKTOP\Academia.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\Academia.ico"
  CreateShortcut "$SMPROGRAMS\Academia.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\Academia.ico"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "Academia"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VER}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "Mathemagine"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\Academia.ico"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall Academia.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM Academia.exe /F'
  nsExec::Exec 'taskkill /IM Mathemagine.exe /F'
  Delete "$DESKTOP\Academia.lnk"
  Delete "$SMPROGRAMS\Academia.lnk"
  Delete "$DESKTOP\Mathemagine.lnk"
  Delete "$SMPROGRAMS\Mathemagine.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNKEY}"
  ; Saved schools and progress are kept unless the student says otherwise.
  MessageBox MB_YESNO|MB_DEFBUTTON1 "Keep your saved schools and progress on this computer?$\r$\n$\r$\nChoose Yes if you might install Academia again." IDYES keep
  RMDir /r "$APPDATA\Mathemagine"
  keep:
SectionEnd
