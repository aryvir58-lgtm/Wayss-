import React,{useState} from "react";
import { createRoot } from "react-dom/client";
import { Menu } from "lucide-react";
import App from "./AppV3";
import VeyaAI from "./VeyaAI";
import ProfileOverlay from "./ProfileOverlay";
import WayssSettings from "./WayssSettings";
import "./styles.css";
import "./premium-ui.css";

function Shell(){const[settings,setSettings]=useState(false);return <><App/><VeyaAI/><ProfileOverlay/><button className="ws-floating-settings ws-top-menu" onClick={()=>setSettings(true)} aria-label="Open settings" title="Settings"><Menu size={21}/></button><WayssSettings open={settings} onClose={()=>setSettings(false)}/></>}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Shell/></React.StrictMode>);
