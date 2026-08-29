import { useRef, useState } from "react";
import { Film, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UploadDropzone({
  onFile,
  busy,
}: {
  onFile: (file: File) => void;
  busy?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const accept = (files: FileList | null) => {
    const file = files?.[0];
    if (file && file.type.startsWith("video/")) onFile(file);
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          accept(e.dataTransfer.files);
        }}
        className={`w-full max-w-2xl rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          over ? "border-primary bg-primary/5" : "border-border bg-card/40"
        }`}
      >
        <div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Film className="size-7" />
        </div>
        <h2 className="mt-6 text-xl font-semibold text-foreground">Upload a lesson video</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Drop an MP4, MOV or WebM here. Your original file is never modified — every cut is stored
          as an edit list you can undo at any time.
        </p>
        <Button className="mt-6" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 size-4" />
          {busy ? "Preparing editor…" : "Choose video"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => accept(e.target.files)}
        />
      </div>
    </div>
  );
}