import { useEffect, useRef } from "react";

export const useTrackYShift = (ref, watchRef) => {
  const prevY = useRef(0);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!ref.current || !watchRef.current) return;

    const checkYShift = () => {
      const newY = ref.current.getBoundingClientRect().top;
      const deltaY = prevY.current - newY;

      if (hasMounted.current && Math.abs(deltaY) > 1) {
        ref.current.style.transition = "none";
        ref.current.style.transform = `translateY(${deltaY}px)`;

        requestAnimationFrame(() => {
          ref.current.style.transition = "transform 200ms ease";
          ref.current.style.transform = "translateY(0)";
        });

        console.log("Shifted Y by", deltaY);
      }

      prevY.current = newY;
      hasMounted.current = true;
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(checkYShift);
    });

    resizeObserver.observe(watchRef.current);

    // Run once on mount
    requestAnimationFrame(checkYShift);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);
};
