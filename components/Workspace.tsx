"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { computeSquares } from "@/lib/computeSquares";
import { useTimerTick } from "@/lib/useTimerTick";
import { useStore, type AnyReceipt } from "@/lib/store";
import { TimerWidget } from "./timer/TimerWidget";
import { TaskList } from "./tasks/TaskList";
import { Receipt } from "./tray/Receipt";
import { ReceiptPrintStrip } from "./tray/ReceiptPrintStrip";
import { Tray } from "./tray/Tray";
import { PhotoCaptureModal } from "./photo/PhotoCaptureModal";
import { LoadingScreen } from "./LoadingScreen";
import { SoundEffects } from "./SoundEffects";

/**
 * Desktop keeps the two-column tray layout. Mobile gets a simpler stacked flow
 * because the 3D tray is not ready for narrow screens yet.
 */
export function Workspace() {
  const hydrated = useStore((s) => s.hasHydrated);
  const isMobile = useIsMobile();
  const [loadingDone, setLoadingDone] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(true);
  const handleLoadingComplete = useCallback(() => setLoadingDone(true), []);

  return (
    <>
      {hydrated && (
        <div className="h-screen w-screen overflow-hidden">
          {isMobile ? <MobileWorkspace /> : <DesktopWorkspace />}
          <PhotoCaptureModal />
          <SoundEffects />
          {isMobile && loadingDone && showMobileWarning && (
            <MobileWarningModal onClose={() => setShowMobileWarning(false)} />
          )}
        </div>
      )}
      {!loadingDone && (
        <LoadingScreen ready={hydrated} onComplete={handleLoadingComplete} />
      )}
    </>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : getIsMobileViewport(),
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(getIsMobileViewport());
    update();
    query.addEventListener("change", update);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      query.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return isMobile;
}

function getIsMobileViewport() {
  const viewportWidth = Math.min(
    window.innerWidth,
    window.visualViewport?.width ?? window.innerWidth,
    document.documentElement.clientWidth || window.innerWidth,
  );
  const screenWidth = window.screen?.width ?? viewportWidth;
  return viewportWidth <= 767 || screenWidth <= 767;
}

function DesktopWorkspace() {
  return (
    <div className="workspace-shell h-full w-full overflow-hidden">
      <div className="workspace-grid">
        <div className="workspace-left workspace-brand-cell">
          <Brand />
        </div>
        <div className="workspace-credit-cell relative min-w-0">
          <CreatedBy />
        </div>

        <div className="workspace-left workspace-controls-cell flex flex-col gap-8 min-h-0">
          <TimerWidget />
          <div className="workspace-task-list-wrap flex-1 min-h-0">
            <TaskList />
          </div>
        </div>
        <div className="workspace-tray-cell relative min-h-0 min-w-0 overflow-visible">
          <Tray />
        </div>
      </div>
    </div>
  );
}

type MobileView = "list" | "receipt";

function MobileWorkspace() {
  const pendingPhotoFor = useStore((s) => s.pendingPhotoFor);
  const cutReceipt = useStore((s) => s.cutReceipt);
  const [selectedView, setSelectedView] = useState<MobileView>("receipt");
  const view: MobileView = pendingPhotoFor || cutReceipt ? "receipt" : selectedView;

  return (
    <div className="mobile-workspace h-full w-full overflow-y-auto px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <Brand />
      </div>

      <TimerWidget />

      <div
        className="mobile-view-toggle shell-skeuo mt-5 grid grid-cols-2 rounded-full p-[3px] text-[11px] uppercase tracking-wider"
        role="tablist"
        aria-label="Mobile workspace view"
      >
        <MobileViewButton
          active={view === "list"}
          label="List"
          onClick={() => setSelectedView("list")}
        />
        <MobileViewButton
          active={view === "receipt"}
          label="Receipt"
          onClick={() => setSelectedView("receipt")}
        />
      </div>

      <div className="mt-5 min-h-[18rem]">
        {view === "list" ? (
          <TaskList />
        ) : (
          <MobileReceiptPanel onReceiptPrinted={() => setSelectedView("receipt")} />
        )}
      </div>
    </div>
  );
}

function MobileViewButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-9 rounded-full transition-colors ${
        active
          ? "bg-white text-[color:var(--color-ink)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
          : "text-[color:var(--color-muted)]"
      }`}
    >
      {label}
    </button>
  );
}

function MobileReceiptPanel({
  onReceiptPrinted,
}: {
  onReceiptPrinted: () => void;
}) {
  const now = useTimerTick();
  const currentTaskId = useStore((s) => s.currentTaskId);
  const tasks = useStore((s) => s.tasks);
  const cutReceipt = useStore((s) => s.cutReceipt);
  const receipts = useStore((s) => s.receipts);
  const finalizeComplete = useStore((s) => s.finalizeComplete);
  const clearLandingReceipt = useStore((s) => s.clearLandingReceipt);
  const finalizedCutKey = useRef<string | null>(null);

  const currentTask = tasks.find((task) => task.id === currentTaskId);
  const cutTaskTitle = cutReceipt
    ? tasks.find((task) => task.id === cutReceipt.taskId)?.title
    : undefined;
  const latestReceipt = [...receipts]
    .reverse()
    .find((receipt): receipt is AnyReceipt => receipt.kind !== "session");

  const finishMobileCut = useCallback(() => {
    if (!cutReceipt) return;
    const cutKey = `${cutReceipt.taskId}:${cutReceipt.frozenAt}`;
    if (finalizedCutKey.current === cutKey) return;
    finalizedCutKey.current = cutKey;
    finalizeComplete(cutReceipt.photoDataUrl ?? null);
    onReceiptPrinted();
    window.requestAnimationFrame(clearLandingReceipt);
  }, [clearLandingReceipt, cutReceipt, finalizeComplete, onReceiptPrinted]);

  let content: ReactNode = null;

  if (cutReceipt) {
    content = (
      <ReceiptPrintStrip
        taskStartedAt={cutReceipt.taskStartedAt}
        timeline={cutReceipt.timeline}
        upToTs={cutReceipt.frozenAt}
        squares={cutReceipt.squares}
        feedFromPrinter
        showTearTop={cutReceipt.isCut}
        showCutLine={cutReceipt.isCut}
        photoDataUrl={cutReceipt.photoDataUrl}
        printRevealPhoto={cutReceipt.isCut}
        taskTitle={cutTaskTitle}
        printedAt={cutReceipt.frozenAt}
        onCutComplete={finishMobileCut}
        responsiveWidth
        className="shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
      />
    );
  } else if (currentTask?.taskStartedAt) {
    const upToTs = Math.max(
      now ?? currentTask.taskStartedAt + 1,
      currentTask.taskStartedAt + 1,
    );
    content = (
      <ReceiptPrintStrip
        taskStartedAt={currentTask.taskStartedAt}
        timeline={currentTask.timeline}
        upToTs={upToTs}
        squares={computeSquares(
          currentTask.taskStartedAt,
          currentTask.timeline,
          upToTs,
        )}
        feedFromPrinter
        animate
        responsiveWidth
        className="shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
      />
    );
  } else if (latestReceipt) {
    content = <Receipt receipt={latestReceipt} responsiveWidth />;
  }

  return (
    <section className="mobile-receipt-panel flex min-h-[24rem] items-start justify-center rounded-[1.5rem] border border-[color:var(--color-shell-outline)]/70 bg-black/[0.03] px-3 py-5">
      {content ?? (
        <div className="pt-14 text-center text-[12px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          Start a task to print a receipt.
        </div>
      )}
    </section>
  );
}

function MobileWarningModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mobile experience warning"
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/45 px-4"
    >
      <div className="signoff-frame w-full max-w-[22rem] rounded-[2rem] p-5 text-center">
        <h2 className="text-[15px] uppercase tracking-[0.18em] text-[color:var(--color-ink)]">
          Heads up
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--color-ink)]/75">
          This is best experienced on your computer. The mobile version is still
          in progress.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="btn-skeuo mt-5 h-10 rounded-full px-6 text-[13px] text-[color:var(--color-ink)]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/logo.svg"
        alt="Task Receipts"
        width={2080}
        height={3294}
        unoptimized
        className="h-10 w-auto select-none"
        draggable={false}
      />
      <div className="text-[13px] tracking-[0.32em] uppercase text-[color:var(--color-ink)]/85">
        Task Receipts
      </div>
    </div>
  );
}

function CreatedBy() {
  return (
    <div className="absolute top-3 right-5 text-[10px] text-[color:var(--color-muted)] tracking-wider z-50">
      Created by suminstudio
    </div>
  );
}
