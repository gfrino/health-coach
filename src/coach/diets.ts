import type { NUTRITION_APPROACHES } from '@/config/settingsSchema';

/**
 * Schede sintetiche di ogni approccio alimentare, passate al modello nel system prompt:
 * principi, cibi da preferire / limitare, punti di attenzione. Così il coach applica la dieta
 * scelta in modo coerente (anche con i modelli piccoli, che non la conoscono nel dettaglio).
 * In inglese come il resto del prompt. Versione completa per i modelli cloud, ridotta sul telefono.
 */

export type NutritionApproach = (typeof NUTRITION_APPROACHES)[number];

export interface DietGuide {
  name: string;
  /** Una riga: usata da sola nel prompt compatto. */
  summary: string;
  principles: string[];
  prefer: string[];
  limit: string[];
  watch: string[];
}

export const DIET_GUIDES: Record<NutritionApproach, DietGuide> = {
  none: {
    name: 'No specific diet',
    summary:
      'No dietary framework: give balanced, flexible advice based on whole foods and the user’s goals.',
    principles: [
      'Mostly whole, minimally processed foods; plenty of vegetables, fruit, legumes, whole grains, nuts.',
      'Adequate protein at each meal; healthy fats (olive oil, nuts, fish).',
      'Limit added sugar, ultra-processed foods, sugary drinks and alcohol.',
    ],
    prefer: [],
    limit: [],
    watch: ['Adapt portions and energy to the user’s goals (weight, activity, sleep).'],
  },

  mediterranean: {
    name: 'Mediterranean diet',
    summary:
      'Mediterranean diet: vegetables, fruit, legumes, whole grains, extra-virgin olive oil, fish, nuts; little red meat and sugar.',
    principles: [
      'Plant foods at the base of every meal; extra-virgin olive oil as the main fat.',
      'Fish and seafood at least twice a week; poultry, eggs and dairy (yogurt, cheese) in moderation.',
      'Red and processed meat rarely; sweets occasionally; water as the main drink.',
      'Among the best-studied diets for heart and metabolic health.',
    ],
    prefer: [
      'vegetables',
      'fruit',
      'legumes',
      'whole grains',
      'extra-virgin olive oil',
      'fish',
      'nuts and seeds',
      'herbs and spices',
    ],
    limit: ['red and processed meat', 'refined grains', 'sweets', 'ultra-processed foods'],
    watch: [
      'Wine is optional, not a recommendation; suggest none if the user does not already drink.',
    ],
  },

  keto: {
    name: 'Ketogenic diet (standard)',
    summary:
      'Standard ketogenic diet: very low carb (about 20–50 g net carbs/day), moderate protein, most energy from fat; keep suggestions compatible with ketosis.',
    principles: [
      'Net carbs usually 20–50 g/day to stay in ketosis; protein moderate; fat makes up most of the energy.',
      'Build meals on meat, fish, eggs, full-fat dairy, low-carb vegetables and healthy fats.',
    ],
    prefer: [
      'meat, fish, eggs',
      'low-carb vegetables (leafy greens, broccoli, zucchini)',
      'avocado',
      'olive oil, butter',
      'nuts and seeds',
      'full-fat cheese and yogurt',
    ],
    limit: [
      'sugar and sweets',
      'grains, bread, pasta, rice',
      'potatoes and starchy vegetables',
      'most fruit (except small portions of berries)',
      'legumes',
      'sugary drinks and beer',
    ],
    watch: [
      'First weeks: "keto flu" (tiredness, headache, cramps); salt, potassium, magnesium and fluids help.',
      'Fiber and micronutrients can fall short: plenty of low-carb vegetables.',
      'Watch LDL cholesterol on lab reports.',
      'Needs a doctor first with diabetes medication (especially insulin, sulfonylureas, SGLT2 inhibitors), blood pressure medication, kidney or liver disease, pregnancy/breastfeeding or a history of eating disorders.',
    ],
  },

  healthyKeto: {
    name: 'Healthy Keto® (Dr. Eric Berg)',
    summary:
      'Healthy Keto (Dr. Berg): low carb (about 20–50 g net carbs) + large amounts of vegetables + moderate protein + healthy fats + high-quality whole foods, combined with intermittent fasting; no "dirty keto" or junk low-carb products.',
    principles: [
      'Low carb (about 20–50 g net carbs/day) to lower insulin and reach ketosis, BUT built on nutrient density: the "healthy" part is what distinguishes it from standard or "dirty" keto.',
      'Large amounts of vegetables every day (Dr. Berg suggests about 7–10 cups, mostly leafy greens and cruciferous vegetables, often as a big salad) for potassium, magnesium, fiber and vitamins.',
      'Moderate protein (about 3–6 oz / 85–170 g per meal depending on body size), not unlimited.',
      'Healthy fats to satiety, as needed: fat is used to feel full, not as a goal in itself.',
      'Food quality matters: grass-fed/pasture-raised meat, pasture-raised eggs, wild-caught fish, organic when possible.',
      'Combined with intermittent fasting: no snacking, fewer meals, gradually moving from 3 meals to 2 (e.g. 16:8 or 18:6), OMAD for some; meal frequency is as important as meal content.',
    ],
    prefer: [
      'leafy greens, salads, cruciferous vegetables (broccoli, cabbage, kale, Brussels sprouts)',
      'pasture-raised eggs',
      'grass-fed meat, wild-caught fatty fish (salmon, sardines)',
      'avocado, olives and extra-virgin olive oil, butter/ghee, coconut oil',
      'nuts and seeds in moderation',
      'full-fat cheese in moderation',
      'sea salt, electrolytes',
      'nutritional yeast, fermented foods (sauerkraut, kefir)',
    ],
    limit: [
      'sugar and hidden sugars (maltodextrin included)',
      'grains, bread, pasta, rice, cereals',
      'starchy vegetables, most fruit (small portions of berries are OK)',
      'industrial seed oils (soy, corn, canola, cottonseed)',
      'processed "keto" junk food, fast food',
      'snacking between meals',
      'alcohol',
    ],
    watch: [
      'Electrolytes, especially potassium and magnesium, are central: vegetables first, then a supplement if needed.',
      'Transition gradually (first cut sugar and snacks, then reduce carbs and meals).',
      'Some of Dr. Berg’s claims go beyond published evidence: present the diet as the user’s chosen framework, give the evidence-based rationale where it exists, and do not repeat unproven claims as facts.',
      'Same medical precautions as standard keto: a doctor must adjust diabetes and blood pressure medication; not suitable without medical supervision with kidney disease, pregnancy/breastfeeding, type 1 diabetes or a history of eating disorders.',
      'Long fasts (beyond 24 h) only with medical supervision.',
    ],
  },

  lowCarb: {
    name: 'Low-carb diet',
    summary:
      'Low-carb (moderate): usually 50–130 g carbs/day, from vegetables, some fruit and legumes; limit sugar and refined starches.',
    principles: [
      'Carbs reduced but not to ketosis levels; carbs from whole, high-fiber sources.',
      'Protein and healthy fats at every meal for satiety.',
    ],
    prefer: [
      'non-starchy vegetables',
      'meat, fish, eggs, tofu',
      'dairy',
      'berries',
      'legumes in moderate portions',
      'nuts, olive oil',
    ],
    limit: ['sugar', 'white bread, pasta, rice', 'sugary drinks', 'ultra-processed snacks'],
    watch: ['With diabetes medication, carb reduction can cause low blood sugar: doctor first.'],
  },

  vegetarian: {
    name: 'Vegetarian diet',
    summary:
      'Vegetarian: no meat or fish (eggs and dairy allowed); never suggest meat or fish; care for protein, iron, B12, omega-3.',
    principles: [
      'Protein from legumes, eggs, dairy, tofu/tempeh, seitan, whole grains, nuts.',
      'Combine iron sources with vitamin C to improve absorption.',
    ],
    prefer: ['legumes', 'eggs', 'yogurt and cheese', 'tofu, tempeh', 'whole grains', 'nuts, seeds'],
    limit: ['meat', 'fish and seafood', 'gelatin and other animal-slaughter products'],
    watch: [
      'Check B12, iron/ferritin, vitamin D and omega-3 (ALA from flax/walnuts; algae oil for DHA/EPA).',
    ],
  },

  vegan: {
    name: 'Vegan diet',
    summary:
      'Vegan: no animal products at all; never suggest them; watch B12 (supplement needed), iron, calcium, iodine, vitamin D, omega-3 and protein.',
    principles: [
      'Exclude all animal products: meat, fish, eggs, dairy, honey.',
      'Protein from legumes, soy, seitan, whole grains, nuts and seeds, spread over the day.',
    ],
    prefer: [
      'legumes and soy (tofu, tempeh, edamame)',
      'whole grains',
      'nuts and seeds (flax, chia, hemp)',
      'fortified plant milks',
      'vegetables and fruit',
    ],
    limit: ['all animal products', 'ultra-processed vegan junk food'],
    watch: [
      'Vitamin B12 must be supplemented.',
      'Check iron/ferritin, vitamin D, calcium, iodine, zinc, omega-3 (algae oil) on lab reports.',
    ],
  },

  paleo: {
    name: 'Paleo diet',
    summary:
      'Paleo: meat, fish, eggs, vegetables, fruit, nuts; no grains, legumes, dairy, refined sugar or processed foods.',
    principles: ['Whole foods "as our ancestors ate": unprocessed animal and plant foods.'],
    prefer: [
      'meat, fish, eggs',
      'vegetables',
      'fruit',
      'nuts and seeds',
      'olive, avocado and coconut oil',
      'tubers (sweet potato)',
    ],
    limit: ['grains', 'legumes', 'dairy', 'refined sugar', 'seed oils', 'processed foods'],
    watch: ['Without dairy, check calcium and vitamin D intake.'],
  },

  intermittentFasting: {
    name: 'Intermittent fasting',
    summary:
      'Intermittent fasting: eating within a time window (e.g. 16:8) or 5:2; fit meals, snacks and workout timing to the window.',
    principles: [
      'The timing of food matters: common schemes are 16:8, 14:10, 18:6 or 5:2.',
      'Inside the window: nutritious, protein-rich meals; during the fast: water, tea, black coffee.',
    ],
    prefer: [
      'protein-rich meals',
      'vegetables',
      'water, unsweetened tea, black coffee while fasting',
    ],
    limit: ['snacking outside the window', 'sugary drinks'],
    watch: [
      'Not suitable without a doctor for diabetes on medication, pregnancy/breastfeeding, a history of eating disorders, or underweight.',
      'If sleep or energy suffer, suggest a shorter fasting window.',
    ],
  },

  lowFodmap: {
    name: 'Low-FODMAP diet',
    summary:
      'Low-FODMAP: for irritable bowel symptoms; avoid high-FODMAP foods (onion, garlic, wheat, legumes, some fruit, lactose, polyols) in suggestions.',
    principles: [
      'Three phases: elimination (2–6 weeks), reintroduction group by group, personalised maintenance. Not a lifelong diet.',
      'Ideally followed with a dietitian.',
    ],
    prefer: [
      'rice, oats, quinoa',
      'carrots, zucchini, spinach, bell peppers',
      'bananas (firm), berries, citrus',
      'lactose-free dairy',
      'meat, fish, eggs, firm tofu',
    ],
    limit: [
      'onion and garlic',
      'wheat and rye',
      'legumes',
      'apples, pears, stone fruit',
      'lactose',
      'honey',
      'sugar alcohols (sorbitol, mannitol)',
    ],
    watch: ['Persistent or new gut symptoms (blood, weight loss, night symptoms) need a doctor.'],
  },

  carnivore: {
    name: 'Carnivore diet',
    summary:
      'Carnivore: animal foods only; respect the choice but flag nutritional risks (fiber, vitamin C, LDL cholesterol).',
    principles: ['Meat, fish, eggs and optionally dairy; no plant foods.'],
    prefer: ['meat (including organ meats)', 'fish', 'eggs', 'butter, tallow'],
    limit: ['all plant foods'],
    watch: [
      'Very limited evidence: respect the choice but flag risks (no fiber, possible vitamin C and micronutrient gaps, LDL cholesterol).',
      'Suggest regular lab tests (lipids, kidney function).',
    ],
  },

  lectinFree: {
    name: 'Lectin-free diet (Plant Paradox, Dr. Steven Gundry)',
    summary:
      'Lectin-free (Plant Paradox): avoid lectin-rich foods (grains, legumes unless pressure-cooked, nightshades, squash, A1 dairy, corn-fed meat); prefer leafy greens, cruciferous vegetables, avocado, olive oil, allowed nuts, pasture-raised animal foods, resistant starches.',
    principles: [
      'Lectins are plant proteins that Dr. Gundry considers harmful to the gut; the diet removes or neutralises them.',
      'Pressure-cooking deactivates most lectins: legumes and some grains are allowed only pressure-cooked.',
      'Nightshades (tomatoes, bell peppers, eggplant) only peeled and deseeded.',
      'Resistant starches in moderation; a lot of extra-virgin olive oil; polyphenol-rich foods.',
    ],
    prefer: [
      'leafy greens, cruciferous vegetables (broccoli, cauliflower, cabbage, kale)',
      'avocado',
      'extra-virgin olive oil',
      'allowed nuts: macadamia, walnuts, pistachios, pecans, hazelnuts',
      'wild-caught fish, pasture-raised poultry and eggs, grass-fed meat in moderate portions',
      'A2 dairy, goat and sheep cheese',
      'resistant starches: sweet potato, green banana, millet, sorghum, cassava',
      'pressure-cooked legumes',
    ],
    limit: [
      'wheat and most grains (including whole grains), corn',
      'legumes and peanuts, unless pressure-cooked',
      'nightshades with skin and seeds: tomatoes, peppers, eggplant, potatoes, goji',
      'squash, zucchini, cucumbers with seeds',
      'cashews, chia seeds',
      'A1 cow’s milk dairy',
      'corn- or soy-fed conventional meat and farmed fish',
      'sugar, artificial sweeteners, seed oils',
    ],
    watch: [
      'Evidence that dietary lectins harm healthy people is limited, and legumes and whole grains are linked to health benefits in large studies: present the diet as the user’s choice, without claiming unproven effects as facts.',
      'Watch fiber intake: plenty of allowed vegetables and resistant starches.',
      'Sudden change in fiber or legumes may upset the gut: go gradually.',
    ],
  },
};

/** Scheda per il system prompt. */
export function dietGuideText(approach: NutritionApproach, compact = false): string {
  const g = DIET_GUIDES[approach];
  if (compact) return `Nutrition: ${g.summary}`;
  const list = (title: string, xs: string[]) => (xs.length ? `${title}: ${xs.join('; ')}.` : null);
  return [
    `Nutrition framework chosen by the user: ${g.name}. Base all food advice (meals, recipes, shopping, snacks) on it and never suggest foods it excludes, unless health or safety requires it.`,
    ...g.principles.map((p) => `- ${p}`),
    list('Prefer', g.prefer),
    list('Avoid or limit', g.limit),
    ...g.watch.map((w) => `- Watch: ${w}`),
  ]
    .filter(Boolean)
    .join('\n');
}
