"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ProcessResponsePage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    // Simulate small delay for UX
    const timer = setTimeout(() => {
      router.push(
        `/dashboard/new-book/3?step=3&status=${params.get("status")}&message=${params.get("message")}`
      );
    }, 2000);

    return () => clearTimeout(timer);
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center flex-col">
      <h2 className="text-2xl font-bold text-gray-700 mb-3">Processing Payment...</h2>
      <p className="text-gray-500">Please wait while we verify your payment status.</p>
    </div>
  );
}
