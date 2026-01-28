import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

interface ScrollAreaProps
  extends React.ComponentProps<typeof ScrollAreaPrimitive.Root> {
  classNames?: {
    root?: string;
    viewport?: string;
    scrollbar?: string;
    thumb?: string;
    corner?: string;
  };
  viewportRef?: React.RefObject<HTMLDivElement | null>;
}

function ScrollArea({ classNames, children, viewportRef, ...props }: ScrollAreaProps) {
  const internalViewportRef = React.useRef<HTMLDivElement>(null);
  const viewportElement = viewportRef || internalViewportRef;

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", classNames?.root)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportElement as React.RefObject<HTMLDivElement>}
        data-slot="scroll-area-viewport"
        className={cn(
          "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
          classNames?.viewport,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar
        classNames={{ root: classNames?.scrollbar, thumb: classNames?.thumb }}
      />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

interface ScrollBarProps
  extends React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> {
  classNames?: {
    root?: string;
    thumb?: string;
  };
}

function ScrollBar({
  classNames,
  orientation = "vertical",
  ...props
}: ScrollBarProps) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent flex touch-none p-px transition-colors select-none",
        classNames?.root,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={cn(
          "rounded-full bg-border relative flex-1",
          classNames?.thumb,
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
