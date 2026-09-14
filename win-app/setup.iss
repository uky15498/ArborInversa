; ArborInversa（逆生树）安装脚本 —— Inno Setup 6
; 编译：ISCC.exe setup.iss
; 设计要点：
;   · 装到用户目录（{localappdata}\ArborInversa），免管理员、且程序能在自己旁边写 data.json
;   · data.json 与 media\ 标记为「已存在则不动 + 卸载不删」，升级不覆盖用户内容、卸载不丢内容
;   · 安装时检测 WebView2 运行时，缺了就提示（不阻断安装）

#define AppName "ArborInversa"
#define AppNameCn "逆生树"
#define AppVer "1.0.0"
#ifndef SrcDir
  #define SrcDir "C:\ArborInversa"
#endif

[Setup]
AppId={{7A3C1E52-9B4D-4F1A-8E27-5C6D0B9A3F41}
AppName={#AppName}
AppVersion={#AppVer}
AppVerName={#AppName} {#AppNameCn} {#AppVer}
AppPublisher=ArborInversa
DefaultDirName={localappdata}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename={#AppName}-Setup-{#AppVer}
SetupIconFile={#SrcDir}\ArborInversa.ico
UninstallDisplayIcon={app}\{#AppName}.exe
UninstallDisplayName={#AppName} {#AppNameCn}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
VersionInfoVersion={#AppVer}
VersionInfoDescription={#AppName} {#AppNameCn} 安装程序
VersionInfoProductName={#AppName}
VersionInfoProductVersion={#AppVer}
VersionInfoCompany=ArborInversa
AllowNoIcons=yes
CloseApplications=no
MinVersion=6.1sp1

[Languages]
Name: "cn"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:ShortcutsGroup}"; Flags: checkedonce

[Files]
Source: "{#SrcDir}\{#AppName}.exe";            DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcDir}\{#AppName}.exe.config";     DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcDir}\index.html";                DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcDir}\Microsoft.Web.WebView2.Core.dll";     DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcDir}\Microsoft.Web.WebView2.WinForms.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcDir}\WebView2Loader.dll";        DestDir: "{app}"; Flags: ignoreversion
; 用户内容：已存在就不覆盖，卸载也不删（升级/卸载都不丢内容）
Source: "{#SrcDir}\data.json";                 DestDir: "{app}"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "{#SrcDir}\media\*";                   DestDir: "{app}\media"; Flags: onlyifdoesntexist uninsneveruninstall recursesubdirs createallsubdirs
Source: "{#SrcDir}\使用说明.txt";              DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcDir}\美术史树-试用.txt";        DestDir: "{app}"; Flags: ignoreversion
; 许可：限非商业（PolyForm Noncommercial 1.0.0），随包必须带上
Source: "{#SrcDir}\LICENSE.md";                DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppName}.exe"; WorkingDir: "{app}"
Name: "{group}\使用说明"; Filename: "{app}\使用说明.txt"
Name: "{group}\美术史树-试用"; Filename: "{app}\美术史树-试用.txt"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppName}.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppName}.exe"; Description: "{cm:RunApp}"; Flags: nowait postinstall skipifsilent
Filename: "{app}\使用说明.txt";   Description: "{cm:ViewReadme}"; Flags: shellexec postinstall unchecked skipifsilent

[CustomMessages]
cn.CreateDesktopIcon=创建桌面快捷方式
cn.ShortcutsGroup=快捷方式：
cn.RunApp=立即启动 ArborInversa
cn.ViewReadme=查看使用说明
en.CreateDesktopIcon=Create a desktop shortcut
en.ShortcutsGroup=Shortcuts:
en.RunApp=Run ArborInversa
en.ViewReadme=View readme

[Code]
const
  WV2_ID = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WV2_URL = 'https://developer.microsoft.com/microsoft-edge/webview2/';

function WebView2Installed(): Boolean;
begin
  Result :=
    RegValueExists(HKLM32, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + WV2_ID, 'pv') or
    RegValueExists(HKLM64, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + WV2_ID, 'pv') or
    RegValueExists(HKCU32, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + WV2_ID, 'pv') or
    RegValueExists(HKCU64, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + WV2_ID, 'pv');
end;

function InitializeSetup(): Boolean;
var
  ErrCode: Integer;
begin
  Result := True;
  if not WebView2Installed() then
    if MsgBox('This program needs the Microsoft WebView2 Runtime, which was not found on this computer.'
              + #13#10#13#10
              + '本程序需要微软 WebView2 运行时，本机似乎没有装。'
              + #13#10 + '可以继续安装，之后到微软官网装一次 WebView2 即可（免费）。'
              + #13#10#13#10 + '现在打开下载页面吗？ / Open the download page now?',
              mbConfirmation, MB_YESNO) = IDYES then
      ShellExec('open', WV2_URL, '', '', SW_SHOWNORMAL, ewNoWait, ErrCode);
end;
