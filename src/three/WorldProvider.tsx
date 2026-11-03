import type { ReactNode } from 'react';

/**
 * The particle volcano is gone: the command-center look is flat graphite, so there is no canvas any more.
 * The hooks stay (as no-ops) so every screen keeps compiling unchanged.
 */
export type Scene = Record<string, unknown>;
const noop = () => {};
const ctx = { setScene: noop as (s: Scene) => void, burst: noop, setDimmed: noop as (d: boolean) => void };

export function WorldProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
export const useWorld = () => ctx;
export function useWorldScene(_scene: Scene, _deps: unknown[] = []) { void _scene; void _deps; }
