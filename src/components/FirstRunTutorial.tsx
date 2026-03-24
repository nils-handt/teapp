import { createGesture } from '@ionic/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

type TutorialPage = {
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
};

type FirstRunTutorialProps = {
  isOpen: boolean;
  onDismiss: () => void;
};

const SWIPE_THRESHOLD_PX = 50;
const DEFAULT_PAGE_PREVIEW_PX = 40;
const MAX_PAGE_PREVIEW_RATIO = 0.2;
const PAGE_GAP_PX = 14;
const MIN_PAGE_WIDTH_PX = 240;

const TUTORIAL_PAGES: TutorialPage[] = [
  {
    eyebrow: 'Welcome',
    title: 'Brew tea with scale-based timing and tracking',
    description:
      'Teapp watches the scale during setup and brewing so a tea timer can react to what you do on the tray.\n\nFirst connect a Bluetooth scale in the Brewing tab, then tap Start Session to begin a new tea session.',
  },
  {
    eyebrow: 'Setup',
    title: 'Build your setup on the scale',
    description: 'During setup, place each part on the scale in order and confirm when everything looks right.',
    bullets: [
      'Optionally add a brewing tray',
      'Add the brewing vessel',
      'Remove the vessel lid',
      'Add the tea leaves',
      'Tap Confirm Setup',
    ],
  },
  {
    eyebrow: 'Brewing',
    title: 'Let the timer react to the brew',
    description: 'After setup is confirmed, the app watches for the brewing steps automatically.',
    bullets: [
      'Adding water starts the brewing timer automatically',
      'Removing the vessel to pour pauses the infusion while the vessel is lifted',
      'Returning the vessel after pouring ends the brewing timer automatically',
    ],
  },
  {
    eyebrow: 'Limitations',
    title: 'Known limitations',
    description: 'A few sidenotes before you get started',
    bullets: [
      'Only Bokoo scales are verified to work well',
      'Waste water can be added to the tea tray only during the brewing phase',
    ],
  },
];

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 5000,
  background: 'rgba(17, 24, 21, 0.55)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
};

const panelStyle: CSSProperties = {
  width: 'min(560px, 100%)',
  maxHeight: 'min(92vh, 760px)',
  background: 'linear-gradient(180deg, #fffdf7 0%, #f3efe2 100%)',
  borderRadius: '28px',
  border: '1px solid rgba(74, 88, 72, 0.18)',
  boxShadow: '0 24px 70px rgba(20, 28, 22, 0.22)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '20px 20px 12px',
};

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid rgba(58, 75, 59, 0.18)',
  background: 'rgba(255, 255, 255, 0.72)',
  color: '#243127',
  borderRadius: '999px',
  padding: '10px 16px',
  fontSize: '0.95rem',
  cursor: 'pointer',
};

const primaryButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  background: '#314534',
  color: '#f8f5ec',
  borderColor: '#314534',
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.45,
  cursor: 'not-allowed',
};

const viewportStyle: CSSProperties = {
  overflow: 'hidden',
  padding: '0 20px',
};

const trackStyle = (pageIndex: number, pageWidth: number): CSSProperties => ({
  display: 'flex',
  gap: `${PAGE_GAP_PX}px`,
  width: 'max-content',
  transform: `translateX(-${pageIndex * (pageWidth + PAGE_GAP_PX)}px)`,
  transition: 'transform 220ms ease',
});

const pageStyle = (pageWidth: number): CSSProperties => ({
  width: `${pageWidth}px`,
  flexShrink: 0,
  padding: '8px 0 8px',
});

const pageBodyStyle: CSSProperties = {
  maxHeight: 'min(52vh, 440px)',
  overflowY: 'auto',
  paddingRight: '6px',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '16px 20px 20px',
};

const navStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  justifyContent: 'flex-end',
};

const FirstRunTutorial: React.FC<FirstRunTutorialProps> = ({ isOpen, onDismiss }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [pageWidth, setPageWidth] = useState(320);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === TUTORIAL_PAGES.length - 1;

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const element = viewportRef.current;
    if (!element) {
      return;
    }

    let frameId = 0;

    const updatePageWidth = () => {
      const computedStyle = window.getComputedStyle(element);
      const horizontalPadding =
        Number.parseFloat(computedStyle.paddingLeft || '0')
        + Number.parseFloat(computedStyle.paddingRight || '0');
      const innerWidth = Math.max(element.clientWidth - horizontalPadding, MIN_PAGE_WIDTH_PX);
      const previewWidth = Math.min(
        DEFAULT_PAGE_PREVIEW_PX,
        Math.floor(innerWidth * MAX_PAGE_PREVIEW_RATIO)
      );
      const nextWidth = Math.max(innerWidth - previewWidth, MIN_PAGE_WIDTH_PX);
      setPageWidth(nextWidth);
    };

    frameId = window.requestAnimationFrame(() => {
      updatePageWidth();
    });

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updatePageWidth);
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener('resize', updatePageWidth);
      };
    }

    const observer = new ResizeObserver(() => {
      updatePageWidth();
    });
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [isOpen]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!isOpen || !element) {
      return;
    }

    const gesture = createGesture({
      el: element,
      gestureName: 'tutorial-horizontal-swipe',
      threshold: 10,
      disableScroll: false,
      onEnd: (detail) => {
        const absX = Math.abs(detail.deltaX);
        const absY = Math.abs(detail.deltaY);

        if (absX < SWIPE_THRESHOLD_PX || absX <= absY) {
          return;
        }

        if (detail.deltaX < 0) {
          setCurrentPage((page) => Math.min(page + 1, TUTORIAL_PAGES.length - 1));
          return;
        }

        setCurrentPage((page) => Math.max(page - 1, 0));
      },
    });

    gesture.enable(true);

    return () => {
      gesture.destroy();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="first-run-tutorial-title" style={overlayStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: '0.8rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#607162' }}>
              First brew walkthrough
            </div>
          </div>
          <button type="button" onClick={onDismiss} style={secondaryButtonStyle}>
            Skip
          </button>
        </div>

        <div ref={viewportRef} style={viewportStyle}>
          <div data-testid="tutorial-track" style={trackStyle(currentPage, pageWidth)}>
            {TUTORIAL_PAGES.map((page, index) => (
              <section
                key={page.title}
                aria-hidden={index !== currentPage}
                style={{
                  ...pageStyle(pageWidth),
                  opacity: index === currentPage ? 1 : 0.72,
                }}
              >
                <div style={pageBodyStyle}>
                  <div style={{ color: index === currentPage ? '#607162' : '#9aa39a', fontSize: '0.84rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                    {page.eyebrow}
                  </div>
                  <h2
                    id={index === currentPage ? 'first-run-tutorial-title' : undefined}
                    style={{
                      margin: '10px 0 12px',
                      fontSize: '1.85rem',
                      lineHeight: 1.1,
                      color: index === currentPage ? '#223026' : '#96a094',
                    }}
                  >
                    {page.title}
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      color: index === currentPage ? '#314534' : '#8d968b',
                      lineHeight: 1.6,
                      fontSize: '1rem',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {page.description}
                  </p>
                  {page.bullets && (
                    <ul
                      style={{
                        margin: '18px 0 0',
                        paddingLeft: '20px',
                        color: index === currentPage ? '#314534' : '#8d968b',
                        lineHeight: 1.7,
                      }}
                    >
                      {page.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div style={footerStyle}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
            {TUTORIAL_PAGES.map((page, index) => (
              <span
                key={page.title}
                aria-label={`Page ${index + 1}`}
                style={{
                  width: index === currentPage ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '999px',
                  background: index === currentPage ? '#314534' : 'rgba(49, 69, 52, 0.22)',
                  transition: 'all 180ms ease',
                }}
              />
            ))}
          </div>

          <div style={navStyle}>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 0))}
              disabled={isFirstPage}
              style={{
                ...secondaryButtonStyle,
                ...(isFirstPage ? disabledButtonStyle : {}),
              }}
            >
              Back
            </button>

            <div style={actionsStyle}>
              {!isLastPage && (
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(page + 1, TUTORIAL_PAGES.length - 1))}
                  style={primaryButtonStyle}
                >
                  Next
                </button>
              )}
              {isLastPage && (
                <button type="button" onClick={onDismiss} style={primaryButtonStyle}>
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstRunTutorial;
