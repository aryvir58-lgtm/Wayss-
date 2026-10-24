import fs from "node:fs";

const path = "src/AppV3.tsx";
let s = fs.readFileSync(path, "utf8");

if (!s.includes('from"@capacitor/app"')) {
  s = s.replace('import Messages from "./Messages";', 'import Messages from "./Messages";\nimport{App}from"@capacitor/app";');
}

const oldGoogle = 'async function google(){if(!supabase)return;const{error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});if(error)setAuthMsg(error.message)}';
const newGoogle = 'async function google(){if(!supabase)return;const native=window.location.protocol==="capacitor:"||window.location.protocol==="file:";const redirectTo=native?"wayss://auth/callback":window.location.origin;const{error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo}});if(error)setAuthMsg(error.message)}';
if (!s.includes(newGoogle)) {
  if (!s.includes(oldGoogle)) throw new Error("Google login function was not found.");
  s = s.replace(oldGoogle, newGoogle);
}

if (!s.includes("WAYSS OAuth callback error")) {
  const marker = ' useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setUser(data.session?.user||null));';
  const bridge = ' useEffect(()=>{let handle;void App.addListener("appUrlOpen",async({url})=>{try{const u=new URL(url);if(u.protocol!=="wayss:"||u.host!=="auth"||u.pathname!=="/callback")return;const code=u.searchParams.get("code");if(code)await supabase?.auth.exchangeCodeForSession(code)}catch(e){console.error("WAYSS OAuth callback error",e)}}).then(h=>{handle=h});return()=>{void handle?.remove()};},[]);\n';
  if (!s.includes(marker)) throw new Error("Auth session hook was not found.");
  s = s.replace(marker, bridge + marker);
}

fs.writeFileSync(path, s);
console.log("WAYSS Android OAuth patch applied.");
