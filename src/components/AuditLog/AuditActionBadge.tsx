const actionColors: Record<string, string> = {
  Created:          'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300',
  CloseGameSession: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300',
  CloseInvoice:     'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300',
  AddItems:         'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300',
  UpdateSet:        'bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300',
  AdminUpdate:      'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300',
};

export const AuditActionBadge = ({ action }: { action: string }) => {
  const cls = actionColors[action] ?? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {action}
    </span>
  );
};