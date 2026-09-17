/**
 * Seed the `plans` table from the PLANS config (§18). Subscriptions foreign-key
 * to `plans.key`, so this table must be populated before any Stripe subscription
 * is written. Idempotent (upsert), safe to run repeatedly. Run with:
 *
 *   npm run prisma:seed        (or: npx prisma db seed)
 *
 * stripePriceId is read from PLANS (which pulls it from env), so run this again
 * after setting STRIPE_PRICE_* to persist real price ids.
 */

import { PrismaClient, Prisma } from "@prisma/client";

import { PLANS } from "../src/lib/plans/plans";

const prisma = new PrismaClient();

async function main() {
  for (const plan of Object.values(PLANS)) {
    const data = {
      name: plan.name,
      priceMonthlyCents: plan.priceMonthlyCents,
      monthlyLeadCredits: plan.monthlyLeadCredits,
      maxActiveSearches: plan.maxActiveSearches,
      maxSeats: plan.maxSeats,
      stripePriceId: plan.stripePriceId,
      featuresJson: plan.capabilities as unknown as Prisma.InputJsonValue,
      isActive: true,
    };
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: data,
      create: { key: plan.key, ...data },
    });
  }
  console.log(`Seeded ${Object.keys(PLANS).length} plans.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });