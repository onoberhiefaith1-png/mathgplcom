/**
 * Inline boot watchdog for /academia-app. A saved page from an older release
 * can point at code/styling files that no longer exist, leaving a bare page
 * stuck on "Opening...". If the app has not started after a few seconds while
 * online, remove the broken saved page and offline worker once and reload the
 * live page. Saved schools and results (IndexedDB) are never touched.
 */
export const BOOT_WATCHDOG_MS = 8000;

export const bootWatchdogScript = `(function(){try{
setTimeout(function(){
if(window.__academiaReady||!navigator.onLine)return;
if(sessionStorage.getItem('aca-repair'))return;
sessionStorage.setItem('aca-repair','1');
var jobs=[];
if(navigator.serviceWorker)jobs.push(navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.filter(function(x){var a=x.active||x.waiting||x.installing;return a&&/\\/sw\\.js$/.test(a.scriptURL)}).map(function(x){return x.unregister()}))}));
if(window.caches)jobs.push(caches.keys().then(function(k){return Promise.all(k.filter(function(n){return n==='academia-pages'||/precache/.test(n)}).map(function(n){return caches.delete(n)}))}));
Promise.all(jobs).catch(function(){}).then(function(){location.reload()});
},${BOOT_WATCHDOG_MS});
}catch(e){}})();`;
