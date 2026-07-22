import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../teams-call.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
