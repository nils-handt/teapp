import React from 'react';

export const ZEN_PALETTE = {
    background: 'linear-gradient(180deg, #f7f3eb 0%, #eef3ea 100%)',
    panel: 'rgba(255, 252, 246, 0.86)',
    panelStrong: 'rgba(246, 250, 242, 0.95)',
    border: 'rgba(93, 113, 90, 0.16)',
    text: '#243126',
    muted: '#68756a',
    accentSoft: 'rgba(95, 124, 97, 0.12)',
    restTimer: '#9aa399',
    buttonSoft: '#d9e8ef',
    dangerSoft: '#fad3ce',
};

export const zenContainerStyle: React.CSSProperties = {
    minHeight: '100%',
    padding: '24px 20px 40px',
    background: '#ffffff',
    color: ZEN_PALETTE.text,
};

export const zenStackStyle: React.CSSProperties = {
    maxWidth: '720px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
};

export const zenPanelStyle: React.CSSProperties = {
    background: ZEN_PALETTE.panel,
    border: `1px solid ${ZEN_PALETTE.border}`,
    borderRadius: '28px',
    padding: '22px',
    boxShadow: '0 16px 36px rgba(69, 83, 66, 0.08)',
    backdropFilter: 'blur(10px)',
};

export const zenSecondaryPanelStyle: React.CSSProperties = {
    ...zenPanelStyle,
    background: ZEN_PALETTE.panelStrong,
    backgroundImage: ZEN_PALETTE.background,
};

export const zenActionRowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'center',
};

export const zenMetricGridCardStyle: React.CSSProperties = {
    padding: '14px 16px',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.55)',
    border: `1px solid ${ZEN_PALETTE.border}`,
};

export const zenPrimaryButtonStyle = {
    '--background': ZEN_PALETTE.background,
    '--color': '#000000',
};

export const zenDangerButtonStyle = {
    '--background': `linear-gradient(180deg, ${ZEN_PALETTE.dangerSoft} 0%, #f4c4bc 100%)`,
    '--color': '#000000',
};

export const zenHeroButtonStyle: React.CSSProperties = {
    ...zenSecondaryPanelStyle,
    width: '100%',
    padding: '40px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    color: '#000000',
    fontSize: '1.05rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
};

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
