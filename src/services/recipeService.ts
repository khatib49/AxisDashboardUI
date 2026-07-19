import { get, put } from "./api";

export type RecipeLineDto = {
  id: number;
  itemId: number;
  ingredientId: number;
  ingredientName: string;
  // Ingredient's canonical unit (e.g. "kg"). Used to hint the chef where
  // conversion may kick in.
  unit: string;
  quantity: number;
  notes: string | null;
  // Per-recipe-line unit — null on legacy rows, in which case it means
  // "same as ingredient's unit". Backend converts before consuming stock.
  recipeUnit?: string | null;
};

export type RecipeLineUpsertDto = {
  ingredientId: number;
  quantity: number;
  notes?: string | null;
  // Null = "same as ingredient's unit". Otherwise "g", "kg", "ml", "l", "pcs".
  unit?: string | null;
};

export type RecipeUpsertRequest = {
  itemId: number;
  lines: RecipeLineUpsertDto[];
};

export async function getRecipeForItem(itemId: number): Promise<RecipeLineDto[]> {
  return await get<RecipeLineDto[]>(`/recipes/items/${itemId}`);
}

export async function upsertRecipe(body: RecipeUpsertRequest): Promise<RecipeLineDto[]> {
  return await put<RecipeLineDto[]>(`/recipes`, body);
}

export async function getItemsWithoutRecipe(): Promise<number[]> {
  return await get<number[]>(`/recipes/items-without-recipe`);
}
