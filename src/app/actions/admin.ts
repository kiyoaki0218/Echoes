"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "secret";
const PAGE_SIZE = 50;

export async function loginAdmin(formData: FormData) {
  const passcode = formData.get("passcode");
  
  if (passcode === ADMIN_PASSCODE) {
    const cookieStore = await cookies();
    cookieStore.set("admin_token", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });
    redirect("/admin");
  } else {
    return { error: "パスコードが間違っています" };
  }
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_token");
  redirect("/admin/login");
}

export async function getAdminEchoes(
  page: number = 1,
  mode: "all" | "bubble" | "will" = "all"
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token");
  if (token?.value !== "authenticated") {
    throw new Error("Unauthorized");
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("echoes")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (mode !== "all") {
    query = query.eq("mode", mode);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching echoes:", error);
    throw new Error("データの取得に失敗しました");
  }

  return { data: data ?? [], totalCount: count ?? 0 };
}

export async function getAdminStats() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token");
  if (token?.value !== "authenticated") {
    throw new Error("Unauthorized");
  }

  // 本日（JST）の開始時刻を UTC で算出
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const todayJstStart = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
  );

  const [totalResult, todayResult, resonanceResult] = await Promise.all([
    // 総投稿数 & アクティブ残響数（= 総投稿数、消滅済みは DB から削除済みのため）
    supabase.from("echoes").select("id", { count: "exact", head: true }),
    // 本日の投稿数
    supabase
      .from("echoes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayJstStart.toISOString()),
    // 総共鳴数
    supabase.from("echoes").select("resonance_count"),
  ]);

  if (totalResult.error || todayResult.error || resonanceResult.error) {
    throw new Error("統計データの取得に失敗しました");
  }

  const totalResonance = (resonanceResult.data ?? []).reduce(
    (sum, row) => sum + (row.resonance_count ?? 0),
    0
  );

  return {
    totalCount: totalResult.count ?? 0,
    todayCount: todayResult.count ?? 0,
    totalResonance,
    activeCount: totalResult.count ?? 0, // 消滅済みは物理削除されるため現存数 = アクティブ数
  };
}

export async function deleteAdminEcho(id: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token");
  if (token?.value !== "authenticated") {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase.from("echoes").delete().eq("id", id);
  if (error) {
    console.error("Error deleting echo:", error);
    throw new Error("削除に失敗しました");
  }
  
  return { success: true };
}