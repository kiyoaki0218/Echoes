"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "secret";

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

export async function getAdminEchoes() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token");
  if (token?.value !== "authenticated") {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("echoes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching echoes:", error);
    throw new Error("データの取得に失敗しました");
  }

  return data;
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
