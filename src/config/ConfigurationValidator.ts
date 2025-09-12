import {
  ConfigurationSchema,
  ValidationResult,
  ValidationRule,
  UserPreferences,
  HardwareCalibrations,
  ToolDefaults,
  WorkspaceLayouts,
  SystemSettings,
  SecuritySettings
} from './types';

export class ConfigurationValidator {
  private rules: Map<string, ValidationRule[]> = new Map();
  private customValidators: Map<string, (value: any, config: any, path: string) => ValidationResult[]> = new Map();

  constructor() {
    this.initializeBuiltInRules();
    this.registerCustomValidators();
  }

  public validateConfiguration(config: ConfigurationSchema): ValidationResult[] {
    const results: ValidationResult[] = [];

    try {
      // Validate each section
      results.push(...this.validateUserPreferences(config.userPreferences));
      results.push(...this.validateHardwareCalibrations(config.hardwareCalibrations));
      results.push(...this.validateToolDefaults(config.toolDefaults));
      results.push(...this.validateWorkspaceLayouts(config.workspaceLayouts));
      results.push(...this.validateSystemSettings(config.systemSettings));
      results.push(...this.validateSecuritySettings(config.securitySettings));

      // Validate cross-section dependencies
      results.push(...this.validateCrossSectionDependencies(config));

      // Validate business rules
      results.push(...this.validateBusinessRules(config));

    } catch (error) {
      results.push({
        path: 'root',
        message: `Configuration validation failed: ${error.message}`,
        severity: 'error',
        code: 'VALIDATION_ERROR'
      });
    }

    return results;
  }

  public validatePath(config: ConfigurationSchema, path: string, value: any): ValidationResult[] {
    const results: ValidationResult[] = [];
    const pathRules = this.rules.get(path) || [];

    for (const rule of pathRules) {
      try {
        const result = this.validateRule(rule, value, config, path);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        results.push({
          path,
          message: `Rule validation failed: ${error.message}`,
          severity: 'error',
          code: 'RULE_ERROR'
        });
      }
    }

    // Check for custom validators
    const validator = this.customValidators.get(path);
    if (validator) {
      try {
        results.push(...validator(value, config, path));
      } catch (error) {
        results.push({
          path,
          message: `Custom validation failed: ${error.message}`,
          severity: 'error',
          code: 'CUSTOM_VALIDATION_ERROR'
        });
      }
    }

    return results;
  }

  public addRule(path: string, rule: ValidationRule): void {
    if (!this.rules.has(path)) {
      this.rules.set(path, []);
    }
    this.rules.get(path)!.push(rule);
  }

  public removeRule(path: string, ruleType: string): void {
    const pathRules = this.rules.get(path);
    if (pathRules) {
      const index = pathRules.findIndex(rule => rule.type === ruleType);
      if (index > -1) {
        pathRules.splice(index, 1);
      }
    }
  }

  public addCustomValidator(
    path: string,
    validator: (value: any, config: any, path: string) => ValidationResult[]
  ): void {
    this.customValidators.set(path, validator);
  }

  private initializeBuiltInRules(): void {
    // User Preferences Validation Rules
    this.addAppearanceRules();
    this.addBehaviorRules();
    this.addAccessibilityRules();
    this.addNotificationRules();
    this.addLanguageRules();
    this.addPrivacyRules();

    // Hardware Calibration Rules
    this.addHardwareCalibrationRules();

    // Tool Default Rules
    this.addToolDefaultRules();

    // Workspace Layout Rules
    this.addWorkspaceLayoutRules();

    // System Settings Rules
    this.addSystemSettingsRules();

    // Security Settings Rules
    this.addSecuritySettingsRules();
  }

  private addAppearanceRules(): void {
    this.addRule('userPreferences.appearance.fontSize', {
      path: 'userPreferences.appearance.fontSize',
      type: 'range',
      message: 'Font size must be between 8 and 32 pixels',
      severity: 'error',
      parameters: { min: 8, max: 32 }
    });

    this.addRule('userPreferences.appearance.uiScale', {
      path: 'userPreferences.appearance.uiScale',
      type: 'range',
      message: 'UI scale must be between 0.5 and 3.0',
      severity: 'error',
      parameters: { min: 0.5, max: 3.0 }
    });

    this.addRule('userPreferences.appearance.theme', {
      path: 'userPreferences.appearance.theme',
      type: 'enum',
      message: 'Theme must be one of: light, dark, auto, high-contrast',
      severity: 'error',
      parameters: { values: ['light', 'dark', 'auto', 'high-contrast'] }
    });
  }

  private addBehaviorRules(): void {
    this.addRule('userPreferences.behavior.autoSaveInterval', {
      path: 'userPreferences.behavior.autoSaveInterval',
      type: 'range',
      message: 'Auto-save interval must be between 1 and 60 minutes',
      severity: 'error',
      parameters: { min: 1, max: 60 }
    });

    this.addRule('userPreferences.behavior.maxRecentFiles', {
      path: 'userPreferences.behavior.maxRecentFiles',
      type: 'range',
      message: 'Maximum recent files must be between 1 and 50',
      severity: 'error',
      parameters: { min: 1, max: 50 }
    });

    this.addRule('userPreferences.behavior.scrollSensitivity', {
      path: 'userPreferences.behavior.scrollSensitivity',
      type: 'range',
      message: 'Scroll sensitivity must be between 0.1 and 5.0',
      severity: 'error',
      parameters: { min: 0.1, max: 5.0 }
    });
  }

  private addAccessibilityRules(): void {
    this.addRule('userPreferences.accessibility.speechRate', {
      path: 'userPreferences.accessibility.speechRate',
      type: 'range',
      message: 'Speech rate must be between 0.1 and 3.0',
      severity: 'error',
      parameters: { min: 0.1, max: 3.0 }
    });

    this.addRule('userPreferences.accessibility.colorBlindnessType', {
      path: 'userPreferences.accessibility.colorBlindnessType',
      type: 'enum',
      message: 'Color blindness type must be one of: none, protanopia, deuteranopia, tritanopia',
      severity: 'error',
      parameters: { values: ['none', 'protanopia', 'deuteranopia', 'tritanopia'] }
    });
  }

  private addNotificationRules(): void {
    this.addRule('userPreferences.notifications.quietHours.start', {
      path: 'userPreferences.notifications.quietHours.start',
      type: 'regex',
      message: 'Quiet hours start time must be in HH:MM format',
      severity: 'error',
      parameters: { pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' }
    });

    this.addRule('userPreferences.notifications.quietHours.end', {
      path: 'userPreferences.notifications.quietHours.end',
      type: 'regex',
      message: 'Quiet hours end time must be in HH:MM format',
      severity: 'error',
      parameters: { pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' }
    });
  }

  private addLanguageRules(): void {
    this.addRule('userPreferences.language.locale', {
      path: 'userPreferences.language.locale',
      type: 'regex',
      message: 'Locale must be in format: language-COUNTRY (e.g., en-US)',
      severity: 'error',
      parameters: { pattern: '^[a-z]{2}-[A-Z]{2}$' }
    });

    this.addRule('userPreferences.language.dateFormat', {
      path: 'userPreferences.language.dateFormat',
      type: 'enum',
      message: 'Date format must be one of: MM/dd/yyyy, dd/MM/yyyy, yyyy-MM-dd, custom',
      severity: 'error',
      parameters: { values: ['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'custom'] }
    });

    this.addRule('userPreferences.language.timeFormat', {
      path: 'userPreferences.language.timeFormat',
      type: 'enum',
      message: 'Time format must be either 12h or 24h',
      severity: 'error',
      parameters: { values: ['12h', '24h'] }
    });
  }

  private addPrivacyRules(): void {
    this.addRule('userPreferences.privacy.dataRetention', {
      path: 'userPreferences.privacy.dataRetention',
      type: 'range',
      message: 'Data retention period must be between 1 and 3650 days',
      severity: 'error',
      parameters: { min: 1, max: 3650 }
    });
  }

  private addHardwareCalibrationRules(): void {
    // Sensor calibration rules
    this.addRule('hardwareCalibrations.sensors.*.parameters.*.tolerance', {
      path: 'hardwareCalibrations.sensors.*.parameters.*.tolerance',
      type: 'range',
      message: 'Sensor tolerance must be between 0 and 100',
      severity: 'warning',
      parameters: { min: 0, max: 100 }
    });

    // Display calibration rules
    this.addRule('hardwareCalibrations.displays.*.brightness', {
      path: 'hardwareCalibrations.displays.*.brightness',
      type: 'range',
      message: 'Display brightness must be between 0 and 100',
      severity: 'error',
      parameters: { min: 0, max: 100 }
    });

    this.addRule('hardwareCalibrations.displays.*.contrast', {
      path: 'hardwareCalibrations.displays.*.contrast',
      type: 'range',
      message: 'Display contrast must be between 0 and 100',
      severity: 'error',
      parameters: { min: 0, max: 100 }
    });

    this.addRule('hardwareCalibrations.displays.*.gamma', {
      path: 'hardwareCalibrations.displays.*.gamma',
      type: 'range',
      message: 'Display gamma must be between 1.0 and 3.0',
      severity: 'error',
      parameters: { min: 1.0, max: 3.0 }
    });

    // Input calibration rules
    this.addRule('hardwareCalibrations.input.mouse.sensitivity', {
      path: 'hardwareCalibrations.input.mouse.sensitivity',
      type: 'range',
      message: 'Mouse sensitivity must be between 0.1 and 10.0',
      severity: 'error',
      parameters: { min: 0.1, max: 10.0 }
    });

    this.addRule('hardwareCalibrations.input.mouse.dpi', {
      path: 'hardwareCalibrations.input.mouse.dpi',
      type: 'range',
      message: 'Mouse DPI must be between 100 and 20000',
      severity: 'warning',
      parameters: { min: 100, max: 20000 }
    });
  }

  private addToolDefaultRules(): void {
    this.addRule('toolDefaults.analysis.processing.batchSize', {
      path: 'toolDefaults.analysis.processing.batchSize',
      type: 'range',
      message: 'Analysis batch size must be between 1 and 1000',
      severity: 'error',
      parameters: { min: 1, max: 1000 }
    });

    this.addRule('toolDefaults.analysis.processing.maxConcurrent', {
      path: 'toolDefaults.analysis.processing.maxConcurrent',
      type: 'range',
      message: 'Maximum concurrent operations must be between 1 and 32',
      severity: 'error',
      parameters: { min: 1, max: 32 }
    });

    this.addRule('toolDefaults.forensics.acquisition.compressionLevel', {
      path: 'toolDefaults.forensics.acquisition.compressionLevel',
      type: 'range',
      message: 'Compression level must be between 0 and 9',
      severity: 'error',
      parameters: { min: 0, max: 9 }
    });

    this.addRule('toolDefaults.reporting.compression', {
      path: 'toolDefaults.reporting.compression',
      type: 'range',
      message: 'Report compression must be between 0 and 10',
      severity: 'error',
      parameters: { min: 0, max: 10 }
    });
  }

  private addWorkspaceLayoutRules(): void {
    this.addRule('workspaceLayouts.layouts.*.windows.*.bounds.width', {
      path: 'workspaceLayouts.layouts.*.windows.*.bounds.width',
      type: 'range',
      message: 'Window width must be at least 100 pixels',
      severity: 'error',
      parameters: { min: 100, max: 10000 }
    });

    this.addRule('workspaceLayouts.layouts.*.windows.*.bounds.height', {
      path: 'workspaceLayouts.layouts.*.windows.*.bounds.height',
      type: 'range',
      message: 'Window height must be at least 100 pixels',
      severity: 'error',
      parameters: { min: 100, max: 10000 }
    });

    this.addRule('workspaceLayouts.layouts.*.zoom', {
      path: 'workspaceLayouts.layouts.*.zoom',
      type: 'range',
      message: 'Zoom level must be between 0.1 and 5.0',
      severity: 'error',
      parameters: { min: 0.1, max: 5.0 }
    });
  }

  private addSystemSettingsRules(): void {
    this.addRule('systemSettings.performance.maxMemoryUsage', {
      path: 'systemSettings.performance.maxMemoryUsage',
      type: 'range',
      message: 'Maximum memory usage must be between 512 MB and 32 GB',
      severity: 'error',
      parameters: { min: 512, max: 32768 }
    });

    this.addRule('systemSettings.performance.maxCpuUsage', {
      path: 'systemSettings.performance.maxCpuUsage',
      type: 'range',
      message: 'Maximum CPU usage must be between 10% and 100%',
      severity: 'error',
      parameters: { min: 10, max: 100 }
    });

    this.addRule('systemSettings.backup.retention.daily', {
      path: 'systemSettings.backup.retention.daily',
      type: 'range',
      message: 'Daily backup retention must be between 1 and 365 days',
      severity: 'error',
      parameters: { min: 1, max: 365 }
    });

    this.addRule('systemSettings.logging.maxFileSize', {
      path: 'systemSettings.logging.maxFileSize',
      type: 'range',
      message: 'Log file size must be between 1 MB and 1 GB',
      severity: 'error',
      parameters: { min: 1, max: 1024 }
    });

    this.addRule('systemSettings.logging.maxFiles', {
      path: 'systemSettings.logging.maxFiles',
      type: 'range',
      message: 'Number of log files must be between 1 and 100',
      severity: 'error',
      parameters: { min: 1, max: 100 }
    });
  }

  private addSecuritySettingsRules(): void {
    this.addRule('securitySettings.authentication.passwordPolicy.minLength', {
      path: 'securitySettings.authentication.passwordPolicy.minLength',
      type: 'range',
      message: 'Minimum password length must be between 4 and 128 characters',
      severity: 'error',
      parameters: { min: 4, max: 128 }
    });

    this.addRule('securitySettings.authentication.passwordPolicy.maxAge', {
      path: 'securitySettings.authentication.passwordPolicy.maxAge',
      type: 'range',
      message: 'Password maximum age must be between 1 and 365 days',
      severity: 'warning',
      parameters: { min: 1, max: 365 }
    });

    this.addRule('securitySettings.authentication.sessionTimeout', {
      path: 'securitySettings.authentication.sessionTimeout',
      type: 'range',
      message: 'Session timeout must be between 5 and 480 minutes',
      severity: 'error',
      parameters: { min: 5, max: 480 }
    });

    this.addRule('securitySettings.audit.retention', {
      path: 'securitySettings.audit.retention',
      type: 'range',
      message: 'Audit log retention must be between 30 and 2555 days (7 years)',
      severity: 'error',
      parameters: { min: 30, max: 2555 }
    });
  }

  private registerCustomValidators(): void {
    // Custom validator for password policy consistency
    this.addCustomValidator('securitySettings.authentication.passwordPolicy', (value, config, path) => {
      const results: ValidationResult[] = [];
      
      if (value.requireSymbols && value.minLength < 8) {
        results.push({
          path,
          message: 'When symbols are required, minimum password length should be at least 8 characters',
          severity: 'warning',
          code: 'PASSWORD_POLICY_INCONSISTENCY',
          suggestion: 'Increase minimum length to 8 or disable symbol requirement'
        });
      }
      
      return results;
    });

    // Custom validator for display calibration consistency
    this.addCustomValidator('hardwareCalibrations.displays', (value, config, path) => {
      const results: ValidationResult[] = [];
      
      let primaryCount = 0;
      for (const displayId in value) {
        if (value[displayId].primary) {
          primaryCount++;
        }
      }
      
      if (primaryCount === 0 && Object.keys(value).length > 0) {
        results.push({
          path,
          message: 'At least one display must be marked as primary',
          severity: 'error',
          code: 'NO_PRIMARY_DISPLAY'
        });
      } else if (primaryCount > 1) {
        results.push({
          path,
          message: 'Only one display can be marked as primary',
          severity: 'error',
          code: 'MULTIPLE_PRIMARY_DISPLAYS'
        });
      }
      
      return results;
    });

    // Custom validator for backup settings
    this.addCustomValidator('systemSettings.backup', (value, config, path) => {
      const results: ValidationResult[] = [];
      
      if (value.enabled && value.automatic && !value.schedule) {
        results.push({
          path: `${path}.schedule`,
          message: 'Backup schedule is required when automatic backup is enabled',
          severity: 'error',
          code: 'MISSING_BACKUP_SCHEDULE'
        });
      }
      
      if (value.maxBackupSize > 0 && value.maxBackupSize < 100) {
        results.push({
          path: `${path}.maxBackupSize`,
          message: 'Maximum backup size should be at least 100 MB',
          severity: 'warning',
          code: 'BACKUP_SIZE_TOO_SMALL'
        });
      }
      
      return results;
    });

    // Custom validator for workspace layouts
    this.addCustomValidator('workspaceLayouts.layouts', (value, config, path) => {
      const results: ValidationResult[] = [];
      
      const currentLayout = config.workspaceLayouts?.current;
      if (currentLayout && !value[currentLayout]) {
        results.push({
          path: 'workspaceLayouts.current',
          message: `Current layout '${currentLayout}' does not exist`,
          severity: 'error',
          code: 'INVALID_CURRENT_LAYOUT'
        });
      }
      
      // Check for overlapping windows in each layout
      for (const layoutName in value) {
        const layout = value[layoutName];
        const windows = layout.windows || [];
        
        for (let i = 0; i < windows.length; i++) {
          for (let j = i + 1; j < windows.length; j++) {
            if (this.windowsOverlap(windows[i], windows[j])) {
              results.push({
                path: `${path}.${layoutName}.windows`,
                message: `Windows '${windows[i].id}' and '${windows[j].id}' overlap`,
                severity: 'warning',
                code: 'OVERLAPPING_WINDOWS'
              });
            }
          }
        }
      }
      
      return results;
    });
  }

  private validateRule(rule: ValidationRule, value: any, config: any, path: string): ValidationResult | null {
    switch (rule.type) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          return {
            path,
            message: rule.message,
            severity: rule.severity,
            code: 'REQUIRED_FIELD_MISSING'
          };
        }
        break;

      case 'type':
        const expectedType = rule.parameters?.type;
        if (expectedType && typeof value !== expectedType) {
          return {
            path,
            message: rule.message,
            severity: rule.severity,
            code: 'INVALID_TYPE',
            value
          };
        }
        break;

      case 'range':
        const min = rule.parameters?.min;
        const max = rule.parameters?.max;
        if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
          return {
            path,
            message: rule.message,
            severity: rule.severity,
            code: 'OUT_OF_RANGE',
            value
          };
        }
        break;

      case 'enum':
        const values = rule.parameters?.values || [];
        if (!values.includes(value)) {
          return {
            path,
            message: rule.message,
            severity: rule.severity,
            code: 'INVALID_ENUM_VALUE',
            value,
            suggestion: `Valid values: ${values.join(', ')}`
          };
        }
        break;

      case 'regex':
        const pattern = rule.parameters?.pattern;
        if (pattern && !new RegExp(pattern).test(value)) {
          return {
            path,
            message: rule.message,
            severity: rule.severity,
            code: 'REGEX_VALIDATION_FAILED',
            value
          };
        }
        break;

      case 'custom':
        if (rule.validator && !rule.validator(value, config)) {
          return {
            path,
            message: rule.message,
            severity: rule.severity,
            code: 'CUSTOM_VALIDATION_FAILED',
            value
          };
        }
        break;
    }

    return null;
  }

  private validateUserPreferences(preferences: UserPreferences): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Validate appearance settings
    results.push(...this.validatePath({} as any, 'userPreferences.appearance.fontSize', preferences.appearance.fontSize));
    results.push(...this.validatePath({} as any, 'userPreferences.appearance.uiScale', preferences.appearance.uiScale));
    results.push(...this.validatePath({} as any, 'userPreferences.appearance.theme', preferences.appearance.theme));
    
    // Validate behavior settings
    results.push(...this.validatePath({} as any, 'userPreferences.behavior.autoSaveInterval', preferences.behavior.autoSaveInterval));
    results.push(...this.validatePath({} as any, 'userPreferences.behavior.maxRecentFiles', preferences.behavior.maxRecentFiles));
    
    // Validate accessibility settings
    results.push(...this.validatePath({} as any, 'userPreferences.accessibility.speechRate', preferences.accessibility.speechRate));
    
    return results;
  }

  private validateHardwareCalibrations(calibrations: HardwareCalibrations): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Validate display calibrations
    for (const displayId in calibrations.displays) {
      const display = calibrations.displays[displayId];
      results.push(...this.validatePath({} as any, 'hardwareCalibrations.displays.brightness', display.brightness));
      results.push(...this.validatePath({} as any, 'hardwareCalibrations.displays.contrast', display.contrast));
      results.push(...this.validatePath({} as any, 'hardwareCalibrations.displays.gamma', display.gamma));
    }
    
    return results;
  }

  private validateToolDefaults(defaults: ToolDefaults): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Validate analysis defaults
    results.push(...this.validatePath({} as any, 'toolDefaults.analysis.processing.batchSize', defaults.analysis.processing.batchSize));
    results.push(...this.validatePath({} as any, 'toolDefaults.analysis.processing.maxConcurrent', defaults.analysis.processing.maxConcurrent));
    
    return results;
  }

  private validateWorkspaceLayouts(layouts: WorkspaceLayouts): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Validate that current layout exists
    if (layouts.current && !layouts.layouts[layouts.current]) {
      results.push({
        path: 'workspaceLayouts.current',
        message: `Current layout '${layouts.current}' does not exist`,
        severity: 'error',
        code: 'INVALID_CURRENT_LAYOUT'
      });
    }
    
    return results;
  }

  private validateSystemSettings(settings: SystemSettings): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Validate performance settings
    results.push(...this.validatePath({} as any, 'systemSettings.performance.maxMemoryUsage', settings.performance.maxMemoryUsage));
    results.push(...this.validatePath({} as any, 'systemSettings.performance.maxCpuUsage', settings.performance.maxCpuUsage));
    
    return results;
  }

  private validateSecuritySettings(settings: SecuritySettings): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Validate authentication settings
    results.push(...this.validatePath({} as any, 'securitySettings.authentication.passwordPolicy.minLength', settings.authentication.passwordPolicy.minLength));
    results.push(...this.validatePath({} as any, 'securitySettings.authentication.sessionTimeout', settings.authentication.sessionTimeout));
    
    return results;
  }

  private validateCrossSectionDependencies(config: ConfigurationSchema): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Example: If high contrast is enabled, ensure compatible theme
    if (config.userPreferences.accessibility.highContrast && 
        config.userPreferences.appearance.theme !== 'high-contrast') {
      results.push({
        path: 'userPreferences.appearance.theme',
        message: 'High contrast accessibility mode requires high-contrast theme',
        severity: 'warning',
        code: 'INCOMPATIBLE_SETTINGS',
        suggestion: 'Set theme to high-contrast or disable high contrast accessibility'
      });
    }
    
    // Example: Validate backup location accessibility
    if (config.systemSettings.backup.enabled && 
        config.systemSettings.backup.location === 'cloud' && 
        !config.userPreferences.privacy.shareImprovement) {
      results.push({
        path: 'systemSettings.backup.location',
        message: 'Cloud backup requires data sharing to be enabled',
        severity: 'warning',
        code: 'BACKUP_PRIVACY_CONFLICT'
      });
    }
    
    return results;
  }

  private validateBusinessRules(config: ConfigurationSchema): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Example business rule: Forensic mode requires higher security
    if (config.toolDefaults.forensics.verificationLevel === 'forensic' && 
        !config.securitySettings.audit.enabled) {
      results.push({
        path: 'securitySettings.audit.enabled',
        message: 'Forensic verification level requires audit logging to be enabled',
        severity: 'error',
        code: 'FORENSIC_AUDIT_REQUIRED'
      });
    }
    
    // Example: Professional license features
    if (config.toolDefaults.reporting.digitalSignature && 
        !config.securitySettings.encryption.dataAtRest.enabled) {
      results.push({
        path: 'securitySettings.encryption.dataAtRest.enabled',
        message: 'Digital signature requires data-at-rest encryption',
        severity: 'warning',
        code: 'SIGNATURE_ENCRYPTION_RECOMMENDED'
      });
    }
    
    return results;
  }

  private windowsOverlap(window1: any, window2: any): boolean {
    const w1 = window1.bounds;
    const w2 = window2.bounds;
    
    return !(w1.x + w1.width <= w2.x || 
             w2.x + w2.width <= w1.x || 
             w1.y + w1.height <= w2.y || 
             w2.y + w2.height <= w1.y);
  }

  public getValidationSummary(results: ValidationResult[]): {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    totalCount: number;
    criticalPaths: string[];
  } {
    const errorCount = results.filter(r => r.severity === 'error').length;
    const warningCount = results.filter(r => r.severity === 'warning').length;
    const infoCount = results.filter(r => r.severity === 'info').length;
    
    const criticalPaths = results
      .filter(r => r.severity === 'error')
      .map(r => r.path)
      .filter((path, index, array) => array.indexOf(path) === index); // unique paths
    
    return {
      errorCount,
      warningCount,
      infoCount,
      totalCount: results.length,
      criticalPaths
    };
  }
}