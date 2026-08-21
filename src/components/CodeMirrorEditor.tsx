import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { sql } from "@codemirror/lang-sql";
import type { Extension } from "@codemirror/state";
import type { CodeEditorProps } from "./CodeEditor";

function extensionsFor(language: string): Extension[] {
  switch (language) {
    case "javascript":
      return [javascript()];
    case "typescript":
      return [javascript({ typescript: true })];
    case "python":
      return [python()];
    case "java":
      return [java()];
    case "cpp":
    case "c":
      return [cpp()];
    case "go":
      return [go()];
    case "sql":
      return [sql()];
    default:
      return [];
  }
}

export default function CodeMirrorEditor({ value, onChange, language, height }: CodeEditorProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <CodeMirror
        value={value}
        height={height ?? "320px"}
        extensions={extensionsFor(language)}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
      />
    </div>
  );
}
