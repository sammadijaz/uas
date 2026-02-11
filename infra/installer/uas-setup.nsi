;--------------------------------------------------------------------
; UAS — NSIS Installer Configuration
; Generates a Windows installer for the UAS Desktop App.
; Requires NSIS 3.x (https://nsis.sourceforge.io/)
;--------------------------------------------------------------------

!include "MUI2.nsh"
!include "FileFunc.nsh"

;--------------------------------------------------------------------
; Metadata
;--------------------------------------------------------------------
!define PRODUCT_NAME    "Universal App Store"
!define PRODUCT_SHORT   "UAS"
!define PRODUCT_VERSION "0.1.0"
!define PRODUCT_PUBLISHER "UAS Project"
!define PRODUCT_WEB     "https://github.com/user/uas"
!define INSTALL_DIR     "$LOCALAPPDATA\${PRODUCT_SHORT}"

Name "${PRODUCT_NAME}"
OutFile "uas-setup-${PRODUCT_VERSION}.exe"
InstallDir "${INSTALL_DIR}"
RequestExecutionLevel user          ; No admin required for per-user install
SetCompressor /SOLID lzma

;--------------------------------------------------------------------
; Modern UI Configuration
;--------------------------------------------------------------------
!define MUI_ABORTWARNING
!define MUI_ICON "..\..\desktop\renderer\icon.ico"
!define MUI_UNICON "..\..\desktop\renderer\icon.ico"

;--------------------------------------------------------------------
; Pages
;--------------------------------------------------------------------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

;--------------------------------------------------------------------
; Install Section
;--------------------------------------------------------------------
Section "Install"
    SetOutPath "$INSTDIR"

    ; Copy app files (assumes electron-builder --dir output)
    File /r "..\..\desktop\release\win-unpacked\*.*"

    ; Create CLI shim
    SetOutPath "$INSTDIR\bin"
    File "..\..\cli\dist\*.*"

    ; Write uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"

    ; Start Menu shortcut
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortCut  "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_SHORT}.exe"
    CreateShortCut  "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk"      "$INSTDIR\uninstall.exe"

    ; Add to PATH (user-level)
    EnVar::AddValue "PATH" "$INSTDIR\bin"

    ; Registry for Add/Remove Programs
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_SHORT}" \
        "DisplayName"    "${PRODUCT_NAME}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_SHORT}" \
        "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_SHORT}" \
        "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_SHORT}" \
        "Publisher"      "${PRODUCT_PUBLISHER}"

    ; Calculate install size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_SHORT}" \
        "EstimatedSize" "$0"
SectionEnd

;--------------------------------------------------------------------
; Uninstall Section
;--------------------------------------------------------------------
Section "Uninstall"
    ; Remove PATH entry
    EnVar::DeleteValue "PATH" "$INSTDIR\bin"

    ; Remove shortcuts
    RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"

    ; Remove registry
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_SHORT}"

    ; Remove files
    RMDir /r "$INSTDIR"
SectionEnd
