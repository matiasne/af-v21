"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";

import { ProjectShare, ProjectRole } from "@/domain/entities/Project";

interface ShareProjectModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  currentShares: ProjectShare[];
  onShare: (email: string, role: ProjectRole) => Promise<void>;
  onUnshare: (userId: string) => Promise<void>;
  onUpdateRole: (userId: string, role: ProjectRole) => Promise<void>;
}

const ROLE_OPTIONS: { value: ProjectRole; label: string; description: string }[] = [
  {
    value: "viewer",
    label: "Viewer",
    description: "Can view the project but cannot make changes",
  },
  {
    value: "editor",
    label: "Editor",
    description: "Can view and edit the project",
  },
  {
    value: "owner",
    label: "Owner",
    description: "Full access including sharing and deletion",
  },
];

export function ShareProjectModal({
  isOpen,
  onOpenChange,
  projectName,
  currentShares,
  onShare,
  onUnshare,
  onUpdateRole,
}: ShareProjectModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("viewer");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Check if already shared
    if (currentShares.some(share => share.email === email)) {
      setError("This user already has access to the project");
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      await onShare(email, role);
      setEmail("");
      setRole("viewer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share project");
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async (userId: string) => {
    try {
      await onUnshare(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove access");
    }
  };

  const handleRoleChange = async (userId: string, newRole: ProjectRole) => {
    try {
      await onUpdateRole(userId, newRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const getRoleColor = (roleValue: ProjectRole) => {
    switch (roleValue) {
      case "owner":
        return "primary";
      case "editor":
        return "secondary";
      case "viewer":
        return "default";
      default:
        return "default";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Share Project</h3>
              <p className="text-sm text-default-500 font-normal">
                {projectName}
              </p>
            </ModalHeader>
            <ModalBody>
              {/* Add new share */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    label="Email address"
                    placeholder="user@example.com"
                    value={email}
                    onValueChange={setEmail}
                    isDisabled={isSharing}
                    className="flex-1"
                  />
                  <Select
                    label="Role"
                    selectedKeys={[role]}
                    onChange={(e) => setRole(e.target.value as ProjectRole)}
                    isDisabled={isSharing}
                    className="w-40"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </Select>
                  <Button
                    color="primary"
                    onPress={handleShare}
                    isDisabled={isSharing || !email.trim()}
                    className="self-end"
                  >
                    {isSharing ? <Spinner size="sm" color="white" /> : "Share"}
                  </Button>
                </div>

                {error && (
                  <div className="text-sm text-danger-500">{error}</div>
                )}

                {/* Role descriptions */}
                <div className="bg-default-100 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">Access Levels:</p>
                  {ROLE_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-start gap-2">
                      <Chip
                        size="sm"
                        color={getRoleColor(option.value)}
                        variant="flat"
                      >
                        {option.label}
                      </Chip>
                      <p className="text-xs text-default-600">
                        {option.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Current shares */}
              <div className="space-y-3 mt-6">
                <h4 className="text-sm font-semibold">People with access</h4>
                {currentShares.length === 0 ? (
                  <p className="text-sm text-default-400">
                    No one else has access to this project yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {currentShares.map((share) => (
                      <div
                        key={share.userId}
                        className="flex items-center justify-between p-3 rounded-lg bg-default-50 hover:bg-default-100 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{share.email}</p>
                          <p className="text-xs text-default-400">
                            Shared on{" "}
                            {new Date(share.sharedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            size="sm"
                            selectedKeys={[share.role]}
                            onChange={(e) =>
                              handleRoleChange(
                                share.userId,
                                e.target.value as ProjectRole
                              )
                            }
                            className="w-32"
                            aria-label="Change role"
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            onPress={() => handleUnshare(share.userId)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="default" variant="light" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
