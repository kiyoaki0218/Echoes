"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminEchoes, deleteAdminEcho, logoutAdmin, getAdminStats, getAdminRole, resetAdminReport, createAdminEcho, getAdminAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, purgeExpiredAnnouncements, togglePromoteEcho, updateEchoMaxViews, getAdminFeedbacks, updateFeedbackStatus, deleteFeedback, getDailyTrends, getLifecycleSummary, getPrEffect, getBoostStats, type Announcement, type FeedbackItem, type FeedbackStatus, type DailyTrend, type LifecycleSummary, type PrEffect, type BoostStats } from "@/app/actions/admin";
import {
  Trash2, LogOut, RefreshCcw, ChevronDown, ChevronUp, MessageSquareHeart, CheckCircle2, Clock3,
  ChevronLeft, ChevronRight, FileText, BarChart2, Heart,
  Zap, Search, X, Menu, ExternalLink,
  ArrowUpDown, ArrowUp, ArrowDown, Flag, RotateCcw, ShieldAlert,
  PenTool, Megaphone, Pin, PinOff, Plus, Pencil, Clock, Star, Quote,
} from "lucide-react";

type Echo = {
  id: string;
  created_at: string;
  content: string;
  mode: string;
  view_count: number;
  max_views: number;
  resonance_count: number;
  report_count?: number;
  is_promoted?: boolean;
  quoted_id?: string;
  quoted_content?: string;
  quoted_mode?: string;
};

type SortBy = "created_at" | "view_count" | "resonance_count" | "remaining_views" | "report_count";
type SortDir = "asc" | "desc";
type AdminRole = "admin" | "viewer";

const PAGE_SIZE = 50;

const SORT_LABELS: Record<SortBy, string> = {
  created_at:      "投稿日時",
  view_count:      "閲覧数",
  resonance_count: "共鳴数",
  remaining_views: "残り回数",
  report_count:    "通報数",
};

export default function AdminDashboard() {
  const [echoes, setEchoes] = useState<Echo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "bubble" | "will">("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedAnnIds, setExpandedAnnIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 検索・日時フィルター
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");

  // ソート
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ロール（初回マウント時に取得）
  const [role, setRole] = useState<AdminRole | null>(null);

  // モバイル: 検索パネルの開閉
  const [searchOpen, setSearchOpen] = useState(false);

  // ページタブ: "echoes" | "announcements" | "feedbacks" | "analytics"
  const [pageTab, setPageTab] = useState<"echoes" | "announcements" | "feedbacks" | "analytics">("echoes");
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState<boolean>(false);
  const [feedbackFilter, setFeedbackFilter] = useState<string>("all");

  // 投稿フォームモーダル
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postMode, setPostMode] = useState<"bubble" | "will">("bubble");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const maxPostChars = postMode === "bubble" ? 60 : 800;

  const handleOpenPostModal = () => {
    setPostContent("");
    setPostMode("bubble");
    setPostError(null);
    setPostModalOpen(true);
  };

  const handlePost = async () => {
    if (!postContent.trim() || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      await createAdminEcho(postContent, postMode);
      setPostModalOpen(false);
      setPostContent("");
      // 一覧と統計を最新化
      fetchEchoes(currentPage, filterMode, appliedKeyword, appliedDateFrom, appliedDateTo, sortBy, sortDir);
      fetchStats();
    } catch (err: any) {
      setPostError(err.message || "投稿に失敗しました");
    } finally {
      setPosting(false);
    }
  };

  // =============================================
  // お知らせ管理
  // =============================================
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annError, setAnnError] = useState<string | null>(null);

  // お知らせフォームモーダル
  const [annModalOpen, setAnnModalOpen] = useState(false);
  const [annEditing, setAnnEditing] = useState<Announcement | null>(null); // nullなら新規、値なら編集
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annIsPinned, setAnnIsPinned] = useState(false);
  const [annPublishStart, setAnnPublishStart] = useState("");
  const [annPublishEnd, setAnnPublishEnd] = useState("");
  const [annSaving, setAnnSaving] = useState(false);
  const [annFormError, setAnnFormError] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    setAnnLoading(true);
    setAnnError(null);
    try {
      const data = await getAdminAnnouncements();
      setAnnouncements(data);
    } catch (err: any) {
      setAnnError(err.message || "お知らせの取得に失敗しました");
    } finally {
      setAnnLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pageTab === "announcements") fetchAnnouncements();
  }, [pageTab, fetchAnnouncements]);

  const fetchFeedbacks = useCallback(async () => {
    setFeedbacksLoading(true);
    try {
      const data = await getAdminFeedbacks();
      setFeedbacks(data);
    } catch {
      // error handling
    } finally {
      setFeedbacksLoading(false);
    }
  }, []);

  const handleUpdateFeedbackStatus = async (id: string, nextStatus: FeedbackStatus) => {
    try {
      await updateFeedbackStatus(id, nextStatus);
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: nextStatus } : f));
    } catch (err: any) {
      alert(err.message || "ステータス更新に失敗しました");
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm("このご意見を削除しますか？")) return;
    try {
      await deleteFeedback(id);
      setFeedbacks(prev => prev.filter(f => f.id !== id));
    } catch (err: any) {
      alert(err.message || "削除に失敗しました");
    }
  };

  useEffect(() => {
    if (pageTab === "feedbacks") fetchFeedbacks();
  }, [pageTab, fetchFeedbacks]);

  // =============================================
  // 分析（Phase 6）
  // =============================================
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [lifecycle, setLifecycle] = useState<LifecycleSummary | null>(null);
  const [prEffect, setPrEffect] = useState<PrEffect | null>(null);
  const [boostStats, setBoostStats] = useState<BoostStats | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [trendDays, setTrendDays] = useState<number>(30);

  const fetchAnalytics = useCallback(async (days: number) => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const [t, l, p, b] = await Promise.all([
        getDailyTrends(days),
        getLifecycleSummary(),
        getPrEffect(),
        getBoostStats(),
      ]);
      setTrends(t);
      setLifecycle(l);
      setPrEffect(p);
      setBoostStats(b);
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : "分析データの取得に失敗しました");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);


  // ISO文字列 → datetime-local 入力値に変換
  const toDatetimeLocal = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openAnnCreate = () => {
    setAnnEditing(null);
    setAnnTitle("");
    setAnnContent("");
    setAnnIsPinned(false);
    // デフォルト: 今から1週間
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setAnnPublishStart(toDatetimeLocal(now.toISOString()));
    setAnnPublishEnd(toDatetimeLocal(weekLater.toISOString()));
    setAnnFormError(null);
    setAnnModalOpen(true);
  };

  const openAnnEdit = (ann: Announcement) => {
    setAnnEditing(ann);
    setAnnTitle(ann.title);
    setAnnContent(ann.content);
    setAnnIsPinned(ann.is_pinned);
    setAnnPublishStart(toDatetimeLocal(ann.publish_start));
    setAnnPublishEnd(toDatetimeLocal(ann.publish_end));
    setAnnFormError(null);
    setAnnModalOpen(true);
  };

  const handleAnnSave = async () => {
    if (annSaving) return;
    setAnnSaving(true);
    setAnnFormError(null);
    try {
      const params = {
        title: annTitle,
        content: annContent,
        is_pinned: annIsPinned,
        publish_start: new Date(annPublishStart).toISOString(),
        publish_end: new Date(annPublishEnd).toISOString(),
      };
      if (annEditing) {
        await updateAnnouncement(annEditing.id, params);
      } else {
        await createAnnouncement(params);
      }
      setAnnModalOpen(false);
      fetchAnnouncements();
    } catch (err: any) {
      setAnnFormError(err.message || "保存に失敗しました");
    } finally {
      setAnnSaving(false);
    }
  };

  const handleAnnDelete = async (id: string) => {
    if (!confirm("このお知らせを削除しますか？")) return;
    try {
      await deleteAnnouncement(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(err.message || "削除に失敗しました");
    }
  };

  const handlePurgeExpired = async () => {
    if (!confirm("期限切れのお知らせをすべて削除しますか？")) return;
    try {
      const result = await purgeExpiredAnnouncements();
      alert(`${result.deletedCount}件の期限切れお知らせを削除しました。`);
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message || "削除に失敗しました");
    }
  };

  // お知らせのステータスラベル
  const getAnnStatus = (ann: Announcement) => {
    const now = new Date();
    const start = new Date(ann.publish_start);
    const end = new Date(ann.publish_end);
    if (now < start) return { label: "掲載前", color: "text-yellow-400 bg-yellow-950/30 border-yellow-800/40" };
    if (now >= end)  return { label: "期限切れ", color: "text-neutral-500 bg-neutral-800/40 border-neutral-700/40" };
    return { label: "掲載中", color: "text-emerald-400 bg-emerald-950/30 border-emerald-800/40" };
  };

  const isFiltered = appliedKeyword || appliedDateFrom || appliedDateTo;

  type Stats = { totalCount: number; todayCount: number; totalResonance: number; activeCount: number; reportedCount?: number; promotedCount?: number };
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchEchoes = useCallback(async (
    page: number,
    mode: "all" | "bubble" | "will",
    kw: string,
    df: string,
    dt: string,
    sb: SortBy,
    sd: SortDir,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminEchoes(page, mode, kw, df, dt, sb, sd);
      setEchoes(result.data as Echo[]);
      setTotalCount(result.totalCount);
    } catch (err: any) {
      setError(err.message || "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const result = await getAdminStats();
      setStats(result);
    } catch { /* 非致命的 */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => {
    fetchEchoes(currentPage, filterMode, appliedKeyword, appliedDateFrom, appliedDateTo, sortBy, sortDir);
  }, [currentPage, filterMode, appliedKeyword, appliedDateFrom, appliedDateTo, sortBy, sortDir, fetchEchoes]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    getAdminRole().then(r => setRole(r));
  }, []);

  const handleFilterChange = (mode: "all" | "bubble" | "will") => {
    setFilterMode(mode);
    setCurrentPage(1);
  };

  const handleSearch = () => {
    setAppliedKeyword(keyword);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setCurrentPage(1);
    setSearchOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClearSearch = () => {
    setKeyword(""); setDateFrom(""); setDateTo("");
    setAppliedKeyword(""); setAppliedDateFrom(""); setAppliedDateTo("");
    setCurrentPage(1);
  };

  // ソート列クリック：同じ列なら方向反転、別列なら降順から開始
  const handleSort = (col: SortBy) => {
    if (sortBy === col) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("本当にこの投稿を強制削除しますか？")) return;
    try {
      await deleteAdminEcho(id);
      setEchoes(prev => prev.filter(e => e.id !== id));
      setTotalCount(prev => prev - 1);
      fetchStats();
    } catch (err: any) { alert(err.message || "削除に失敗しました"); }
  };

  const handleTogglePromote = async (id: string, current: boolean) => {
    try {
      await togglePromoteEcho(id, !current);
      setEchoes(prev => prev.map(e => e.id === id ? { ...e, is_promoted: !current } : e));
    } catch (err: any) {
      alert(err.message || "プロモーションの更新に失敗しました");
    }
  };

  // 寿命編集
  const [editingMaxViewsId, setEditingMaxViewsId] = useState<string | null>(null);
  const [editingMaxViewsVal, setEditingMaxViewsVal] = useState<string>("");

  const startEditMaxViews = (echo: Echo) => {
    setEditingMaxViewsId(echo.id);
    setEditingMaxViewsVal(String(echo.max_views));
  };

  const cancelEditMaxViews = () => {
    setEditingMaxViewsId(null);
    setEditingMaxViewsVal("");
  };

  const commitEditMaxViews = async (id: string) => {
    const val = parseInt(editingMaxViewsVal, 10);
    if (isNaN(val)) { cancelEditMaxViews(); return; }
    try {
      await updateEchoMaxViews(id, val);
      setEchoes(prev => prev.map(e => e.id === id ? { ...e, max_views: val } : e));
    } catch (err: any) {
      alert(err.message || "寿命の更新に失敗しました");
    } finally {
      cancelEditMaxViews();
    }
  };

  const handleResetReport = async (id: string) => {
    if (role !== "admin") {
      alert("通報のリセットは管理者権限(admin)のみ可能です。");
      return;
    }
    if (!confirm("この投稿の通報カウントを 0 にリセットしますか？")) return;
    try {
      await resetAdminReport(id);
      setEchoes(prev => prev.map(e => e.id === id ? { ...e, report_count: 0 } : e));
      fetchStats();
    } catch (err: any) { alert(err.message || "通報リセットに失敗しました"); }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAnnExpand = (id: string) => {
    setExpandedAnnIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    if (currentPage <= 4) pages.push(1, 2, 3, 4, 5, "...", totalPages);
    else if (currentPage >= totalPages - 3) pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    else pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    return pages;
  };

  const renderPagination = (marginClass: string = "my-4") => {
    if (totalPages <= 1) return null;
    return (
      <div className={`flex items-center justify-center gap-1 font-sans ${marginClass}`}>
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
          className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {getPageNumbers().map((page, i) =>
          page === "..." ? (
            <span key={`e-${i}`} className="px-2 text-neutral-600 select-none">…</span>
          ) : (
            <button key={page} onClick={() => setCurrentPage(page as number)}
              className={`min-w-[36px] h-9 px-2 rounded-lg text-sm transition-colors ${currentPage === page ? "bg-neutral-700 text-neutral-100 font-medium" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"}`}>
              {page}
            </button>
          )
        )}
        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const modeBadge = (mode: string) =>
    `px-2 py-0.5 rounded text-xs border ${mode === "bubble"
      ? "bg-blue-950/50 text-blue-300 border-blue-900/50"
      : "bg-purple-950/50 text-purple-300 border-purple-900/50"}`;

  // ソートアイコン（テーブルヘッダー用）
  const SortIcon = ({ col }: { col: SortBy }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 text-neutral-200" />
      : <ArrowDown className="w-3 h-3 text-neutral-200" />;
  };

  // ソート可能なテーブルヘッダーセル
  const SortTh = ({ col, className, children }: { col: SortBy; className?: string; children: React.ReactNode }) => (
    <th
      className={`px-3.5 py-3 lg:px-4 lg:py-3.5 font-medium whitespace-nowrap cursor-pointer select-none hover:text-neutral-200 transition-colors ${sortBy === col ? "text-neutral-200" : ""} ${className ?? ""}`}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        <SortIcon col={col} />
      </span>
    </th>
  );

  return (
    <div className="min-h-screen bg-black text-neutral-200 font-serif p-4 md:p-6">
      <div className="w-full max-w-7xl mx-auto">

        {/* ===== ヘッダー ===== */}
        <header className="flex items-center justify-between border-b border-neutral-800 pb-4 md:pb-6 mb-4 md:mb-6 gap-3">
          <div>
            <h1 className="text-lg md:text-2xl tracking-widest text-neutral-300 font-light leading-tight">管理者ダッシュボード</h1>
            <p className="text-xs md:text-sm font-sans text-neutral-500 mt-0.5">
              {role === "viewer"
                ? <span className="inline-flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span><span className="text-amber-400/80">閲覧専用モード — 削除・編集操作は無効</span></span>
                : "全投稿の管理"
              }
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {role !== null && (
              <button
                onClick={handleOpenPostModal}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-neutral-100 text-neutral-900 rounded-lg hover:bg-white transition-colors text-sm font-sans font-medium"
                title="新しい投稿を作成"
              >
                <PenTool className="w-4 h-4" />
                <span className="hidden md:inline">投稿する</span>
              </button>
            )}
            <button
              onClick={() => { fetchEchoes(currentPage, filterMode, appliedKeyword, appliedDateFrom, appliedDateTo, sortBy, sortDir); fetchStats(); }}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm font-sans text-neutral-300"
              title="更新"
            >
              <RefreshCcw className="w-4 h-4" />
              <span className="hidden md:inline">更新</span>
            </button>
            <button
              onClick={() => logoutAdmin()}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm font-sans text-neutral-300"
              title="ログアウト"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">ログアウト</span>
            </button>
          </div>
        </header>

        {/* ===== ページタブ ===== */}
        <div className="flex bg-neutral-900/50 border border-neutral-800 rounded-xl p-1 gap-1 mb-6 font-sans w-fit">
          <button
            onClick={() => setPageTab("echoes")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${pageTab === "echoes" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            <FileText className="w-4 h-4" />
            投稿管理
          </button>
          <button
            onClick={() => setPageTab("announcements")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${pageTab === "announcements" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            <Megaphone className="w-4 h-4" />
            公式お知らせ
          </button>
          <button
            onClick={() => setPageTab("feedbacks")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${pageTab === "feedbacks" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            <MessageSquareHeart className="w-4 h-4" />
            ご意見・ご要望
            {feedbacks.filter(f => f.status === "unread").length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </button>
          <button
            onClick={() => { setPageTab("analytics"); fetchAnalytics(trendDays); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${pageTab === "analytics" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            <BarChart2 className="w-4 h-4" />
            分析
          </button>
        </div>

        {/* ===== サマリーカード（投稿管理タブのみ） ===== */}
        {pageTab === "echoes" && (<>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8">
          {[
            { label: "本日の投稿数", value: stats?.todayCount,     icon: <Zap className="w-4 h-4" />,         color: "text-yellow-400",  bg: "bg-yellow-950/20 border-yellow-900/30" },
            { label: "総投稿数",     value: stats?.totalCount,     icon: <FileText className="w-4 h-4" />,    color: "text-blue-400",    bg: "bg-blue-950/20 border-blue-900/30" },
            { label: "総共鳴数",     value: stats?.totalResonance, icon: <Heart className="w-4 h-4" />,       color: "text-red-400",     bg: "bg-red-950/20 border-red-900/30" },
            { label: "アクティブ",   value: stats?.activeCount,    icon: <BarChart2 className="w-4 h-4" />,   color: "text-emerald-400", bg: "bg-emerald-950/20 border-emerald-900/30" },
            { label: "通報投稿",     value: stats?.reportedCount,  icon: <ShieldAlert className="w-4 h-4" />, color: "text-rose-400",    bg: "bg-rose-950/20 border-rose-900/30" },
            { label: "PR投稿",       value: stats?.promotedCount,  icon: <Star className="w-4 h-4" />,        color: "text-amber-400",   bg: "bg-amber-950/20 border-amber-900/30" },
          ].map(({ label, value, icon, color, bg }) => (
            <div key={label} className={`border rounded-xl p-3 md:p-4 flex flex-col gap-2 md:gap-3 ${bg}`}>
              <div className={`flex items-center gap-1.5 text-[11px] md:text-xs font-sans font-medium tracking-wider ${color}`}>
                {icon}<span className="truncate">{label}</span>
              </div>
              {statsLoading
                ? <div className="h-6 md:h-7 w-14 bg-neutral-800 animate-pulse rounded" />
                : <p className="text-xl md:text-2xl font-light text-neutral-100 font-sans">{value?.toLocaleString() ?? "—"}</p>
              }
            </div>
          ))}
        </div>

        {/* ===== 検索パネル ===== */}
        <div className="mb-4">
          <button
            className="md:hidden flex items-center gap-2 w-full px-4 py-2.5 bg-neutral-900/60 border border-neutral-800 rounded-xl text-sm font-sans text-neutral-400 hover:text-neutral-200 transition-colors mb-2"
            onClick={() => setSearchOpen(v => !v)}
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">{isFiltered ? <span className="text-neutral-200">絞り込み中</span> : "検索・絞り込み"}</span>
            {isFiltered && <span className="text-[10px] bg-neutral-700 text-neutral-300 rounded-full px-2 py-0.5">適用中</span>}
            <Menu className="w-4 h-4" />
          </button>

          <div className={`bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 font-sans ${searchOpen ? "block" : "hidden md:block"}`}>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                  <input
                    type="text" value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="投稿テキストで検索..."
                    className="w-full pl-9 pr-4 py-2 bg-neutral-800/60 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-neutral-500 transition-colors"
                  />
                </div>
                <button onClick={handleSearch} className="px-4 py-2 bg-neutral-200 text-neutral-900 rounded-lg text-sm font-medium hover:bg-white transition-colors whitespace-nowrap">検索</button>
                {isFiltered && (
                  <button onClick={handleClearSearch} className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200 rounded-lg text-sm transition-colors whitespace-nowrap">
                    <X className="w-3.5 h-3.5" /><span className="hidden sm:inline">クリア</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-400 flex-wrap">
                <span className="whitespace-nowrap text-xs">投稿日:</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="flex-1 min-w-[130px] px-3 py-1.5 bg-neutral-800/60 border border-neutral-700 rounded-lg text-sm text-neutral-200 outline-none focus:border-neutral-500 transition-colors [color-scheme:dark]" />
                <span className="text-neutral-600 text-xs">〜</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="flex-1 min-w-[130px] px-3 py-1.5 bg-neutral-800/60 border border-neutral-700 rounded-lg text-sm text-neutral-200 outline-none focus:border-neutral-500 transition-colors [color-scheme:dark]" />
              </div>
            </div>
          </div>
        </div>

        {/* ===== モードフィルター & 件数 ===== */}
        <div className="flex items-center justify-between mb-4 md:mb-6 gap-3 flex-wrap">
          <div className="flex bg-neutral-900/50 p-1 rounded-full w-fit border border-neutral-800">
            {(["all", "bubble", "will"] as const).map(m => (
              <button key={m} onClick={() => handleFilterChange(m)}
                className={`px-4 md:px-6 py-1.5 md:py-2 rounded-full text-xs md:text-sm transition-colors ${filterMode === m ? "bg-neutral-800 text-neutral-200" : "text-neutral-500 hover:text-neutral-300"}`}>
                {m === "all" ? "すべて" : m === "bubble" ? "短文" : "長文"}
              </button>
            ))}
          </div>
          {!loading && (
            <p className="text-xs text-neutral-500 font-sans">
              {isFiltered && <span className="text-neutral-400 mr-1">検索結果:</span>}
              <span className="text-neutral-300">{totalCount.toLocaleString()}</span> 件
              {totalPages > 1 && <> · {currentPage} / {totalPages} ページ</>}
            </p>
          )}
        </div>

        {/* ===== モバイル: ソートセレクター ===== */}
        <div className="md:hidden flex items-center gap-2 mb-3 font-sans">
          <span className="text-xs text-neutral-500 whitespace-nowrap">並び替え:</span>
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value as SortBy); setCurrentPage(1); }}
            className="flex-1 px-3 py-1.5 bg-neutral-900/60 border border-neutral-800 rounded-lg text-xs text-neutral-200 outline-none [color-scheme:dark]"
          >
            {(Object.keys(SORT_LABELS) as SortBy[]).map(k => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
          <button
            onClick={() => { setSortDir(d => d === "desc" ? "asc" : "desc"); setCurrentPage(1); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-neutral-900/60 border border-neutral-800 rounded-lg text-xs text-neutral-300 hover:bg-neutral-800 transition-colors whitespace-nowrap"
          >
            {sortDir === "desc"
              ? <><ArrowDown className="w-3.5 h-3.5" />降順</>
              : <><ArrowUp className="w-3.5 h-3.5" />昇順</>
            }
          </button>
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-900/50 text-red-400 p-4 rounded-lg mb-4 md:mb-6 font-sans text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-20 text-neutral-500 font-sans tracking-widest text-sm">読み込み中...</div>
        ) : echoes.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 font-sans text-sm">
            {isFiltered ? "条件に一致する投稿がありません" : "投稿がありません"}
          </div>
        ) : (
          <>
            {/* 上部ページネーション */}
            {renderPagination("mb-4")}

            {/* ===== デスクトップ: テーブル ===== */}
            <div className="hidden md:block bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden font-sans">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400">
                    <tr>
                      <SortTh col="created_at">投稿日時</SortTh>
                      <th className="px-6 py-4 font-medium whitespace-nowrap">モード</th>
                      <th className="px-6 py-4 font-medium w-full">内容</th>                      <SortTh col="view_count" className="text-right">閲覧数</SortTh>
                      <SortTh col="remaining_views" className="text-right">残り</SortTh>
                      <SortTh col="resonance_count" className="text-right">共鳴数</SortTh>
                      <SortTh col="report_count" className="text-right">通報数</SortTh>
                      <th className="px-6 py-4 font-medium whitespace-nowrap text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {echoes.map(echo => {
                      const isReported = (echo.report_count ?? 0) > 0;
                      return (
                        <tr key={echo.id} className={isReported ? "bg-rose-950/25 hover:bg-rose-950/40 transition-colors border-l-2 border-l-rose-500" : "hover:bg-neutral-800/30 transition-colors"}>
                          <td className="px-3.5 py-3 lg:px-4 lg:py-3.5 whitespace-nowrap text-neutral-400 text-xs">
                            {new Date(echo.created_at).toLocaleString("ja-JP")}
                          </td>
                          <td className="px-3 py-3 lg:px-3.5 lg:py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className={modeBadge(echo.mode)}>{echo.mode === "bubble" ? "泡沫" : "遺言"}</span>
                              {(echo.quoted_id || echo.quoted_content) && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-neutral-800 border border-neutral-700 text-neutral-300 font-sans" title="引用残響">
                                  <Quote className="w-2.5 h-2.5" />引用
                                </span>
                              )}
                              {echo.is_promoted && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-950/60 border border-amber-800/50 text-amber-400 font-sans">
                                  <Star className="w-2.5 h-2.5 fill-amber-400" />PR
                                </span>
                              )}
                              {isReported && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/80 border border-rose-800/60 text-rose-300 font-sans flex items-center gap-0.5" title={`${echo.report_count}件の通報`}>
                                  <Flag className="w-2.5 h-2.5" />
                                  {echo.report_count}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 lg:px-4 lg:py-3.5 text-neutral-300">
                            <div className={`break-words font-serif whitespace-pre-wrap ${!expandedIds.has(echo.id) && echo.mode === "will" ? "line-clamp-2" : ""}`}>
                              {echo.content}
                            </div>
                            {echo.mode === "will" && (
                              <button onClick={() => toggleExpand(echo.id)} className="mt-2 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors font-sans">
                                {expandedIds.has(echo.id) ? <><ChevronUp className="w-3 h-3" />折りたたむ</> : <><ChevronDown className="w-3 h-3" />すべて表示</>}
                              </button>
                            )}
                            {echo.quoted_content && (
                              <div className="mt-2.5 p-2 rounded-lg bg-neutral-950/70 border border-neutral-800 text-xs text-neutral-400">
                                <div className="flex items-center justify-between text-[10px] text-neutral-500 font-sans mb-1">
                                  <span className="flex items-center gap-1">
                                    <Quote className="w-2.5 h-2.5 text-neutral-400" />
                                    <span>引用された残響</span>
                                    {echo.quoted_mode && <span>({echo.quoted_mode === "bubble" ? "泡沫" : "遺言"})</span>}
                                  </span>
                                  {echo.quoted_id && (
                                    <a
                                      href={`/?echo=${echo.quoted_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-0.5 text-blue-400 hover:text-blue-300 transition-colors ml-2 shrink-0"
                                      title="引用元の残響を表示"
                                    >
                                      <span>引用元を開く</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                                <div className="line-clamp-2 font-serif text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                  {echo.quoted_content}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-neutral-400">
                            {echo.view_count} / {role === "admin" ? (
                              editingMaxViewsId === echo.id ? (
                                <span className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={editingMaxViewsVal}
                                    onChange={e => setEditingMaxViewsVal(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") commitEditMaxViews(echo.id); if (e.key === "Escape") cancelEditMaxViews(); }}
                                    onBlur={() => commitEditMaxViews(echo.id)}
                                    autoFocus
                                    className="w-16 px-1.5 py-0.5 bg-neutral-800 border border-neutral-600 rounded text-xs text-neutral-100 text-right outline-none focus:border-neutral-400"
                                    min={echo.view_count + 1}
                                  />
                                </span>
                              ) : (
                                <button
                                  onClick={() => startEditMaxViews(echo)}
                                  className="underline decoration-dotted underline-offset-2 hover:text-neutral-200 transition-colors"
                                  title="クリックして寿命を編集"
                                >
                                  {echo.max_views}
                                </button>
                              )
                            ) : echo.max_views}
                          </td>
                          <td className={`px-3 py-3 lg:px-3.5 lg:py-3.5 whitespace-nowrap text-right font-sans text-xs ${Math.max(0, echo.max_views - echo.view_count) <= 10 ? "text-red-400" : "text-neutral-400"}`}>
                            {Math.max(0, echo.max_views - echo.view_count)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-neutral-400">
                            {echo.resonance_count}
                          </td>
                          <td className={`px-3 py-3 lg:px-3.5 lg:py-3.5 whitespace-nowrap text-right font-sans text-xs ${isReported ? "text-rose-400 font-medium" : "text-neutral-500"}`}>
                            {echo.report_count ?? 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              <a href={`/?echo=${echo.id}`} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 text-neutral-500 hover:text-blue-400 hover:bg-blue-950/30 rounded-lg transition-colors" title="新しいタブで直表示">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              {role === "admin" && (
                                <button
                                  onClick={() => handleTogglePromote(echo.id, echo.is_promoted ?? false)}
                                  className={`p-1.5 rounded-lg transition-colors ${echo.is_promoted ? "text-amber-400 hover:text-amber-200 hover:bg-amber-950/40" : "text-neutral-500 hover:text-amber-400 hover:bg-amber-950/30"}`}
                                  title={echo.is_promoted ? "プロモーション解除" : "プロモーションに設定"}
                                >
                                  <Star className={`w-4 h-4 ${echo.is_promoted ? "fill-amber-400" : ""}`} />
                                </button>
                              )}
                              {isReported && role === "admin" && (
                                <button onClick={() => handleResetReport(echo.id)}
                                  className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 rounded-lg transition-colors" title="通報カウントを0にリセット">
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              {role === "admin" ? (
                                <button onClick={() => handleDelete(echo.id)}
                                  className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors" title="削除">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="p-1.5 text-neutral-700 cursor-not-allowed" title="閲覧専用のため削除不可">
                                  <Trash2 className="w-4 h-4" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===== モバイル: カード ===== */}
            <div className="md:hidden space-y-3 font-sans">
              {echoes.map(echo => {
                const isReported = (echo.report_count ?? 0) > 0;
                return (
                  <div key={echo.id} className={`rounded-xl overflow-hidden border ${isReported ? "bg-rose-950/20 border-rose-900/40" : "bg-neutral-900/50 border-neutral-800"}`}>
                    <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-neutral-800/50">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className={modeBadge(echo.mode)}>{echo.mode === "bubble" ? "泡沫" : "遺言"}</span>
                        {(echo.quoted_id || echo.quoted_content) && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-neutral-800 border border-neutral-700 text-neutral-300">
                            <Quote className="w-2.5 h-2.5" />引用
                          </span>
                        )}
                        {echo.is_promoted && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-950/60 border border-amber-800/50 text-amber-400">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />PR
                          </span>
                        )}
                        {isReported && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/80 border border-rose-800/60 text-rose-300 flex items-center gap-0.5">
                            <Flag className="w-2.5 h-2.5" />
                            {echo.report_count}
                          </span>
                        )}
                        <span className="text-[11px] text-neutral-500 truncate">{new Date(echo.created_at).toLocaleString("ja-JP")}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={`/?echo=${echo.id}`} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-neutral-600 hover:text-blue-400 hover:bg-blue-950/30 rounded-lg transition-colors" title="新しいタブで直表示">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        {role === "admin" && (
                          <button
                            onClick={() => handleTogglePromote(echo.id, echo.is_promoted ?? false)}
                            className={`p-1.5 rounded-lg transition-colors ${echo.is_promoted ? "text-amber-400 hover:text-amber-200 hover:bg-amber-950/40" : "text-neutral-600 hover:text-amber-400 hover:bg-amber-950/30"}`}
                            title={echo.is_promoted ? "プロモーション解除" : "プロモーションに設定"}
                          >
                            <Star className={`w-4 h-4 ${echo.is_promoted ? "fill-amber-400" : ""}`} />
                          </button>
                        )}
                        {isReported && role === "admin" && (
                          <button onClick={() => handleResetReport(echo.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 rounded-lg transition-colors" title="通報カウントを0にリセット">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {role === "admin" ? (
                          <button onClick={() => handleDelete(echo.id)}
                            className="p-1.5 text-neutral-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors" title="削除">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="p-1.5 text-neutral-700 cursor-not-allowed" title="閲覧専用のため削除不可">
                            <Trash2 className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <p className={`text-sm text-neutral-300 font-serif whitespace-pre-wrap leading-relaxed ${!expandedIds.has(echo.id) && echo.mode === "will" ? "line-clamp-3" : ""}`}>
                        {echo.content}
                      </p>
                      {echo.mode === "will" && (
                        <button onClick={() => toggleExpand(echo.id)} className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">
                          {expandedIds.has(echo.id) ? <><ChevronUp className="w-3 h-3" />折りたたむ</> : <><ChevronDown className="w-3 h-3" />すべて表示</>}
                        </button>
                      )}
                      {echo.quoted_content && (
                        <div className="mt-2.5 p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800 text-xs text-neutral-400">
                          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-sans mb-1">
                            <span className="flex items-center gap-1">
                              <Quote className="w-2.5 h-2.5 text-neutral-400" />
                              <span>引用された残響</span>
                              {echo.quoted_mode && <span>({echo.quoted_mode === "bubble" ? "泡沫" : "遺言"})</span>}
                            </span>
                            {echo.quoted_id && (
                              <a
                                href={`/?echo=${echo.quoted_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-blue-400 hover:text-blue-300 transition-colors ml-2 shrink-0"
                                title="引用元の残響を表示"
                              >
                                <span>引用元を開く</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="line-clamp-2 font-serif text-neutral-300 whitespace-pre-wrap leading-relaxed">
                            {echo.quoted_content}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-neutral-500">
                      <div className="flex items-center gap-3">
                        <span>閲覧: <strong className="text-neutral-300">{echo.view_count}</strong> / {role === "admin" ? (
                          editingMaxViewsId === echo.id ? (
                            <input
                              type="number"
                              value={editingMaxViewsVal}
                              onChange={e => setEditingMaxViewsVal(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") commitEditMaxViews(echo.id); if (e.key === "Escape") cancelEditMaxViews(); }}
                              onBlur={() => commitEditMaxViews(echo.id)}
                              autoFocus
                              className="w-14 px-1 py-0.5 bg-neutral-800 border border-neutral-600 rounded text-xs text-neutral-100 text-right outline-none focus:border-neutral-400"
                              min={echo.view_count + 1}
                            />
                          ) : (
                            <button
                              onClick={() => startEditMaxViews(echo)}
                              className="underline decoration-dotted underline-offset-2 hover:text-neutral-200 transition-colors"
                              title="タップして寿命を編集"
                            >
                              {echo.max_views}
                            </button>
                          )
                        ) : echo.max_views}</span>
                        <span className={Math.max(0, echo.max_views - echo.view_count) <= 10 ? "text-red-400" : ""}>
                          残り: <strong>{Math.max(0, echo.max_views - echo.view_count)}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-red-500/60" />
                          <strong className="text-neutral-300">{echo.resonance_count}</strong>
                        </span>
                      </div>
                      {isReported && (
                        <span className="text-rose-400 font-medium flex items-center gap-0.5">
                          通報: {echo.report_count}件
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 下部ページネーション */}
            {renderPagination("mt-6")}
          </>
        )}
        </>)} {/* end pageTab === "echoes" */}

        {/* ===== お知らせ管理タブ ===== */}
        {pageTab === "announcements" && (
          <div className="font-sans">
            {/* ヘッダー行 */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-base font-medium text-neutral-200 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-neutral-400" />
                  公式お知らせ管理
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">掲載期間が終了したお知らせはメイン画面に表示されません。</p>
              </div>
              <div className="flex items-center gap-2">
                {role === "admin" && (
                  <>
                    <button
                      onClick={handlePurgeExpired}
                      className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg text-sm transition-colors"
                      title="期限切れを一括削除"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">期限切れ削除</span>
                    </button>
                    <button
                      onClick={openAnnCreate}
                      className="flex items-center gap-1.5 px-4 py-2 bg-neutral-100 text-neutral-900 rounded-lg hover:bg-white text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      新規作成
                    </button>
                  </>
                )}
                <button
                  onClick={fetchAnnouncements}
                  className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-300"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {annError && (
              <div className="bg-red-950/30 border border-red-900/50 text-red-400 p-4 rounded-lg mb-4 text-sm">{annError}</div>
            )}

            {annLoading ? (
              <div className="text-center py-16 text-neutral-500 text-sm tracking-widest">読み込み中...</div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-16 text-neutral-500 text-sm">お知らせはありません</div>
            ) : (
              <div className="space-y-3">
                {announcements.map(ann => {
                  const status = getAnnStatus(ann);
                  const isExpanded = expandedAnnIds.has(ann.id);
                  return (
                    <div key={ann.id} className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden transition-colors">
                      <div
                        className="px-4 pt-3 pb-2 flex items-start justify-between gap-3 cursor-pointer hover:bg-neutral-800/20 select-none"
                        onClick={() => toggleAnnExpand(ann.id)}
                      >
                        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                          {/* ステータスバッジ */}
                          <span className={`px-2 py-0.5 rounded-full text-[11px] border font-medium shrink-0 ${status.color}`}>
                            {status.label}
                          </span>
                          {/* ピン留めバッジ */}
                          {ann.is_pinned && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-950/30 border border-amber-800/40 text-amber-400 shrink-0">
                              <Pin className="w-2.5 h-2.5" />
                              固定
                            </span>
                          )}
                          <h3 className={`text-sm font-medium text-neutral-200 min-w-0 ${isExpanded ? "break-words" : "truncate"}`}>
                            {ann.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          {role === "admin" && (
                            <>
                              <button onClick={() => openAnnEdit(ann)}
                                className="p-1.5 text-neutral-500 hover:text-blue-400 hover:bg-blue-950/30 rounded-lg transition-colors" title="編集">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleAnnDelete(ann.id)}
                                className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors" title="削除">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => toggleAnnExpand(ann.id)}
                            className="p-1.5 text-neutral-500 hover:text-neutral-300 rounded-lg transition-colors ml-1"
                            title={isExpanded ? "折りたたむ" : "展開して全文表示"}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="px-4 pb-2">
                        <p className={`text-sm text-neutral-400 whitespace-pre-wrap break-words leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                          {ann.content}
                        </p>
                        <button
                          onClick={() => toggleAnnExpand(ann.id)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors font-sans"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="w-3 h-3" />折りたたむ</>
                          ) : (
                            <><ChevronDown className="w-3 h-3" />全文を表示</>
                          )}
                        </button>
                      </div>
                      <div className="px-4 pb-3 flex items-center gap-4 text-[11px] text-neutral-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ann.publish_start).toLocaleString("ja-JP")} 〜 {new Date(ann.publish_end).toLocaleString("ja-JP")}
                        </span>
                        <span>更新: {new Date(ann.updated_at).toLocaleString("ja-JP")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )} {/* end pageTab === "announcements" */}

        {/* ===== ご意見・フィードバック管理タブ ===== */}
        {pageTab === "feedbacks" && (
          <div className="font-sans">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-base font-medium text-neutral-200 flex items-center gap-2">
                  <MessageSquareHeart className="w-4 h-4 text-rose-400" />
                  ユーザーのご意見・ご要望一覧
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">ユーザーから匿名で寄せられたご意見や不具合報告を確認できます。</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchFeedbacks}
                  className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-300"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span>更新</span>
                </button>
              </div>
            </div>

            {/* フィルター */}
            <div className="flex gap-2 mb-4 text-xs">
              {(["all", "unread", "read", "resolved"] as const).map(st => {
                const count = st === "all" ? feedbacks.length : feedbacks.filter(f => f.status === st).length;
                const label = st === "all" ? "すべて" : st === "unread" ? "未読" : st === "read" ? "既読" : "対応済み";
                return (
                  <button
                    key={st}
                    onClick={() => setFeedbackFilter(st)}
                    className={`px-3 py-1.5 rounded-lg border transition-colors ${feedbackFilter === st ? "bg-neutral-800 text-neutral-100 border-neutral-700 font-medium" : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {feedbacksLoading ? (
              <div className="text-center py-16 text-neutral-500 text-sm tracking-widest">読み込み中...</div>
            ) : feedbacks.length === 0 ? (
              <div className="text-center py-16 text-neutral-500 text-sm">ご意見はまだ届いていません。</div>
            ) : (
              <div className="space-y-3">
                {feedbacks
                  .filter(f => feedbackFilter === "all" || f.status === feedbackFilter)
                  .map(f => {
                    const categoryBadge = {
                      opinion: { label: "ご意見",   color: "bg-blue-950/40 text-blue-300 border-blue-800/40" },
                      request: { label: "機能要望", color: "bg-purple-950/40 text-purple-300 border-purple-800/40" },
                      bug:     { label: "不具合",   color: "bg-rose-950/40 text-rose-300 border-rose-800/40" },
                      other:   { label: "その他",   color: "bg-neutral-800 text-neutral-400 border-neutral-700" },
                    }[f.category] || { label: f.category, color: "bg-neutral-800 text-neutral-400 border-neutral-700" };

                    return (
                      <div key={f.id} className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 transition-colors">
                        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] border font-medium ${categoryBadge.color}`}>
                              {categoryBadge.label}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {new Date(f.created_at).toLocaleString("ja-JP")}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* ステータス切り替え */}
                            <select
                              value={f.status}
                              disabled={role !== "admin"}
                              onChange={(e) => handleUpdateFeedbackStatus(f.id, e.target.value as FeedbackStatus)}
                              className="text-xs px-2.5 py-1 bg-neutral-950 border border-neutral-700 rounded-lg text-neutral-300 outline-none focus:border-neutral-500"
                            >
                              <option value="unread">未読</option>
                              <option value="read">既読</option>
                              <option value="resolved">対応済み</option>
                            </select>

                            {role === "admin" && (
                              <button
                                onClick={() => handleDeleteFeedback(f.id)}
                                className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                                title="削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed break-words bg-neutral-950/40 p-3 rounded-lg border border-neutral-900">
                          {f.content}
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ===== 分析タブ ===== */}
        {pageTab === "analytics" && (
          <div className="font-sans">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-base font-medium text-neutral-200 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-400" />
                  分析ダッシュボード
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">日次推移・寿命分布・PR効果・露出の偏りを確認できます。</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-neutral-900/60 border border-neutral-800 rounded-lg p-0.5 gap-0.5">
                  {[7, 30, 90].map(d => (
                    <button
                      key={d}
                      onClick={() => { setTrendDays(d); fetchAnalytics(d); }}
                      className={`px-2.5 py-1.5 rounded text-xs transition-colors ${trendDays === d ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
                    >
                      {d}日
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => fetchAnalytics(trendDays)}
                  disabled={analyticsLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors text-sm text-neutral-300"
                >
                  <RefreshCcw className={`w-4 h-4 ${analyticsLoading ? "animate-spin" : ""}`} />
                  <span>更新</span>
                </button>
              </div>
            </div>

            {analyticsError && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2 mb-4">
                {analyticsError}
              </div>
            )}

            {analyticsLoading ? (
              <div className="text-center py-16 text-neutral-500 text-sm tracking-widest">読み込み中...</div>
            ) : (
              <div className="space-y-6">
                {/* --- 日別推移グラフ --- */}
                <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="text-sm font-medium text-neutral-200">日別推移（直近{trendDays}日 · JST基準）</h3>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />表示</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" />共鳴</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />投稿</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-purple-400" />消滅</span>
                    </div>
                  </div>
                  {trends.length === 0 ? (
                    <p className="text-xs text-neutral-500 py-8 text-center">該当期間のデータがありません。</p>
                  ) : (() => {
                    const maxViews = Math.max(1, ...trends.map(t => Number(t.views)));
                    const maxRes = Math.max(1, ...trends.map(t => Number(t.resonances)));
                    const maxPosts = Math.max(1, ...trends.map(t => Number(t.posts)));
                    const maxDeaths = Math.max(1, ...trends.map(t => Number(t.deaths)));
                    const h = (v: number, m: number) => `${Math.max(Number(v) > 0 ? 4 : 0, (Number(v) / m) * 100)}%`;
                    return (
                      <>
                        <div className="flex items-end gap-[3px] h-40 overflow-x-auto pb-1 border-b border-neutral-800">
                          {trends.map(t => (
                            <div key={t.day} className="flex items-end gap-[2px] h-full min-w-[10px] flex-1" title={`${t.day} — 表示 ${t.views} / 共鳴 ${t.resonances} / 投稿 ${t.posts} / 消滅 ${t.deaths}`}>
                              <div className="flex-1 bg-blue-500/80 rounded-t-sm" style={{ height: h(t.views, maxViews) }} />
                              <div className="flex-1 bg-red-400/80 rounded-t-sm" style={{ height: h(t.resonances, maxRes) }} />
                              <div className="flex-1 bg-emerald-500/80 rounded-t-sm" style={{ height: h(t.posts, maxPosts) }} />
                              <div className="flex-1 bg-purple-400/80 rounded-t-sm" style={{ height: h(t.deaths, maxDeaths) }} />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                          <span>{trends[0]?.day.slice(5).replace("-", "/")}</span>
                          <span>{trends[Math.floor(trends.length / 2)]?.day.slice(5).replace("-", "/")}</span>
                          <span>{trends[trends.length - 1]?.day.slice(5).replace("-", "/")}</span>
                        </div>
                      </>
                    );
                  })()}
                </section>

                {/* --- 寿命サマリー --- */}
                {lifecycle && (
                  <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 md:p-5">
                    <h3 className="text-sm font-medium text-neutral-200 mb-3">寿命サマリー（消滅した投稿 {lifecycle.total_died} 件）</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: "平均 最終表示数", value: Number(lifecycle.avg_final_views).toFixed(1) },
                        { label: "最大表示数",       value: Number(lifecycle.max_final_views).toLocaleString() },
                        { label: "平均生存時間",     value: `${(Number(lifecycle.avg_lifespan_hours) / 24).toFixed(1)}日` },
                        { label: "寿命完遂率",       value: boostStats ? `${boostStats.full_life_ratio}%` : "—" },
                      ].map(c => (
                        <div key={c.label} className="bg-neutral-950/40 border border-neutral-800 rounded-lg p-3">
                          <p className="text-[11px] text-neutral-500 mb-1">{c.label}</p>
                          <p className="text-lg font-light text-neutral-100">{c.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      {/* 消滅理由 */}
                      <div>
                        <p className="text-xs text-neutral-400 mb-2">消滅理由の内訳</p>
                        {lifecycle.by_reason.length === 0 ? <p className="text-xs text-neutral-600">データなし</p> : (
                          <div className="space-y-1.5">
                            {lifecycle.by_reason.map(r => {
                              const total = lifecycle.total_died || 1;
                              const pct = Math.round((r.count / total) * 100);
                              return (
                                <div key={r.reason} className="text-xs">
                                  <div className="flex justify-between text-neutral-400 mb-0.5">
                                    <span>{r.reason === "view_limit" ? "寿命到達" : r.reason === "deleted" ? "管理者削除" : r.reason}</span>
                                    <span className="tabular-nums">{r.count}件（{pct}%）</span>
                                  </div>
                                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500/70 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* モード別 */}
                      <div>
                        <p className="text-xs text-neutral-400 mb-2">モード別</p>
                        <div className="space-y-1.5 text-xs">
                          {lifecycle.by_mode.map(m => (
                            <div key={m.mode} className="flex justify-between bg-neutral-950/40 border border-neutral-800 rounded-lg px-3 py-2">
                              <span className="text-neutral-300">{m.mode === "bubble" ? "泡沫" : "遺言"}</span>
                              <span className="text-neutral-500 tabular-nums">{m.count}件 · 平均{Number(m.avg_final_views).toFixed(1)}表示</span>
                            </div>
                          ))}
                          {lifecycle.by_mode.length === 0 && <p className="text-neutral-600">データなし</p>}
                        </div>
                      </div>

                      {/* 表示数分布 */}
                      <div>
                        <p className="text-xs text-neutral-400 mb-2">最終表示数の分布</p>
                        {(() => {
                          const max = Math.max(1, ...lifecycle.view_distribution.map(v => v.count));
                          return (
                            <div className="space-y-1.5">
                              {lifecycle.view_distribution.map(v => (
                                <div key={v.bucket} className="text-xs">
                                  <div className="flex justify-between text-neutral-400 mb-0.5">
                                    <span>{v.bucket}回</span><span className="tabular-nums">{v.count}件</span>
                                  </div>
                                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500/70 rounded-full" style={{ width: `${(v.count / max) * 100}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </section>
                )}

                {/* --- PR効果測定 --- */}
                {prEffect && (
                  <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 md:p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-medium text-neutral-200">PR効果測定</h3>
                      <span className="text-[11px] text-neutral-500">
                        PR期間 {prEffect.total_periods}件（進行中 {prEffect.active_periods}件）· 対象投稿 {prEffect.pr_posts}件
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3">
                        <p className="text-[11px] text-amber-400/80 mb-1">PR期間中の日次表示リフト</p>
                        <p className="text-lg font-light text-neutral-100">
                          {prEffect.lift_daily_views_pct === null ? "—" : `${prEffect.lift_daily_views_pct > 0 ? "+" : ""}${prEffect.lift_daily_views_pct}%`}
                        </p>
                      </div>
                      <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3">
                        <p className="text-[11px] text-amber-400/80 mb-1">PR期間中の日次共鳴リフト</p>
                        <p className="text-lg font-light text-neutral-100">
                          {prEffect.lift_daily_resonances_pct === null ? "—" : `${prEffect.lift_daily_resonances_pct > 0 ? "+" : ""}${prEffect.lift_daily_resonances_pct}%`}
                        </p>
                      </div>
                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-lg p-3">
                        <p className="text-[11px] text-neutral-500 mb-1">PR期間中の日次表示 平均</p>
                        <p className="text-lg font-light text-neutral-100 tabular-nums">{Number(prEffect.pr.avg_daily_views)}</p>
                      </div>
                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-lg p-3">
                        <p className="text-[11px] text-neutral-500 mb-1">PR期間中の日次共鳴 平均</p>
                        <p className="text-lg font-light text-neutral-100 tabular-nums">{Number(prEffect.pr.avg_daily_resonances)}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-neutral-500 border-b border-neutral-800">
                            <th className="text-left font-normal py-2 pr-4">比較対象</th>
                            <th className="text-right font-normal py-2 px-4">観測日数</th>
                            <th className="text-right font-normal py-2 px-4">総表示</th>
                            <th className="text-right font-normal py-2 px-4">日次表示 平均</th>
                            <th className="text-right font-normal py-2 px-4">日次共鳴 平均</th>
                          </tr>
                        </thead>
                        <tbody className="text-neutral-300">
                          {[
                            { label: "PR期間中（同一投稿）", b: prEffect.pr },
                            { label: "PR外（同一投稿）",     b: prEffect.non_pr_same_posts },
                            { label: "参照群（一度もPRしない投稿）", b: prEffect.non_pr_other_posts },
                          ].map(row => (
                            <tr key={row.label} className="border-b border-neutral-800/60">
                              <td className="py-2 pr-4">{row.label}</td>
                              <td className="py-2 px-4 text-right tabular-nums">{row.b.day_rows}</td>
                              <td className="py-2 px-4 text-right tabular-nums">{row.b.views.toLocaleString()}</td>
                              <td className="py-2 px-4 text-right tabular-nums">{Number(row.b.avg_daily_views)}</td>
                              <td className="py-2 px-4 text-right tabular-nums">{Number(row.b.avg_daily_resonances)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {prEffect.total_periods === 0 && (
                      <p className="text-[11px] text-neutral-600 mt-2">※ まだPR期間の記録がありません。投稿のプロモーションをONにすると計測が始まります。</p>
                    )}
                  </section>
                )}

                {/* --- 微ブースト効果検証（露出の偏り） --- */}
                {boostStats && (
                  <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 md:p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-medium text-neutral-200">微ブースト効果検証（露出の偏り）</h3>
                      <span className="text-[11px] text-neutral-500">生存中 {boostStats.alive_total} 件</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-lg p-3">
                        <p className="text-[11px] text-neutral-500 mb-1">一度も表示されていない投稿（view=0）</p>
                        <p className="text-lg font-light text-neutral-100">
                          {boostStats.never_shown}件
                          <span className="text-xs text-neutral-500 ml-1.5">
                            {boostStats.alive_total > 0 ? `${Math.round((boostStats.never_shown / boostStats.alive_total) * 100)}%` : "—"}
                          </span>
                        </p>
                      </div>
                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-lg p-3">
                        <p className="text-[11px] text-neutral-500 mb-1">飢餓投稿（3日経過・2回以下）</p>
                        <p className="text-lg font-light text-neutral-100">
                          {boostStats.starved}件
                          <span className="text-xs text-neutral-500 ml-1.5">
                            {boostStats.alive_total > 0 ? `${Math.round((boostStats.starved / boostStats.alive_total) * 100)}%` : "—"}
                          </span>
                        </p>
                      </div>
                      <div className="col-span-2 md:col-span-1 bg-neutral-950/40 border border-neutral-800 rounded-lg p-3">
                        <p className="text-[11px] text-neutral-500 mb-1">寿命完遂率（自然消滅の割合）</p>
                        <p className="text-lg font-light text-neutral-100 tabular-nums">{boostStats.full_life_ratio}%</p>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-400 mb-2">生存中投稿の表示回数分布</p>
                    {(() => {
                      const max = Math.max(1, ...boostStats.view_distribution.map(v => v.count));
                      return (
                        <div className="flex items-end gap-3 h-32">
                          {boostStats.view_distribution.map(v => (
                            <div key={v.bucket} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                              <span className="text-[10px] text-neutral-400 tabular-nums">{v.count}</span>
                              <div
                                className="w-full bg-emerald-500/60 rounded-t-sm min-h-[2px]"
                                style={{ height: `${Math.max((v.count / max) * 100, 2)}%` }}
                                title={`${v.bucket}回 — ${v.count}件 · 平均経過 ${v.avg_age_days}日`}
                              />
                              <span className="text-[10px] text-neutral-500">{v.bucket}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <p className="text-[11px] text-neutral-600 mt-3">
                      ※ ブーストが機能している場合、view=0 ・飢餓投稿は少数に収まり、寿命完遂率が高くなります。
                    </p>
                  </section>
                )}
              </div>
            )}
          </div>
        )}

            {/* お知らせ作成・編集モーダル */}
            {annModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) setAnnModalOpen(false); }}
              >
                <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
                    <div className="flex items-center gap-2.5">
                      <Megaphone className="w-4 h-4 text-neutral-400" />
                      <h2 className="text-sm font-medium text-neutral-200">
                        {annEditing ? "お知らせを編集" : "新しいお知らせを作成"}
                      </h2>
                    </div>
                    <button onClick={() => setAnnModalOpen(false)}
                      className="p-1.5 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="px-5 py-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                    {/* タイトル */}
                    <div>
                      <label className="text-xs text-neutral-400 mb-1.5 block">タイトル</label>
                      <input
                        type="text"
                        value={annTitle}
                        onChange={e => setAnnTitle(e.target.value)}
                        placeholder="お知らせのタイトル"
                        className="w-full px-4 py-2.5 bg-neutral-800/60 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
                      />
                    </div>

                    {/* 本文 */}
                    <div>
                      <label className="text-xs text-neutral-400 mb-1.5 block">本文</label>
                      <textarea
                        value={annContent}
                        onChange={e => setAnnContent(e.target.value)}
                        placeholder="お知らせの内容"
                        rows={5}
                        className="w-full px-4 py-3 bg-neutral-800/60 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
                      />
                    </div>

                    {/* 掲載期間 */}
                    <div>
                      <label className="text-xs text-neutral-400 mb-1.5 block">掲載開始日時</label>
                      <input
                        type="datetime-local"
                        value={annPublishStart}
                        onChange={e => setAnnPublishStart(e.target.value)}
                        className="w-full px-4 py-2.5 bg-neutral-800/60 border border-neutral-700 rounded-xl text-sm text-neutral-200 outline-none focus:border-neutral-500 transition-colors [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400 mb-1.5 block">掲載終了日時</label>
                      <input
                        type="datetime-local"
                        value={annPublishEnd}
                        onChange={e => setAnnPublishEnd(e.target.value)}
                        className="w-full px-4 py-2.5 bg-neutral-800/60 border border-neutral-700 rounded-xl text-sm text-neutral-200 outline-none focus:border-neutral-500 transition-colors [color-scheme:dark]"
                      />
                    </div>

                    {/* ピン留め */}
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div
                        onClick={() => setAnnIsPinned(v => !v)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${annIsPinned ? "bg-amber-500" : "bg-neutral-700"}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${annIsPinned ? "translate-x-5" : "translate-x-1"}`} />
                      </div>
                      <div>
                        <p className="text-sm text-neutral-200 flex items-center gap-1.5">
                          <Pin className="w-3.5 h-3.5 text-amber-400" />
                          画面上部に固定表示
                        </p>
                        <p className="text-xs text-neutral-500">ONにすると最上部に優先表示されます</p>
                      </div>
                    </label>

                    {annFormError && (
                      <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{annFormError}</p>
                    )}

                    <div className="flex gap-2 justify-end pt-1">
                      <button onClick={() => setAnnModalOpen(false)}
                        className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 border border-neutral-700 rounded-lg transition-colors">
                        キャンセル
                      </button>
                      <button
                        onClick={handleAnnSave}
                        disabled={!annTitle.trim() || !annContent.trim() || !annPublishStart || !annPublishEnd || annSaving}
                        className="px-5 py-2 text-sm font-medium bg-neutral-100 text-neutral-900 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {annSaving ? "保存中..." : annEditing ? "更新する" : "作成する"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

        {/* ===== 投稿フォームモーダル ===== */}
        {postModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setPostModalOpen(false); }}
          >
            <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl font-sans overflow-hidden">
              {/* モーダルヘッダー */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <PenTool className="w-4 h-4 text-neutral-400" />
                  <h2 className="text-sm font-medium text-neutral-200 tracking-wide">新しい投稿を作成</h2>
                </div>
                <button
                  onClick={() => setPostModalOpen(false)}
                  className="p-1.5 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* モーダル本体 */}
              <div className="px-5 py-4 flex flex-col gap-4">
                {/* モード選択 */}
                <div className="flex bg-neutral-800/60 border border-neutral-700 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => { setPostMode("bubble"); setPostContent(""); setPostError(null); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${postMode === "bubble" ? "bg-blue-950/70 text-blue-300 border border-blue-800/50" : "text-neutral-500 hover:text-neutral-300"}`}
                  >
                    泡沫 <span className="text-xs font-normal opacity-70">（短文 · 60文字）</span>
                  </button>
                  <button
                    onClick={() => { setPostMode("will"); setPostContent(""); setPostError(null); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${postMode === "will" ? "bg-purple-950/70 text-purple-300 border border-purple-800/50" : "text-neutral-500 hover:text-neutral-300"}`}
                  >
                    遺言 <span className="text-xs font-normal opacity-70">（長文 · 800文字）</span>
                  </button>
                </div>

                {/* テキストエリア */}
                <div className="relative">
                  <textarea
                    autoFocus
                    value={postContent}
                    onChange={(e) => { setPostContent(e.target.value); setPostError(null); }}
                    placeholder={postMode === "bubble" ? "泡沫のような短い言葉を..." : "遺言のような長い想いを..."}
                    rows={postMode === "bubble" ? 3 : 7}
                    maxLength={maxPostChars}
                    className="w-full px-4 py-3 bg-neutral-800/60 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none font-serif leading-relaxed"
                  />
                  <span className={`absolute bottom-3 right-3 text-[11px] tabular-nums transition-colors ${postContent.length > maxPostChars * 0.9 ? "text-amber-400" : "text-neutral-600"}`}>
                    {postContent.length} / {maxPostChars}
                  </span>
                </div>

                {/* エラー表示 */}
                {postError && (
                  <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
                    {postError}
                  </p>
                )}

                {/* アクションボタン */}
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={() => setPostModalOpen(false)}
                    className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 border border-neutral-700 rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handlePost}
                    disabled={!postContent.trim() || posting || postContent.length > maxPostChars}
                    className="px-5 py-2 text-sm font-medium bg-neutral-100 text-neutral-900 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {posting ? "投稿中..." : "投稿する"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
