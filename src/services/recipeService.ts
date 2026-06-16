import { get, put } from "./api";

export type RecipeLineDto = {
  id: number;
  itemId: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantity: number;
  notes: string | null;
};

export type RecipeLineUpsertDto = {
  ingredientId: number;
  quantity: number;
  notes?: string | null;
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
