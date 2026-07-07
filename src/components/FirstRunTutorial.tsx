import { createGesture } from '@ionic/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  cn,
  zenTutorialActionsClass,
  zenTutorialFooterClass,
  zenTutorialHeaderClass,
  zenTutorialIndicatorRowClass,
  zenTutorialNavClass,
  zenTutorialOverlayClass,
  zenTutorialPageBodyClass,
  zenTutorialPanelClass,
  zenTutorialPrimaryButtonClass,
  zenTutorialSecondaryButtonClass,
  zenTutorialViewportClass,
} from '../styles/zen';

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
      'Teapp watches the scale during setup and brewing so a tea timer can react to what you do while brewing.\n\nFirst connect a Bluetooth scale in the Brewing tab, then tap Start Session to begin a new tea session.',
  },
  {
    eyebrow: 'Setup',
    title: 'Build your setup on the scale',
    description: 'During setup, place each part on the scale in order and confirm when everything looks right.',
    bullets: [
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
      'Waste water can be added only during the brewing phase',
    ],
  },
];

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

// eslint-disable-next-line react/prop-types
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
    <div role="dialog" aria-modal="true" aria-labelledby="first-run-tutorial-title" className={zenTutorialOverlayClass}>
      <div className={zenTutorialPanelClass}>
        <div className={zenTutorialHeaderClass}>
          <div>
            <div className="text-[0.8rem] uppercase tracking-[0.14em] text-[#607162]">
              First brew walkthrough
            </div>
          </div>
          <button type="button" onClick={onDismiss} className={zenTutorialSecondaryButtonClass}>
            Skip
          </button>
        </div>

        <div ref={viewportRef} className={zenTutorialViewportClass}>
          <div data-testid="tutorial-track" style={trackStyle(currentPage, pageWidth)}>
            {TUTORIAL_PAGES.map((page, index) => (
              <section
                key={page.title}
                aria-hidden={index !== currentPage}
                data-active={index === currentPage ? 'true' : 'false'}
                style={{
                  ...pageStyle(pageWidth),
                  opacity: index === currentPage ? 1 : 0.72,
                }}
              >
                <div className={zenTutorialPageBodyClass}>
                  <div className={cn(
                    'text-[0.84rem] uppercase tracking-[0.18em]',
                    index === currentPage ? 'text-[#607162]' : 'text-[#9aa39a]',
                  )}>
                    {page.eyebrow}
                  </div>
                  <h2
                    id={index === currentPage ? 'first-run-tutorial-title' : undefined}
                    data-active={index === currentPage ? 'true' : 'false'}
                    className={cn(
                      'mt-[10px] mb-3 text-[1.85rem] leading-[1.1]',
                      index === currentPage ? 'text-[#223026]' : 'text-[#96a094]',
                    )}
                  >
                    {page.title}
                  </h2>
                  <p
                    className={cn(
                      'm-0 whitespace-pre-line text-base leading-[1.6]',
                      index === currentPage ? 'text-[#314534]' : 'text-[#8d968b]',
                    )}
                  >
                    {page.description}
                  </p>
                  {page.bullets && (
                    <ul
                      className={cn(
                        'mt-[18px] mb-0 list-disc pl-5 leading-[1.7]',
                        index === currentPage ? 'text-[#314534]' : 'text-[#8d968b]',
                      )}
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

        <div className={zenTutorialFooterClass}>
          <div className={zenTutorialIndicatorRowClass}>
            {TUTORIAL_PAGES.map((page, index) => (
              <span
                key={page.title}
                aria-label={`Page ${index + 1}`}
                className={cn(
                  'h-2 rounded-full transition-all duration-200',
                  index === currentPage ? 'w-6 bg-[#314534]' : 'w-2 bg-[rgba(49,69,52,0.22)]',
                )}
              />
            ))}
          </div>

          <div className={zenTutorialNavClass}>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 0))}
              disabled={isFirstPage}
              className={zenTutorialSecondaryButtonClass}
            >
              Back
            </button>

            <div className={zenTutorialActionsClass}>
              {!isLastPage && (
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(page + 1, TUTORIAL_PAGES.length - 1))}
                  className={zenTutorialPrimaryButtonClass}
                >
                  Next
                </button>
              )}
              {isLastPage && (
                <button type="button" onClick={onDismiss} className={zenTutorialPrimaryButtonClass}>
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
