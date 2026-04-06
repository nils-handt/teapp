export const ZEN_PALETTE = {
  background: 'linear-gradient(180deg, #f7f3eb 0%, #eef3ea 100%)',
  panel: 'rgba(255, 252, 246, 0.86)',
  panelStrong: 'rgba(246, 250, 242, 0.95)',
  border: 'rgba(93, 113, 90, 0.16)',
  text: '#243126',
  muted: '#68756a',
  accentSoft: 'rgba(95, 124, 97, 0.12)',
  restTimer: '#9aa399',
  buttonSoft: '#ece8df',
  dangerSoft: '#fad3ce',
  danger: '#c14a3f',
  overlay: 'rgba(20, 28, 22, 0.24)',
  overlayStrong: 'rgba(17, 24, 21, 0.55)',
  tutorialEyebrow: '#607162',
  tutorialInactiveEyebrow: '#9aa39a',
  tutorialTitleInactive: '#96a094',
  tutorialCopyInactive: '#8d968b',
  tutorialPrimary: '#314534',
  tutorialPrimaryText: '#f8f5ec',
  tutorialIndicatorInactive: 'rgba(49, 69, 52, 0.22)',
  flowBackground: 'linear-gradient(to bottom, #4facfe 0%, #00f2fe 100%)',
  labBackground: '#333333',
  labText: '#00ff00',
};

type ClassValue = string | false | null | undefined;

export const cn = (...classValues: ClassValue[]) => classValues.filter(Boolean).join(' ');

export const zenPageShellClass = 'min-h-full bg-white px-5 pt-6 pb-10 text-zen-text';
export const zenStackClass = 'mx-auto flex max-w-[720px] flex-col gap-[18px]';
export const zenPanelClass = 'rounded-[28px] border border-zen-border bg-zen-panel p-[22px] shadow-zen-panel backdrop-blur-[10px]';
export const zenPanelStrongClass = cn(zenPanelClass, 'bg-zen-panel-strong bg-[image:var(--zen-background)]');
export const zenMetricCardClass = 'rounded-[18px] border border-zen-border bg-white/55 px-4 py-[14px]';
export const zenActionRowClass = 'flex flex-wrap justify-center gap-3';
export const zenHeroButtonClass = cn(
  'zen-hero-button',
);
export const zenSectionEyebrowClass = 'm-0 text-[0.76rem] uppercase tracking-[0.16em] text-zen-muted';
export const zenSummaryTitleClass = 'mt-2 text-[3.4rem] leading-none font-light text-zen-text';
export const zenFieldBaseClass = 'zen-field-button border-zen-border transition';
export const zenFieldToneClassMap = {
  default: 'bg-white/52',
  highlighted: 'bg-zen-accent-soft',
};
export const zenFieldStateClassMap = {
  enabled: 'cursor-pointer',
  disabled: 'cursor-not-allowed opacity-60',
};
export const zenFieldLabelClass = 'tracking-[0.03em] text-zen-muted';
export const zenInfusionControlBaseClass = 'zen-infusion-control-button transition';
export const zenInfusionControlToneClassMap = {
  inactive: 'border-zen-border bg-transparent text-zen-muted',
  active: 'border-[#1f1f1f] bg-[image:var(--zen-background)] text-black',
};
export const zenInfusionControlStateClassMap = {
  enabled: 'cursor-pointer opacity-100',
  disabled: 'cursor-not-allowed opacity-50',
};
export const zenActiveTimerWellClass = 'mx-auto mt-[14px] mb-[10px] flex aspect-square w-[min(320px,78vw)] flex-col items-center justify-center rounded-full border border-zen-border bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.9),rgba(230,238,226,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]';
export const zenActiveTimerClass = 'text-[3.4rem] font-light text-zen-text transition-colors duration-200';
export const zenActiveTimerToneClassMap = {
  default: 'text-zen-text',
  resting: 'text-zen-rest',
};
export const zenInfusionHistoryClass = 'mt-3 flex touch-pan-y select-none items-center justify-center gap-[10px] text-[0.98rem] text-zen-muted';
export const zenDotRailClass = 'inline-flex min-w-6 items-center gap-1.5';
export const zenModalOverlayClass = 'fixed inset-0 z-[1000] flex items-center justify-center bg-zen-overlay p-5';
export const zenModalPanelClass = 'w-full max-w-[420px] rounded-[24px] border border-zen-border bg-[#fffdf8] p-[22px] shadow-zen-modal';
export const zenModalTitleClass = 'mb-[14px] text-[1.1rem] font-medium text-zen-text';
export const zenModalActionsClass = 'flex justify-center gap-3';
export const zenInputClass = 'w-full rounded-2xl border border-zen-border px-4 py-[14px] text-base text-zen-text outline-none transition focus:border-zen-muted';
export const zenTextareaClass = cn(zenInputClass, 'resize-y font-inherit');
export const zenSuggestionGroupClass = 'grid gap-2';
export const zenSuggestionLabelClass = 'text-[0.85rem] text-zen-muted';
export const zenSuggestionButtonClass = 'w-full rounded-[14px] border border-zen-border bg-zen-suggestion px-[14px] py-3 text-left text-zen-text transition hover:border-zen-muted/60';
export const zenTutorialOverlayClass = 'fixed inset-0 z-[5000] flex items-center justify-center bg-zen-overlay-strong p-4 backdrop-blur-[8px]';
export const zenTutorialPanelClass = 'flex max-h-[min(92vh,760px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] border border-[rgba(74,88,72,0.18)] bg-[image:var(--zen-tutorial-background)] shadow-zen-tutorial';
export const zenTutorialHeaderClass = 'flex items-center justify-between gap-3 px-5 pt-5 pb-3';
export const zenTutorialSecondaryButtonClass = 'zen-tutorial-button zen-tutorial-button--secondary';
export const zenTutorialPrimaryButtonClass = 'zen-tutorial-button zen-tutorial-button--primary';
export const zenTutorialViewportClass = 'overflow-hidden px-5';
export const zenTutorialPageBodyClass = 'max-h-[min(52vh,440px)] overflow-y-auto pr-1.5';
export const zenTutorialFooterClass = 'flex flex-col gap-4 px-5 pt-4 pb-5';
export const zenTutorialNavClass = 'flex items-center justify-between gap-3';
export const zenTutorialActionsClass = 'flex justify-end gap-2.5';
export const zenTutorialIndicatorRowClass = 'flex justify-center gap-2';
export const zenSummarySectionHeadingClass = 'mb-3 flex items-baseline justify-between gap-3';
export const zenSummarySectionTitleClass = 'text-[1.1rem] font-medium text-zen-text';
export const zenSummaryStatLabelClass = 'mb-1.5 text-[0.82rem] text-zen-muted';
export const zenSummaryListClass = 'grid gap-2.5';
export const zenSummaryListItemClass = 'zen-summary-list-item';
