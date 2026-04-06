import React from 'react';

const actionColors: Record<string, string> = {
  Created:          'bg-green-100 text-green-800',
  CloseGameSession: 'bg-blue-100 text-blue-800',
  CloseInvoice:     'bg-blue-100 text-blue-800',
  AddItems:         'bg-yellow-100 text-yellow-800',
  UpdateSet:        'bg-purple-100 text-purple-800',
  AdminUpdate:      'bg-red-100 text-red-800',
};

export const AuditActionBadge = ({ action }: { action: string }) => {
  const cls = actionColors[action] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {action}
    </span>
  );
};