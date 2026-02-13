"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@heroui/link";
import { button as buttonStyles } from "@heroui/theme";
import { Spinner } from "@heroui/spinner";
import Image from "next/image";

import { title } from "@/components/primitives";
import { useAuth } from "@/infrastructure/context/AuthContext";
import Threads from "@/components/Threads";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10 min-h-[60vh]">
        <Spinner size="lg" />
      </section>
    );
  }

  // If user is logged in, show loading while redirecting
  if (user) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10 min-h-[60vh]">
        <Spinner size="lg" />
        <p className="text-default-500">Redirecting to dashboard...</p>
      </section>
    );
  }

  return (
    <section className="fixed inset-0 w-screen h-screen flex flex-col items-center justify-center gap-4">
      <Threads
        enableMouseInteraction
        amplitude={2}
        color={[0.5, 0.3, 1]}
        distance={0.3}
      />
      <div className="relative z-10 mb-6">
        <Image
          priority
          alt="Echo Logo"
          className="dark:invert"
          height={60}
          src="/echo-logo-bl.svg"
          width={200}
        />
      </div>
      <div className="relative z-10 inline-block max-w-xl text-center justify-center">
        <span className={title()}>Agentic&nbsp;</span>
        <span className={title({ color: "violet" })}>Framework&nbsp;</span>
        <br />
      </div>

      <div className="relative z-10 flex gap-3">
        <Link
          className={buttonStyles({
            color: "primary",
            radius: "full",
            variant: "shadow",
          })}
          href="/login"
        >
          Login
        </Link>
      </div>
    </section>
  );
}
