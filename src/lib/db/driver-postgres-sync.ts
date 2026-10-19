import postgres from 'postgres';

type Row = Record<string, unknown>;

export class PostgresSyncDriver {
  private sql: any;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL no definido para driver postgres');
    this.sql = postgres(url, {
      ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
      max: 1,
    });
  }

  all<T extends Row = Row>(sql: string, params: unknown[] = []): T[] {
    const res = this.sql.unsafe(sql, params as any);
    return (res as any) as T[];
  }

  get<T extends Row = Row>(sql: string, params: unknown[] = []): T | undefined {
    const rows = this.all<T>(sql, params);
    return rows[0];
  }

  run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid?: bigint | number } {
    const res = this.sql.unsafe(sql, params as any);
    const changes = (res as any).count ?? 0;
    const last = (res as any)[0] as any;
    let lastInsertRowid: bigint | number | undefined;
    if (last) {
      const keys = Object.keys(last);
      if (keys.length > 0) {
        const v = last[keys[0]];
        if (typeof v === 'bigint') lastInsertRowid = v;
        else if (typeof v === 'number') lastInsertRowid = v;
        else if (v !== null && v !== undefined) lastInsertRowid = Number(v);
      }
    }
    return { changes, lastInsertRowid };
  }

  exec(sql: string): void {
    this.sql.unsafe(sql);
  }

  close(): void {
    try {
      this.sql.end({ timeout: 5 });
    } catch {}
  }
}
