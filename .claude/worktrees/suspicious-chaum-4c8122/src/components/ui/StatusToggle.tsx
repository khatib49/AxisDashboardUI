import { STATUS_ENABLED, STATUS_DISABLED } from '../../services/statuses';

type StatusToggleProps = {
    value?: number | null;
    onChange: (id: number | null) => void;
};

export default function StatusToggle({ value, onChange }: StatusToggleProps) {
    const isEnabled = value === STATUS_ENABLED;
    const isDisabled = value === STATUS_DISABLED;
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                className={`px-3 py-1 rounded ${isEnabled ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                onClick={() => onChange(STATUS_ENABLED)}
            >
                Enabled
            </button>
            <button
                type="button"
                className={`px-3 py-1 rounded ${isDisabled ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
                onClick={() => onChange(STATUS_DISABLED)}
            >
                Disabled
            </button>
        </div>
    );
}
