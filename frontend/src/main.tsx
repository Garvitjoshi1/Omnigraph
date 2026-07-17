import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { DashboardProvider } from "./dashboardContext";
import { ThemeProvider } from "./themeContext";

createRoot(document.getElementById("root")!).render(<StrictMode><ThemeProvider><DashboardProvider><App /></DashboardProvider></ThemeProvider></StrictMode>);
