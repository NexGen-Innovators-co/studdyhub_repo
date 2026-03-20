import * as React from "react"
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarousel() {
  const context = React.useContext(CarouselContext)

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }

  return context
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref
  ) => {
    // sensible defaults: center align, snap one slide per scroll, contain trimmed snaps
    const defaultOpts: CarouselOptions = React.useMemo(() => {
      if (orientation === "horizontal") {
        return {
          align: "center",
          containScroll: "trimSnaps",
          slidesToScroll: 1,
          loop: true,
        } as CarouselOptions
      }
      return {
        align: "start",
        containScroll: "trimSnaps",
        slidesToScroll: 1,
        loop: true,
      } as CarouselOptions
    }, [orientation])

    const mergedOpts = React.useMemo(() => ({
      ...defaultOpts,
      ...(opts || {}),
      axis: orientation === "horizontal" ? "x" : "y",
    }), [defaultOpts, opts, orientation])

    const [carouselRef, api] = useEmblaCarousel(mergedOpts as CarouselOptions, plugins)
    const [canScrollPrev, setCanScrollPrev] = React.useState(false)
    const [canScrollNext, setCanScrollNext] = React.useState(false)
    const [isHovered, setIsHovered] = React.useState(false)
    const [isInteracting, setIsInteracting] = React.useState(false)
    const interactionTimeout = React.useRef<number | null>(null)

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) {
        return
      }

      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }, [])

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev()
    }, [api])

    const scrollNext = React.useCallback(() => {
      api?.scrollNext()
    }, [api])

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          scrollPrev()
        } else if (event.key === "ArrowRight") {
          event.preventDefault()
          scrollNext()
        }
      },
      [scrollPrev, scrollNext]
    )

    React.useEffect(() => {
      if (!api || !setApi) {
        return
      }

      setApi(api)
    }, [api, setApi])

    const lastWheel = React.useRef<number>(0)

    React.useEffect(() => {
      if (!api) {
        return
      }

      onSelect(api)
      api.on("reInit", onSelect)
      api.on("select", onSelect)

      return () => {
        api?.off("select", onSelect)
      }
    }, [api, onSelect])


    // Autoplay: advance when not hovered or interacting. Default interval 4000ms.
    React.useEffect(() => {
      if (!api) return

      const intervalMs = (opts as any)?.autoplayInterval ?? 4000

      let timer: number | null = null

      const start = () => {
        if (timer != null) return
        timer = window.setInterval(() => {
          if (!api) return
          if (isHovered || isInteracting) return
          // scrollNext wraps when loop enabled; otherwise will stop at end
          api.scrollNext()
        }, intervalMs)
      }

      const stop = () => {
        if (timer != null) {
          window.clearInterval(timer)
          timer = null
        }
      }

      start()

      return () => {
        stop()
      }
    }, [api, isHovered, isInteracting, opts])

    const rootRef = React.useRef<HTMLDivElement | null>(null)

    // Provide a merged ref so the forwarded ref and our local ref both point to the same node
    const setRootRef = React.useCallback((node: HTMLDivElement | null) => {
      rootRef.current = node
      if (!ref) return
      if (typeof ref === 'function') {
        try { ref(node) } catch {}
      } else {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      }
    }, [ref])

    // Attach a native, non-passive wheel listener so we can call preventDefault safely
    React.useEffect(() => {
      const el = rootRef.current
      if (!el || !api) return

      const handler = (e: WheelEvent) => {
        const now = Date.now()
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
        if (now - lastWheel.current < 600) return
        if (delta > 0) {
          api.scrollNext()
        } else if (delta < 0) {
          api.scrollPrev()
        }
        lastWheel.current = now
        e.preventDefault()
      }

      el.addEventListener('wheel', handler as EventListener, { passive: false })
      return () => {
        el.removeEventListener('wheel', handler as EventListener)
      }
    }, [api])

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation:
            orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={setRootRef}
          onKeyDownCapture={handleKeyDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onPointerDown={() => {
            setIsInteracting(true)
            if (interactionTimeout.current) {
              window.clearTimeout(interactionTimeout.current)
            }
            interactionTimeout.current = window.setTimeout(() => {
              setIsInteracting(false)
              interactionTimeout.current = null
            }, 2500)
          }}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    )
  }
)
Carousel.displayName = "Carousel"

const CarouselContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { carouselRef, orientation } = useCarousel()

  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className
        )}
        {...props}
      />
    </div>
  )
})
CarouselContent.displayName = "CarouselContent"

const CarouselItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { orientation } = useCarousel()

  return (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className
      )}
      {...props}
    />
  )
})
CarouselItem.displayName = "CarouselItem"

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute  h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-left-12 top-1/2 -translate-y-1/2"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="sr-only">Previous slide</span>
    </Button>
  )
})
CarouselPrevious.displayName = "CarouselPrevious"

const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-right-12 top-1/2 -translate-y-1/2"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRight className="h-4 w-4" />
      <span className="sr-only">Next slide</span>
    </Button>
  )
})
CarouselNext.displayName = "CarouselNext"

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
}
