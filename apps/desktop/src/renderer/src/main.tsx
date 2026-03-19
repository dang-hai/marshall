import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { OverlayPillApp } from "./OverlayPillApp";
import "./styles/globals.css";

const queryClient = new QueryClient();
const searchParams = new URLSearchParams(window.location.search);
const isOverlayWindow = searchParams.get("overlay") === "pill";

if (isOverlayWindow) {
  document.documentElement.classList.add("overlay-window");
  document.body.classList.add("overlay-window");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isOverlayWindow ? (
      <OverlayPillApp />
    ) : (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )}
  </React.StrictMode>
);
