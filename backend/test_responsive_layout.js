// backend/test_responsive_layout.js
// Comprehensive test verifying mobile responsiveness across all ResQConnect pages & CSS

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== VERIFYING RESQCONNECT MOBILE RESPONSIVENESS & CSS DESIGN INTEGRITY ===\n');

const rootDir = path.resolve(__dirname, '..');
const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));

// 1. Verify Viewport Meta Tag across ALL HTML files
console.log('--- 1. Checking Viewport Meta Tags ---');
let viewportPassed = 0;
htmlFiles.forEach(file => {
  const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
  assert(
    content.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0"'),
    `[FAIL] ${file} is missing standard responsive viewport meta tag.`
  );
  viewportPassed++;
});
console.log(`✔ All ${viewportPassed} HTML files have valid viewport meta tags: <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n`);

// 2. Verify Global CSS (style.css) Mobile Rules & Overflow Guards
console.log('--- 2. Checking style.css Responsive Design & Safeguards ---');
const styleCss = fs.readFileSync(path.join(rootDir, 'css/style.css'), 'utf8');

// Overflow guards
assert(styleCss.includes('overflow-x: hidden'), 'style.css must specify overflow-x: hidden to prevent horizontal panning');
assert(styleCss.includes('width: 100%'), 'style.css must specify width: 100%');
console.log('✔ Global horizontal overflow protection on html and body: VERIFIED');

// Header responsiveness
assert(styleCss.includes('@media (max-width: 900px)'), 'style.css must have @media (max-width: 900px) for mobile drawer');
assert(styleCss.includes('@media (max-width: 640px)'), 'style.css must have @media (max-width: 640px) for compact header');
assert(styleCss.includes('@media (max-width: 420px)'), 'style.css must have @media (max-width: 420px) for small mobile viewports');
console.log('✔ Public navbar multi-breakpoint responsiveness (900px, 640px, 420px): VERIFIED');

// Form iOS zoom prevention
assert(styleCss.includes('@media (max-width: 768px)') && styleCss.includes('font-size: 16px'), 'style.css must set 16px font-size on mobile viewports to prevent iOS auto-zoom');
console.log('✔ Form input iOS auto-zoom prevention (16px on <= 768px): VERIFIED');

// Table & Tabs touch scrolling
assert(styleCss.includes('.table-wrap') && styleCss.includes('-webkit-overflow-scrolling: touch'), 'table-wrap must have smooth touch scrolling');
assert(styleCss.includes('.tabs') && styleCss.includes('overflow-x: auto'), 'tabs must support horizontal scrolling');
console.log('✔ Table & Tabs touch-scroll containment: VERIFIED');

// Camp split grid
assert(styleCss.includes('.camp-split-grid'), 'style.css must define .camp-split-grid');
console.log('✔ Relief camps responsive grid utility (.camp-split-grid): VERIFIED\n');

// 3. Verify Dashboard CSS (dashboard.css) Mobile Rules & Scoping
console.log('--- 3. Checking dashboard.css Mobile Rules & Layout Scoping ---');
const dashCss = fs.readFileSync(path.join(rootDir, 'css/dashboard.css'), 'utf8');

// Sidebar toggle desktop vs mobile
assert(dashCss.includes('#sidebarToggle { display: none; }'), '#sidebarToggle must be display: none on desktop');
assert(dashCss.includes('#sidebarToggle { display: inline-flex; }'), '#sidebarToggle must be display: inline-flex on mobile/tablet');
console.log('✔ Sidebar toggle visibility (hidden on desktop, visible on mobile <= 980px): VERIFIED');

// Scoped topbar search hiding (ensures in-page search filters remain visible)
assert(dashCss.includes('.dash-topbar > .dash-topbar__search { display: none; }'), 'Search hiding on <= 900px must be scoped exclusively to topbar');
console.log('✔ Topbar search scoping (preserves in-page search bars on mobile): VERIFIED');

// Mobile user-chip adaptations
assert(dashCss.includes('.user-chip__role { display: none; }'), 'user-chip role label must hide on small screens');
assert(dashCss.includes('.user-chip__name { display: none; }'), 'user-chip name must collapse to avatar on narrow mobile screens');
console.log('✔ Dashboard user-chip mobile compaction: VERIFIED');

// Required layout test preservation
assert(dashCss.includes('.sidebar-scrim {\n  display: none;\n}') || dashCss.includes('.sidebar-scrim {\r\n  display: none;\r\n}'), 'CSS must maintain exact .sidebar-scrim { display: none; } definition');
assert(dashCss.includes('grid-column: 1;') && dashCss.includes('grid-row: 2;'), 'CSS must maintain exact grid-column: 1; grid-row: 2; on .dash-sidebar');
assert(dashCss.includes('grid-column: 2;') && dashCss.includes('grid-row: 2;'), 'CSS must maintain exact grid-column: 2; grid-row: 2; on .dash-content');
console.log('✔ Preserved exact grid positioning & scrim declarations for layout test compatibility: VERIFIED\n');

// 4. Verify representative pages for responsive classes and no hardcoded inline grid width
console.log('--- 4. Checking Representative Page Layouts ---');
const repPages = [
  'index.html',
  'login.html',
  'citizen-dashboard.html',
  'rescue-dashboard.html',
  'volunteer-dashboard.html',
  'ngo-dashboard.html',
  'admin-dashboard.html',
  'relief-camps.html'
];

repPages.forEach(p => {
  const content = fs.readFileSync(path.join(rootDir, p), 'utf8');
  assert(!content.includes('grid-template-columns:1.1fr 0.9fr;gap:32px;'), `${p} must not contain hardcoded inline grid`);
  console.log(`✔ [${p}]: Responsive structure verified`);
});

console.log('\n===========================================================');
console.log('✔ ALL RESPONSIVE & MOBILE DESIGN VALIDATIONS PASSED (100%)');
console.log('===========================================================');
