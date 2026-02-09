"use client";

import { useState, useEffect } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Avatar } from "@heroui/avatar";
import NextLink from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjectChatSafe } from "@/infrastructure/context/ProjectChatContext";
import { SetPasswordModal } from "@/components/SetPasswordModal";

export const Navbar = () => {
  const { user, loading, signOut, setPassword, hasPasswordProvider } =
    useAuth();
  const projectChatContext = useProjectChatSafe();
  const projectContext = projectChatContext?.projectContext;
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
                priority
                alt="Echo Logo"
                height={33}
                src={
                  theme === "dark" ? "/echo-logo-wh.svg" : "/echo-logo-bl.svg"
                }
                width={120}
              />
            ) : (
              <div style={{ width: 120, height: 33 }} />
            )}
          </NextLink>

          <div className="flex items-center gap-4">
            {projectContext?.name && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-default-500">/</span>
                <span className="text-sm font-medium text-default-700">
                  {projectContext.name}
                </span>
              </div>
            )}
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
                  <DropdownItem
                    key="profile"
                    className="h-14 gap-2"
                    textValue="Profile"
                  >
                    <p className="font-semibold">Signed in as</p>
                    <p className="font-semibold">{user.email}</p>
                  </DropdownItem>
                  <DropdownItem key="dashboard" as={NextLink} href="/dashboard">
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
