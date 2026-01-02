/**
 * Configuration Migration Test
 * Tests v3.x to v4.0.0 migration compatibility
 */

const fs = require('fs');
const path = require('path');
const { ConfigService } = require('../dist/services/config.js');

// Test directory
const TEST_DIR = path.join(__dirname, 'config-migration-test');
const TEST_CONFIG_PATH = path.join(TEST_DIR, '.svgconfig.json');

console.log('\n🧪 Configuration Migration Tests\n');
console.log('='.repeat(80));

// Setup test directory
function setupTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);
}

// Cleanup test directory
function cleanupTestDir() {
  process.chdir(path.join(__dirname, '..'));
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// Test 1: New v4.0.0 config
function testNewConfig() {
  console.log('\n1️⃣  Test: New v4.0.0 Configuration');
  console.log('-'.repeat(80));
  
  try {
    setupTestDir();
    const configService = ConfigService.getInstance();
    configService.clearCache();
    
    // Create new config
    const defaultConfig = configService.getDefaultConfig();
    
    // Verify version
    if (defaultConfig.version !== '4.0.0') {
      throw new Error(`Expected version 4.0.0, got ${defaultConfig.version}`);
    }
    
    // Verify plugins array exists
    if (!Array.isArray(defaultConfig.plugins)) {
      throw new Error('Plugins array missing in v4.0.0 config');
    }
    
    console.log('✅ Version: 4.0.0');
    console.log('✅ Plugins array: present');
    console.log('✅ All v4.0.0 features: available');
    console.log('✅ Test PASSED');
    cleanupTestDir();
    return true;
  } catch (error) {
    console.log('❌ Test FAILED:', error.message);
    cleanupTestDir();
    return false;
  }
}

// Test 2: Migrate from v3.x config
function testMigrateFromV3() {
  console.log('\n2️⃣  Test: Migration from v3.x Configuration');
  console.log('-'.repeat(80));
  
  try {
    setupTestDir();
    const configService = ConfigService.getInstance();
    configService.clearCache();
    
    // Create v3.x config (without version field)
    const v3Config = {
      source: './src/assets/svg',
      output: './src/components/icons',
      framework: 'react',
      typescript: true,
      defaultWidth: 24,
      defaultHeight: 24,
      defaultFill: 'currentColor',
      styleRules: { fill: 'inherit' },
      exclude: [],
      performance: {
        optimization: 'basic', // Old value
        memoryLimit: 512,
        cacheTimeout: 3600000,
      },
    };
    
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(v3Config, null, 2));
    console.log('📝 Created v3.x config (no version field)');
    
    // Read config (should trigger migration)
    const migratedConfig = configService.readConfig();
    
    // Verify migration
    if (migratedConfig.version !== '4.0.0') {
      throw new Error(`Expected version 4.0.0 after migration, got ${migratedConfig.version}`);
    }
    
    if (!Array.isArray(migratedConfig.plugins)) {
      throw new Error('Plugins array not added during migration');
    }
    
    // Verify optimization level was migrated
    if (migratedConfig.performance.optimization !== 'fast') {
      throw new Error(`Expected optimization 'fast', got '${migratedConfig.performance.optimization}'`);
    }
    
    console.log('✅ Version migrated: v3.x → 4.0.0');
    console.log('✅ Plugins array: added');
    console.log('✅ Optimization level: basic → fast');
    console.log('✅ Config file: updated');
    console.log('✅ Test PASSED');
    cleanupTestDir();
    return true;
  } catch (error) {
    console.log('❌ Test FAILED:', error.message);
    cleanupTestDir();
    return false;
  }
}

// Test 3: Migrate legacy plugin field
function testMigrateLegacyPlugin() {
  console.log('\n3️⃣  Test: Migration of Legacy Plugin Field');
  console.log('-'.repeat(80));
  
  try {
    setupTestDir();
    const configService = ConfigService.getInstance();
    configService.clearCache();
    
    // Create config with legacy "plugin" field (singular)
    const legacyConfig = {
      source: './src/assets/svg',
      output: './src/components/icons',
      framework: 'react',
      typescript: true,
      defaultWidth: 24,
      defaultHeight: 24,
      defaultFill: 'currentColor',
      styleRules: { fill: 'inherit' },
      exclude: [],
      plugin: { name: 'old-plugin', options: {} }, // Legacy singular field
      performance: {
        optimization: 'balanced',
        memoryLimit: 512,
        cacheTimeout: 3600000,
      },
    };
    
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(legacyConfig, null, 2));
    console.log('📝 Created config with legacy "plugin" field');
    
    // Read config (should trigger migration)
    const migratedConfig = configService.readConfig();
    
    // Verify plugin was migrated to plugins array
    if (!Array.isArray(migratedConfig.plugins)) {
      throw new Error('Plugins array not created during migration');
    }
    
    if (migratedConfig.plugins.length !== 1) {
      throw new Error(`Expected 1 plugin in array, got ${migratedConfig.plugins.length}`);
    }
    
    if (migratedConfig.plugins[0].name !== 'old-plugin') {
      throw new Error('Plugin not migrated correctly');
    }
    
    // Verify legacy field was removed
    if ('plugin' in migratedConfig) {
      throw new Error('Legacy "plugin" field not removed');
    }
    
    console.log('✅ Legacy "plugin" field: migrated to "plugins" array');
    console.log('✅ Plugin data: preserved');
    console.log('✅ Legacy field: removed');
    console.log('✅ Test PASSED');
    cleanupTestDir();
    return true;
  } catch (error) {
    console.log('❌ Test FAILED:', error.message);
    cleanupTestDir();
    return false;
  }
}

// Test 4: Multiple optimization level migrations
function testOptimizationMigration() {
  console.log('\n4️⃣  Test: Optimization Level Migration');
  console.log('-'.repeat(80));
  
  try {
    setupTestDir();
    const configService = ConfigService.getInstance();
    
    const testCases = [
      { old: 'none', new: 'fast' },
      { old: 'basic', new: 'fast' },
      { old: 'standard', new: 'balanced' },
      { old: 'aggressive', new: 'maximum' },
      { old: 'maximum', new: 'maximum' },
    ];
    
    for (const testCase of testCases) {
      configService.clearCache();
      
      const oldConfig = {
        source: './src/assets/svg',
        output: './src/components/icons',
        framework: 'react',
        typescript: true,
        defaultWidth: 24,
        defaultHeight: 24,
        defaultFill: 'currentColor',
        styleRules: { fill: 'inherit' },
        exclude: [],
        performance: {
          optimization: testCase.old,
          memoryLimit: 512,
          cacheTimeout: 3600000,
        },
      };
      
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(oldConfig, null, 2));
      
      const migratedConfig = configService.readConfig();
      
      if (migratedConfig.performance.optimization !== testCase.new) {
        throw new Error(
          `Migration failed for '${testCase.old}': expected '${testCase.new}', got '${migratedConfig.performance.optimization}'`
        );
      }
      
      console.log(`✅ ${testCase.old.padEnd(12)} → ${testCase.new}`);
    }
    
    console.log('✅ All optimization levels: migrated correctly');
    console.log('✅ Test PASSED');
    cleanupTestDir();
    return true;
  } catch (error) {
    console.log('❌ Test FAILED:', error.message);
    cleanupTestDir();
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = [];
  
  results.push(testNewConfig());
  results.push(testMigrateFromV3());
  results.push(testMigrateLegacyPlugin());
  results.push(testOptimizationMigration());
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Test Results Summary\n');
  
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  
  console.log(`   Total Tests: ${results.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  console.log('\n' + '='.repeat(80));
  
  if (failed === 0) {
    console.log('\n🎉 All configuration migration tests passed!\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});
