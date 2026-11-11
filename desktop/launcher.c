/* Original portable launcher: complete offline game embedded at compile time. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "payload.hpp"
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <wchar.h>
#define CAP 32768
static int write_game(const wchar_t* destination) {
    wchar_t temporary[CAP];swprintf(temporary,CAP,L"%ls.%lu.new",destination,GetCurrentProcessId());
    HANDLE out=CreateFileW(temporary,GENERIC_WRITE,0,NULL,CREATE_ALWAYS,FILE_ATTRIBUTE_NORMAL,NULL);
    if(out==INVALID_HANDLE_VALUE)return 0;
    DWORD written=0;BOOL ok=WriteFile(out,embedded_html,(DWORD)(sizeof(embedded_html)-1),&written,NULL);
    if(ok)ok=FlushFileBuffers(out);CloseHandle(out);
    if(!ok||written!=sizeof(embedded_html)-1){DeleteFileW(temporary);return 0;}
    return MoveFileExW(temporary,destination,MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)!=0;
}
static wchar_t* file_url(const wchar_t* path) {
    int n=WideCharToMultiByte(CP_UTF8,0,path,-1,NULL,0,NULL,NULL);
    char* utf8=(char*)calloc(n,1);wchar_t* url=(wchar_t*)calloc(n*3+10,sizeof(wchar_t));
    if(!utf8||!url){free(utf8);free(url);return NULL;}
    WideCharToMultiByte(CP_UTF8,0,path,-1,utf8,n,NULL,NULL);wcscpy(url,L"file:///");size_t k=wcslen(url);const wchar_t* hex=L"0123456789ABCDEF";
    for(int i=0;i<n-1;i++){unsigned char c=(unsigned char)utf8[i];if(c=='\\')c='/';if((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='/'||c==':'||c=='-'||c=='_'||c=='.'||c=='~')url[k++]=c;else{url[k++]=L'%';url[k++]=hex[c>>4];url[k++]=hex[c&15];}}
    url[k]=0;free(utf8);return url;
}
int WINAPI WinMain(HINSTANCE instance,HINSTANCE previous,LPSTR command,int show) {
    (void)instance;(void)previous;(void)command;(void)show;
    wchar_t local[CAP],directory[CAP],html[CAP],browser[CAP]={0},base[CAP],arguments[CAP*2];
    if(!GetEnvironmentVariableW(L"LOCALAPPDATA",local,CAP)){MessageBoxW(NULL,L"Your local application data folder is unavailable.",L"DCSMCRAFT",MB_OK|MB_ICONERROR);return 1;}
    swprintf(directory,CAP,L"%ls\\DCSMCRAFT\\Game",local);
    int error=SHCreateDirectoryExW(NULL,directory,NULL);
    if(error!=ERROR_SUCCESS&&error!=ERROR_ALREADY_EXISTS&&error!=ERROR_FILE_EXISTS){MessageBoxW(NULL,L"DCSMCRAFT cannot create its local game folder.",L"DCSMCRAFT",MB_OK|MB_ICONERROR);return 1;}
    swprintf(html,CAP,L"%ls\\index.html",directory);
    if(!write_game(html)){MessageBoxW(NULL,L"DCSMCRAFT cannot write its offline game file. Check available disk space and local folder permissions.",L"DCSMCRAFT",MB_OK|MB_ICONERROR);return 1;}
    /* Hosting/browser helpers can materialize the same embedded HTML without opening a game window. */
    if(!strcmp(command,"--extract-only"))return 0;
    const wchar_t* vars[]={L"ProgramFiles(x86)",L"ProgramFiles",L"LOCALAPPDATA"};
    const wchar_t* relatives[]={L"Microsoft\\Edge\\Application\\msedge.exe",L"Google\\Chrome\\Application\\chrome.exe"};
    for(int i=0;i<3&&!browser[0];i++)if(GetEnvironmentVariableW(vars[i],base,CAP))for(int j=0;j<2;j++){
        wchar_t candidate[CAP];swprintf(candidate,CAP,L"%ls\\%ls",base,relatives[j]);DWORD attrs=GetFileAttributesW(candidate);
        if(attrs!=INVALID_FILE_ATTRIBUTES&&!(attrs&FILE_ATTRIBUTE_DIRECTORY)){wcscpy(browser,candidate);break;}
    }
    if(!browser[0]){MessageBoxW(NULL,L"Install Microsoft Edge or Google Chrome for the dedicated desktop window. Opening the embedded HTML in your default browser instead.",L"DCSMCRAFT",MB_OK|MB_ICONINFORMATION);ShellExecuteW(NULL,L"open",html,NULL,NULL,SW_SHOWNORMAL);return 0;}
    wchar_t* url=file_url(html);if(!url)return 1;
    swprintf(arguments,CAP*2,L"--app=\"%ls\" --user-data-dir=\"%ls\\DCSMCRAFT\\DesktopProfile\" --no-first-run --no-default-browser-check",url,local);free(url);
    SHELLEXECUTEINFOW launch={0};launch.cbSize=sizeof(launch);launch.fMask=SEE_MASK_FLAG_NO_UI;launch.lpVerb=L"open";launch.lpFile=browser;launch.lpParameters=arguments;launch.nShow=SW_SHOWNORMAL;
    if(!ShellExecuteExW(&launch)){MessageBoxW(NULL,L"The desktop browser engine could not start. Please use DCSMCRAFT-Standalone.html.",L"DCSMCRAFT",MB_OK|MB_ICONERROR);return 1;}return 0;
}
#else
int main(int argc,char**argv) {
    if(argc==2&&!strcmp(argv[1],"--version")){puts("DCSMCRAFT desktop launcher 1.4.1");return 0;}
    if(argc!=3||strcmp(argv[1],"--extract-only")){fputs("Use DCSMCRAFT.exe on Windows. This helper verifies the embedded payload.\n",stderr);return 2;}
    FILE* out=fopen(argv[2],"wb");if(!out)return 1;
    size_t written=fwrite(embedded_html,1,sizeof(embedded_html)-1,out);int error=fclose(out);return written==sizeof(embedded_html)-1&&!error?0:1;
}
#endif
