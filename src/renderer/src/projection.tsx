import React from "react";
import ReactDOM from "react-dom/client";
import ProjectionWindow from "./screens/ProjectionWindow";
import "./styles/globals.css";

ReactDOM.createRoot(
  document.getElementById("projection-root") as HTMLElement,
).render(
  <React.StrictMode>
    <ProjectionWindow />
  </React.StrictMode>,
);
