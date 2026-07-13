/**
 * Post-cutover checks for suppercollective.org migration.
 * Usage: npm run verify:migration
 *
 * Optional env:
 *   MIGRATION_OLD_DOMAIN=sandiegosupperclub.com
 *   MIGRATION_NEW_DOMAIN=suppercollective.org
 */
const OLD_DOMAIN = process.env.MIGRATION_OLD_DOMAIN ?? "sandiegosupperclub.com";
const NEW_DOMAIN = process.env.MIGRATION_NEW_DOMAIN ?? "suppercollective.org";

const checks = [];

function pass(label) {
  checks.push({ ok: true, label });
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  checks.push({ ok: false, label, detail });
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

async function fetchHead(url) {
  const res = await fetch(url, { method: "GET", redirect: "manual" });
  const text = await res.text();
  return { res, text };
}

async function checkRedirect(fromHost, toHost) {
  const url = `https://${fromHost}/`;
  try {
    const { res } = await fetchHead(url);
    const location = res.headers.get("location") ?? "";
    if (res.status >= 301 && res.status <= 308 && location.includes(toHost)) {
      pass(`${fromHost} → ${toHost} (${res.status})`);
      return;
    }
    if (res.status === 200 && fromHost === toHost) {
      pass(`${toHost} serves 200`);
      return;
    }
    fail(`${fromHost} redirect`, `status ${res.status}, location: ${location || "(none)"}`);
  } catch (e) {
    fail(`${fromHost} redirect`, e instanceof Error ? e.message : String(e));
  }
}

async function checkBranding(host) {
  const url = `https://${host}/`;
  try {
    const { res, text } = await fetchHead(url);
    if (!res.ok && res.status !== 200) {
      fail(`${host} branding`, `HTTP ${res.status}`);
      return;
    }
    if (text.includes("Supper Collective")) {
      pass(`${host} HTML contains "Supper Collective"`);
    } else if (text.includes("SD Supper Club") || text.includes("SDSupperClub")) {
      fail(`${host} branding`, 'still shows old "SD Supper Club" — deploy rebrand?');
    } else {
      fail(`${host} branding`, 'expected "Supper Collective" in page HTML');
    }
  } catch (e) {
    fail(`${host} branding`, e instanceof Error ? e.message : String(e));
  }
}

async function checkFunction(host, path) {
  const url = `https://${host}${path}`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      pass(`${path} responds on ${host}`);
    } else {
      fail(`${path} on ${host}`, `HTTP ${res.status}`);
    }
  } catch (e) {
    fail(`${path} on ${host}`, e instanceof Error ? e.message : String(e));
  }
}

console.log("=== Supper Collective — domain migration verification ===\n");
console.log(`Old domain: ${OLD_DOMAIN}`);
console.log(`New domain: ${NEW_DOMAIN}\n`);

console.log("Redirects");
await checkRedirect(OLD_DOMAIN, NEW_DOMAIN);
await checkRedirect(`www.${OLD_DOMAIN}`, NEW_DOMAIN);

console.log("\nBranding");
await checkBranding(NEW_DOMAIN);

console.log("\nAPI smoke");
await checkFunction(NEW_DOMAIN, "/.netlify/functions/get-site-content");
await checkFunction(NEW_DOMAIN, "/.netlify/functions/get-public-meals");

const failed = checks.filter((c) => !c.ok);
console.log("\n---");
if (failed.length === 0) {
  console.log("All automated checks passed.");
  console.log("Manual: invite form, Identity login, Stripe checkout, Resend delivery.");
  process.exit(0);
} else {
  console.log(`${failed.length} check(s) failed. See runbook: docs/domain-migration-runbook.md`);
  process.exit(1);
}
