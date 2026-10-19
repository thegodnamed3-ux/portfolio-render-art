import { useState } from "react";
import { clearFinished, useUploads } from "@/lib/upload-queue";

const mb = (n: number) => (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + " MB";

/** Floating panel (bottom right of the studio) with every upload and its live progress. */
export function UploadDock() {
  const items = useUploads();
  const [open, setOpen] = useState(true);
  if (!items.length) return null;
  const running = items.filter((i) => i.status === "waiting" || i.status === "uploading" || i.status === "saving");
  const total = items.reduce((a, i) => a + i.size, 0) || 1;
  const loaded = items.reduce((a, i) => a + (i.status === "done" || i.status === "skipped" ? i.size : i.loaded), 0);
  const failed = items.filter((i) => i.status === "failed").length;
  const pct = Math.round((loaded / total) * 100);
  return (
    <div className="upload-dock" role="status" aria-live="polite">
      <button type="button" className="upload-dock-head" onClick={() => setOpen(!open)}>
        <span>{running.length ? `Uploading ${items.length - running.length} / ${items.length} · ${pct}%` : `Uploaded ${items.length - failed} / ${items.length}${failed ? ` · ${failed} failed` : ""}`}</span>
        <span aria-hidden>{open ? "–" : "+"}</span>
      </button>
      <div className="upload-dock-bar"><span style={{ width: `${pct}%` }} /></div>
      {open && (
        <ul className="upload-dock-list">
          {items.map((i) => (
            <li key={i.id} className={`is-${i.status}`}>
              <span className="upload-dock-thumb">{i.preview && <img src={i.preview} alt="" />}</span>
              <span className="upload-dock-name">{i.name}<small>{i.status === "uploading" ? `${mb(i.loaded)} / ${mb(i.size)}` : i.status === "saving" ? "saving…" : i.status === "waiting" ? "waiting" : i.status === "done" ? "done" : i.note ?? i.status}</small></span>
              <span className="upload-dock-pct">{i.status === "done" ? "✓" : i.status === "failed" ? "!" : i.status === "skipped" ? "=" : `${Math.round((i.loaded / (i.size || 1)) * 100)}%`}</span>
            </li>
          ))}
        </ul>
      )}
      {!running.length && <button type="button" className="upload-dock-clear" onClick={clearFinished}>Close</button>}
    </div>
  );
}
