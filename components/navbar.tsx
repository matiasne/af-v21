"use client";

import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Button } from "@heroui/button";
import { Kbd } from "@heroui/kbd";
import { Link } from "@heroui/link";
import { Input } from "@heroui/input";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Avatar } from "@heroui/avatar";
import NextLink from "next/link";
import { useRouter } from "next/navigation";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { SearchIcon } from "@/components/icons";
import { useAuth } from "@/infrastructure/context/AuthContext";

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
  const { user, loading, signOut } = useAuth();

  return (
    <HeroUINavbar maxWidth="xl" position="sticky">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        {pageTitle ? (
          <div className="flex items-center gap-3">
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
        ) : (
          <NavbarBrand as="li" className="gap-3 max-w-fit">
            <NextLink
              className="flex justify-start items-center gap-1"
              href="/"
            >
              <p className="font-bold text-inherit">{siteConfig.name}</p>
            </NextLink>
          </NavbarBrand>
        )}
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <ThemeSwitch />
        </NavbarItem>
        <NavbarItem className="hidden md:flex">
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
              <DropdownMenu aria-label="Profile Actions" variant="flat">
                <DropdownItem key="profile" className="h-14 gap-2">
                  <p className="font-semibold">Signed in as</p>
                  <p className="font-semibold">{user.email}</p>
                </DropdownItem>
                <DropdownItem key="dashboard" href="/dashboard" as={NextLink}>
                  Dashboard
                </DropdownItem>
                <DropdownItem key="logout" color="danger" onPress={signOut}>
                  Log Out
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          ) : (
            <div className="flex gap-2">
              <Button as={NextLink} href="/login" variant="flat" size="sm">
                Login
              </Button>
              <Button
                as={NextLink}
                href="/signup"
                color="primary"
                variant="solid"
                size="sm"
              >
                Sign Up
              </Button>
            </div>
          )}
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link
                color={
                  index === 2
                    ? "primary"
                    : index === siteConfig.navMenuItems.length - 1
                      ? "danger"
                      : "foreground"
                }
                href="#"
                size="lg"
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
