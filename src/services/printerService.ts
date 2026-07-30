import { get, post, put, del } from "./api";

// Physical kitchen/bar printers. The cloud API can't reach these directly; it
// dispatches jobs over SignalR and an on-site print agent forwards them here.

export type PrinterStation = "Kitchen" | "Bar";
export type PrinterConnectionType = "Network" | "Usb";

export type PrinterDto = {
  id: number;
  name: string;
  station: string; // "Kitchen" | "Bar"
  connectionType: string; // "Network" | "Usb"
  address: string; // "ip:port" for Network, Windows printer name for Usb
  copyCount: number;
  isEnabled: boolean;
  createdOn: string;
  modifiedOn: string | null;
};

export type PrinterCreateDto = {
  name: string;
  station: string;
  connectionType: string;
  address: string;
  copyCount?: number;
};

export type PrinterUpdateDto = {
  name?: string | null;
  station?: string | null;
  connectionType?: string | null;
  address?: string | null;
  copyCount?: number | null;
  isEnabled?: boolean | null;
};

export async function getPrinters(
  includeDisabled = true,
  station?: string
): Promise<PrinterDto[]> {
  const params = new URLSearchParams();
  params.set("IncludeDisabled", String(includeDisabled));
  if (station) params.set("Station", station);
  return await get<PrinterDto[]>(`/printer?${params.toString()}`);
}

export async function createPrinter(dto: PrinterCreateDto): Promise<PrinterDto> {
  return await post<PrinterDto>("/printer", dto);
}

export async function updatePrinter(id: number, dto: PrinterUpdateDto): Promise<void> {
  return await put<void>(`/printer/${id}`, dto);
}

export async function deletePrinter(id: number): Promise<void> {
  return await del<void>(`/printer/${id}`);
}

// Fires a small test ticket at the printer through the on-site agent.
export async function testPrinter(id: number): Promise<{ message: string }> {
  return await post<{ message: string }>(`/printer/${id}/test`);
}
