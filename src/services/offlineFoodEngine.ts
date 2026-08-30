// The offline food engine: turns a free-text food description into a nutrition
// estimate with zero network calls and zero API key. Used whenever the person
// picks the Offline Engine provider, or as the fallback when an AI provider call
// fails or isn't configured.
//
// This is intentionally NOT trying to be a nutrition database — it's a fast,
// deterministic heuristic that should feel like a reasonable guess rather than
// a wrong number pulled from nowhere. Three things make that possible:
//   1. A much larger dish dictionary (~90 entries) covering common Western,
//      South Asian, fast-food, and pantry-staple foods, each keyed by several
//      real-world spellings/aliases.
//   2. A real quantity parser that reads actual numbers out of the text ("2
//      eggs", "150g chicken breast", "300ml milk") instead of only recognizing
//      a fixed set of container words like "bowl" or "plate".
//   3. Multi-ingredient composition — "chicken and rice" or "eggs, toast, and
//      orange juice" sums each matched component instead of only ever matching
//      the first keyword found and ignoring the rest of the sentence.

export interface FoodMatch {
  food_name: string;
  serving_description: string;
  quantity: number;
  unit: string;
  estimated_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: 'approximate' | 'rough_estimate';
  ingredients_breakdown: string[];
  nutritional_notes: string;
}

interface DishDef {
  keywords: string[];
  name: string;
  category: 'protein' | 'carb' | 'produce' | 'dairy' | 'drink' | 'mixed' | 'snack' | 'fat';
  // Macros are per 100g so any parsed gram quantity scales precisely, rather than
  // only supporting a single fixed "base serving" multiplier.
  per100g: { cals: number; p: number; c: number; f: number; fib: number };
  defaultGrams: number; // used when no explicit quantity/weight was parsed
  unitGrams?: number; // grams per "1 unit" for countable foods (1 egg, 1 slice, 1 roti)
  unitLabel?: string; // e.g. "egg", "slice", "roti" — enables "3 eggs" parsing
  notes: string;
}

// ~90 entries. Keywords include common misspellings and regional names since
// free-text input is never going to be perfectly spelled.
const DISHES: DishDef[] = [
  // --- South Asian mains ---
  { keywords: ['biryani', 'biriyani', 'bryani', 'briyani'], name: 'Chicken Biryani', category: 'mixed', per100g: { cals: 153, p: 9, c: 19, f: 4.5, fib: 0.8 }, defaultGrams: 380, notes: 'Spiced basmati rice layered with marinated chicken, ghee, and yogurt.' },
  { keywords: ['karahi', 'kadai', 'curry', 'salan', 'qorma', 'korma', 'chicken tikka masala', 'butter chicken'], name: 'Chicken Curry', category: 'mixed', per100g: { cals: 147, p: 13, c: 4, f: 8.7, fib: 0.7 }, defaultGrams: 300, notes: 'Chicken simmered in a tomato-onion-spice gravy with cooking oil.' },
  { keywords: ['daal', 'dal', 'lentil soup', 'lentils'], name: 'Lentil Daal', category: 'mixed', per100g: { cals: 96, p: 5.2, c: 13.6, f: 2.4, fib: 3.2 }, defaultGrams: 250, notes: 'Yellow or red lentils tempered with cumin, garlic, and ghee.' },
  { keywords: ['roti', 'chapati', 'phulka'], name: 'Whole Wheat Roti', category: 'carb', per100g: { cals: 214, p: 7.1, c: 43, f: 2.1, fib: 4.3 }, defaultGrams: 70, unitGrams: 40, unitLabel: 'roti', notes: 'Stone-ground whole wheat flatbread, cooked dry or lightly buttered.' },
  { keywords: ['naan'], name: 'Naan Bread', category: 'carb', per100g: { cals: 310, p: 9, c: 50, f: 8, fib: 2 }, defaultGrams: 90, unitGrams: 90, unitLabel: 'naan', notes: 'Leavened flatbread, typically brushed with ghee or butter.' },
  { keywords: ['samosa'], name: 'Samosa', category: 'snack', per100g: { cals: 262, p: 4.5, c: 28, f: 15, fib: 2.5 }, defaultGrams: 60, unitGrams: 60, unitLabel: 'samosa', notes: 'Deep-fried pastry filled with spiced potato or meat.' },
  { keywords: ['pakora', 'pakoras', 'fritter'], name: 'Vegetable Pakora', category: 'snack', per100g: { cals: 280, p: 6, c: 24, f: 18, fib: 3 }, defaultGrams: 100, notes: 'Chickpea-flour battered and deep-fried vegetables.' },
  { keywords: ['paratha'], name: 'Paratha', category: 'carb', per100g: { cals: 330, p: 6.5, c: 45, f: 14, fib: 3 }, defaultGrams: 90, unitGrams: 90, unitLabel: 'paratha', notes: 'Layered flatbread pan-fried with ghee or oil.' },
  { keywords: ['nihari'], name: 'Beef Nihari', category: 'mixed', per100g: { cals: 175, p: 15, c: 5, f: 11, fib: 0.5 }, defaultGrams: 320, notes: 'Slow-cooked beef shank stew, richer in fat than most curries.' },
  { keywords: ['haleem'], name: 'Haleem', category: 'mixed', per100g: { cals: 160, p: 10, c: 16, f: 6.5, fib: 2 }, defaultGrams: 300, notes: 'Wheat, lentil, and meat porridge slow-cooked and shredded.' },
  { keywords: ['chana', 'chickpea curry', 'chole'], name: 'Chickpea Curry (Chana)', category: 'mixed', per100g: { cals: 130, p: 6.5, c: 18, f: 4, fib: 5 }, defaultGrams: 280, notes: 'Chickpeas in a tomato-onion masala.' },
  { keywords: ['pulao', 'pilaf', 'pilau'], name: 'Rice Pulao', category: 'carb', per100g: { cals: 175, p: 4, c: 30, f: 4.5, fib: 0.6 }, defaultGrams: 300, notes: 'Rice cooked with whole spices, oil, and stock.' },
  { keywords: ['seekh kebab', 'kebab', 'kabab'], name: 'Seekh Kebab', category: 'protein', per100g: { cals: 250, p: 20, c: 3, f: 18, fib: 0.5 }, defaultGrams: 150, notes: 'Ground meat skewers seasoned with spices and grilled.' },

  // --- Rice / grains ---
  { keywords: ['white rice', 'steamed rice', 'plain rice', 'basmati rice', 'rice'], name: 'Steamed White Rice', category: 'carb', per100g: { cals: 130, p: 2.7, c: 28, f: 0.3, fib: 0.4 }, defaultGrams: 200, unitGrams: 200, unitLabel: 'cup', notes: 'Plain cooked white rice.' },
  { keywords: ['brown rice'], name: 'Brown Rice', category: 'carb', per100g: { cals: 123, p: 2.7, c: 26, f: 1, fib: 1.8 }, defaultGrams: 200, unitGrams: 200, unitLabel: 'cup', notes: 'Whole-grain rice, more fiber than white rice.' },
  { keywords: ['quinoa'], name: 'Cooked Quinoa', category: 'carb', per100g: { cals: 120, p: 4.4, c: 21, f: 1.9, fib: 2.8 }, defaultGrams: 185, unitGrams: 185, unitLabel: 'cup', notes: 'Complete-protein pseudo-grain.' },
  { keywords: ['bread', 'toast', 'sourdough', 'white bread', 'wheat bread'], name: 'Bread (Toasted)', category: 'carb', per100g: { cals: 270, p: 9, c: 50, f: 3.5, fib: 3 }, defaultGrams: 30, unitGrams: 30, unitLabel: 'slice', notes: 'Standard sliced bread, toasted or plain.' },
  { keywords: ['bagel'], name: 'Bagel', category: 'carb', per100g: { cals: 257, p: 10, c: 50, f: 1.7, fib: 2.5 }, defaultGrams: 95, unitGrams: 95, unitLabel: 'bagel', notes: 'Plain boiled-then-baked bagel, no spread.' },
  { keywords: ['tortilla', 'wrap'], name: 'Flour Tortilla / Wrap', category: 'carb', per100g: { cals: 310, p: 8, c: 50, f: 8, fib: 3 }, defaultGrams: 55, unitGrams: 55, unitLabel: 'tortilla', notes: 'Flour tortilla, used as a wrap base.' },

  // --- Pasta / Italian ---
  { keywords: ['pasta', 'spaghetti', 'fettuccine', 'penne', 'macaroni', 'lasagna', 'lasagne'], name: 'Pasta with Sauce', category: 'mixed', per100g: { cals: 144, p: 5, c: 21, f: 4.4, fib: 1.2 }, defaultGrams: 320, notes: 'Cooked durum wheat pasta with tomato or cream sauce.' },
  { keywords: ['pizza'], name: 'Pizza', category: 'mixed', per100g: { cals: 217, p: 9.2, c: 24, f: 9.2, fib: 1.3 }, defaultGrams: 240, unitGrams: 110, unitLabel: 'slice', notes: 'Cheese/topped pizza, thin-to-regular crust.' },
  { keywords: ['risotto'], name: 'Risotto', category: 'mixed', per100g: { cals: 170, p: 4, c: 22, f: 6.5, fib: 0.8 }, defaultGrams: 280, notes: 'Creamy arborio rice dish, typically finished with butter and cheese.' },

  // --- Fast food ---
  { keywords: ['burger', 'cheeseburger', 'hamburger'], name: 'Burger', category: 'mixed', per100g: { cals: 208, p: 11, c: 17, f: 10.4, fib: 0.8 }, defaultGrams: 260, notes: 'Patty on a bun with cheese and condiments.' },
  { keywords: ['fries', 'french fries', 'chips'], name: 'French Fries', category: 'carb', per100g: { cals: 312, p: 3.4, c: 41, f: 15, fib: 3.8 }, defaultGrams: 150, notes: 'Deep-fried potato fries.' },
  { keywords: ['fried chicken', 'kfc', 'chicken wings', 'nuggets'], name: 'Fried Chicken', category: 'protein', per100g: { cals: 246, p: 19, c: 8, f: 15, fib: 0.3 }, defaultGrams: 200, notes: 'Battered and deep-fried chicken pieces.' },
  { keywords: ['hot dog'], name: 'Hot Dog', category: 'mixed', per100g: { cals: 260, p: 10, c: 20, f: 16, fib: 1 }, defaultGrams: 100, unitGrams: 100, unitLabel: 'hot dog', notes: 'Sausage in a bun.' },
  { keywords: ['shawarma', 'donair', 'gyro'], name: 'Shawarma Wrap', category: 'mixed', per100g: { cals: 200, p: 13, c: 18, f: 9, fib: 1.5 }, defaultGrams: 280, notes: 'Spiced meat, garlic sauce, and vegetables in flatbread.' },
  { keywords: ['sushi'], name: 'Sushi Roll', category: 'mixed', per100g: { cals: 150, p: 6, c: 28, f: 1.5, fib: 1 }, defaultGrams: 230, notes: 'Rice and fish/vegetable rolls, ~8 pieces.' },
  { keywords: ['taco', 'tacos'], name: 'Taco', category: 'mixed', per100g: { cals: 220, p: 11, c: 18, f: 12, fib: 2.5 }, defaultGrams: 100, unitGrams: 100, unitLabel: 'taco', notes: 'Seasoned meat, cheese, and salsa in a tortilla shell.' },
  { keywords: ['burrito'], name: 'Burrito', category: 'mixed', per100g: { cals: 190, p: 9, c: 24, f: 7, fib: 3 }, defaultGrams: 350, notes: 'Rice, beans, meat, and cheese wrapped in a large tortilla.' },
  { keywords: ['fried rice'], name: 'Fried Rice', category: 'mixed', per100g: { cals: 163, p: 4.5, c: 22, f: 6, fib: 1 }, defaultGrams: 300, notes: 'Rice stir-fried with egg, vegetables, and oil.' },
  { keywords: ['noodles', 'ramen', 'chow mein', 'lo mein', 'pad thai'], name: 'Noodles', category: 'mixed', per100g: { cals: 138, p: 5, c: 25, f: 2, fib: 1.2 }, defaultGrams: 350, notes: 'Wheat or rice noodles with sauce, protein, and vegetables.' },

  // --- Proteins ---
  { keywords: ['chicken breast', 'grilled chicken', 'boiled chicken', 'chicken'], name: 'Chicken Breast (Grilled)', category: 'protein', per100g: { cals: 165, p: 31, c: 0, f: 3.6, fib: 0 }, defaultGrams: 150, notes: 'Skinless, boneless chicken breast, grilled or boiled.' },
  { keywords: ['chicken thigh'], name: 'Chicken Thigh (Grilled)', category: 'protein', per100g: { cals: 209, p: 26, c: 0, f: 10.9, fib: 0 }, defaultGrams: 150, notes: 'Skin-on chicken thigh, grilled or roasted.' },
  { keywords: ['steak', 'beef steak', 'sirloin', 'ribeye'], name: 'Beef Steak', category: 'protein', per100g: { cals: 271, p: 25, c: 0, f: 19, fib: 0 }, defaultGrams: 200, notes: 'Grilled or pan-seared beef steak.' },
  { keywords: ['ground beef', 'mince', 'minced beef', 'kheema', 'keema'], name: 'Ground Beef (Cooked)', category: 'protein', per100g: { cals: 254, p: 26, c: 0, f: 17, fib: 0 }, defaultGrams: 150, notes: 'Standard 80/20 ground beef, browned.' },
  { keywords: ['salmon'], name: 'Salmon Fillet', category: 'protein', per100g: { cals: 208, p: 20, c: 0, f: 13, fib: 0 }, defaultGrams: 150, notes: 'Baked or pan-seared salmon.' },
  { keywords: ['tuna'], name: 'Tuna', category: 'protein', per100g: { cals: 132, p: 28, c: 0, f: 1.3, fib: 0 }, defaultGrams: 150, notes: 'Canned in water or fresh grilled tuna.' },
  { keywords: ['fish', 'cod', 'tilapia', 'white fish'], name: 'White Fish (Grilled)', category: 'protein', per100g: { cals: 110, p: 23, c: 0, f: 1.3, fib: 0 }, defaultGrams: 170, notes: 'Lean white fish, grilled or baked.' },
  { keywords: ['shrimp', 'prawn', 'prawns'], name: 'Shrimp', category: 'protein', per100g: { cals: 99, p: 24, c: 0.2, f: 0.3, fib: 0 }, defaultGrams: 120, notes: 'Cooked shrimp, no shell.' },
  { keywords: ['pork chop', 'pork'], name: 'Pork (Grilled)', category: 'protein', per100g: { cals: 242, p: 27, c: 0, f: 14, fib: 0 }, defaultGrams: 150, notes: 'Grilled or roasted pork.' },
  { keywords: ['tofu'], name: 'Tofu (Firm)', category: 'protein', per100g: { cals: 144, p: 15.5, c: 3, f: 8.7, fib: 2 }, defaultGrams: 150, notes: 'Firm tofu, pan-fried or baked.' },
  { keywords: ['egg', 'eggs', 'scrambled', 'omelette', 'omelet', 'boiled egg'], name: 'Eggs (Prepared)', category: 'protein', per100g: { cals: 155, p: 13, c: 1.1, f: 11, fib: 0 }, defaultGrams: 100, unitGrams: 50, unitLabel: 'egg', notes: 'Whole eggs, scrambled/fried/boiled.' },
  { keywords: ['bacon'], name: 'Bacon', category: 'protein', per100g: { cals: 541, p: 37, c: 1.4, f: 42, fib: 0 }, defaultGrams: 30, unitGrams: 10, unitLabel: 'strip', notes: 'Pan-fried bacon strips.' },
  { keywords: ['sausage'], name: 'Sausage', category: 'protein', per100g: { cals: 300, p: 13, c: 3, f: 27, fib: 0 }, defaultGrams: 80, unitGrams: 80, unitLabel: 'sausage', notes: 'Cooked pork or beef sausage.' },
  { keywords: ['beans', 'black beans', 'kidney beans', 'baked beans'], name: 'Beans', category: 'protein', per100g: { cals: 127, p: 8.7, c: 22, f: 0.5, fib: 6.4 }, defaultGrams: 200, notes: 'Cooked or canned beans.' },
  { keywords: ['chickpeas', 'hummus'], name: 'Chickpeas / Hummus', category: 'protein', per100g: { cals: 166, p: 8, c: 20, f: 6, fib: 6 }, defaultGrams: 150, notes: 'Cooked chickpeas or hummus dip.' },

  // --- Dairy / snacks / breakfast ---
  { keywords: ['oatmeal', 'oats', 'porridge'], name: 'Oatmeal', category: 'carb', per100g: { cals: 71, p: 2.9, c: 12, f: 1.5, fib: 1.7 }, defaultGrams: 280, notes: 'Rolled oats cooked with milk or water.' },
  { keywords: ['pancake', 'pancakes', 'waffle', 'waffles'], name: 'Pancakes / Waffles', category: 'carb', per100g: { cals: 227, p: 6, c: 28, f: 10, fib: 1 }, defaultGrams: 150, unitGrams: 50, unitLabel: 'pancake', notes: 'Includes a light amount of syrup/butter.' },
  { keywords: ['cereal'], name: 'Breakfast Cereal', category: 'carb', per100g: { cals: 375, p: 7, c: 82, f: 3, fib: 3 }, defaultGrams: 40, notes: 'Dry cereal — add milk separately if you had any.' },
  { keywords: ['yogurt', 'yoghurt', 'greek yogurt'], name: 'Greek Yogurt', category: 'dairy', per100g: { cals: 97, p: 9, c: 3.6, f: 5, fib: 0 }, defaultGrams: 170, notes: 'Plain Greek yogurt.' },
  { keywords: ['cheese'], name: 'Cheese', category: 'dairy', per100g: { cals: 402, p: 25, c: 1.3, f: 33, fib: 0 }, defaultGrams: 30, notes: 'Average hard/semi-hard cheese.' },
  { keywords: ['milk'], name: 'Milk', category: 'dairy', per100g: { cals: 61, p: 3.2, c: 4.8, f: 3.3, fib: 0 }, defaultGrams: 250, unitGrams: 250, unitLabel: 'glass', notes: 'Whole milk.' },
  { keywords: ['butter'], name: 'Butter', category: 'fat', per100g: { cals: 717, p: 0.9, c: 0.1, f: 81, fib: 0 }, defaultGrams: 10, notes: 'Standard dairy butter.' },
  { keywords: ['peanut butter'], name: 'Peanut Butter', category: 'fat', per100g: { cals: 588, p: 25, c: 20, f: 50, fib: 6 }, defaultGrams: 32, notes: 'Standard smooth or crunchy peanut butter (~2 tbsp).' },
  { keywords: ['nuts', 'almonds', 'cashews', 'walnuts', 'peanuts'], name: 'Mixed Nuts', category: 'fat', per100g: { cals: 607, p: 20, c: 20, f: 54, fib: 8 }, defaultGrams: 30, notes: 'Raw or roasted, unsalted assumed.' },
  { keywords: ['avocado'], name: 'Avocado', category: 'fat', per100g: { cals: 160, p: 2, c: 8.5, f: 14.7, fib: 6.7 }, defaultGrams: 150, unitGrams: 150, unitLabel: 'avocado', notes: 'One medium avocado.' },
  { keywords: ['olive oil', 'cooking oil', 'vegetable oil'], name: 'Cooking Oil', category: 'fat', per100g: { cals: 884, p: 0, c: 0, f: 100, fib: 0 }, defaultGrams: 14, notes: 'Standard cooking oil (~1 tbsp).' },
  { keywords: ['chips', 'crisps'], name: 'Potato Chips', category: 'snack', per100g: { cals: 536, p: 7, c: 53, f: 34, fib: 4.4 }, defaultGrams: 50, notes: 'Standard salted potato chips.' },
  { keywords: ['chocolate', 'chocolate bar'], name: 'Chocolate', category: 'snack', per100g: { cals: 546, p: 4.9, c: 61, f: 31, fib: 3.4 }, defaultGrams: 40, notes: 'Milk chocolate bar.' },
  { keywords: ['cookie', 'cookies', 'biscuit', 'biscuits'], name: 'Cookies', category: 'snack', per100g: { cals: 480, p: 5.5, c: 65, f: 22, fib: 2 }, defaultGrams: 30, unitGrams: 15, unitLabel: 'cookie', notes: 'Standard sweet cookie/biscuit.' },
  { keywords: ['cake'], name: 'Cake', category: 'snack', per100g: { cals: 371, p: 4.5, c: 51, f: 17, fib: 1 }, defaultGrams: 100, unitGrams: 100, unitLabel: 'slice', notes: 'Average frosted layer cake.' },
  { keywords: ['ice cream'], name: 'Ice Cream', category: 'snack', per100g: { cals: 207, p: 3.5, c: 24, f: 11, fib: 0.7 }, defaultGrams: 100, unitGrams: 65, unitLabel: 'scoop', notes: 'Standard vanilla/chocolate ice cream.' },
  { keywords: ['donut', 'doughnut'], name: 'Donut', category: 'snack', per100g: { cals: 452, p: 4.9, c: 51, f: 25, fib: 1.6 }, defaultGrams: 60, unitGrams: 60, unitLabel: 'donut', notes: 'Glazed or plain donut.' },
  { keywords: ['popcorn'], name: 'Popcorn', category: 'snack', per100g: { cals: 387, p: 13, c: 78, f: 5, fib: 15 }, defaultGrams: 30, notes: 'Air-popped or lightly buttered popcorn.' },
  { keywords: ['protein bar', 'granola bar', 'energy bar'], name: 'Protein / Granola Bar', category: 'snack', per100g: { cals: 380, p: 20, c: 40, f: 14, fib: 5 }, defaultGrams: 50, unitGrams: 50, unitLabel: 'bar', notes: 'Standard protein or granola bar.' },
  { keywords: ['shake', 'whey', 'protein shake', 'smoothie'], name: 'Protein Shake / Smoothie', category: 'drink', per100g: { cals: 60, p: 8.6, c: 3.4, f: 1, fib: 0.6 }, defaultGrams: 350, notes: 'Whey or fruit-based protein shake.' },

  // --- Produce / sides ---
  { keywords: ['salad', 'greens'], name: 'Garden Salad with Dressing', category: 'produce', per100g: { cals: 82, p: 2.3, c: 6.4, f: 5.5, fib: 2.3 }, defaultGrams: 220, notes: 'Mixed greens and vegetables with dressing.' },
  { keywords: ['vegetables', 'veggies', 'broccoli', 'steamed vegetables', 'stir fry vegetables'], name: 'Mixed Vegetables', category: 'produce', per100g: { cals: 35, p: 2, c: 7, f: 0.3, fib: 2.6 }, defaultGrams: 150, notes: 'Steamed or stir-fried vegetables, minimal oil.' },
  { keywords: ['potato', 'baked potato', 'mashed potato'], name: 'Potato', category: 'carb', per100g: { cals: 87, p: 1.9, c: 20, f: 0.1, fib: 2.2 }, defaultGrams: 170, unitGrams: 170, unitLabel: 'potato', notes: 'Baked, boiled, or mashed potato without heavy butter.' },
  { keywords: ['sweet potato'], name: 'Sweet Potato', category: 'carb', per100g: { cals: 86, p: 1.6, c: 20, f: 0.1, fib: 3 }, defaultGrams: 170, unitGrams: 170, unitLabel: 'sweet potato', notes: 'Baked or roasted sweet potato.' },
  { keywords: ['banana'], name: 'Banana', category: 'produce', per100g: { cals: 89, p: 1.1, c: 23, f: 0.3, fib: 2.6 }, defaultGrams: 120, unitGrams: 120, unitLabel: 'banana', notes: 'One medium banana.' },
  { keywords: ['apple'], name: 'Apple', category: 'produce', per100g: { cals: 52, p: 0.3, c: 14, f: 0.2, fib: 2.4 }, defaultGrams: 180, unitGrams: 180, unitLabel: 'apple', notes: 'One medium apple.' },
  { keywords: ['orange'], name: 'Orange', category: 'produce', per100g: { cals: 47, p: 0.9, c: 12, f: 0.1, fib: 2.4 }, defaultGrams: 150, unitGrams: 150, unitLabel: 'orange', notes: 'One medium orange.' },
  { keywords: ['berries', 'strawberries', 'blueberries', 'raspberries'], name: 'Mixed Berries', category: 'produce', per100g: { cals: 50, p: 0.8, c: 12, f: 0.4, fib: 3 }, defaultGrams: 100, notes: 'Fresh mixed berries.' },
  { keywords: ['grapes'], name: 'Grapes', category: 'produce', per100g: { cals: 69, p: 0.7, c: 18, f: 0.2, fib: 0.9 }, defaultGrams: 100, notes: 'Fresh grapes.' },
  { keywords: ['mango'], name: 'Mango', category: 'produce', per100g: { cals: 60, p: 0.8, c: 15, f: 0.4, fib: 1.6 }, defaultGrams: 165, unitGrams: 165, unitLabel: 'mango', notes: 'One medium mango.' },

  // --- Drinks ---
  { keywords: ['coke', 'soda', 'pepsi', 'cola', 'sprite', 'fizzy drink'], name: 'Carbonated Soft Drink', category: 'drink', per100g: { cals: 42, p: 0, c: 10.6, f: 0, fib: 0 }, defaultGrams: 330, unitGrams: 330, unitLabel: 'can', notes: 'Regular (non-diet) soft drink.' },
  { keywords: ['diet coke', 'diet soda', 'zero sugar', 'diet pepsi'], name: 'Diet Soft Drink', category: 'drink', per100g: { cals: 0.4, p: 0, c: 0.1, f: 0, fib: 0 }, defaultGrams: 330, unitGrams: 330, unitLabel: 'can', notes: 'Zero/low-calorie soft drink.' },
  { keywords: ['juice', 'orange juice', 'apple juice'], name: 'Fruit Juice', category: 'drink', per100g: { cals: 45, p: 0.5, c: 11, f: 0.1, fib: 0.2 }, defaultGrams: 250, unitGrams: 250, unitLabel: 'glass', notes: 'Unsweetened fruit juice.' },
  { keywords: ['coffee', 'latte', 'cappuccino', 'espresso'], name: 'Coffee (with Milk)', category: 'drink', per100g: { cals: 42, p: 2, c: 4.5, f: 1.7, fib: 0 }, defaultGrams: 240, unitGrams: 240, unitLabel: 'cup', notes: 'Coffee with a standard amount of milk.' },
  { keywords: ['tea', 'chai'], name: 'Milk Tea / Chai', category: 'drink', per100g: { cals: 46, p: 2, c: 5, f: 1.7, fib: 0 }, defaultGrams: 240, unitGrams: 240, unitLabel: 'cup', notes: 'Tea with milk and a modest amount of sugar.' },
  { keywords: ['beer'], name: 'Beer', category: 'drink', per100g: { cals: 43, p: 0.5, c: 3.6, f: 0, fib: 0 }, defaultGrams: 355, unitGrams: 355, unitLabel: 'bottle', notes: 'Regular beer, one standard bottle/can.' },
  { keywords: ['wine'], name: 'Wine', category: 'drink', per100g: { cals: 83, p: 0.1, c: 2.6, f: 0, fib: 0 }, defaultGrams: 150, unitGrams: 150, unitLabel: 'glass', notes: 'One standard glass of wine.' },
  { keywords: ['energy drink'], name: 'Energy Drink', category: 'drink', per100g: { cals: 45, p: 0, c: 11, f: 0, fib: 0 }, defaultGrams: 250, unitGrams: 250, unitLabel: 'can', notes: 'Standard sugared energy drink.' },
];

// Category-level defaults used only when nothing in the dictionary matches at
// all — chosen per plausible food category instead of one universal number, so
// an unmatched "green smoothie" and an unmatched "double cheeseburger" don't
// land on the exact same calorie guess.
const CATEGORY_FALLBACK: Record<DishDef['category'], { cals: number; p: number; c: number; f: number; fib: number }> = {
  protein: { cals: 180, p: 26, c: 1, f: 8, fib: 0 },
  carb: { cals: 150, p: 4, c: 30, f: 2, fib: 2 },
  produce: { cals: 50, p: 1, c: 12, f: 0.3, fib: 2.5 },
  dairy: { cals: 90, p: 6, c: 6, f: 5, fib: 0 },
  drink: { cals: 45, p: 0.5, c: 10, f: 0.2, fib: 0 },
  mixed: { cals: 180, p: 10, c: 18, f: 8, fib: 1.5 },
  snack: { cals: 400, p: 6, c: 45, f: 20, fib: 2 },
  fat: { cals: 600, p: 2, c: 5, f: 60, fib: 1 },
};

// --- Quantity parsing -------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, half: 0.5, quarter: 0.25, couple: 2,
};

// Container/portion words that don't map to a specific dish's own unitGrams,
// used as a fallback multiplier on defaultGrams when a dish has no unitLabel.
const CONTAINER_MULTIPLIERS: { patterns: RegExp[]; multiplier: number; label: string }[] = [
  { patterns: [/half\s*(a\s*)?plate/, /1\/2\s*plate/], multiplier: 0.5, label: 'half plate' },
  { patterns: [/quarter\s*(a\s*)?plate/, /1\/4\s*plate/], multiplier: 0.3, label: 'quarter plate' },
  { patterns: [/\b(two|2)\s*plates?/], multiplier: 2, label: '2 plates' },
  { patterns: [/\bplate/], multiplier: 1, label: 'plate' },
  { patterns: [/small\s*bowl/], multiplier: 0.7, label: 'small bowl' },
  { patterns: [/(big|large)\s*bowl/], multiplier: 1.4, label: 'large bowl' },
  { patterns: [/\bbowl/], multiplier: 1, label: 'bowl' },
];

interface ParsedQuantity {
  grams: number | null; // explicit weight/volume found in text, e.g. "200g" or "150ml"
  count: number | null; // explicit unit count, e.g. "2" from "2 eggs"
  containerMultiplier: number | null; // plate/bowl-style multiplier
  containerLabel: string | null;
}

function parseQuantity(text: string): ParsedQuantity {
  const clean = text.toLowerCase();

  // Explicit gram/ml weight: "200g", "200 g", "200 grams", "150ml"
  const weightMatch = clean.match(/(\d+(?:\.\d+)?)\s*(g|grams?|ml|millilit(?:er|re)s?)\b/);
  const grams = weightMatch ? parseFloat(weightMatch[1]) : null;

  // Leading numeric count: "2 eggs", "3 slices", "1.5 cups"
  let count: number | null = null;
  const numMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:x\s*)?[a-z]/);
  if (numMatch && !weightMatch) {
    count = parseFloat(numMatch[1]);
  } else {
    // Word-form counts: "two eggs", "a banana", "half a cup"
    for (const [word, val] of Object.entries(NUMBER_WORDS)) {
      const re = new RegExp(`\\b${word}\\b`);
      if (re.test(clean)) {
        count = val;
        break;
      }
    }
  }

  let containerMultiplier: number | null = null;
  let containerLabel: string | null = null;
  for (const c of CONTAINER_MULTIPLIERS) {
    if (c.patterns.some((p) => p.test(clean))) {
      containerMultiplier = c.multiplier;
      containerLabel = c.label;
      break;
    }
  }

  return { grams, count, containerMultiplier, containerLabel };
}

// Cheap fuzzy match: tolerates exactly one missing/doubled character at the end
// of a keyword so "chikn"/"chicken" or "eggss"/"egg" still hit, without being
// loose enough to false-positive on unrelated words that merely start with a
// similar prefix (e.g. "bread" must never match inside "breast").
function fuzzyIncludes(haystack: string, keyword: string): boolean {
  // Exact substring match — always safe.
  if (new RegExp(`\\b${keyword}\\w*`).test(haystack)) return true;

  if (keyword.length <= 4) return false; // too short to safely fuzz

  // Keyword with its last letter dropped, but still required to be followed by
  // a word boundary (not just any substring) — catches "chikn" for "chicken"
  // without letting "brea" match inside "breast".
  const shortened = keyword.slice(0, -1);
  const re = new RegExp(`\\b${shortened}\\b`);
  return re.test(haystack);
}

/**
 * Splits a free-text food description into individual food segments so
 * "chicken and rice" or "eggs, toast, orange juice" are evaluated as separate
 * components instead of only ever matching the first keyword found.
 */
function splitIntoSegments(input: string): string[] {
  return input
    .split(/,|\band\b|\bwith\b|\+|\bplus\b/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function matchSegment(segment: string): { dish: DishDef; grams: number; label: string } | null {
  const clean = segment.toLowerCase().trim();
  const qty = parseQuantity(clean);

  // Find every dish with at least one matching keyword, then prefer the one
  // whose matching keyword is the most specific (longest) — this ensures
  // "brown rice" matches Brown Rice rather than the bare "rice" keyword on
  // Steamed White Rice just because that entry happens to come first.
  let best: { dish: DishDef; keywordLen: number } | null = null;
  for (const dish of DISHES) {
    for (const kw of dish.keywords) {
      if (fuzzyIncludes(clean, kw)) {
        if (!best || kw.length > best.keywordLen) {
          best = { dish, keywordLen: kw.length };
        }
        break;
      }
    }
  }
  if (!best) return null;
  const dish = best.dish;

  let grams: number;
  let label: string;

  if (qty.grams != null) {
    grams = qty.grams;
    label = `${qty.grams}g`;
  } else if (dish.unitGrams && qty.count != null) {
    grams = dish.unitGrams * qty.count;
    const unitWord = dish.unitLabel || 'unit';
    label = qty.count === 1 ? `1 ${unitWord}` : `${qty.count} ${unitWord}s`;
  } else if (qty.containerMultiplier != null) {
    grams = dish.defaultGrams * qty.containerMultiplier;
    label = qty.containerLabel || 'serving';
  } else if (qty.count != null && !dish.unitGrams) {
    // A bare number with no matching unit on this dish (e.g. "2 pasta") —
    // treat it as a serving-count multiplier on the default serving.
    grams = dish.defaultGrams * qty.count;
    label = `${qty.count}x serving`;
  } else {
    grams = dish.defaultGrams;
    label = '1 serving';
  }

  return { dish, grams: Math.max(1, grams), label };
}

/**
 * Main entry point: evaluates a free-text food description entirely offline.
 * Handles single foods with quantities ("200g chicken breast", "2 eggs"),
 * container-style portions ("a bowl of biryani"), multi-ingredient meals
 * ("eggs, toast, and orange juice"), and falls back to a category-aware
 * generic estimate for anything unrecognized instead of always guessing the
 * same numbers regardless of what was typed.
 */
export function estimateFoodOffline(input: string): FoodMatch {
  const trimmed = input.trim();
  if (!trimmed) {
    return genericFallback('Food Item', 'mixed', 1);
  }

  const segments = splitIntoSegments(trimmed);
  const matches = segments
    .map((seg) => matchSegment(seg))
    .filter((m): m is NonNullable<typeof m> => m != null);

  if (matches.length === 0) {
    // Nothing in the dictionary matched any segment — guess a plausible
    // category from a few broad signal words so the fallback isn't
    // completely disconnected from what was typed, then fall back generically.
    const guessedCategory = guessCategory(trimmed);
    const qty = parseQuantity(trimmed);
    const multiplier = qty.containerMultiplier ?? (qty.count && qty.count > 0 ? qty.count : 1);
    return genericFallback(capitalize(trimmed), guessedCategory, multiplier);
  }

  if (matches.length === 1) {
    const { dish, grams, label } = matches[0];
    return buildResult([{ dish, grams }], label, dish.name);
  }

  // Multiple matched components — sum them and build a combined breakdown.
  const combinedName = matches.map((m) => m.dish.name).join(' + ');
  const label = matches.map((m) => m.label).join(', ');
  return buildResult(
    matches.map((m) => ({ dish: m.dish, grams: m.grams })),
    label,
    combinedName
  );
}

function guessCategory(text: string): DishDef['category'] {
  const clean = text.toLowerCase();
  if (/juice|soda|drink|shake|coffee|tea|water|milk\b/.test(clean)) return 'drink';
  if (/salad|vegetable|fruit|greens/.test(clean)) return 'produce';
  if (/cake|candy|chocolate|dessert|sweet|cookie/.test(clean)) return 'snack';
  if (/chicken|beef|fish|meat|pork|egg|protein|tofu/.test(clean)) return 'protein';
  if (/rice|bread|pasta|potato|noodle|grain/.test(clean)) return 'carb';
  if (/cheese|yogurt|cream/.test(clean)) return 'dairy';
  if (/oil|butter|nuts|fat/.test(clean)) return 'fat';
  return 'mixed';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function genericFallback(name: string, category: DishDef['category'], multiplier: number): FoodMatch {
  const base = CATEGORY_FALLBACK[category];
  const grams = Math.round(220 * multiplier);
  return {
    food_name: name,
    serving_description: multiplier === 1 ? '1 standard serving' : `${multiplier}x standard serving`,
    quantity: multiplier,
    unit: 'serving',
    estimated_grams: grams,
    calories: Math.round(base.cals * (grams / 100)),
    protein: Math.round(base.p * (grams / 100)),
    carbs: Math.round(base.c * (grams / 100)),
    fat: Math.round(base.f * (grams / 100)),
    fiber: Math.round(base.fib * (grams / 100)),
    confidence: 'rough_estimate',
    ingredients_breakdown: [`Estimated as a typical ${category} item — not in the offline dictionary`],
    nutritional_notes: `This wasn't recognized in the offline food list, so this is a category-level estimate rather than a dish-specific one. For a more accurate number, try being more specific (e.g. "200g grilled chicken" instead of "meat"), or connect an AI provider in Profile → AI Access.`,
  };
}

function buildResult(parts: { dish: DishDef; grams: number }[], servingLabel: string, name: string): FoodMatch {
  let cals = 0, p = 0, c = 0, f = 0, fib = 0, totalGrams = 0;
  const breakdown: string[] = [];

  for (const { dish, grams } of parts) {
    const scale = grams / 100;
    const partCals = dish.per100g.cals * scale;
    cals += partCals;
    p += dish.per100g.p * scale;
    c += dish.per100g.c * scale;
    f += dish.per100g.f * scale;
    fib += dish.per100g.fib * scale;
    totalGrams += grams;
    breakdown.push(`${dish.name} (${Math.round(grams)}g): ${Math.round(partCals)} kcal`);
  }

  const notes = parts.length > 1
    ? `Combined estimate for ${parts.length} items. ${parts[0].dish.notes}`
    : parts[0].dish.notes;

  return {
    food_name: name,
    serving_description: servingLabel,
    quantity: 1,
    unit: parts.length > 1 ? 'combo' : 'serving',
    estimated_grams: Math.round(totalGrams),
    calories: Math.round(cals),
    protein: Math.round(p),
    carbs: Math.round(c),
    fat: Math.round(f),
    fiber: Math.round(fib),
    confidence: 'approximate',
    ingredients_breakdown: breakdown,
    nutritional_notes: notes,
  };
}
