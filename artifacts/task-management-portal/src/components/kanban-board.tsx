import { useState, useRef } from "react";
import { useUpdateApplication } from "@workspace/api-client-react";
import { STATUS_COLORS, STATUS_CHOICES } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical, User, BookOpen, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Application {
  id: number;
  application_status: string;
  student?: { full_name: string };
  university?: { name: string };
  assigned_to?: { full_name: string };
  course?: string;
  intake?: string;
  priority?: string;
}

interface KanbanBoardProps {
  applications: Application[];
  queryInvalidateKeys?: string[];
}

function PriorityDot({ priority }: { priority?: string }) {
  if (!priority || priority === "normal") return null;
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full shrink-0",
      priority === "high" ? "bg-red-500" : "bg-slate-400"
    )} title={priority} />
  );
}

function KanbanCard({
  app,
  onDragStart,
  isDragging,
}: {
  app: Application;
  onDragStart: (e: React.DragEvent, id: number) => void;
  isDragging: boolean;
}) {
  const color = STATUS_COLORS[app.application_status] || { bg: "#f1f5f9", text: "#64748b" };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, app.id)}
      className={cn(
        "bg-card rounded-xl border border-border shadow-sm p-3.5 cursor-grab active:cursor-grabbing select-none transition-all",
        "hover:shadow-md hover:border-primary/30",
        isDragging && "opacity-40 scale-95"
      )}
    >
      {/* Student name + priority */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2">
          {app.student?.full_name || "Unknown Student"}
        </p>
        <PriorityDot priority={app.priority} />
      </div>

      {/* University */}
      {app.university?.name && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <BookOpen className="w-3 h-3 shrink-0" />
          <span className="truncate">{app.university.name}</span>
        </div>
      )}

      {/* Course */}
      {app.course && (
        <p className="text-xs text-muted-foreground truncate mb-1.5 pl-4">{app.course}</p>
      )}

      {/* Intake */}
      {app.intake && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>{app.intake}</span>
        </div>
      )}

      {/* Footer: assignee */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
        {app.assigned_to ? (
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0"
              style={{ backgroundColor: color.bg, color: color.text, borderColor: color.bg }}
            >
              {app.assigned_to.full_name.charAt(0)}
            </div>
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {app.assigned_to.full_name.split(" ")[0]}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50 italic">
            <User className="w-3 h-3" />
            Unassigned
          </div>
        )}
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30" />
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  cards,
  draggingId,
  onDragStart,
  onDrop,
}: {
  status: string;
  cards: Application[];
  draggingId: number | null;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDrop: (status: string) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const color = STATUS_COLORS[status] || { bg: "#f1f5f9", text: "#64748b" };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => setIsOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    onDrop(status);
  };

  return (
    <div className="flex flex-col min-w-[260px] max-w-[260px] h-full">
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl font-semibold text-xs uppercase tracking-wide shrink-0"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        <span className="truncate">{status}</span>
        <span
          className="ml-2 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ backgroundColor: color.text + "22", color: color.text }}
        >
          {cards.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "flex-1 rounded-b-xl p-2 space-y-2 overflow-y-auto transition-colors min-h-[120px]",
          isOver
            ? "bg-primary/5 ring-2 ring-primary/30 ring-inset"
            : "bg-muted/40"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {cards.length === 0 && (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground/40 italic select-none pt-6">
            {isOver ? "Drop here" : "No applications"}
          </div>
        )}
        {cards.map((app) => (
          <KanbanCard
            key={app.id}
            app={app}
            onDragStart={onDragStart}
            isDragging={draggingId === app.id}
          />
        ))}
        {/* Drop target indicator when dragging over non-empty column */}
        {isOver && cards.length > 0 && (
          <div className="h-1.5 rounded-full bg-primary/40 mx-1" />
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ applications, queryInvalidateKeys = [] }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const updateMut = useUpdateApplication();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragAppRef = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, appId: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(appId));
    dragAppRef.current = appId;
    setDraggingId(appId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    dragAppRef.current = null;
  };

  const handleDrop = async (newStatus: string) => {
    const appId = dragAppRef.current;
    if (!appId) return;

    const app = applications.find((a) => a.id === appId);
    if (!app || app.application_status === newStatus) return;

    await updateMut.mutateAsync({
      appId,
      data: { application_status: newStatus },
    });

    const keysToInvalidate = [
      "/api/applications",
      "/api/dashboard",
      ...queryInvalidateKeys,
    ];
    keysToInvalidate.forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    );
  };

  // Group cards by status, preserve STATUS_CHOICES order
  const columnMap = STATUS_CHOICES.reduce<Record<string, Application[]>>(
    (acc, status) => {
      acc[status] = applications.filter(
        (a) => a.application_status === status
      );
      return acc;
    },
    {}
  );

  return (
    <div
      className="flex gap-3 h-full overflow-x-auto pb-4 select-none"
      onDragEnd={handleDragEnd}
    >
      {STATUS_CHOICES.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          cards={columnMap[status] || []}
          draggingId={draggingId}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
