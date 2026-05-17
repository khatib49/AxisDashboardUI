// src/services/loyaltyService.ts
import api from './api'; // Your existing axios instance

// Types
export interface LoyaltyCustomer {
    phoneNumber: string;
    name?: string;
    totalTicketsCurrentMonth: number;
    pendingBalance: number;
    lastUpdated: string;
    createdAt: string;
}

export interface LoyaltyTicket {
    ticketId: number;
    customerPhone: string;
    transactionId: number;
    ticketsEarned: number;
    earnedDate: string;
    drawMonth: string;
    isValid: boolean;
}

export interface CustomerBalance {
    customerPhone: string;
    customerName?: string;
    totalTicketsCurrentMonth: number;
    pendingBalance: number;
    currentMonth: string;
    recentTickets: {
        ticketId: number;
        transactionId: number;
        ticketsEarned: number;
        earnedDate: string;
    }[];
}

export interface LeaderboardEntry {
    customerPhone: string;
    customerName?: string;
    totalTickets: number;
    rank: number;
}

export interface Winner {
    customerPhone: string;
    customerName?: string;
    prizeName: string;
    ticketsHeld: number;
    drawDate: string;
}

export interface DrawResponse {
    success: boolean;
    message: string;
    winner?: Winner;
    totalEligibleCustomers: number;
    totalTicketsInDraw: number;
}

// API Functions
export const getCustomerBalance = async (phone: string): Promise<CustomerBalance> => {
    const response = await api.get(`/loyalty/customer/${encodeURIComponent(phone)}/balance`);
    return response.data;
};

export const getWeeklyLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    const response = await api.get('/loyalty/leaderboard/weekly');
    return response.data;
};

export const getMonthlyLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    const response = await api.get('/loyalty/leaderboard/monthly');
    return response.data;
};

export const conductWeeklyDraw = async (prizeName: string): Promise<DrawResponse> => {
    const response = await api.post('/loyalty/admin/draw/weekly', { prizeName });
    return response.data;
};

export const conductMonthlyDraw = async (prizeName: string): Promise<DrawResponse> => {
    const response = await api.post('/loyalty/admin/draw/monthly', { prizeName });
    return response.data;
};

export const invalidateExpiredTickets = async (): Promise<{ message: string }> => {
    const response = await api.post('/loyalty/admin/invalidate-expired');
    return response.data;
};