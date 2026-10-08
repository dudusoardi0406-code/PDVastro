"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";
import { buttonClass } from "./ui";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Formulário ligado a uma Server Action, com mensagem de sucesso/erro. */
export function ActionForm({
  action,
  children,
  className = "",
  confirm,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  /** pede confirmação antes de enviar */
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <ActionMessage state={state} />
    </form>
  );
}

export function ActionMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <div className="mt-3 space-y-2" role="status">
      {state.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm font-medium text-brand">{state.message}</p>}
      {state.link && <CopyLink link={state.link} />}
    </div>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-canvas p-3 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 break-all text-xs">{link}</code>
      <button
        type="button"
        className={buttonClass.secondary}
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        }}
      >
        {copied ? "Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  variant?: keyof typeof buttonClass;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonClass[variant]} ${className}`}>
      {pending && (
        <svg viewBox="0 0 24 24" className="size-4 animate-spin" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
