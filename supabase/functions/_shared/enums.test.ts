import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  FolderStatus,
  MiningRunMode,
  SourceHealthState,
  TaskStatus,
} from "./enums.ts";

const manifest = JSON.parse(
  await Deno.readTextFile(
    new URL("../../../contracts/mining-enums.json", import.meta.url),
  ),
) as Record<string, Record<string, string>>;

const mirrors: Record<string, Record<string, string>> = {
  MiningRunMode,
  TaskStatus,
  SourceHealthState,
  FolderStatus,
};

Deno.test("mining enum contract (edge)", () => {
  for (const [name, values] of Object.entries(mirrors)) {
    assertEquals(values, manifest[name], `${name} drifted from the manifest`);
  }
  assert(mirrors.MiningRunMode.Incremental === "incremental");
});
