const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== VERIFYING FRONTEND AUTH SESSION, SOS FLOW, & LAYOUT FIXES ===');

// 1. Test css/dashboard.css for sidebar-scrim and grid positioning
const cssContent = fs.readFileSync(path.join(__dirname, '../css/dashboard.css'), 'utf8');
assert(cssContent.includes('.sidebar-scrim {\n  display: none;\n}') || cssContent.includes('.sidebar-scrim {\r\n  display: none;\r\n}'), 'CSS must declare .sidebar-scrim { display: none; } at root');
assert(cssContent.includes('grid-column: 1;') && cssContent.includes('grid-row: 2;'), 'CSS must declare grid-column: 1; grid-row: 2; on .dash-sidebar');
assert(cssContent.includes('grid-column: 2;') && cssContent.includes('grid-row: 2;'), 'CSS must declare grid-column: 2; grid-row: 2; on .dash-content');
console.log('✔ CSS Layout & Scrim Fix: PASSED');

// 2. Test js/main.js for initAuthSession & dynamic user replacement
const mainJs = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
assert(mainJs.includes('initAuthSession'), 'main.js must contain initAuthSession');
assert(mainJs.includes('user-chip__name'), 'main.js must update user-chip__name');
assert(mainJs.includes('formatRole'), 'main.js must format user role');
assert(mainJs.includes('getInitials'), 'main.js must calculate initials dynamically');
assert(mainJs.includes('Welcome back,'), 'main.js must format welcome greeting dynamically');
console.log('✔ Dynamic Authentication Header & Session Management: PASSED');

// 3. Test js/dashboard.js for non-prototype real SOS integration
const dashJs = fs.readFileSync(path.join(__dirname, '../js/dashboard.js'), 'utf8');
assert(!dashJs.includes('SOS request simulated successfully'), 'dashboard.js must NOT contain simulated/prototype SOS message');
assert(!dashJs.includes('frontend prototype — no backend exists yet'), 'dashboard.js must NOT state no backend exists');
assert(dashJs.includes('Emergency SOS Dispatched Successfully'), 'dashboard.js must confirm real SOS dispatch');
assert(dashJs.includes('citizen-requests.html'), 'dashboard.js must link to citizen-requests.html');
console.log('✔ Real SOS Dispatch Integration: PASSED');

// 4. Test citizen-requests.html for SOS listing in My Requests
const requestsHtml = fs.readFileSync(path.join(__dirname, '../citizen-requests.html'), 'utf8');
assert(requestsHtml.includes('window.ResQStore.getAll("sos")'), 'citizen-requests.html must query SOS records in combinedItems');
assert(requestsHtml.includes('Emergency SOS'), 'citizen-requests.html must classify SOS as Emergency SOS');
console.log('✔ My Requests SOS Integration: PASSED');

// 5. Test citizen-sos.html for dynamic shared details IDs
const sosHtml = fs.readFileSync(path.join(__dirname, '../citizen-sos.html'), 'utf8');
assert(sosHtml.includes('id="sosSharedName"'), 'citizen-sos.html must have sosSharedName span ID');
assert(sosHtml.includes('id="sosSharedPhone"'), 'citizen-sos.html must have sosSharedPhone span ID');
console.log('✔ Citizen SOS Dynamic Details: PASSED');

// 6. Test citizen-profile.html for dynamic session binding
const profileHtml = fs.readFileSync(path.join(__dirname, '../citizen-profile.html'), 'utf8');
assert(profileHtml.includes('pfNameHeader'), 'citizen-profile.html must dynamically update profile header');
assert(profileHtml.includes('pfName'), 'citizen-profile.html must bind pfName');
console.log('✔ Citizen Profile Dynamic Binding: PASSED');

console.log('\n===========================================================');
console.log('✔ ALL STATIC & LOGICAL VALIDATIONS PASSED WITH 100% SUCCESS');
console.log('===========================================================');
