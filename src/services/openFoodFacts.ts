// Open Food Facts integration — free, no API key required.
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
import { EvaluatedFoodResponse } from './aiService';

export interface BarcodeProductResult {
  found: boolean;
  response?: EvaluatedFoodResponse;
  barcode: string;
  productName?: string;
  /** per-100g macros, kept around so the UI can rescale when the user edits quantity */
  per100g?: { calories: number; protein: number; carbs: number; fat: number; fiber?: number };
  error?: 'not_found' | 'network_error' | 'malformed_response';
}

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

function toNumber(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && !isNaN(n) ? n : 0;
}

/**
 * Parses a serving_quantity/serving_size from Open Food Facts into a grams number, if possible.
 * e.g. serving_size "40 g" -> 40, serving_quantity 40 -> 40. Returns null if not determinable.
 */
function parseServingGrams(product: OFFProduct): number | null {
  if (product.serving_quantity) {
    const n = toNumber(product.serving_quantity);
    if (n > 0) return n;
  }
  if (product.serving_size) {
    const match = product.serving_size.match(/([\d.]+)\s*g\b/i);
    if (match) {
      const n = parseFloat(match[1]);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

/**
 * Fetches a product from Open Food Facts by barcode (EAN-13/UPC-A) and maps it into the
 * same EvaluatedFoodResponse shape used by the AI/offline estimation paths, so it flows into
 * the existing food-logging UI without a parallel code path.
 *
 * Default quantity is 100g (per the product's per-100g nutriment data). The caller is expected
 * to let the user adjust the logged quantity/grams afterward; `per100g` is returned so the UI
 * can rescale calories/macros proportionally as the user edits grams.
 */
export async function lookupBarcodeProduct(barcode: string): Promise<BarcodeProductResult> {
  const trimmed = barcode.trim();
  if (!trimmed) {
    return { found: false, barcode: trimmed, error: 'not_found' };
  }

  let json: any;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(trimmed)}.json`);
    if (!res.ok) {
      return { found: false, barcode: trimmed, error: 'network_error' };
    }
    json = await res.json();
  } catch {
    return { found: false, barcode: trimmed, error: 'network_error' };
  }

  // status === 1 means found; status === 0 means not in the database
  if (!json || json.status !== 1 || !json.product) {
    return { found: false, barcode: trimmed, error: 'not_found' };
  }

  const product: OFFProduct = json.product;
  const nutriments = product.nutriments || {};

  const caloriesPer100g =
    toNumber(nutriments['energy-kcal_100g']) ||
    // some products only carry kJ; convert to kcal if that's all we have
    (nutriments['energy_100g'] ? toNumber(nutriments['energy_100g']) / 4.184 : 0);
  const proteinPer100g = toNumber(nutriments['proteins_100g']);
  const carbsPer100g = toNumber(nutriments['carbohydrates_100g']);
  const fatPer100g = toNumber(nutriments['fat_100g']);
  const fiberPer100g = nutriments['fiber_100g'] !== undefined ? toNumber(nutriments['fiber_100g']) : undefined;

  const productName = (product.product_name || product.product_name_en || '').trim();
  if (!productName && caloriesPer100g === 0) {
    // Product exists in OFF but has no usable name or nutrition data — treat as not found
    // so the caller can fall back to manual entry / the offline engine.
    return { found: false, barcode: trimmed, error: 'malformed_response' };
  }

  const displayName = productName || 'Unknown packaged food';
  const brand = product.brands ? product.brands.split(',')[0].trim() : '';
  const fullName = brand && !displayName.toLowerCase().includes(brand.toLowerCase()) ? `${displayName} (${brand})` : displayName;

  // Default logged quantity: 100g, since that's what the per-100g nutriments directly describe.
  // (A listed serving size, if present, is surfaced in serving_description as a hint, but the
  // default quantity stays 100g per-100g so rescaling math stays simple and exact.)
  const servingGrams = parseServingGrams(product);
  const servingHint = servingGrams ? ` · listed serving ${servingGrams}g` : '';

  const response: EvaluatedFoodResponse = {
    food_name: fullName,
    serving_description: `Per 100g${servingHint}`,
    quantity: 100,
    unit: 'g',
    estimated_grams: 100,
    calories: Math.round(caloriesPer100g),
    protein: Math.round(proteinPer100g * 10) / 10,
    carbs: Math.round(carbsPer100g * 10) / 10,
    fat: Math.round(fatPer100g * 10) / 10,
    fiber: fiberPer100g !== undefined ? Math.round(fiberPer100g * 10) / 10 : undefined,
    confidence: 'high',
    nutritional_notes: 'From Open Food Facts, based on manufacturer nutrition facts per 100g.',
    fallback: false,
    source: 'barcode_off',
  };

  return {
    found: true,
    response,
    barcode: trimmed,
    productName: fullName,
    per100g: { calories: caloriesPer100g, protein: proteinPer100g, carbs: carbsPer100g, fat: fatPer100g, fiber: fiberPer100g },
  };
}

/**
 * Rescales a barcode-sourced EvaluatedFoodResponse to a new gram quantity, using the stored
 * per-100g macros so editing the grams field updates calories/macros with simple proportional math.
 */
export function rescaleBarcodeResponse(per100g: BarcodeProductResult['per100g'], grams: number): Partial<EvaluatedFoodResponse> {
  if (!per100g || grams < 0) return {};
  const factor = grams / 100;
  return {
    quantity: grams,
    estimated_grams: grams,
    calories: Math.round(per100g.calories * factor),
    protein: Math.round(per100g.protein * factor * 10) / 10,
    carbs: Math.round(per100g.carbs * factor * 10) / 10,
    fat: Math.round(per100g.fat * factor * 10) / 10,
    fiber: per100g.fiber !== undefined ? Math.round(per100g.fiber * factor * 10) / 10 : undefined,
  };
}
