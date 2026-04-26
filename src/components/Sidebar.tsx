import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const location = useLocation();

  const menu = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Clients", path: "/clients" },
    { name: "Loans", path: "/loans" },
    { name: "Reports", path: "/reports" },
  ];

  return (
    <div className="w-60 bg-[#000000] text-white flex flex-col p-5">
      {/* Logo */}
      <div className="mb-10">
        <h1 className="text-xl font-bold text-[#F4C430] tracking-wide">
          LENTRAIL
        </h1>
        <p className="text-xs text-white/50">Loan System</p>
      </div>

      {/* Menu */}
      <div className="flex flex-col gap-2">
        {menu.map((item) => {
          const active = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`px-4 py-2 rounded text-sm transition
                ${
                  active
                    ? "bg-[#F4C430] text-black font-semibold"
                    : "hover:bg-white/10 text-white/80"
                }`}
            >
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-96 text-xs text-white/30">© 2026 LENTRAIL</div>
    </div>
  );
}
