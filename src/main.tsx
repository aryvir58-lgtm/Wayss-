import React from "react";
import { createRoot } from "react-dom/client";
import App from "./AppV3";
import VeyaAI from "./VeyaAI";
import ProfileOverlay from "./ProfileOverlay";
import AccessGate from "./AccessGate";
import Personalization from "./Personalization";
import "./styles.css";
import "./premium-ui.css";
import "./liquid-glass-ui.css";
import "./wayss-v2-ui.css";
import "./wayss-fixes.css";
function Shell(){return <><App/><VeyaAI/><ProfileOverlay/><AccessGate/><Personalization/></>}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Shell/></React.StrictMode>);
