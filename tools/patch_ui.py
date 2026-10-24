from pathlib import Path
import re

p=Path('src/AppV3.tsx')
s=p.read_text()
original=s

s=s.replace('Bell,Bookmark,Compass,Heart,Home,LogIn,LogOut,MessageCircle,MoreHorizontal,Plus,Search,Settings,UserRound', 'Bell,Bookmark,Compass,Heart,Home,LogIn,LogOut,MessageCircle,MoreHorizontal,Plus,Search,Settings,Menu,UserRound')

s=re.sub(r'async function loadPeople\(\)\{.*?\n async function connect', '''async function loadPeople(contactPhones:string[]=[]){
  if(!supabase||!user)return;
  setPeopleBusy(true);setPeopleError("");
  const {data,error}=await supabase.functions.invoke("orbit-suggestions",{body:{contactPhones}});
  if(error){setPeopleError(error.message||"Could not load relevant people");setPeopleBusy(false);return}
  const ps=Array.isArray(data?.profiles)?data.profiles:[];
  const {data:cs,error:ce}=await supabase.from("connections").select("follower_id,following_id,status").or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);
  if(ce){setPeopleError(ce.message);setPeopleBusy(false);return}
  const rel=new Map<string,Person["relation"]>();
  (cs||[]).forEach((c:any)=>{if(c.follower_id===user.id)rel.set(c.following_id,c.status==="pending"?"pending_out":"connected");else rel.set(c.follower_id,c.status==="pending"?"pending_in":"connected")});
  setPeople(ps.map((p:any)=>({...p,relation:rel.get(p.id)||"none",count:0})));
  setPeopleBusy(false)
}
 async function connect''', s, count=1, flags=re.S)

s=s.replace('<button className="nav" onClick={()=>setScreen("You")}><Settings size={19}/><span>Account settings</span></button>', '<button className="nav" onClick={()=>setSettingsOpen(true)}><Settings size={19}/><span>Account settings</span></button>')
s=s.replace('<div className="mobile-brand"><div className="logo small">W</div><b>WAYSS</b></div><div className="search">', '<div className="mobile-brand"><div className="logo small">W</div><b>WAYSS</b></div><button className="icon mobile-settings-menu" title="Settings" aria-label="Settings" onClick={()=>setSettingsOpen(true)}><Menu size={21}/></button><div className="search">')
s=s.replace('<Orbit people={people.filter(p=>(String(p.display_name||"")+" "+String(p.username||"")).toLowerCase().includes(q.toLowerCase()))}busy={peopleBusy}error={peopleError}connect={connect}disconnect={disconnect}accept={accept}/>', '<Orbit people={people.filter(p=>(String(p.display_name||"")+" "+String(p.username||"")).toLowerCase().includes(q.toLowerCase()))}busy={peopleBusy}error={peopleError}connect={connect}disconnect={disconnect}accept={accept}refresh={loadPeople}/>')
s=s.replace('<Messages user={user} people={people} onNeedSignIn={()=>setAuth(true)} active={screen==="Messages"}/> ', '{screen==="Messages"&&<Messages user={user} people={people} onNeedSignIn={()=>setAuth(true)} active/>} ')
s=s.replace('{commentsPost&&<Comments post={commentsPost}user={user}close={()=>setCommentsPost(null)}changed={loadPosts}/>} {noticeOpen&&<Notices notices={notices}close={()=>setNoticeOpen(false)}/>} {auth&&<Auth', '{commentsPost&&<Comments post={commentsPost}user={user}close={()=>setCommentsPost(null)}changed={loadPosts}/>} {noticeOpen&&<Notices notices={notices}close={()=>setNoticeOpen(false)}/>} {settingsOpen&&<SettingsPanel user={user} profile={profile} onClose={()=>setSettingsOpen(false)} onEditProfile={()=>{setSettingsOpen(false);setEdit(true)}} onProfileUpdate={updateSettingsProfile}/>} {auth&&<Auth')
s=s.replace('<div className="discover-card"><b>{counts.a}</b><span>Connections</span></div><div className="discover-card"><b>{counts.b}</b><span>Connected</span></div><div className="discover-card"><b>{counts.c}</b><span>Posts</span></div>', '<div className="discover-card"><b>{counts.a}</b><span>Followers</span></div><div className="discover-card"><b>{counts.b}</b><span>Following</span></div><div className="discover-card"><b>{counts.c}</b><span>Posts</span></div>')
s=s.replace('Another WAYSS account will appear here when its profile is readable.', 'People appear here only when they match your contacts or your friend network. No random profiles.')

old='function Orbit({people,busy,error,connect,disconnect,accept}:any){return <section><div className="page-head"><div><p className="eyebrow">DISCOVER</p><h1>Orbit</h1></div></div>'
new='''function Orbit({people,busy,error,connect,disconnect,accept,refresh}:any){
 const [contactMsg,setContactMsg]=useState("");
 async function findContacts(){
  setContactMsg("");
  const api=(navigator as any).contacts;
  if(!api?.select){setContactMsg("Contact suggestions need a supported Android browser with Contacts access.");return}
  try{
   const contacts=await api.select(["tel"],{multiple:true});
   const phones=[...new Set((contacts||[]).flatMap((c:any)=>Array.isArray(c.tel)?c.tel:[]).filter((v:any)=>typeof v==="string"&&v.trim()))];
   if(!phones.length){setContactMsg("No phone numbers were selected.");return}
   await refresh(phones);
   setContactMsg("Showing people from your contacts and friend network.");
  }catch(e:any){if(e?.name!=="AbortError")setContactMsg("Contacts access was cancelled or unavailable.");}
 }
 return <section><div className="page-head"><div><p className="eyebrow">DISCOVER</p><h1>Orbit</h1></div><button className="outline orbit-contact-button" onClick={()=>void findContacts()}><UserPlus size={15}/>Find from contacts</button></div>{contactMsg&&<div className="status">{contactMsg}</div>}'''
s=s.replace(old,new)

if s==original:
    raise SystemExit('No UI changes matched')
p.write_text(s)
print('patched AppV3')
