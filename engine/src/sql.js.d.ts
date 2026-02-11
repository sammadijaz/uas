/**
 * Type declarations for sql.js
 * sql.js is an Emscripten port of SQLite to JavaScript/WASM.
 */
declare module "sql.js" {
  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export interface ParamsObject {
    [key: string]: string | number | null | Uint8Array;
  }

  export type BindParams =
    | Array<string | number | null | Uint8Array>
    | ParamsObject;

  export class Statement {
    bind(params?: BindParams): boolean;
    step(): boolean;
    getAsObject(params?: BindParams): Record<string, any>;
    get(params?: BindParams): any[];
    run(values?: BindParams): void;
    free(): boolean;
    reset(): void;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: BindParams): Database;
    exec(sql: string, params?: BindParams): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  export interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
