"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AttrEditor, DEFAULT_ATTRS, type EditableAttrs } from "@/components/attr-editor";
import { ICamera, ICheck, ISparkle, IUpload, IX } from "@/components/icons";
import { BlobImg, Chip, PageHead, Spinner, useToast } from "@/components/ui";
import { aiCategorize } from "@/lib/ai-client";
import { detectColors } from "@/lib/colors";
import { db, uid } from "@/lib/db";
import { processUpload, type ProcessResult } from "@/lib/images";
import type { Item, Kind, Occasion, Season, StyleTag } from "@/lib/types";
import { KINDS, OCCASIONS, SEASONS, STYLES } from "@/lib/types";

type JobStatus = "queued" | "cutout" | "analyze" | "ready" | "saving" | "error";

interface Job {
  id: string;
  file: File;
  status: JobStatus;
  progress: { pct: number; stage: string } | null;
  result: ProcessResult | null;
  attrs: EditableAttrs;
  aiUsed: boolean;
  error?: string;
}

function cleanName(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "New piece";
}

const asKind = (v: unknown): Kind | null => (KINDS.includes(v as Kind) ? (v as Kind) : null);

export default function AddPage() {
  const toast = useToast();
  const [removeBgOpt, setRemoveBgOpt] = useState(true);
  const [aiOpt, setAiOpt] = useState(true);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const busyRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const next: Job[] = [...files]
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        id: uid(),
        file: f,
        status: "queued" as JobStatus,
        progress: null,
        result: null,
        aiUsed: false,
        attrs: { ...DEFAULT_ATTRS, name: cleanName(f.name), seasons: [...DEFAULT_ATTRS.seasons] },
      }));
    if (!next.length) return;
    setJobs((j) => [...j, ...next]);
  };

  const patchJob = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  // sequential processing queue
  useEffect(() => {
    const nextJob = jobs.find((j) => j.status === "queued");
    if (!nextJob || busyRef.current) return;
    busyRef.current = true;
    (async () => {
      const id = nextJob.id;
      try {
        patchJob(id, { status: "cutout", progress: { pct: 0, stage: "cutout" } });
        const result = await processUpload(nextJob.file, removeBgOpt, (pct, stage) =>
          patchJob(id, { progress: { pct, stage } }),
        );
        patchJob(id, { status: "analyze", result, progress: null });

        // local colour detection always runs
        let attrs = { ...nextJob.attrs };
        try {
          attrs.colors = await detectColors(result.thumb);
        } catch {
          /* keep default */
        }
        // optional AI tagging
        let aiUsed = false;
        if (aiOpt && aiAvailable !== false) {
          const ai = await aiCategorize(result.thumb);
          setAiAvailable(ai.available);
          if (ai.available) {
            aiUsed = true;
            const a = ai.attrs;
            attrs = {
              ...attrs,
              kind: asKind(a.kind) ?? attrs.kind,
              name: a.name || attrs.name,
              brand: (a as { brand?: string }).brand ?? attrs.brand,
              colors: Array.isArray(a.colors) && a.colors.length ? (a.colors as string[]).slice(0, 2) : attrs.colors,
              styles: Array.isArray(a.styles) && a.styles.length ? (a.styles as StyleTag[]).filter((s) => STYLES.includes(s)) : attrs.styles,
              seasons: Array.isArray(a.seasons) && a.seasons.length ? (a.seasons as Season[]).filter((s) => SEASONS.includes(s)) : attrs.seasons,
              occasions: Array.isArray(a.occasions) && a.occasions.length ? (a.occasions as Occasion[]).filter((o) => OCCASIONS.includes(o)) : attrs.occasions,
              warmth: typeof a.warmth === "number" ? Math.max(0, Math.min(3, Math.round(a.warmth))) : attrs.warmth,
              formality: typeof a.formality === "number" ? Math.max(0, Math.min(4, Math.round(a.formality))) : attrs.formality,
            };
          }
        }
        patchJob(id, { status: "ready", attrs, aiUsed });
      } catch (e) {
        console.error(e);
        patchJob(id, { status: "error", error: "Could not process this photo" });
      } finally {
        busyRef.current = false;
        setJobs((js) => [...js]); // re-trigger queue effect
      }
    })();
  }, [jobs, removeBgOpt, aiOpt, aiAvailable, patchJob]);

  const saveJob = async (job: Job) => {
    if (!job.result) return;
    patchJob(job.id, { status: "saving" });
    const a = job.attrs;
    const item: Item = {
      id: uid(),
      kind: a.kind,
      name: a.name.trim() || "Untitled piece",
      brand: a.brand.trim() || undefined,
      colors: a.colors.length ? a.colors : ["black"],
      styles: a.styles,
      seasons: a.seasons.length ? a.seasons : [...SEASONS],
      occasions: a.occasions.length ? a.occasions : ["casual"],
      warmth: a.warmth,
      formality: a.formality,
      price: a.price.trim() ? Number(a.price.replace(",", ".")) || undefined : undefined,
      notes: a.notes.trim() || undefined,
      fav: 0,
      laundry: 0,
      aiTagged: job.aiUsed,
      bgRemoved: job.result.bgRemoved,
      createdAt: Date.now(),
      image: job.result.image,
      thumb: job.result.thumb,
    };
    await db.items.add(item);
    setJobs((js) => js.filter((j) => j.id !== job.id));
    toast(`${item.name} hung in your closet`);
  };

  const readyJobs = jobs.filter((j) => j.status === "ready");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead kicker="new arrivals" title="Add pieces" />

      {/* options */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={removeBgOpt} onClick={() => setRemoveBgOpt(!removeBgOpt)}>
          {removeBgOpt ? "✓ " : ""}Cut out background
        </Chip>
        <Chip active={aiOpt} onClick={() => setAiOpt(!aiOpt)}>
          {aiOpt ? "✓ " : ""}AI tagging
        </Chip>
        {aiAvailable === false && aiOpt && (
          <span className="text-[11.5px] text-faint">
            AI off — add <code className="rounded bg-linefaint px-1">ANTHROPIC_API_KEY</code> to .env.local. Colours are detected locally.
          </span>
        )}
      </div>

      {/* dropzone */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="card group flex cursor-pointer flex-col items-center justify-center gap-3 border-dashed px-6 py-12 text-center transition-colors hover:border-champagne"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span className="grid h-14 w-14 place-items-center rounded-full border border-line text-accent transition-transform group-hover:scale-105">
          <IUpload style={{ width: 22, height: 22 }} />
        </span>
        <div>
          <div className="text-[15px] font-semibold">Drop photos here, or tap to browse</div>
          <div className="mt-1 text-[12.5px] text-muted">
            Lay pieces flat on any background — Armoire cuts them out on-device.
          </div>
        </div>
        <span className="micro flex items-center gap-1.5 text-faint">
          <ICamera style={{ width: 13, height: 13 }} /> phone camera works too
        </span>
      </label>

      {/* first-run hint about model download */}
      {jobs.some((j) => j.status === "cutout" && j.progress?.stage === "model") && (
        <div className="mt-3 rounded-xl border border-champagne/60 bg-card px-4 py-2.5 text-[12.5px] text-soft">
          First cut-out downloads the on-device model (~40 MB) — one time only, then it&apos;s instant-ish.
        </div>
      )}

      {/* queue */}
      <div className="mt-5 space-y-4">
        <AnimatePresence>
          {jobs.map((job) => (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="card overflow-hidden"
            >
              <div className="flex items-start gap-4 p-4">
                <div className="alpha-grid h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-linefaint bg-surface p-1.5">
                  {job.result ? (
                    <BlobImg blob={job.result.thumb} className="h-full w-full object-contain" />
                  ) : (
                    <RawPreview file={job.file} />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold">{job.attrs.name}</span>
                    <button
                      onClick={() => setJobs((js) => js.filter((j) => j.id !== job.id))}
                      className="text-faint hover:text-ink"
                      aria-label="Remove"
                    >
                      <IX style={{ width: 15, height: 15 }} />
                    </button>
                  </div>
                  <div className="mt-1.5 text-[12.5px] text-muted">
                    {job.status === "queued" && "Waiting…"}
                    {job.status === "cutout" && (
                      <span className="flex items-center gap-2">
                        <Spinner />
                        {job.progress?.stage === "model"
                          ? `Downloading model ${job.progress.pct}%`
                          : "Cutting out the garment…"}
                      </span>
                    )}
                    {job.status === "analyze" && (
                      <span className="flex items-center gap-2">
                        <Spinner /> Reading colours{aiOpt && aiAvailable !== false ? " & asking the stylist…" : "…"}
                      </span>
                    )}
                    {job.status === "ready" && (
                      <span className="flex items-center gap-1.5 text-sage">
                        <ICheck style={{ width: 14, height: 14 }} /> Ready to file
                        {job.aiUsed && (
                          <span className="ml-1 flex items-center gap-1 rounded-full bg-linefaint px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                            <ISparkle style={{ width: 10, height: 10 }} /> AI tagged
                          </span>
                        )}
                      </span>
                    )}
                    {job.status === "error" && <span className="text-clay">{job.error}</span>}
                    {job.status === "saving" && "Saving…"}
                  </div>
                  {job.status === "cutout" && job.progress && job.progress.stage === "model" && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-linefaint">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${job.progress.pct}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {job.status === "ready" && (
                <div className="border-t border-linefaint p-4">
                  <AttrEditor value={job.attrs} onChange={(attrs) => patchJob(job.id, { attrs })} />
                  <button
                    onClick={() => saveJob(job)}
                    className="btn-primary mt-4 w-full py-3 text-[14px] font-semibold"
                  >
                    Hang in closet
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {readyJobs.length > 1 && (
        <button
          onClick={async () => {
            for (const j of readyJobs) await saveJob(j);
          }}
          className="btn-bronze mt-4 w-full py-3.5 text-[14px] font-semibold"
        >
          Hang all {readyJobs.length} pieces
        </button>
      )}

      <p className="mt-6 text-center text-[12px] text-faint">
        Tip: shoot flat-lays in daylight. Everything stays on this device —{" "}
        <Link href="/closet" className="underline underline-offset-2">
          see your closet
        </Link>
        .
      </p>
    </div>
  );
}

function RawPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return <div className="shimmer h-full w-full rounded-lg" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}
