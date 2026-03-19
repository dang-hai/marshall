import { useState } from "react";

const WAVE_BARS = [2, 6, 8, 6, 2] as const;

const PILL_ANIMATION_CSS = `
@keyframes micro-wave {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4), inset 0 0 0 1px rgba(52, 211, 153, 0.15); }
  50% { box-shadow: 0 0 8px 2px rgba(52, 211, 153, 0.25), inset 0 0 0 1px rgba(52, 211, 153, 0.3); }
}

.micro-wave-bar {
  animation: micro-wave 0.8s ease-in-out infinite;
  transform-origin: center;
}

.pill-pulse {
  animation: pulse-ring 2s ease-in-out infinite;
}
`;

export interface FloatingOverlayPillProps {
  isActive: boolean;
}

function MicroWave({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex h-[8px] items-center justify-center gap-[1.5px]">
      {WAVE_BARS.map((height, i) => (
        <span
          key={i}
          className={isActive ? "micro-wave-bar" : ""}
          style={{
            animationDelay: isActive ? `${i * 0.08}s` : undefined,
            backgroundColor: isActive ? "#34d399" : "#78716c",
            borderRadius: "1px",
            display: "block",
            height: `${height}px`,
            width: "1.5px",
            transition: "background-color 0.2s ease",
          }}
        />
      ))}
    </div>
  );
}

function DragHandle({ visible }: { visible: boolean }) {
  return (
    <div
      className="flex w-full flex-col items-center gap-[2px] rounded-b-full bg-stone-800 transition-all duration-200"
      style={{
        maxHeight: visible ? 20 : 0,
        opacity: visible ? 1 : 0,
        paddingTop: visible ? 6 : 0,
        paddingBottom: visible ? 6 : 0,
        overflow: "hidden",
      }}
    >
      <span className="h-[2px] w-3 rounded-full bg-stone-500" />
      <span className="h-[2px] w-3 rounded-full bg-stone-500" />
    </div>
  );
}

function MarshallLogo() {
  return (
    <svg
      className="h-4 w-4 text-stone-300"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

export function FloatingOverlayPill({ isActive }: FloatingOverlayPillProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <div className="flex h-full w-full items-start justify-start p-1">
        <div
          aria-label={isActive ? "Marshall recorder active" : "Marshall recorder idle"}
          className={`app-drag flex w-9 select-none flex-col items-center overflow-hidden rounded-full bg-stone-900 shadow-lg ${
            isActive ? "pill-pulse" : ""
          }`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Main content */}
          <div className="flex flex-col items-center gap-3 py-4">
            <MarshallLogo />
            <MicroWave isActive={isActive} />
          </div>

          {/* Divider */}
          <div
            className="h-px w-full bg-stone-700 transition-opacity duration-150"
            style={{ opacity: isHovered ? 1 : 0 }}
          />

          {/* Drag handle section */}
          <DragHandle visible={isHovered} />
        </div>
      </div>

      <style>{PILL_ANIMATION_CSS}</style>
    </>
  );
}
