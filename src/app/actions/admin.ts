"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_PASSCODE  = process.env.ADMIN_PASSCODE  || "secret";
const VIEWER_PASSCODE = process.env.VIEWER_PASSCODE || "viewer";
const PAGE_SIZE = 50;

type AdminRole = "admin" | "viewer";

/** クッキーからロールを返す。未認証なら null */
export async function getAdminRole(): Promise<AdminRole | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (token === "authenticated") return "admin";
  if (token === "viewer")        return "viewer";
  return null;
}

export async function loginAdmin(formData: FormData) {
  const passcode = formData.get("passcode");

  if (passcode === ADMIN_PASSCODE) {
    const cookieStore = await cookies();
    cookieStore.set("admin_token", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
    redirect("/admin");
  } else if (passcode === VIEWER_PASSCODE) {
    const cookieStore = await cookies();
    cookieStore.set("admin_token", "viewer", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
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
  mode: "all" | "bubble" | "will" = "all",
  keyword: string = "",
  dateFrom: string = "",
  dateTo: string = "",
  sortBy: "created_at" | "view_count" | "resonance_count" | "remaining_views" | "report_count" = "created_at",
  sortDir: "asc" | "desc" = "desc"
) {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // remaining_views = max_views - view_count は計算列のため DB ソート不可
  // その場合は view_count で代替ソートして取得し、クライアント側でソートし直す
  const dbSortColumn = sortBy === "remaining_views" ? "view_count" : sortBy;
  // remaining_views の昇順 = view_count の降順（残り少ない = view_count 大）
  const dbSortAsc = sortBy === "remaining_views" ? sortDir === "desc" : sortDir === "asc";

  let query = supabase
    .from("echoes")
    .select("*", { count: "exact" })
    .order(dbSortColumn, { ascending: dbSortAsc })
    .range(from, to);

  if (mode !== "all") {
    query = query.eq("mode", mode);
  }

  if (keyword.trim()) {
    query = query.ilike("content", `%${keyword.trim()}%`);
  }

  if (dateFrom) {
    const fromUtc = new Date(`${dateFrom}T00:00:00+09:00`).toISOString();
    query = query.gte("created_at", fromUtc);
  }
  if (dateTo) {
    const toUtc = new Date(`${dateTo}T23:59:59+09:00`).toISOString();
    query = query.lte("created_at", toUtc);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching echoes:", error);
    throw new Error("データの取得に失敗しました");
  }

  return { data: data ?? [], totalCount: count ?? 0 };
}

export async function getAdminStats() {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");

  // 本日（JST）の開始時刻を UTC で算出
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const todayJstStart = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
  );

  const [totalResult, todayResult, resonanceResult, reportedResult] = await Promise.all([
    // 総投稿数 & アクティブ残響数（= 総投稿数、消滅済みは DB から削除済みのため）
    supabase.from("echoes").select("id", { count: "exact", head: true }),
    // 本日の投稿数
    supabase
      .from("echoes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayJstStart.toISOString()),
    // 総共鳴数
    supabase.from("echoes").select("resonance_count"),
    // 通報された投稿数 (report_count > 0)
    supabase.from("echoes").select("id", { count: "exact", head: true }).gt("report_count", 0),
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
    reportedCount: reportedResult.count ?? 0,
  };
}

export async function deleteAdminEcho(id: string) {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");
  if (role !== "admin") throw new Error("この操作には管理者権限が必要です");

  const { error } = await supabase.from("echoes").delete().eq("id", id);
  if (error) {
    console.error("Error deleting echo:", error);
    throw new Error("削除に失敗しました");
  }
  
  return { success: true };
}

export async function resetAdminReport(id: string) {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");
  if (role !== "admin") throw new Error("通報のリセットは管理者権限(admin)が必要です");

  const { error } = await supabase
    .from("echoes")
    .update({ report_count: 0 })
    .eq("id", id);

  if (error) {
    console.error("Error resetting report count:", error);
    throw new Error("通報カウントのリセットに失敗しました");
  }

  return { success: true };
}

export async function createAdminEcho(content: string, mode: "bubble" | "will") {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");
  if (role !== "admin") throw new Error("投稿にはadmin権限が必要です");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("投稿内容が空です");

  const maxChars = mode === "bubble" ? 60 : 800;
  if (trimmed.length > maxChars) {
    throw new Error(`文字数が上限（${maxChars}文字）を超えています`);
  }

  const maxViews = mode === "bubble" ? 100 : 500;

  const { data, error } = await supabase
    .from("echoes")
    .insert([{ content: trimmed, mode, max_views: maxViews }])
    .select()
    .single();

  if (error) {
    console.error("Error creating echo:", error);
    throw new Error("投稿の作成に失敗しました");
  }

  return { success: true, data };
}
