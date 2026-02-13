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

interface SetPasswordModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSetPassword: (password: string) => Promise<void>;
}

export function SetPasswordModal({
  isOpen,
  onOpenChange,
  onSetPassword,
}: SetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");

      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");

      return;
    }

    setIsLoading(true);
    try {
      await onSetPassword(password);
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof Error) {
        // Handle Firebase specific errors
        if (err.message.includes("provider-already-linked")) {
          setError("You already have a password set for this account");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to set password. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
    onOpenChange(false);
  };

  return (
    <Modal isOpen={isOpen} size="md" onOpenChange={handleClose}>
      <ModalContent>
        <ModalHeader>
          <h2 className="text-xl font-bold">Set Password</h2>
        </ModalHeader>
        <ModalBody>
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <svg
                className="w-16 h-16 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
              <p className="text-center text-default-700">
                Password set successfully! You can now sign in with your email
                and password.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-default-500">
                Set a password to enable email/password login for your account.
                This allows you to sign in without using Google.
              </p>

              <Input
                isDisabled={isLoading}
                label="New Password"
                minLength={6}
                placeholder="Enter your new password"
                type="password"
                value={password}
                onValueChange={setPassword}
              />

              <Input
                isDisabled={isLoading}
                label="Confirm Password"
                minLength={6}
                placeholder="Confirm your new password"
                type="password"
                value={confirmPassword}
                onValueChange={setConfirmPassword}
              />

              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {success ? (
            <Button color="primary" onPress={handleClose}>
              Done
            </Button>
          ) : (
            <>
              <Button
                isDisabled={isLoading}
                variant="flat"
                onPress={handleClose}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                isDisabled={!password || !confirmPassword}
                isLoading={isLoading}
                onPress={handleSubmit}
              >
                Set Password
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
