"use client";

import { Navbar } from "@/components/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-background">
        <Navbar pageTitle="My Projects" backUrl="/" />
      </div>
      <div className="pt-28">{children}</div>
    </>
  );
}
