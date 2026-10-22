// Integration tests against a running, disposable development instance.
// Run: npm run test:api. Fixtures are removed at the end; audit history is retained.
import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://localhost:8080";
class Client {
  cookie = "";
  csrf = "";
  async request(path, method = "GET", data) {
    const r = await fetch(base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: this.cookie,
        "X-CSRF-Token": this.csrf,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const cookie = r.headers.getSetCookie();
    if (cookie.length)
      this.cookie = cookie.map((c) => c.split(";")[0]).join("; ");
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (body.csrf) this.csrf = body.csrf;
    return { status: r.status, body };
  }
  async login(email, password) {
    await this.request("/session");
    const r = await this.request("/login", "POST", { email, password });
    assert.equal(r.status, 200, JSON.stringify(r));
    return r.body;
  }
}
let checks = 0;
function expect(r, status, message) {
  assert.equal(r.status, status, message + ": " + JSON.stringify(r.body));
  checks++;
  console.log("✓ " + message);
  return r.body;
}
const admin = new Client(),
  common = new Client(),
  other = new Client(),
  anon = new Client();
const ids = [],
  calendarDates = [],
  userIds = [];
let user, peer, today;
const suffix = Date.now();
try {
  ({ today } = await admin.login(
    process.env.TEST_ADMIN_EMAIL || "admin@sirius.local",
    process.env.TEST_ADMIN_PASSWORD || "SiriusWink@2026",
  ));
  expect(await anon.request("/users"), 401, "Anonymous requests are rejected");
  expect(
    await admin.request("/signup", "POST", {}),
    404,
    "No public registration endpoint",
  );
  user = expect(
    await admin.request("/users", "POST", {
      name: "Teste Integração",
      email: `test-${suffix}@sirius.local`,
      role: "user",
      active: 1,
      password: "TestWink@2026",
    }),
    201,
    "Admin creates collaborator",
  );
  userIds.push(user.id);
  peer = expect(
    await admin.request("/users", "POST", {
      name: "Outro Teste",
      email: `other-${suffix}@sirius.local`,
      role: "user",
      active: 1,
      password: "TestWink@2026",
    }),
    201,
    "Admin creates second collaborator",
  );
  userIds.push(peer.id);
  await common.login(`test-${suffix}@sirius.local`, "TestWink@2026");
  await other.login(`other-${suffix}@sirius.local`, "TestWink@2026");
  expect(
    await common.request("/users"),
    403,
    "Collaborator cannot list or manage people",
  );
  expect(
    await common.request("/users", "POST", {}),
    403,
    "Collaborator cannot create people",
  );
  const draft = {
    user_id: user.id,
    date: today,
    description: "Teste automatizado",
    jira_url: "",
    trello_url: "",
    start: "09:00",
    end: "12:00",
    return_time: "13:00",
    final_end: "18:00",
    extra: 0,
    on_call: 0,
  };
  expect(
    await common.request("/entries", "POST", { ...draft, description: " " }),
    422,
    "Requires description or Jira/Trello link",
  );
  expect(
    await common.request("/entries", "POST", {
      ...draft,
      start: "15:00",
      end: "12:00",
    }),
    422,
    "Rejects inverted first interval",
  );
  expect(
    await common.request("/entries", "POST", {
      ...draft,
      return_time: "11:00",
    }),
    422,
    "Rejects return before first exit",
  );
  expect(
    await common.request("/entries", "POST", { ...draft, final_end: "12:00" }),
    422,
    "Rejects inverted second interval",
  );
  expect(
    await common.request("/entries", "POST", { ...draft, final_end: "" }),
    422,
    "Requires both return and final exit",
  );
  expect(
    await common.request("/entries", "POST", { ...draft, start: "25:00" }),
    422,
    "Rejects invalid time",
  );
  expect(
    await common.request("/entries", "POST", {
      ...draft,
      jira_url: "javascript:alert(1)",
    }),
    422,
    "Rejects unsafe link scheme",
  );
  expect(
    await common.request("/entries", "POST", { ...draft, date: "2026-02-30" }),
    422,
    "Rejects invalid date",
  );
  const first = expect(
    await common.request("/entries", "POST", draft),
    201,
    "Collaborator creates today entry",
  );
  ids.push(first.id);
  expect(
    await common.request("/entries", "POST", draft),
    422,
    "Rejects overlapping intervals",
  );
  const adjacent = expect(
    await common.request("/entries", "POST", {
      ...draft,
      start: "12:00",
      end: "13:00",
      return_time: "",
      final_end: "",
    }),
    201,
    "Allows work within another entry break and touching boundaries",
  );
  ids.push(adjacent.id);
  const x = expect(
    await common.request("/entries", "POST", { ...draft, extra: 1 }),
    201,
    "Extra allows overlap",
  );
  ids.push(x.id);
  const plantao = expect(
    await common.request("/entries", "POST", { ...draft, on_call: 1 }),
    201,
    "Plantão allows overlap",
  );
  ids.push(plantao.id);
  const dayRows = expect(
    await common.request(`/entries?from=${today}&to=${today}`),
    200,
    "Collaborator reads own records",
  );
  assert.equal(dayRows.find((e) => e.id === first.id).minutes, 480);
  checks++;
  console.log("✓ Total excludes lunch break");
  const expectedMode = [1, 5].includes(new Date(today + "T12:00:00").getDay())
    ? "Remoto"
    : [2, 3, 4].includes(new Date(today + "T12:00:00").getDay())
      ? "Presencial"
      : "Fim de semana";
  assert.equal(dayRows[0].mode, expectedMode);
  checks++;
  expect(
    await other.request("/entries/" + first.id, "PUT", draft),
    403,
    "Cannot edit another person entry",
  );
  expect(
    await other.request("/entries/" + first.id, "DELETE"),
    403,
    "Cannot delete another person entry",
  );
  const peerRows = expect(
    await other.request(
      `/entries?from=${today}&to=${today}&user_id=${user.id}`,
    ),
    200,
    "Query parameters cannot bypass user isolation",
  );
  assert.equal(peerRows.length, 0);
  expect(
    await common.request("/entries/" + first.id, "PUT", {
      ...draft,
      description: "Atualizado",
    }),
    200,
    "Collaborator edits own today record",
  );
  expect(
    await common.request("/entries/" + first.id, "PUT", {
      ...draft,
      date: "2001-02-10",
    }),
    403,
    "Cannot move today entry to a locked day",
  );
  const old = expect(
    await common.request("/entries", "POST", { ...draft, date: "2001-02-10" }),
    201,
    "Collaborator can register a past day",
  );
  ids.push(old.id);
  expect(
    await common.request("/entries/" + old.id, "PUT", {
      ...draft,
      date: "2001-02-10",
    }),
    403,
    "Past entries are locked for collaborators",
  );
  expect(
    await common.request("/entries/" + old.id, "DELETE"),
    403,
    "Collaborator cannot delete past entry",
  );
  expect(
    await admin.request("/entries/" + old.id, "PUT", {
      ...draft,
      date: "2001-02-10",
      description: "Corrigido pelo administrador",
    }),
    200,
    "Admin corrects another person past hours",
  );
  const jira = expect(
    await common.request("/entries", "POST", {
      ...draft,
      date: "2001-02-11",
      description: "",
      jira_url: "https://sirius.atlassian.net/browse/SW-1",
    }),
    201,
    "Jira alone satisfies activity requirement",
  );
  ids.push(jira.id);
  const trello = expect(
    await common.request("/entries", "POST", {
      ...draft,
      date: "2001-02-12",
      description: "",
      trello_url: "https://trello.com/c/example",
    }),
    201,
    "Trello alone satisfies activity requirement",
  );
  ids.push(trello.id);
  const holiday = "2001-02-13";
  calendarDates.push(holiday);
  expect(
    await common.request("/calendar/" + holiday, "PUT", {
      title: "Não permitido",
      holiday: 1,
    }),
    403,
    "Collaborator cannot change calendar",
  );
  expect(
    await admin.request("/calendar/" + holiday, "PUT", {
      title: "Feriado de teste",
      note: "Fixture temporária",
      holiday: 1,
    }),
    200,
    "Admin registers holiday",
  );
  expect(
    await common.request("/entries", "POST", { ...draft, date: holiday }),
    422,
    "Holiday blocks collaborator",
  );
  expect(
    await admin.request("/entries", "POST", {
      ...draft,
      date: holiday,
      extra: 1,
      on_call: 1,
    }),
    422,
    "Holiday blocks admin, extra, and plantão",
  );
  expect(
    await admin.request("/calendar/2001-02-10", "PUT", {
      title: "Feriado com horas",
      holiday: 1,
    }),
    422,
    "Cannot mark holiday over existing hours",
  );
  expect(
    await common.request("/calendar?from=2001-02-01&to=2001-02-28"),
    200,
    "Collaborator reads calendar",
  );
  const report = expect(
    await admin.request(
      "/entries?from=2001-02-01&to=2001-02-28&user_id=" + user.id,
    ),
    200,
    "Admin filters report by user and period",
  );
  assert.equal(report.length, 3);
  expect(
    await admin.request("/entries?from=2001-03-01&to=2001-02-01"),
    422,
    "Rejects inverted report period",
  );
  const exportRes = await admin.request(
    "/entries?from=2001-02-01&to=2001-02-28&format=csv",
  );
  expect(exportRes, 200, "Exports CSV");
  assert.match(exportRes.body, /Pessoa;Data/);
  const savedCsrf = common.csrf;
  common.csrf = "wrong";
  expect(
    await common.request("/entries", "POST", draft),
    403,
    "CSRF protection rejects invalid tokens",
  );
  common.csrf = savedCsrf;
  expect(
    await admin.request("/users/" + user.id, "PUT", {
      name: "Teste Integração",
      email: `test-${suffix}@sirius.local`,
      role: "user",
      active: 0,
      password: "",
    }),
    200,
    "Admin deactivates access",
  );
  expect(
    await common.request("/entries"),
    401,
    "Deactivation invalidates an existing session",
  );
  expect(
    await other.request("/password", "PUT", {
      current: "TestWink@2026",
      password: "TestWink@2027",
    }),
    200,
    "Collaborator changes own password",
  );
  expect(
    await other.request("/logout", "POST", {}),
    200,
    "Logout ends session",
  );
  await other.login(`other-${suffix}@sirius.local`, "TestWink@2027");
  checks++;
  console.log("✓ New password works");
} finally {
  for (const id of ids)
    expect(
      await admin.request("/entries/" + id, "DELETE"),
      200,
      "Cleanup entry " + id,
    );
  for (const date of calendarDates)
    expect(
      await admin.request("/calendar/" + date, "DELETE"),
      200,
      "Cleanup calendar " + date,
    );
  // User deletion is intentionally not exposed: keep history and deactivate test identities.
  for (const [i, id] of userIds.entries())
    await admin.request("/users/" + id, "PUT", {
      name: i ? "Outro Teste (inativo)" : "Teste Integração (inativo)",
      email: `${i ? "other" : "test"}-${suffix}@sirius.local`,
      role: "user",
      active: 0,
      password: "",
    });
}
console.log(`\n${checks} checks passed.`);
