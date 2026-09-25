// Node 24 built-in API; this project still uses @types/node 20.
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): {
      run(...values: (string | number | null)[]): { changes: number | bigint };
      get(...values: (string | number | null)[]): Record<string, unknown> | undefined;
      all(...values: (string | number | null)[]): Record<string, unknown>[];
    };
  }
}
