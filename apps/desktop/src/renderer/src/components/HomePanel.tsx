import {
  ClipboardEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  Ellipsis,
  FolderPlus,
  Loader2,
  Trash2,
  UserRound,
} from "lucide-react";
import type {
  CodexMonitorState,
  CodexMonitorNotePatch,
  NoteRecord,
  NoteTranscriptionStatus,
  SaveNoteTranscriptionInput,
} from "@marshall/shared";
import { Button } from "./ui/button";
import { CodexMonitorDebugPanel } from "./CodexMonitorDebugPanel";
import { FloatingTranscriptionRecorder } from "./FloatingTranscriptionRecorder";
import {
  applyCodexNotePatch,
  DIVIDER_BLOCK_CLASS,
  extractPlainTextFromHtml,
  getBlockClassName,
  normalizeEditorHtml,
  PARAGRAPH_BLOCK_CLASS,
  renderInlineMarkdown,
  textToParagraphHtml,
  type MarkdownBlockType,
} from "../lib/note-body";
import { PlanMeetingModal } from "./PlanMeetingModal";
import { MARSHALL_EVENTS } from "../constants";

interface LegacyQuickNote {
  id: number;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  trashedAt: number | null;
}

const QUICK_NOTES_STORAGE_KEY = "marshall.quick-notes";

const METADATA_CHIP_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground";

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function resolveTranscriptionTargetNoteId({
  activeNoteId,
  currentTargetNoteId,
  sessionActive,
}: {
  activeNoteId: string | null;
  currentTargetNoteId: string | null;
  sessionActive: boolean;
}) {
  if (!activeNoteId) {
    return currentTargetNoteId;
  }

  if (sessionActive && currentTargetNoteId) {
    return currentTargetNoteId;
  }

  return activeNoteId;
}

function formatTimestamp(timestamp: number) {
  return timestampFormatter.format(timestamp);
}

function formatStoredTimestamp(timestamp: string | number) {
  return typeof timestamp === "number"
    ? formatTimestamp(timestamp)
    : formatTimestamp(Date.parse(timestamp));
}

function loadStoredNotes(): LegacyQuickNote[] {
  if (typeof window === "undefined") {
    return [];
  }

  const storedNotes = window.localStorage.getItem(QUICK_NOTES_STORAGE_KEY);
  if (!storedNotes) {
    return [];
  }

  try {
    const parsedNotes = JSON.parse(storedNotes);
    if (!Array.isArray(parsedNotes)) {
      return [];
    }

    return parsedNotes.flatMap((note) => {
      if (
        typeof note?.id !== "number" ||
        typeof note?.title !== "string" ||
        typeof note?.body !== "string" ||
        typeof note?.createdAt !== "number" ||
        typeof note?.updatedAt !== "number"
      ) {
        return [];
      }

      const migratedBody = note.body.includes("<")
        ? note.body
        : textToParagraphHtml(note.body.replace(/\r\n/g, "\n"));

      return [
        {
          id: note.id,
          title: note.title,
          body: migratedBody,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          trashedAt: typeof note.trashedAt === "number" ? note.trashedAt : null,
        },
      ];
    });
  } catch {
    return [];
  }
}

function summarizeBody(body: string) {
  const normalized = extractPlainTextFromHtml(body).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Write notes...";
  }

  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function focusEditableAtEnd(element: HTMLDivElement) {
  element.focus();

  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setEditableHtml(element: HTMLDivElement, value: string) {
  if (normalizeEditorHtml(element.innerHTML) === normalizeEditorHtml(value)) {
    return;
  }

  element.innerHTML = value;
}

function insertPlainTextAtSelection(text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function findEditorBlock(editor: HTMLDivElement, node: Node | null): HTMLElement | null {
  let currentNode = node;

  while (currentNode && currentNode !== editor) {
    if (currentNode instanceof HTMLElement && currentNode.parentElement === editor) {
      return currentNode;
    }
    currentNode = currentNode.parentNode;
  }

  return null;
}

function applyBlockType(block: HTMLElement, type: MarkdownBlockType, text: string) {
  block.dataset.mdType = type;
  block.className = getBlockClassName(type);
  block.innerHTML = renderInlineMarkdown(text) || "<br>";
}

function insertParagraphAfter(target: HTMLElement) {
  const paragraph = document.createElement("div");
  paragraph.dataset.mdType = "paragraph";
  paragraph.className = PARAGRAPH_BLOCK_CLASS;
  paragraph.innerHTML = "<br>";
  target.insertAdjacentElement("afterend", paragraph);
  focusEditableAtEnd(paragraph as HTMLDivElement);
}

function isActiveTranscriptionStatus(status: NoteTranscriptionStatus | null | undefined) {
  return status === "recording" || status === "transcribing";
}

export function getFloatingRecorderNote(
  notes: NoteRecord[],
  activeNoteId: string | null
): NoteRecord | null {
  const activeTranscriptionNote =
    notes.find(
      (note) =>
        note.trashedAt === null && isActiveTranscriptionStatus(note.transcription?.status ?? null)
    ) ?? null;

  if (activeTranscriptionNote) {
    return activeTranscriptionNote;
  }

  return notes.find((note) => note.id === activeNoteId && note.trashedAt === null) ?? null;
}

export function getTranscriptionLaunchNote(
  notes: NoteRecord[],
  activeNoteId: string | null
): NoteRecord | null {
  return getFloatingRecorderNote(notes, activeNoteId);
}

export function HomePanel() {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [showPlanMeetingModal, setShowPlanMeetingModal] = useState(false);
  const [autoStartRecorderRequest, setAutoStartRecorderRequest] = useState<{
    noteId: string;
    token: number;
  } | null>(null);
  const [codexMonitorState, setCodexMonitorState] = useState<CodexMonitorState>({
    status: "idle",
    noteId: null,
    noteTitle: null,
    nudge: null,
    items: [],
    summary: null,
    chatMessages: [],
    lastAnalyzedAt: null,
    error: null,
    debug: {
      transcriptionStatus: null,
      transcriptLength: 0,
      checklistItemCount: 0,
      sessionUpdatedAt: null,
      pendingAnalysis: false,
      analysisInFlight: false,
      analysisCount: 0,
      lastMode: null,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastOutcome: null,
      lastPromptPreview: null,
      lastResponsePreview: null,
    },
  });
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pendingNoteUpdatesRef = useRef<Record<string, { title?: string; body?: string }>>({});
  const noteSaveTimersRef = useRef<Record<string, number>>({});

  const applySavedNote = useCallback((savedNote: NoteRecord) => {
    setNotes((currentNotes) => {
      const existingIndex = currentNotes.findIndex((note) => note.id === savedNote.id);
      const nextNotes = [...currentNotes];

      if (existingIndex === -1) {
        nextNotes.unshift(savedNote);
      } else {
        nextNotes[existingIndex] = savedNote;
      }

      return nextNotes.sort(
        (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      );
    });
  }, []);

  const migrateLegacyNotes = useCallback(async () => {
    const legacyNotes = loadStoredNotes();
    if (legacyNotes.length === 0) {
      return [];
    }

    const migratedNotes = await Promise.all(
      legacyNotes.map((note) =>
        window.notesAPI.create({
          title: note.title,
          body: note.body,
          createdAt: new Date(note.createdAt).toISOString(),
          updatedAt: new Date(note.updatedAt).toISOString(),
          trashedAt: note.trashedAt ? new Date(note.trashedAt).toISOString() : null,
        })
      )
    );

    window.localStorage.removeItem(QUICK_NOTES_STORAGE_KEY);
    return migratedNotes;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadNotes = async () => {
      setIsLoadingNotes(true);
      setNotesError(null);

      try {
        let loadedNotes = await window.notesAPI.list();
        if (loadedNotes.length === 0) {
          loadedNotes = await migrateLegacyNotes();
        }

        if (!cancelled) {
          setNotes(loadedNotes);
        }
      } catch (error) {
        if (!cancelled) {
          setNotesError(error instanceof Error ? error.message : "Failed to load notes");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingNotes(false);
        }
      }
    };

    void loadNotes();

    return () => {
      cancelled = true;
    };
  }, [migrateLegacyNotes]);

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId && note.trashedAt === null) ?? null,
    [notes, activeNoteId]
  );
  const recorderNote = useMemo(
    () => getFloatingRecorderNote(notes, activeNoteId),
    [notes, activeNoteId]
  );
  const recorderNoteId = recorderNote?.id ?? activeNote?.id ?? null;
  const visibleNotes = useMemo(() => notes.filter((note) => note.trashedAt === null), [notes]);

  useEffect(() => {
    if (openMenuId === null) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[data-note-menu-root='true']")) {
        return;
      }

      setOpenMenuId(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [openMenuId]);

  useEffect(() => {
    if (!activeNote) {
      return;
    }

    if (titleRef.current && titleRef.current.textContent !== activeNote.title) {
      titleRef.current.textContent = activeNote.title;
    }

    if (bodyRef.current) {
      setEditableHtml(bodyRef.current, activeNote.body);
    }
  }, [activeNote]);

  useEffect(() => {
    if (activeNoteId === null || !bodyRef.current) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      if (bodyRef.current) {
        focusEditableAtEnd(bodyRef.current);
      }
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeNoteId]);

  const noteCountLabel =
    visibleNotes.length === 1 ? "1 note captured" : `${visibleNotes.length} notes captured`;

  const openNote = (noteId: string) => {
    setOpenMenuId(null);
    setActiveNoteId(noteId);
  };

  const flushPendingNoteUpdate = useCallback(
    async (noteId: string) => {
      const pending = pendingNoteUpdatesRef.current[noteId];
      if (!pending) {
        return;
      }

      delete pendingNoteUpdatesRef.current[noteId];
      delete noteSaveTimersRef.current[noteId];

      try {
        const savedNote = await window.notesAPI.update(noteId, pending);
        applySavedNote(savedNote);
      } catch (error) {
        setNotesError(error instanceof Error ? error.message : "Failed to save note");
      }
    },
    [applySavedNote]
  );

  const scheduleNoteUpdate = useCallback(
    (noteId: string, update: { title?: string; body?: string }) => {
      pendingNoteUpdatesRef.current[noteId] = {
        ...pendingNoteUpdatesRef.current[noteId],
        ...update,
      };

      const existingTimer = noteSaveTimersRef.current[noteId];
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      noteSaveTimersRef.current[noteId] = window.setTimeout(() => {
        void flushPendingNoteUpdate(noteId);
      }, 400);
    },
    [flushPendingNoteUpdate]
  );

  useEffect(() => {
    return () => {
      Object.values(noteSaveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      Object.keys(pendingNoteUpdatesRef.current).forEach((noteId) => {
        void flushPendingNoteUpdate(noteId);
      });
    };
  }, [flushPendingNoteUpdate]);

  const createNote = useCallback(
    async (options?: { title?: string; body?: string }) => {
      setIsCreatingNote(true);
      setNotesError(null);

      try {
        const note = await window.notesAPI.create(options);
        setOpenMenuId(null);
        applySavedNote(note);
        setActiveNoteId(note.id);
        return note;
      } catch (error) {
        setNotesError(error instanceof Error ? error.message : "Failed to create note");
        return null;
      } finally {
        setIsCreatingNote(false);
      }
    },
    [applySavedNote]
  );

  // Listen for create note events from call notifications
  useEffect(() => {
    const handleCreateNote = (event: CustomEvent<{ title: string }>) => {
      void createNote({ title: event.detail.title });
    };

    window.addEventListener(MARSHALL_EVENTS.CREATE_NOTE, handleCreateNote as EventListener);

    return () => {
      window.removeEventListener(MARSHALL_EVENTS.CREATE_NOTE, handleCreateNote as EventListener);
    };
  }, [createNote]);

  const handleStartTranscriptionRequest = useCallback(
    async (title?: string) => {
      const targetNote = getTranscriptionLaunchNote(notes, activeNoteId);

      if (targetNote) {
        setActiveNoteId(targetNote.id);
        setAutoStartRecorderRequest({ noteId: targetNote.id, token: Date.now() });
        return;
      }

      const createdNote = await createNote({ title: title?.trim() || "Call Notes" });
      if (!createdNote) {
        return;
      }

      setAutoStartRecorderRequest({ noteId: createdNote.id, token: Date.now() });
    },
    [activeNoteId, createNote, notes]
  );

  useEffect(() => {
    const handleStartTranscription = (event: CustomEvent<{ title?: string }>) => {
      void handleStartTranscriptionRequest(event.detail?.title);
    };

    window.addEventListener(
      MARSHALL_EVENTS.START_TRANSCRIPTION,
      handleStartTranscription as EventListener
    );

    return () => {
      window.removeEventListener(
        MARSHALL_EVENTS.START_TRANSCRIPTION,
        handleStartTranscription as EventListener
      );
    };
  }, [handleStartTranscriptionRequest]);

  useEffect(() => {
    let mounted = true;

    window.codexMonitorAPI
      ?.getState()
      .then((state) => {
        if (mounted) {
          setCodexMonitorState(state);
        }
      })
      .catch(() => {
        // Ignore initial debug load failures.
      });

    const cleanup = window.codexMonitorAPI?.onState((state) => {
      setCodexMonitorState(state);
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!window.codexMonitorAPI) {
      return;
    }

    const handleNotePatch = (patch: CodexMonitorNotePatch) => {
      if (patch.noteId !== activeNoteId) {
        return;
      }

      const currentHtml = bodyRef.current?.innerHTML ?? activeNote?.body ?? "";
      const nextHtml = applyCodexNotePatch(currentHtml, patch);
      if (normalizeEditorHtml(nextHtml) === normalizeEditorHtml(currentHtml)) {
        return;
      }

      if (bodyRef.current) {
        setEditableHtml(bodyRef.current, nextHtml);
      }

      updateActiveNote("body", nextHtml);
    };

    return window.codexMonitorAPI.onNotePatch(handleNotePatch);
  }, [activeNote?.body, activeNoteId]);

  const handlePlanGenerated = useCallback(
    (plan: string, title: string) => {
      setShowPlanMeetingModal(false);
      createNote({ title, body: textToParagraphHtml(plan) });
    },
    [createNote]
  );

  const moveNoteToTrash = async (noteId: string) => {
    const trashedAt = new Date().toISOString();
    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              trashedAt,
              updatedAt: trashedAt,
            }
          : note
      )
    );
    setOpenMenuId(null);
    if (activeNoteId === noteId) {
      setActiveNoteId(null);
    }

    try {
      const savedNote = await window.notesAPI.update(noteId, { trashedAt });
      applySavedNote(savedNote);
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : "Failed to move note to trash");
    }
  };

  const updateActiveNote = (field: "title" | "body", value: string) => {
    if (activeNoteId === null) {
      return;
    }

    setNotes((currentNotes) => {
      const target = currentNotes.find((note) => note.id === activeNoteId);
      if (!target || target[field] === value) {
        return currentNotes;
      }

      return currentNotes.map((note) =>
        note.id === activeNoteId
          ? {
              ...note,
              [field]: value,
              updatedAt: new Date().toISOString(),
            }
          : note
      );
    });

    scheduleNoteUpdate(activeNoteId, { [field]: value });
  };

  const handleSnapshotChange = useCallback(
    async (noteId: string, snapshot: SaveNoteTranscriptionInput) => {
      const now = new Date().toISOString();

      setNotes((currentNotes) =>
        currentNotes
          .map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  transcription: {
                    id: note.transcription?.id ?? `pending-${noteId}`,
                    noteId,
                    createdAt: note.transcription?.createdAt ?? now,
                    updatedAt: now,
                    ...snapshot,
                  },
                  updatedAt: now,
                }
              : note
          )
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      );

      try {
        const savedSnapshot = await window.notesAPI.saveTranscription(noteId, snapshot);
        setNotes((currentNotes) =>
          currentNotes
            .map((note) =>
              note.id === noteId
                ? {
                    ...note,
                    transcription: savedSnapshot,
                    updatedAt: now,
                  }
                : note
            )
            .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        );
      } catch (error) {
        setNotesError(error instanceof Error ? error.message : "Failed to save transcription");
      }
    },
    []
  );

  const handleRecorderSnapshotChange = useCallback(
    (snapshot: SaveNoteTranscriptionInput) => {
      if (!recorderNoteId) {
        return;
      }

      return handleSnapshotChange(recorderNoteId, snapshot);
    },
    [handleSnapshotChange, recorderNoteId]
  );

  const handleAutoStartRecorderHandled = useCallback((token: number) => {
    setAutoStartRecorderRequest((current) => (current?.token === token ? null : current));
  }, []);

  const syncBodyHtml = () => {
    if (!bodyRef.current) {
      return;
    }

    updateActiveNote("body", normalizeEditorHtml(bodyRef.current.innerHTML));
  };

  const handleBodyPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData("text/plain");
    insertPlainTextAtSelection(pastedText);
    window.requestAnimationFrame(syncBodyHtml);
  };

  const handleBodyKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!bodyRef.current) {
      return;
    }

    const selection = window.getSelection();
    const currentBlock = findEditorBlock(bodyRef.current, selection?.anchorNode ?? null);
    if (!currentBlock) {
      return;
    }

    const blockText = currentBlock.innerText.replace(/\r\n/g, "\n").trim();

    if (event.key === " " && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      if (blockText === "#") {
        event.preventDefault();
        applyBlockType(currentBlock, "heading-1", "");
        syncBodyHtml();
        return;
      }

      if (blockText === "##") {
        event.preventDefault();
        applyBlockType(currentBlock, "heading-2", "");
        syncBodyHtml();
        return;
      }

      if (blockText === "-" || blockText === "*") {
        event.preventDefault();
        applyBlockType(currentBlock, "bullet", "");
        syncBodyHtml();
        return;
      }

      if (blockText === ">") {
        event.preventDefault();
        applyBlockType(currentBlock, "quote", "");
        syncBodyHtml();
        return;
      }
    }

    if (event.key === "Enter" && blockText === "---") {
      event.preventDefault();
      const divider = document.createElement("hr");
      divider.className = DIVIDER_BLOCK_CLASS;
      divider.dataset.mdType = "divider";
      currentBlock.replaceWith(divider);
      insertParagraphAfter(divider);
      syncBodyHtml();
      return;
    }

    if (
      event.key === " " &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      /(\*\*[^*]+\*\*|`[^`]+`|(^|[^*])\*[^*]+\*(?!\*))/.test(blockText)
    ) {
      window.requestAnimationFrame(() => {
        currentBlock.innerHTML = renderInlineMarkdown(currentBlock.innerText);
        focusEditableAtEnd(currentBlock as HTMLDivElement);
        syncBodyHtml();
      });
    }
  };

  if (activeNote) {
    return (
      <>
        <div className="flex min-h-full flex-1 flex-col overflow-hidden">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Button type="button" variant="ghost" onClick={() => setActiveNoteId(null)}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Button>
            <p className="text-2xs tracking-wide text-muted-foreground/70">
              Updated {formatStoredTimestamp(activeNote.updatedAt)}
            </p>
          </div>

          <div className="flex-1 overflow-auto rounded-2xl bg-card/70 px-12 py-10 shadow-soft">
            <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
              <div className="relative min-h-[2.75rem]">
                {!activeNote.title.trim() && (
                  <div className="pointer-events-none absolute inset-0 font-serif text-[1.75rem] font-medium leading-tight text-muted-foreground/30">
                    New note
                  </div>
                )}
                <div
                  ref={titleRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label="Note title"
                  className="relative min-h-[2.75rem] font-serif text-[1.75rem] font-medium leading-tight tracking-[-0.01em] text-foreground outline-none"
                  onInput={(event) =>
                    updateActiveNote("title", event.currentTarget.textContent ?? "")
                  }
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button type="button" className={METADATA_CHIP_CLASS}>
                  <CalendarDays className="h-3 w-3" />
                  <span>Date</span>
                  <span className="font-medium text-foreground">Today</span>
                </button>
                <button type="button" className={METADATA_CHIP_CLASS}>
                  <UserRound className="h-3 w-3" />
                  <span>Attendees</span>
                  <span className="font-medium text-foreground">Me</span>
                </button>
                <button
                  type="button"
                  className={`${METADATA_CHIP_CLASS} border-dashed bg-background/50`}
                >
                  <FolderPlus className="h-3 w-3" />
                  <span>Add Folder</span>
                </button>
                <button
                  type="button"
                  className={`${METADATA_CHIP_CLASS} border-dashed bg-background/50`}
                  onClick={() => setShowPlanMeetingModal(true)}
                >
                  <CalendarPlus className="h-3 w-3" />
                  <span>+ Plan Meeting</span>
                </button>
              </div>

              <div className="relative mt-10 min-h-[20rem] flex-1">
                {!extractPlainTextFromHtml(activeNote.body).trim() && (
                  <div className="pointer-events-none absolute inset-0 text-[0.9375rem] leading-[1.85] text-muted-foreground/30">
                    Write notes...
                  </div>
                )}
                <div
                  ref={bodyRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label="Note body"
                  className="relative min-h-[20rem] whitespace-pre-wrap text-[0.9375rem] leading-[1.85] text-foreground/90 outline-none"
                  onInput={syncBodyHtml}
                  onKeyDown={handleBodyKeyDown}
                  onPaste={handleBodyPaste}
                />
              </div>

              <CodexMonitorDebugPanel
                state={codexMonitorState}
                noteId={activeNote.id}
                transcription={activeNote.transcription}
              />
            </div>
          </div>
        </div>
        <FloatingTranscriptionRecorder
          noteId={recorderNote?.id ?? activeNote.id}
          autoStartToken={
            autoStartRecorderRequest?.noteId === (recorderNote?.id ?? activeNote.id)
              ? autoStartRecorderRequest.token
              : null
          }
          onAutoStartHandled={handleAutoStartRecorderHandled}
          noteBodyHtml={recorderNote?.body ?? activeNote.body}
          noteTitle={recorderNote?.title ?? activeNote.title}
          persistedSnapshot={recorderNote?.transcription ?? activeNote.transcription}
          onSnapshotChange={handleRecorderSnapshotChange}
        />
        {showPlanMeetingModal && (
          <PlanMeetingModal
            onClose={() => setShowPlanMeetingModal(false)}
            onPlanGenerated={handlePlanGenerated}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex min-h-full flex-1 flex-col">
        <div className="flex items-start justify-between gap-6 border-b border-border/50 pb-6">
          <div className="space-y-3">
            <p className="text-2xs font-medium uppercase tracking-[0.2em] text-muted-foreground/80">
              Welcome to Marshall
            </p>
            <div className="space-y-2">
              <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
                Keep important context within reach
              </h1>
              <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                Capture a quick note before, during, or after a call so the important detail does
                not get lost.
              </p>
            </div>
          </div>

          <Button type="button" className="shrink-0" onClick={() => createNote()}>
            <span>{isCreatingNote ? "Creating..." : "+ Quick Note"}</span>
          </Button>
        </div>

        <div className="grid flex-1 gap-6 pt-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div className="space-y-3">
            {isLoadingNotes ? (
              <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-8 py-12">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading notes...</span>
                </div>
              </div>
            ) : visibleNotes.length > 0 ? (
              visibleNotes.map((note) => (
                <article
                  key={note.id}
                  className="rounded-xl border border-border/60 bg-card/90 px-5 py-4 shadow-soft transition-all hover:border-border hover:bg-card hover:shadow-lifted"
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => openNote(note.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="truncate font-serif text-base font-medium text-foreground">
                          {note.title.trim() || "New note"}
                        </p>
                        <p className="shrink-0 text-2xs tracking-wide text-muted-foreground/70">
                          {formatStoredTimestamp(note.updatedAt)}
                        </p>
                      </div>
                      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                        {summarizeBody(note.body)}
                      </p>
                    </button>

                    <div className="relative shrink-0" data-note-menu-root="true">
                      <button
                        type="button"
                        aria-label="Note actions"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        onClick={() =>
                          setOpenMenuId((currentMenuId) =>
                            currentMenuId === note.id ? null : note.id
                          )
                        }
                      >
                        <Ellipsis className="h-4 w-4" />
                      </button>

                      {openMenuId === note.id && (
                        <div className="absolute right-0 top-10 z-10 min-w-36 rounded-lg border border-border/70 bg-popover p-1 shadow-lifted">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-accent"
                            onClick={() => moveNoteToTrash(note.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Move to trash</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-8 py-12">
                <div className="max-w-xs text-center">
                  <p className="font-serif text-base font-medium text-foreground">No notes yet</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Use the + Quick Note button in the top right to open a fresh note document.
                  </p>
                </div>
              </div>
            )}

            {notesError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {notesError}
              </div>
            )}
          </div>

          <aside className="h-fit rounded-xl border border-border/60 bg-card/70 p-5 shadow-soft">
            <p className="text-2xs font-medium uppercase tracking-[0.2em] text-muted-foreground/80">
              Home
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <p className="text-2xs tracking-wide text-muted-foreground">Quick note status</p>
                <p className="mt-1.5 font-serif text-lg font-medium text-foreground">
                  {noteCountLabel}
                </p>
              </div>

              <div className="rounded-lg border border-border/50 px-4 py-3">
                <p className="text-xs font-medium text-foreground">Suggested use</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Open a note when you need a blank page for context, decisions, or follow-ups.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
      {recorderNote && (
        <FloatingTranscriptionRecorder
          autoStartToken={
            autoStartRecorderRequest?.noteId === recorderNote.id
              ? autoStartRecorderRequest.token
              : null
          }
          onAutoStartHandled={handleAutoStartRecorderHandled}
          noteId={recorderNote.id}
          noteBodyHtml={recorderNote.body}
          noteTitle={recorderNote.title}
          persistedSnapshot={recorderNote.transcription}
          onSnapshotChange={handleRecorderSnapshotChange}
        />
      )}
    </>
  );
}
