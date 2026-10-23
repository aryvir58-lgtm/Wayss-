import React from "react";
import { createRoot } from "react-dom/client";
import App from "./AppV3";
import Enhancements from "./Enhancements";
import VeyaAI from "./VeyaAI";
import ProfileOverlay from "./ProfileOverlay";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Enhancements />
    <VeyaAI />
    <ProfileOverlay />
  </React.StrictMode>
);
