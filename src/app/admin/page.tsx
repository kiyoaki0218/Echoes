"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminEchoes, deleteAdminEcho, logoutAdmin, getAdminStats } from "@/app/actions/admin";
import { Trash2, LogOut, RefreshCcw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText, BarChart2, Heart, Zap, Search, X, Menu } from "lucide-react";

type Echo = {
  id: string;
  created_at: string;
  content: string;
  mode: string;
  view_count: number;
  max_views: number;
  resonance_count: number;
};

const PAGE_SIZE = 50;

export default function AdminDashboard() {
  const [echoes, setEchoes] = useState<Echo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "bubble" | "will">("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 検索・日時フィルター（入力中）
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // 確定済みフィルター
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");

  // モバイル: 検索パネルの開閉
  const [searchOpen, setSearchOpen] = useState(false);

  const isFiltered = appliedKeyword || appliedDateFrom || appliedDateTo;

  type Stats = { totalCount: number; todayCount: number; totalResonance: number; activeCount: number };
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchEchoes = useCallback(async (
    page: number,
    mode: "all" | "bubble" | "will",
    kw: string,
    df: string,
    dt: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminEchoes(page, mode, kw, df, dt);
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
    } catch {
      // 統計取得失敗は非致命的
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEchoes(currentPage, filterMode, appliedKeyword, appliedDateFrom, appliedDateTo);
  }, [currentPage, filterMode, appliedKeyword, appliedDateFrom, appliedDateTo, fetchEchoes]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
    setKeyword("");
    setDateFrom("");
    setDateTo("");
    setAppliedKeyword("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("本当にこの投稿を強制削除しますか？")) return;
    try {
      await deleteAdminEcho(id);
      setEchoes(prev => prev.filter(echo => echo.id !== id));
      setTotalCount(prev => prev - 1);
    } catch (err: any) {
      alert(err.message || "削除に失敗しました");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  // モードバッジの共通スタイル
  const modeBadge = (mode: string) =>
    `px-2 py-0.5 rounded text-xs border ${mode === "bubble" ? "bg-blue-950/50 text-blue-300 border-blue-900/50" : "bg-purple-950/50 text-purple-300 border-purple-900/50"}`;

  return (
    <div className="min-h-screen bg-black text-neutral-200 font-serif p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* ===== ヘッダー ===== */}
        <header className="flex items-center justify-between border-b border-neutral-800 pb-4 md:pb-6 mb-4 md:mb-6 gap-3">
          <div>
            <h1 className="text-lg md:text-2xl tracking-widest text-neutral-300 font-light leading-tight">管理者ダッシュボード</h1>
            <p className="text-xs md:text-sm font-sans text-neutral-500 mt-0.5">全投稿の管理</p>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {/* モバイル: アイコンのみ / デスクトップ: テキスト付き */}
            <button
              onClick={() => { fetchEchoes(currentPage, filterMode, appliedKeyword, appliedDateFrom, appliedDateTo); fetchStats(); }}
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

        {/* ===== サマリーカード ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          {[
            { label: "本日の投稿数", value: stats?.todayCount, icon: <Zap className="w-4 h-4" />, color: "text-yellow-400", bg: "bg-yellow-950/20 border-yellow-900/30" },
            { label: "総投稿数",     value: stats?.totalCount,     icon: <FileText className="w-4 h-4" />, color: "text-blue-400",    bg: "bg-blue-950/20 border-blue-900/30" },
            { label: "総共鳴数",     value: stats?.totalResonance, icon: <Heart className="w-4 h-4" />,    color: "text-red-400",     bg: "bg-red-950/20 border-red-900/30" },
            { label: "アクティブ",   value: stats?.activeCount,    icon: <BarChart2 className="w-4 h-4" />, color: "text-emerald-400", bg: "bg-emerald-950/20 border-emerald-900/30" },
          ].map(({ label, value, icon, color, bg }) => (
            <div key={label} className={`border rounded-xl p-3 md:p-4 flex flex-col gap-2 md:gap-3 ${bg}`}>
              <div className={`flex items-center gap-1.5 text-[11px] md:text-xs font-sans font-medium tracking-wider ${color}`}>
                {icon}
                <span className="truncate">{label}</span>
              </div>
              {statsLoading ? (
                <div className="h-6 md:h-7 w-14 bg-neutral-800 animate-pulse rounded" />
              ) : (
                <p className="text-xl md:text-2xl font-light text-neutral-100 font-sans">
                  {value?.toLocaleString() ?? "—"}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ===== 検索パネル ===== */}
        {/* モバイル: トグルボタンで開閉 / デスクトップ: 常時表示 */}
        <div className="mb-4">
          {/* モバイル用トグルボタン */}
          <button
            className="md:hidden flex items-center gap-2 w-full px-4 py-2.5 bg-neutral-900/60 border border-neutral-800 rounded-xl text-sm font-sans text-neutral-400 hover:text-neutral-200 transition-colors mb-2"
            onClick={() => setSearchOpen(v => !v)}
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">
              {isFiltered ? <span className="text-neutral-200">絞り込み中</span> : "検索・絞り込み"}
            </span>
            {isFiltered && (
              <span className="text-[10px] bg-neutral-700 text-neutral-300 rounded-full px-2 py-0.5">適用中</span>
            )}
            <Menu className="w-4 h-4" />
          </button>

          {/* パネル本体（デスクトップ常時表示 / モバイルはトグル） */}
          <div className={`bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 font-sans ${searchOpen ? "block" : "hidden md:block"}`}>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="投稿テキストで検索..."
                    className="w-full pl-9 pr-4 py-2 bg-neutral-800/60 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-neutral-500 transition-colors"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-neutral-200 text-neutral-900 rounded-lg text-sm font-medium hover:bg-white transition-colors whitespace-nowrap"
                >
                  検索
                </button>
                {isFiltered && (
                  <button
                    onClick={handleClearSearch}
                    className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200 rounded-lg text-sm transition-colors whitespace-nowrap"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">クリア</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-400 flex-wrap">
                <span className="whitespace-nowrap text-xs">投稿日:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="flex-1 min-w-[130px] px-3 py-1.5 bg-neutral-800/60 border border-neutral-700 rounded-lg text-sm text-neutral-200 outline-none focus:border-neutral-500 transition-colors [color-scheme:dark]"
                />
                <span className="text-neutral-600 text-xs">〜</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="flex-1 min-w-[130px] px-3 py-1.5 bg-neutral-800/60 border border-neutral-700 rounded-lg text-sm text-neutral-200 outline-none focus:border-neutral-500 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===== モードフィルター & 件数 ===== */}
        <div className="flex items-center justify-between mb-4 md:mb-6 gap-3 flex-wrap">
          <div className="flex bg-neutral-900/50 p-1 rounded-full w-fit border border-neutral-800">
            {(["all", "bubble", "will"] as const).map(m => (
              <button
                key={m}
                onClick={() => handleFilterChange(m)}
                className={`px-4 md:px-6 py-1.5 md:py-2 rounded-full text-xs md:text-sm transition-colors ${filterMode === m ? "bg-neutral-800 text-neutral-200" : "text-neutral-500 hover:text-neutral-300"}`}
              >
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

        {error && (
          <div className="bg-red-950/30 border border-red-900/50 text-red-400 p-4 rounded-lg mb-4 md:mb-6 font-sans text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-neutral-500 font-sans tracking-widest text-sm">
            読み込み中...
          </div>
        ) : echoes.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 font-sans text-sm">
            {isFiltered ? "条件に一致する投稿がありません" : "投稿がありません"}
          </div>
        ) : (
          <>
            {/* ===== デスクトップ: テーブル表示 ===== */}
            <div className="hidden md:block bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden font-sans">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400">
                    <tr>
                      <th className="px-6 py-4 font-medium whitespace-nowrap">投稿日時</th>
                      <th className="px-6 py-4 font-medium whitespace-nowrap">モード</th>
                      <th className="px-6 py-4 font-medium w-full">内容</th>
                      <th className="px-6 py-4 font-medium whitespace-nowrap text-right">閲覧数</th>
                      <th className="px-6 py-4 font-medium whitespace-nowrap text-right">共鳴数</th>
                      <th className="px-6 py-4 font-medium whitespace-nowrap text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {echoes.map(echo => (
                      <tr key={echo.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-neutral-400 text-xs">
                          {new Date(echo.created_at).toLocaleString("ja-JP")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={modeBadge(echo.mode)}>
                            {echo.mode === "bubble" ? "泡沫" : "遺言"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-neutral-300">
                          <div className={`max-w-xl font-serif whitespace-pre-wrap ${!expandedIds.has(echo.id) && echo.mode === "will" ? "line-clamp-2" : ""}`}>
                            {echo.content}
                          </div>
                          {echo.mode === "will" && (
                            <button
                              onClick={() => toggleExpand(echo.id)}
                              className="mt-2 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors font-sans"
                            >
                              {expandedIds.has(echo.id)
                                ? <><ChevronUp className="w-3 h-3" />折りたたむ</>
                                : <><ChevronDown className="w-3 h-3" />すべて表示</>}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-neutral-400">
                          {echo.view_count} / {echo.max_views}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-neutral-400">
                          {echo.resonance_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDelete(echo.id)}
                            className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===== モバイル: カード表示 ===== */}
            <div className="md:hidden space-y-3 font-sans">
              {echoes.map(echo => (
                <div key={echo.id} className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden">
                  {/* カードヘッダー */}
                  <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-neutral-800/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={modeBadge(echo.mode)}>
                        {echo.mode === "bubble" ? "泡沫" : "遺言"}
                      </span>
                      <span className="text-[11px] text-neutral-500 truncate">
                        {new Date(echo.created_at).toLocaleString("ja-JP")}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(echo.id)}
                      className="shrink-0 p-1.5 text-neutral-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 本文 */}
                  <div className="px-4 py-3">
                    <p className={`text-sm text-neutral-300 font-serif whitespace-pre-wrap leading-relaxed ${!expandedIds.has(echo.id) && echo.mode === "will" ? "line-clamp-3" : ""}`}>
                      {echo.content}
                    </p>
                    {echo.mode === "will" && (
                      <button
                        onClick={() => toggleExpand(echo.id)}
                        className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        {expandedIds.has(echo.id)
                          ? <><ChevronUp className="w-3 h-3" />折りたたむ</>
                          : <><ChevronDown className="w-3 h-3" />すべて表示</>}
                      </button>
                    )}
                  </div>

                  {/* カードフッター: 統計 */}
                  <div className="px-4 pb-3 flex items-center gap-4 text-[11px] text-neutral-500">
                    <span>閲覧: <strong className="text-neutral-300">{echo.view_count}</strong> / {echo.max_views}</span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-red-500/60" />
                      <strong className="text-neutral-300">{echo.resonance_count}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* ===== ページネーション ===== */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-6 font-sans">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {getPageNumbers().map((page, i) =>
                  page === "..." ? (
                    <span key={`e-${i}`} className="px-2 text-neutral-600 select-none">…</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page as number)}
                      className={`min-w-[36px] h-9 px-2 rounded-lg text-sm transition-colors ${
                        currentPage === page
                          ? "bg-neutral-700 text-neutral-100 font-medium"
                          : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
