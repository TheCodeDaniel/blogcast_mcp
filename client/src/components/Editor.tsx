import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { createLowlight, common } from "lowlight";
import { useState } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  Code,
  Code2,
  Quote,
  List,
  ListOrdered,
  Eye,
  EyeOff,
} from "lucide-react";
import "./editor.css";

// Languages beyond the "common" preset
import dart from "highlight.js/lib/languages/dart";

const lowlight = createLowlight(common);
lowlight.register("dart", dart);

const LANGUAGES = [
  "typescript", "javascript", "python", "bash", "go", "rust",
  "java", "php", "dart", "html", "css", "json", "sql", "yaml",
];

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // don't steal editor focus
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded text-sm transition-colors ${
        active
          ? "bg-brand-100 text-brand-700"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

interface EditorProps {
  onChange: (html: string) => void;
  placeholder?: string;
}

export function Editor({ onChange, placeholder = "Start writing your post..." }: EditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("typescript");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable built-in code block — we use the lowlight version
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "typescript",
        HTMLAttributes: {
          class: "code-block",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none",
      },
    },
  });

  if (!editor) return null;

  const handleTogglePreview = () => {
    if (!showPreview) {
      setPreviewHtml(editor.getHTML());
    }
    setShowPreview((v) => !v);
  };

  const handleInsertCodeBlock = () => {
    editor
      .chain()
      .focus()
      .setCodeBlock({ language: codeLanguage })
      .run();
  };

  return (
    <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 bg-gray-50 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic size={14} />
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={14} />
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline code"
        >
          <Code size={14} />
        </ToolbarButton>

        {/* Code block: language selector + insert button */}
        <div className="flex items-center gap-1 ml-0.5">
          <select
            value={codeLanguage}
            onChange={(e) => setCodeLanguage(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <ToolbarButton
            onClick={handleInsertCodeBlock}
            active={editor.isActive("codeBlock")}
            title="Insert code block"
          >
            <Code2 size={14} />
          </ToolbarButton>
        </div>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <Quote size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered size={14} />
        </ToolbarButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Preview toggle */}
        <button
          type="button"
          onClick={handleTogglePreview}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showPreview
              ? "bg-brand-100 text-brand-700"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          }`}
        >
          {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Editor / Preview area */}
      <div className="px-6 py-5 min-h-[480px]">
        {showPreview ? (
          <div
            className="blogcast-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}
