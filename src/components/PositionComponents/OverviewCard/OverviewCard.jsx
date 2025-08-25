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
import { useState, useRef } from "react";
import { motion } from "framer-motion";

import FinancialMetricsCard from "./FinancialMetricCard.jsx";
import BehavioralMetricsCard from "./BehavioralMetricCard.jsx";
import SectorBreakdownChart from "./SectorBreakdownChart.jsx";
import PerformanceInsightsCard from "./PerformanceInsightCard.jsx";
// import TimeSummaryCard from "./TimeSummaryCard.jsx";
import NotesCard from "./NotesCard.jsx";

const componentMap = {
  FinancialMetricsCard,
  BehavioralMetricsCard,
  SectorBreakdownChart,
  PerformanceInsightsCard,
  NotesCard,
};

export default function OverviewCard({ isEditingLayout }) {
  const [leftColumn, setLeftColumn] = useState([
    "FinancialMetricsCard",
    "BehavioralMetricsCard",
  ]);
  const [rightColumn, setRightColumn] = useState([
    "PerformanceInsightsCard",
    "SectorBreakdownChart",
    "NotesCard",
  ]);

  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor));

  const dragOverRef = useRef(null);

  const findColumn = (id) => {
    if (leftColumn.includes(id)) return "left";
    if (rightColumn.includes(id)) return "right";
    return null;
  };

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
          onDragEnd={({ active, over }) => {
            dragOverRef.current = null;
            setActiveId(null);

            if (!over || active.id === over.id) return;

            const activeId = active.id;
            const overId = over.id;

            const activeCol = findColumn(activeId);
            const overCol = findColumn(overId);

            if (!activeCol || !overCol) return;

            const from =
              activeCol === "left" ? [...leftColumn] : [...rightColumn];
            const to = overCol === "left" ? [...leftColumn] : [...rightColumn];

            const setFrom =
              activeCol === "left" ? setLeftColumn : setRightColumn;
            const setTo = overCol === "left" ? setLeftColumn : setRightColumn;

            const fromIndex = from.indexOf(activeId);
            const overIndex = to.indexOf(overId);

            if (activeCol === overCol) {
              setFrom(arrayMove(from, fromIndex, overIndex));
            } else {
              const newFrom = from.filter((id) => id !== activeId);
              const newTo =
                overIndex === -1
                  ? [...to, activeId]
                  : [
                      ...to.slice(0, overIndex),
                      activeId,
                      ...to.slice(overIndex),
                    ];
              setFrom(newFrom);
              setTo(newTo);
            }
          }}
        >
          <div className="flex gap-4">
            <SortableContext
              items={leftColumn}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex-1 flex flex-col gap-4">
                {leftColumn.map((id) => (
                  <SortableCard key={id} id={id} isEditing={isEditingLayout} />
                ))}
              </div>
            </SortableContext>
            <SortableContext
              items={rightColumn}
              strategy={verticalListSortingStrategy}
            >
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
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

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
