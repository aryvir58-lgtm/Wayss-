import React, { useEffect, useMemo, useState } from "react";
import {
  Bell, Bookmark, ChevronRight, Compass, Heart, Home, ImagePlus, LogIn,
  MessageCircle, MoreHorizontal, Plus, Search, Settings, Shield, Sparkles,
  UserRound, Video, X, Send, Lock, Users, Radio, Moon, Sun, LogOut
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabase";

type Screen = "Feed"|"Orbit"|"Create"|"Flux"|"You";
type Post = { id:string; author:string; handle:string; avatar:string; text:string; image?:string; likes:number; comments:number; time:string; kind:"Echo"|"Signal" };

const demoPosts:Post[] = [
 {id:"demo-1",author:"WAYSS",handle:"wayss",avatar:"W",text:"Your feed, without the clutter. Welcome to WAYSS.",likes:24,comments:5,time:"Now",kind:"Echo"},
 {id:"demo-2",author:"Rohitt",handle:"rohitt",avatar:"R",text:"Less clutter. More connection.",likes:18,comments:3,time:"12m",kind:"Signal"}
];

export default function App(){
 const [screen,setScreen]=useState<Screen>("Feed");
 const [query,setQuery]=useState("");
 const [composer,setComposer]=useState(false);
 const [settings,setSettings]=useState(false);
 const [dark,setDark]=useState(true);
 const [posts,setPosts]=useState<Post[]>(demoPosts);
 const [liked,setLiked]=useState<Record<string,boolean>>({});
 const [saved,setSaved]=useState<Record<string,boolean>>({});
 const [user,setUser]=useState<any>(null);
 const [authOpen,setAuthOpen]=useState(false);
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [status,setStatus]=useState("");

 useEffect(()=>{
   document.documentElement.dataset.theme=dark?"dark":"light";
   if(!supabase) return;
   supabase.auth.getSession().then(({data})=>setUser(data.session?.user ?? null));
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user ?? null));
   return ()=>subscription.unsubscribe();
 },[dark]);

 const filtered=useMemo(()=>posts.filter(p=>(p.text+" "+p.author+" "+p.handle).toLowerCase().includes(query.toLowerCase())),[posts,query]);

 async function signIn(){
   if(!supabase){setStatus("Connect Supabase first using the .env setup in README.");return;}
   const {error}=await supabase.auth.signInWithPassword({email,password});
   setStatus(error?.message ?? "Signed in."); if(!error)setAuthOpen(false);
 }
 async function signUp(){
   if(!supabase){setStatus("Connect Supabase first using the .env setup in README.");return;}
   const {error}=await supabase.auth.signUp({email,password});
   setStatus(error?.message ?? "Account created. Check your email if confirmation is enabled.");
 }
 async function signOut(){if(supabase) await supabase.auth.signOut();setUser(null);}

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
       {screen==="Feed" && <Feed posts={filtered} liked={liked} setLiked={setLiked} saved={saved} setSaved={setSaved}/>}
       {screen==="Orbit" && <Orbit query={query}/>}
       {screen==="Flux" && <Flux/>}
       {screen==="You" && <Profile user={user} onSignIn={()=>setAuthOpen(true)} onSettings={()=>setSettings(true)}/>}
       {screen==="Create" && <Feed posts={filtered} liked={liked} setLiked={setLiked} saved={saved} setSaved={setSaved}/>}
     </div>
   </main>

   <div className="mobile-nav">{nav.map(([n,I])=><button key={n} className={screen===n?"active":""} onClick={()=>n==="Create"?setComposer(true):setScreen(n)}><I size={20}/><span>{n}</span></button>)}</div>

   {composer && <Composer onClose={()=>setComposer(false)} onPublish={(p)=>{setPosts(x=>[p,...x]);setComposer(false);setScreen("Feed")}}/>}
   {settings && <SettingsPanel dark={dark} setDark={setDark} onClose={()=>setSettings(false)} user={user}/>}
   {authOpen && <Auth onClose={()=>setAuthOpen(false)} email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSignIn={signIn} onSignUp={signUp} status={status}/>}
 </div>
}

function Feed({posts,liked,setLiked,saved,setSaved}:{posts:Post[],liked:any,setLiked:any,saved:any,setSaved:any}){
 return <section><div className="page-head"><div><p className="eyebrow">YOUR WORLD</p><h1>Feed</h1></div><div className="filters"><button className="chip active">For You</button><button className="chip">Connected</button></div></div>
   <div className="glimpse-row"><div className="glimpse add"><Plus size={20}/><span>Glimpse</span></div>{["A","M","K","S","N"].map(x=><div className="glimpse" key={x}><div className="gavatar">{x}</div><span>Glimpse</span></div>)}</div>
   <div className="feed">{posts.map(p=><article className="post" key={p.id}>
     <div className="post-head"><div className="avatar">{p.avatar}</div><div className="who"><b>{p.author}</b><span>@{p.handle} · {p.time}</span></div><button className="icon"><MoreHorizontal size={18}/></button></div>
     <div className="kind">{p.kind}</div><p className="post-text">{p.text}</p>{p.image&&<img className="post-image" src={p.image}/>} 
     <div className="post-actions"><button onClick={()=>setLiked({...liked,[p.id]:!liked[p.id]})} className={liked[p.id]?"liked":""}><Heart size={18} fill={liked[p.id]?"currentColor":"none"}/><span>{p.likes+(liked[p.id]?1:0)}</span></button><button><MessageCircle size={18}/><span>{p.comments}</span></button><button onClick={()=>setSaved({...saved,[p.id]:!saved[p.id]})} className={saved[p.id]?"saved":""}><Bookmark size={18} fill={saved[p.id]?"currentColor":"none"}/></button></div>
   </article>)}</div>
 </section>
}

function Orbit({query}:{query:string}){return <section><div className="page-head"><div><p className="eyebrow">DISCOVER</p><h1>Orbit</h1></div></div><div className="orbit-grid">
 {["People","Topics","Creators","Circles"].map((x,i)=><div className="discover-card" key={x}><div className="discover-icon">{i===0?<Users/>:i===1?<Sparkles/>:i===2?<Radio/>:<Compass/>}</div><h3>{x}</h3><p>{query?`Results related to “${query}”`:"Explore what interests you."}</p><button>Explore <ChevronRight size={15}/></button></div>)}
</div><div className="section-title"><h2>Suggested connections</h2><span>Based on your choices</span></div><div className="people">{["Maya","Kian","Sia"].map(x=><div className="person" key={x}><div className="avatar">{x[0]}</div><div><b>{x}</b><span>@{x.toLowerCase()} · Creator</span></div><button className="outline">Connect</button></div>)}</div></section>}

function Flux(){return <section><div className="page-head"><div><p className="eyebrow">SHORT VIDEO</p><h1>Flux</h1></div></div><div className="empty"><Video size={32}/><h2>Flux is ready for your videos.</h2><p>Add short-form video creation and playback when you connect your media storage.</p><button className="primary">Create a Flux</button></div></section>}

function Profile({user,onSignIn,onSettings}:{user:any,onSignIn:()=>void,onSettings:()=>void}){return <section><div className="profile-cover"></div><div className="profile-card"><div className="avatar profile-avatar">{user?.email?.[0]?.toUpperCase()||"Y"}</div><div className="profile-actions"><button className="outline" onClick={user?onSettings:onSignIn}>{user?"Edit profile":"Sign in"}</button></div><h1>{user?.user_metadata?.display_name||"Your profile"}</h1><p className="handle">@{user?.user_metadata?.username||"yourname"}</p><p className="bio">{user?"Make your world your way.":"Sign in to build your Living Profile."}</p><div className="stats"><div><b>0</b><span>Connections</span></div><div><b>0</b><span>Connected</span></div><div><b>0</b><span>Posts</span></div></div></div><div className="tabs"><button className="active">Posts</button><button>Vault</button><button>Replay</button></div><div className="empty compact"><UserRound size={28}/><p>Your posts will appear here.</p></div></section>}

function Composer({onClose,onPublish}:{onClose:()=>void,onPublish:(p:Post)=>void}){const [text,setText]=useState("");const [kind,setKind]=useState<"Echo"|"Signal">("Echo");return <div className="modal-backdrop"><div className="modal composer"><div className="modal-head"><div><p className="eyebrow">CREATE</p><h2>What do you want to create?</h2></div><button className="icon" onClick={onClose}><X/></button></div><div className="create-options"><button className={kind==="Echo"?"selected":""} onClick={()=>setKind("Echo")}><Sparkles/><b>Echo</b><span>Share a thought</span></button><button className={kind==="Signal"?"selected":""} onClick={()=>setKind("Signal")}><Radio/><b>Signal</b><span>Post with a purpose</span></button><button><ImagePlus/><b>Glimpse</b><span>24-hour moment</span></button><button><Video/><b>Flux</b><span>Short video</span></button></div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Write something worth sharing…" /><div className="composer-foot"><span>Audience: Public</span><button className="primary" disabled={!text.trim()} onClick={()=>onPublish({id:crypto.randomUUID(),author:"You",handle:"you",avatar:"Y",text:text.trim(),likes:0,comments:0,time:"Now",kind})}>Publish</button></div></div></div>}

function SettingsPanel({onClose,dark,setDark,user}:{onClose:()=>void,dark:boolean,setDark:(v:boolean)=>void,user:any}){return <div className="modal-backdrop"><div className="modal settings"><div className="modal-head"><div><p className="eyebrow">ACCOUNT</p><h2>Settings</h2></div><button className="icon" onClick={onClose}><X/></button></div>{[["Edit Profile",UserRound],["Privacy & Layers",Shield],["Blocked Users",Lock],["Your Activity",Radio],["Notifications",Bell]].map(([n,I]:any)=><button className="setting-row" key={n}><I size={18}/><span>{n}</span><ChevronRight size={16}/></button>)}<div className="setting-row"><div className="setting-label"><Sun size={18}/><span>Appearance</span></div><button className="toggle" onClick={()=>setDark(!dark)}><span>{dark?"Dark":"Light"}</span><div className={dark?"switch on":"switch"}></div></button></div><div className="security-note"><Shield size={17}/><span>Backend security is enforced through Supabase Row Level Security. Configure the included SQL before production use.</span></div></div></div>}

function Auth({onClose,email,setEmail,password,setPassword,onSignIn,onSignUp,status}:{onClose:()=>void,email:string,setEmail:any,password:string,setPassword:any,onSignIn:()=>void,onSignUp:()=>void,status:string}){return <div className="modal-backdrop"><div className="modal auth"><div className="modal-head"><div><p className="eyebrow">WELCOME TO WAYSS</p><h2>Sign in</h2></div><button className="icon" onClick={onClose}><X/></button></div><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password"/><button className="primary wide" onClick={onSignIn}>Sign in</button><button className="outline wide" onClick={onSignUp}>Create account</button>{status&&<p className="status">{status}</p>}<p className="tiny">Authentication uses your connected Supabase project. No privileged keys are stored in the browser.</p></div></div>}
