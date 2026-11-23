Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"

!define APP "Decorte"
!define WV2KEY "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Decorte"
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"

Name "${APP}"
OutFile "Decorte-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\${APP}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
AutoCloseWindow true
ShowInstDetails nevershow
BrandingText "By Vincent Calavera"

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Section "Instalar"
  SetShellVarContext current
  nsExec::Exec 'taskkill /f /im Decorte.exe'
  SetOutPath "$INSTDIR"
  File /r /x "*.pdb" /x "*.xml" "stage\*.*"

!ifdef WITHWV2
  ; Si falta el motor WebView2 (Windows 10 antiguo), se instala solo.
  StrCpy $1 ""
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WV2KEY}" "pv"
  ${If} $0 != ""
  ${AndIf} $0 != "0.0.0.0"
    StrCpy $1 "ok"
  ${EndIf}
  SetRegView 64
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WV2KEY}" "pv"
  SetRegView 32
  ${If} $0 != ""
  ${AndIf} $0 != "0.0.0.0"
    StrCpy $1 "ok"
  ${EndIf}
  ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\${WV2KEY}" "pv"
  ${If} $0 != ""
  ${AndIf} $0 != "0.0.0.0"
    StrCpy $1 "ok"
  ${EndIf}
  ${If} $1 == ""
    InitPluginsDir
    File "/oname=$PLUGINSDIR\wv2.exe" "MicrosoftEdgeWebview2Setup.exe"
    ExecWait '"$PLUGINSDIR\wv2.exe" /silent /install'
  ${EndIf}
!endif

  CreateShortcut "$DESKTOP\${APP}.lnk" "$INSTDIR\Decorte.exe"
  CreateDirectory "$SMPROGRAMS\${APP}"
  CreateShortcut "$SMPROGRAMS\${APP}\${APP}.lnk" "$INSTDIR\Decorte.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "Vincent Calavera"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\Decorte.exe"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
SectionEnd

Function .onInstSuccess
  Exec '"$INSTDIR\Decorte.exe"'
FunctionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::Exec 'taskkill /f /im Decorte.exe'
  Delete "$DESKTOP\${APP}.lnk"
  Delete "$SMPROGRAMS\${APP}\${APP}.lnk"
  RMDir "$SMPROGRAMS\${APP}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNKEY}"
SectionEnd
