// OverviewCard.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import PLTimelineCard from "./PLTimeLineCard.jsx";
import FinancialMetricsCard from "./FinancialMetricCard.jsx";
import BehavioralMetricsCard from "./BehavioralMetricCard.jsx";
import SectorBreakdownChart from "./SectorBreakdownChart.jsx";
import PerformanceInsightsCard from "./PerformanceInsightCard.jsx";
import NotesCard from "./NotesCard.jsx";

import { useUser } from "../../../context/UserContext.jsx";
import { db } from "../../../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

const componentMap = {
  FinancialMetricsCard,
  BehavioralMetricsCard,
  SectorBreakdownChart,
  PerformanceInsightsCard,
  NotesCard,
  PLTimelineCard
};

// You may tweak these defaults; they're used if the user has no saved layout yet.
const DEFAULT_LEFT = ["FinancialMetricsCard", "BehavioralMetricsCard", "PLTimelineCard"];
const DEFAULT_RIGHT = ["PerformanceInsightsCard", "SectorBreakdownChart", "NotesCard"];

export default function OverviewCard({ isEditingLayout }) {
  const { user } = useUser();

  const [leftColumn, setLeftColumn] = useState(DEFAULT_LEFT);
  const [rightColumn, setRightColumn] = useState(DEFAULT_RIGHT);
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);

  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor));
  const dragOverRef = useRef(null);
  const hasLoadedRef = useRef(false);

  // ---- Firestore helpers ----
  const layoutRef = user ? doc(db, "users", user.uid) : null;

  const loadLayout = useCallback(async () => {
    if (!layoutRef || hasLoadedRef.current) return;
    setIsLoadingLayout(true);
    try {
      const snap = await getDoc(layoutRef);
      const data = snap.exists() ? snap.data() : null;
      const saved = data?.overviewLayout;

      if (saved?.left && saved?.right) {
        // Basic sanity check: ensure items exist in componentMap
        const filteredLeft = saved.left.filter((id) => componentMap[id]);
        const filteredRight = saved.right.filter((id) => componentMap[id]);

        // In case new cards were added to the app later, append any missing components at the end
        const allKnown = new Set([...filteredLeft, ...filteredRight]);
        const allComponents = Object.keys(componentMap);
        const missing = allComponents.filter((id) => !allKnown.has(id));

        setLeftColumn(filteredLeft);
        setRightColumn([...filteredRight, ...missing]);
      } else {
        // Initialize with defaults if no layout exists
        await setDoc(
          layoutRef,
          {
            overviewLayout: {
              left: DEFAULT_LEFT,
              right: DEFAULT_RIGHT,
            },
            overviewLayoutUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setLeftColumn(DEFAULT_LEFT);
        setRightColumn(DEFAULT_RIGHT);
      }
    } catch (err) {
      console.error("Failed to load overview layout:", err);
      // Fallback to defaults if load fails
      setLeftColumn(DEFAULT_LEFT);
      setRightColumn(DEFAULT_RIGHT);
    } finally {
      hasLoadedRef.current = true;
      setIsLoadingLayout(false);
    }
  }, [layoutRef]);

  const saveLayout = useCallback(
    async (left, right) => {
      if (!layoutRef) return;
      try {
        await updateDoc(layoutRef, {
          overviewLayout: {
            left,
            right,
          },
          overviewLayoutUpdatedAt: serverTimestamp(),
        });
      } catch (err) {
        // If the doc doesn't exist yet (rare race), create it
        if (err?.code === "not-found") {
          try {
            await setDoc(
              layoutRef,
              {
                overviewLayout: { left, right },
                overviewLayoutUpdatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (e2) {
            console.error("Failed to create overview layout:", e2);
          }
        } else {
          console.error("Failed to save overview layout:", err);
        }
      }
    },
    [layoutRef]
  );

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  const findColumn = (id) => {
    if (leftColumn.includes(id)) return "left";
    if (rightColumn.includes(id)) return "right";
    return null;
  };

  const handleDragEnd = ({ active, over }) => {
    dragOverRef.current = null;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id;
    const overId = over.id;

    const activeCol = findColumn(activeId);
    const overCol = findColumn(overId);

    if (!activeCol || !overCol) return;

    const from = activeCol === "left" ? [...leftColumn] : [...rightColumn];
    const to = overCol === "left" ? [...leftColumn] : [...rightColumn];

    const fromIndex = from.indexOf(activeId);
    const overIndex = to.indexOf(overId);

    // Compute next state first so we can persist it
    let nextLeft = leftColumn;
    let nextRight = rightColumn;

    if (activeCol === overCol) {
      const moved = arrayMove(from, fromIndex, overIndex);
      if (activeCol === "left") {
        nextLeft = moved;
        nextRight = rightColumn;
      } else {
        nextRight = moved;
        nextLeft = leftColumn;
      }
    } else {
      const newFrom = from.filter((id) => id !== activeId);
      const newTo =
        overIndex === -1
          ? [...to, activeId]
          : [...to.slice(0, overIndex), activeId, ...to.slice(overIndex)];

      if (activeCol === "left") {
        nextLeft = newFrom;
        nextRight = newTo;
      } else {
        nextRight = newFrom;
        nextLeft = newTo;
      }
    }

    // Update UI immediately
    setLeftColumn(nextLeft);
    setRightColumn(nextRight);

    // Persist to Firestore
    saveLayout(nextLeft, nextRight);
  };

  if (isLoadingLayout) {
    return (
      <div className="relative h-[calc(100%-40px)] my-4 overflow-hidden">
        <div className="h-full overflow-y-auto px-4">
          <div className="animate-pulse text-sm text-gray-500">Loading layout…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100%-40px)] my-4 overflow-hidden">
      <div className="h-full overflow-y-auto px-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragOver={({ active, over }) => {
            if (!over) return;
            const activeId = active.id;
            const overId = over.id;
            if (activeId === overId) return;
            const key = `${activeId}->${overId}`;
            if (dragOverRef.current === key) return;
            dragOverRef.current = key;
            // No state updates here!
          }}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4">
            <SortableContext items={leftColumn} strategy={verticalListSortingStrategy}>
              <div className="flex-1 flex flex-col gap-4">
                {leftColumn.map((id) => (
                  <SortableCard key={id} id={id} isEditing={isEditingLayout} />
                ))}
              </div>
            </SortableContext>

            <SortableContext items={rightColumn} strategy={verticalListSortingStrategy}>
              <div className="flex-1 flex flex-col gap-4">
                {rightColumn.map((id) => (
                  <SortableCard key={id} id={id} isEditing={isEditingLayout} />
                ))}
              </div>
            </SortableContext>
          </div>

          <DragOverlay>
            {activeId ? (
              <div className="rounded-xl shadow p-4 bg-white opacity-90">
                {(() => {
                  const ActiveComponent = componentMap[activeId];
                  return <ActiveComponent />;
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function SortableCard({ id, isEditing }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id });

  const Component = componentMap[id];

  return (
    <motion.div
      ref={setNodeRef}
      {...(isEditing ? { ...attributes, ...listeners } : {})}
      animate={{
        opacity: isDragging ? 0.4 : isEditing ? 0.7 : 1,
        scale: isEditing ? [1, 1.01, 1] : 1,
      }}
      transition={{
        opacity: { duration: 0.3 },
        scale: isEditing
          ? {
              duration: 1.5,
              repeat: Infinity,
              repeatType: "loop",
              ease: "easeInOut",
            }
          : { duration: 0 },
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`break-inside-avoid mb-4 relative ${
        isEditing ? "cursor-move" : ""
      }`}
    >
      <div className={isEditing ? "pointer-events-none" : ""}>
        <Component />
      </div>
    </motion.div>
  );
}
