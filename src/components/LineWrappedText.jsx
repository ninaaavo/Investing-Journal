import React, { useEffect, useRef, useState } from "react";

export default function LineWrappedText({ text, className = "", lineClassName = "" }) {
  const hiddenRef = useRef(null);
  const [lines, setLines] = useState([]);

  useEffect(() => {
    const container = hiddenRef.current;
    if (!container || !text) return;

    try {
      const range = document.createRange();
      const node = container.firstChild;
      if (!node) return;

      let lastTop = null;
      let line = [];
      const measuredLines = [];

      for (let i = 0; i < node.textContent.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);

        const rect = range.getBoundingClientRect();
        if (lastTop === null || rect.top === lastTop) {
          line.push(node.textContent[i]);
        } else {
          measuredLines.push(line.join(""));
          line = [node.textContent[i]];
        }
        lastTop = rect.top;
      }

      if (line.length > 0) {
        measuredLines.push(line.join(""));
      }

      setLines(measuredLines);
    } catch (err) {
      console.error("LineWrappedText error:", err);
      setLines([text]);
    }
  }, [text]);

  return (
    <>
      {/* Hidden render for measurement */}
      <div
        ref={hiddenRef}
        className="inline-block whitespace-normal w-fit invisible absolute"
        aria-hidden
      >
        <span>{text}</span>
      </div>

      {/* Actual rendered lines */}
      <div className={`flex flex-col ${className}`}>
        {lines.map((line, i) => (
          <span key={i} className={`inline-block ${lineClassName}`}>
            {line}
          </span>
        ))}
      </div>
    </>
  );
}
