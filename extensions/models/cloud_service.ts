// A model type for one service in the fake cloud control plane.
// Reference solution for the DevOpsDays workshop.
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  baseUrl: z.string().describe("Control plane base URL"),
  serviceId: z.string().describe("Service id in the control plane"),
});

const AuditSchema = z.object({
  serviceId: z.string(),
  state: z.string(),
  health: z.string(),
  version: z.string(),
  image: z.string(),
  memoryMb: z.number(),
  owner: z.string(),
  tier: z.string(),
  ok: z.boolean(),
  driftDetected: z.boolean(),
  desiredVersion: z.string(),
  findings: z.array(z.string()),
  auditedAt: z.string(),
}).passthrough();

const RestartSchema = z.object({
  serviceId: z.string(),
  restarted: z.boolean(),
  health: z.string(),
  restartedAt: z.string(),
}).passthrough();

type Ctx = {
  globalArgs: z.infer<typeof GlobalArgsSchema>;
  writeResource: (
    specName: string,
    name: string,
    data: Record<string, unknown>,
  ) => Promise<{ name: string }>;
};

export const model = {
  type: "@workshop/cloud-service",
  version: "2026.08.21.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    "audit": {
      description: "Health and drift audit for one service",
      schema: AuditSchema,
      lifetime: "infinite",
      garbageCollection: 20,
    },
    "restart": {
      description: "Result of a restart action",
      schema: RestartSchema,
      lifetime: "infinite",
      garbageCollection: 20,
    },
  },
  methods: {
    // Reachability probe. Without this, a control plane that is simply DOWN
    // produces assertion failures against stale `data.latest` values that look
    // identical to real seeded problems — and you debug a runbook that is fine.
    ping: {
      description: "Verify the control plane is reachable",
      arguments: z.object({}),
      execute: async (_args: Record<string, never>, context: Ctx) => {
        const { baseUrl } = context.globalArgs;
        try {
          const res = await fetch(`${baseUrl}/`);
          if (!res.ok) {
            throw new Error(`control plane at ${baseUrl} returned ${res.status}`);
          }
        } catch (e) {
          throw new Error(
            `control plane unreachable at ${baseUrl} — start it with ./controlplane/start (${
              e instanceof Error ? e.message : String(e)
            })`,
          );
        }
        return { dataHandles: [] };
      },
    },

    audit: {
      description: "Fetch live state, compare to desired state, record findings",
      arguments: z.object({
        memoryLimitMb: z.number().default(1500),
      }),
      execute: async (args: { memoryLimitMb: number }, context: Ctx) => {
        const { baseUrl, serviceId } = context.globalArgs;

        const svcRes = await fetch(`${baseUrl}/services/${serviceId}`);
        if (!svcRes.ok) {
          throw new Error(
            `control plane returned ${svcRes.status} for ${serviceId}`,
          );
        }
        const svc = await svcRes.json();

        const desiredRes = await fetch(`${baseUrl}/desired-state`);
        const desiredAll = (await desiredRes.json()).desired as Array<
          { id: string; version: string }
        >;
        const desired = desiredAll.find((d) => d.id === serviceId);
        const desiredVersion = desired?.version ?? "unknown";

        const findings: string[] = [];
        if (svc.health !== "healthy") findings.push("health check failing");
        if (svc.state !== "running") findings.push(`state is ${svc.state}`);
        if (!svc.owner) findings.push("no owner assigned");
        if (svc.memory_mb > args.memoryLimitMb) {
          findings.push(`memory ${svc.memory_mb}MB over ${args.memoryLimitMb}MB`);
        }
        const badPorts = (svc.exposed_ports ?? []).filter((p: number) =>
          p !== 8080 && p !== 443
        );
        if (badPorts.length) {
          findings.push(`unexpected exposed ports: ${badPorts.join(",")}`);
        }
        const driftDetected = desiredVersion !== "unknown" &&
          svc.version !== desiredVersion;
        if (driftDetected) {
          findings.push(
            `version drift: running ${svc.version}, desired ${desiredVersion}`,
          );
        }

        const handle = await context.writeResource("audit", "audit", {
          serviceId,
          state: svc.state,
          health: svc.health,
          version: svc.version,
          image: svc.image,
          memoryMb: svc.memory_mb,
          owner: svc.owner ?? "",
          tier: svc.tags?.tier ?? "unknown",
          ok: findings.length === 0,
          driftDetected,
          desiredVersion,
          findings,
          auditedAt: new Date().toISOString(),
        });
        return { dataHandles: [handle] };
      },
    },

    restart: {
      description: "Restart this service via the control plane",
      arguments: z.object({}),
      execute: async (_args: Record<string, never>, context: Ctx) => {
        const { baseUrl, serviceId } = context.globalArgs;
        const res = await fetch(`${baseUrl}/services/${serviceId}/restart`, {
          method: "POST",
        });
        if (!res.ok) {
          throw new Error(`restart failed with ${res.status}`);
        }
        const body = await res.json();
        const handle = await context.writeResource("restart", "restart", {
          serviceId,
          restarted: true,
          health: body.health,
          restartedAt: new Date().toISOString(),
        });
        return { dataHandles: [handle] };
      },
    },
  },
};
