import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { DraftRealtimeProvider } from "../components/realtime-provider";
export const metadata: Metadata = {
  title: "DraftSense",
  description: "Real-time fantasy draft recommendations",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <DraftRealtimeProvider>{children}</DraftRealtimeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
