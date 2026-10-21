import React,{useEffect,useRef}from"react";
import{supabase}from"./supabase";

export default function ConnectedFeed(){
 const mode=useRef<"for-you"|"connected">("for-you");
 useEffect(()=>{
  let disposed=false;
  const getConnectedHandles=async()=>{
   const{data:{session}}=await supabase.auth.getSession();
   if(!session?.user)return new Set<string>();
   const{data:connections}=await supabase.from("connections").select("follower_id,following_id").or(`follower_id.eq.${session.user.id},following_id.eq.${session.user.id}`).eq("status","accepted");
   const ids=new Set<string>([session.user.id]);
   (connections||[]).forEach((c:any)=>{ids.add(c.follower_id);ids.add(c.following_id)});
   const{data:profiles}=await supabase.from("profiles").select("id,username").in("id",Array.from(ids));
   return new Set((profiles||[]).map((p:any)=>p.username).filter(Boolean).map((x:string)=>x.toLowerCase()));
  };
  const apply=async()=>{
   if(disposed)return;
   const buttons=Array.from(document.querySelectorAll<HTMLElement>(".filters .chip"));
   const connected=buttons.find(b=>b.textContent?.trim()==="Connected");
   const forYou=buttons.find(b=>b.textContent?.trim()==="For You");
   if(!connected||!forYou)return;
   buttons.forEach(b=>{b.onclick=null;b.classList.remove("active")});
   const setActive=(b:HTMLElement)=>{buttons.forEach(x=>x.classList.remove("active"));b.classList.add("active")};
   const setPosts=async(next:"for-you"|"connected")=>{
    mode.current=next;
    setActive(next==="connected"?connected:forYou);
    const articles=Array.from(document.querySelectorAll<HTMLElement>(".feed .post"));
    if(next==="for-you"){articles.forEach(a=>a.style.display="");return}
    const handles=await getConnectedHandles();
    articles.forEach(a=>{
      const text=a.querySelector(".who span")?.textContent||"";
      const m=text.match(/@([^\s·]+)/);
      const handle=(m?.[1]||"").toLowerCase();
      a.style.display=handles.has(handle)?"":"none";
    });
   };
   connected.onclick=()=>{void setPosts("connected")};
   forYou.onclick=()=>{void setPosts("for-you")};
   setActive(mode.current==="connected"?connected:forYou);
   if(mode.current==="connected")void setPosts("connected");
  };
  const observer=new MutationObserver(()=>{window.setTimeout(()=>void apply(),0)});
  observer.observe(document.body,{childList:true,subtree:true});
  const timer=window.setTimeout(()=>void apply(),100);
  return()=>{disposed=true;observer.disconnect();window.clearTimeout(timer)};
 },[]);
 return null;
}
