// Fake cloud control plane for the Swamp workshop.
// Single file, no dependencies. Run: deno run --allow-net controlplane/server.ts
//
// Endpoints:
//   GET  /services            list all services
//   GET  /services/:id        one service
//   POST /services/:id/restart
//   GET  /desired-state       what SHOULD be running
//   GET  /alerts
//   POST /admin/scenario/:name  inject an incident (workshop facilitator).
//        Starts a fresh episode: rewinds to baseline and clears the restart
//        log first, so a scenario is repeatable and never layers onto a
//        previous one. No need to POST /admin/reset before it.
//   POST /admin/reset           back to baseline with no incident applied
//   GET  /admin/restart-log     ground truth: what actually got restarted

type Service = {
  id: string;
  state: "running" | "stopped";
  health: "healthy" | "unhealthy";
  version: string;
  image: string;
  memory_mb: number;
  cpu_pct: number;
  owner: string | null;
  exposed_ports: number[];
  tags: Record<string, string>;
};

const baseline = (): Service[] => [
  {
    id: "payments-api",
    state: "running",
    health: "healthy",
    version: "1.8.2",
    image: "registry.internal/payments-api:1.8.2",
    memory_mb: 412,
    cpu_pct: 23,
    owner: null, // PROBLEM: no owner tag
    exposed_ports: [8080],
    tags: { tier: "production-critical" },
  },
  {
    id: "catalog-api",
    state: "running",
    health: "healthy",
    version: "2.1.0",
    image: "registry.internal/catalog-api:2.1.0",
    memory_mb: 388,
    cpu_pct: 31,
    owner: "platform",
    exposed_ports: [8080],
    tags: { tier: "standard" },
  },
  {
    id: "checkout-api",
    state: "running",
    health: "unhealthy", // PROBLEM: failing health checks
    version: "1.4.1",
    image: "registry.internal/checkout-api:1.4.1",
    memory_mb: 502,
    cpu_pct: 44,
    owner: "checkout",
    exposed_ports: [8080],
    tags: { tier: "production-critical" },
  },
  {
    id: "recommendations",
    state: "running",
    health: "healthy",
    version: "0.9.0",
    image: "registry.internal/recommendations:0.9.0",
    memory_mb: 1904, // PROBLEM: memory hog
    cpu_pct: 78,
    owner: "ml",
    exposed_ports: [8080],
    tags: { tier: "standard" },
  },
  {
    id: "legacy-api",
    state: "running",
    health: "healthy",
    version: "1.1.3",
    image: "registry.internal/legacy-api:1.1.3", // PROBLEM: vulnerable version
    memory_mb: 256,
    cpu_pct: 8,
    owner: "nobody",
    exposed_ports: [8080, 22], // PROBLEM: ssh exposed
    tags: { tier: "deprecated" },
  },
];

// desired-state deliberately disagrees with reality
const desired = [
  { id: "payments-api", version: "1.8.2", replicas: 1 },
  { id: "catalog-api", version: "2.1.0", replicas: 1 },
  { id: "checkout-api", version: "1.5.0", replicas: 1 }, // DRIFT: reality is 1.4.1
  { id: "recommendations", version: "0.9.0", replicas: 1 },
  { id: "legacy-api", version: "1.1.3", replicas: 1 },
];

const KNOWN_VULNS: Record<string, string> = {
  "registry.internal/legacy-api:1.1.3": "CVE-2026-1337 (openssl 1.0.2, critical)",
};

let services: Service[] = baseline();
let restartLog: { id: string; at: string }[] = [];

const scenarios: Record<string, () => void> = {
  "incident-1": () => {
    // checkout image changed out from under us
    const s = services.find((x) => x.id === "checkout-api")!;
    s.image = "registry.internal/checkout-api:1.4.1-hotfix.3";
    s.version = "1.4.1-hotfix.3";
  },
  // The control plane loses its tier labels. A runbook that sourced its
  // safety check from the API is now unprotected; one that sourced it from
  // the definitions in git still holds.
  "incident-3": () => {
    for (const s of services) s.tags = {};
    const p = services.find((x) => x.id === "payments-api")!;
    p.health = "unhealthy";
  },
  "incident-2": () => {
    const c = services.find((x) => x.id === "checkout-api")!;
    c.image = "registry.internal/checkout-api:1.4.1-hotfix.3";
    c.version = "1.4.1-hotfix.3";
    const p = services.find((x) => x.id === "payments-api")!;
    p.memory_mb = 3820; // memory spike
    p.health = "unhealthy";
    const cat = services.find((x) => x.id === "catalog-api")!;
    cat.state = "stopped"; // stopped outright
    cat.health = "unhealthy";
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });

const handler = (req: Request): Response => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);

  if (path === "/") {
    return json({
      service: "fake-cloud-control-plane",
      endpoints: [
        "GET /services",
        "GET /services/:id",
        "POST /services/:id/restart",
        "GET /desired-state",
        "GET /alerts",
        "POST /admin/scenario/:name",
        "POST /admin/reset",
      ],
    });
  }

  if (path === "/services" && req.method === "GET") {
    return json({ services });
  }

  if (parts[0] === "services" && parts.length === 2 && req.method === "GET") {
    const s = services.find((x) => x.id === parts[1]);
    return s ? json(s) : json({ error: "not_found", id: parts[1] }, 404);
  }

  if (
    parts[0] === "services" && parts[2] === "restart" && req.method === "POST"
  ) {
    const s = services.find((x) => x.id === parts[1]);
    if (!s) return json({ error: "not_found", id: parts[1] }, 404);
    s.state = "running";
    s.health = "healthy";
    if (s.id === "payments-api") s.memory_mb = 412;
    restartLog.push({ id: s.id, at: new Date().toISOString() });
    return json({ restarted: s.id, state: s.state, health: s.health });
  }

  if (path === "/desired-state" && req.method === "GET") {
    return json({ desired });
  }

  if (path === "/alerts" && req.method === "GET") {
    const alerts = [];
    for (const s of services) {
      if (s.health === "unhealthy") {
        alerts.push({ severity: "critical", service: s.id, msg: "health check failing" });
      }
      if (s.memory_mb > 1500) {
        alerts.push({ severity: "warning", service: s.id, msg: `memory ${s.memory_mb}MB` });
      }
      if (KNOWN_VULNS[s.image]) {
        alerts.push({ severity: "high", service: s.id, msg: KNOWN_VULNS[s.image] });
      }
      if (s.exposed_ports.some((p) => p !== 8080 && p !== 443)) {
        alerts.push({ severity: "high", service: s.id, msg: `unexpected exposed port` });
      }
      if (!s.owner) {
        alerts.push({ severity: "low", service: s.id, msg: "no owner" });
      }
    }
    return json({ alerts });
  }

  if (parts[0] === "admin" && parts[1] === "scenario" && req.method === "POST") {
    const name = parts[2];
    const fn = scenarios[name];
    if (!fn) {
      return json(
        { error: "unknown_scenario", known: Object.keys(scenarios) },
        400,
      );
    }
    // A scenario injection is the START of an episode, so rewind first.
    // Without this, restartLog accumulates across rehearsals and the
    // "exactly one restart" payoff reads as two on the second run-through;
    // incidents also layer onto each other's mutations (inject incident-3,
    // then incident-2, and the tier tags are still missing). Both bugs only
    // show up on the second pass, which is when you're on stage.
    services = baseline();
    restartLog = [];
    fn();
    return json({ applied: name, fromBaseline: true });
  }

  if (path === "/admin/reset" && req.method === "POST") {
    services = baseline();
    restartLog = [];
    return json({ reset: true });
  }

  if (path === "/admin/restart-log") {
    return json({ restartLog });
  }

  return json({ error: "not_found", path }, 404);
};

const port = Number(Deno.env.get("PORT") ?? "8099");
Deno.serve({ port, hostname: "127.0.0.1" }, handler);
console.log(`fake control plane on http://127.0.0.1:${port}`);
