#!/usr/bin/env node
// scripts/validate-data.js
// Validates SHORTCUTS_DB in data.js: required fields, duplicate detection,
// and computes real counts from records rather than trusting any stored number.
// Exit code 1 on any error-level finding.

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data.js');
const code = fs.readFileSync(dataPath, 'utf8') + '\nmodule.exports = SHORTCUTS_DB;';
const tmp = path.join(require('os').tmpdir(), 'skw_data_validate.js');
fs.writeFileSync(tmp, code);
const db = require(tmp);

const REQUIRED_FIELDS = ['keys', 'action', 'category', 'description'];
const errors = [];
const warnings = [];

let totalShortcuts = 0;
const platformCounts = {};
const appReport = [];

for (const [appId, app] of Object.entries(db)) {
    if (!app.name) errors.push(`[${appId}] missing app "name"`);
    if (!app.platform) errors.push(`[${appId}] missing app "platform"`);
    if (!Array.isArray(app.shortcuts)) {
        errors.push(`[${appId}] "shortcuts" is not an array`);
        continue;
    }

    const seenKeys = new Map(); // keys+category -> count, for duplicate detection within this app
    let validCount = 0;

    app.shortcuts.forEach((s, idx) => {
        const loc = `[${appId}][${idx}]`;
        let recordValid = true;

        for (const field of REQUIRED_FIELDS) {
            if (!s[field] || typeof s[field] !== 'string' || !s[field].trim()) {
                errors.push(`${loc} missing/empty required field "${field}"`);
                recordValid = false;
            }
        }

        if (s.keys) {
            const dupKey = `${s.keys.trim().toLowerCase()}::${(s.category || '').trim().toLowerCase()}`;
            if (seenKeys.has(dupKey)) {
                errors.push(`${loc} duplicate shortcut "${s.keys}" in category "${s.category}" (first seen at index ${seenKeys.get(dupKey)})`);
                recordValid = false;
            } else {
                seenKeys.set(dupKey, idx);
            }
        }

        if (recordValid) validCount++;
    });

    totalShortcuts += validCount;
    platformCounts[app.platform] = (platformCounts[app.platform] || 0) + validCount;
    appReport.push({ appId, name: app.name, platform: app.platform, declaredLength: app.shortcuts.length, validCount });
}

// Cross-check: does any app's raw array length differ from its valid count?
appReport.forEach(a => {
    if (a.declaredLength !== a.validCount) {
        warnings.push(`[${a.appId}] ${a.declaredLength - a.validCount} record(s) failed validation and were excluded from the valid count`);
    }
});

console.log('=== ShortcutKeyWala Data Validation ===\n');
console.log('Apps:', appReport.length);
console.log('Valid shortcuts (computed from records, not stored counts):', totalShortcuts);
console.log('\nPer-platform valid counts:');
Object.entries(platformCounts).sort().forEach(([p, c]) => console.log(`  ${p}: ${c}`));
console.log('\nPer-app breakdown:');
appReport.forEach(a => console.log(`  ${a.appId.padEnd(16)} ${a.name.padEnd(20)} platform=${a.platform.padEnd(8)} valid=${a.validCount}`));

if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    warnings.forEach(w => console.log('  WARN:', w));
}

if (errors.length) {
    console.log(`\n${errors.length} error(s):`);
    errors.forEach(e => console.log('  ERROR:', e));
    console.log('\nFAILED');
    process.exit(1);
} else {
    console.log('\nNo errors found. PASSED');
    process.exit(0);
}
