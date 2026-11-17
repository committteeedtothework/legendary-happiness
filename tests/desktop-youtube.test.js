import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {APP_REFERER,youtubeHeaders,installYouTubeIdentity}=createRequire(import.meta.url)('../desktop/electron/youtube.cjs');
test('the packaged YouTube player identifies the actual app without broadening Origin, cookies or permissions',()=>{
 const input={url:'https://www.youtube-nocookie.com/embed/lhCPiauHI-g',webContentsId:7,requestHeaders:{Origin:'dcsmcraft://game',Cookie:'test-cookie',referer:'dcsmcraft://game/'}};
 const output=youtubeHeaders(input,7);assert.equal(output.Referer,APP_REFERER);assert.equal(output.Origin,'dcsmcraft://game');assert.equal(output.Cookie,'test-cookie');assert.equal(output.referer,undefined);assert.equal(input.requestHeaders.referer,'dcsmcraft://game/');
 for(const url of ['http://www.youtube.com/test','https://youtube.com.evil.test/','https://example.com/','https://www.youtube.com:8443/test','not-a-url']){input.url=url;assert.equal(youtubeHeaders(input,7),input.requestHeaders);}
 input.url='https://www.youtube.com/iframe_api';assert.equal(youtubeHeaders(input,8),input.requestHeaders);
});
test('the app header hook is restricted to the game window and the two HTTPS player hosts',()=>{
 let filter,handler;const window={webContents:{id:3,session:{webRequest:{onBeforeSendHeaders(f,h){filter=f;handler=h;}}}}};installYouTubeIdentity(window);assert.deepEqual(filter.urls,['https://www.youtube.com/*','https://www.youtube-nocookie.com/*']);let response;handler({url:'https://www.youtube.com/iframe_api',webContentsId:3,requestHeaders:{}},r=>response=r);assert.equal(response.requestHeaders.Referer,APP_REFERER);assert.equal(response.cancel,undefined);
});
