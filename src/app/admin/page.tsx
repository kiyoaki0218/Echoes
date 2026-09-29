"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminEchoes, deleteAdminEcho, logoutAdmin } from "@/app/actions/admin";
import { Trash2, LogOut, RefreshCcw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";

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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchEchoes = useCallback(async (page: number, mode: "all" | "bubble" | "will") => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminEchoes(page, mode);
      setEchoes(result.data as Echo[]);
      setTotalCount(result.totalCount);
    } catch (err: any) {
      setError(err.message || "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEchoes(currentPage, filterMode);
  }, [currentPage, filterMode, fetchEchoes]);

  const handleFilterChange = (mode: "all" | "bubble" | "will") => {
    setFilterMode(mode);
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

  // ページ番号リスト（最大7件表示）
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
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

  return (
    <div className="min-h-screen bg-black text-neutral-200 font-serif p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between border-b border-neutral-800 pb-6 mb-6">
          <div>
            <h1 className="text-2xl tracking-widest text-neutral-300 font-light mb-1">管理者ダッシュボード</h1>
            <p className="text-sm font-sans text-neutral-500">全投稿の管理</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => fetchEchoes(currentPage, filterMode)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm font-sans text-neutral-300"
            >
              <RefreshCcw className="w-4 h-4" />
              更新
            </button>
            <button
              onClick={() => logoutAdmin()}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm font-sans text-neutral-300"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </div>
        </header>

        {/* フィルター */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex bg-neutral-900/50 p-1 rounded-full w-fit border border-neutral-800">
            <button
              onClick={() => handleFilterChange("all")}
              className={`px-6 py-2 rounded-full text-sm transition-colors ${filterMode === "all" ? "bg-neutral-800 text-neutral-200" : "text-neutral-500 hover:text-neutral-300"}`}
            >
              すべて
            </button>
            <button
              onClick={() => handleFilterChange("bubble")}
              className={`px-6 py-2 rounded-full text-sm transition-colors ${filterMode === "bubble" ? "bg-neutral-800 text-neutral-200" : "text-neutral-500 hover:text-neutral-300"}`}
            >
              短文
            </button>
            <button
              onClick={() => handleFilterChange("will")}
              className={`px-6 py-2 rounded-full text-sm transition-colors ${filterMode === "will" ? "bg-neutral-800 text-neutral-200" : "text-neutral-500 hover:text-neutral-300"}`}
            >
              長文
            </button>
          </div>
          {!loading && (
            <p className="text-xs text-neutral-500 font-sans">
              全 <span className="text-neutral-300">{totalCount.toLocaleString()}</span> 件
              {totalPages > 1 && (
                <> · {currentPage} / {totalPages} ページ</>
              )}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-900/50 text-red-400 p-4 rounded-lg mb-6 font-sans">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-neutral-500 font-sans tracking-widest">
            読み込み中...
          </div>
        ) : (
          <>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden font-sans">
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
                    {echoes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                          投稿がありません
                        </td>
                      </tr>
                    ) : (
                      echoes.map((echo) => (
                        <tr key={echo.id} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-neutral-400 text-xs">
                            {new Date(echo.created_at).toLocaleString('ja-JP')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs ${echo.mode === 'bubble' ? 'bg-blue-950/50 text-blue-300 border border-blue-900/50' : 'bg-purple-950/50 text-purple-300 border border-purple-900/50'}`}>
                              {echo.mode === 'bubble' ? '泡沫' : '遺言'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-neutral-300">
                            <div className={`max-w-xl font-serif whitespace-pre-wrap ${!expandedIds.has(echo.id) && echo.mode === 'will' ? 'line-clamp-2' : ''}`}>
                              {echo.content}
                            </div>
                            {echo.mode === 'will' && (
                              <button
                                onClick={() => toggleExpand(echo.id)}
                                className="mt-2 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors font-sans"
                              >
                                {expandedIds.has(echo.id) ? (
                                  <><ChevronUp className="w-3 h-3" />折りたたむ</>
                                ) : (
                                  <><ChevronDown className="w-3 h-3" />すべて表示</>
                                )}
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-6 font-sans">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="前のページ"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {getPageNumbers().map((page, i) =>
                  page === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-neutral-600 select-none">…</span>
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
                  title="次のページ"
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