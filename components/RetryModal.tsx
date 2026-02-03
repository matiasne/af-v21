"use client";

import { useState } from "react";
import { Button } from "@heroui/button";

interface RetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void | Promise<void>;
  title?: string;
  message?: string;
  isLoading?: boolean;
}

export default function RetryModal({
  isOpen,
  onClose,
  onRetry,
  title = "Connection interrupted",
  message,
  isLoading = false,
}: RetryModalProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const loading = isLoading || isRetrying;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-[#E8E4F0]/60 dark:bg-black/40 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal Card */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-content1 shadow-2xl"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Gradient border effect at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-2 rounded-b-3xl"
          style={{
            background: "linear-gradient(90deg, #FEF3C7 0%, #FDE68A 30%, #FDBA74 70%, #FCA5A5 100%)",
          }}
        />

        {/* Content */}
        <div className="p-6 pb-8">
          {loading ? (
            // Loading state
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-amber-500 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Reconnecting...
              </h3>
              <p className="text-sm text-default-500">
                Please wait while we restore the connection.
              </p>
              <p className="text-sm text-default-500 mt-1">
                Your data is safe.
              </p>
            </div>
          ) : (
            // Error state
            <>
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                    />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-semibold text-center text-foreground mb-2">
                Connection interrupted
              </h3>

              {/* Friendly message */}
              <p className="text-center text-default-500 text-sm mb-4">
                The connection was temporarily interrupted. Your data is safe, and no changes were lost.
              </p>

              {/* Data safety badge */}
              <div className="flex justify-center mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">Your progress is saved</span>
                </div>
              </div>

              {/* Technical details (collapsible look) */}
              {message && (
                <div className="mb-5 p-3 bg-default-50 dark:bg-default-100/50 rounded-xl border border-default-200 dark:border-default-100">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-default-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs text-default-500 mb-1">Technical details</p>
                      <p className="text-xs text-default-600 dark:text-default-400 font-mono leading-relaxed">
                        {message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action button */}
              <Button
                color="warning"
                variant="flat"
                onPress={handleRetry}
                className="w-full rounded-xl font-medium"
                size="lg"
                startContent={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                }
              >
                Try Again
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
