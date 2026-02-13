"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";
import Image from "next/image";

import { useAuth } from "@/infrastructure/context/AuthContext";
import Threads from "@/components/Threads";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const navigateWithAnimation = () => {
    setExiting(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      navigateWithAnimation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      await signInWithGoogle();
      navigateWithAnimation();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sign in with Google",
      );
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen flex flex-col justify-center items-center">
      <Threads
        enableMouseInteraction
        amplitude={2}
        color={[0.5, 0.3, 1]}
        distance={0.3}
      />
      <div
        className={`relative z-10 mb-6 transition-all duration-500 ease-out ${
          exiting
            ? "opacity-0 translate-y-8"
            : mounted
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-12"
        }`}
      >
        <Image
          priority
          alt="Echo Logo"
          className="dark:invert"
          height={54}
          src="/echo-logo-bl.svg"
          width={180}
        />
      </div>
      <Card
        className={`relative z-10 w-full max-w-md transition-all duration-500 ease-out ${
          exiting
            ? "opacity-0 translate-y-8 scale-95"
            : mounted
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-12 scale-95"
        }`}
      >
        <CardHeader className="flex flex-col gap-1 px-6 pt-6">
          <h1 className="text-2xl font-bold">Login</h1>
          <p className="text-default-500">Sign in to your account</p>
        </CardHeader>
        <CardBody className="px-6 py-4">
          <form className="flex flex-col gap-4" onSubmit={handleEmailLogin}>
            {error && (
              <div className="p-3 text-sm text-danger bg-danger-50 rounded-lg">
                {error}
              </div>
            )}

            <Input
              isRequired
              label="Email"
              placeholder="Enter your email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              isRequired
              label="Password"
              placeholder="Enter your password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button
              className="w-full"
              color="primary"
              isLoading={loading}
              type="submit"
            >
              Sign In
            </Button>
          </form>

          <div className="flex items-center gap-4 my-4">
            <Divider className="flex-1" />
            <span className="text-default-500 text-sm">or</span>
            <Divider className="flex-1" />
          </div>

          <Button
            className="w-full"
            isLoading={loading}
            startContent={
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="currentColor"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="currentColor"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="currentColor"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="currentColor"
                />
              </svg>
            }
            variant="bordered"
            onPress={handleGoogleLogin}
          >
            Continue with Google
          </Button>

          <p className="text-center text-sm mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/signup" size="sm">
              Sign up
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
