"use client";

import { ReactNode } from "react";
import { useTheme } from "next-themes";

interface GradientBorderWrapperProps {
  children: ReactNode;
  isActive: boolean;
}

export function GradientBorderWrapper({
  children,
  isActive,
}: GradientBorderWrapperProps) {
  const { theme } = useTheme();
  const bgColor = theme === "light" ? "#ffffff" : "#18181b";

  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative p-[2px] rounded-xl h-full"
      style={
        {
          "--gradient-angle": "0deg",
          background: `conic-gradient(from var(--gradient-angle), #6366f1, #ec4899, ${bgColor}, ${bgColor}, #6366f1)`,
          animation: "gradient-rotate 3s linear infinite",
        } as React.CSSProperties
      }
    >
      <div className="h-full rounded-[10px] overflow-hidden bg-content1">
        {children}
      </div>
      <style jsx>{`
        @keyframes gradient-rotate {
          0% {
            --gradient-angle: 0deg;
          }
          100% {
            --gradient-angle: 360deg;
          }
        }
        @property --gradient-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
      `}</style>
    </div>
  );
}
