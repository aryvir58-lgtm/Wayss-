import React, { useEffect, useMemo, useState } from "react";
import {
  Bell, Bookmark, ChevronRight, Compass, Heart, Home, ImagePlus, LogIn,
  MessageCircle, MoreHorizontal, Plus, Search, Settings, Shield, Sparkles,
  UserRound, Video, X, Send, Lock, Users, Radio, Moon, Sun, LogOut
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabase";

type Screen = "Feed"|"Orbit"|"Create"|"Flux"|"You";
type Post = {
  id:string;
  author:string;
  handle:string;
  avatar:string;
  text:string;
  image?:string;
  likes:number;
  comments:number;
  time:string;
  kind:"Echo"|"Signal";
  liked?:boolean;
  saved?:boolean;
};

type DbPost = {
  id:string;
  author_id:string;
  kind:"echo"|"signal"|"glimpse"|"flux";
  body:string|null;
  media_url:string|null;
  created_at:string;
  profiles:{username:string|null;display_name:string|null;avatar_url:string|null}|null;
  post_likes:{user_id:string}[];
  comments:{id:string}[];
  saved_posts:{user_id:string}[];
};

const kindLabel = (kind:DbPost["kind"]):Post["kind"] => kind === "signal" ? "Signal" : "Echo";
const timeAgo = (value:string) => {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if(seconds < 60) return "Now";
  const minutes = Math.floor(seconds / 60);
  if(minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if(hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export default function App(){
 const [screen,setScreen]=useState<Screen>("Feed");
 const [query,setQuery]=useState("");
 const [composer,setComposer]=useState(false);
 const [settings,setSettings]=useState(false);
 const [dark,setDark]=useState(true);
 const [posts,setPosts]=useState<Post[]>([]);
 const [user,setUser]=useState<any>(null);
 const [profile,setProfile]=useState<any>(null);
 const [authOpen,setAuthOpen]=useState(false);
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [status,setStatus]=useState("");
 const [loadingPosts,setLoadingPosts]=useState(true);
 const [backendError,setBackendError]=useState("");

 useEffect(()=>{
   document.documentElement.dataset.theme=dark?"dark":"light";
 },[dark]);

 useEffect(()=>{
   if(!supabase) return;
   let active = true;
   supabase.auth.getSession().then(({data})=>{ if(active) setUser(data.session?.user ?? null); });
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user ?? null));
   return ()=>{ active=false; subscription.unsubscribe(); };
 },[]);

 useEffect(()=>{
   if(!supabase || !user) { setProfile(null); return; }
   supabase.from("profiles").select("*").eq("id",user.id).maybeSingle().then(({data,error})=>{
     if(error) setBackendError(error.message);
     else setProfile(data);
   });
 },[user]);

 useEffect(()=>{
   loadPosts();
 },[user]);

 async function loadPosts(){
   if(!supabase){
     setLoadingPosts(false);
     setBackendError("Supabase is not configured in this deployment.");
     return;
   }
   setLoadingPosts(true);
   setBackendError("");
   const {data,error}=await supabase
     .from("posts")
     .select(`id,author_id,kind,body,media_url,created_at,
       profiles!posts_author_id_fkey(username,display_name,avatar_url),
       post_likes(user_id),comments(id),saved_posts(user_id)`)
     .order("created_at",{ascending:false})
     .limit(50);
   if(error){
     setPosts([]);
     setBackendError(error.message);
     setLoadingPosts(false);
     return;
   }
   const rows=(data??[]) as unknown as DbPost[];
   setPosts(rows.map(row=>({
     id:row.id,
     author:row.profiles?.display_name || row.profiles?.username || "WAYSS user",
     handle:row.profiles?.username || "user",
     avatar:row.profiles?.avatar_url || (row.profiles?.display_name?.[0] || "W"),
     text:row.body || "",
     image:row.media_url || undefined,
     likes:row.post_likes?.length || 0,
     comments:row.comments?.length || 0,
     time:timeAgo(row.created_at),
     kind:kindLabel(row.kind),
     liked:!!user && !!row.post_likes?.some(x=>x.user_id===user.id),
     saved:!!user && !!row.saved_posts?.some(x=>x.user_id===user.id)
   })));
   setLoadingPosts(false);
 }

 async function ensureProfile(){
   if(!supabase || !user) return false;
   const payload={
     id:user.id,
     display_name:profile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "WAYSS user",
     username:profile?.username || user.user_metadata?.user_name || null
   };
   const {error}=await supabase.from("profiles").upsert(payload,{onConflict:"id"});
   if(error){setBackendError(error.message);return false;}
   const {data}=await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();
   setProfile(data);
   return true;
 }

 async function signIn(){
   if(!supabase){setStatus("Connect Supabase first.");return;}
   const {error}=await supabase.auth.signInWithPassword({email,password});
   setStatus(error?.message ?? "Signed in."); if(!error)setAuthOpen(false);
 }
 async function signInWithGoogle(){
   if(!supabase){setStatus("Connect Supabase first.");return;}
   setStatus("Opening Google…");
   const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});
   if(error)setStatus(error.message);
 }
 async function signUp(){
   if(!supabase){setStatus("Connect Supabase first.");return;}
   const {error}=await supabase.auth.signUp({email,password});
   setStatus(error?.message ?? "Account created. Check your email if confirmation is enabled.");
 }
 async function signOut(){if(supabase) await supabase.auth.signOut();setUser(null);setProfile(null);}

 async function toggleLike(post:Post){
   if(!supabase || !user){setAuthOpen(true);return;}
   const next=!post.liked;
   setPosts(items=>items.map(p=>p.id===post.id?{...p,liked:next,likes:Math.max(0,p.likes+(next?1:-1))}:p));
   const result=next
     ? await supabase.from("post_likes").insert({post_id:post.id,user_id:user.id})
     : await supabase.from("post_likes").delete().eq("post_id",post.id).eq("user_id",user.id);
   if(result.error){
     setPosts(items=>items.map(p=>p.id===post.id?{...p,liked:!next,likes:Math.max(0,p.likes+(next?-1:1))}:p));
     setBackendError(result.error.message);
   }
 }

 async function toggleSave(post:Post){
   if(!supabase || !user){setAuthOpen(true);return;}
   const next=!post.saved;
   setPosts(items=>items.map(p=>p.id===post.id?{...p,saved:next}:p));
   const result=next
     ? await supabase.from("saved_posts").insert({post_id:post.id,user_id:user.id})
     : await supabase.from("saved_posts").delete().eq("post_id",post.id).eq("user_id",user.id);
   if(result.error){
     setPosts(items=>items.map(p=>p.id===post.id?{...p,saved:!next}:p));
     setBackendError(result.error.message);
   }
 }

 async function publishPost(kind:"Echo"|"Signal",text:string){
   if(!supabase || !user){setAuthOpen(true);return false;}
   const ready=await ensureProfile();
   if(!ready) return false;
   const {data,error}=await supabase.from("posts").insert({author_id:user.id,kind:kind.toLowerCase(),body:text.trim(),audience:"public"}).select("id").single();
   if(error){setBackendError(error.message);return false;}
   setComposer(false);
   setScreen("Feed");
   await loadPosts();
   return !!data;
 }

 const filtered=useMemo(()=>posts.filter(p=>(p.text+" "+p.author+" "+p.handle).toLowerCase().includes(query.toLowerCase())),[posts,query]);
 const nav=[["Feed",Home],["Orbit",Compass],["Create",Plus],["Flux",Video],["You",UserRound]] as const;

 return <div className="app">
   <aside className="sidebar">
     <div className="brand"><div className="logo">W</div><div><b>WAYSS</b><small>Social, Beyond the Feed.</small></div></div>
     <nav>{nav.map(([n,I])=><button key={n} className={screen===n?"nav active":"nav"} onClick={()=>n==="Create"?setComposer(true):setScreen(n)}><I size={19}/><span>{n}</span></button>)}</nav>
     <div className="side-bottom">
       <button className="nav" onClick={()=>setSettings(true)}><Settings size={19}/><span>Settings</span></button>
       {user?<button className="nav" onClick={signOut}><LogOut size={19}/><span>Log out</span></button>:<button className="nav" onClick={()=>setAuthOpen(true)}><LogIn size={19}/><span>Sign in</span></button>}
     </div>
   </aside>

   <main>
     <header className="topbar">
       <div className="mobile-brand"><div className="logo small">W</div><b>WAYSS</b></div>
       <div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search WAYSS"/></div>
       <div className="top-actions"><button className="icon" title="Hush"><MessageCircle size={19}/></button><button className="icon" title="Notifications"><Bell size={19}/></button><button className="avatar">{user?.email?.[0]?.toUpperCase()||"Y"}</button></div>
     </header>

     <div className="content">
       {screen==="Feed" && <Feed posts={filtered} loading={loadingPosts} error={backendError} onRetry={loadPosts} onLike={toggleLike} onSave={toggleSave} onSignIn={()=>setAuthOpen(true)}/>}
       {screen==="Orbit" && <Orbit query={query}/>}
       {screen==="Flux" && <Flux/>}
       {screen==="You" && <Profile user={user} profile={profile} onSignIn={()=>setAuthOpen(true)} onSettings={()=>setSettings(true)}/>}
       {screen==="Create" && <Feed posts={filtered} loading={loadingPosts} error={backendError} onRetry={loadPosts} onLike={toggleLike} onSave={toggleSave} onSignIn={()=>setAuthOpen(true)}/>}
     </div>

   <div className="mobile-nav">{nav.map(([n,I])=><button key={n} className={screen===n?"active":""} onClick={()=>n==="Create"?setComposer(true):setScreen(n)}><I size={20}/><span>{n}</span></button>)}</div>

   {composer && <Composer onClose={()=>setComposer(false)} onPublish={publishPost} user={user}/>} 
   {settings && <SettingsPanel dark={dark} setDark={setDark} onClose={()=>setSettings(false)} user={user}/>} 
   {authOpen && <Auth onClose={()=>setAuthOpen(false)} email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSignIn={signIn} onGoogle={signInWithGoogle} onSignUp={signUp} status={status}/>} 
   </main>
 </div>
}

function Feed({posts,loading,error,onRetry,onLike,onSave,onSignIn}:{posts:Post[],loading:boolean,error:string,onRetry:()=>void,onLike:(p:Post)=>void,onSave:(p:Post)=>void,onSignIn:()=>void}){
 return <section><div className="page-head"><div><p className="eyebrow">YOUR WORLD</p><h1>Feed</h1></div><div className="filters"><button className="chip active">For You</button><button className="chip">Connected</button></div></div>
   <div className="glimpse-row"><div className="glimpse add"><Plus size={20}/><span>Glimpse</span></div>{["A","M","K","S","N"].map(x=><div className="glimpse" key={x}><div className="gavatar">{x}</div><span>Glimpse</span></div>)}</div>
   {error&&<div className="empty compact"><p>{error}</p><button className="outline" onClick={onRetry}>Retry</button></div>}
   {loading?<div className="empty"><Sparkles size={30}/><h2>Loading your feed…</h2><p>Getting the latest posts from WAYSS.</p></div>:!error && posts.length===0?<div className="empty"><Home size={32}/><h2>Your feed, without the clutter.</h2><p>Connect with people and create your first post.</p><button className="primary" onClick={onSignIn}>Sign in to start</button></div>:<div className="feed">{posts.map(p=><article className="post" key={p.id}>
     <div className="post-head"><div className="avatar">{p.avatar.startsWith("http")?<img src={p.avatar} alt=""/>:p.avatar}</div><div className="who"><b>{p.author}</b><span>@{p.handle} · {p.time}</span></div><button className="icon"><MoreHorizontal size={18}/></button></div>
     <div className="kind">{p.kind}</div><p className="post-text">{p.text}</p>{p.image&&<img className="post-image" src={p.image} alt=""/>}
     <div className="post-actions"><button onClick={()=>onLike(p)} className={p.liked?"liked":""}><Heart size={18} fill={p.liked?"currentColor":"none"}/><span>{p.likes}</span></button><button><MessageCircle size={18}/><span>{p.comments}</span></button><button onClick={()=>onSave(p)} className={p.saved?"saved":""}><Bookmark size={18} fill={p.saved?"currentColor":"none"}/></button></div>
   </article>)}</div>}
 </section>;
}

function Orbit({query}:{query:string}){return <section><div className="page-head"><div><p className="eyebrow">DISCOVER</p><h1>Orbit</h1></div></div><div className="orbit-grid">
 {["People","Topics","Creators","Circles"].map((x,i)=><div className="discover-card" key={x}><div className="discover-icon">{i===0?<Users/>:i===1?<Sparkles/>:i===2?<Radio/>:<Compass/>}</div><h3>{x}</h3><p>{query?`Results related to “${query}”`:"Explore what interests you."}</p><button>Explore <ChevronRight size={15}/></button></div>)}
</div><div className="section-title"><h2>Suggested connections</h2><span>Based on your choices</span></div><div className="people">{["Maya","Kian","Sia"].map(x=><div className="person" key={x}><div className="avatar">{x[0]}</div><div><b>{x}</b><span>@{x.toLowerCase()} · Creator</span></div><button className="outline">Connect</button></div>)}</div></section>}

function Flux(){return <section><div className="page-head"><div><p className="eyebrow">SHORT VIDEO</p><h1>Flux</h1></div></div><div className="empty"><Video size={32}/><h2>Flux is ready for your videos.</h2><p>Add short-form video creation and playback when you connect your media storage.</p><button className="primary">Create a Flux</button></div></section>}

function Profile({user,profile,onSignIn,onSettings}:{user:any,profile:any,onSignIn:()=>void,onSettings:()=>void}){return <section><div className="profile-cover"></div><div className="profile-card"><div className="avatar profile-avatar">{profile?.avatar_url?<img src={profile.avatar_url} alt=""/>:(profile?.display_name?.[0]||user?.email?.[0]?.toUpperCase()||"Y")}</div><div className="profile-actions"><button className="outline" onClick={user?onSettings:onSignIn}>{user?"Edit profile":"Sign in"}</button></div><h1>{profile?.display_name||"Your profile"}</h1><p className="handle">@{profile?.username||"yourname"}</p><p className="bio">{user?(profile?.bio||"Make your world your way."):"Sign in to build your Living Profile."}</p><div className="stats"><div><b>0</b><span>Connections</span></div><div><b>0</b><span>Connected</span></div><div><b>0</b><span>Posts</span></div></div></div><div className="tabs"><button className="active">Posts</button><button>Vault</button><button>Replay</button></div><div className="empty compact"><UserRound size={28}/><p>Your posts will appear here.</p></div></section>}

function Composer({onClose,onPublish,user}:{onClose:()=>void,onPublish:(kind:"Echo"|"Signal",text:string)=>Promise<boolean>,user:any}){const [text,setText]=useState("");const [kind,setKind]=useState<"Echo"|"Signal">("Echo");const [saving,setSaving]=useState(false);return <div className="modal-backdrop"><div className="modal composer"><div className="modal-head"><div><p className="eyebrow">CREATE</p><h2>What do you want to create?</h2></div><button className="icon" onClick={onClose}><X/></button></div><div className="create-options"><button className={kind==="Echo"?"selected":""} onClick={()=>setKind("Echo")}><Sparkles/><b>Echo</b><span>Share a thought</span></button><button className={kind==="Signal"?"selected":""} onClick={()=>setKind("Signal")}><Radio/><b>Signal</b><span>Post with a purpose</span></button><button disabled><ImagePlus/><b>Glimpse</b><span>Coming with media storage</span></button><button disabled><Video/><b>Flux</b><span>Coming with media storage</span></button></div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder={user?"Write something worth sharing…":"Sign in to publish to WAYSS…"} /><div className="composer-foot"><span>Audience: Public</span><button className="primary" disabled={!text.trim()||saving} onClick={async()=>{setSaving(true);await onPublish(kind,text);setSaving(false)}}>{saving?"Publishing…":"Publish"}</button></div></div></div>}

function SettingsPanel({onClose,dark,setDark,user}:{onClose:()=>void,dark:boolean,setDark:(v:boolean)=>void,user:any}){return <div className="modal-backdrop"><div className="modal settings"><div className="modal-head"><div><p className="eyebrow">ACCOUNT</p><h2>Settings</h2></div><button className="icon" onClick={onClose}><X/></button></div>{[["Edit Profile",UserRound],["Privacy & Layers",Shield],["Blocked Users",Lock],["Your Activity",Radio],["Notifications",Bell]].map(([n,I]:any)=><button className="setting-row" key={n}><I size={18}/><span>{n}</span><ChevronRight size={16}/></button>)}<div className="setting-row"><div className="setting-label"><Sun size={18}/><span>Appearance</span></div><button className="toggle" onClick={()=>setDark(!dark)}><span>{dark?"Dark":"Light"}</span><div className={dark?"switch on":"switch"}></div></button></div><div className="security-note"><Shield size={17}/><span>Supabase Row Level Security protects the connected data. Core posts, likes and saves now use the database.</span></div></div></div>}

function Auth({onClose,email,setEmail,password,setPassword,onSignIn,onGoogle,onSignUp,status}:{onClose:()=>void,email:string,setEmail:any,password:string,setPassword:any,onSignIn:()=>void,onGoogle:()=>void,onSignUp:()=>void,status:string}){return <div className="modal-backdrop"><div className="modal auth"><div className="modal-head"><div><p className="eyebrow">WELCOME TO WAYSS</p><h2>Sign in</h2></div><button className="icon" onClick={onClose}><X/></button></div><button className="google-button wide" onClick={onGoogle}><span className="google-mark">G</span><span>Continue with Google</span></button><div className="auth-divider"><span>or</span></div><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password"/><button className="primary wide" onClick={onSignIn}>Sign in</button><button className="outline wide" onClick={onSignUp}>Create account</button>{status&&<p className="status">{status}</p>}<p className="tiny">Authentication uses your connected Supabase project. No privileged keys are stored in the browser.</p></div></div>}
