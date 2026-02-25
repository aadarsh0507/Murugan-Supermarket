import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const currentYear = new Date().getFullYear();
const DEFAULT_FROM_YEAR = currentYear - 100;
const DEFAULT_TO_YEAR = currentYear + 20;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  fromYear = DEFAULT_FROM_YEAR,
  toYear = DEFAULT_TO_YEAR,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      fromYear={fromYear}
      toYear={toYear}
      className={cn(
        "p-5 rounded-2xl border border-border/50 bg-gradient-to-b from-card to-card/95 shadow-lg shadow-black/5",
        "backdrop-blur-sm",
        className
      )}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-6 sm:space-x-6 sm:space-y-0",
        month: "space-y-5",
        caption:
          "flex justify-center gap-3 pt-1 relative items-center min-h-[44px] mb-4 pb-4 border-b border-border/40 bg-muted/20 -mx-1 px-3 py-2 rounded-lg",
        caption_label: captionLayout === "dropdown" || captionLayout === "dropdown-buttons" ? "sr-only" : "text-sm font-semibold text-foreground",
        caption_dropdowns: "flex gap-3 items-center justify-center flex-wrap",
        dropdown:
          "inline-flex items-center rounded-xl border border-input/80 bg-background/80 hover:bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 cursor-pointer shadow-sm",
        dropdown_month: "min-w-[9rem]",
        dropdown_year: "min-w-[6rem]",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-xl bg-muted/40 hover:bg-primary/15 hover:text-primary border-0 p-0 transition-all active:scale-95"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex border-0",
        head_cell:
          "text-muted-foreground w-11 h-9 flex items-center justify-center font-semibold text-[11px] uppercase tracking-widest text-foreground/60",
        row: "flex w-full mt-2 gap-px",
        cell: "h-11 w-11 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-full [&:has([aria-selected].day-outside)]:bg-accent/20 [&:has([aria-selected])]:bg-transparent first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-11 w-11 p-0 font-semibold rounded-full hover:bg-primary/15 hover:text-primary active:scale-95 transition-all duration-150 aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "!bg-primary !text-primary-foreground hover:!bg-primary hover:!text-primary-foreground focus:!bg-primary focus:!text-primary-foreground rounded-full shadow-lg shadow-primary/30 scale-105 ring-2 ring-primary ring-offset-2 ring-offset-card",
        day_today:
          "bg-primary/10 text-primary font-bold ring-2 ring-primary/40 ring-offset-2 ring-offset-card rounded-full",
        day_outside:
          "day-outside text-muted-foreground/50 rounded-full aria-selected:bg-accent/20 aria-selected:text-muted-foreground aria-selected:opacity-60",
        day_disabled: "text-muted-foreground/40 cursor-not-allowed rounded-full opacity-60",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground rounded-none",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
