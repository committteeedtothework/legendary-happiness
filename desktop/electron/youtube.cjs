// YouTube embedded players require an HTTP Referer identifying the application.
// Our packaged page uses a custom local protocol; identify it with the game's
// actual public source website. This changes no cookies, Origin or permissions.
const APP_REFERER = 'https://github.com/committteeedtothework/legendary-happiness/';
const HOSTS = new Set(['www.youtube.com','www.youtube-nocookie.com']);
function youtubeHeaders(details,contentsId){
  let u;try{u=new URL(details.url);}catch{return details.requestHeaders;}
  if(details.webContentsId!==contentsId||u.protocol!=='https:'||!HOSTS.has(u.hostname)||u.port)return details.requestHeaders;
  const headers={...details.requestHeaders};
  for(const key of Object.keys(headers))if(key.toLowerCase()==='referer')delete headers[key];
  headers.Referer=APP_REFERER;return headers;
}
function installYouTubeIdentity(window){
  const contents=window.webContents,session=contents.session;
  session.webRequest.onBeforeSendHeaders({urls:['https://www.youtube.com/*','https://www.youtube-nocookie.com/*']},(details,callback)=>callback({requestHeaders:youtubeHeaders(details,contents.id)}));
}
module.exports={APP_REFERER,youtubeHeaders,installYouTubeIdentity};
