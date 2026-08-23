/* ==========================================================================
   ResQConnect — mock-data.js
   Single source of truth for frontend-only mock data. No page should
   hardcode a data record directly in HTML/JS anymore — it should read
   from window.ResQMock (usually through store.js).

   This file only DEFINES data. Reading/writing goes through store.js so
   that a later backend integration only has to change store.js, not
   every page.

   Load order: mock-data.js -> store.js -> ui/*.js -> main.js -> dashboard.js
   ========================================================================== */

(function () {
  "use strict";

  window.ResQMock = {
    /* ------------------------------------------------------------------
       ALERTS — severity: critical | warning | watch | advisory
       (moved out of main.js's old inline ACTIVE_ALERTS array)
       ------------------------------------------------------------------ */
    alerts: [
      { id: "DA-2026-0142", sev: "critical", title: "Mumbai Coastal Flooding", location: "Andheri & Bandra, Maharashtra", description: "214 residents relocated to Camp 4 & Camp 7. Water levels expected to peak at high tide, 9:40 PM.", active: true, createdAt: "2026-08-15T09:10:00" },
      { id: "DA-2026-0139", sev: "warning", title: "Cyclone Biparjoy", location: "Odisha Coast", description: "Landfall expected within 36 hours near Puri. 12 relief camps on standby along the coastline.", active: true, createdAt: "2026-08-14T18:40:00" },
      { id: "DA-2026-0137", sev: "watch", title: "Forest Fire Risk", location: "Nainital District, Uttarakhand", description: "Elevated fire risk due to dry conditions. Fire crews pre-positioned at 3 watch towers.", active: true, createdAt: "2026-08-13T07:00:00" },
      { id: "DA-2026-0135", sev: "advisory", title: "Heatwave Advisory", location: "Chennai, Tamil Nadu", description: "Temperatures expected to reach 42°C. Avoid outdoor activity between 12 PM and 4 PM.", active: true, createdAt: "2026-08-12T06:00:00" },
      { id: "DA-2026-0131", sev: "watch", title: "River Overflow Risk", location: "Patna, Bihar", description: "Ganga water levels rising after upstream rainfall. Low-lying wards under watch.", active: true, createdAt: "2026-08-11T15:20:00" },
      { id: "DA-2026-0128", sev: "advisory", title: "Landslide-Prone Roads", location: "Munnar, Kerala", description: "Continuous rainfall has softened hillside roads. Avoid non-essential travel on NH-85.", active: true, createdAt: "2026-08-10T10:00:00" },
      { id: "DA-2026-0119", sev: "watch", title: "Riverbank Erosion", location: "Patna Riverside", description: "Monitoring teams have flagged accelerated erosion near the riverside settlement. Downgraded after reinforcement work.", active: false, createdAt: "2026-08-05T11:00:00" }
    ],

    /* ------------------------------------------------------------------
       USERS
       ------------------------------------------------------------------ */
    users: [
      { id: "U-001", name: "Aditi Sharma", email: "aditi.sharma@example.com", role: "citizen", joined: "Feb 2026", status: "active" },
      { id: "U-002", name: "Rohan Mehta", email: "rohan.mehta@example.com", role: "volunteer", joined: "Jan 2026", status: "active", skill: "Logistics", location: "Mumbai", tasksDone: 42, rating: 4.8 },
      { id: "U-003", name: "Priya Nair", email: "priya@sahayatango.org", role: "ngo", joined: "Dec 2025", status: "active" },
      { id: "U-004", name: "Capt. Vikram Rao", email: "vikram.rao@ndrf.gov.in", role: "rescue", joined: "Nov 2025", status: "active" },
      { id: "U-005", name: "Sunil Patil", email: "sunil.patil@example.com", role: "citizen", joined: "Jul 2026", status: "pending" },
      { id: "U-006", name: "Divya Menon", email: "divya.menon@example.com", role: "volunteer", joined: "Jun 2026", status: "suspended", skill: "First Aid", location: "Kochi", tasksDone: 36, rating: 4.9 },
      { id: "U-007", name: "Arjun Nair", email: "arjun.nair@example.com", role: "volunteer", joined: "Mar 2026", status: "active", skill: "Search & Rescue", location: "Bhubaneswar", tasksDone: 58, rating: 4.7 },
      { id: "U-008", name: "Kavita Rao", email: "kavita.rao@example.com", role: "volunteer", joined: "Apr 2026", status: "on_leave", skill: "Counseling", location: "Mumbai", tasksDone: 21, rating: 4.6 },
      { id: "U-009", name: "Farhan Sheikh", email: "farhan.sheikh@example.com", role: "volunteer", joined: "May 2026", status: "active", skill: "Driving", location: "Patna", tasksDone: 29, rating: 4.4 },
      { id: "U-010", name: "Meera Joshi", email: "meera.joshi@example.com", role: "volunteer", joined: "Aug 2026", status: "pending", skill: "First Aid", location: "Chennai", tasksDone: 0, rating: null }
    ],

    /* ------------------------------------------------------------------
       SOS — status: pending | assigned | in_progress | resolved | cancelled
       ------------------------------------------------------------------ */
    sos: [],

    /* ------------------------------------------------------------------
       EMERGENCY REPORTS
       ------------------------------------------------------------------ */
    reports: [
      { id: "RPT-2026-0144", type: "Flood", location: "Kurla, Mumbai", severity: "watch", verified: false, filedBy: "Sunil Patil", status: "reviewing", description: "Water pooling on the main road near Kurla station.", createdAt: "2026-08-17T07:10:00" },
      { id: "RPT-2026-0143", type: "Landslide", location: "Munnar, Kerala", severity: "watch", verified: false, filedBy: "Divya Menon", status: "reviewing", description: "Small landslip blocking a section of NH-85.", createdAt: "2026-08-17T06:40:00" },
      { id: "RPT-2026-0142", type: "Flood", location: "Andheri, Mumbai", severity: "critical", verified: true, filedBy: "Aditi Sharma", status: "assigned", description: "Water entering ground-floor homes near the station.", createdAt: "2026-08-15T08:40:00" },
      { id: "RPT-2026-0139", type: "Cyclone", location: "Puri, Odisha", severity: "warning", verified: true, filedBy: "Field Sensor", status: "assigned", description: "Sustained high winds recorded along the coastline.", createdAt: "2026-08-14T18:00:00" },
      { id: "RPT-2026-0137", type: "Forest Fire", location: "Nainital, Uttarakhand", severity: "watch", verified: true, filedBy: "Forest Dept.", status: "reviewing", description: "Small brush fire spotted near the ridge trail.", createdAt: "2026-08-14T16:05:00" },
      { id: "RPT-2026-0135", type: "Heatwave", location: "Chennai, Tamil Nadu", severity: "advisory", verified: true, filedBy: "IMD Feed", status: "closed", description: "Extended high-temperature advisory for the region.", createdAt: "2026-08-12T06:00:00" }
    ],

    /* ------------------------------------------------------------------
       MISSING PERSONS — status: reported | investigating | found | closed
       ------------------------------------------------------------------ */
    missingPersons: [
      { id: "MP-2026-0091", name: "Arjun Verma", age: 34, gender: "Male", lastSeen: "Andheri Station, Mumbai", lastSeenAt: "2026-08-10T19:00:00", description: "Wearing a blue jacket, last seen heading toward the flooded underpass.", status: "found", photo: null },
      { id: "MP-2026-0094", name: "Kavya Iyer", age: 8, gender: "Female", lastSeen: "Relief Camp — Bandra West", lastSeenAt: "2026-08-15T07:20:00", description: "Separated from family during camp evacuation. Wearing a yellow school bag.", status: "investigating", photo: null }
    ],

    /* ------------------------------------------------------------------
       HELP REQUESTS (citizen-facing) — status: pending | assigned |
       in_progress | completed | cancelled
       ------------------------------------------------------------------ */
    helpRequests: [
      { id: "HR-2026-0512", title: "Need drinking water", location: "Andheri West", status: "pending", createdAt: "2026-08-15T09:00:00" },
      { id: "HR-2026-0509", title: "Medical supplies for elderly resident", location: "Bandra West", status: "in_progress", createdAt: "2026-08-14T14:10:00" }
    ],

    /* ------------------------------------------------------------------
       RELIEF CAMPS
       ------------------------------------------------------------------ */
    camps: [
      { id: "CMP-014", name: "Andheri West Community Camp", location: "Mumbai, Maharashtra", capacity: 450, occupancy: 412, facilities: ["Food", "Water", "Medical aid"], contact: "+91 22 4000 1122", ngoPartner: "Sahayata NGO" },
      { id: "CMP-018", name: "Bandra Relief Shelter", location: "Mumbai, Maharashtra", capacity: 400, occupancy: 180, facilities: ["Food", "Water", "Bedding", "Medical aid"], contact: "+91 22 4000 1187", ngoPartner: "Sahayata NGO" },
      { id: "CMP-022", name: "Puri Coastal Camp", location: "Puri, Odisha", capacity: 600, occupancy: 95, facilities: ["Food", "Water", "Cyclone shelter"], contact: "+91 674 220 3312", ngoPartner: "Odisha SDMA" },
      { id: "CMP-009", name: "Nainital Ridge Camp", location: "Nainital, Uttarakhand", capacity: 150, occupancy: 40, facilities: ["Medical aid", "Food", "Shelter"], contact: "+91 5942 235 001", ngoPartner: "Hope Foundation" },
      { id: "CMP-031", name: "Patna Riverside Camp", location: "Patna, Bihar", capacity: 300, occupancy: 260, facilities: ["Food", "Water", "Medical aid"], contact: "+91 612 220 4477", ngoPartner: "Red Circle NGO" }
    ],

    /* ------------------------------------------------------------------
       VOLUNTEER TASKS — status: available | accepted | in_progress | completed
       ------------------------------------------------------------------ */
    tasks: [
      { id: "TSK-2026-0241", title: "Medical Aid Support — Puri Coastal Camp", org: "Odisha SDMA", priority: "urgent", status: "available", location: "Puri, Odisha", meta: ["Starts in 3 hrs", "Medical skill preferred"] },
      { id: "TSK-2026-0239", title: "Water Distribution — Andheri West", org: "Sahayata NGO", priority: "urgent", status: "available", location: "Andheri, Mumbai", meta: ["Starts in 5 hrs", "200L capacity"] },
      { id: "TSK-2026-0236", title: "Supply Sorting — Nainital Ridge Camp", org: "Hope Foundation", priority: "standard", status: "available", location: "Nainital, UK", meta: ["Tomorrow, 9 AM", "Logistics"] },
      { id: "TSK-2026-0230", title: "Blanket Distribution — Patna Riverside", org: "Red Circle NGO", priority: "standard", status: "available", location: "Patna, Bihar", meta: ["Tomorrow, 2 PM", "General support"] },
      { id: "TSK-2026-0221", title: "Counseling Session — Bandra Shelter", org: "Sahayata NGO", priority: "flexible", status: "available", location: "Bandra, Mumbai", meta: ["This week", "Counseling skill"] },
      { id: "TSK-2026-0218", title: "Driver Needed — Supply Run", org: "Sahayata NGO", priority: "flexible", status: "available", location: "Mumbai to Thane", meta: ["This week", "Valid license required"] },
      { id: "TSK-2026-0233", title: "Food Delivery — Bandra Relief Shelter", org: "Sahayata NGO", priority: "urgent", status: "in_progress", location: "Bandra West, Mumbai", meta: ["Due today, 6:00 PM", "40 meal kits"] },
      { id: "TSK-2026-0209", title: "Food Delivery", org: "Sahayata NGO", priority: "standard", status: "completed", location: "Andheri, Mumbai", meta: [], completedAt: "2026-08-14T17:00:00", hours: 4, rating: 5.0 },
      { id: "TSK-2026-0198", title: "Medical Camp Support", org: "Hope Foundation", priority: "standard", status: "completed", location: "Bandra, Mumbai", meta: [], completedAt: "2026-08-10T17:00:00", hours: 6, rating: 4.8 },
      { id: "TSK-2026-0181", title: "Shelter Setup", org: "Red Circle NGO", priority: "standard", status: "completed", location: "Kurla, Mumbai", meta: [], completedAt: "2026-08-03T17:00:00", hours: 8, rating: 5.0 },
      { id: "TSK-2026-0165", title: "Supply Sorting", org: "Hope Foundation", priority: "standard", status: "completed", location: "Thane", meta: [], completedAt: "2026-07-27T17:00:00", hours: 5, rating: 4.5 },
      { id: "TSK-2026-0142", title: "Water Distribution", org: "Sahayata NGO", priority: "standard", status: "completed", location: "Andheri, Mumbai", meta: [], completedAt: "2026-07-17T17:00:00", hours: 7, rating: 4.9 }
    ],

    /* ------------------------------------------------------------------
       RESCUE CASES — status: pending | assigned | in_progress | resolved
       sosId links a case back to the SOS record it originated from
       (when applicable) so status changes here can update that shared
       record too, rather than keeping a second copy of the same event.
       ------------------------------------------------------------------ */
    cases: [
      { id: "RS-2026-0088", title: "Family stranded — rooftop, Andheri", location: "Andheri East, Mumbai", priority: "critical", status: "pending", reportedBy: "Aditi Sharma", peopleAffected: 4, reportedAt: "2026-08-17T09:48:00", sosId: null },
      { id: "RS-2026-0086", title: "Elderly resident — flooded ground floor", location: "Kurla, Mumbai", priority: "warning", status: "assigned", reportedBy: null, peopleAffected: 1, reportedAt: "2026-08-17T09:20:00", sosId: null },
      { id: "RS-2026-0081", title: "Stranded fishermen, coastal flooding", location: "Puri, Odisha", priority: "warning", status: "resolved", outcome: "All Safe", reportedBy: null, peopleAffected: 6, reportedAt: "2026-08-16T10:00:00", resolvedAt: "2026-08-16T14:00:00", respondedInMin: 18, sosId: null },
      { id: "RS-2026-0074", title: "Building evacuation, structural risk", location: "Kurla, Mumbai", priority: "warning", status: "resolved", outcome: "All Safe", reportedBy: null, peopleAffected: 12, reportedAt: "2026-08-14T08:00:00", resolvedAt: "2026-08-14T09:30:00", respondedInMin: 25, sosId: null },
      { id: "RS-2026-0069", title: "Landslide road blockage rescue", location: "Munnar, Kerala", priority: "watch", status: "resolved", outcome: "All Safe", reportedBy: null, peopleAffected: 3, reportedAt: "2026-08-10T11:00:00", resolvedAt: "2026-08-10T12:15:00", respondedInMin: 31, sosId: null },
      { id: "RS-2026-0058", title: "Medical evacuation, flood zone", location: "Patna, Bihar", priority: "warning", status: "resolved", outcome: "All Safe", reportedBy: null, peopleAffected: 2, reportedAt: "2026-08-03T16:00:00", resolvedAt: "2026-08-03T17:00:00", respondedInMin: 20, sosId: null }
    ],

    /* ------------------------------------------------------------------
       INVENTORY (per NGO) + DISTRIBUTIONS
       ------------------------------------------------------------------ */
    inventory: [
      { id: "INV-01", item: "Rice (25kg bags)", quantity: 84, unit: "bags", capacity: 300 },
      { id: "INV-02", item: "Water purification tablets", quantity: 340, unit: "packs", capacity: 2800 },
      { id: "INV-03", item: "First aid kits", quantity: 62, unit: "kits", capacity: 200 },
      { id: "INV-04", item: "Blankets", quantity: 410, unit: "units", capacity: 600 },
      { id: "INV-05", item: "Tents", quantity: 96, unit: "units", capacity: 130 },
      { id: "INV-06", item: "Bottled water", quantity: 2200, unit: "bottles", capacity: 4000 },
      { id: "INV-07", item: "Cooking oil", quantity: 140, unit: "litres", capacity: 330 }
    ],
    distributions: [
      { id: "DIST-2026-3301", camp: "Andheri West Community Camp", itemId: "INV-01", item: "Rice (25kg bags)", quantity: 40, unit: "bags", createdAt: "2026-08-17T08:00:00" },
      { id: "DIST-2026-3302", camp: "Andheri West Community Camp", itemId: "INV-06", item: "Bottled water", quantity: 500, unit: "bottles", createdAt: "2026-08-17T08:10:00" },
      { id: "DIST-2026-3303", camp: "Bandra Relief Shelter", itemId: "INV-04", item: "Blankets", quantity: 120, unit: "units", createdAt: "2026-08-17T07:30:00" },
      { id: "DIST-2026-3299", camp: "Puri Coastal Camp", itemId: "INV-03", item: "First aid kits", quantity: 35, unit: "kits", createdAt: "2026-08-16T14:00:00" },
      { id: "DIST-2026-3290", camp: "Nainital Ridge Camp", itemId: "INV-05", item: "Tents", quantity: 18, unit: "units", createdAt: "2026-08-15T11:00:00" }
    ],

    /* ------------------------------------------------------------------
       CAMP RESOURCE LEVELS — per-camp stock estimate by category.
       A separate, deliberately small dataset from `inventory` (which is
       NGO-organization-wide, not per-camp) since a camp draws supplies
       from multiple NGOs/sources; this represents what's physically on
       site right now.
       ------------------------------------------------------------------ */
    campResourceLevels: [
      { camp: "Andheri West Community Camp", food: 38, water: 72, medical: 19 },
      { camp: "Bandra Relief Shelter", food: 65, water: 80, medical: 44 },
      { camp: "Puri Coastal Camp", food: 90, water: 85, medical: 60 },
      { camp: "Nainital Ridge Camp", food: 50, water: 70, medical: 55 },
      { camp: "Patna Riverside Camp", food: 58, water: 66, medical: 33 }
    ],

    /* ------------------------------------------------------------------
       NOTIFICATIONS — one shared pool, filtered per role/page as needed
       ------------------------------------------------------------------ */
    notifications: [
      { id: "N-01", type: "alert", message: "New CRITICAL alert: Mumbai coastal flooding", read: false, createdAt: "2026-08-15T09:12:00" },
      { id: "N-02", type: "task", message: "Your task \"Food Delivery - Camp 4\" was approved", read: false, createdAt: "2026-08-15T08:10:00" },
      { id: "N-03", type: "camp", message: "Relief camp Andheri West is nearing capacity", read: true, createdAt: "2026-08-15T06:00:00" },
      { id: "N-04", type: "missing", message: "Missing person case MP-2026-0091 marked found", read: true, createdAt: "2026-08-14T12:00:00" }
    ]
  };
})();
