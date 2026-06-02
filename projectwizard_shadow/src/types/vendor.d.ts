/**
 * Ambient type declarations for packages whose built-in typings are not
 * visible under moduleResolution "node" (e.g. ini v5 uses the "exports"
 * field which requires "node16" / "bundler" resolution to be picked up).
 */

declare module 'ini' {
  /** Parse an INI string and return a plain object. */
  export function parse(str: string): Record<string, any>;

  /** Serialize a plain object to an INI string. */
  export function stringify(
    obj: Record<string, any>,
    opt?: { section?: string; whitespace?: boolean },
  ): string;

  /** Alias of stringify. */
  export function encode(
    obj: Record<string, any>,
    opt?: { section?: string; whitespace?: boolean },
  ): string;

  /** Alias of parse. */
  export function decode(str: string): Record<string, any>;
}
