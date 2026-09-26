// Delete the Halden Freight demo organization and everything under it.
//
//   cd server && node scripts/demo/remove.js --prod
//
// Deleting the organization cascades to its monitors, checks, incidents, alert channels,
// alert logs, subscribers, API keys and audit logs. Users are deleted first because their
// organization foreign key is SET NULL rather than CASCADE.
const { connect, counts, ORG_SLUG } = require("./lib");

(async () => {
  const { client, label } = await connect();
  console.log(`target: ${label}`);
  try {
    const org = await client.query(`SELECT id FROM "Organizations" WHERE slug = $1`, [ORG_SLUG]);
    if (!org.rowCount) {
      console.log(`no "${ORG_SLUG}" organization; nothing to do`);
      return;
    }
    const orgId = org.rows[0].id;
    console.log("before:", await counts(client));
    await client.query("BEGIN");
    const users = await client.query(`SELECT id FROM "Users" WHERE "organizationId" = $1`, [orgId]);
    const ids = users.rows.map((r) => r.id);
    await client.query(`DELETE FROM "MfaChallenges" WHERE "userId" = ANY($1::uuid[])`, [ids]);
    await client.query(`DELETE FROM "Users" WHERE id = ANY($1::uuid[])`, [ids]);
    await client.query(`DELETE FROM "Organizations" WHERE id = $1`, [orgId]);
    await client.query("COMMIT");
    console.log(`deleted ${ids.length} user(s) and organization ${ORG_SLUG}`);
    console.log("after: ", await counts(client));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
