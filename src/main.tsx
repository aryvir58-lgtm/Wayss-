import React from "react";
import { createRoot } from "react-dom/client";
import App from "./AppV3";
import Enhancements from "./Enhancements";
import ConnectedFeed from "./ConnectedFeed";
import VeyaAI from "./VeyaAI";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Enhancements />
    <ConnectedFeed />
    <VeyaAI />
  </React.StrictMode>
);
