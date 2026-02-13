"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

import { useAuth } from "../context/AuthContext";
import { FirebaseUserSettingsRepository } from "../repositories/FirebaseUserSettingsRepository";

import {
  UserSettings,
  CardSettings,
  CardSize,
  DEFAULT_CARD_ORDER,
} from "@/domain/entities/UserSettings";

export function useUserSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const settingsRepository = useMemo(
    () => new FirebaseUserSettingsRepository(),
    [],
  );

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);

      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userSettings = await settingsRepository.getUserSettings(user.uid);

      // Migrate old settings that don't have size property
      if (userSettings?.projectDashboard?.cardOrder) {
        const migratedCardOrder = userSettings.projectDashboard.cardOrder.map(
          (card) => ({
            ...card,
            size: card.size || "medium",
          }),
        );

        userSettings.projectDashboard.cardOrder = migratedCardOrder;
      }

      setSettings(userSettings);
    } catch (err) {
      console.error("Error fetching user settings:", err);
      setError("Failed to load settings");
      // Use default settings on error
      setSettings({
        userId: user.uid,
        projectDashboard: {
          cardOrder: DEFAULT_CARD_ORDER,
        },
        updatedAt: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  }, [user, settingsRepository]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateCardOrder = useCallback(
    async (cardOrder: CardSettings[]) => {
      if (!user || !settings) return;

      // Optimistic update
      const newSettings: UserSettings = {
        ...settings,
        projectDashboard: {
          ...settings.projectDashboard,
          cardOrder,
        },
        updatedAt: Date.now(),
      };

      setSettings(newSettings);

      try {
        await settingsRepository.updateProjectDashboardSettings(user.uid, {
          cardOrder,
        });
      } catch (err) {
        console.error("Error updating card order:", err);
        setError("Failed to save card order");
        // Revert on error
        fetchSettings();
      }
    },
    [user, settings, settingsRepository, fetchSettings],
  );

  const toggleCardPin = useCallback(
    async (cardId: string) => {
      if (!user || !settings) return;

      const currentOrder = settings.projectDashboard.cardOrder;
      const cardIndex = currentOrder.findIndex((c) => c.id === cardId);

      if (cardIndex === -1) return;

      const updatedOrder = [...currentOrder];
      const card = updatedOrder[cardIndex];
      const newPinnedState = !card.pinned;

      updatedOrder[cardIndex] = { ...card, pinned: newPinnedState };

      // Reorder: pinned cards at the top, maintaining relative order
      const pinnedCards = updatedOrder
        .filter((c) => c.pinned)
        .sort((a, b) => a.order - b.order);
      const unpinnedCards = updatedOrder
        .filter((c) => !c.pinned)
        .sort((a, b) => a.order - b.order);

      const reorderedCards = [...pinnedCards, ...unpinnedCards].map(
        (card, index) => ({
          ...card,
          order: index,
        }),
      );

      await updateCardOrder(reorderedCards);
    },
    [user, settings, updateCardOrder],
  );

  const updateCardSize = useCallback(
    async (cardId: string, size: CardSize) => {
      if (!user || !settings) return;

      const currentOrder = settings.projectDashboard.cardOrder;
      const cardIndex = currentOrder.findIndex((c) => c.id === cardId);

      if (cardIndex === -1) return;

      const updatedOrder = [...currentOrder];

      updatedOrder[cardIndex] = { ...updatedOrder[cardIndex], size };

      await updateCardOrder(updatedOrder);
    },
    [user, settings, updateCardOrder],
  );

  const cycleCardSize = useCallback(
    async (cardId: string) => {
      if (!user || !settings) return;

      const currentOrder = settings.projectDashboard.cardOrder;
      const card = currentOrder.find((c) => c.id === cardId);

      if (!card) return;

      const sizes: CardSize[] = ["small", "medium", "large", "full"];
      const currentIndex = sizes.indexOf(card.size || "medium");
      const nextSize = sizes[(currentIndex + 1) % sizes.length];

      await updateCardSize(cardId, nextSize);
    },
    [user, settings, updateCardSize],
  );

  const getCardOrder = useCallback(() => {
    if (!settings?.projectDashboard?.cardOrder) {
      return DEFAULT_CARD_ORDER;
    }

    // Ensure all cards have a size property
    return [...settings.projectDashboard.cardOrder]
      .map((card) => ({
        ...card,
        size: card.size || "medium",
      }))
      .sort((a, b) => a.order - b.order);
  }, [settings]);

  return {
    settings,
    loading,
    error,
    updateCardOrder,
    toggleCardPin,
    updateCardSize,
    cycleCardSize,
    getCardOrder,
    refreshSettings: fetchSettings,
  };
}
