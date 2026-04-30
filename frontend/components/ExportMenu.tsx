"use client";

import { useState } from "react";
import { Download } from "@/components/Icons";

interface ExportMenuProps {
  type: "live" | "historical";
  date?: string;
}

export default function ExportMenu({ type, date }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = (format: "csv" | "pdf") => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
    let url = `${apiBase}/api/export/${format}?type=${type}`;
    if (date) {
      url += `&date=${encodeURIComponent(date)}`;
    }
    window.open(url, "_blank");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-cyan-glow/30 bg-cyan-glow/10 px-4 py-2 text-xs uppercase tracking-[0.14em] text-cyan-glow hover:bg-cyan-glow/20 transition-colors"
      >
        <Download className="h-4 w-4" />
        Export
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-36 rounded-xl border border-card-border bg-[rgba(10,22,31,0.95)] backdrop-blur-xl shadow-2xl overflow-hidden fade-up">
            <button
              onClick={() => handleExport("csv")}
              className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-white/5 transition-colors border-b border-white/5 uppercase tracking-wider font-semibold text-xs"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport("pdf")}
              className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-white/5 transition-colors uppercase tracking-wider font-semibold text-xs"
            >
              Export PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
