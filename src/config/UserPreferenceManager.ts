import { EventEmitter } from 'events';
import {
  UserPreferences,
  AppearanceSettings,
  BehaviorSettings,
  AccessibilitySettings,
  NotificationSettings,
  KeyboardShortcuts,
  LanguageSettings,
  PrivacySettings,
  ValidationResult
} from './types';
import { ConfigurationManager } from './ConfigurationManager';
import { ConfigurationValidator } from './ConfigurationValidator';

export interface PreferenceProfile {
  id: string;
  name: string;
  description: string;
  created: string;
  modified: string;
  author: string;
  preferences: Partial<UserPreferences>;
  readOnly: boolean;
  system: boolean;
}

export interface PreferenceTemplate {
  id: string;
  name: string;
  category: 'appearance' | 'behavior' | 'accessibility' | 'professional';
  description: string;
  preferences: Partial<UserPreferences>;
  preview?: string;
}

export interface PreferenceChangeEvent {
  path: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
  source: 'user' | 'system' | 'migration' | 'template';
}

export class UserPreferenceManager extends EventEmitter {
  private configManager: ConfigurationManager;
  private validator: ConfigurationValidator;
  private currentPreferences: UserPreferences;
  private profiles: Map<string, PreferenceProfile> = new Map();
  private templates: Map<string, PreferenceTemplate> = new Map();
  private changeHistory: PreferenceChangeEvent[] = [];
  private maxHistorySize = 1000;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private watchers: Map<string, Array<(value: any) => void>> = new Map();

  constructor(configManager: ConfigurationManager) {
    super();
    this.configManager = configManager;
    this.validator = new ConfigurationValidator();
    this.currentPreferences = this.configManager.get('userPreferences', this.getDefaultPreferences());
    
    this.setupEventListeners();
    this.initializeTemplates();
    this.loadProfiles();
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing User Preference Manager...');
      
      await this.validateCurrentPreferences();
      await this.migrateOldPreferences();
      this.applyPreferencesImmediately();
      
      this.emit('preferences-loaded', this.currentPreferences);
      console.log('User Preference Manager initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize User Preference Manager:', error);
      this.emit('preferences-error', error);
      throw error;
    }
  }

  // Appearance Preferences
  public getAppearanceSettings(): AppearanceSettings {
    return { ...this.currentPreferences.appearance };
  }

  public async setAppearanceSettings(settings: Partial<AppearanceSettings>): Promise<void> {
    await this.updatePreferences('appearance', settings, 'user');
  }

  public async setTheme(theme: AppearanceSettings['theme']): Promise<void> {
    await this.setAppearanceSettings({ theme });
  }

  public async setFontSize(fontSize: number): Promise<void> {
    const validationResult = this.validateFontSize(fontSize);
    if (!validationResult.valid) {
      throw new Error(validationResult.message);
    }
    await this.setAppearanceSettings({ fontSize });
  }

  public async setUIScale(scale: number): Promise<void> {
    const validationResult = this.validateUIScale(scale);
    if (!validationResult.valid) {
      throw new Error(validationResult.message);
    }
    await this.setAppearanceSettings({ uiScale: scale });
  }

  // Behavior Preferences
  public getBehaviorSettings(): BehaviorSettings {
    return { ...this.currentPreferences.behavior };
  }

  public async setBehaviorSettings(settings: Partial<BehaviorSettings>): Promise<void> {
    await this.updatePreferences('behavior', settings, 'user');
  }

  public async setAutoSave(enabled: boolean, interval?: number): Promise<void> {
    const settings: Partial<BehaviorSettings> = { autoSave: enabled };
    if (interval !== undefined) {
      settings.autoSaveInterval = interval;
    }
    await this.setBehaviorSettings(settings);
  }

  // Accessibility Preferences
  public getAccessibilitySettings(): AccessibilitySettings {
    return { ...this.currentPreferences.accessibility };
  }

  public async setAccessibilitySettings(settings: Partial<AccessibilitySettings>): Promise<void> {
    await this.updatePreferences('accessibility', settings, 'user');
  }

  public async setHighContrast(enabled: boolean): Promise<void> {
    await this.setAccessibilitySettings({ highContrast: enabled });
    
    // Auto-adjust theme if high contrast is enabled
    if (enabled && this.currentPreferences.appearance.theme !== 'high-contrast') {
      await this.setTheme('high-contrast');
    }
  }

  public async setScreenReaderSupport(enabled: boolean): Promise<void> {
    await this.setAccessibilitySettings({ screenReaderSupport: enabled });
  }

  // Notification Preferences
  public getNotificationSettings(): NotificationSettings {
    return { ...this.currentPreferences.notifications };
  }

  public async setNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
    await this.updatePreferences('notifications', settings, 'user');
  }

  public async setNotificationType(type: keyof NotificationSettings['types'], enabled: boolean): Promise<void> {
    const currentTypes = { ...this.currentPreferences.notifications.types };
    currentTypes[type] = enabled;
    await this.setNotificationSettings({ types: currentTypes });
  }

  public async setQuietHours(start: string, end: string, enabled = true): Promise<void> {
    const quietHours = { enabled, start, end };
    const validationResult = this.validateQuietHours(quietHours);
    if (!validationResult.valid) {
      throw new Error(validationResult.message);
    }
    await this.setNotificationSettings({ quietHours });
  }

  // Keyboard Shortcuts
  public getKeyboardShortcuts(): KeyboardShortcuts {
    return JSON.parse(JSON.stringify(this.currentPreferences.shortcuts));
  }

  public async setKeyboardShortcut(
    action: string, 
    keys: string[], 
    context: 'global' | 'investigation' | 'evidence' | 'analysis' = 'global'
  ): Promise<void> {
    const shortcuts = { ...this.currentPreferences.shortcuts };
    
    // Validate shortcut
    const validationResult = this.validateShortcut(keys);
    if (!validationResult.valid) {
      throw new Error(validationResult.message);
    }
    
    // Check for conflicts
    const conflict = this.findShortcutConflict(keys, context, action);
    if (conflict) {
      throw new Error(`Shortcut conflict with action: ${conflict}`);
    }
    
    shortcuts[action] = {
      action,
      keys,
      context,
      enabled: true,
      customizable: true
    };
    
    await this.updatePreferences('shortcuts', shortcuts, 'user');
  }

  public async removeKeyboardShortcut(action: string): Promise<void> {
    const shortcuts = { ...this.currentPreferences.shortcuts };
    if (shortcuts[action] && shortcuts[action].customizable) {
      delete shortcuts[action];
      await this.updatePreferences('shortcuts', shortcuts, 'user');
    } else {
      throw new Error('Cannot remove non-customizable shortcut');
    }
  }

  public async resetKeyboardShortcuts(): Promise<void> {
    const defaultShortcuts = this.getDefaultKeyboardShortcuts();
    await this.updatePreferences('shortcuts', defaultShortcuts, 'system');
  }

  // Language Preferences
  public getLanguageSettings(): LanguageSettings {
    return { ...this.currentPreferences.language };
  }

  public async setLanguageSettings(settings: Partial<LanguageSettings>): Promise<void> {
    await this.updatePreferences('language', settings, 'user');
  }

  public async setLocale(locale: string): Promise<void> {
    const validationResult = this.validateLocale(locale);
    if (!validationResult.valid) {
      throw new Error(validationResult.message);
    }
    await this.setLanguageSettings({ locale });
  }

  public async setTimeZone(timezone: string): Promise<void> {
    const validationResult = this.validateTimezone(timezone);
    if (!validationResult.valid) {
      throw new Error(validationResult.message);
    }
    await this.setLanguageSettings({ timezone });
  }

  // Privacy Preferences
  public getPrivacySettings(): PrivacySettings {
    return { ...this.currentPreferences.privacy };
  }

  public async setPrivacySettings(settings: Partial<PrivacySettings>): Promise<void> {
    await this.updatePreferences('privacy', settings, 'user');
  }

  public async setTelemetryEnabled(enabled: boolean): Promise<void> {
    await this.setPrivacySettings({ telemetryEnabled: enabled });
  }

  public async setDataRetention(days: number): Promise<void> {
    const validationResult = this.validateDataRetention(days);
    if (!validationResult.valid) {
      throw new Error(validationResult.message);
    }
    await this.setPrivacySettings({ dataRetention: days });
  }

  // Profile Management
  public async createProfile(name: string, description: string): Promise<string> {
    const profile: PreferenceProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      author: 'user',
      preferences: JSON.parse(JSON.stringify(this.currentPreferences)),
      readOnly: false,
      system: false
    };
    
    this.profiles.set(profile.id, profile);
    await this.saveProfiles();
    
    this.emit('profile-created', profile);
    return profile.id;
  }

  public async loadProfile(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }
    
    await this.applyPreferences(profile.preferences, 'user');
    this.emit('profile-loaded', profile);
  }

  public async updateProfile(profileId: string, updates: Partial<PreferenceProfile>): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }
    
    if (profile.readOnly) {
      throw new Error('Cannot update read-only profile');
    }
    
    Object.assign(profile, updates, { modified: new Date().toISOString() });
    await this.saveProfiles();
    
    this.emit('profile-updated', profile);
  }

  public async deleteProfile(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }
    
    if (profile.system) {
      throw new Error('Cannot delete system profile');
    }
    
    this.profiles.delete(profileId);
    await this.saveProfiles();
    
    this.emit('profile-deleted', profileId);
  }

  public listProfiles(): PreferenceProfile[] {
    return Array.from(this.profiles.values()).sort((a, b) => 
      new Date(b.modified).getTime() - new Date(a.modified).getTime()
    );
  }

  // Template Management
  public getTemplates(): PreferenceTemplate[] {
    return Array.from(this.templates.values());
  }

  public async applyTemplate(templateId: string): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    await this.applyPreferences(template.preferences, 'template');
    this.emit('template-applied', template);
  }

  // Preference Watching
  public watchPreference<T>(path: string, callback: (value: T) => void): () => void {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, []);
    }
    
    this.watchers.get(path)!.push(callback);
    
    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(path);
      if (watchers) {
        const index = watchers.indexOf(callback);
        if (index > -1) {
          watchers.splice(index, 1);
        }
      }
    };
  }

  // Preference Import/Export
  public exportPreferences(includeProfiles = true): any {
    const exportData: any = {
      preferences: this.currentPreferences,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    
    if (includeProfiles) {
      exportData.profiles = Array.from(this.profiles.values())
        .filter(p => !p.system);
    }
    
    return exportData;
  }

  public async importPreferences(data: any, merge = false): Promise<void> {
    if (!data.preferences) {
      throw new Error('Invalid preference data');
    }
    
    // Validate imported preferences
    const validationResults = await this.validatePreferences(data.preferences);
    const errors = validationResults.filter(r => r.severity === 'error');
    if (errors.length > 0) {
      throw new Error(`Preference validation failed: ${errors.map(e => e.message).join(', ')}`);
    }
    
    if (merge) {
      const mergedPreferences = this.mergePreferences(this.currentPreferences, data.preferences);
      await this.applyPreferences(mergedPreferences, 'migration');
    } else {
      await this.applyPreferences(data.preferences, 'migration');
    }
    
    // Import profiles if present
    if (data.profiles && Array.isArray(data.profiles)) {
      for (const profileData of data.profiles) {
        const profile: PreferenceProfile = {
          ...profileData,
          id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        };
        this.profiles.set(profile.id, profile);
      }
      await this.saveProfiles();
    }
    
    this.emit('preferences-imported', data);
  }

  // Reset and Defaults
  public async resetPreferences(section?: keyof UserPreferences): Promise<void> {
    const defaultPreferences = this.getDefaultPreferences();
    
    if (section) {
      await this.updatePreferences(section, defaultPreferences[section], 'system');
    } else {
      await this.applyPreferences(defaultPreferences, 'system');
    }
    
    this.emit('preferences-reset', section);
  }

  // Change History
  public getChangeHistory(limit = 50): PreferenceChangeEvent[] {
    return this.changeHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public clearChangeHistory(): void {
    this.changeHistory.length = 0;
    this.emit('change-history-cleared');
  }

  // Private Methods
  private async updatePreferences(
    section: keyof UserPreferences,
    updates: any,
    source: PreferenceChangeEvent['source']
  ): Promise<void> {
    const oldValue = { ...this.currentPreferences[section] };
    const newValue = { ...oldValue, ...updates };
    
    // Validate the change
    const tempPreferences = { ...this.currentPreferences, [section]: newValue };
    const validationResults = await this.validatePreferences(tempPreferences);
    const errors = validationResults.filter(r => r.severity === 'error');
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }
    
    // Apply the change
    this.currentPreferences[section] = newValue;
    await this.configManager.set(`userPreferences.${section}`, newValue);
    
    // Record the change
    this.recordChange(`${section}`, oldValue, newValue, source);
    
    // Notify watchers
    this.notifyWatchers(`${section}`, newValue);
    
    // Apply immediately if needed
    this.applyPreferenceChange(section, newValue);
    
    this.emit('preference-changed', {
      section,
      oldValue,
      newValue,
      source
    });
  }

  private async applyPreferences(
    preferences: Partial<UserPreferences>,
    source: PreferenceChangeEvent['source']
  ): Promise<void> {
    for (const [section, value] of Object.entries(preferences)) {
      if (value !== undefined) {
        await this.updatePreferences(section as keyof UserPreferences, value, source);
      }
    }
  }

  private recordChange(
    path: string,
    oldValue: any,
    newValue: any,
    source: PreferenceChangeEvent['source']
  ): void {
    const change: PreferenceChangeEvent = {
      path,
      oldValue: JSON.parse(JSON.stringify(oldValue)),
      newValue: JSON.parse(JSON.stringify(newValue)),
      timestamp: Date.now(),
      source
    };
    
    this.changeHistory.push(change);
    
    // Maintain history size limit
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }
  }

  private notifyWatchers(path: string, value: any): void {
    const watchers = this.watchers.get(path);
    if (watchers) {
      for (const callback of watchers) {
        try {
          callback(value);
        } catch (error) {
          console.error('Preference watcher error:', error);
        }
      }
    }
  }

  private applyPreferenceChange(section: keyof UserPreferences, value: any): void {
    // Apply changes that need immediate effect
    switch (section) {
      case 'appearance':
        this.applyAppearanceChanges(value);
        break;
      case 'accessibility':
        this.applyAccessibilityChanges(value);
        break;
      case 'language':
        this.applyLanguageChanges(value);
        break;
    }
  }

  private applyAppearanceChanges(appearance: AppearanceSettings): void {
    // Apply theme changes to document
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', appearance.theme);
      document.documentElement.style.fontSize = `${appearance.fontSize}px`;
      document.documentElement.style.zoom = `${appearance.uiScale}`;
    }
  }

  private applyAccessibilityChanges(accessibility: AccessibilitySettings): void {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('high-contrast', accessibility.highContrast);
      document.documentElement.classList.toggle('reduced-motion', accessibility.reducedMotion);
    }
  }

  private applyLanguageChanges(language: LanguageSettings): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language.locale.split('-')[0];
    }
  }

  private async validateCurrentPreferences(): Promise<void> {
    const results = await this.validatePreferences(this.currentPreferences);
    const errors = results.filter(r => r.severity === 'error');
    
    if (errors.length > 0) {
      console.warn('Current preferences have validation errors:', errors);
      // Could auto-fix or prompt user
    }
  }

  private async validatePreferences(preferences: UserPreferences): Promise<ValidationResult[]> {
    return this.validator.validatePath(
      { userPreferences: preferences } as any,
      'userPreferences',
      preferences
    );
  }

  private async migrateOldPreferences(): Promise<void> {
    // Migration logic for old preference formats
    // This would handle upgrading from older versions
  }

  private applyPreferencesImmediately(): void {
    // Apply all current preferences that need immediate effect
    this.applyAppearanceChanges(this.currentPreferences.appearance);
    this.applyAccessibilityChanges(this.currentPreferences.accessibility);
    this.applyLanguageChanges(this.currentPreferences.language);
  }

  private setupEventListeners(): void {
    this.configManager.on('config:changed', (path: string, oldValue: any, newValue: any) => {
      if (path.startsWith('userPreferences.')) {
        const section = path.replace('userPreferences.', '').split('.')[0];
        this.recordChange(path, oldValue, newValue, 'system');
      }
    });
  }

  private initializeTemplates(): void {
    // Professional Investigation Template
    this.templates.set('professional', {
      id: 'professional',
      name: 'Professional Investigation',
      category: 'professional',
      description: 'Optimized settings for professional forensic investigation work',
      preferences: {
        appearance: {
          theme: 'light',
          fontSize: 12,
          fontFamily: 'Consolas, "Courier New", monospace',
          compactMode: true,
          showTooltips: false
        },
        behavior: {
          autoSave: true,
          autoSaveInterval: 2,
          confirmOnDelete: true,
          maxRecentFiles: 20
        },
        accessibility: {
          highContrast: false,
          keyboardNavigation: true
        },
        privacy: {
          telemetryEnabled: false,
          crashReporting: true,
          anonymizeData: true
        }
      }
    });

    // High Contrast Template
    this.templates.set('accessibility', {
      id: 'accessibility',
      name: 'High Accessibility',
      category: 'accessibility',
      description: 'Enhanced accessibility features for users with visual impairments',
      preferences: {
        appearance: {
          theme: 'high-contrast',
          fontSize: 16,
          uiScale: 1.2
        },
        accessibility: {
          highContrast: true,
          screenReaderSupport: true,
          keyboardNavigation: true,
          reducedMotion: true
        }
      }
    });

    // Dark Theme Template
    this.templates.set('dark', {
      id: 'dark',
      name: 'Dark Theme',
      category: 'appearance',
      description: 'Dark theme optimized for low-light environments',
      preferences: {
        appearance: {
          theme: 'dark',
          fontSize: 14,
          animationsEnabled: true
        }
      }
    });
  }

  private async loadProfiles(): Promise<void> {
    try {
      const profileData = this.configManager.get('userPreferenceProfiles', []);
      for (const data of profileData) {
        this.profiles.set(data.id, data);
      }
    } catch (error) {
      console.warn('Failed to load preference profiles:', error);
    }
  }

  private async saveProfiles(): Promise<void> {
    try {
      const profileArray = Array.from(this.profiles.values())
        .filter(p => !p.system); // Don't save system profiles
      await this.configManager.set('userPreferenceProfiles', profileArray);
    } catch (error) {
      console.error('Failed to save preference profiles:', error);
    }
  }

  private getDefaultPreferences(): UserPreferences {
    // Return the default user preferences
    return this.configManager.getConfiguration().userPreferences;
  }

  private getDefaultKeyboardShortcuts(): KeyboardShortcuts {
    return {
      'file.new': {
        action: 'file.new',
        keys: ['ctrl+n'],
        context: 'global',
        enabled: true,
        customizable: true
      },
      'file.open': {
        action: 'file.open',
        keys: ['ctrl+o'],
        context: 'global',
        enabled: true,
        customizable: true
      },
      'file.save': {
        action: 'file.save',
        keys: ['ctrl+s'],
        context: 'global',
        enabled: true,
        customizable: true
      },
      'edit.undo': {
        action: 'edit.undo',
        keys: ['ctrl+z'],
        context: 'global',
        enabled: true,
        customizable: true
      },
      'edit.redo': {
        action: 'edit.redo',
        keys: ['ctrl+y'],
        context: 'global',
        enabled: true,
        customizable: true
      }
    };
  }

  private mergePreferences(current: UserPreferences, incoming: Partial<UserPreferences>): UserPreferences {
    const merged = JSON.parse(JSON.stringify(current));
    
    for (const [section, value] of Object.entries(incoming)) {
      if (value && typeof value === 'object') {
        merged[section as keyof UserPreferences] = {
          ...merged[section as keyof UserPreferences],
          ...value
        };
      }
    }
    
    return merged;
  }

  // Validation Methods
  private validateFontSize(size: number): { valid: boolean; message?: string } {
    if (size < 8 || size > 32) {
      return { valid: false, message: 'Font size must be between 8 and 32 pixels' };
    }
    return { valid: true };
  }

  private validateUIScale(scale: number): { valid: boolean; message?: string } {
    if (scale < 0.5 || scale > 3.0) {
      return { valid: false, message: 'UI scale must be between 0.5 and 3.0' };
    }
    return { valid: true };
  }

  private validateQuietHours(quietHours: any): { valid: boolean; message?: string } {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(quietHours.start) || !timeRegex.test(quietHours.end)) {
      return { valid: false, message: 'Time must be in HH:MM format' };
    }
    return { valid: true };
  }

  private validateShortcut(keys: string[]): { valid: boolean; message?: string } {
    if (keys.length === 0) {
      return { valid: false, message: 'Shortcut must have at least one key' };
    }
    
    // Basic validation - could be more sophisticated
    for (const key of keys) {
      if (key.length === 0) {
        return { valid: false, message: 'Invalid key in shortcut' };
      }
    }
    
    return { valid: true };
  }

  private validateLocale(locale: string): { valid: boolean; message?: string } {
    const localeRegex = /^[a-z]{2}-[A-Z]{2}$/;
    if (!localeRegex.test(locale)) {
      return { valid: false, message: 'Locale must be in format: language-COUNTRY (e.g., en-US)' };
    }
    return { valid: true };
  }

  private validateTimezone(timezone: string): { valid: boolean; message?: string } {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return { valid: true };
    } catch {
      return { valid: false, message: 'Invalid timezone' };
    }
  }

  private validateDataRetention(days: number): { valid: boolean; message?: string } {
    if (days < 1 || days > 3650) {
      return { valid: false, message: 'Data retention must be between 1 and 3650 days' };
    }
    return { valid: true };
  }

  private findShortcutConflict(
    keys: string[], 
    context: string, 
    excludeAction?: string
  ): string | null {
    const keyString = keys.join('+');
    
    for (const [action, shortcut] of Object.entries(this.currentPreferences.shortcuts)) {
      if (action === excludeAction) continue;
      
      if (shortcut.keys.join('+') === keyString && 
          (shortcut.context === context || shortcut.context === 'global' || context === 'global')) {
        return action;
      }
    }
    
    return null;
  }

  public async dispose(): Promise<void> {
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Clear watchers
    this.watchers.clear();
    
    // Save final state
    await this.saveProfiles();
    
    this.removeAllListeners();
  }
}