import { get, post, put, del } from "./api";

export type ExpenseCreateDto = {
  categoryId: number;
  amount: number;
  paymentMethod?: string | null;
  comment?: string | null;
  fromDate: string;
  toDate: string;
};

export type ExpenseUpdateDto = {
  amount: number;
  paymentMethod?: string | null;
  comment?: string | null;
  fromDate: string;
  toDate: string;
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
  totalAmount: number;
  totalAmountAll: number;
  items: ExpenseDto[];
};

export type ExpenseCategoryCreateDto = {
  name: string;
  description?: string | null;
  accountId?: number | null;
  isCapital: boolean;        // NEW
};

export type ExpenseCategoryDto = {
  id: number;
  name: string;
  description?: string | null;
  accountId?: number | null;
  accountNumber?: string | null;
  accountName?: string | null;
  isCapital: boolean;        // NEW
};

export type ExpenseCategoryUpdateDto = {
  name: string;
  description?: string | null;
  accountId?: number | null;
  isCapital: boolean;        // NEW
};

export type AccountDto = {
  id: number;
  accountNumber: string;
  accountName: string;
};

export async function getExpenseAccounts(): Promise<AccountDto[]> {
  return await get<AccountDto[]>("/accounts/expense-accounts");
}

export async function getExpenseById(id: number): Promise<ExpenseDto> {
  return await get<ExpenseDto>(`/expense/${id}`);
}

export async function queryExpenses(
  filter?: ExpenseFilter
): Promise<PagedExpensesResult> {
  const params = new URLSearchParams();
  if (filter?.from) params.append("from", filter.from);
  if (filter?.to) params.append("to", filter.to);
  if (filter?.categoryId) params.append("categoryId", String(filter.categoryId));
  if (filter?.page) params.append("page", String(filter.page));
  if (filter?.pageSize) params.append("pageSize", String(filter.pageSize));
  const queryString = params.toString();
  return await get<PagedExpensesResult>(
    `/expense${queryString ? `?${queryString}` : ""}`
  );
}

export async function createExpense(dto: ExpenseCreateDto): Promise<ExpenseDto> {
  return await post<ExpenseDto>("/expense", dto);
}

export async function updateExpense(
  id: number,
  dto: ExpenseUpdateDto
): Promise<ExpenseDto> {
  return await put<ExpenseDto>(`/expense/${id}`, dto);
}

export async function deleteExpense(id: number): Promise<void> {
  return await del<void>(`/expense/${id}`);
}

export async function getExpenseCategories(): Promise<ExpenseCategoryDto[]> {
  return await get<ExpenseCategoryDto[]>("/expensecategory");
}

export async function createExpenseCategory(
  dto: ExpenseCategoryCreateDto
): Promise<ExpenseCategoryDto> {
  return await post<ExpenseCategoryDto>("/expensecategory", dto);
}

export async function updateExpenseCategory(
  id: number,
  dto: ExpenseCategoryUpdateDto
): Promise<ExpenseCategoryDto> {
  return await put<ExpenseCategoryDto>(`/expensecategory/${id}`, dto);
}

export async function deleteExpenseCategory(id: number): Promise<void> {
  return await del<void>(`/expensecategory/${id}`);
}