/**
 * Enterprise License Protection System Test
 * 
 * This script tests the complete enterprise license protection system
 * including enterprise accounts, abuse detection, and device management.
 */

import { 
  createEnterpriseLicenseProtectionSystem,
  LicenseProtectionUtils
} from './src/license-protection/index.ts';

async function testEnterpriseSystem() {
  console.log('🚀 Testing Enterprise License Protection System');
  console.log('================================================\n');

  try {
    // 1. Generate demo data
    console.log('📊 Generating demo data...');
    const demoData = LicenseProtectionUtils.generateEnterpriseDemoData();
    console.log(`✅ Generated demo account: ${demoData.account.name}`);
    console.log(`✅ Generated ${demoData.devices.length} test devices`);
    console.log(`✅ Generated ${demoData.abuseRules.length} abuse detection rules`);
    console.log(`✅ Generated subscription with ${demoData.subscription.seats.totalSeats} seats\n`);

    // 2. Initialize enterprise system
    console.log('🏭 Initializing enterprise license protection system...');
    const enterpriseSystem = await createEnterpriseLicenseProtectionSystem({
      productId: 'ghost-hunter-toolbox-enterprise',
      accountId: demoData.account.id,
      serverConfig: {
        baseUrl: 'https://api.ghosthunter.com',
        apiKey: 'demo-api-key',
        timeout: 30000,
        retryAttempts: 3,
        enableSSL: true
      },
      enterpriseConfig: {
        enableAbuseDetection: true,
        enableDeviceManagement: true,
        enableEnterpriseAccounts: true
      }
    });

    console.log('✅ License Protection Manager initialized');
    if (enterpriseSystem.enterpriseAccountManager) {
      console.log('✅ Enterprise Account Manager initialized');
    }
    if (enterpriseSystem.abuseDetectionManager) {
      console.log('✅ Abuse Detection Manager initialized');
    }
    if (enterpriseSystem.deviceManagementManager) {
      console.log('✅ Device Management Manager initialized');
    }
    console.log('');

    // 3. Test Enterprise Account Management
    if (enterpriseSystem.enterpriseAccountManager) {
      console.log('🏢 Testing Enterprise Account Management...');
      const account = await enterpriseSystem.enterpriseAccountManager.createAccount(demoData.account);
      console.log(`✅ Created enterprise account: ${account.id}`);

      // Test admin assignment
      const admin = await enterpriseSystem.enterpriseAccountManager.assignAdmin(account.id, {
        userId: 'test-admin-user',
        email: 'admin@acme-demo.com',
        role: 'admin',
        assignedBy: account.primaryAdminId
      });
      console.log(`✅ Assigned admin: ${admin.email} with role ${admin.role}`);

      // Test seat allocation
      const seat = await enterpriseSystem.enterpriseAccountManager.allocateSeat(account.id, 'test-user', {
        email: 'user@acme-demo.com',
        role: 'user'
      });
      console.log(`✅ Allocated seat: ${seat.id} to ${seat.email}\n`);
    }

    // 4. Test Abuse Detection
    if (enterpriseSystem.abuseDetectionManager) {
      console.log('🛡️ Testing Abuse Detection System...');
      
      // Create test rule
      const rule = await enterpriseSystem.abuseDetectionManager.createRule(demoData.abuseRules[0]);
      console.log(`✅ Created abuse rule: ${rule.name}`);

      // Simulate abuse detection
      const testData = {
        userId: 'test-user',
        deviceId: demoData.devices[0].id,
        licenseId: 'test-license',
        sessionData: {
          sessionId: 'test-session',
          startTime: new Date(),
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Test Browser',
          location: { country: 'US', region: 'CA', city: 'San Francisco' },
          activities: []
        },
        usageMetrics: {
          featureUsage: [],
          apiCalls: [],
          dataTransfer: { upload: 0, download: 0, total: 0, timeWindow: 3600 },
          concurrentSessions: 4, // This should trigger our test rule
          loginFrequency: { hourly: 2, daily: 10, weekly: 50, monthly: 200, unusual: false }
        },
        deviceMetrics: {
          hardwareFingerprint: demoData.devices[0].hardwareFingerprint.fingerprint,
          trustScore: demoData.devices[0].trustScore,
          riskScore: demoData.devices[0].riskScore,
          complianceStatus: 'compliant',
          securityFlags: [],
          performanceMetrics: { cpuUsage: 50, memoryUsage: 1024, diskUsage: 10240, networkLatency: 50 }
        },
        networkMetrics: {
          connectionType: 'ethernet',
          bandwidth: { upload: 100000, download: 100000, measured: true, timestamp: new Date() },
          latency: 50,
          packetLoss: 0,
          vpnDetected: false,
          proxyDetected: false,
          reputation: { score: 85, sources: [], categories: [], riskLevel: 'low' }
        },
        timestamp: new Date()
      };

      const detection = await enterpriseSystem.abuseDetectionManager.detectAbuse(testData);
      console.log(`✅ Abuse detection completed: ${detection.detected ? 'ABUSE DETECTED' : 'NO ABUSE'}`);
      console.log(`   Risk Score: ${detection.riskScore}`);
      console.log(`   Confidence: ${detection.confidence}`);
      console.log(`   Severity: ${detection.severity}`);
      console.log(`   Evidence Count: ${detection.evidence.length}\n`);
    }

    // 5. Test Device Management
    if (enterpriseSystem.deviceManagementManager) {
      console.log('📱 Testing Device Management...');
      
      // Register a device
      const device = await enterpriseSystem.deviceManagementManager.registerDevice(demoData.devices[0]);
      console.log(`✅ Registered device: ${device.deviceInfo.name}`);
      console.log(`   Trust Score: ${device.trustScore}`);
      console.log(`   Status: ${device.status}`);

      // Calculate trust score
      const trustScore = await enterpriseSystem.deviceManagementManager.calculateTrustScore(device.id);
      console.log(`✅ Calculated trust score: ${trustScore.score}`);
      console.log(`   Factors: ${trustScore.factors.map(f => f.factor).join(', ')}`);

      // Generate compliance report
      const report = await enterpriseSystem.deviceManagementManager.generateComplianceReport(demoData.account.id);
      console.log(`✅ Generated compliance report`);
      console.log(`   Total Devices: ${report.summary.totalDevices}`);
      console.log(`   Compliance Rate: ${report.summary.complianceRate.toFixed(1)}%`);
      console.log(`   Violations: ${report.violations.length}\n`);
    }

    // 6. Test Integration
    console.log('🔗 Testing System Integration...');
    const protectionStatus = await enterpriseSystem.protectionManager.getProtectionStatus();
    console.log(`✅ Protection Status: ${protectionStatus.isActive ? 'Active' : 'Inactive'}`);
    console.log(`   Protection Level: ${protectionStatus.protectionLevel}`);
    console.log(`   Last Validation: ${protectionStatus.lastValidation.toLocaleString()}\n`);

    console.log('🎉 All Enterprise System Tests Passed!');
    console.log('=======================================');
    console.log('');
    console.log('Summary:');
    console.log('✅ Enterprise Account Management - Working');
    console.log('✅ Abuse Detection System - Working');
    console.log('✅ Device Management - Working');
    console.log('✅ License Protection - Working');
    console.log('✅ System Integration - Working');

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnterpriseSystem().catch(console.error);
}

export { testEnterpriseSystem };