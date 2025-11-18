import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

type DateTimePickerProps = {
    value?: string; // ISO string or empty
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
};

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Beirut timezone offset: UTC+2 (or UTC+3 during DST)
const BEIRUT_TZ = 'Asia/Beirut';

export default function DateTimePicker({
    value = '',
    onChange,
    label,
    placeholder = 'Select date & time',
    required = false,
    disabled = false,
    className = '',
}: DateTimePickerProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'date' | 'time' | 'month' | 'year'>('date');

    // Parse value or use current Beirut time
    const parsedDate = value ? new Date(value) : null;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: BEIRUT_TZ }));

    const [selectedDate, setSelectedDate] = useState<Date>(parsedDate || now);
    const [displayMonth, setDisplayMonth] = useState(parsedDate?.getMonth() ?? now.getMonth());
    const [displayYear, setDisplayYear] = useState(parsedDate?.getFullYear() ?? now.getFullYear());
    const [hours, setHours] = useState(parsedDate?.getHours() ?? now.getHours());
    const [minutes, setMinutes] = useState(parsedDate?.getMinutes() ?? now.getMinutes());

    const containerRef = useRef<HTMLDivElement>(null);

    // Close picker when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Format display value
    const formatDisplayValue = () => {
        if (!value) return '';
        const date = new Date(value);
        const options: Intl.DateTimeFormatOptions = {
            timeZone: BEIRUT_TZ,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        };
        return new Intl.DateTimeFormat('en-US', options).format(date);
    };

    // Get days in month
    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    // Get first day of month (0 = Sunday)
    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    // Generate calendar days
    const generateCalendarDays = () => {
        const daysInMonth = getDaysInMonth(displayYear, displayMonth);
        const firstDay = getFirstDayOfMonth(displayYear, displayMonth);
        const days: (number | null)[] = [];

        // Add empty slots for days before month starts
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }

        return days;
    };

    // Check if date is selected
    const isDateSelected = (day: number | null) => {
        if (!day || !parsedDate) return false;
        return (
            parsedDate.getDate() === day &&
            parsedDate.getMonth() === displayMonth &&
            parsedDate.getFullYear() === displayYear
        );
    };

    // Check if date is today
    const isToday = (day: number | null) => {
        if (!day) return false;
        const today = new Date(new Date().toLocaleString('en-US', { timeZone: BEIRUT_TZ }));
        return (
            today.getDate() === day &&
            today.getMonth() === displayMonth &&
            today.getFullYear() === displayYear
        );
    };

    // Handle day click
    const handleDayClick = (day: number | null) => {
        if (!day) return;
        const newDate = new Date(displayYear, displayMonth, day, hours, minutes);
        setSelectedDate(newDate);
        setView('time');
    };

    // Handle time confirmation
    const handleConfirm = () => {
        const finalDate = new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            hours,
            minutes
        );
        onChange(finalDate.toISOString());
        setIsOpen(false);
    };

    // Handle clear
    const handleClear = () => {
        onChange('');
        setIsOpen(false);
    };

    // Navigate months
    const prevMonth = () => {
        if (displayMonth === 0) {
            setDisplayMonth(11);
            setDisplayYear(displayYear - 1);
        } else {
            setDisplayMonth(displayMonth - 1);
        }
    };

    const nextMonth = () => {
        if (displayMonth === 11) {
            setDisplayMonth(0);
            setDisplayYear(displayYear + 1);
        } else {
            setDisplayMonth(displayMonth + 1);
        }
    };

    // Generate year options
    const generateYears = () => {
        const currentYear = now.getFullYear();
        const years: number[] = [];
        for (let i = currentYear - 100; i <= currentYear + 10; i++) {
            years.push(i);
        }
        return years;
    };

    // Styles based on theme
    const bgColor = isDark ? 'bg-gray-800' : 'bg-white';
    const textColor = isDark ? 'text-gray-100' : 'text-gray-900';
    const borderColor = isDark ? 'border-gray-600' : 'border-gray-300';
    const hoverBg = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100';
    const selectedBg = isDark ? 'bg-indigo-600' : 'bg-indigo-600';
    const secondaryText = isDark ? 'text-gray-400' : 'text-gray-600';
    const popupBg = isDark ? 'bg-gray-800' : 'bg-white';
    const shadowColor = isDark ? 'shadow-2xl shadow-black/50' : 'shadow-2xl shadow-gray-500/20';

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            {/* Input Field */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
          w-full px-3 py-2 rounded-lg border-2 text-left text-sm
          transition-all duration-200 flex items-center justify-between
          ${bgColor} ${textColor} ${borderColor}
          ${disabled ? 'opacity-50 cursor-not-allowed' : `${hoverBg} hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer`}
        `}
            >
                <span className={value ? textColor : secondaryText}>
                    {value ? formatDisplayValue() : placeholder}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </button>

            {/* Picker Popup */}
            {isOpen && (
                <div className={`
          absolute top-full left-0 mt-2 z-50 rounded-xl border ${borderColor}
          ${popupBg} ${shadowColor} overflow-hidden min-w-[320px]
          animate-in fade-in slide-in-from-top-2 duration-200
        `}>
                    {/* Header with View Selector */}
                    <div className={`px-4 py-3 border-b ${borderColor} flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setView('date')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'date' ? `${selectedBg} text-white` : `${hoverBg} ${textColor}`
                                    }`}
                            >
                                Date
                            </button>
                            <button
                                onClick={() => setView('time')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'time' ? `${selectedBg} text-white` : `${hoverBg} ${textColor}`
                                    }`}
                            >
                                Time
                            </button>
                        </div>
                        <button
                            onClick={handleClear}
                            className={`text-sm ${secondaryText} hover:text-red-500 transition-colors`}
                        >
                            Clear
                        </button>
                    </div>

                    {/* Date View */}
                    {view === 'date' && (
                        <div className="p-4">
                            {/* Month/Year Selector */}
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={prevMonth}
                                    className={`p-2 rounded-lg ${hoverBg} transition-colors`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setView('month')}
                                        className={`px-3 py-1.5 rounded-lg font-semibold ${hoverBg} transition-colors ${textColor}`}
                                    >
                                        {MONTHS[displayMonth]}
                                    </button>
                                    <button
                                        onClick={() => setView('year')}
                                        className={`px-3 py-1.5 rounded-lg font-semibold ${hoverBg} transition-colors ${textColor}`}
                                    >
                                        {displayYear}
                                    </button>
                                </div>

                                <button
                                    onClick={nextMonth}
                                    className={`p-2 rounded-lg ${hoverBg} transition-colors`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>

                            {/* Weekday Headers */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {WEEKDAYS.map((day) => (
                                    <div key={day} className={`text-center text-xs font-semibold ${secondaryText} py-2`}>
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Days */}
                            <div className="grid grid-cols-7 gap-1">
                                {generateCalendarDays().map((day, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleDayClick(day)}
                                        disabled={!day}
                                        className={`
                      aspect-square rounded-lg text-sm font-medium transition-all
                      ${!day ? 'invisible' : ''}
                      ${isDateSelected(day) ? `${selectedBg} text-white scale-105 shadow-lg` : ''}
                      ${!isDateSelected(day) && isToday(day) ? `border-2 border-indigo-500 ${textColor}` : ''}
                      ${!isDateSelected(day) && !isToday(day) && day ? `${hoverBg} ${textColor}` : ''}
                      ${day ? 'hover:scale-105 active:scale-95' : ''}
                    `}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Month View */}
                    {view === 'month' && (
                        <div className="p-4">
                            <div className="grid grid-cols-3 gap-2">
                                {MONTHS.map((month, index) => (
                                    <button
                                        key={month}
                                        onClick={() => {
                                            setDisplayMonth(index);
                                            setView('date');
                                        }}
                                        className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${displayMonth === index ? `${selectedBg} text-white` : `${hoverBg} ${textColor}`}
                    `}
                                    >
                                        {month.slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Year View */}
                    {view === 'year' && (
                        <div className="p-4 max-h-64 overflow-y-auto">
                            <div className="grid grid-cols-4 gap-2">
                                {generateYears().map((year) => (
                                    <button
                                        key={year}
                                        onClick={() => {
                                            setDisplayYear(year);
                                            setView('date');
                                        }}
                                        className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${displayYear === year ? `${selectedBg} text-white` : `${hoverBg} ${textColor}`}
                    `}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Time View */}
                    {view === 'time' && (
                        <div className="p-6">
                            <div className="flex items-center justify-center gap-4 mb-6">
                                {/* Hours */}
                                <div className="flex flex-col items-center">
                                    <button
                                        onClick={() => setHours((h) => (h + 1) % 24)}
                                        className={`p-2 rounded-lg ${hoverBg} transition-colors mb-2`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                    </button>
                                    <div className={`text-4xl font-bold ${textColor} w-20 text-center`}>
                                        {String(hours).padStart(2, '0')}
                                    </div>
                                    <button
                                        onClick={() => setHours((h) => (h - 1 + 24) % 24)}
                                        className={`p-2 rounded-lg ${hoverBg} transition-colors mt-2`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    <span className={`text-xs ${secondaryText} mt-2`}>Hours</span>
                                </div>

                                <div className={`text-4xl font-bold ${textColor}`}>:</div>

                                {/* Minutes */}
                                <div className="flex flex-col items-center">
                                    <button
                                        onClick={() => setMinutes((m) => (m + 1) % 60)}
                                        className={`p-2 rounded-lg ${hoverBg} transition-colors mb-2`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                    </button>
                                    <div className={`text-4xl font-bold ${textColor} w-20 text-center`}>
                                        {String(minutes).padStart(2, '0')}
                                    </div>
                                    <button
                                        onClick={() => setMinutes((m) => (m - 1 + 60) % 60)}
                                        className={`p-2 rounded-lg ${hoverBg} transition-colors mt-2`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    <span className={`text-xs ${secondaryText} mt-2`}>Minutes</span>
                                </div>
                            </div>

                            {/* Quick time buttons */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {[
                                    { label: 'Now', value: now },
                                    { label: '9:00 AM', value: new Date(selectedDate.setHours(9, 0)) },
                                    { label: '12:00 PM', value: new Date(selectedDate.setHours(12, 0)) },
                                    { label: '3:00 PM', value: new Date(selectedDate.setHours(15, 0)) },
                                    { label: '6:00 PM', value: new Date(selectedDate.setHours(18, 0)) },
                                    { label: '9:00 PM', value: new Date(selectedDate.setHours(21, 0)) },
                                ].map(({ label, value: timeValue }) => (
                                    <button
                                        key={label}
                                        onClick={() => {
                                            setHours(timeValue.getHours());
                                            setMinutes(timeValue.getMinutes());
                                        }}
                                        className={`px-3 py-2 rounded-lg text-xs font-medium ${hoverBg} ${textColor} transition-all hover:scale-105`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Timezone Info */}
                            <div className={`text-center text-xs ${secondaryText} mb-4 flex items-center justify-center gap-1`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Beirut Time (GMT+2)
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className={`px-4 py-3 border-t ${borderColor} flex items-center justify-end gap-2`}>
                        <button
                            onClick={() => setIsOpen(false)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${hoverBg} ${textColor} transition-all`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedBg} text-white transition-all hover:scale-105 active:scale-95 shadow-lg`}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
