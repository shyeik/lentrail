import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children }: any) {
  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar (fixed) */}
      <div className="w-60 bg-[#0D1B2A] text-white shrink-0">
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Topbar (fixed) */}
        <div className="h-14 shrink-0">
          <Topbar />
        </div>

        {/* Content (ONLY THIS SCROLLS 🔥) */}
        <div className="flex-1 overflow-y-auto bg-[#0D1B2A] ">{children}</div>
      </div>
    </div>
  );
}
