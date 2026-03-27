import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Send,
  Globe,
  Settings as SettingsIcon,
  Radio,
} from "lucide-react";
import { Dashboard } from "./pages/Dashboard";
import { Posts } from "./pages/Posts";
import { Publish } from "./pages/Publish";
import { Platforms } from "./pages/Platforms";
import { Settings } from "./pages/Settings";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/posts", icon: FileText, label: "Posts" },
  { to: "/publish", icon: Send, label: "Publish" },
  { to: "/platforms", icon: Globe, label: "Platforms" },
  { to: "/settings", icon: SettingsIcon, label: "Settings" },
];

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-gray-100">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Radio size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">BlogCast</span>
          </Link>
          <p className="text-xs text-gray-400 mt-1 ml-10">v1.0.0</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Powered by{" "}
            <a
              href="https://notion.so"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600"
            >
              Notion
            </a>{" "}
            &amp;{" "}
            <a
              href="https://claude.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600"
            >
              Claude
            </a>
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/platforms" element={<Platforms />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
