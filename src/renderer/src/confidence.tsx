import React from "react"
import ReactDOM from "react-dom/client"
import ConfidenceMonitor from "./features/projection/ConfidenceMonitor"
import "./styles/globals.css"

ReactDOM.createRoot(
  document.getElementById("confidence-root") as HTMLElement,
).render(
  <React.StrictMode>
    <ConfidenceMonitor />
  </React.StrictMode>,
)
