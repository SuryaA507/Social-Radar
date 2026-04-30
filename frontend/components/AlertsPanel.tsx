"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "@/components/Icons";

interface AlertData {
  id: string;
  keyword: string;
  country: string;
  severity: string;
  delta: number;
  message: string;
  timestamp: string;
}

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
        const res = await fetch(`${apiBase}/api/alerts/live`);
        if (res.ok) {
          const data = await res.json();
          setAlerts(data.alerts || []);
        }
      } catch (e) {
        console.error("Failed to fetch alerts", e);
      }
    };
    fetchAlerts();
    const id = setInterval(fetchAlerts, 15000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 border border-danger/30 text-danger shadow-[0_0_20px_rgba(255,107,107,0.2)] hover:bg-danger/20 hover:scale-105 transition-all"
      >
        <AlertTriangle className="h-6 w-6 animate-pulse" />
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white shadow-lg">
            {alerts.length}
          </span>
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-in Panel */}
      <div 
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm transform bg-background/95 backdrop-blur-xl border-l border-card-border shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-card-border/50 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-danger" />
              <h2 className="text-lg font-bold tracking-wider uppercase">Active Alerts</h2>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-muted hover:text-foreground text-sm uppercase tracking-widest"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {alerts.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-muted">
                <Clock className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No active alerts</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={`relative overflow-hidden rounded-xl border bg-card p-4 shadow-lg ${
                    alert.severity === 'critical' ? 'border-danger/30 bg-danger/5' : 
                    alert.severity === 'high' ? 'border-amber-glow/30 bg-amber-glow/5' : 
                    'border-cyan-glow/30 bg-cyan-glow/5'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      alert.severity === 'critical' ? 'bg-danger/20 text-danger' : 
                      alert.severity === 'high' ? 'bg-amber-glow/20 text-amber-glow' : 
                      'bg-cyan-glow/20 text-cyan-glow'
                    }`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(alert.timestamp)}
                    </span>
                  </div>
                  <p className="mb-3 text-sm text-foreground/90 font-medium leading-relaxed">
                    {alert.message}
                  </p>
                  <div className="flex items-center justify-between border-t border-card-border/30 pt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">Trending in:</span>
                      <span className="text-xs font-semibold text-foreground bg-white/5 px-2 py-1 rounded">
                        {alert.country}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-green-glow">
                      <span>+{alert.delta} pts</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
