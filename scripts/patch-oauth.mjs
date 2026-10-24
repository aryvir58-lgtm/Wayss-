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

fs.writeFileSync(path, s);
console.log("WAYSS Android OAuth browser/deep-link patch applied.");
