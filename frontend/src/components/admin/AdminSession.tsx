"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError, adminLogout, adminMe, type AdminUser } from "@/data/api";
import { useAdmin } from "./lang";

/**
 * Shows the dashboard only after the backend confirms the session.
 * A missing or expired session goes back to the sign-in page.
 */
export default function AdminSession({ children }: { children: ReactNode }) {
  const { lang, tr } = useAdmin();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const toLogin = `/${lang}/admin/login`;

  useEffect(() => {
    let live = true;
    adminMe()
      .then((me) => live && setAdmin(me))
      .catch((error) => {
        if (!live) return;
        if (error instanceof ApiError && error.status === 401) router.replace(toLogin);
        else setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [router, toLogin]);

  async function logout() {
    setLeaving(true);
    await adminLogout().catch(() => {});
    router.replace(toLogin);
  }

  if (failed) {
    return (
      <p role="alert" className="mx-auto max-w-5xl rounded-lg border border-wine/40 bg-wine/10 p-4 font-bold">
        {tr("مقدرناش نوصل للسيرفر. اتأكدي إن الباك شغال وحدّثي الصفحة.", "Could not reach the server. Make sure the backend is running and reload.")}
      </p>
    );
  }

  if (!admin) {
    return <p role="status" className="mx-auto max-w-5xl py-10 text-center opacity-70">{tr("لحظة...", "One moment...")}</p>;
  }

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-end gap-3 text-sm">
        <span dir="ltr" className="opacity-75">{admin.email}</span>
        <button type="button" onClick={logout} disabled={leaving} className="inline-flex min-h-11 items-center rounded-full border border-navy/30 px-5 font-bold disabled:opacity-60">
          {tr("تسجيل الخروج", "Sign out")}
        </button>
      </div>
      {children}
    </>
  );
}
