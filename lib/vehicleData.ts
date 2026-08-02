// Kuratierte Liste gaengiger Hersteller/Modelle fuer den deutschen Markt.
// Kein vollstaendiger VIN-Katalog - bei fehlendem Modell steht "Sonstiges Modell" zur Verfuegung.
export const CAR_MAKES = [
  "Audi",
  "BMW",
  "Citroën",
  "Dacia",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Jaguar",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Opel",
  "Peugeot",
  "Porsche",
  "Renault",
  "Seat",
  "Škoda",
  "smart",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
  "Alfa Romeo",
  "Sonstiger Hersteller",
] as const;

export type CarMake = (typeof CAR_MAKES)[number];

const SONSTIGES = "Sonstiges Modell";

export const CAR_MODELS: Record<string, string[]> = {
  Audi: ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q4 e-tron", "Q5", "Q7", "Q8", "TT", "R8", "e-tron", SONSTIGES],
  BMW: ["1er", "2er", "3er", "4er", "5er", "6er", "7er", "8er", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "Z4", "i3", "i4", "i7", "iX", SONSTIGES],
  "Citroën": ["C1", "C3", "C4", "C5 Aircross", "Berlingo", "Jumpy", "Jumper", SONSTIGES],
  Dacia: ["Sandero", "Duster", "Logan", "Jogger", "Spring", SONSTIGES],
  Fiat: ["500", "Panda", "Tipo", "500X", "500L", "Punto", "Doblo", "Ducato", SONSTIGES],
  Ford: ["Fiesta", "Focus", "Mondeo", "Kuga", "Puma", "EcoSport", "Ka+", "Galaxy", "S-Max", "Edge", "Mustang", "Transit", "Ranger", SONSTIGES],
  Honda: ["Jazz", "Civic", "CR-V", "HR-V", "e", SONSTIGES],
  Hyundai: ["i10", "i20", "i30", "i40", "Kona", "Tucson", "Santa Fe", "Bayon", "Ioniq", "Ioniq 5", SONSTIGES],
  Jaguar: ["XE", "XF", "F-Pace", "E-Pace", "I-Pace", "F-Type", SONSTIGES],
  Jeep: ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Avenger", SONSTIGES],
  Kia: ["Picanto", "Rio", "Ceed", "Stonic", "Sportage", "Sorento", "Niro", "EV6", "Soul", SONSTIGES],
  "Land Rover": ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", SONSTIGES],
  Lexus: ["CT", "IS", "ES", "RX", "NX", "UX", SONSTIGES],
  Mazda: ["2", "3", "6", "CX-3", "CX-30", "CX-5", "CX-60", "MX-5", SONSTIGES],
  "Mercedes-Benz": ["A-Klasse", "B-Klasse", "C-Klasse", "E-Klasse", "S-Klasse", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", "G-Klasse", "V-Klasse", "Sprinter", "Vito", "EQA", "EQB", "EQC", "EQE", "EQS", SONSTIGES],
  MINI: ["One", "Cooper", "Clubman", "Countryman", "Cabrio", SONSTIGES],
  Mitsubishi: ["Space Star", "ASX", "Eclipse Cross", "Outlander", "L200", SONSTIGES],
  Nissan: ["Micra", "Note", "Leaf", "Juke", "Qashqai", "X-Trail", "Navara", SONSTIGES],
  Opel: ["Corsa", "Astra", "Insignia", "Mokka", "Crossland", "Grandland", "Zafira", "Meriva", "Adam", "Karl", "Combo", "Vivaro", SONSTIGES],
  Peugeot: ["108", "208", "308", "508", "2008", "3008", "5008", "Rifter", "Partner", "Boxer", SONSTIGES],
  Porsche: ["911", "718 Boxster", "718 Cayman", "Panamera", "Macan", "Cayenne", "Taycan", SONSTIGES],
  Renault: ["Clio", "Megane", "Captur", "Kadjar", "Scenic", "Twingo", "Talisman", "Zoe", "Kangoo", "Trafic", "Master", "Austral", SONSTIGES],
  Seat: ["Ibiza", "Leon", "Arona", "Ateca", "Tarraco", "Alhambra", "Mii", SONSTIGES],
  "Škoda": ["Fabia", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Scala", "Enyaq", "Citigo", "Rapid", "Yeti", SONSTIGES],
  smart: ["fortwo", "forfour", SONSTIGES],
  Subaru: ["Impreza", "XV", "Forester", "Outback", SONSTIGES],
  Suzuki: ["Swift", "Ignis", "Vitara", "S-Cross", "Jimny", SONSTIGES],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y", SONSTIGES],
  Toyota: ["Yaris", "Corolla", "Camry", "C-HR", "RAV4", "Highlander", "Land Cruiser", "Aygo", "Prius", "Proace", SONSTIGES],
  Volkswagen: ["Golf", "Polo", "Passat", "Tiguan", "Touran", "Sharan", "Up!", "T-Roc", "T-Cross", "Touareg", "Arteon", "ID.3", "ID.4", "ID.5", "Caddy", "Transporter", "Multivan", "Sonstiges Modell"],
  Volvo: ["V40", "V60", "V90", "S60", "S90", "XC40", "XC60", "XC90", SONSTIGES],
  "Alfa Romeo": ["Giulietta", "Giulia", "Stelvio", "Tonale", SONSTIGES],
  "Sonstiger Hersteller": [SONSTIGES],
};

// Baujahre absteigend vom aktuellen Jahr bis 1950.
export function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= 1950; y--) years.push(y);
  return years;
}
