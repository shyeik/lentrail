// src/components/NotificationBell.tsx

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

interface Notification {
  _id: string;
  type: "RENEWAL" | "EXTENSION" | "SUKLILOAN";
  message: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_STYLE: Record<string, string> = {
  RENEWAL: "bg-green-100 text-green-700",
  EXTENSION: "bg-blue-100 text-blue-700",
  SUKLILOAN: "bg-purple-100 text-purple-700",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const token = localStorage.getItem("token");
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      await axios.post(
        `${BACKEND_URL}/api/notifications/generate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const res = await axios.get(`${BACKEND_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return res.data as Notification[];
    },
    refetchInterval: 60_000,
  });

  const unreadCount = data?.filter((n) => !n.isRead).length ?? 0;

  const markAllRead = useMutation({
    mutationFn: async () => {
      await axios.patch(
        `${BACKEND_URL}/api/notifications/mark/all-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative w-9 h-9 rounded-sm bg-[#ffffff25] text-[#111827] flex items-center justify-center text-sm"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#e53935] text-white text-[10px] flex items-center justify-center font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-[#E5E7EB] shadow-xl rounded-sm z-50 overflow-hidden">
          <div className="px-4 py-3 border-b bg-[#F9FAFB] flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-[#111827]">Notifications</p>
              <p className="text-[11px] text-[#9CA3AF]">
                Loan availability alerts
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-[11px] text-[#e53935] font-semibold hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-auto">
            {!data || data.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-[#9CA3AF]">
                No notifications yet.
              </p>
            ) : (
              data.map((n) => (
                <div
                  key={n._id}
                  className={`px-4 py-3 border-b border-[#F3F4F6] ${
                    n.isRead ? "bg-white" : "bg-[#FFFBEB]"
                  }`}
                >
                  <div className="flex justify-between gap-3">
                    <p className="text-xs text-[#374151] leading-relaxed">
                      {n.message}
                    </p>

                    <span
                      className={`h-fit px-2 py-0.5 rounded-sm text-[9px] font-bold ${TYPE_STYLE[n.type]}`}
                    >
                      {n.type === "SUKLILOAN" ? "SUKLI" : n.type}
                    </span>
                  </div>

                  <p className="text-[10px] text-[#9CA3AF] mt-1">
                    {new Date(n.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
