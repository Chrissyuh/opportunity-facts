import { exportPublicArtifacts } from "../lib/opportunity/artifacts";

async function main(): Promise<void> {
  const count = await exportPublicArtifacts();
  process.stdout.write(`Exported ${count} cards and the Opportunity Card JSON Schema.\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
