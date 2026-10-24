/* RETIRED — do NOT regenerate content/*.json from the legacy data files!
   The content/*.json files are now the SINGLE SOURCE OF TRUTH; the old
   data-*.js / summaries.js / lesson-extras.js are stale historical dumps and
   running the old generator would silently overwrite months of fixes.
   This script now just forwards to verify-content.js (read-only integrity check).
   To rebuild the offline bundle after editing JSON:  node build-bundle.js */
'use strict';
console.log('build-content.js is retired — content/*.json is the source of truth.');
console.log('Forwarding to verify-content.js (read-only)...\n');
require(__dirname + '/verify-content.js');
