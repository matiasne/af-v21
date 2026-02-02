"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Avatar } from "@heroui/avatar";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTheme } from "next-themes";

import { ThemeSwitch } from "@/components/theme-switch";
import { useAuth } from "@/infrastructure/context/AuthContext";
import { SetPasswordModal } from "@/components/SetPasswordModal";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface NavbarProps {
  pageTitle?: string | null;
  projectName?: string | null;
  backUrl?: string | null;
  breadcrumbs?: BreadcrumbItem[];
}

export const Navbar = ({ pageTitle, projectName, backUrl, breadcrumbs }: NavbarProps = {}) => {
  const router = useRouter();
  const { user, loading, signOut, setPassword, hasPasswordProvider } = useAuth();
  const [isSetPasswordModalOpen, setIsSetPasswordModalOpen] = useState(false);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showSetPasswordOption = user && !hasPasswordProvider();

  return (
    <div className="w-full border-b border-divider">
      <div className="max-w-7xl mx-auto px-6">
        {/* Primera fila: Logo y controles */}
        <div className="flex items-center justify-between py-3">
          <NextLink href="/">
            {mounted ? (
              <Image
                src={theme === "dark" ? "/echo-logo-wh.svg" : "/echo-logo-bl.svg"}
                alt="Echo Logo"
                width={120}
                height={33}
                priority
              />
            ) : (
              <div style={{ width: 120, height: 33 }} />
            )}
          </NextLink>

          <div className="flex items-center gap-4">
            <ThemeSwitch />
            {loading ? null : user ? (
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Avatar
                    isBordered
                    as="button"
                    className="transition-transform"
                    color="primary"
                    name={user.displayName || user.email || "User"}
                    size="sm"
                    src={user.photoURL || undefined}
                  />
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Profile Actions"
                  variant="flat"
                  onAction={(key) => {
                    if (key === "set-password") {
                      setIsSetPasswordModalOpen(true);
                    } else if (key === "logout") {
                      signOut();
                    }
                  }}
                >
                  <DropdownItem key="profile" className="h-14 gap-2" textValue="Profile">
                    <p className="font-semibold">Signed in as</p>
                    <p className="font-semibold">{user.email}</p>
                  </DropdownItem>
                  <DropdownItem key="dashboard" href="/dashboard" as={NextLink}>
                    Dashboard
                  </DropdownItem>
                  <DropdownItem
                    key="set-password"
                    className={showSetPasswordOption ? "" : "hidden"}
                  >
                    Set Password
                  </DropdownItem>
                  <DropdownItem key="logout" color="danger">
                    Log Out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : null}
          </div>
        </div>

        {/* Segunda fila: Back y título del proyecto */}
        {pageTitle && (
          <div className="flex items-center gap-3 pb-3">
            {backUrl && (
              <Button
                variant="light"
                size="sm"
                onPress={() => router.push(backUrl)}
              >
                ← Back
              </Button>
            )}
            <div className="flex items-center gap-2">
              {breadcrumbs && breadcrumbs.length > 0 ? (
                <>
                  {breadcrumbs.map((crumb, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {crumb.href ? (
                        <Link
                          as={NextLink}
                          href={crumb.href}
                          className="text-sm text-default-500 hover:text-default-700"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-sm text-default-500">{crumb.label}</span>
                      )}
                      {index < breadcrumbs.length - 1 && (
                        <span className="text-sm text-default-400">&gt;</span>
                      )}
                    </div>
                  ))}
                  <span className="text-sm text-default-400">&gt;</span>
                  <h1 className="text-lg font-semibold">{pageTitle}</h1>
                </>
              ) : (
                <>
                  {projectName && projectName !== pageTitle && (
                    <>
                      <span className="text-lg text-default-500">{projectName}</span>
                      <span className="text-lg text-default-400">&gt;</span>
                    </>
                  )}
                  <h1 className="text-xl font-semibold">{pageTitle}</h1>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Set Password Modal */}
      <SetPasswordModal
        isOpen={isSetPasswordModalOpen}
        onOpenChange={setIsSetPasswordModalOpen}
        onSetPassword={setPassword}
      />

    </div>
  );
};
