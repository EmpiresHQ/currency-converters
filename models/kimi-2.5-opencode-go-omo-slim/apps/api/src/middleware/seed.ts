import type { MiddlewareHandler } from 'hono';
import type { Database } from '../db/types';
import type { Kysely } from 'kysely';
import { fetchAndStoreRates } from '../services/rate-fetcher';

let seeded = false;

export const seedMiddleware: MiddlewareHandler<{
  Bindings: { DB: D1Database };
  Variables: { db: Kysely<Database> };
}> = async (c, next) => {
  if (!seeded) {
    const db = c.get('db');
    
    // Check if we have both fiat and crypto currencies
    const fiatCount = await db
      .selectFrom('currencies')
      .select((eb) => eb.fn.countAll().as('count'))
      .where('type', '=', 'fiat')
      .executeTakeFirst();
    
    const cryptoCount = await db
      .selectFrom('currencies')
      .select((eb) => eb.fn.countAll().as('count'))
      .where('type', '=', 'crypto')
      .executeTakeFirst();

    const hasFiat = Number(fiatCount?.count || 0) > 0;
    const hasCrypto = Number(cryptoCount?.count || 0) > 0;

    if (!hasFiat || !hasCrypto) {
      console.log('Seeding database with initial rates...');
      try {
        await fetchAndStoreRates(db);
        console.log('Database seeded successfully');
      } catch (error) {
        console.error('Failed to seed database:', error);
      }
    }
    
    seeded = true;
  }
  
  await next();
};
