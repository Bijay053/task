import { useState, useRef, useCallback } from "react";
import { useUpdateApplication } from "@workspace/api-client-react";
import { GS_STATUS_COLORS, GS_STATUS_CHOICES } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical, User, BookOpen, Calendar, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Application {
  id: number;
  app_id?: string | null;
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
    if (onCardClick) { e.stopPropagation(); onCardClick(app); }
  };

  const studentName = app.student?.full_name || app.student_name || "Unknown Student";
  const uniName = app.university?.name || app.university_name || null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, app.id)}
      onClick={handleClick}
      className={cn(
        "bg-card border border-border rounded-xl p-3 shadow-sm select-none transition-all",
        "hover:shadow-md hover:border-primary/30 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 scale-95 ring-2 ring-primary/40",
        onCardClick && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-[160px]"
            style={{ backgroundColor: color.bg + "33", color: color.text }}
          >
            {app.application_status}
          </span>
          {app.app_id && (
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 truncate max-w-[100px]" title={app.app_id}>
              {app.app_id}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <PriorityDot priority={app.priority ?? undefined} />
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30" />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-1.5">
          <User className="w-3.5 h-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
          <span className="text-sm font-semibold leading-tight line-clamp-1">{studentName}</span>
        </div>

        {uniName && (
          <div className="flex items-start gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
            <span className="text-xs text-muted-foreground leading-tight line-clamp-2">{uniName}</span>
          </div>
        )}

        {app.course && (
          <div className="text-xs text-muted-foreground/70 line-clamp-1 pl-5">{app.course}</div>
        )}

        <div className="flex items-center gap-3 pt-1">
          {app.intake && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
              <Calendar className="w-3 h-3" />
              {app.intake}
            </div>
          )}
          {(app.agent?.name || app.channel) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
              <UserCheck className="w-3 h-3" />
              <span className="truncate max-w-[80px]">{app.agent?.name || app.channel}</span>
            </div>
          )}
        </div>

        {app.assigned_to?.full_name && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
              {app.assigned_to.full_name.charAt(0)}
            </div>
            <span className="text-xs text-muted-foreground truncate">{app.assigned_to.full_name}</span>
          </div>
        )}
        {!app.assigned_to?.full_name && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-muted-foreground/40" />
            </div>
            <span className="text-xs text-muted-foreground/40 italic">Unassigned</span>
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanCardColumn({
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

  return (
    <div
      className={cn(
        "w-[290px] min-w-[290px] max-w-[290px] shrink-0 rounded-b-xl p-2 space-y-2 transition-colors",
        isOver ? "bg-primary/5 ring-2 ring-primary/30 ring-inset" : "bg-muted/40"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsOver(false); onDrop(status); }}
    >
      {cards.length === 0 && (
        <div className="flex items-center justify-center text-xs text-muted-foreground/40 italic select-none py-6">
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

  const headerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const onCardScroll = useCallback(() => {
    if (headerRef.current && cardRef.current) {
      headerRef.current.scrollLeft = cardRef.current.scrollLeft;
    }
  }, []);

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
    <div>
      {/* Sticky status header bar — outside the scroll container so sticky works */}
      <div
        ref={headerRef}
        className="sticky top-0 z-20 flex gap-3 mb-0"
        style={{ overflowX: "hidden" }}
      >
        {statusChoices.map((status) => {
          const color = statusColors[status] || { bg: "#f1f5f9", text: "#64748b" };
          const count = columnMap[status]?.length ?? 0;
          return (
            <div
              key={status}
              className="w-[290px] min-w-[290px] max-w-[290px] shrink-0 flex items-center justify-between px-3 py-2.5 rounded-t-xl font-semibold text-xs uppercase tracking-wide"
              style={{ backgroundColor: color.bg, color: color.text }}
            >
              <span className="truncate">{status}</span>
              <span
                className="ml-2 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: color.text + "22", color: color.text }}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Card columns — scrolls horizontally, grows vertically */}
      <div
        ref={cardRef}
        className="flex gap-3 pb-2 items-start kanban-scroll"
        style={{ overflowX: "auto" }}
        onScroll={onCardScroll}
        onDragEnd={handleDragEnd}
      >
        {statusChoices.map((status) => (
          <KanbanCardColumn
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
    </div>
  );
}
