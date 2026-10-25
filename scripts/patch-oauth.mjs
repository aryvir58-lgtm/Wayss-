import fs from "node:fs";

const path = "src/AppV3.tsx";
let s = fs.readFileSync(path, "utf8");

// Native OAuth must open in the system browser and return through the WAYSS
// deep link. Browser-window navigation inside the Capacitor WebView can stay
// on the hosted Netlify origin, which is why the previous patch still failed.
if (!s.includes('from"@capacitor/app"')) {
  s = s.replace('import Messages from "./Messages";', 'import Messages from "./Messages";\nimport{App}from"@capacitor/app";');
}
if (!s.includes('from"@capacitor/browser"')) {
  s = s.replace('import Messages from "./Messages";', 'import Messages from "./Messages";\nimport{Browser}from"@capacitor/browser";');
}
if (!s.includes('from"@capacitor/core"')) {
  s = s.replace('import Messages from "./Messages";', 'import Messages from "./Messages";\nimport{Capacitor}from"@capacitor/core";');
}

const oldGoogle = 'async function google(){if(!supabase)return;const{error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});if(error)setAuthMsg(error.message)}';
const previousGoogle = 'async function google(){if(!supabase)return;const native=window.location.protocol==="capacitor:"||window.location.protocol==="file:";const redirectTo=native?"wayss://auth/callback":window.location.origin;const{error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo}});if(error)setAuthMsg(error.message)}';
const newGoogle = 'async function google(){if(!supabase)return;const native=Capacitor.isNativePlatform();const redirectTo=native?"wayss://auth/callback":window.location.origin;const{data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo,skipBrowserRedirect:native}});if(error){setAuthMsg(error.message);return}if(native&&data?.url){try{await Browser.open({url:data.url})}catch(e){setAuthMsg(String(e))}}}';
if (!s.includes(newGoogle)) {
  if (s.includes(oldGoogle)) s = s.replace(oldGoogle, newGoogle);
  else if (s.includes(previousGoogle)) s = s.replace(previousGoogle, newGoogle);
  else throw new Error("Google login function was not found.");
}

if (!s.includes("WAYSS OAuth callback error")) {
  const marker = ' useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setUser(data.session?.user||null));';
  const bridge = ' useEffect(()=>{let handle;void App.addListener("appUrlOpen",async({url})=>{try{const u=new URL(url);if(u.protocol!=="wayss:"||u.host!=="auth"||u.pathname!=="/callback")return;const code=u.searchParams.get("code");if(code)await supabase?.auth.exchangeCodeForSession(code);await Browser.close().catch(()=>{})}catch(e){console.error("WAYSS OAuth callback error",e)}}).then(h=>{handle=h});return()=>{void handle?.remove()};},[]);\n';
  if (!s.includes(marker)) throw new Error("Auth session hook was not found.");
  s = s.replace(marker, bridge + marker);
}


// Keep the Android bottom bar to exactly five tabs. Messages live beside the
// hamburger in the top bar; the center Plus remains the post composer.
const oldNav = 'const unread=notices.filter(n=>!n.read_at).length;const nav:any=[["Feed",Home],["Orbit",Compass],["Messages",MessageCircle],["Create",Plus],["Flux",Video],["You",UserRound]];';
const newNav = 'const unread=notices.filter(n=>!n.read_at).length;const nav:any=[["Feed",Home],["Orbit",Compass],["Create",Plus],["Flux",Video],["You",UserRound]];';
if (s.includes(oldNav)) s=s.replace(oldNav,newNav);
else if (!s.includes(newNav)) throw new Error("WAYSS navigation tabs declaration was not found.");

const oldMenu = '<button className="icon mobile-settings-menu" title="Settings" aria-label="Settings" onClick={()=>setSettingsOpen(true)}><Menu size={21}/></button>';
const newMenu = '<button className="icon mobile-settings-menu" title="Menu / Settings" aria-label="Menu / Settings" onClick={()=>setSettingsOpen(true)}><Menu size={21}/></button><button className={"icon mobile-messages-button"+(screen==="Messages"?" active":"")} title="Messages" aria-label="Messages" onClick={()=>setScreen("Messages")}><MessageCircle size={20}/></button>';
if (s.includes(oldMenu)) s=s.replace(oldMenu,newMenu);
else if (!s.includes('className="icon mobile-messages-button"') && !s.includes('mobile-messages-button"')) throw new Error("WAYSS top menu button was not found.");

const oldOrbitSearch = '{screen==="Orbit"&&<div className="search orbit-global-search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Find people by name or @username" aria-label="Find people"/></div>}';
const newOrbitSearch = '{screen==="Orbit"&&<div className="search orbit-global-search"><Search size={17}/><input id="wayss-orbit-user-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Find people by name or @username" aria-label="Find people"/></div>}';
if (s.includes(oldOrbitSearch)) s=s.replace(oldOrbitSearch,newOrbitSearch);

const oldTopActions = '<div className="top-actions"><button className="icon" title="Notifications"';
const newTopActions = '<div className="top-actions"><button className="icon mobile-user-search-button" title="Search people" aria-label="Search people" onClick={()=>{setScreen("Orbit");window.setTimeout(()=>document.getElementById("wayss-orbit-user-search")?.focus(),80)}}><Search size={19}/></button><button className="icon" title="Notifications"';
if (s.includes(oldTopActions)) s=s.replace(oldTopActions,newTopActions);
else if (!s.includes('mobile-user-search-button')) throw new Error("WAYSS top actions were not found.");

// The notification shortcut is desktop/sidebar only. This avoids a sixth
// mobile tab and keeps the post composer centered.
const oldMobileNav = '</div><div className="mobile-nav">{nav.map(([n,I]:any)=><button key={n} className={screen===n?"active":""} onClick={()=>n==="Create"?setComposer(true):setScreen(n)}><I size={20}/><span>{n}</span></button>)}<button className={noticeOpen?"active":""} onClick={()=>{setNoticeOpen(true);markRead()}} aria-label="Notifications"><Bell size={20}/><span>Alerts</span>{unread>0&&<i className="mobile-notification-count">{unread>9?"9+":unread}</i>}</button></div>';
const newMobileNav = '</div><div className="mobile-nav">{nav.map(([n,I]:any)=><button key={n} className={screen===n?"active":""} onClick={()=>n==="Create"?setComposer(true):setScreen(n)} aria-label={n}><I size={20}/><span>{n}</span></button>)}</div>';
if (s.includes(oldMobileNav)) s=s.replace(oldMobileNav,newMobileNav);
else if (!s.includes('mobile-nav">{nav.map')) throw new Error("WAYSS mobile navigation block was not found.");


const cssPath = "src/wayss-fixes.css";
const navCss = `
/* WAYSS mobile tab-bar + top actions: exactly five tabs, no overlap */
@media (max-width: 800px) {
  .mobile-nav {
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    gap: 2px !important;
    padding: 5px !important;
    overflow: hidden !important;
  }
  .mobile-nav button { min-width: 0 !important; width: 100% !important; }
  .mobile-nav button span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mobile-settings-menu { order: 0 !important; flex: 0 0 38px !important; }
  .mobile-messages-button { order: 1 !important; flex: 0 0 38px !important; }
  .mobile-brand { order: 2 !important; min-width: 0 !important; flex: 0 1 auto !important; }
  .top-actions { order: 4 !important; margin-left: auto !important; flex: 0 0 auto !important; }
  .orbit-global-search { order: 3 !important; flex: 1 1 100px !important; min-width: 0 !important; width: auto !important; }
  .mobile-user-search-button { display: grid !important; }
  .mobile-nav button:nth-child(3) { /* center Create (+) */ }
  .mobile-nav button:nth-child(3) svg { width: 24px !important; height: 24px !important; stroke-width: 2.3 !important; }
}
@media (min-width: 801px) {
  .mobile-messages-button, .mobile-user-search-button { display: none !important; }
}
@media (max-width: 420px) {
  .topbar { gap: 5px !important; padding-inline: 8px !important; }
  .mobile-brand b { font-size: 13px !important; }
  .mobile-brand .logo { width: 29px !important; height: 29px !important; }
  .mobile-settings-menu, .mobile-messages-button { flex-basis: 34px !important; width: 34px !important; min-width: 34px !important; }
  .mobile-settings-menu svg, .mobile-messages-button svg { width: 19px !important; height: 19px !important; }
  .top-actions { gap: 3px !important; }
}
`;
let css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
if (!css.includes("WAYSS mobile tab-bar + top actions")) {
  fs.appendFileSync(cssPath, "\\n" + navCss + "\\n");
}

fs.writeFileSync(path, s);
console.log("WAYSS navigation and OAuth patch applied.");

fs.writeFileSync(path, s);
console.log("WAYSS Android OAuth browser/deep-link patch applied.");
