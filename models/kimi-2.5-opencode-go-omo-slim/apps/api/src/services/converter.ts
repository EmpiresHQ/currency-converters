import type { Kysely } from 'kysely';
import type { Database } from '../db/types';

export interface ConversionResult {
  source: string;
  target: string;
  amount: number;
  result: number;
  rate: number;
  via_usd: boolean;
}

export async function convertCurrency(
  db: Kysely<Database>,
  source: string,
  target: string,
  amount: number
): Promise<ConversionResult | null> {
  // Try direct rate (source -> target)
  const directRate = await findRate(db, source, target);
  if (directRate !== null) {
    return {
      source,
      target,
      amount,
      result: amount * directRate,
      rate: directRate,
      via_usd: false,
    };
  }

  // Try via USD
  const sourceToUsd = await findRate(db, source, 'USD');
  const usdToTarget = await findRate(db, 'USD', target);

  if (sourceToUsd !== null && usdToTarget !== null) {
    const combinedRate = sourceToUsd * usdToTarget;
    return {
      source,
      target,
      amount,
      result: amount * combinedRate,
      rate: combinedRate,
      via_usd: true,
    };
  }

  return null;
}

async function findRate(
  db: Kysely<Database>,
  source: string,
  target: string
): Promise<number | null> {
  // Try direct (source, target)
  const direct = await db
    .selectFrom('rates')
    .select('rate')
    .where('source', '=', source)
    .where('target', '=', target)
    .executeTakeFirst();

  if (direct) {
    return direct.rate;
  }

  // Try inverse (target, source) and invert
  const inverse = await db
    .selectFrom('rates')
    .select('rate')
    .where('source', '=', target)
    .where('target', '=', source)
    .executeTakeFirst();

  if (inverse && inverse.rate !== 0) {
    return 1 / inverse.rate;
  }

  return null;
}
