import { z } from "zod";

export const damageItemSchema = z.object({
  area: z.string().describe("Betroffener Fahrzeugbereich, z.B. Fahrzeugfront, linke Seite"),
  component: z.string().describe("Vermutlich betroffenes Bauteil, z.B. Stoßfänger, Scheinwerfer"),
  damage_type: z.string().describe("Art der sichtbaren Beschädigung, z.B. Kratzer, Delle, Riss, Verformung"),
  confidence: z.enum(["low", "medium", "high"]).describe("Wie sicher dies auf den Fotos erkennbar ist"),
});

export const analysisResultSchema = z.object({
  analysis_status: z.enum(["completed", "insufficient_images", "uncertain", "failed"]),
  summary: z.string().describe("Kurze, verständliche Zusammenfassung in Alltagssprache, 2-4 Sätze"),
  visible_damage: z.array(damageItemSchema),
  severity: z.object({
    level: z.enum(["leicht", "mittel", "schwer", "nicht sicher beurteilbar"]),
    explanation: z.string(),
  }),
  drivability_warning: z.object({
    possible_safety_issue: z.boolean(),
    message: z
      .string()
      .describe(
        "Falls possible_safety_issue true ist: konkreter, vorsichtiger Sicherheitshinweis. Sonst leerer String."
      ),
  }),
  estimated_cost_range: z.object({
    possible: z
      .boolean()
      .describe("false, wenn anhand der Fotos keine seriöse Kostenspanne angegeben werden kann"),
    minimum_eur: z.number().int().nonnegative(),
    maximum_eur: z.number().int().nonnegative(),
    confidence: z.enum(["low", "medium", "high"]),
    explanation: z.string(),
  }),
  possible_hidden_damage: z.array(z.string()),
  recommended_next_steps: z.array(z.string()),
  additional_photos_requested: z.array(z.string()),
  limitations: z.array(z.string()),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const vehicleDataSchema = z.object({
  make: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  firstRegistration: z.string().max(30).optional(),
  mileage: z.string().max(30).optional(),
  damageArea: z.string().max(60).optional(),
  drivable: z.enum(["ja", "nein", "nicht sicher"]).optional(),
  airbagsDeployed: z.enum(["ja", "nein", "nicht sicher"]).optional(),
  warningLights: z.enum(["ja", "nein", "nicht sicher"]).optional(),
  description: z.string().max(1500).optional(),
});

export type VehicleData = z.infer<typeof vehicleDataSchema>;

export const MAX_IMAGES = 8;
export const MIN_IMAGES = 1;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
