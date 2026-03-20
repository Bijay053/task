import { useState, useRef } from "react";
import { useUpdateApplication } from "@workspace/api-client-react";
import { GS_STATUS_COLORS, GS_STATUS_CHOICES } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical, User, BookOpen, Calendar, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Application {
  id: number;
  application_status: string;
  student?: { full_name: string } | null;
  student_name?: string | null;
  university?: { name: string } | null;
  university_name?: string | null;
  agent?: { name: string } | null;
  assigned_to?: { full_name: string } | null;
  course?: string | null;
  intake?: string | null;
  priority?: string | null;
  channel?: string | null;
  remarks?: string | null;
}

interface KanbanBoardProps {
  applications: Application[];
  statusChoices?: string[];
  statusColors?: Record<string, { bg: string; text: string }>;
  queryInvalidateKeys?: string[];
  onCardClick?: (app: Application) => void;
}

function PriorityDot({ priority }: { priority?: string }) {
  if (!priority || priority === "normal") return null;
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full shrink-0", priority === "high" ? "bg-red-500" : "bg-slate-400")}
      title={priority}
    />
  );
}

function KanbanCard({
  app,
  colorMap,
  onDragStart,
  isDragging,
  onCardClick,
}: {
  app: Application;
  colorMap: Record<string, { bg: string; text: string }>;
  onDragStart: (e: React.DragEvent, id: number) => void;
  isDragging: boolean;
  onCardClick?: (app: Application) => void;
}) {
  const color = colorMap[app.application_status] || { bg: "#f1f5f9", text: "#64748b" };

  const handleClick = (e: React.MouseEvent) => {
    if (onCardClick) {
      e.stopPropagation();
      onCardClick(app);
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, app.id)}
      onClick={handleClick}
      className={cn(
        "bg-card rounded-xl border border-border shadow-sm p-3.5 select-none transition-all",
        onCardClick ? "cursor-pointer hover:shadow-md hover:border-primary/40 hover:bg-primary/[0.02]" : "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30",
        isDragging && "opacity-40 scale-95"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2">
          {app.student?.full_name || app.student_name || "Unknown Student"}
        </p>
        <PriorityDot priority={app.priority} />
      </div>

      {(app.university?.name || app.university_name) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <BookOpen className="w-3 h-3 shrink-0" />
          <span className="truncate">{app.university?.name || app.university_name}</span>
        </div>
      )}

      {app.course && (
        <p className="text-xs text-muted-foreground truncate mb-1 pl-4">{app.course}</p>
      )}

      {app.intake && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>{app.intake}</span>
        </div>
      )}

      {app.channel && (
        <div className="mb-1">
          <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium text-xs">{app.channel}</span>
        </div>
      )}

      {app.agent?.name && (
        <div className="flex items-center gap-1.5 text-xs text-sky-600 mb-1">
          <UserCheck className="w-3 h-3 shrink-0" />
          <span className="truncate">{app.agent.name}</span>
        </div>
      )}

      {app.remarks && (
        <p className="text-xs text-muted-foreground italic truncate mb-1 border-t border-border/40 pt-1 mt-1">
          {app.remarks.length > 60 ? app.remarks.slice(0, 60) + "…" : app.remarks}
        </p>
      )}

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
  colorMap,
  draggingId,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  status: string;
  cards: Application[];
  colorMap: Record<string, { bg: string; text: string }>;
  draggingId: number | null;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDrop: (status: string) => void;
  onCardClick?: (app: Application) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const color = colorMap[status] || { bg: "#f1f5f9", text: "#64748b" };

  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px] h-full">
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
      <div
        className={cn(
          "flex-1 rounded-b-xl p-2 space-y-2 overflow-y-auto transition-colors min-h-[120px]",
          isOver ? "bg-primary/5 ring-2 ring-primary/30 ring-inset" : "bg-muted/40"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsOver(false); onDrop(status); }}
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
            colorMap={colorMap}
            onDragStart={onDragStart}
            isDragging={draggingId === app.id}
            onCardClick={onCardClick}
          />
        ))}
        {isOver && cards.length > 0 && (
          <div className="h-1.5 rounded-full bg-primary/40 mx-1" />
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  applications,
  statusChoices = GS_STATUS_CHOICES,
  statusColors = GS_STATUS_COLORS,
  queryInvalidateKeys = [],
  onCardClick,
}: KanbanBoardProps) {
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

    await updateMut.mutateAsync({ appId, data: { application_status: newStatus } });

    ["/api/applications", "/api/dashboard", ...queryInvalidateKeys].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    );
  };

  const columnMap = statusChoices.reduce<Record<string, Application[]>>((acc, status) => {
    acc[status] = applications.filter((a) => a.application_status === status);
    return acc;
  }, {});

  return (
    <div className="flex gap-3 h-full overflow-x-auto pb-4 select-none" onDragEnd={handleDragEnd}>
      {statusChoices.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          cards={columnMap[status] || []}
          colorMap={statusColors}
          draggingId={draggingId}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}
