import { get, post, put, del } from "./api";

export type ExpenseCreateDto = {
  categoryId: number;
  amount: number;
  paymentMethod?: string | null;
  comment?: string | null;
  fromDate: string; // ISO string
  toDate: string; // ISO string
};

export type ExpenseUpdateDto = {
  amount: number;
  paymentMethod?: string | null;
  comment?: string | null;
  fromDate: string; // ISO string
  toDate: string; // ISO string
  categoryId: number;
};

export type ExpenseDto = {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  paymentMethod?: string | null;
  comment?: string | null;
  fromDate: string;
  toDate: string;
  createdBy?: number | null;
  createdOn: string;
};

export type ExpenseFilter = {
  from?: string | null;
  to?: string | null;
  categoryId?: number | null;
  page?: number;
  pageSize?: number;
};

export type PagedExpensesResult = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalAmount: number; // sum of page items
  totalAmountAll: number; // sum of all filtered items (ignore paging)
  items: ExpenseDto[];
};

export type ExpenseCategoryCreateDto = {
  name: string;
  description?: string | null;
};

export type ExpenseCategoryDto = {
  id: number;
  name: string;
  description?: string | null;
};

export type ExpenseCategoryUpdateDto = {
  name: string;
  description?: string | null;
};

// Get expense by ID
export async function getExpenseById(id: number): Promise<ExpenseDto> {
  return await get<ExpenseDto>(`/expense/${id}`);
}

// Query expenses with filters
export async function queryExpenses(
  filter?: ExpenseFilter
): Promise<PagedExpensesResult> {
  const params = new URLSearchParams();
  if (filter?.from) params.append("from", filter.from);
  if (filter?.to) params.append("to", filter.to);
  if (filter?.categoryId)
    params.append("categoryId", String(filter.categoryId));
  if (filter?.page) params.append("page", String(filter.page));
  if (filter?.pageSize) params.append("pageSize", String(filter.pageSize));

  const queryString = params.toString();
  return await get<PagedExpensesResult>(
    `/expense${queryString ? `?${queryString}` : ""}`
  );
}

// Create expense
export async function createExpense(
  dto: ExpenseCreateDto
): Promise<ExpenseDto> {
  return await post<ExpenseDto>("/expense", dto);
}

// Update expense
export async function updateExpense(
  id: number,
  dto: ExpenseUpdateDto
): Promise<ExpenseDto> {
  return await put<ExpenseDto>(`/expense/${id}`, dto);
}

// Delete expense
export async function deleteExpense(id: number): Promise<void> {
  return await del<void>(`/expense/${id}`);
}

// Get expense categories
export async function getExpenseCategories(): Promise<ExpenseCategoryDto[]> {
  return await get<ExpenseCategoryDto[]>("/expensecategory");
}

// Create expense category
export async function createExpenseCategory(
  dto: ExpenseCategoryCreateDto
): Promise<ExpenseCategoryDto> {
  return await post<ExpenseCategoryDto>("/expensecategory", dto);
}

// Update expense category
export async function updateExpenseCategory(
  id: number,
  dto: ExpenseCategoryUpdateDto
): Promise<ExpenseCategoryDto> {
  return await put<ExpenseCategoryDto>(`/expensecategory/${id}`, dto);
}

// Delete expense category
export async function deleteExpenseCategory(id: number): Promise<void> {
  return await del<void>(`/expensecategory/${id}`);
}
