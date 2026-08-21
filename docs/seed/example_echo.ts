// SEED / FALLBACK LEVER — not part of the exercises.
//
// Copy this into extensions/models/ if Exercise 2 is running long, and tell
// participants to have their agent EXTEND it rather than author a model from
// scratch. Extending a working model is a more realistic task anyway.
//
//   cp docs/seed/example_echo.ts extensions/models/
//   swamp model type search --json                # @workshop/example-echo
//   swamp model create @workshop/example-echo my-echo
//   # then edit models/@workshop/example-echo/my-echo.yaml to set message:
//   swamp model @workshop/example-echo method run say my-echo
//
// It deliberately does NOT touch the control plane. It only demonstrates the
// four things a participant needs to see: the export shape, zod schemas for
// globalArguments and resources, a method with an execute function, and
// writeResource().
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  message: z.string().describe("Anything you want echoed back"),
});

const EchoSchema = z.object({
  message: z.string(),
  length: z.number(),
  echoedAt: z.string(),
});

type Ctx = {
  globalArgs: z.infer<typeof GlobalArgsSchema>;
  writeResource: (
    specName: string,
    name: string,
    data: Record<string, unknown>,
  ) => Promise<{ name: string }>;
};

export const model = {
  type: "@workshop/example-echo",
  version: "2026.08.21.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    "echo": {
      description: "The echoed message",
      schema: EchoSchema,
      lifetime: "infinite",
      garbageCollection: 10,
    },
  },
  methods: {
    say: {
      description: "Echo the configured message back, with a timestamp",
      arguments: z.object({}),
      execute: async (_args: Record<string, never>, context: Ctx) => {
        const { message } = context.globalArgs;

        // A real model would fetch() something here instead.
        const handle = await context.writeResource("echo", "echo", {
          message,
          length: message.length,
          echoedAt: new Date().toISOString(),
        });

        return { dataHandles: [handle] };
      },
    },
  },
};
