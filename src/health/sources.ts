/**
 * Fonti scientifiche delle informazioni di salute mostrate dall'app e usate dal coach
 * (App Store, linea guida 1.4.1: le informazioni mediche devono citare le fonti).
 * Titoli e riviste restano in lingua originale; i nomi dei temi sono tradotti in i18n (`citations.topics.*`).
 * Link verificati su PubMed o sui siti ufficiali delle organizzazioni.
 */

export const SOURCE_TOPICS = [
  'energy',
  'nutrition',
  'hydration',
  'activity',
  'sleep',
  'heart',
  'glucose',
  'body',
  'labs',
  'mind',
  'diets',
] as const;
export type SourceTopic = (typeof SOURCE_TOPICS)[number];

export interface Citation {
  /** Autori o organizzazione. */
  authors: string;
  title: string;
  /** Rivista o editore, con l'anno. */
  publisher: string;
  url: string;
}

export const SOURCES: Record<SourceTopic, Citation[]> = {
  energy: [
    {
      authors: 'Mifflin MD, St Jeor ST, et al.',
      title: 'A new predictive equation for resting energy expenditure in healthy individuals',
      publisher: 'Am J Clin Nutr, 1990',
      url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
    },
    {
      authors: 'EFSA',
      title: 'Dietary Reference Values for nutrients and energy (DRV Finder)',
      publisher: 'European Food Safety Authority',
      url: 'https://multimedia.efsa.europa.eu/drvs/index.htm',
    },
  ],
  nutrition: [
    {
      authors: 'World Health Organization',
      title: 'Healthy diet (fact sheet)',
      publisher: 'WHO',
      url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    },
    {
      authors: 'World Health Organization',
      title: 'Guideline: sugars intake for adults and children',
      publisher: 'WHO, 2015',
      url: 'https://www.who.int/publications/i/item/9789241549028',
    },
    {
      authors: 'World Health Organization',
      title: 'Salt reduction (fact sheet)',
      publisher: 'WHO',
      url: 'https://www.who.int/news-room/fact-sheets/detail/salt-reduction',
    },
    {
      authors: 'EFSA',
      title: 'Dietary Reference Values for nutrients (DRV Finder)',
      publisher: 'European Food Safety Authority',
      url: 'https://multimedia.efsa.europa.eu/drvs/index.htm',
    },
  ],
  hydration: [
    {
      authors: 'EFSA Panel on Dietetic Products, Nutrition and Allergies',
      title: 'Scientific Opinion on Dietary Reference Values for water',
      publisher: 'EFSA Journal, 2010',
      url: 'https://www.efsa.europa.eu/en/efsajournal/pub/1459',
    },
  ],
  activity: [
    {
      authors: 'World Health Organization',
      title: 'WHO guidelines on physical activity and sedentary behaviour',
      publisher: 'WHO, 2020',
      url: 'https://www.who.int/publications/i/item/9789240015128',
    },
    {
      authors: 'Paluch AE, et al.',
      title: 'Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts',
      publisher: 'Lancet Public Health, 2022',
      url: 'https://pubmed.ncbi.nlm.nih.gov/35247352/',
    },
  ],
  sleep: [
    {
      authors: 'American Academy of Sleep Medicine and Sleep Research Society',
      title: 'Recommended Amount of Sleep for a Healthy Adult: a joint consensus statement',
      publisher: 'J Clin Sleep Med, 2015',
      url: 'https://pubmed.ncbi.nlm.nih.gov/25979105/',
    },
    {
      authors: 'Hirshkowitz M, et al.',
      title: "National Sleep Foundation's sleep time duration recommendations",
      publisher: 'Sleep Health, 2015',
      url: 'https://pubmed.ncbi.nlm.nih.gov/29073412/',
    },
  ],
  heart: [
    {
      authors: 'McEvoy JW, et al. (European Society of Cardiology)',
      title: '2024 ESC Guidelines for the management of elevated blood pressure and hypertension',
      publisher: 'Eur Heart J, 2024',
      url: 'https://pubmed.ncbi.nlm.nih.gov/39210715/',
    },
    {
      authors: 'Shaffer F, Ginsberg JP',
      title: 'An Overview of Heart Rate Variability Metrics and Norms',
      publisher: 'Front Public Health, 2017',
      url: 'https://pubmed.ncbi.nlm.nih.gov/29034226/',
    },
  ],
  glucose: [
    {
      authors: 'American Diabetes Association',
      title: 'Standards of Care in Diabetes',
      publisher: 'ADA (updated yearly)',
      url: 'https://professional.diabetes.org/standards-of-care',
    },
  ],
  body: [
    {
      authors: 'World Health Organization',
      title: 'Obesity and overweight (fact sheet, BMI categories)',
      publisher: 'WHO',
      url: 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight',
    },
  ],
  labs: [
    {
      authors: 'U.S. National Library of Medicine',
      title: 'MedlinePlus: Medical Tests',
      publisher: 'NIH / NLM',
      url: 'https://medlineplus.gov/lab-tests/',
    },
  ],
  mind: [
    {
      authors: 'Goyal M, et al.',
      title: 'Meditation programs for psychological stress and well-being: a systematic review and meta-analysis',
      publisher: 'JAMA Intern Med, 2014',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24395196/',
    },
  ],
  diets: [
    {
      authors: 'Estruch R, et al.',
      title: 'Primary Prevention of Cardiovascular Disease with a Mediterranean Diet (PREDIMED)',
      publisher: 'N Engl J Med, 2018',
      url: 'https://pubmed.ncbi.nlm.nih.gov/29897866/',
    },
    {
      authors: 'Appel LJ, et al.',
      title: 'A clinical trial of the effects of dietary patterns on blood pressure (DASH)',
      publisher: 'N Engl J Med, 1997',
      url: 'https://pubmed.ncbi.nlm.nih.gov/9099655/',
    },
    {
      authors: 'Melina V, Craig W, Levin S',
      title: 'Position of the Academy of Nutrition and Dietetics: Vegetarian Diets',
      publisher: 'J Acad Nutr Diet, 2016',
      url: 'https://pubmed.ncbi.nlm.nih.gov/27886704/',
    },
    {
      authors: 'Gardner CD, et al.',
      title: 'Effect of Low-Fat vs Low-Carbohydrate Diet on 12-Month Weight Loss (DIETFITS)',
      publisher: 'JAMA, 2018',
      url: 'https://pubmed.ncbi.nlm.nih.gov/29466592/',
    },
    {
      authors: 'Paoli A, et al.',
      title: 'Beyond weight loss: a review of the therapeutic uses of very-low-carbohydrate (ketogenic) diets',
      publisher: 'Eur J Clin Nutr, 2013',
      url: 'https://pubmed.ncbi.nlm.nih.gov/23801097/',
    },
    {
      authors: 'de Cabo R, Mattson MP',
      title: 'Effects of Intermittent Fasting on Health, Aging, and Disease',
      publisher: 'N Engl J Med, 2019',
      url: 'https://pubmed.ncbi.nlm.nih.gov/31881139/',
    },
    {
      authors: 'Manheimer EW, et al.',
      title: 'Paleolithic nutrition for metabolic syndrome: systematic review and meta-analysis',
      publisher: 'Am J Clin Nutr, 2015',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26269362/',
    },
    {
      authors: 'Staudacher HM, Whelan K',
      title: 'The low FODMAP diet: recent advances in understanding its mechanisms and efficacy in IBS',
      publisher: 'Gut, 2017',
      url: 'https://pubmed.ncbi.nlm.nih.gov/28592442/',
    },
    {
      authors: 'Lennerz BS, et al.',
      title: 'Behavioral Characteristics and Self-Reported Health Status among 2029 Adults Consuming a "Carnivore Diet"',
      publisher: 'Curr Dev Nutr, 2021',
      url: 'https://pubmed.ncbi.nlm.nih.gov/34934897/',
    },
    {
      authors: 'Petroski W, Minich DM',
      title: 'Is There Such a Thing as "Anti-Nutrients"? A Narrative Review of Perceived Problematic Plant Compounds',
      publisher: 'Nutrients, 2020',
      url: 'https://pubmed.ncbi.nlm.nih.gov/32987890/',
    },
  ],
};

