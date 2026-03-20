import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TableScrollWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function TableScrollWrapper({ children, className = "" }: TableScrollWrapperProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const t = setTimeout(updateArrows, 80);
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => { clearTimeout(t); el.removeEventListener("scroll", updateArrows); ro.disconnect(); };
  }, [updateArrows]);

  const scroll = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className={`relative flex-1 min-h-0 flex flex-col ${className}`}>
      {canScrollLeft && (
        <button
          onClick={() => scroll(-400)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-white border border-gray-300 shadow-md flex items-center justify-center text-gray-600 hover:bg-primary hover:text-white hover:border-primary transition-all"
          aria-label="Scroll table left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={() => scroll(400)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-white border border-gray-300 shadow-md flex items-center justify-center text-gray-600 hover:bg-primary hover:text-white hover:border-primary transition-all"
          aria-label="Scroll table right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <div ref={scrollRef} className="table-container flex-1 h-full border-0 rounded-none">
        {children}
      </div>
    </div>
  );
}
