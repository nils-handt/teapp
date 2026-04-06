export const formatZenWeight = (value?: number | null) => `${(value ?? 0).toFixed(1)} g`;

export const formatZenDateTime = (value?: string | null) => {
    if (!value) {
        return 'Not available';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return 'Not available';
    }

    return parsed.toLocaleString();
};

export const formatZenSeconds = (value?: number | null) => {
    const totalSeconds = value ?? 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const formatZenTemperature = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return 'Temp -';
    }

    const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
    return `Temp ${rounded}°`;
};
