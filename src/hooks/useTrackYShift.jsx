import { useEffect, useRef } from "react";

/**
 * Smoothly animates a DOM element when its vertical position shifts
 * due to layout changes triggered by one or more watched elements.
 *
 * @param {React.RefObject} ref - The ref of the component you want to animate.
 * @param {React.RefObject[] | React.RefObject} watchRefs - One or more refs to observe for layout-triggering changes.
 */
export const useTrackYShift = (ref, watchRefs) => {
  const prevY = useRef(0);
  const hasMounted = useRef(false);

  // Normalize to array (even if a single ref is passed)
  const watchArray = Array.isArray(watchRefs) ? watchRefs : [watchRefs];

  useEffect(() => {
    if (!ref.current || watchArray.length === 0) return;

    const checkYShift = () => {
      const newY = ref.current.offsetTop; // ✅ relative to container, not scroll
      const deltaY = prevY.current - newY;

      if (hasMounted.current && Math.abs(deltaY) > 1) {
        ref.current.style.transition = "none";
        ref.current.style.transform = `translateY(${deltaY}px)`;

        requestAnimationFrame(() => {
          ref.current.style.transition = "transform 200ms ease";
          ref.current.style.transform = "translateY(0)";
        });

        console.log("[useTrackYShift] Smooth shift by", deltaY, "px");
      }

      prevY.current = newY;
      hasMounted.current = true;
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(checkYShift);
    });

    watchArray.forEach((r) => {
      if (r?.current) resizeObserver.observe(r.current);
    });

    requestAnimationFrame(checkYShift); // Initial sync

    return () => {
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchArray]);
};
