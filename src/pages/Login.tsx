import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
const API = import.meta.env.VITE_BACKEND_URL;

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // 🔥 AUTO REDIRECT IF LOGGED IN
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard");
    }
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Please enter your credentials.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}api/login`, {
        username,
        password,
      });
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Invalid credentials. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen flex font-serif bg-[#000000]">
      {/* Left brand panel */}
      <div className="w-[42%] bg-[#fbff03] flex flex-col justify-between p-12 relative overflow-hidden">
        {/* Geometric accent circles */}
        <div className="absolute -top-15 -right-15 w-64 h-64 rounded-full border border-[#C4A365]/15 pointer-events-none" />
        <div className="absolute -top-5 -right-5 w-44 h-44 rounded-full border border-[#C4A365]/10 pointer-events-none" />
        <div className="absolute bottom-20 -left-10 w-48 h-48 rounded-full border border-[#C4A365]/8 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#000000] flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="2" width="8" height="8" fill="#0D1B2A" />
              <rect
                x="12"
                y="2"
                width="8"
                height="8"
                fill="#0D1B2A"
                opacity="0.5"
              />
              <rect
                x="2"
                y="12"
                width="8"
                height="8"
                fill="#0D1B2A"
                opacity="0.5"
              />
              <rect x="12" y="12" width="8" height="8" fill="#0D1B2A" />
            </svg>
          </div>
          <div>
            <div className="text-[#ff0000] text-lg font-semibold tracking-widest font-serif leading-tight">
              LENTRAIL
            </div>
            <div className="text-[#000000] text-[10px] tracking-[0.2em] font-sans font-normal uppercase">
              Loan Tracker
            </div>
          </div>
        </div>

        {/* Center copy */}
        <div>
          <div className="w-8 h-px bg-[rgb(255,0,0)] mb-8" />
          <p className="text-[#ff0000] text-[28px] leading-[1.35] font-normal tracking-tight mb-5 font-serif">
            Manage every
            <br />
            loan with
            <br />
            clarity.
          </p>
          <p className="text-[#000000] text-[13px] leading-[1.7] font-sans max-w-65">
            A complete lending tracker built for professionals who value
            precision and accountability.
          </p>
        </div>

        {/* Footer */}
        <div className="text-[#000000] text-[11px] tracking-[0.06em] font-sans">
          © 2026 LENTRAIL. ALL RIGHTS RESERVED.
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-95">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-[26px] font-normal text-[#ffe603] tracking-tight mb-1.5 font-serif">
              Welcome back
            </h1>
            <p className="text-[#ffffff] text-sm font-sans leading-relaxed">
              Sign in to your account to continue
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 border-l-[3px] border-l-red-600 rounded px-3.5 py-2.5 mb-5 text-red-800 text-[13px] font-sans">
              {error}
            </div>
          )}

          {/* Form */}
          <div className="flex flex-col gap-[1.1rem]">
            {/* Username */}
            <div>
              <label className="block text-[11px] font-semibold tracking-widest text-[#0D1B2A] font-sans uppercase mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your username"
                className="w-full px-3.5 py-3 border border-[#DDDDD5] rounded text-sm font-sans text-[#0D1B2A] bg-white outline-none transition-colors duration-150 focus:border-[#C4A365] placeholder:text-[#8A8A80]"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-semibold tracking-widest text-[#0D1B2A] font-sans uppercase">
                  Password
                </label>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your password"
                className="w-full px-3.5 py-3 border border-[#DDDDD5] rounded text-sm font-sans text-[#0D1B2A] bg-white outline-none transition-colors duration-150 focus:border-[#C4A365] placeholder:text-[#8A8A80]"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className={`w-full py-3.5 text-white rounded text-xs font-semibold tracking-[0.12em] font-sans uppercase mt-2 transition-colors duration-150
                ${
                  loading
                    ? "bg-[#ff0c0c] cursor-not-allowed"
                    : "bg-[#ff0404b4] hover:bg-[#fe0505] cursor-pointer"
                }`}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-[#DDDDD5]" />
            <span className="text-[11px] text-[#8A8A80] font-sans tracking-[0.05em]">
              SECURE ACCESS
            </span>
            <div className="flex-1 h-px bg-[#DDDDD5]" />
          </div>

          {/* Trust badges */}
        </div>
      </div>
    </div>
  );
}
