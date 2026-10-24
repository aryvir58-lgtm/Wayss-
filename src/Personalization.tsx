import React,{useEffect,useState}from"react";
import{Palette}from"lucide-react";

type Theme={id:string;name:string;accent:string;bg:string;description:string};
const themes:Theme[]=[
 {id:"dark",name:"Dark",accent:"#9b7cff",bg:"#080b12",description:"Calm dark"},
 {id:"light",name:"Light",accent:"#7058e8",bg:"#f6f6f8",description:"Clean light"},
 {id:"cherry",name:"Red Cherry",accent:"#ff4f72",bg:"#12090d",description:"Deep cherry"},
 {id:"midnight",name:"Midnight Blue",accent:"#55a8ff",bg:"#07101c",description:"Cool midnight"},
 {id:"aurora",name:"Aurora",accent:"#56e0c5",bg:"#07130f",description:"Soft aurora"},
 {id:"graphite",name:"Graphite",accent:"#d4d7df",bg:"#101113",description:"Minimal graphite"},
 {id:"lavender",name:"Lavender",accent:"#b58cff",bg:"#110d18",description:"Dreamy purple"},
];

function applyTheme(id:string){
 document.documentElement.dataset.theme=id;
 localStorage.setItem("wayss-theme",id);
}

function injectPicker(theme:string,setTheme:(id:string)=>void){
 const modal=Array.from(document.querySelectorAll<HTMLElement>(".modal")).find(el=>/WAYSS settings/i.test(el.textContent||""));
 if(!modal)return;
 if(modal.querySelector(".wayss-personalization"))return;
 const heading=Array.from(modal.querySelectorAll<HTMLElement>("h3")).find(el=>el.textContent?.trim()==="Appearance");
 if(!heading)return;
 const rows=[] as HTMLElement[];
 let node=heading.nextElementSibling as HTMLElement|null;
 while(node&&node.tagName!=="H3"){rows.push(node);node=node.nextElementSibling as HTMLElement|null;}
 rows.forEach(row=>row.classList.add("wayss-old-appearance-row"));
 const section=document.createElement("section");
 section.className="wayss-personalization";
 section.innerHTML=`<div class="wayss-personalization-title"><span><span class="wayss-personalization-icon">✦</span> Personalization</span><small>Choose your WAYSS atmosphere</small></div><div class="wayss-theme-grid"></div>`;
 const grid=section.querySelector(".wayss-theme-grid") as HTMLElement;
 themes.forEach(t=>{
  const b=document.createElement("button");
  b.type="button";
  b.className="wayss-theme-option"+(t.id===theme?" active":"");
  b.innerHTML=`<span class="wayss-theme-preview" style="background:${t.bg};border-color:${t.accent}"><i style="background:${t.accent}"></i></span><span class="wayss-theme-copy"><strong>${t.name}</strong><small>${t.description}</small></span>${t.id===theme?'<span class="wayss-theme-check">✓</span>':''}`;
  b.onclick=()=>{
   setTheme(t.id);
   applyTheme(t.id);
   grid.querySelectorAll(".wayss-theme-option").forEach(x=>x.classList.remove("active"));
   grid.querySelectorAll(".wayss-theme-check").forEach(x=>x.remove());
   b.classList.add("active");
   b.insertAdjacentHTML("beforeend",'<span class="wayss-theme-check">✓</span>');
  };
  grid.appendChild(b);
 });
 heading.insertAdjacentElement("afterend",section);
}

export default function Personalization(){
 const[theme,setTheme]=useState(()=>localStorage.getItem("wayss-theme")||"dark");
 useEffect(()=>{applyTheme(theme)},[theme]);
 useEffect(()=>{
  const mount=()=>injectPicker(theme,setTheme);
  const observer=new MutationObserver(()=>mount());
  observer.observe(document.body,{childList:true,subtree:true});
  mount();
  return()=>observer.disconnect();
 },[theme]);
 useEffect(()=>{
  const custom=()=>{
   const saved=localStorage.getItem("wayss-theme")||"dark";
   if(saved!=="dark"&&saved!=="light"&&document.documentElement.dataset.theme!==saved){
    document.documentElement.dataset.theme=saved;
   }
  };
  const observer=new MutationObserver(custom);
  observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  return()=>observer.disconnect();
 },[]);
 return <button className="wayss-palette-fallback" aria-label="Personalization"><Palette size={17}/></button>;
}
