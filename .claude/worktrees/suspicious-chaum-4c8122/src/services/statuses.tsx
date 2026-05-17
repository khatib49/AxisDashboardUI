export type StatusItem = {
    id: string;
    name: string;
};

export const STATUSES: StatusItem[] = [
    { id: '6c65007f-1d37-4d9c-b738-214f31e6ac71', name: 'Enabled' },
    { id: 'e0a8b7a9-e6e0-409d-8575-40e904d8de31', name: 'Deleted' },
    { id: '57b32705-19ba-4479-9383-9b73aa7e2df4', name: 'On-Going' },
    { id: '78519196-ae14-4443-83fa-bcb1ac151818', name: 'Processed and valid' },
    { id: 'f779b04d-9808-429a-9545-4fd36fa0b1e5', name: 'Processed and Paid' },
    { id: '68e9d0da-6951-4921-8a60-39c65f7aec86', name: 'Processed and Unpaid' },
    { id: 'cb0546b0-a86f-4ece-9e66-78578650ca9a', name: 'Disabled' },
];

export const STATUS_ENABLED = '6c65007f-1d37-4d9c-b738-214f31e6ac71';
export const STATUS_DISABLED = 'cb0546b0-a86f-4ece-9e66-78578650ca9a';

export function getStatusName(id?: string | null) {
    if (!id) return undefined;
    return STATUSES.find(s => s.id === id)?.name;
}
export default STATUSES;
