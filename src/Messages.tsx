import React,{useCallback,useEffect,useRef,useState} from "react";
import {BellOff,ImagePlus,MessageCircle,Phone,PhoneOff,Video,Mic,MicOff,VideoOff,Send,Search,ArrowLeft,MoreHorizontal,Trash2,Smile,CheckCheck,Volume2,X,UserRound} from "lucide-react";
import {supabase} from "./supabase";

type Person={id:string;username:string|null;display_name:string|null;avatar_url:string|null;active_status?:boolean};
type Msg={id:string;conversation_id:string;sender_id:string;body:string|null;media_url:string|null;media_type:string|null;created_at:string;read_at?:string|null};
type Thread={id:string;peer:Person;last?:Msg|null;muted:boolean};
type Call={id:string;conversation_id:string;caller_id:string;callee_id:string;media_type:"audio"|"video";status:string;offer:any;answer:any;caller_candidates:any[];callee_candidates:any[];created_at:string};
const RTC_CONFIG:RTCConfiguration={iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]};
const initials=(p:any)=>String(p?.display_name||p?.username||"W").trim().slice(0,1).toUpperCase();
const time=(s:string)=>new Date(s).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
export default function Messages({user,people,onNeedSignIn}:any){
 const [threads,setThreads]=useState<Thread[]>([]),[selected,setSelected]=useState<Thread|null>(null),[rows,setRows]=useState<Msg[]>([]),[query,setQuery]=useState(""),[body,setBody]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[err,setErr]=useState(""),[muted,setMuted]=useState(false),[menu,setMenu]=useState(false),[call,setCall]=useState<Call|null>(null),[incoming,setIncoming]=useState<Call|null>(null),[micMuted,setMicMuted]=useState(false),[cameraOff,setCameraOff]=useState(false),[callStatus,setCallStatus]=useState(""),[emojiOpen,setEmojiOpen]=useState(false);
 const pc=useRef<RTCPeerConnection|null>(null),localStream=useRef<MediaStream|null>(null),remoteVideo=useRef<HTMLVideoElement|null>(null),localVideo=useRef<HTMLVideoElement|null>(null),processedCandidates=useRef(0),seenIncoming=useRef<string|null>(null),currentCall=useRef<Call|null>(null),remoteCandidateCount=useRef(0),pollLock=useRef(false);
 const userId=user?.id;
 const loadThreads=useCallback(async()=>{
  if(!supabase||!userId){setThreads([]);setLoading(false);return}
  setLoading(true);setErr("");
  const {data:mine,error}=await supabase.from("conversation_members").select("conversation_id").eq("user_id",userId);
  if(error){setErr(error.message);setLoading(false);return}
  const ids=[...new Set((mine||[]).map((x:any)=>x.conversation_id))];
  if(!ids.length){setThreads([]);setLoading(false);return}
  const {data:members,error:me}=await supabase.from("conversation_members").select("conversation_id,user_id").in("conversation_id",ids);
  if(me){setErr(me.message);setLoading(false);return}
  const peers=(members||[]).filter((m:any)=>m.user_id!==userId);
  const peerIds=[...new Set(peers.map((x:any)=>x.user_id))];
  const [{data:profiles},{data:messages}]=await Promise.all([
   peerIds.length?supabase.from("profiles").select("id,username,display_name,avatar_url,active_status").in("id",peerIds):Promise.resolve({data:[] as any[]}),
   supabase.from("messages").select("*").in("conversation_id",ids).order("created_at",{ascending:false}).limit(150)
  ]);
  const pmap=new Map((profiles||[]).map((p:any)=>[p.id,p]));
  const built:Thread[]=[];
  for(const m of peers as any[]){const p=pmap.get(m.user_id) as Person|undefined;if(!p)continue;const latest=(messages||[]).find((x:any)=>x.conversation_id===m.conversation_id) as Msg|undefined;const id=m.conversation_id;if(built.some(t=>t.id===id))continue;built.push({id,peer:p,last:latest||null,muted:localStorage.getItem("wayss-muted-"+id)==="1"})}
  built.sort((a,b)=>new Date(b.last?.created_at||0).getTime()-new Date(a.last?.created_at||0).getTime());
  setThreads(built);setLoading(false);
 },[userId]);
 const loadMessages=useCallback(async(id:string)=>{
  if(!supabase)return;const{data,error}=await supabase.from("messages").select("*").eq("conversation_id",id).order("created_at",{ascending:true}).limit(500);
  if(error)setErr(error.message);else setRows((data||[]) as Msg[]);
 },[]);
 useEffect(()=>{void loadThreads()},[loadThreads]);
 useEffect(()=>{if(!selected){setRows([]);return}void loadMessages(selected.id);setMuted(localStorage.getItem("wayss-muted-"+selected.id)==="1");
  if(!supabase)return;const channel=supabase.channel("wayss-chat-"+selected.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+selected.id},(payload:any)=>setRows(prev=>prev.some(x=>x.id===payload.new.id)?prev:[...prev,payload.new as Msg])).on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:"conversation_id=eq."+selected.id},(payload:any)=>setRows(prev=>prev.map(x=>x.id===payload.new.id?payload.new as Msg:x))).subscribe();return()=>{void supabase!.removeChannel(channel)}
 },[selected?.id,loadMessages]);
 useEffect(()=>{const ch=supabase?.channel("wayss-inbox-"+userId).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},()=>{void loadThreads();if(selected)void loadMessages(selected.id)}).subscribe();return()=>{if(ch&&supabase)void supabase.removeChannel(ch)}},[userId,selected?.id,loadThreads,loadMessages]);
 const startThread=async(peer:Person)=>{
  if(!supabase||!userId){setErr("Please sign in again to start a chat.");return}
  setErr("");setBusy(true);
  try{
   const existing=threads.find(t=>t.peer.id===peer.id);
   if(existing){setSelected(existing);setBusy(false);return}
   // Reuse an existing 1:1 conversation even if the inbox list has not refreshed yet.
   const {data:mine,error:mineError}=await supabase.from("conversation_members").select("conversation_id").eq("user_id",userId);
   if(mineError)throw mineError;
   const ids=(mine||[]).map((m:any)=>m.conversation_id);
   if(ids.length){
    const {data:members,error:membersError}=await supabase.from("conversation_members").select("conversation_id,user_id").in("conversation_id",ids).eq("user_id",peer.id);
    if(membersError)throw membersError;
    const match=(members||[])[0];
    if(match){
     const t:Thread={id:match.conversation_id,peer,last:null,muted:localStorage.getItem("wayss-muted-"+match.conversation_id)==="1"};
     setThreads(prev=>[t,...prev.filter(x=>x.id!==t.id)]);setSelected(t);void loadMessages(t.id);return;
    }
   }
   // Insert without .select(): RLS only allows reading a conversation after membership exists.
   const conversationId=crypto.randomUUID();
   const {error:ce}=await supabase.from("conversations").insert({id:conversationId,created_by:userId,is_group:false,title:null});
   if(ce)throw ce;
   const {error:me}=await supabase.from("conversation_members").insert([
    {conversation_id:conversationId,user_id:userId},
    {conversation_id:conversationId,user_id:peer.id}
   ]);
   if(me)throw me;
   const t:Thread={id:conversationId,peer,last:null,muted:false};
   setThreads(prev=>[t,...prev]);setSelected(t);void loadMessages(t.id);
  }catch(e:any){setErr(e?.message||"Couldn't start chat. Please try again.");}
  finally{setBusy(false);}
 };
 const send=async(file?:File)=>{
  if(!supabase||!userId||!selected)return;if(!body.trim()&&!file)return;setBusy(true);setErr("");
  let media_url:string|null=null,media_type:string|null=null;
  if(file){if(file.size>15*1024*1024){setErr("Media must be under 15 MB.");setBusy(false);return}
   const path=userId+"/messages/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
   const up=await supabase.storage.from("wayss-media").upload(path,file,{upsert:false,contentType:file.type});if(up.error){setErr(up.error.message);setBusy(false);return}
   media_url=supabase.storage.from("wayss-media").getPublicUrl(path).data.publicUrl;media_type=file.type.startsWith("image/")?"image":file.type.startsWith("video/")?"video":"file";
  }
  const text=body.trim();const{data,error}=await supabase.from("messages").insert({conversation_id:selected.id,sender_id:userId,body:text||null,media_url,media_type}).select("*").single();
  if(error)setErr(error.message);else{setRows(prev=>prev.some(x=>x.id===data.id)?prev:[...prev,data as Msg]);setBody("");setThreads(prev=>prev.map(t=>t.id===selected.id?{...t,last:data as Msg}:t).sort((a,b)=>new Date(b.last?.created_at||0).getTime()-new Date(a.last?.created_at||0).getTime()))}
  setBusy(false);
 };
 const toggleMute=()=>{if(!selected)return;const next=!muted;setMuted(next);localStorage.setItem("wayss-muted-"+selected.id,next?"1":"0");setThreads(prev=>prev.map(t=>t.id===selected.id?{...t,muted:next}:t));setMenu(false)};
 const stopCall=async(status="ended")=>{const active=currentCall.current;if(active&&supabase)await supabase.from("call_sessions").update({status,updated_at:new Date().toISOString()}).eq("id",active.id);pc.current?.close();pc.current=null;localStream.current?.getTracks().forEach(t=>t.stop());localStream.current=null;if(remoteVideo.current)remoteVideo.current.srcObject=null;if(localVideo.current)localVideo.current.srcObject=null;currentCall.current=null;setCall(null);setIncoming(null);setCallStatus("");setMicMuted(false);setCameraOff(false);processedCandidates.current=0;remoteCandidateCount.current=0};
 const addLocalCandidates=async(candidate:RTCIceCandidate,which:"caller_candidates"|"callee_candidates",id:string)=>{
  if(!supabase)return;const{data}=await supabase.from("call_sessions").select(which).eq("id",id).maybeSingle();const old=(data as any)?.[which]||[];await supabase.from("call_sessions").update({[which]:[...old,candidate.toJSON()],updated_at:new Date().toISOString()}).eq("id",id);
 };
 const attachCall=async(c:Call,initiator:boolean)=>{
  if(!supabase)return;setCall(c);setCallStatus(initiator?"Calling…":"Connecting…");currentCall.current=c;processedCandidates.current=0;remoteCandidateCount.current=0;
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:c.media_type==="video"});localStream.current=stream;if(localVideo.current)localVideo.current.srcObject=stream;
   const peer=new RTCPeerConnection(RTC_CONFIG);pc.current=peer;stream.getTracks().forEach(t=>peer.addTrack(t,stream));
   peer.ontrack=e=>{if(remoteVideo.current)remoteVideo.current.srcObject=e.streams[0]};
   peer.onicecandidate=e=>{if(e.candidate)void addLocalCandidates(e.candidate,initiator?"caller_candidates":"callee_candidates",c.id)};
   peer.onconnectionstatechange=()=>setCallStatus(peer.connectionState==="connected"?"Connected":peer.connectionState==="failed"?"Connection failed — network may need TURN":peer.connectionState);
   if(initiator){const offer=await peer.createOffer();await peer.setLocalDescription(offer);await supabase.from("call_sessions").update({offer:offer.toJSON(),status:"ringing",updated_at:new Date().toISOString()}).eq("id",c.id)}
   else if(c.offer){await peer.setRemoteDescription(new RTCSessionDescription(c.offer));const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await supabase.from("call_sessions").update({answer:answer.toJSON(),status:"accepted",updated_at:new Date().toISOString()}).eq("id",c.id);setIncoming(null)}
  }catch(e:any){setCallStatus(e?.name==="NotAllowedError"?"Allow microphone/camera access to call.":e?.message||"Call couldn't start.");}
 };
 const beginCall=async(type:"audio"|"video")=>{
  if(!supabase||!userId||!selected)return;const{data,error}=await supabase.from("call_sessions").insert({conversation_id:selected.id,caller_id:userId,callee_id:selected.peer.id,media_type:type,status:"ringing"}).select("*").single();if(error){setErr(error.message);return}await attachCall(data as Call,true);
 };
 const acceptCall=async()=>{if(!incoming)return;const c=incoming;setIncoming(null);await attachCall(c,false)};
 useEffect(()=>{if(!userId||!supabase)return;let active=true;const tick=async()=>{
  if(!active||pollLock.current)return;pollLock.current=true;
  try{
   const{data}=await supabase!.from("call_sessions").select("*").or("caller_id.eq."+userId+",callee_id.eq."+userId).in("status",["ringing","accepted"]).order("created_at",{ascending:false}).limit(8);
   if(!active)return;const list=(data||[]) as Call[];const inCall=currentCall.current;
   const ring=list.find(c=>c.callee_id===userId&&c.caller_id!==userId&&c.status==="ringing");
   if(ring&&ring.id!==seenIncoming.current&&!inCall){seenIncoming.current=ring.id;setIncoming(ring)}
   if(inCall){const latest=list.find(c=>c.id===inCall.id);if(!latest||["ended","declined","missed"].includes(latest.status)){await stopCall(latest?.status||"ended")}else{
     currentCall.current=latest;setCall(latest);
     const peer=pc.current;
     if(peer&&inCall.caller_id===userId&&latest.answer&&!peer.currentRemoteDescription){await peer.setRemoteDescription(new RTCSessionDescription(latest.answer));setCallStatus("Connecting…")}
     const candidates=inCall.caller_id===userId?(latest.callee_candidates||[]):(latest.caller_candidates||[]);
     while(peer&&remoteCandidateCount.current<candidates.length){const item=candidates[remoteCandidateCount.current++];try{await peer.addIceCandidate(new RTCIceCandidate(item))}catch{}}
   }}
  }catch{}finally{pollLock.current=false}
 };const timer=window.setInterval(()=>void tick(),1300);void tick();return()=>{active=false;window.clearInterval(timer)}},[userId]);
 const toggleMic=()=>{const next=!micMuted;setMicMuted(next);localStream.current?.getAudioTracks().forEach(t=>t.enabled=!next)};
 const toggleCamera=()=>{const next=!cameraOff;setCameraOff(next);localStream.current?.getVideoTracks().forEach(t=>t.enabled=!next)};
 const filtered=people.filter((p:Person)=>p.id!==userId&&((p.display_name||"")+" "+(p.username||"")).toLowerCase().includes(query.toLowerCase()));
 const showPeople=query.trim().length>0;
 if(!userId)return <section className="messages-page"><div className="empty"><MessageCircle size={34}/><h2>Messages, calls, your people.</h2><p>Sign in to chat with WAYSS users and start audio or video calls.</p><button className="primary" onClick={onNeedSignIn}>Sign in</button></div></section>;
 return <section className="messages-page" style={{display:"grid",gridTemplateColumns:"minmax(250px,320px) minmax(0,1fr)",gap:16,minHeight:"min(72vh,760px)"}}>
  <aside className="messages-list" style={{border:"1px solid var(--line)",borderRadius:20,overflow:"hidden",background:"var(--panel)",minWidth:0}}>
   <div style={{padding:18,borderBottom:"1px solid var(--line)"}}><p className="eyebrow">YOUR PEOPLE</p><h1 style={{margin:"2px 0 14px"}}>Messages</h1><div className="search" style={{width:"100%",boxSizing:"border-box"}}><Search size={16}/><input value={query}onChange={e=>setQuery(e.target.value)}placeholder="Search people or chats"/></div></div>
   {err&&!selected&&<div role="alert" style={{margin:"10px 12px",padding:10,borderRadius:10,border:"1px solid rgba(217,69,88,.35)",background:"rgba(217,69,88,.08)",fontSize:12,overflowWrap:"anywhere"}}>{err}</div>}
   {busy&&!selected&&<p style={{padding:"0 18px",fontSize:12,opacity:.7}}>Opening conversation…</p>}
   <div style={{overflowY:"auto",maxHeight:560}}>
    {showPeople&&filtered.map((p:Person)=><button key={p.id} onClick={()=>void startThread(p)} className="person" style={{width:"100%",border:0,borderRadius:0,textAlign:"left",background:"transparent",cursor:"pointer",padding:14}}><span className="avatar">{p.avatar_url?<img src={p.avatar_url} alt=""/>:initials(p)}</span><span style={{flex:1,minWidth:0,textAlign:"left"}}><b>{p.display_name||p.username||"WAYSS user"}</b><span>@{p.username||"user"} · Start chat</span></span><MessageCircle size={17}/></button>)}
    {loading?<p style={{padding:18,opacity:.65}}>Loading chats…</p>:threads.filter(t=>!showPeople||((t.peer.display_name||"")+" "+(t.peer.username||"")).toLowerCase().includes(query.toLowerCase())).map(t=><button key={t.id} onClick={()=>{setSelected(t);setMenu(false)}} className="person" style={{width:"100%",border:0,borderRadius:0,textAlign:"left",background:selected?.id===t.id?"var(--surface,rgba(139,114,255,.12))":"transparent",cursor:"pointer",padding:14}}><span className="avatar">{t.peer.avatar_url?<img src={t.peer.avatar_url} alt=""/>:initials(t.peer)}</span><span style={{flex:1,minWidth:0,textAlign:"left"}}><b>{t.peer.display_name||t.peer.username||"WAYSS user"} {t.muted&&<BellOff size={12} style={{display:"inline"}}/>}</b><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{t.last?.body|| (t.last?.media_type?"Shared "+t.last.media_type:"Start a conversation")}</span></span>{t.last&&<small>{time(t.last.created_at)}</small>}</button>)}
    {!loading&&!threads.length&&!showPeople&&<div style={{padding:20,opacity:.7,fontSize:13}}>No chats yet. Search for a person above to start one.</div>}
   </div>
  </aside>
  <div className="message-window" style={{border:"1px solid var(--line)",borderRadius:20,overflow:"hidden",background:"var(--panel)",display:"flex",flexDirection:"column",minWidth:0,minHeight:520}}>
   {!selected?<div className="empty" style={{margin:"auto",padding:24}}><MessageCircle size={34}/><h2>Your world. Your people.</h2><p>Choose a chat or search for someone to say hello.</p></div>:<>
    <div className="message-header" style={{padding:"14px 16px",borderBottom:"1px solid var(--line)",display:"flex",alignItems:"center",gap:10}}>
     <button className="icon" onClick={()=>setSelected(null)} aria-label="Back to chats"><ArrowLeft size={18}/></button><span className="avatar">{selected.peer.avatar_url?<img src={selected.peer.avatar_url} alt=""/>:initials(selected.peer)}</span><div style={{flex:1,minWidth:0}}><b>{selected.peer.display_name||selected.peer.username||"WAYSS user"}</b><small style={{display:"block",opacity:.65}}>@{selected.peer.username||"user"} · {selected.peer.active_status?"Active on WAYSS":"WAYSS"}</small></div>
     <button className="icon" title="Voice call" onClick={()=>void beginCall("audio")}><Phone size={18}/></button><button className="icon" title="Video call" onClick={()=>void beginCall("video")}><Video size={19}/></button><div style={{position:"relative"}}><button className="icon" title="Chat options" onClick={()=>setMenu(!menu)}><MoreHorizontal size={20}/></button>{menu&&<div className="post-menu" style={{right:0,top:40,zIndex:5}}><button onClick={toggleMute}><BellOff size={15}/>{muted?"Unmute chat":"Mute chat notifications"}</button></div>}</div>
    </div>
    {err&&<p className="status" style={{margin:10}}>{err}</p>}
    {muted&&<div style={{padding:"7px 14px",fontSize:12,opacity:.7,display:"flex",alignItems:"center",gap:6}}><BellOff size={13}/> Chat muted on this device</div>}
    <div className="message-history" style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:9}}>
     {rows.map(m=><div key={m.id} style={{alignSelf:m.sender_id===userId?"flex-end":"flex-start",maxWidth:"min(82%,460px)",background:m.sender_id===userId?"rgba(139,114,255,.18)":"var(--surface,rgba(128,128,128,.10))",border:"1px solid var(--line)",borderRadius:16,padding:"9px 12px",overflowWrap:"anywhere"}}>
      {m.media_url&&<div style={{marginBottom:6}}>{m.media_type==="image"?<img src={m.media_url} alt="Shared image" style={{maxWidth:"100%",maxHeight:300,borderRadius:10}}/>:m.media_type==="video"?<video src={m.media_url} controls playsInline style={{maxWidth:"100%",borderRadius:10}}/>:<a href={m.media_url} target="_blank" rel="noreferrer">Open attachment</a>}</div>}
      {m.body&&<div style={{whiteSpace:"pre-wrap"}}>{m.body}</div>}<small style={{display:"flex",justifyContent:"flex-end",gap:4,opacity:.58,marginTop:4}}>{time(m.created_at)} {m.sender_id===userId&&<CheckCheck size={13}/>}</small>
     </div>)}
     {!rows.length&&<p style={{textAlign:"center",opacity:.6,margin:"auto"}}>This is the beginning of your conversation. Say hi 👋</p>}
    </div>
    <div style={{padding:12,borderTop:"1px solid var(--line)",display:"flex",alignItems:"center",gap:8}}>
     <label className="icon" title="Share image or video" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}><ImagePlus size={19}/><input hidden type="file" accept="image/*,video/*" onChange={e=>{const f=e.target.files?.[0];if(f)void send(f);e.currentTarget.value=""}}/></label>
     <input value={body}onChange={e=>setBody(e.target.value)}onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send()}}}placeholder="Message…" style={{flex:1,minWidth:0}}/>
     <button className="icon" title="Emoji" onClick={()=>setEmojiOpen(!emojiOpen)}><Smile size={18}/></button><button className="primary" disabled={busy||(!body.trim())} onClick={()=>void send()}><Send size={17}/></button>
    </div>{emojiOpen&&<div style={{padding:10,display:"flex",gap:8,justifyContent:"center",borderTop:"1px solid var(--line)"}}>{["❤️","😂","🔥","😍","👍","🥹","👀","✨"].map(e=><button key={e} className="icon" onClick={()=>{setBody(v=>v+e);setEmojiOpen(false)}}>{e}</button>)}</div>}
   </>}
  </div>
  {incoming&&<div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><p className="eyebrow">INCOMING {incoming.media_type==="video"?"VIDEO":"VOICE"} CALL</p><h2>{people.find((p:Person)=>p.id===incoming.caller_id)?.display_name||"WAYSS user"} is calling</h2></div><button className="icon"onClick={()=>{void supabase?.from("call_sessions").update({status:"declined"}).eq("id",incoming.id);setIncoming(null)}}><X size={18}/></button></div><p>Answer to connect using your microphone{incoming.media_type==="video"?" and camera":""}.</p><div className="modal-actions"><button className="outline"onClick={()=>{void supabase?.from("call_sessions").update({status:"declined"}).eq("id",incoming.id);setIncoming(null)}}><PhoneOff size={16}/> Decline</button><button className="primary"onClick={()=>void acceptCall()}><Phone size={16}/> Answer</button></div></div></div>}
  {call&&<div className="modal-backdrop"><div className="modal" style={{width:"min(760px,96vw)"}}><div className="modal-head"><div><p className="eyebrow">{call.media_type==="video"?"VIDEO CALL":"VOICE CALL"}</p><h2>{selected?.peer.display_name||"WAYSS call"}</h2><p style={{opacity:.7}}>{callStatus||"Connecting…"}</p></div><button className="icon"onClick={()=>void stopCall()}><X size={18}/></button></div><div style={{display:"grid",gridTemplateColumns:call.media_type==="video"?"repeat(2,minmax(0,1fr))":"1fr",gap:10}}>{call.media_type==="video"&&<video ref={remoteVideo} autoPlay playsInline style={{width:"100%",minHeight:180,background:"#080b12",borderRadius:16}}/>}<video ref={localVideo} autoPlay playsInline muted style={{width:"100%",minHeight:call.media_type==="video"?180:60,maxHeight:260,objectFit:"cover",background:"#080b12",borderRadius:16,display:call.media_type==="video"?"block":"none"}}/>{call.media_type==="audio"&&<div style={{padding:28,textAlign:"center",opacity:.7}}><Phone size={28}/><p>Voice call in progress</p></div>}</div><div className="modal-actions" style={{justifyContent:"center",gap:12}}><button className="outline"onClick={toggleMic}>{micMuted?<MicOff size={17}/>:<Mic size={17}/>} {micMuted?"Unmute":"Mute mic"}</button>{call.media_type==="video"&&<button className="outline"onClick={toggleCamera}>{cameraOff?<VideoOff size={17}/>:<Video size={17}/>} {cameraOff?"Camera on":"Camera off"}</button>}<button className="primary"style={{background:"#d94558"}}onClick={()=>void stopCall()}><PhoneOff size={17}/> End call</button></div></div></div>}
 </section>
}
