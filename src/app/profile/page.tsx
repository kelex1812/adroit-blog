/**
 * /profile — account identity page (server component).
 *
 * Session gate: reads the HttpOnly session cookie via the SSR Supabase
 * client; guests are redirected to /login?next=/profile (server-side,
 * no client auth flash). "Change password" is an honest stub — no
 * /api/auth/reset exists yet, so it renders static text + COMING SOON.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StubBadge from "@/components/StubBadge";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { avatarHueClass, initialsFromEmail } from "@/lib/avatar";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Your profile — Adroit Blog",
  path: "/profile",
  description: "Your account identity for Adroit Academy.",
});

export default async function ProfilePage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");
  const email = user.email ?? "";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1">
        <div className="max-w-[560px] mx-auto px-6 py-14">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold text-red uppercase tracking-[0.08em] mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red" />
            Adroit Academy — Account
          </div>
          <h1 className="text-3xl font-extrabold text-navy tracking-[-0.02em] mb-2">Your profile</h1>
          <p className="text-[14px] text-gray-500 mb-7">
            Your account identity for Adroit Academy — email and sign-in method.
          </p>

          <div className="bg-white rounded-[20px] border border-gray-200 shadow-card p-8">
            <div className="flex items-center gap-[18px]">
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white ${avatarHueClass(email)}`}
              >
                {initialsFromEmail(email)}
              </span>
              <div className="min-w-0">
                <div className="break-all font-mono text-[13px] font-medium text-gray-800">
                  {email}
                </div>
                <div className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.07em] text-gray-400">
                  Sign-in method — Email &amp; password
                </div>
              </div>
            </div>
            <hr className="my-5 border-t border-gray-100" />
            <div className="flex items-center justify-between gap-4">
              <span className="text-[14px] font-semibold text-gray-800">Password</span>
              <span className="flex items-center gap-2 text-[13px] font-semibold text-gray-400">
                Change password
                <StubBadge />
              </span>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
