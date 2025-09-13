/**
 * App Store & Distribution System Types
 * Comprehensive type definitions for Mac App Store and Microsoft Store distribution
 */

export interface AppStoreConfiguration {
  id: string;
  name: string;
  platform: Platform;
  enabled: boolean;
  credentials: PlatformCredentials;
  buildConfig: BuildConfiguration;
  distributionProfile: DistributionProfile;
  metadata: AppStoreMetadata;
  assets: AppStoreAssets;
  releaseConfig: ReleaseConfiguration;
  createdAt: Date;
  updatedAt: Date;
}

export enum Platform {
  MAC_APP_STORE = 'mac_app_store',
  MICROSOFT_STORE = 'microsoft_store',
  DIRECT_DOWNLOAD = 'direct_download',
  STEAM = 'steam',
  SNAPCRAFT = 'snapcraft'
}

export interface PlatformCredentials {
  platform: Platform;
  credentials: MacAppStoreCredentials | MicrosoftStoreCredentials | DirectDownloadCredentials;
  lastValidated: Date;
  expiresAt?: Date;
}

export interface MacAppStoreCredentials {
  teamId: string;
  bundleId: string;
  appleId: string;
  appSpecificPassword: string;
  signingIdentity: string;
  provisioningProfile: string;
  notarizeCredentials: {
    appleId: string;
    password: string;
    teamId: string;
  };
  distributionCertificate: CertificateInfo;
  installerCertificate: CertificateInfo;
}

export interface MicrosoftStoreCredentials {
  publisherId: string;
  publisherDisplayName: string;
  packageIdentityName: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;
  certificateThumbprint: string;
  signingCertificate: CertificateInfo;
}

export interface DirectDownloadCredentials {
  signingCertificate?: CertificateInfo;
  updateServerUrl: string;
  updateServerCredentials?: {
    username: string;
    password: string;
    apiKey?: string;
  };
}

export interface CertificateInfo {
  thumbprint: string;
  commonName: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  keyUsage: string[];
  path?: string;
  password?: string;
  type: CertificateType;
}

export enum CertificateType {
  APPLE_DEVELOPER = 'apple_developer',
  APPLE_DISTRIBUTION = 'apple_distribution',
  APPLE_INSTALLER = 'apple_installer',
  MICROSOFT_AUTHENTICODE = 'microsoft_authenticode',
  MICROSOFT_STORE = 'microsoft_store',
  EXTENDED_VALIDATION = 'extended_validation'
}

export interface BuildConfiguration {
  platform: Platform;
  architecture: Architecture[];
  signing: SigningConfiguration;
  optimization: BuildOptimization;
  packaging: PackagingConfiguration;
  validation: ValidationConfiguration;
}

export enum Architecture {
  X64 = 'x64',
  ARM64 = 'arm64',
  X86 = 'x86',
  UNIVERSAL = 'universal'
}

export interface SigningConfiguration {
  enabled: boolean;
  certificate: string;
  identity: string;
  entitlements?: string;
  hardenedRuntime: boolean;
  notarize: boolean;
  timestamp: boolean;
  requireSigningVerification: boolean;
}

export interface BuildOptimization {
  minify: boolean;
  compress: boolean;
  treeshake: boolean;
  splitChunks: boolean;
  generateSourceMaps: boolean;
  optimizeImages: boolean;
  removeDevDependencies: boolean;
}

export interface PackagingConfiguration {
  format: PackageFormat;
  compression: CompressionLevel;
  includeFiles: string[];
  excludeFiles: string[];
  extraResources: string[];
  extraFiles: string[];
  fileAssociations: FileAssociation[];
  protocols: ProtocolAssociation[];
}

export enum PackageFormat {
  DMG = 'dmg',
  PKG = 'pkg',
  MSIX = 'msix',
  APPX = 'appx',
  NSIS = 'nsis',
  MSI = 'msi',
  SNAP = 'snap',
  DEB = 'deb',
  RPM = 'rpm',
  APPIMAGE = 'appimage'
}

export enum CompressionLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  MAXIMUM = 'maximum'
}

export interface FileAssociation {
  ext: string;
  name: string;
  description: string;
  icon?: string;
  role?: string;
  mimeType?: string;
}

export interface ProtocolAssociation {
  name: string;
  schemes: string[];
  role?: string;
}

export interface ValidationConfiguration {
  validateSigning: boolean;
  validateMetadata: boolean;
  validateAssets: boolean;
  validateDependencies: boolean;
  scanForVulnerabilities: boolean;
  runTests: boolean;
  generateReports: boolean;
}

export interface DistributionProfile {
  id: string;
  name: string;
  platform: Platform;
  type: DistributionType;
  configuration: DistributionConfiguration;
  restrictions: DistributionRestrictions;
  pricing: PricingConfiguration;
  availability: AvailabilityConfiguration;
  analytics: AnalyticsConfiguration;
}

export enum DistributionType {
  FREE = 'free',
  PAID = 'paid',
  FREEMIUM = 'freemium',
  SUBSCRIPTION = 'subscription',
  TRIAL = 'trial',
  ENTERPRISE = 'enterprise'
}

export interface DistributionConfiguration {
  autoPublish: boolean;
  releaseNotes: ReleaseNotesConfiguration;
  rolloutStrategy: RolloutStrategy;
  updateSettings: UpdateSettings;
  contentRating: ContentRating;
  categories: string[];
  keywords: string[];
  supportedLanguages: string[];
}

export interface ReleaseNotesConfiguration {
  format: 'plain' | 'markdown' | 'html';
  autoGenerate: boolean;
  template?: string;
  includeChangelog: boolean;
  maxLength: number;
  localizations: Record<string, string>;
}

export interface RolloutStrategy {
  type: 'immediate' | 'gradual' | 'scheduled';
  percentage?: number; // For gradual rollouts
  schedule?: Date; // For scheduled rollouts
  targetAudience?: 'all' | 'beta' | 'insider' | 'specific';
  criteria?: RolloutCriteria;
}

export interface RolloutCriteria {
  minOSVersion?: string;
  maxOSVersion?: string;
  regions?: string[];
  deviceTypes?: string[];
  userSegments?: string[];
}

export interface UpdateSettings {
  automaticUpdates: boolean;
  mandatoryUpdates: boolean;
  updateChannel: 'stable' | 'beta' | 'alpha' | 'insider';
  minimumVersion?: string;
  deprecationWarning?: DeprecationWarning;
}

export interface DeprecationWarning {
  enabled: boolean;
  message: string;
  showAfter: Date;
  blockAfter?: Date;
}

export interface ContentRating {
  platform: Platform;
  rating: string;
  descriptors: string[];
  ageRestriction?: number;
  regionsRestricted?: string[];
}

export interface DistributionRestrictions {
  regions: RegionRestriction[];
  devices: DeviceRestriction[];
  osVersions: OSVersionRestriction[];
  hardware: HardwareRestriction[];
}

export interface RegionRestriction {
  type: 'allow' | 'block';
  regions: string[];
  reason?: string;
}

export interface DeviceRestriction {
  type: 'allow' | 'block';
  devices: string[];
  reason?: string;
}

export interface OSVersionRestriction {
  platform: Platform;
  minimum?: string;
  maximum?: string;
  blocked?: string[];
}

export interface HardwareRestriction {
  minRAM?: number;
  minStorage?: number;
  requiredFeatures?: string[];
  blockedFeatures?: string[];
}

export interface PricingConfiguration {
  type: DistributionType;
  price?: number;
  currency: string;
  regionalPricing?: Record<string, number>;
  trialPeriod?: number; // days
  subscriptionPlans?: SubscriptionPlan[];
  discounts?: DiscountConfiguration[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly' | 'weekly';
  features: string[];
  trialPeriod?: number;
  isDefault?: boolean;
}

export interface DiscountConfiguration {
  type: 'percentage' | 'fixed';
  value: number;
  startDate: Date;
  endDate: Date;
  eligibleRegions?: string[];
  maxUses?: number;
  description: string;
}

export interface AvailabilityConfiguration {
  releaseDate?: Date;
  endOfSaleDate?: Date;
  visibility: 'public' | 'private' | 'hidden' | 'coming_soon';
  preOrder: boolean;
  betaRelease: boolean;
  earlyAccess: boolean;
  regions: string[];
}

export interface AnalyticsConfiguration {
  enabled: boolean;
  trackInstalls: boolean;
  trackUsage: boolean;
  trackCrashes: boolean;
  trackPerformance: boolean;
  privacyCompliant: boolean;
  retentionPeriod: number; // days
}

export interface AppStoreMetadata {
  platform: Platform;
  basicInfo: BasicAppInfo;
  descriptions: AppDescriptions;
  categories: AppCategories;
  contact: ContactInfo;
  legal: LegalInfo;
  technical: TechnicalInfo;
  localizations: Record<string, LocalizedMetadata>;
}

export interface BasicAppInfo {
  name: string;
  subtitle?: string;
  bundleId: string;
  version: string;
  buildNumber: string;
  minimumOSVersion: string;
  supportedDevices: string[];
  supportedLanguages: string[];
  copyright: string;
  website: string;
  supportUrl: string;
  privacyPolicyUrl: string;
}

export interface AppDescriptions {
  short: string; // ~30 characters
  long: string; // ~4000 characters
  whatsNew: string; // Release notes
  keywords: string[];
  promotional?: string; // ~170 characters
  subtitle?: string; // ~30 characters
  features: string[];
  targetAudience: string;
}

export interface AppCategories {
  primary: string;
  secondary?: string;
  contentRating: string;
  ageRating: number;
  contentDescriptors: string[];
}

export interface ContactInfo {
  developer: string;
  publisher: string;
  email: string;
  phone?: string;
  supportEmail: string;
  website: string;
  address: ContactAddress;
}

export interface ContactAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface LegalInfo {
  copyright: string;
  license: string;
  termsOfService: string;
  privacyPolicy: string;
  thirdPartyNotices?: string;
  openSourceLicenses?: string;
  dataCollection: DataCollectionInfo;
}

export interface DataCollectionInfo {
  collectsData: boolean;
  dataTypes: string[];
  dataPurposes: string[];
  dataSharing: boolean;
  sharingPartners?: string[];
  dataRetention: string;
  userRights: string[];
}

export interface TechnicalInfo {
  minimumSystemRequirements: SystemRequirements;
  recommendedSystemRequirements: SystemRequirements;
  supportedArchitectures: Architecture[];
  internetRequired: boolean;
  permissions: Permission[];
  dependencies: Dependency[];
}

export interface SystemRequirements {
  os: string;
  osVersion: string;
  processor: string;
  memory: number; // MB
  storage: number; // MB
  graphics?: string;
  additional?: string[];
}

export interface Permission {
  name: string;
  description: string;
  required: boolean;
  purpose: string;
  platform: Platform;
}

export interface Dependency {
  name: string;
  version: string;
  required: boolean;
  purpose: string;
  bundled: boolean;
}

export interface LocalizedMetadata {
  language: string;
  name: string;
  subtitle?: string;
  description: string;
  whatsNew: string;
  keywords: string[];
  features: string[];
  promotional?: string;
}

export interface AppStoreAssets {
  platform: Platform;
  icons: IconAsset[];
  screenshots: ScreenshotAsset[];
  videos: VideoAsset[];
  marketing: MarketingAsset[];
  metadata: AssetMetadata;
}

export interface IconAsset {
  size: string; // e.g., "1024x1024"
  format: ImageFormat;
  path: string;
  purpose: IconPurpose;
  required: boolean;
  generated?: boolean;
}

export enum ImageFormat {
  PNG = 'png',
  JPG = 'jpg',
  WEBP = 'webp',
  ICO = 'ico',
  ICNS = 'icns'
}

export enum IconPurpose {
  APP_ICON = 'app_icon',
  STORE_ICON = 'store_icon',
  NOTIFICATION = 'notification',
  TOOLBAR = 'toolbar',
  MENU_BAR = 'menu_bar',
  DOCK = 'dock',
  SPOTLIGHT = 'spotlight',
  SETTINGS = 'settings',
  INSTALLER = 'installer'
}

export interface ScreenshotAsset {
  id: string;
  deviceType: DeviceType;
  orientation: Orientation;
  size: string;
  path: string;
  caption?: string;
  order: number;
  language?: string;
  required: boolean;
}

export enum DeviceType {
  DESKTOP = 'desktop',
  LAPTOP = 'laptop',
  TABLET = 'tablet',
  PHONE = 'phone',
  TV = 'tv',
  WATCH = 'watch'
}

export enum Orientation {
  PORTRAIT = 'portrait',
  LANDSCAPE = 'landscape',
  SQUARE = 'square'
}

export interface VideoAsset {
  id: string;
  type: VideoType;
  path: string;
  thumbnail: string;
  duration: number; // seconds
  format: VideoFormat;
  resolution: string;
  caption?: string;
  language?: string;
  subtitles?: SubtitleTrack[];
}

export enum VideoType {
  PREVIEW = 'preview',
  TRAILER = 'trailer',
  DEMO = 'demo',
  TUTORIAL = 'tutorial'
}

export enum VideoFormat {
  MP4 = 'mp4',
  MOV = 'mov',
  AVI = 'avi',
  WMV = 'wmv'
}

export interface SubtitleTrack {
  language: string;
  path: string;
  format: 'srt' | 'vtt' | 'ass';
}

export interface MarketingAsset {
  type: MarketingAssetType;
  path: string;
  size?: string;
  description: string;
  language?: string;
}

export enum MarketingAssetType {
  BANNER = 'banner',
  FEATURED_GRAPHIC = 'featured_graphic',
  PROMOTIONAL_GRAPHIC = 'promotional_graphic',
  HERO_IMAGE = 'hero_image',
  BACKGROUND = 'background',
  LOGO = 'logo'
}

export interface AssetMetadata {
  totalSize: number; // bytes
  compressionUsed: boolean;
  optimizationLevel: string;
  generatedAssets: string[];
  lastOptimized: Date;
  validationResults: AssetValidationResult[];
}

export interface AssetValidationResult {
  asset: string;
  valid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export interface ReleaseConfiguration {
  id: string;
  name: string;
  version: string;
  buildNumber: string;
  releaseType: ReleaseType;
  channels: ReleaseChannel[];
  automation: ReleaseAutomation;
  approval: ApprovalWorkflow;
  rollback: RollbackConfiguration;
  monitoring: ReleaseMonitoring;
}

export enum ReleaseType {
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch',
  PRERELEASE = 'prerelease',
  HOTFIX = 'hotfix'
}

export interface ReleaseChannel {
  name: string;
  platform: Platform;
  enabled: boolean;
  autoPromote: boolean;
  requirements: ReleaseRequirement[];
  audience: ChannelAudience;
}

export interface ReleaseRequirement {
  type: RequirementType;
  condition: string;
  mandatory: boolean;
  description: string;
}

export enum RequirementType {
  TESTS_PASS = 'tests_pass',
  SECURITY_SCAN = 'security_scan',
  PERFORMANCE_CHECK = 'performance_check',
  MANUAL_APPROVAL = 'manual_approval',
  MINIMUM_RATING = 'minimum_rating',
  COMPLIANCE_CHECK = 'compliance_check'
}

export interface ChannelAudience {
  type: 'internal' | 'beta' | 'public';
  size?: number;
  criteria?: AudienceCriteria;
}

export interface AudienceCriteria {
  regions?: string[];
  deviceTypes?: string[];
  osVersions?: string[];
  userSegments?: string[];
  betaTesters?: boolean;
}

export interface ReleaseAutomation {
  enabled: boolean;
  triggers: ReleaseTrigger[];
  pipeline: PipelineStage[];
  notifications: NotificationConfiguration[];
  rollbackTriggers: RollbackTrigger[];
}

export interface ReleaseTrigger {
  type: TriggerType;
  condition: string;
  branch?: string;
  tag?: string;
  schedule?: string; // cron expression
}

export enum TriggerType {
  GIT_TAG = 'git_tag',
  GIT_PUSH = 'git_push',
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  API_CALL = 'api_call',
  WEBHOOK = 'webhook'
}

export interface PipelineStage {
  name: string;
  type: StageType;
  configuration: StageConfiguration;
  dependencies: string[];
  parallel: boolean;
  optional: boolean;
  timeout: number; // minutes
}

export enum StageType {
  BUILD = 'build',
  TEST = 'test',
  SIGN = 'sign',
  VALIDATE = 'validate',
  UPLOAD = 'upload',
  SUBMIT = 'submit',
  APPROVE = 'approve',
  RELEASE = 'release',
  NOTIFY = 'notify'
}

export interface StageConfiguration {
  [key: string]: unknown;
}

export interface NotificationConfiguration {
  type: NotificationType;
  target: string;
  events: NotificationEvent[];
  template?: string;
}

export enum NotificationType {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  PUSH = 'push'
}

export enum NotificationEvent {
  RELEASE_STARTED = 'release_started',
  RELEASE_COMPLETED = 'release_completed',
  RELEASE_FAILED = 'release_failed',
  STAGE_COMPLETED = 'stage_completed',
  STAGE_FAILED = 'stage_failed',
  APPROVAL_REQUIRED = 'approval_required',
  ROLLBACK_INITIATED = 'rollback_initiated'
}

export interface RollbackTrigger {
  type: RollbackTriggerType;
  condition: string;
  automatic: boolean;
  threshold?: number;
}

export enum RollbackTriggerType {
  ERROR_RATE = 'error_rate',
  CRASH_RATE = 'crash_rate',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  MANUAL = 'manual',
  NEGATIVE_FEEDBACK = 'negative_feedback'
}

export interface ApprovalWorkflow {
  required: boolean;
  approvers: Approver[];
  stages: ApprovalStage[];
  timeouts: ApprovalTimeout[];
  escalation: EscalationRule[];
}

export interface Approver {
  id: string;
  name: string;
  email: string;
  role: ApproverRole;
  permissions: ApprovalPermission[];
}

export enum ApproverRole {
  DEVELOPER = 'developer',
  LEAD = 'lead',
  MANAGER = 'manager',
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
  BUSINESS = 'business'
}

export interface ApprovalPermission {
  action: ApprovalAction;
  platforms: Platform[];
  releaseTypes: ReleaseType[];
}

export enum ApprovalAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_CHANGES = 'request_changes',
  DELEGATE = 'delegate'
}

export interface ApprovalStage {
  name: string;
  required: boolean;
  approvers: string[];
  minimumApprovals: number;
  timeout: number; // hours
  parallelApproval: boolean;
}

export interface ApprovalTimeout {
  stage: string;
  timeout: number; // hours
  action: 'reject' | 'escalate' | 'auto_approve';
  notification: boolean;
}

export interface EscalationRule {
  condition: string;
  escalateTo: string[];
  delay: number; // hours
  maxEscalations: number;
}

export interface RollbackConfiguration {
  enabled: boolean;
  strategy: RollbackStrategy;
  preserveData: boolean;
  notifyUsers: boolean;
  automaticTriggers: RollbackTrigger[];
}

export enum RollbackStrategy {
  IMMEDIATE = 'immediate',
  GRADUAL = 'gradual',
  CANARY = 'canary',
  BLUE_GREEN = 'blue_green'
}

export interface ReleaseMonitoring {
  enabled: boolean;
  metrics: MonitoringMetric[];
  alerts: MonitoringAlert[];
  dashboards: MonitoringDashboard[];
  reports: MonitoringReport[];
}

export interface MonitoringMetric {
  name: string;
  type: MetricType;
  threshold: MetricThreshold;
  aggregation: AggregationType;
  dimensions: string[];
}

export enum MetricType {
  DOWNLOADS = 'downloads',
  INSTALLS = 'installs',
  CRASHES = 'crashes',
  ERRORS = 'errors',
  PERFORMANCE = 'performance',
  USAGE = 'usage',
  RATINGS = 'ratings',
  REVIEWS = 'reviews'
}

export interface MetricThreshold {
  warning: number;
  critical: number;
  unit: string;
  timeWindow: number; // minutes
}

export enum AggregationType {
  SUM = 'sum',
  AVERAGE = 'average',
  COUNT = 'count',
  MAX = 'max',
  MIN = 'min',
  PERCENTILE = 'percentile'
}

export interface MonitoringAlert {
  name: string;
  condition: string;
  severity: AlertSeverity;
  notifications: NotificationConfiguration[];
  suppressionRules: SuppressionRule[];
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface SuppressionRule {
  condition: string;
  duration: number; // minutes
  reason: string;
}

export interface MonitoringDashboard {
  name: string;
  widgets: DashboardWidget[];
  refreshInterval: number; // seconds
  timeRange: TimeRange;
}

export interface DashboardWidget {
  type: WidgetType;
  title: string;
  metrics: string[];
  configuration: Record<string, unknown>;
  position: WidgetPosition;
}

export enum WidgetType {
  LINE_CHART = 'line_chart',
  BAR_CHART = 'bar_chart',
  PIE_CHART = 'pie_chart',
  METRIC_CARD = 'metric_card',
  TABLE = 'table',
  HEATMAP = 'heatmap'
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
  preset?: TimeRangePreset;
}

export enum TimeRangePreset {
  LAST_HOUR = 'last_hour',
  LAST_DAY = 'last_day',
  LAST_WEEK = 'last_week',
  LAST_MONTH = 'last_month',
  CUSTOM = 'custom'
}

export interface MonitoringReport {
  name: string;
  type: ReportType;
  schedule: ReportSchedule;
  recipients: string[];
  template: string;
  filters: ReportFilter[];
}

export enum ReportType {
  PERFORMANCE = 'performance',
  USAGE = 'usage',
  REVENUE = 'revenue',
  QUALITY = 'quality',
  SECURITY = 'security'
}

export interface ReportSchedule {
  frequency: ReportFrequency;
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
}

export enum ReportFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ON_DEMAND = 'on_demand'
}

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IN = 'in',
  NOT_IN = 'not_in'
}

export interface BuildResult {
  id: string;
  configuration: AppStoreConfiguration;
  platform: Platform;
  architecture: Architecture;
  version: string;
  buildNumber: string;
  startTime: Date;
  endTime?: Date;
  status: BuildStatus;
  artifacts: BuildArtifact[];
  logs: BuildLog[];
  metrics: BuildMetrics;
  validationResults: ValidationResult[];
}

export enum BuildStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export interface BuildArtifact {
  type: ArtifactType;
  name: string;
  path: string;
  size: number;
  checksum: string;
  signed: boolean;
  uploadUrl?: string;
  downloadUrl?: string;
}

export enum ArtifactType {
  APPLICATION = 'application',
  INSTALLER = 'installer',
  SYMBOLS = 'symbols',
  LOGS = 'logs',
  METADATA = 'metadata',
  ASSETS = 'assets'
}

export interface BuildLog {
  timestamp: Date;
  level: LogLevel;
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface BuildMetrics {
  duration: number; // seconds
  buildSize: number; // bytes
  dependenciesCount: number;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  codeLines: number;
  complexity: number;
  performance: PerformanceMetrics;
}

export interface PerformanceMetrics {
  startupTime: number; // ms
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  bundleSize: number; // bytes
  loadTime: number; // ms
}

export interface ValidationResult {
  type: ValidationType;
  status: ValidationStatus;
  message: string;
  details?: ValidationDetail[];
  suggestions?: string[];
}

export enum ValidationType {
  METADATA = 'metadata',
  ASSETS = 'assets',
  SIGNING = 'signing',
  DEPENDENCIES = 'dependencies',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  COMPLIANCE = 'compliance'
}

export enum ValidationStatus {
  PASSED = 'passed',
  WARNING = 'warning',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface ValidationDetail {
  field: string;
  expected: unknown;
  actual: unknown;
  severity: ValidationSeverity;
  fix?: string;
}

export enum ValidationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface DistributionEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  platform: Platform;
  source: string;
  target?: string;
  status: EventStatus;
  message: string;
  metadata: Record<string, unknown>;
  duration?: number; // ms
}

export enum EventType {
  BUILD_STARTED = 'build_started',
  BUILD_COMPLETED = 'build_completed',
  BUILD_FAILED = 'build_failed',
  SIGNING_STARTED = 'signing_started',
  SIGNING_COMPLETED = 'signing_completed',
  VALIDATION_COMPLETED = 'validation_completed',
  UPLOAD_STARTED = 'upload_started',
  UPLOAD_COMPLETED = 'upload_completed',
  SUBMISSION_STARTED = 'submission_started',
  SUBMISSION_COMPLETED = 'submission_completed',
  APPROVAL_REQUIRED = 'approval_required',
  RELEASE_COMPLETED = 'release_completed',
  ROLLBACK_INITIATED = 'rollback_initiated'
}

export enum EventStatus {
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  IN_PROGRESS = 'in_progress'
}

export interface DistributionMetrics {
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  averageBuildTime: number;
  totalDownloads: number;
  activeInstalls: number;
  crashRate: number;
  userRating: number;
  reviewCount: number;
  revenueGenerated: number;
  conversionRate: number;
  lastUpdated: Date;
}

export interface CIConfiguration {
  provider: CIProvider;
  enabled: boolean;
  workflows: Workflow[];
  secrets: SecretConfiguration[];
  environments: EnvironmentConfiguration[];
}

export enum CIProvider {
  GITHUB_ACTIONS = 'github_actions',
  AZURE_DEVOPS = 'azure_devops',
  JENKINS = 'jenkins',
  GITLAB_CI = 'gitlab_ci',
  CIRCLECI = 'circleci',
  TRAVIS_CI = 'travis_ci'
}

export interface Workflow {
  name: string;
  trigger: WorkflowTrigger;
  jobs: Job[];
  environment?: string;
  concurrency?: ConcurrencyConfiguration;
}

export interface WorkflowTrigger {
  events: TriggerEvent[];
  branches?: string[];
  tags?: string[];
  paths?: string[];
  schedule?: string; // cron
}

export interface TriggerEvent {
  type: TriggerType;
  filters?: Record<string, unknown>;
}

export interface Job {
  name: string;
  runsOn: string;
  steps: JobStep[];
  needs?: string[];
  if?: string;
  timeout?: number; // minutes
  environment?: string;
}

export interface JobStep {
  name: string;
  uses?: string; // Action/plugin
  run?: string; // Script
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  if?: string;
}

export interface ConcurrencyConfiguration {
  group: string;
  cancelInProgress: boolean;
}

export interface SecretConfiguration {
  name: string;
  description: string;
  required: boolean;
  platforms: Platform[];
  environments?: string[];
}

export interface EnvironmentConfiguration {
  name: string;
  description: string;
  protection: EnvironmentProtection;
  secrets: string[];
  variables: Record<string, string>;
}

export interface EnvironmentProtection {
  required: boolean;
  reviewers: string[];
  deploymentBranches?: string[];
  waitTimer?: number; // minutes
}

export interface AppStoreEvent {
  id: string;
  timestamp: Date;
  type: AppStoreEventType;
  platform: Platform;
  appId: string;
  version?: string;
  status: AppStoreEventStatus;
  message: string;
  details: Record<string, unknown>;
}

export enum AppStoreEventType {
  SUBMITTED = 'submitted',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RELEASED = 'released',
  REMOVED = 'removed',
  METADATA_UPDATED = 'metadata_updated',
  PRICING_UPDATED = 'pricing_updated'
}

export enum AppStoreEventStatus {
  SUCCESS = 'success',
  PENDING = 'pending',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}