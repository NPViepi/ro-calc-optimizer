; Hooks do instalador NSIS do Tauri (tauri.conf.json -> bundle.windows.nsis.installerHooks).
;
; Antes de instalar, remove a versao antiga feita com Electron (electron-builder), para nao
; ficarem duas instalacoes. O electron-builder grava a pasta de instalacao em
; HKCU/HKLM\Software\<GUID>, onde GUID = UUIDv5(appId, namespace do electron-builder
; 50e065bc-3134-11e6-9bab-38c9862bdaf3) para appId br.com.npviepi.rocalcoptimizer.
; A pasta %APPDATA%\RO Calc Optimizer (com o migration.json) nao e apagada pelo desinstalador.

!define RO_ELECTRON_GUID "a2a3cea5-e61a-547d-aa81-5e9dd501886f"
!define RO_ELECTRON_UNINSTALLER "Uninstall RO Calc Optimizer.exe"

!macro RO_REMOVE_ELECTRON ROOT FLAG
  StrCpy $R0 ""
  ClearErrors
  ReadRegStr $R0 ${ROOT} "Software\${RO_ELECTRON_GUID}" "InstallLocation"
  ${If} $R0 != ""
  ${AndIf} ${FileExists} "$R0\${RO_ELECTRON_UNINSTALLER}"
    DetailPrint "Removendo a versao Electron antiga em $R0"
    ; _?= faz o ExecWait esperar o desinstalador terminar (ele nao se copia para o TEMP).
    ExecWait '"$R0\${RO_ELECTRON_UNINSTALLER}" ${FLAG} /S _?=$R0' $R1
    Delete "$R0\${RO_ELECTRON_UNINSTALLER}"
    RMDir "$R0"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  Push $R0
  Push $R1
  !insertmacro RO_REMOVE_ELECTRON HKCU "/currentuser"
  !insertmacro RO_REMOVE_ELECTRON HKLM "/allusers"
  Pop $R1
  Pop $R0
!macroend
