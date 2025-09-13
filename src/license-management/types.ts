/**
 * License Management & Compliance Types
 * Comprehensive type definitions for license tracking, dependency auditing, and legal compliance
 */

export interface ThirdPartyLibrary {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  repository?: RepositoryInfo;
  author?: string | AuthorInfo;
  maintainers?: AuthorInfo[];
  license: LicenseInfo;
  dependencies?: ThirdPartyLibrary[];
  devDependencies?: ThirdPartyLibrary[];
  installedAt: Date;
  lastUpdated?: Date;
  packageManager: PackageManager;
  category: LibraryCategory;
  usage: LibraryUsage;
  riskLevel: RiskLevel;
}

export interface RepositoryInfo {
  type: 'git' | 'svn' | 'hg' | 'other';
  url: string;
  directory?: string;
}

export interface AuthorInfo {
  name: string;
  email?: string;
  url?: string;
}

export interface LicenseInfo {
  type: string; // e.g., 'MIT', 'Apache-2.0', 'GPL-3.0'
  name: string;
  url?: string;
  text?: string;
  file?: string;
  spdxId?: string;
  compatibility: LicenseCompatibility;
  restrictions: LicenseRestriction[];
  obligations: LicenseObligation[];
  commercialUse: boolean;
  copyleftType?: CopyleftType;
}

export enum PackageManager {
  NPM = 'npm',
  YARN = 'yarn',
  PNPM = 'pnpm',
  BOWER = 'bower',
  COMPOSER = 'composer',
  PIP = 'pip',
  CARGO = 'cargo',
  NUGET = 'nuget',
  MAVEN = 'maven',
  GRADLE = 'gradle',
  MANUAL = 'manual'
}

export enum LibraryCategory {
  PRODUCTION = 'production',
  DEVELOPMENT = 'development',
  TESTING = 'testing',
  BUILD_TOOL = 'build_tool',
  SECURITY = 'security',
  UI_FRAMEWORK = 'ui_framework',
  UTILITY = 'utility',
  DATABASE = 'database',
  NETWORK = 'network',
  CRYPTO = 'crypto',
  MEDIA = 'media',
  DOCUMENTATION = 'documentation'
}

export enum LibraryUsage {
  DIRECT = 'direct',
  TRANSITIVE = 'transitive',
  OPTIONAL = 'optional',
  PEER = 'peer',
  BUNDLED = 'bundled'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum LicenseCompatibility {
  COMPATIBLE = 'compatible',
  CONDITIONALLY_COMPATIBLE = 'conditionally_compatible',
  INCOMPATIBLE = 'incompatible',
  UNKNOWN = 'unknown'
}

export interface LicenseRestriction {
  type: RestrictionType;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export enum RestrictionType {
  COPYLEFT = 'copyleft',
  ATTRIBUTION_REQUIRED = 'attribution_required',
  SHARE_ALIKE = 'share_alike',
  NO_COMMERCIAL_USE = 'no_commercial_use',
  NO_DERIVATIVES = 'no_derivatives',
  PATENT_GRANT = 'patent_grant',
  TRADEMARK_USE = 'trademark_use',
  DISTRIBUTION_NOTICE = 'distribution_notice'
}

export interface LicenseObligation {
  type: ObligationType;
  description: string;
  required: boolean;
  fulfilled?: boolean;
  evidence?: string;
}

export enum ObligationType {
  INCLUDE_LICENSE = 'include_license',
  INCLUDE_COPYRIGHT = 'include_copyright',
  INCLUDE_NOTICE = 'include_notice',
  PROVIDE_SOURCE = 'provide_source',
  DISCLOSE_SOURCE = 'disclose_source',
  TRACK_CHANGES = 'track_changes',
  STATE_CHANGES = 'state_changes',
  RENAME_BINARY = 'rename_binary'
}

export enum CopyleftType {
  NONE = 'none',
  WEAK = 'weak',
  STRONG = 'strong',
  NETWORK = 'network'
}

export interface LicensePolicy {
  id: string;
  name: string;
  description: string;
  allowedLicenses: string[];
  prohibitedLicenses: string[];
  conditionalLicenses: ConditionalLicense[];
  riskThresholds: RiskThresholds;
  obligations: PolicyObligation[];
  approvalRequired: string[]; // License types requiring manual approval
  autoApprove: string[]; // License types automatically approved
  createdAt: Date;
  updatedAt: Date;
}

export interface ConditionalLicense {
  licenseType: string;
  conditions: LicenseCondition[];
  allowed: boolean;
  reason: string;
}

export interface LicenseCondition {
  type: 'usage' | 'category' | 'commercial' | 'distribution' | 'modification';
  value: unknown;
  operator: 'equals' | 'not_equals' | 'contains' | 'excludes';
}

export interface RiskThresholds {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface PolicyObligation {
  type: ObligationType;
  description: string;
  mandatory: boolean;
  licenseTypes: string[];
  automationLevel: AutomationLevel;
}

export enum AutomationLevel {
  MANUAL = 'manual',
  SEMI_AUTOMATED = 'semi_automated',
  FULLY_AUTOMATED = 'fully_automated'
}

export interface ComplianceReport {
  id: string;
  generatedAt: Date;
  projectName: string;
  projectVersion: string;
  reportType: ReportType;
  scope: ReportScope;
  summary: ComplianceSummary;
  libraries: LibraryComplianceInfo[];
  violations: ComplianceViolation[];
  obligations: ObligationStatus[];
  recommendations: ComplianceRecommendation[];
  attachments: ReportAttachment[];
}

export enum ReportType {
  FULL_AUDIT = 'full_audit',
  DELTA_AUDIT = 'delta_audit',
  LICENSE_INVENTORY = 'license_inventory',
  COMPLIANCE_CHECK = 'compliance_check',
  RISK_ASSESSMENT = 'risk_assessment',
  OBLIGATION_TRACKING = 'obligation_tracking'
}

export interface ReportScope {
  includeProduction: boolean;
  includeDevelopment: boolean;
  includeTesting: boolean;
  includeTransitive: boolean;
  maxDepthLevel?: number;
  excludePatterns?: string[];
}

export interface ComplianceSummary {
  totalLibraries: number;
  uniqueLicenses: number;
  compliantLibraries: number;
  violatingLibraries: number;
  unknownLicenseLibraries: number;
  highRiskLibraries: number;
  obligationsFulfilled: number;
  obligationsPending: number;
  overallScore: number; // 0-100
  riskDistribution: Record<RiskLevel, number>;
  licenseDistribution: Record<string, number>;
}

export interface LibraryComplianceInfo {
  library: ThirdPartyLibrary;
  complianceStatus: ComplianceStatus;
  riskAssessment: RiskAssessment;
  obligations: ObligationStatus[];
  issues: ComplianceIssue[];
  lastAuditDate: Date;
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  CONDITIONALLY_COMPLIANT = 'conditionally_compliant',
  UNDER_REVIEW = 'under_review',
  UNKNOWN = 'unknown'
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  factors: RiskFactor[];
  mitigations: RiskMitigation[];
  score: number; // 0-100
}

export interface RiskFactor {
  type: RiskFactorType;
  description: string;
  impact: RiskLevel;
  likelihood: 'low' | 'medium' | 'high';
  score: number;
}

export enum RiskFactorType {
  LICENSE_INCOMPATIBILITY = 'license_incompatibility',
  COPYLEFT_CONTAMINATION = 'copyleft_contamination',
  PATENT_RISK = 'patent_risk',
  SECURITY_VULNERABILITY = 'security_vulnerability',
  MAINTENANCE_RISK = 'maintenance_risk',
  LEGAL_UNCERTAINTY = 'legal_uncertainty',
  COMMERCIAL_RESTRICTION = 'commercial_restriction'
}

export interface RiskMitigation {
  type: MitigationType;
  description: string;
  effort: 'low' | 'medium' | 'high';
  effectiveness: number; // 0-100
  implemented: boolean;
}

export enum MitigationType {
  LICENSE_REPLACEMENT = 'license_replacement',
  USAGE_RESTRICTION = 'usage_restriction',
  LEGAL_REVIEW = 'legal_review',
  VERSION_DOWNGRADE = 'version_downgrade',
  ALTERNATIVE_LIBRARY = 'alternative_library',
  COMMERCIAL_LICENSE = 'commercial_license',
  CLEAN_ROOM_IMPLEMENTATION = 'clean_room_implementation'
}

export interface ObligationStatus {
  obligation: LicenseObligation;
  status: ObligationStatusType;
  dueDate?: Date;
  completedDate?: Date;
  assignee?: string;
  progress: number; // 0-100
  evidence: ObligationEvidence[];
  blockers?: string[];
}

export enum ObligationStatusType {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  WAIVED = 'waived',
  NOT_APPLICABLE = 'not_applicable'
}

export interface ObligationEvidence {
  type: 'file' | 'document' | 'url' | 'screenshot' | 'certificate';
  path?: string;
  url?: string;
  description: string;
  uploadedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export interface ComplianceViolation {
  id: string;
  library: string;
  version: string;
  violationType: ViolationType;
  severity: RiskLevel;
  description: string;
  recommendation: string;
  detectedAt: Date;
  resolvedAt?: Date;
  status: ViolationStatus;
  assignee?: string;
  dueDate?: Date;
}

export enum ViolationType {
  PROHIBITED_LICENSE = 'prohibited_license',
  LICENSE_INCOMPATIBILITY = 'license_incompatibility',
  MISSING_ATTRIBUTION = 'missing_attribution',
  UNFULFILLED_OBLIGATION = 'unfulfilled_obligation',
  COPYLEFT_VIOLATION = 'copyleft_violation',
  COMMERCIAL_USE_VIOLATION = 'commercial_use_violation',
  PATENT_VIOLATION = 'patent_violation'
}

export enum ViolationStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  WAIVED = 'waived',
  FALSE_POSITIVE = 'false_positive'
}

export interface ComplianceIssue {
  type: IssueType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
  autoFixable: boolean;
}

export enum IssueType {
  UNKNOWN_LICENSE = 'unknown_license',
  AMBIGUOUS_LICENSE = 'ambiguous_license',
  OUTDATED_VERSION = 'outdated_version',
  DEPRECATED_LIBRARY = 'deprecated_library',
  SECURITY_VULNERABILITY = 'security_vulnerability',
  MAINTENANCE_CONCERN = 'maintenance_concern'
}

export interface ComplianceRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: RecommendationCategory;
  title: string;
  description: string;
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  libraries?: string[];
  dueDate?: Date;
}

export enum RecommendationCategory {
  LICENSE_POLICY = 'license_policy',
  LIBRARY_REPLACEMENT = 'library_replacement',
  OBLIGATION_FULFILLMENT = 'obligation_fulfillment',
  RISK_MITIGATION = 'risk_mitigation',
  PROCESS_IMPROVEMENT = 'process_improvement',
  TOOLING_ENHANCEMENT = 'tooling_enhancement'
}

export interface ReportAttachment {
  name: string;
  path: string;
  type: string;
  size: number;
  description?: string;
  createdAt: Date;
}

export interface DependencyAudit {
  id: string;
  startTime: Date;
  endTime: Date;
  projectPath: string;
  packageManagers: PackageManager[];
  scope: AuditScope;
  results: AuditResult[];
  summary: AuditSummary;
}

export interface AuditScope {
  includeDevDependencies: boolean;
  includePeerDependencies: boolean;
  includeOptionalDependencies: boolean;
  maxDepth?: number;
  excludePackages?: string[];
}

export interface AuditResult {
  library: ThirdPartyLibrary;
  changes: LibraryChange[];
  recommendations: AuditRecommendation[];
}

export interface LibraryChange {
  type: ChangeType;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  impact: 'low' | 'medium' | 'high';
}

export enum ChangeType {
  ADDED = 'added',
  REMOVED = 'removed',
  UPDATED = 'updated',
  LICENSE_CHANGED = 'license_changed',
  VERSION_CHANGED = 'version_changed'
}

export interface AuditRecommendation {
  type: RecommendationType;
  description: string;
  priority: 'low' | 'medium' | 'high';
  action: string;
}

export enum RecommendationType {
  UPDATE_LIBRARY = 'update_library',
  REPLACE_LIBRARY = 'replace_library',
  REVIEW_LICENSE = 'review_license',
  SECURITY_UPDATE = 'security_update',
  DEPRECATION_WARNING = 'deprecation_warning'
}

export interface AuditSummary {
  totalLibraries: number;
  newLibraries: number;
  updatedLibraries: number;
  removedLibraries: number;
  licenseChanges: number;
  securityIssues: number;
  complianceIssues: number;
}

export interface LegalComplianceConfig {
  projectType: ProjectType;
  distributionMethod: DistributionMethod;
  commercialUse: boolean;
  jurisdiction: string;
  policies: string[]; // Policy IDs
  autoApprovalEnabled: boolean;
  riskTolerance: RiskLevel;
  notificationSettings: NotificationSettings;
  integrations: IntegrationConfig[];
}

export enum ProjectType {
  OPEN_SOURCE = 'open_source',
  PROPRIETARY = 'proprietary',
  COMMERCIAL = 'commercial',
  INTERNAL_TOOL = 'internal_tool',
  RESEARCH = 'research',
  EDUCATIONAL = 'educational'
}

export enum DistributionMethod {
  BINARY_ONLY = 'binary_only',
  SOURCE_INCLUDED = 'source_included',
  SaaS = 'saas',
  INTERNAL_ONLY = 'internal_only',
  API_SERVICE = 'api_service'
}

export interface NotificationSettings {
  email: boolean;
  slack: boolean;
  webhook: boolean;
  desktop: boolean;
  channels: NotificationChannel[];
  thresholds: NotificationThreshold[];
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'desktop';
  target: string;
  events: NotificationEvent[];
}

export enum NotificationEvent {
  VIOLATION_DETECTED = 'violation_detected',
  OBLIGATION_DUE = 'obligation_due',
  REPORT_GENERATED = 'report_generated',
  POLICY_UPDATED = 'policy_updated',
  AUDIT_COMPLETED = 'audit_completed',
  APPROVAL_REQUIRED = 'approval_required'
}

export interface NotificationThreshold {
  event: NotificationEvent;
  severity: RiskLevel;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

export interface IntegrationConfig {
  type: IntegrationType;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export enum IntegrationType {
  JIRA = 'jira',
  GITHUB = 'github',
  GITLAB = 'gitlab',
  SLACK = 'slack',
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  LEGAL_REVIEW_TOOL = 'legal_review_tool'
}

export interface LicenseApproval {
  id: string;
  library: string;
  version: string;
  licenseType: string;
  requestedBy: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  status: ApprovalStatus;
  justification: string;
  conditions?: string[];
  expiresAt?: Date;
  reviewNotes?: string;
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CONDITIONAL = 'conditional',
  EXPIRED = 'expired'
}

export interface LicenseTemplate {
  id: string;
  name: string;
  type: string;
  template: string;
  variables: TemplateVariable[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'date' | 'boolean' | 'number';
  description: string;
  required: boolean;
  defaultValue?: unknown;
}

export interface LicenseMetrics {
  totalLibraries: number;
  licenseDistribution: Record<string, number>;
  complianceScore: number;
  riskScore: number;
  obligationsCompleted: number;
  obligationsPending: number;
  violationsOpen: number;
  violationsResolved: number;
  lastAuditDate?: Date;
  trendsOverTime: MetricsTrend[];
}

export interface MetricsTrend {
  date: Date;
  totalLibraries: number;
  complianceScore: number;
  riskScore: number;
}

export interface LicenseEvent {
  id: string;
  timestamp: Date;
  type: LicenseEventType;
  library?: string;
  version?: string;
  licenseType?: string;
  userId?: string;
  description: string;
  metadata: Record<string, unknown>;
}

export enum LicenseEventType {
  LIBRARY_ADDED = 'library_added',
  LIBRARY_REMOVED = 'library_removed',
  LIBRARY_UPDATED = 'library_updated',
  LICENSE_CHANGED = 'license_changed',
  VIOLATION_DETECTED = 'violation_detected',
  VIOLATION_RESOLVED = 'violation_resolved',
  OBLIGATION_CREATED = 'obligation_created',
  OBLIGATION_COMPLETED = 'obligation_completed',
  POLICY_UPDATED = 'policy_updated',
  APPROVAL_REQUESTED = 'approval_requested',
  APPROVAL_GRANTED = 'approval_granted',
  AUDIT_COMPLETED = 'audit_completed',
  REPORT_GENERATED = 'report_generated'
}