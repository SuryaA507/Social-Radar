"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "@/components/Icons";

interface AlertData {
  id: string;
  keyword: string;
  country: string;
  severity: string;
  delta: number;
  message: string;
}

export default function AlertTicker() {
  const [alerts, setAlerts] = useState<AlertData[]>([]);

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
    const id = setInterval(fetchAlerts, 15000); // Check every 15s
    return () => clearInterval(id);
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="w-full bg-danger/5 border-b border-danger/20 overflow-hidden relative flex items-center h-8">
      <div className="absolute left-0 top-0 bottom-0 z-10 w-24 bg-gradient-to-r from-[rgba(3,10,16,1)] to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 z-10 w-24 bg-gradient-to-l from-[rgba(3,10,16,1)] to-transparent pointer-events-none" />
      
      <div className="flex animate-[marquee_30s_linear_infinite] whitespace-nowrap">
        {alerts.map((alert, i) => (
          <div key={`${alert.id}-${i}`} className="flex items-center gap-2 mx-8 text-xs font-semibold tracking-wider">
            <AlertTriangle className={`h-3 w-3 ${alert.severity === 'critical' ? 'text-danger' : alert.severity === 'high' ? 'text-amber-glow' : 'text-cyan-glow'}`} />
            <span className={alert.severity === 'critical' ? 'text-danger' : alert.severity === 'high' ? 'text-amber-glow' : 'text-cyan-glow'}>
              [{alert.severity.toUpperCase()}]
            </span>
            <span className="text-foreground">{alert.message}</span>
            <span className="text-muted">(+{alert.delta})</span>
          </div>
        ))}
        {/* Duplicate for seamless looping */}
        {alerts.map((alert, i) => (
          <div key={`dup-${alert.id}-${i}`} className="flex items-center gap-2 mx-8 text-xs font-semibold tracking-wider">
            <AlertTriangle className={`h-3 w-3 ${alert.severity === 'critical' ? 'text-danger' : alert.severity === 'high' ? 'text-amber-glow' : 'text-cyan-glow'}`} />
            <span className={alert.severity === 'critical' ? 'text-danger' : alert.severity === 'high' ? 'text-amber-glow' : 'text-cyan-glow'}>
              [{alert.severity.toUpperCase()}]
            </span>
            <span className="text-foreground">{alert.message}</span>
            <span className="text-muted">(+{alert.delta})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
