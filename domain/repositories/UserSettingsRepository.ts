import { UserSettings, ProjectDashboardSettings } from "../entities/UserSettings";

export interface UserSettingsRepository {
  getUserSettings(userId: string): Promise<UserSettings | null>;
  saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<void>;
  updateProjectDashboardSettings(
    userId: string,
    settings: ProjectDashboardSettings
  ): Promise<void>;
}
