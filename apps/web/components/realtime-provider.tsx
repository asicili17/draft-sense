"use client";

import { RealtimeProvider } from "@upstash/realtime/client";

export function DraftRealtimeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RealtimeProvider api={{ url: "/api/v1/realtime", withCredentials: true }} maxReconnectAttempts={8}>
      {children}
    </RealtimeProvider>
  );
}
