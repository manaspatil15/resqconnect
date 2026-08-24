const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('  TESTING LOGO CLICK, AUTH SESSION, & MULTI-PAGE NAVIGATION FLOW');
console.log('================================================================\n');

const mockDataCode = fs.readFileSync(path.join(__dirname, '../js/mock/mock-data.js'), 'utf8');
const storeCode = fs.readFileSync(path.join(__dirname, '../js/mock/store.js'), 'utf8');
const mainJsCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

// Helper to simulate page environment
function simulatePage(pageName, initialStorage = {}) {
  const htmlPath = path.join(__dirname, '../', pageName);
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';

  const storage = Object.assign({}, initialStorage);

  // Parse basic DOM elements from HTML
  const domElements = [];

  // Match all <a ...> tags
  const aMatches = [...html.matchAll(/<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi)];
  aMatches.forEach((m) => {
    const attrs = m[1];
    const text = m[2].replace(/<[^>]*>/g, '').trim();
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
    const classMatch = attrs.match(/class=["']([^"']*)["']/i);
    const href = hrefMatch ? hrefMatch[1] : '';
    const className = classMatch ? classMatch[1] : '';
    const headerMatch = html.match(/<header\s+class=["']site-header["']>([\s\S]*?)<\/header>/i);
    const isSiteHeader = headerMatch && headerMatch[1].includes(m[0]);
    
    const elem = {
      tagName: 'A',
      href: href,
      className: className,
      textContent: text,
      isSiteHeader: Boolean(isSiteHeader),
      attributes: { href, class: className },
      getAttribute(attr) { return this.attributes[attr] || null; },
      setAttribute(attr, val) {
        this.attributes[attr] = String(val);
        if (attr === 'href') this.href = String(val);
        if (attr === 'class') this.className = String(val);
      },
      classList: {
        contains(c) { return elem.className.split(/\s+/).includes(c); },
        add(c) { if (!elem.className.includes(c)) elem.className += ` ${c}`; },
        remove(c) { elem.className = elem.className.replace(new RegExp(`\\b${c}\\b`, 'g'), '').trim(); },
        toggle(c, force) {
          const has = elem.className.includes(c);
          if (force !== undefined) {
            if (force) this.add(c); else this.remove(c);
            return force;
          }
          if (has) this.remove(c); else this.add(c);
          return !has;
        }
      },
      listeners: {},
      addEventListener(evt, fn) {
        this.listeners[evt] = this.listeners[evt] || [];
        this.listeners[evt].push(fn);
      },
      click() {
        if (typeof this.onclick === 'function') {
          let defaultPrevented = false;
          this.onclick({ preventDefault: () => { defaultPrevented = true; } });
        }
        (this.listeners['click'] || []).forEach(fn => fn({ preventDefault: () => {} }));
      }
    };
    domElements.push(elem);
  });

  let currentPath = `/${pageName}`;
  let redirectedTo = null;

  const mockWindow = {
    location: {
      get pathname() { return currentPath; },
      set pathname(val) { currentPath = val; },
      get href() { return currentPath; },
      set href(val) {
        redirectedTo = val;
        currentPath = val.startsWith('/') ? val : `/${val}`;
      }
    },
    sessionStorage: {
      getItem: (k) => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; }
    },
    localStorage: {
      getItem: (k) => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; }
    },
    addEventListener: () => {},
    CustomEvent: class { constructor(n, d) { this.type = n; this.detail = d ? d.detail : null; } }
  };

  const mockDoc = {
    readyState: "complete",
    documentElement: {
      setAttribute: () => {},
      removeAttribute: () => {}
    },
    querySelectorAll: (sel) => {
      if (sel.includes('a.logo') || sel.includes('.logo') || sel.includes('a[href="index.html"].logo')) {
        return domElements.filter(el => el.classList.contains('logo') || (el.className && el.className.includes('logo')));
      }
      if (sel.includes('.site-header') && (sel.includes('.nav-actions') || sel.includes('.nav-links'))) {
        return domElements.filter(el => el.isSiteHeader && el.getAttribute('href') === 'login.html');
      }
      if (sel.includes('.hero-actions')) {
        return [];
      }
      if (sel.includes('a[href=\'login.html\']')) {
        return domElements.filter(el => el.getAttribute('href') === 'login.html');
      }
      if (sel.includes('.user-chip')) {
        return [];
      }
      if (sel.includes('[data-year]')) {
        return [{ textContent: '' }];
      }
      return [];
    },
    querySelector: (sel) => {
      const all = mockDoc.querySelectorAll(sel);
      return all.length > 0 ? all[0] : null;
    },
    getElementById: (id) => null,
    addEventListener: () => {}
  };

  global.window = mockWindow;
  global.document = mockDoc;
  global.sessionStorage = mockWindow.sessionStorage;
  global.localStorage = mockWindow.localStorage;

  eval(mockDataCode);
  eval(storeCode);
  eval(mainJsCode);

  if (mockWindow.ResQAuth && typeof mockWindow.ResQAuth.initAuthSession === "function") {
    mockWindow.ResQAuth.initAuthSession();
  }

  return {
    window: mockWindow,
    document: mockDoc,
    storage,
    domElements,
    getRedirect: () => redirectedTo
  };
}

// Test 1: Role dashboard mapping helper
console.log('--- TEST 1: Role to Dashboard Mapping ---');
const roles = [
  { role: 'citizen', expected: 'citizen-dashboard.html' },
  { role: 'volunteer', expected: 'volunteer-dashboard.html' },
  { role: 'ngo', expected: 'ngo-dashboard.html' },
  { role: 'rescue', expected: 'rescue-dashboard.html' },
  { role: 'rescue team', expected: 'rescue-dashboard.html' },
  { role: 'admin', expected: 'admin-dashboard.html' },
  { role: 'administrator', expected: 'admin-dashboard.html' },
  { role: null, expected: 'citizen-dashboard.html' }
];

roles.forEach(r => {
  const env = simulatePage('index.html');
  const dash = window.ResQAuth.getDashboardForRole(r.role);
  assert.strictEqual(dash, r.expected, `Role '${r.role}' should map to '${r.expected}'`);
});
console.log('✔ All role dashboard mappings verified.\n');

// Test 2: Unauthenticated Visitor on index.html
console.log('--- TEST 2: Unauthenticated Visitor (Guest) ---');
{
  const env = simulatePage('index.html');
  const logos = env.document.querySelectorAll('a.logo');
  assert(logos.length > 0, 'index.html must have logo links');
  logos.forEach(logo => {
    assert.strictEqual(logo.getAttribute('href'), 'index.html', 'Guest logo must link to index.html');
  });
  assert.strictEqual(env.getRedirect(), null, 'Guest should not be redirected away from index.html');
  console.log('✔ Guest visiting index.html sees logo pointing to index.html with no redirect.');
}

// Test 3: Unauthenticated Visitor on protected dashboard page
console.log('\n--- TEST 3: Auth Guard on Protected Dashboard Page ---');
{
  const protectedPages = ['citizen-dashboard.html', 'volunteer-dashboard.html', 'ngo-dashboard.html', 'rescue-dashboard.html', 'admin-dashboard.html', 'citizen-report.html', 'admin-users.html'];
  protectedPages.forEach(page => {
    const env = simulatePage(page);
    assert.strictEqual(env.getRedirect(), 'login.html', `Unauthenticated visit to '${page}' must redirect to login.html`);
  });
  console.log('✔ Unauthenticated users are protected and redirected to login.html.');
}

// Test 4: Authenticated Citizen clicking Logo on Citizen Dashboard
console.log('\n--- TEST 4: Authenticated Citizen Navigation & Logo Click ---');
{
  const citizenUser = { _id: 'u1', name: 'Ravi Kumar', email: 'ravi@example.com', role: 'citizen' };
  const initialStorage = { resq_current_user: JSON.stringify(citizenUser) };

  // Page 1: citizen-requests.html
  const env = simulatePage('citizen-requests.html', initialStorage);
  assert.strictEqual(env.getRedirect(), null, 'Authenticated citizen must not be redirected from citizen-requests.html');

  const logos = env.document.querySelectorAll('a.logo');
  assert(logos.length > 0, 'citizen-requests.html must have logo elements');
  logos.forEach(logo => {
    assert.strictEqual(logo.getAttribute('href'), 'citizen-dashboard.html', 'Logo must point to citizen-dashboard.html');
  });

  // Click logo
  logos[0].click();
  assert.strictEqual(env.getRedirect(), 'citizen-dashboard.html', 'Clicking logo must navigate to citizen-dashboard.html');

  // Verify session is still intact
  assert.strictEqual(JSON.parse(env.storage.resq_current_user).email, 'ravi@example.com', 'Session must remain intact');
  console.log('✔ Authenticated Citizen clicking logo navigates to citizen-dashboard.html without losing session.');
}

// Test 5: Authenticated Volunteer on Public index.html
console.log('\n--- TEST 5: Authenticated Volunteer on Public index.html ---');
{
  const volUser = { _id: 'v1', name: 'Pooja Volunteer', email: 'pooja@example.com', role: 'volunteer' };
  const initialStorage = { resq_current_user: JSON.stringify(volUser) };

  const env = simulatePage('index.html', initialStorage);
  const logos = env.document.querySelectorAll('a.logo');
  logos.forEach(logo => {
    assert.strictEqual(logo.getAttribute('href'), 'volunteer-dashboard.html', 'Logo on index.html for volunteer must point to volunteer-dashboard.html');
  });

  // Check login button in navbar transformed to Dashboard
  const loginBtns = env.domElements.filter(el => el.getAttribute('data-auth-dash-btn') === 'true' || el.textContent === 'Dashboard');
  assert(loginBtns.length > 0, 'Public navbar Log In button must transform to Dashboard for authenticated user');
  assert.strictEqual(loginBtns[0].getAttribute('href'), 'volunteer-dashboard.html', 'Dashboard button must point to volunteer-dashboard.html');

  // Click logo from index.html
  logos[0].click();
  assert.strictEqual(env.getRedirect(), 'volunteer-dashboard.html', 'Clicking logo from index.html must route to volunteer-dashboard.html');
  assert.strictEqual(JSON.parse(env.storage.resq_current_user).email, 'pooja@example.com', 'Session remains intact');
  console.log('✔ Authenticated Volunteer on index.html: Logo routes to volunteer-dashboard.html and session is preserved.');
}

// Test 6: Rescue Team Lead Navigation
console.log('\n--- TEST 6: Authenticated Rescue Team Lead ---');
{
  const rescueUser = { _id: 'r1', name: 'Commander Roy', email: 'roy@rescue.gov', role: 'rescue' };
  const initialStorage = { resq_current_user: JSON.stringify(rescueUser) };

  const env = simulatePage('rescue-cases.html', initialStorage);
  const logos = env.document.querySelectorAll('a.logo');
  logos.forEach(logo => {
    assert.strictEqual(logo.getAttribute('href'), 'rescue-dashboard.html', 'Logo on rescue-cases.html must point to rescue-dashboard.html');
  });

  logos[0].click();
  assert.strictEqual(env.getRedirect(), 'rescue-dashboard.html', 'Clicking logo navigates to rescue-dashboard.html');
  console.log('✔ Rescue Team Lead logo routing verified.');
}

// Test 7: NGO Coordinator Navigation
console.log('\n--- TEST 7: Authenticated NGO Coordinator ---');
{
  const ngoUser = { _id: 'n1', name: 'Aarav NGO', email: 'aarav@ngo.org', role: 'ngo' };
  const initialStorage = { resq_current_user: JSON.stringify(ngoUser) };

  const env = simulatePage('ngo-inventory.html', initialStorage);
  const logos = env.document.querySelectorAll('a.logo');
  logos.forEach(logo => {
    assert.strictEqual(logo.getAttribute('href'), 'ngo-dashboard.html', 'Logo on ngo-inventory.html must point to ngo-dashboard.html');
  });

  logos[0].click();
  assert.strictEqual(env.getRedirect(), 'ngo-dashboard.html', 'Clicking logo navigates to ngo-dashboard.html');
  console.log('✔ NGO Coordinator logo routing verified.');
}

// Test 8: Admin Navigation
console.log('\n--- TEST 8: Authenticated Admin ---');
{
  const adminUser = { _id: 'a1', name: 'Super Admin', email: 'admin@resqconnect.gov', role: 'admin' };
  const initialStorage = { resq_current_user: JSON.stringify(adminUser) };

  const env = simulatePage('admin-analytics.html', initialStorage);
  const logos = env.document.querySelectorAll('a.logo');
  logos.forEach(logo => {
    assert.strictEqual(logo.getAttribute('href'), 'admin-dashboard.html', 'Logo on admin-analytics.html must point to admin-dashboard.html');
  });

  logos[0].click();
  assert.strictEqual(env.getRedirect(), 'admin-dashboard.html', 'Clicking logo navigates to admin-dashboard.html');
  console.log('✔ Admin logo routing verified.');
}

// Test 9: Explicit Logout
console.log('\n--- TEST 9: Explicit Logout ---');
{
  const user = { _id: 'u1', name: 'Citizen Test', email: 'user@test.com', role: 'citizen' };
  const initialStorage = {
    resq_current_user: JSON.stringify(user),
    user: JSON.stringify(user)
  };

  const env = simulatePage('citizen-dashboard.html', initialStorage);
  
  // Find the logout link
  const logoutLink = env.domElements.find(el => el.textContent.toLowerCase().includes('log out') || el.textContent.toLowerCase().includes('logout'));
  assert(logoutLink, 'citizen-dashboard.html must have a Log out link');

  // Trigger explicit logout click
  logoutLink.click();

  // Storage should be cleared
  assert.strictEqual(env.storage.resq_current_user, undefined, 'resq_current_user must be removed on logout');
  assert.strictEqual(env.storage.user, undefined, 'user must be removed on logout');
  console.log('✔ Explicit logout successfully clears user session.');
}

// Test 10: Page refresh / multiple page transitions
console.log('\n--- TEST 10: Multi-page Flow & Refresh Simulation ---');
{
  const user = { _id: 'u2', name: 'Multi Page User', email: 'mpu@example.com', role: 'citizen' };
  let storageState = { resq_current_user: JSON.stringify(user) };

  // Step 1: User visits citizen-dashboard.html
  let step1 = simulatePage('citizen-dashboard.html', storageState);
  assert.strictEqual(step1.getRedirect(), null);
  storageState = step1.storage;

  // Step 2: User clicks logo on citizen-dashboard.html
  let step1Logos = step1.document.querySelectorAll('a.logo');
  assert.strictEqual(step1Logos[0].getAttribute('href'), 'citizen-dashboard.html');

  // Step 3: User navigates to citizen-sos.html
  let step3 = simulatePage('citizen-sos.html', storageState);
  assert.strictEqual(step3.getRedirect(), null);
  storageState = step3.storage;

  // Step 4: Refresh (reload citizen-sos.html)
  let step4 = simulatePage('citizen-sos.html', storageState);
  assert.strictEqual(step4.getRedirect(), null);
  assert(step4.storage.resq_current_user, 'Session must remain after refresh');

  // Step 5: User clicks logo on citizen-sos.html
  let step5Logos = step4.document.querySelectorAll('a.logo');
  step5Logos[0].click();
  assert.strictEqual(step4.getRedirect(), 'citizen-dashboard.html');

  console.log('✔ Multi-page navigation and refresh flow preserved session seamlessly.');
}

console.log('\n================================================================');
console.log('✔ ALL LOGO, AUTH, & NAVIGATION TESTS PASSED WITH 100% SUCCESS');
console.log('================================================================');
