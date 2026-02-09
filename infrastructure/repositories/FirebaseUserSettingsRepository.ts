import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

import { db } from "../firebase/config";

import {
  UserSettings,
  ProjectDashboardSettings,
  DEFAULT_CARD_ORDER,
} from "@/domain/entities/UserSettings";
import { UserSettingsRepository } from "@/domain/repositories/UserSettingsRepository";

export class FirebaseUserSettingsRepository implements UserSettingsRepository {
  private getUserSettingsDoc(userId: string) {
    return doc(db, "users", userId, "settings", "preferences");
  }

  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const docRef = this.getUserSettingsDoc(userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Return default settings if none exist
      const defaultSettings: UserSettings = {
        userId,
        projectDashboard: {
          cardOrder: DEFAULT_CARD_ORDER,
        },
        updatedAt: Date.now(),
      };

      return defaultSettings;
    }

    return { id: docSnap.id, ...docSnap.data() } as UserSettings;
  }

  async saveUserSettings(
    userId: string,
    settings: Partial<UserSettings>,
  ): Promise<void> {
    const docRef = this.getUserSettingsDoc(userId);

    await setDoc(
      docRef,
      {
        ...settings,
        userId,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  }

  async updateProjectDashboardSettings(
    userId: string,
    settings: ProjectDashboardSettings,
  ): Promise<void> {
    const docRef = this.getUserSettingsDoc(userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Create new settings document
      await setDoc(docRef, {
        userId,
        projectDashboard: settings,
        updatedAt: Date.now(),
      });
    } else {
      // Update existing document
      await updateDoc(docRef, {
        projectDashboard: settings,
        updatedAt: Date.now(),
      });
    }
  }
}
