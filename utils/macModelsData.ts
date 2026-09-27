
export interface MacModelInfo {
  model_number: string;
  name: string;
  colors: string[];
  screen_size: string;
}

export const MAC_MODELS_DB: MacModelInfo[] = [
  // --- 2026 (NOUVEAU MODÈLE NEO) ---
  { 
    model_number: "A3404", 
    name: "MacBook Neo (13 pouces, 2026)", 
    colors: ["Silver", "Blush", "Citrus", "Indigo"], 
    screen_size: '13"' 
  },

  // --- 2025 (PRÉVISIONS / M5) ---
  { model_number: "A3434", name: "MacBook Pro 14 (M5, 2025)", colors: ["Noir sidéral", "Argent"], screen_size: '14"' },
  { model_number: "A3240", name: "MacBook Air 13 (M4, 2025)", colors: ["Minuit", "Lumière stellaire", "Gris sidéral", "Argent"], screen_size: '13.6"' },
  { model_number: "A3241", name: "MacBook Air 15 (M4, 2025)", colors: ["Minuit", "Lumière stellaire", "Gris sidéral", "Argent"], screen_size: '15.3"' },

  // --- 2024 (M4 & M3 Air) ---
  { model_number: "A3112", name: "MacBook Pro 14 (M4, 2024)", colors: ["Noir sidéral", "Argent"], screen_size: '14.2"' },
  { model_number: "A3185", name: "MacBook Pro 14 (M4 Pro, 2024)", colors: ["Noir sidéral", "Argent"], screen_size: '14.2"' },
  { model_number: "A3401", name: "MacBook Pro 14 (M4 Max, 2024)", colors: ["Noir sidéral", "Argent"], screen_size: '14.2"' },
  { model_number: "A3186", name: "MacBook Pro 16 (M4 Pro, 2024)", colors: ["Noir sidéral", "Argent"], screen_size: '16.2"' },
  { model_number: "A3403", name: "MacBook Pro 16 (M4 Max, 2024)", colors: ["Noir sidéral", "Argent"], screen_size: '16.2"' },
  { model_number: "A3113", name: "MacBook Air 13 (M3, 2024)", colors: ["Minuit", "Lumière stellaire", "Gris sidéral", "Argent"], screen_size: '13.6"' },
  { model_number: "A3114", name: "MacBook Air 15 (M3, 2024)", colors: ["Minuit", "Lumière stellaire", "Gris sidéral", "Argent"], screen_size: '15.3"' },

  // --- 2023 (M3 Pro & M2 Air 15) ---
  { model_number: "A2918", name: "MacBook Pro 14 (M3, Nov 2023)", colors: ["Noir sidéral", "Argent"], screen_size: '14.2"' },
  { model_number: "A2992", name: "MacBook Pro 14 (M3 Pro/Max, Nov 2023)", colors: ["Noir sidéral", "Argent"], screen_size: '14.2"' },
  { model_number: "A2991", name: "MacBook Pro 16 (M3 Pro/Max, Nov 2023)", colors: ["Noir sidéral", "Argent"], screen_size: '16.2"' },
  { model_number: "A2779", name: "MacBook Pro 14 (M2 Pro/Max, Jan 2023)", colors: ["Gris sidéral", "Argent"], screen_size: '14.2"' },
  { model_number: "A2780", name: "MacBook Pro 16 (M2 Pro/Max, Jan 2023)", colors: ["Gris sidéral", "Argent"], screen_size: '16.2"' },
  { model_number: "A2941", name: "MacBook Air 15 (M2, 2023)", colors: ["Minuit", "Lumière stellaire", "Gris sidéral", "Argent"], screen_size: '15.3"' },

  // --- 2022 (M2) ---
  { model_number: "A2338", name: "MacBook Pro 13 (M2, 2022)", colors: ["Gris sidéral", "Argent"], screen_size: '13.3"' },
  { model_number: "A2681", name: "MacBook Air 13 (M2, 2022)", colors: ["Minuit", "Lumière stellaire", "Gris sidéral", "Argent"], screen_size: '13.6"' },

  // --- 2021 (M1 Pro/Max) ---
  { model_number: "A2442", name: "MacBook Pro 14 (M1 Pro/Max, 2021)", colors: ["Gris sidéral", "Argent"], screen_size: '14.2"' },
  { model_number: "A2485", name: "MacBook Pro 16 (M1 Pro/Max, 2021)", colors: ["Gris sidéral", "Argent"], screen_size: '16.2"' },

  // --- 2020 (L'année charnière : Intel & M1) ---
  { model_number: "A2338", name: "MacBook Pro 13 (M1, 2020)", colors: ["Gris sidéral", "Argent"], screen_size: '13.3"' },
  { model_number: "A2337", name: "MacBook Air 13 (M1, 2020)", colors: ["Gris sidéral", "Argent", "Or"], screen_size: '13.3"' },
  { model_number: "A2289", name: "MacBook Pro 13 (Intel, 2 ports, 2020)", colors: ["Gris sidéral", "Argent"], screen_size: '13.3"' },
  { model_number: "A2251", name: "MacBook Pro 13 (Intel, 4 ports, 2020)", colors: ["Gris sidéral", "Argent"], screen_size: '13.3"' },
  { model_number: "A2179", name: "MacBook Air 13 (Intel, Retina, 2020)", colors: ["Gris sidéral", "Argent", "Or"], screen_size: '13.3"' },

  // --- 2019 ---
  { model_number: "A2141", name: "MacBook Pro 16 (2019)", colors: ["Gris sidéral", "Argent"], screen_size: '16"' },
  { model_number: "A2159", name: "MacBook Pro 13 (2 ports, 2019)", colors: ["Gris sidéral", "Argent"], screen_size: '13.3"' },
  { model_number: "A1989", name: "MacBook Pro 13 (4 ports, 2019)", colors: ["Gris sidéral", "Argent"], screen_size: '13.3"' },
  { model_number: "A1990", name: "MacBook Pro 15 (2019)", colors: ["Gris sidéral", "Argent"], screen_size: '15.4"' },
  { model_number: "A1932", name: "MacBook Air 13 (Retina, 2019)", colors: ["Gris sidéral", "Argent", "Or"], screen_size: '13.3"' },

  // --- 2018 ---
  { model_number: "A1989", name: "MacBook Pro 13 (Touch Bar, 2018)", colors: ["Gris sidéral", "Argent"], screen_size: '13.3"' },
  { model_number: "A1990", name: "MacBook Pro 15 (Touch Bar, 2018)", colors: ["Gris sidéral", "Argent"], screen_size: '15.4"' },
  { model_number: "A1932", name: "MacBook Air 13 (Retina, 2018)", colors: ["Gris sidéral", "Argent", "Or"], screen_size: '13.3"' },

  // --- 2016-2017 ---
  { model_number: "A1706", name: "MacBook Pro 13 (Touch Bar, 2016/17)", colors: ["Gris sidéral", "Argent"], screen_size: '13.3"' },
  { model_number: "A1708", name: "MacBook Pro 13 (Sans Touch Bar, 2016/17)", colors: ["Gris sidéral", "Argent"], screen_size: '13.3"' },
  { model_number: "A1707", name: "MacBook Pro 15 (Touch Bar, 2016/17)", colors: ["Gris sidéral", "Argent"], screen_size: '15.4"' },

  // --- UNIBODY & RETINA (Classiques) ---
  { model_number: "A1502", name: "MacBook Pro 13 (Retina, 2013-2015)", colors: ["Argent"], screen_size: '13.3"' },
  { model_number: "A1398", name: "MacBook Pro 15 (Retina, 2012-2015)", colors: ["Argent"], screen_size: '15.4"' },
  { model_number: "A1425", name: "MacBook Pro 13 (Retina, Early 2013)", colors: ["Argent"], screen_size: '13.3"' },
  { model_number: "A1534", name: "MacBook 12 (Retina, 2015-2017)", colors: ["Gris sidéral", "Argent", "Or", "Or Rose"], screen_size: '12"' },

  // --- MACBOOK AIR LEGACY ---
  { model_number: "A1466", name: "MacBook Air 13 (MagSafe 2, 2012-2017)", colors: ["Argent"], screen_size: '13.3"' },
  { model_number: "A1465", name: "MacBook Air 11 (MagSafe 2, 2012-2015)", colors: ["Argent"], screen_size: '11.6"' },
  { model_number: "A1369", name: "MacBook Air 13 (Late 2010/2011)", colors: ["Argent"], screen_size: '13.3"' },
  { model_number: "A1370", name: "MacBook Air 11 (Late 2010/2011)", colors: ["Argent"], screen_size: '11.6"' },

  // --- UNIBODY (L'âge d'or) ---
  { model_number: "A1278", name: "MacBook Pro 13 (Unibody, 2008-2012)", colors: ["Argent"], screen_size: '13.3"' },
  { model_number: "A1286", name: "MacBook Pro 15 (Unibody, 2008-2012)", colors: ["Argent"], screen_size: '15.4"' },
  { model_number: "A1297", name: "MacBook Pro 17 (Unibody, 2009-2011)", colors: ["Argent"], screen_size: '17"' },
  { model_number: "A1342", name: "MacBook Unibody (Polycarbonate Blanc, 2009-2010)", colors: ["Blanc"], screen_size: '13.3"' },
  { model_number: "A1181", name: "MacBook (Polycarbonate Blanc/Noir, 2006-2009)", colors: ["Blanc", "Noir"], screen_size: '13.3"' },
  { model_number: "A1185", name: "MacBook Pro 15 (Core Duo, 2006)", colors: ["Argent"], screen_size: '15.4"' },
  
  // --- Modèles Spéciaux / Neo (Comme demandés) ---
  { model_number: "NEO01", name: "MacBook Neo Pro Gen 1 (Custom)", colors: ["Noir Minuit", "Gris sidéral", "Argent"], screen_size: '14.2"' },
  { model_number: "NEO02", name: "MacBook Neo Air Gen 1 (Custom)", colors: ["Minuit", "Lumière stellaire", "Argent"], screen_size: '13.6"' }
];

export const findMacByModel = (modelPart: string): MacModelInfo | undefined => {
  if (!modelPart) return undefined;
  const normalized = modelPart.trim().toUpperCase();
  const exact = MAC_MODELS_DB.find(m => m.model_number === normalized);
  if (exact) return exact;

  const withA = normalized.startsWith('A') ? normalized : `A${normalized}`;
  const matchA = MAC_MODELS_DB.find(m => m.model_number === withA);
  if (matchA) return matchA;

  if (normalized.length >= 3) {
    const byName = MAC_MODELS_DB.find(m => 
      m.name.toUpperCase().includes(normalized) || 
      normalized.includes(m.model_number)
    );
    if (byName) return byName;
  }
  return undefined;
};
