"use client";

import { useEffect } from "react";

import { setMonitoringUser } from "@/lib/monitoring/report";

// Associa os erros do navegador ao usuário logado (só id e perfil).
export function MonitoringUser({ id, role }: { id: string; role: string }) {
  useEffect(() => {
    setMonitoringUser({ id, role });
    return () => setMonitoringUser(null);
  }, [id, role]);

  return null;
}
