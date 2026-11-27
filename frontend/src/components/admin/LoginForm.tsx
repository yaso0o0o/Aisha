"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Labels = {
  email: string;
  password: string;
  show: string;
  hide: string;
  submit: string;
  missing: string;
  pending: string;
  demo: string;
};

const input = "min-h-12 w-full rounded-xl border border-gold/60 bg-navy-deep px-4 text-base";

/**
 * Design only. The backend must check the password and protect /admin on the
 * server; nothing typed here is sent or stored.
 */
export default function LoginForm({ lang, t }: { lang: string; t: Labels }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(email.includes("@") && password ? t.pending : t.missing);
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
      <button type="submit" className="btn btn-solid w-full">{t.submit}</button>
      <p role="status" className="min-h-6 text-center font-bold text-gold">{message}</p>
      <Link className="block text-center underline opacity-85" href={`/${lang}/admin`}>{t.demo}</Link>
    </form>
  );
}
