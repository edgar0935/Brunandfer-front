// src/App.tsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import "@/App.css";

export default function App() {
  const { pathname } = useLocation();
  const hideSidebar = pathname === "/login";

  return (
    <div className="dashboard-container">
      {!hideSidebar && <Sidebar />}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
