"use client";

import { useActionState } from "react";
import { signIn } from "../actions";
import { SubmitButton } from "../_components/action-form";
import { Field, inputClass } from "../_components/ui";

export function LoginForm({ notice }: { notice?: string | null }) {
  const [state, action] = useActionState(signIn, null);
  const error = state?.error ?? notice;
  return (
    <form action={action} className="space-y-4">
      <Field label="E-mail">
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Senha">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <SubmitButton className="w-full">Entrar</SubmitButton>
    </form>
  );
}
