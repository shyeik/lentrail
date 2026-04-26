import { useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";

export default function Topbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      {/* Title */}
      <h2 className="text-lg font-semibold text-[#0D1B2A]">Dashboard</h2>

      {/* Right */}

      <div className="flex items-center gap-4">
        <NotificationBell />
        <span className="text-sm text-gray-600">Admin</span>

        <button
          onClick={handleLogout}
          className="bg-[#B11226] text-white px-3 py-1.5 rounded text-sm hover:bg-[#8E0F1F] transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
