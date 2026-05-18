import { db, statements } from './db.js';

const RESET = process.argv.includes('--reset');
const TARGET_COUNT = 100;

function titleCase(s) {
  return s.split(/[\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function buildLabel(breed, sub) {
  return sub ? `${titleCase(sub)} ${titleCase(breed)}` : titleCase(breed);
}

function buildDescription(breed, sub) {
  const full = sub ? `${sub} ${breed}` : breed;
  return `A charming ${full} — would you adopt this pup?`;
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

async function main() {
  console.log('Fetching breed list from dog.ceo...');
  const { message: breedMap } = await fetchJson('https://dog.ceo/api/breeds/list/all');

  // Flatten breed → [sub] pairs
  const pairs = [];
  for (const [breed, subs] of Object.entries(breedMap)) {
    if (subs.length === 0) {
      pairs.push([breed, null]);
    } else {
      for (const sub of subs) pairs.push([breed, sub]);
    }
  }

  // Shuffle for variety, then take first TARGET_COUNT
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  const chosen = pairs.slice(0, TARGET_COUNT);
  console.log(`Selected ${chosen.length} breeds. Fetching images (parallel, batches of 20)...`);

  const items = [];
  const BATCH = 20;
  for (let i = 0; i < chosen.length; i += BATCH) {
    const batch = chosen.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async ([breed, sub]) => {
      const path = sub ? `${breed}/${sub}` : breed;
      try {
        const { message } = await fetchJson(`https://dog.ceo/api/breed/${path}/images/random`);
        return { label: buildLabel(breed, sub), description: buildDescription(breed, sub), image_url: message };
      } catch (e) {
        console.warn(`  skip ${path}: ${e.message}`);
        return null;
      }
    }));
    items.push(...results.filter(Boolean));
    process.stdout.write(`  ${Math.min(i + BATCH, chosen.length)}/${chosen.length}\r`);
  }
  console.log(`\nFetched ${items.length} image URLs.`);

  const insertMany = db.transaction((rows) => {
    if (RESET) {
      statements.clearVotes.run();
      statements.clearItems.run();
      console.log('Cleared existing items + votes (--reset).');
    }
    for (const r of rows) statements.insertItem.run(r.label, r.description, r.image_url);
  });

  insertMany(items);
  const total = db.prepare('SELECT COUNT(*) AS n FROM items').get().n;
  console.log(`Done. items table now has ${total} rows.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
