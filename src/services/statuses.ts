export type StatusItem = {
  id: number;
  name: string;
};

export const STATUSES: StatusItem[] = [
  { id: 1, name: "Enabled" },
  { id: 2, name: "Disabled" },
  { id: 3, name: "Deleted" },
  { id: 4, name: "On-Going" },
  { id: 5, name: "Processed and valid" },
  { id: 6, name: "Processed and Paid" },
  { id: 7, name: "Processed and Unpaid" },
];

export const STATUS_ENABLED = 1;
export const STATUS_DISABLED = 2;
export const STATUS_PROCESSED_PAID = 6;
export const STATUS_PROCESSED_UNPAID = 7;

export function getStatusName(id?: number | null) {
  if (id == null) return undefined;
  return STATUSES.find((s) => s.id === id)?.name;
}

export default STATUSES;
