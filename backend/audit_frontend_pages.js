const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));

console.log(`=== AUDITING ALL ${htmlFiles.length} HTML PAGES FOR LINK INTEGRITY, SCRIPTS & HEADERS ===\n`);

const authenticatedPages = [
  'admin-analytics.html', 'admin-camps.html', 'admin-dashboard.html', 'admin-reports.html',
  'admin-resources.html', 'admin-users.html', 'admin-volunteers.html',
  'citizen-camps.html', 'citizen-dashboard.html', 'citizen-missing.html', 'citizen-notifications.html',
  'citizen-profile.html', 'citizen-report.html', 'citizen-requests.html', 'citizen-sos.html',
  'ngo-dashboard.html', 'ngo-distribution.html', 'ngo-inventory.html',
  'rescue-cases.html', 'rescue-dashboard.html', 'rescue-history.html',
  'volunteer-dashboard.html', 'volunteer-history.html', 'volunteer-profile.html', 'volunteer-tasks.html'
];

let issuesCount = 0;

htmlFiles.forEach(file => {
  const content = fs.readFileSync(path.join(rootDir, file), 'utf8');

  // 1. Viewport tag check
  if (!content.includes('viewport')) {
    console.warn(`[WARN] ${file}: Missing viewport meta tag.`);
    issuesCount++;
  }

  // 2. Theme inline script check (prevent flash of unstyled theme)
  if (!content.includes('resqconnect_theme')) {
    console.warn(`[WARN] ${file}: Missing theme inline script in <head>.`);
    issuesCount++;
  }

  // 3. Authenticated page header & api.js check
  if (authenticatedPages.includes(file)) {
    if (!content.includes('data-auth-name')) {
      console.warn(`[WARN] ${file}: Missing data-auth-name on user chip.`);
      issuesCount++;
    }
    if (!content.includes('data-auth-avatar')) {
      console.warn(`[WARN] ${file}: Missing data-auth-avatar on user avatar.`);
      issuesCount++;
    }
    if (!content.includes('data-auth-role')) {
      console.warn(`[WARN] ${file}: Missing data-auth-role on user role.`);
      issuesCount++;
    }
    if (!content.includes('js/api.js')) {
      console.warn(`[WARN] ${file}: Missing js/api.js script tag.`);
      issuesCount++;
    }
  }

  // 4. Internal links check
  const linkRegex = /href="([^"#:]+\.html)"/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const linkedFile = match[1];
    if (!fs.existsSync(path.join(rootDir, linkedFile))) {
      console.error(`[ERROR] ${file} -> Broken link to ${linkedFile}`);
      issuesCount++;
    }
  }
});

if (issuesCount === 0) {
  console.log(`✔ All ${htmlFiles.length} HTML pages passed audit with ZERO broken links, correct headers, theme scripts, and API integration.`);
} else {
  console.log(`\nFound ${issuesCount} audit issues.`);
}
