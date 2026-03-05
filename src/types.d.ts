declare module 'better-sqlite3' {
  namespace Database {
    interface Statement<TBind = unknown, TResult = unknown> {
      run(params?: TBind): { changes: number; lastInsertRowid: number | bigint };
      get(params?: TBind): TResult;
      all(params?: TBind): TResult[];
    }

    interface Database {
      pragma(source: string): unknown;
      exec(sql: string): this;
      prepare<TBind = unknown, TResult = unknown>(sql: string): Statement<TBind, TResult>;
    }
  }

  interface DatabaseConstructor {
    new (path: string): Database.Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}

declare module 'bcryptjs' {
  export function hashSync(text: string, rounds?: number): string;
  export function compareSync(text: string, hash: string): boolean;
}
