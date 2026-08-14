import { hashPassword } from "../src/auth.js";
import { prisma } from "../src/db.js";
import { postTx, systemAccount, userAccount } from "../src/ledger.js";
import { COIN } from "../src/money.js";

/**
 * Demo data: three neighbours in Brooklyn with a dozen things to sell.
 *
 * Photos come from picsum.photos so the seed works with no assets checked in —
 * swap them for real product shots before showing this to anyone.
 */

const PASSWORD = "password123";

const people = [
  {
    email: "maya@example.com",
    displayName: "Maya",
    bio: "Moving out of a 4th-floor walkup. Everything must go.",
    city: "Brooklyn",
    state: "NY",
    zip: "11211",
    startingCoins: 240 * COIN,
  },
  {
    email: "dev@example.com",
    displayName: "Dev",
    bio: "Fixes old speakers. Sells the ones that survive.",
    city: "Brooklyn",
    state: "NY",
    zip: "11222",
    startingCoins: 80 * COIN,
  },
  {
    email: "sam@example.com",
    displayName: "Sam",
    bio: "Thrifting is a personality trait.",
    city: "Queens",
    state: "NY",
    zip: "11101",
    startingCoins: 45 * COIN,
  },
];

const items = [
  { seller: 0, title: "Mid-century walnut dresser", category: "furniture", condition: "GOOD", priceCoins: 180 * COIN, description: "Six drawers, all sliding smoothly. One scuff on the left side, photographed. Pickup in Williamsburg, I'll help you carry it down." },
  { seller: 0, title: "IKEA Poäng chair + footstool", category: "furniture", condition: "LIKE_NEW", priceCoins: 45 * COIN, description: "Bought last spring, barely sat in. Cushion cover washed and ready." },
  { seller: 0, title: "Le Creuset dutch oven, 5.5qt", category: "home", condition: "GOOD", priceCoins: 120 * COIN, description: "Flame orange. Enamel is intact, base has normal use marks. These go for $400 new." },
  { seller: 0, title: "Standing desk frame, motorized", category: "furniture", condition: "GOOD", priceCoins: 95 * COIN, description: "Frame only, no top. Motor works, memory presets work. Fits tops up to 60 inches." },
  { seller: 1, title: "KEF Q150 bookshelf speakers", category: "electronics", condition: "GOOD", priceCoins: 160 * COIN, description: "Recapped the crossovers myself last month. They sound better than the day they left the factory." },
  { seller: 1, title: "Technics SL-1200 MK2", category: "electronics", condition: "FAIR", priceCoins: 320 * COIN, description: "Honest condition — pitch fader is scratchy, everything else is solid. New cartridge included." },
  { seller: 1, title: "Sony WH-1000XM4", category: "electronics", condition: "LIKE_NEW", priceCoins: 110 * COIN, description: "Earpads replaced with fresh ones. Comes with the case and cable." },
  { seller: 1, title: "Box of vinyl — 70s soul", category: "books", condition: "GOOD", priceCoins: 65 * COIN, description: "About 40 records. Mostly VG+, a few beat up. Take the whole box." },
  { seller: 2, title: "Carhartt detroit jacket, M", category: "clothing", condition: "GOOD", priceCoins: 55 * COIN, description: "Broken in exactly the way you want. Blanket lining is clean." },
  { seller: 2, title: "Vintage Levi's 501, 32x30", category: "clothing", condition: "GOOD", priceCoins: 40 * COIN, description: "Redline selvedge, honest fades, no repairs needed. Measured flat, tag says 32." },
  { seller: 2, title: "Cast iron skillet, 12 inch", category: "home", condition: "GOOD", priceCoins: 22 * COIN, description: "Seasoned black and slick. Griswold-era, no wobble." },
  { seller: 2, title: "Brompton folding bike", category: "sports", condition: "FAIR", priceCoins: 420 * COIN, description: "M6L. Needs new tires and a tune-up, which is why it's priced where it is. Folds and rolls fine." },
];

async function main() {
  console.log("Clearing existing data…");
  // Order matters: children before parents.
  await prisma.message.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.ledgerTx.deleteMany();
  await prisma.account.deleteMany();
  await prisma.order.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.topUp.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(PASSWORD);

  const users = [];
  for (const person of people) {
    const user = await prisma.user.create({
      data: {
        email: person.email,
        passwordHash,
        displayName: person.displayName,
        bio: person.bio,
        city: person.city,
        state: person.state,
        zip: person.zip,
        avatarUrl: `https://picsum.photos/seed/${person.displayName}-avatar/200/200`,
      },
    });

    // Hand out starting coins through the ledger rather than inserting a balance,
    // so the demo data obeys the same invariants as real money.
    await prisma.$transaction(async (tx) => {
      const account = await userAccount(tx, user.id);
      const mint = await systemAccount(tx, "SYSTEM_MINT");
      await postTx(tx, {
        kind: "BONUS",
        reference: `seed:${user.id}`,
        memo: "Welcome coins",
        entries: [
          { accountId: mint, delta: -person.startingCoins },
          { accountId: account, delta: person.startingCoins },
        ],
      });
    });

    users.push(user);
    console.log(`  ${person.email} — ${person.startingCoins / COIN} coins`);
  }

  console.log("Creating listings…");
  for (const item of items) {
    const seller = users[item.seller]!;
    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: item.title,
        description: item.description,
        priceCoins: item.priceCoins,
        category: item.category,
        condition: item.condition,
        city: seller.city,
        state: seller.state,
        zip: seller.zip,
        photos: {
          create: [
            { url: `https://picsum.photos/seed/${slug}/900/900`, position: 0 },
            { url: `https://picsum.photos/seed/${slug}-2/900/900`, position: 1 },
          ],
        },
      },
    });
  }

  console.log(`\nDone. ${users.length} users, ${items.length} listings.`);
  console.log(`Sign in with any of the emails above, password: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
