"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, adminLogin } from "@/data/api";

type Labels = {
  email: string;
  password: string;
  show: string;
  hide: string;
  submit: string;
  sending: string;
  missing: string;
  wrong: string;
  tooMany: string;
  failed: string;
};

const input = "min-h-12 w-full rounded-xl border border-gold/60 bg-navy-deep px-4 text-base";

/** Signs in through the backend, which sets the session cookie, then opens the dashboard. */
export default function LoginForm({ lang, t }: { lang: string; t: Labels }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!email.includes("@") || !password) {
      setMessage(t.missing);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await adminLogin(email, password);
      router.replace(`/${lang}/admin`);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      setMessage(status === 401 ? t.wrong : status === 422 ? t.missing : status === 429 ? t.tooMany : t.failed);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-5 text-start">
      <label className="block font-bold">
        {t.email}
        <input className={`${input} mt-2 font-normal`} type="email" dir="ltr" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <div>
        <label htmlFor="password" className="font-bold">{t.password}</label>
        <div className="mt-2 flex gap-2">
          <input id="password" className={input} type={visible ? "text" : "password"} dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" aria-pressed={visible} onClick={() => setVisible(!visible)} className="shrink-0 rounded-xl border border-gold/60 px-4">
            {visible ? t.hide : t.show}
          </button>
        </div>
      </div>
      <button type="submit" disabled={busy} className="btn btn-solid w-full disabled:opacity-60">{busy ? t.sending : t.submit}</button>
      <p role="status" className="min-h-6 text-center font-bold text-gold">{message}</p>
    </form>
  );
}
