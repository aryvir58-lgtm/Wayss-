import React,{useState} from "react";
import { createRoot } from "react-dom/client";
import { Menu } from "lucide-react";
import App from "./AppV3";
import VeyaAI from "./VeyaAI";
import ProfileOverlay from "./ProfileOverlay";
import "./styles.css";
import "./premium-ui.css";

function Shell(){return <><App/><VeyaAI/><ProfileOverlay/></>}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Shell/></React.StrictMode>);
