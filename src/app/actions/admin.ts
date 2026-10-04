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

  const [totalResult, todayResult, resonanceResult, reportedResult, promotedResult] = await Promise.all([
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
    // プロモーション中の投稿数 (is_promoted = true)
    supabase.from("echoes").select("id", { count: "exact", head: true }).eq("is_promoted", true),
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
    promotedCount: promotedResult.count ?? 0,
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

// =============================================
// 公式お知らせ (announcements) アクション
// =============================================

export type Announcement = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  content: string;
  is_pinned: boolean;
  publish_start: string;
  publish_end: string;
};

/** 全お知らせ一覧取得（管理画面用・期限切れ含む） */
export async function getAdminAnnouncements(): Promise<Announcement[]> {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("publish_start", { ascending: false });

  if (error) throw new Error("お知らせの取得に失敗しました");
  return (data ?? []) as Announcement[];
}

/** 掲載中のお知らせ取得（メイン画面用） */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase.rpc("get_active_announcements");
  if (error) throw new Error("お知らせの取得に失敗しました");
  return (data ?? []) as Announcement[];
}

/** お知らせ作成 */
export async function createAnnouncement(params: {
  title: string;
  content: string;
  is_pinned: boolean;
  publish_start: string;
  publish_end: string;
}) {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");
  if (role !== "admin") throw new Error("この操作には管理者権限が必要です");

  const { title, content, is_pinned, publish_start, publish_end } = params;
  if (!title.trim()) throw new Error("タイトルが空です");
  if (!content.trim()) throw new Error("本文が空です");
  if (!publish_start || !publish_end) throw new Error("掲載期間を設定してください");
  if (new Date(publish_end) <= new Date(publish_start)) {
    throw new Error("終了日時は開始日時より後にしてください");
  }

  const { data, error } = await supabase
    .from("announcements")
    .insert([{ title: title.trim(), content: content.trim(), is_pinned, publish_start, publish_end }])
    .select()
    .single();

  if (error) throw new Error("お知らせの作成に失敗しました");
  return { success: true, data };
}

/** お知らせ更新 */
export async function updateAnnouncement(
  id: string,
  params: {
    title: string;
    content: string;
    is_pinned: boolean;
    publish_start: string;
    publish_end: string;
  }
) {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");
  if (role !== "admin") throw new Error("この操作には管理者権限が必要です");

  const { title, content, is_pinned, publish_start, publish_end } = params;
  if (!title.trim()) throw new Error("タイトルが空です");
  if (!content.trim()) throw new Error("本文が空です");
  if (new Date(publish_end) <= new Date(publish_start)) {
    throw new Error("終了日時は開始日時より後にしてください");
  }

  const { error } = await supabase
    .from("announcements")
    .update({
      title: title.trim(),
      content: content.trim(),
      is_pinned,
      publish_start,
      publish_end,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error("お知らせの更新に失敗しました");
  return { success: true };
}

/** お知らせ削除 */
export async function deleteAnnouncement(id: string) {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");
  if (role !== "admin") throw new Error("この操作には管理者権限が必要です");

  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw new Error("お知らせの削除に失敗しました");
  return { success: true };
}

/** 期限切れのお知らせを一括削除（管理者専用） */
export async function purgeExpiredAnnouncements() {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");
  if (role !== "admin") throw new Error("この操作には管理者権限が必要です");

  const { data, error } = await supabase.rpc("delete_expired_announcements");
  if (error) throw new Error("期限切れお知らせの削除に失敗しました");
  return { success: true, deletedCount: data as number };
}

// =============================================
// プロモーション機能アクション
// =============================================

/** 投稿のプロモーションフラグを切り替える */
export async function togglePromoteEcho(id: string, isPromoted: boolean) {
  const role = await getAdminRole();
  if (!role) throw new Error("Unauthorized");
  if (role !== "admin") throw new Error("この操作には管理者権限が必要です");

  const { error } = await supabase
    .from("echoes")
    .update({ is_promoted: isPromoted })
    .eq("id", id);

  if (error) {
    console.error("Error toggling promotion:", error);
    throw new Error("プロモーションの更新に失敗しました");
  }

  return { success: true };
}
