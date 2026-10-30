/**
 * Barrel re-export of the engine type definitions.
 *
 * The authoritative definitions now live in `services/engine.ts`. This
 * file is kept as a stable import path for code that already depends
 * on the previous `types.ts` exports (`Person`, `EngineResult`,
 * `EngineResponse`, `Engine`, and the edge-specific `EngineClass`).
 */

import type {
  Person,
  EngineResult,
  EngineResponse,
  Engine,
} from "./services/engine.ts";

export type { Person, EngineResult, EngineResponse, Engine };

/**
 * Class-level (static) contract for an engine. Each implementation
 * exposes `name`, `isSync`, `isAsync`, and a stateless `isValid` check
 * as static members because they do not depend on instance state.
 *
 * Retained for backward compatibility with callers that need to reason
 * about validity via the class without instantiating every engine
 * upfront. New code should rely on the `Engine` instance interface
 * from `services/engine.ts`.
 */
export interface EngineClass {
  readonly name: string;
  readonly isSync: boolean;
  readonly isAsync: boolean;
  isValid(contact: Partial<Person>): boolean;
}
