import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const CodeMirrorEditor = lazy(() => import("./CodeMirrorEditor"));

export type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language: string;
  height?: string | undefined;
};

function Fallback({ height }: { height?: string | undefined }) {
  return (
    <div
      className="w-full animate-pulse rounded-xl bg-muted"
      style={{ height: height ?? "320px" }}
      aria-hidden
    />
  );
}

export function CodeEditor(props: CodeEditorProps) {
  return (
    <ClientOnly fallback={<Fallback height={props.height} />}>
      <Suspense fallback={<Fallback height={props.height} />}>
        <CodeMirrorEditor {...props} />
      </Suspense>
    </ClientOnly>
  );
}
