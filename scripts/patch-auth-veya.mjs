import fs from "node:fs";

const path = "src/AppV3.tsx";
let s = fs.readFileSync(path, "utf8");

const start = s.indexOf("function Auth(");
const end = s.indexOf("\nfunction SettingsPanel", start);
if (start < 0 || end < 0) throw new Error("Auth component boundary not found.");

const auth = `function Auth({close,google,msg:parentMsg}:any){
 const [mode,setMode]=useState<"login"|"signup"|"forgot">("login");
 const [step,setStep]=useState<"email"|"otp"|"details">("email");
 const [email,setEmail]=useState("");
 const [identifier,setIdentifier]=useState("");
 const [password,setPassword]=useState("");
 const [name,setName]=useState("");
 const [username,setUsername]=useState("");
 const [otp,setOtp]=useState("");
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState("");
 const displayMsg=msg||parentMsg||"";
 const reset=()=>{setMsg("");setBusy(false)};
 async function signIn(){
  if(!supabase)return;
  reset();
  const value=identifier.trim();
  if(!value||!password){setMsg("Enter your email/username and password.");return}
  setBusy(true);
  let loginEmail=value;
  if(!value.includes("@")){
   const r=await supabase.rpc("wayss_login_email_for_username",{login_username:value.replace(/^@/,"").toLowerCase()});
   if(r.error||!r.data){setMsg("Username not found. Check it and try again.");setBusy(false);return}
   loginEmail=String(r.data);
  }
  const r=await supabase.auth.signInWithPassword({email:loginEmail,password});
  if(r.error)setMsg(r.error.message);else close();
  setBusy(false);
 }
 async function sendSignupOtp(){
  if(!supabase)return;
  reset();
  const e=email.trim().toLowerCase();
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e)){setMsg("Enter a valid email address.");return}
  setEmail(e);setBusy(true);
  const r=await supabase.auth.signInWithOtp({email:e,options:{shouldCreateUser:true}});
  if(r.error)setMsg(r.error.message);else{setStep("otp");setMsg("We sent a 6-digit code to your email.")}
  setBusy(false);
 }
 async function verifySignupOtp(){
  if(!supabase)return;
  reset();
  if(!/^\\d{6}$/.test(otp.trim())){setMsg("Enter the 6-digit code from your email.");return}
  setBusy(true);
  const r=await supabase.auth.verifyOtp({email,token:otp.trim(),type:"email"});
  if(r.error){setMsg(r.error.message);setBusy(false);return}
  const uid=r.data.user?.id;
  if(!uid){setMsg("Verification succeeded, but the account session was not created. Try again.");setBusy(false);return}
  const existing=await supabase.from("profiles").select("id,username").eq("id",uid).maybeSingle();
  if(existing.data){await supabase.auth.signOut();setMsg("That email already has a WAYSS account. Sign in instead.");setBusy(false);return}
  setStep("details");setMsg("Email verified. Now finish your WAYSS profile.");setBusy(false);
 }
 async function finishSignup(){
  if(!supabase)return;
  reset();
  const u=username.trim().replace(/^@/,"").toLowerCase();
  if(!/^[a-z0-9._]{3,24}$/.test(u)){setMsg("Username must be 3–24 characters: letters, numbers, dots or underscores.");return}
  if(password.length<8){setMsg("Password must be at least 8 characters.");return}
  setBusy(true);
  const taken=await supabase.from("profiles").select("id").eq("username",u).maybeSingle();
  if(taken.error){setMsg(taken.error.message);setBusy(false);return}
  if(taken.data){setMsg("That username is already taken. Try another.");setBusy(false);return}
  const up=await supabase.auth.updateUser({password,data:{username:u,full_name:name.trim().slice(0,80)||undefined}});
  if(up.error){setMsg(up.error.message);setBusy(false);return}
  const uid=up.data.user?.id;
  if(!uid){setMsg("Account session is missing. Please sign in again.");setBusy(false);return}
  const p=await supabase.from("profiles").upsert({id:uid,username:u,display_name:name.trim().slice(0,80)||null},{onConflict:"id"});
  if(p.error){setMsg("Account was verified, but profile setup failed: "+p.error.message);setBusy(false);return}
  close();setBusy(false);
 }
 async function resendOtp(){if(!supabase||busy)return;setBusy(true);const r=await supabase.auth.signInWithOtp({email,options:{shouldCreateUser:true}});setMsg(r.error?.message||"A new code has been sent.");setBusy(false)}
 async function forgot(){
  if(!supabase)return;
  const e=email.trim().toLowerCase();
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e)){setMsg("Enter the email linked to your WAYSS account.");return}
  setBusy(true);
  const native=window.location.protocol==="capacitor:"||window.location.protocol==="file:";
  const redirectTo=native?"wayss://auth/callback?type=recovery":window.location.origin;
  const r=await supabase.auth.resetPasswordForEmail(e,{redirectTo});
  setMsg(r.error?.message||"If the account exists, a password reset link has been sent. Check Inbox and Spam.");
  setBusy(false);
 }
 return <div className="modal-backdrop"><div className="modal">
  <div className="modal-head"><div><p className="eyebrow">WAYSS</p><h2>{mode==="signup"?"Create your account":mode==="forgot"?"Reset your password":"Welcome back"}</h2></div><button className="icon"onClick={close}><X size={18}/></button></div>
  {mode==="login"&&<><button className="primary"style={{width:"100%"}}onClick={google}>Continue with Google</button><p style={{textAlign:"center",opacity:.6}}>or</p><label>Username or email<input autoComplete="username" value={identifier}onChange={e=>setIdentifier(e.target.value)}placeholder="username or email"/></label><label>Password<input autoComplete="current-password"type="password"value={password}onChange={e=>setPassword(e.target.value)}placeholder="Password"onKeyDown={e=>e.key==="Enter"&&void signIn()}/></label><button className="outline wide"type="button"onClick={()=>{setMode("forgot");setEmail(identifier.includes("@")?identifier:"");setMsg("")}}>Forgot password?</button><div className="modal-actions"><button className="outline"onClick={()=>{setMode("signup");setStep("email");setMsg("")}}>Create new account</button><button className="primary"disabled={busy}onClick={()=>void signIn()}>{busy?"Signing in…":"Log in"}</button></div></>}
  {mode==="signup"&&step==="email"&&<><p style={{opacity:.72}}>First, verify your email. We'll send you a one-time 6-digit code.</p><label>Email<input autoComplete="email"type="email"value={email}onChange={e=>setEmail(e.target.value)}placeholder="you@example.com"onKeyDown={e=>e.key==="Enter"&&void sendSignupOtp()}/></label><div className="modal-actions"><button className="outline"onClick={()=>setMode("login")}>Back to login</button><button className="primary"disabled={busy}onClick={()=>void sendSignupOtp()}>{busy?"Sending…":"Send code"}</button></div></>}
  {mode==="signup"&&step==="otp"&&<><p style={{opacity:.72}}>Enter the 6-digit code we sent to <b>{email}</b>.</p><label>Email code<input inputMode="numeric"autoComplete="one-time-code"maxLength={6}value={otp}onChange={e=>setOtp(e.target.value.replace(/\\D/g,"").slice(0,6))}placeholder="123456"onKeyDown={e=>e.key==="Enter"&&void verifySignupOtp()}/></label><div className="modal-actions"><button className="outline"onClick={()=>setStep("email")}>Change email</button><button className="outline"disabled={busy}onClick={()=>void resendOtp()}>Resend</button><button className="primary"disabled={busy}onClick={()=>void verifySignupOtp()}>{busy?"Verifying…":"Verify email"}</button></div></>}
  {mode==="signup"&&step==="details"&&<><p style={{opacity:.72}}>Email verified ✓. Now choose your WAYSS identity.</p><label>Name <small style={{opacity:.55}}>(optional)</small><input autoComplete="name"value={name}onChange={e=>setName(e.target.value)}placeholder="Your name"maxLength={80}/></label><label>Username <b>*</b><input autoComplete="username"value={username}onChange={e=>setUsername(e.target.value.replace(/[^a-zA-Z0-9._]/g,"").toLowerCase())}placeholder="yourusername"maxLength={24}/></label><label>Password <b>*</b><input autoComplete="new-password"type="password"value={password}onChange={e=>setPassword(e.target.value)}placeholder="At least 8 characters"/></label><div className="modal-actions"><button className="outline"onClick={()=>setStep("otp")}>Back</button><button className="primary"disabled={busy}onClick={()=>void finishSignup()}>{busy?"Creating…":"Create account"}</button></div></>}
  {mode==="forgot"&&<><p style={{opacity:.72}}>Enter your account email and we'll send a password-reset link.</p><label>Email<input autoComplete="email"type="email"value={email}onChange={e=>setEmail(e.target.value)}placeholder="you@example.com"onKeyDown={e=>e.key==="Enter"&&void forgot()}/></label><div className="modal-actions"><button className="outline"onClick={()=>setMode("login")}>Back</button><button className="primary"disabled={busy}onClick={()=>void forgot()}>{busy?"Sending…":"Send reset link"}</button></div></>}
  {displayMsg&&<p className="status"role="status">{displayMsg}</p>}
 </div></div>
}
`;
s = s.slice(0,start) + auth + s.slice(end);

// Password recovery must open account settings automatically after the reset link returns.
const oldHook='const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.session?.user||null));';
const newHook='const{data:{subscription}}=supabase.auth.onAuthStateChange((event,s)=>{setUser(s?.session?.user||null);if(event==="PASSWORD_RECOVERY")setSettingsOpen(true)});';
if(s.includes(oldHook))s=s.replace(oldHook,newHook);

// Native/web recovery callbacks can carry ?type=recovery after the code exchange.
const oldReset='async function resetPassword(){if(!user?.email){setMsg("Sign in with an email account first.");return}const{error}=await supabase.auth.resetPasswordForEmail(user.email,{redirectTo:window.location.origin});setMsg(error?error.message:"Password reset email requested. Check your inbox.");}';
const newReset='async function resetPassword(){if(!user?.email){setMsg("Sign in with an email account first.");return}const native=window.location.protocol==="capacitor:"||window.location.protocol==="file:";const redirectTo=native?"wayss://auth/callback?type=recovery":window.location.origin;const{error}=await supabase.auth.resetPasswordForEmail(user.email,{redirectTo});setMsg(error?error.message:"Password reset email requested. Check your inbox and Spam.");}';
if(s.includes(oldReset))s=s.replace(oldReset,newReset);

fs.writeFileSync(path,s);
console.log("WAYSS Instagram-style auth and recovery UI patch applied.");
