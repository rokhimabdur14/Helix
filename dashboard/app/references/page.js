"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// References dipindah jadi tab di Studio. Stub ini redirect supaya bookmark
// lama (kalau ada) tetap landed di tempat yang benar.
export default function ReferencesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/studio?tab=references");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Redirecting to Studio · References...
    </div>
  );
}
