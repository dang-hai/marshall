import React from "react";
import ReactDOM from "react-dom/client";
import { LegalPage } from "./legal-page";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <LegalPage sectionId="privacy" />
  </React.StrictMode>
);
