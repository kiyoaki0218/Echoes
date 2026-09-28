"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PenTool, X, Heart, Trash2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

type Mode = "bubble" | "will";
type DisplayMode = "all" | "bubble" | "will";

interface Echo {
  id: string;
  content: string;
  mode: Mode;
  view_count: number;
  max_views: number;
  resonance_count: number;
  created_at: string;
}

interface MyEchoStatus {
  id: string;
  content: string;
  mode: Mode;
  resonance_count: number;
  remaining_views: number;
  is_deleted: boolean;
}

// LocalStorageから共鳴済みIDセット取得
function getResonatedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved = localStorage.getItem("resonated_echoes");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
}

function saveResonatedIds(ids: Set<string>) {
  localStorage.setItem("resonated_echoes", JSON.stringify([...ids]));
}

export default function Home() {
  const [mode, setMode] = useState<DisplayMode>("all");
  const [currentEcho, setCurrentEcho] = useState<Echo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [resonateLoading, setResonateLoading] = useState<boolean>(false);
  const [fade, setFade] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resonatedIds, setResonatedIds] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState<boolean>(false);
  const [inputContent, setInputContent] = useState<string>("");
  const [formMode, setFormMode] = useState<Mode>("bubble");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [myEchoes, setMyEchoes] = useState<MyEchoStatus[]>([]);
  const [showMyList, setShowMyList] = useState<boolean>(false);
  const [myListTab, setMyListTab] = useState<Mode>("bubble");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const maxChars = formMode === "bubble" ? 60 : 800;

  // 指定投稿メイン画面表示
  const viewEchoOnMain = async (echo: MyEchoStatus) => {
    if (echo.is_deleted) return;
    setShowMyList(false);

    setFade(false);
    setErrorMsg(null);
    setTimeout(async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("echoes")
          .select("*")
          .eq("id", echo.id)
          .single();
        if (error || !data) {
          fetchRandomEcho(mode);
          return;
        }
        setMode(data.mode as DisplayMode);
        setCurrentEcho(data as Echo);
        await handleIncrementView(data.id);
      } catch {
        fetchRandomEcho(mode);
      } finally {
        setLoading(false);
        setFade(true);
      }
    }, 300);
  };

  const fetchRandomEcho = async (selectedMode: DisplayMode) => {
    setFade(false);
    setErrorMsg(null);
    setTimeout(async () => {
      try {
        setLoading(true);
        let targetMode: Mode;
        if (selectedMode === "all") {
          targetMode = Math.random() < 0.5 ? "bubble" : "will";
        } else {
          targetMode = selectedMode;
        }

        let { data, error } = await supabase.rpc("get_random_echo", {
          post_mode: targetMode,
        });

        // 選択されたモードで取得できなかった場合のフォールバック（"all"の場合）
        if (!error && (!data || data.length === 0) && selectedMode === "all") {
          const fallbackMode = targetMode === "bubble" ? "will" : "bubble";
          const res = await supabase.rpc("get_random_echo", { post_mode: fallbackMode });
          data = res.data;
          error = res.error;
        }

        if (error) throw error;
        if (data && data.length > 0) {
          const echo = data[0] as Echo;
          setCurrentEcho(echo);
          await handleIncrementView(echo.id);
        } else {
          setCurrentEcho(null);
        }
      } catch (err: unknown) {
        console.error("Error fetching random echo:", err);
        setErrorMsg("データの取得に失敗しました。Supabaseの接続設定（URL・Key）を確認してください。");
      } finally {
        setLoading(false);
        setFade(true);
      }
    }, 300);
  };

  const handleIncrementView = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc("increment_view", { post_id: id });
      if (error) throw error;
      if (data && data.status !== "deleted") {
        setCurrentEcho(prev =>
          prev && prev.id === id ? { ...prev, view_count: data.view_count } : prev
        );
      }
    } catch (err) {
      console.error("Error incrementing view:", err);
    }
  };

  const handleResonate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentEcho || resonateLoading) return;

    const alreadyResonated = resonatedIds.has(currentEcho.id);

    try {
      setResonateLoading(true);

      if (alreadyResonated) {
        const { error } = await supabase
          .from("echoes")
          .update({
            resonance_count: Math.max(0, currentEcho.resonance_count - 1),
            max_views: Math.max(currentEcho.view_count + 1, currentEcho.max_views - 10),
          })
          .eq("id", currentEcho.id);
        if (error) throw error;

        const newIds = new Set(resonatedIds);
        newIds.delete(currentEcho.id);
        setResonatedIds(newIds);
        saveResonatedIds(newIds);

        setCurrentEcho(prev => prev ? {
          ...prev,
          resonance_count: Math.max(0, prev.resonance_count - 1),
          max_views: Math.max(prev.view_count + 1, prev.max_views - 10),
        } : prev);

      } else {
        const { data, error } = await supabase.rpc("resonate_post", { post_id: currentEcho.id });
        if (error) throw error;
        if (data && data.status === "success") {
          const newIds = new Set(resonatedIds);
          newIds.add(currentEcho.id);
          setResonatedIds(newIds);
          saveResonatedIds(newIds);

          setCurrentEcho(prev => prev ? {
            ...prev,
            resonance_count: data.resonance_count,
            max_views: data.max_views,
          } : prev);
        }
      }
    } catch (err: unknown) {
      console.error("Error resonating:", err);
      alert("共鳴処理に失敗しました。");
    } finally {
      setResonateLoading(false);
    }
  };

  const openForm = () => {
    setInputContent("");
    if (mode === "bubble") {
      setFormMode("bubble");
    } else if (mode === "will") {
      setFormMode("will");
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || submitting) return;
    try {
      setSubmitting(true);
      const { data, error } = await supabase
        .from("echoes")
        .insert([{
          content: inputContent.trim(),
          mode: formMode,
          max_views: formMode === "bubble" ? 100 : 500,
        }])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const newEcho = data[0];
        saveMyEcho(newEcho.id, newEcho.content, formMode);
      }

      setShowForm(false);
      setInputContent("");
      fetchRandomEcho(mode);
    } catch (err: unknown) {
      console.error("Error submitting echo:", err);
      alert("投稿に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const saveMyEcho = (id: string, content: string, itemMode: Mode) => {
    try {
      const saved = localStorage.getItem("my_echoes");
      const list = saved ? JSON.parse(saved) : [];
      list.push({ id, content, mode: itemMode });
      localStorage.setItem("my_echoes", JSON.stringify(list));
      fetchMyEchoesStatus();
    } catch (err) {
      console.error("Error saving my echo:", err);
    }
  };

  const fetchMyEchoesStatus = async () => {
    try {
      const saved = localStorage.getItem("my_echoes");
      if (!saved) {
        setMyEchoes([]);
        return;
      }
      const list = JSON.parse(saved) as { id: string; content: string; mode?: Mode }[];
      if (list.length === 0) {
        setMyEchoes([]);
        return;
      }

      const ids = list.map(item => item.id);
      const { data, error } = await supabase
        .from("echoes")
        .select("id, content, mode, view_count, max_views, resonance_count")
        .in("id", ids);

      if (error) throw error;

      const dbMap = new Map((data || []).map(d => [d.id, d]));

      const statuses: MyEchoStatus[] = list.map(item => {
        const dbItem = dbMap.get(item.id);
        if (dbItem) {
          return {
            id: item.id,
            content: dbItem.content,
            mode: (dbItem.mode as Mode) || item.mode || "bubble",
            resonance_count: dbItem.resonance_count,
            remaining_views: Math.max(0, dbItem.max_views - dbItem.view_count),
            is_deleted: false,
          };
        } else {
          return {
            id: item.id,
            content: item.content,
            mode: item.mode || "bubble",
            resonance_count: 0,
            remaining_views: 0,
            is_deleted: true,
          };
        }
      });
      setMyEchoes(statuses.reverse());
    } catch (err) {
      console.error("Error fetching my echoes status:", err);
    }
  };

  const handleDeleteMyEcho = async (id: string, isDeletedFromDb: boolean) => {
    if (!confirm("この投稿をデータベースから完全に消去しますか？")) return;
    if (!isDeletedFromDb) {
      try {
        const { error } = await supabase.from("echoes").delete().eq("id", id);
        if (error) throw error;
      } catch (err: unknown) {
        console.error("Error deleting echo from DB:", err);
      }
    }
    const saved = localStorage.getItem("my_echoes");
    if (saved) {
      const list = JSON.parse(saved) as { id: string; content: string }[];
      localStorage.setItem("my_echoes", JSON.stringify(list.filter(item => item.id !== id)));
    }
    setMyEchoes(prev => prev.filter(echo => echo.id !== id));
    if (currentEcho && currentEcho.id === id) fetchRandomEcho(mode);
  };

  useEffect(() => {
    setResonatedIds(getResonatedIds());
    fetchRandomEcho(mode);
    fetchMyEchoesStatus();
  }, []);

  const handleModeChange = (newMode: DisplayMode) => {
    setMode(newMode);
    fetchRandomEcho(newMode);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isResonated = currentEcho ? resonatedIds.has(currentEcho.id) : false;

  const myBubbles = myEchoes.filter(e => e.mode === "bubble");
  const myWills = myEchoes.filter(e => e.mode === "will");

  return (
    <div
      className="flex flex-col min-h-screen bg-neutral-950 text-neutral-100 font-serif select-none justify-between overflow-hidden relative"
      onClick={() => fetchRandomEcho(mode)}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neutral-900 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

      {/* ヘッダー */}
      <header className="w-full max-w-4xl mx-auto px-6 py-8 flex justify-between items-center z-10" onClick={(e) => e.stopPropagation()}>
        <h1 className="text-xl tracking-[0.2em] font-light text-neutral-300">残響 <span className="text-xs text-neutral-500 font-sans tracking-normal ml-1">Echoes</span></h1>
        <div className="flex bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-full p-1 text-sm font-sans">
          <button onClick={() => handleModeChange("all")} className={`px-4 py-1.5 rounded-full transition-all duration-300 ${mode === "all" ? "bg-neutral-800 text-neutral-100 shadow-lg" : "text-neutral-500 hover:text-neutral-300"}`}>すべて</button>
          <button onClick={() => handleModeChange("bubble")} className={`px-4 py-1.5 rounded-full transition-all duration-300 ${mode === "bubble" ? "bg-neutral-800 text-neutral-100 shadow-lg" : "text-neutral-500 hover:text-neutral-300"}`}>短文</button>
          <button onClick={() => handleModeChange("will")} className={`px-4 py-1.5 rounded-full transition-all duration-300 ${mode === "will" ? "bg-neutral-800 text-neutral-100 shadow-lg" : "text-neutral-500 hover:text-neutral-300"}`}>長文</button>
        </div>
      </header>

      {/* メイン */}
      <main className="flex-1 flex flex-col justify-center items-center px-6 max-w-3xl mx-auto w-full z-10 cursor-pointer">
        <div className={`w-full transition-opacity duration-300 flex flex-col items-center ${fade ? "opacity-100" : "opacity-0"}`}>
          {loading ? (
            <div className="text-neutral-500 text-sm tracking-widest animate-pulse font-sans">投稿を取得しています...</div>
          ) : errorMsg ? (
            <div className="text-sm text-center tracking-wide font-sans max-w-md bg-red-950/20 border border-red-900/30 p-4 rounded-xl text-red-400/80">{errorMsg}</div>
          ) : currentEcho ? (
            <div className="w-full flex flex-col items-center text-center">
              {/* モードタグ（泡沫/遺言） */}
              <div className="mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-sans border ${currentEcho.mode === "bubble" ? "bg-blue-950/50 text-blue-300 border-blue-900/50" : "bg-purple-950/50 text-purple-300 border-purple-900/50"}`}>
                  {currentEcho.mode === "bubble" ? "泡沫" : "遺言"}
                </span>
              </div>

              <p className={`text-neutral-200 leading-relaxed font-light ${currentEcho.mode === "bubble" ? "text-2xl md:text-3xl tracking-wide font-normal max-w-xl" : "text-lg md:text-xl text-left tracking-normal max-w-2xl whitespace-pre-wrap font-light"}`}>
                {currentEcho.content}
              </p>

              <div className="w-full max-w-md mt-16 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                <div className="w-full h-[2px] bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-neutral-400 transition-all duration-500 ease-out" style={{ width: `${Math.min(100, (currentEcho.view_count / currentEcho.max_views) * 100)}%` }}></div>
                </div>
                <div className="flex justify-between text-[11px] text-neutral-500 font-sans tracking-wider">
                  <span>表示: {currentEcho.view_count} / {currentEcho.max_views}</span>
                  <span>（上限に達すると消滅します）</span>
                </div>
              </div>

              <div className="mt-8" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={handleResonate}
                  disabled={resonateLoading}
                  className={`group flex items-center gap-2 px-5 py-2.5 border rounded-full text-xs font-sans tracking-widest transition-all duration-300 active:scale-95 ${
                    isResonated
                      ? "bg-red-950/30 border-red-800/60 text-red-400 hover:bg-red-950/50"
                      : "bg-neutral-900/60 hover:bg-neutral-800/80 border-neutral-800/80 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 transition-transform group-hover:scale-125 ${isResonated ? "fill-red-500 text-red-500" : ""}`} />
                  <span>{isResonated ? `共鳴済み (${currentEcho.resonance_count})` : `共鳴する (${currentEcho.resonance_count})`}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-neutral-500 text-sm tracking-widest font-sans">表示できる投稿がありません。</p>
              <p className="text-neutral-600 text-xs mt-2 tracking-wider font-sans">画面をタップして再読み込みするか、新しく投稿してください。</p>
            </div>
          )}
        </div>
        {currentEcho && !loading && !errorMsg && (
          <div className="mt-16 text-[10px] text-neutral-600 font-sans tracking-widest animate-pulse pointer-events-none">画面をタップして次の投稿へ</div>
        )}
      </main>

      {/* フッター */}
      <footer className="w-full max-w-4xl mx-auto px-6 py-8 flex justify-between items-center z-20" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => { setShowMyList(true); fetchMyEchoesStatus(); }}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors font-sans tracking-wider border-b border-transparent hover:border-neutral-700 pb-0.5"
        >
          自分の残響
        </button>
        <button
          onClick={openForm}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-950 rounded-full text-xs font-sans font-medium hover:bg-neutral-200 transition-all active:scale-95 shadow-md"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>投稿する</span>
        </button>
      </footer>

      {/* 投稿フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-lg bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 md:p-8 flex flex-col min-h-[360px] relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300 transition-colors p-1"><X className="w-5 h-5" /></button>
            <h2 className="text-lg tracking-widest text-neutral-300 font-light mb-6">思考を残す</h2>
            <div className="flex border-b border-neutral-800 mb-6 font-sans">
              <button type="button" onClick={() => setFormMode("bubble")} className={`flex-1 pb-3 text-sm transition-all relative ${formMode === "bubble" ? "text-neutral-100 font-medium" : "text-neutral-500"}`}>
                短文 <span className="text-[10px] opacity-70">(最大60文字 / 100回表示)</span>
                {formMode === "bubble" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200"></div>}
              </button>
              <button type="button" onClick={() => setFormMode("will")} className={`flex-1 pb-3 text-sm transition-all relative ${formMode === "will" ? "text-neutral-100 font-medium" : "text-neutral-500"}`}>
                長文 <span className="text-[10px] opacity-70">(最大800文字 / 500回表示)</span>
                {formMode === "will" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200"></div>}
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1">
              <textarea
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                maxLength={maxChars}
                placeholder={formMode === "bubble" ? "思考を入力..." : "心に残る長文を入力..."}
                required
                className="w-full flex-1 min-h-[140px] bg-transparent text-neutral-200 border-0 outline-none resize-none placeholder-neutral-600 text-base font-light leading-relaxed mb-4 focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex justify-between items-center mt-auto pt-4 border-t border-neutral-800">
                <span className="text-xs text-neutral-500 font-sans">{inputContent.length} / {maxChars} 文字</span>
                <button type="submit" disabled={submitting || !inputContent.trim()} className="px-6 py-2 bg-neutral-100 text-neutral-950 hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 rounded-full text-xs font-sans font-medium transition-colors">
                  {submitting ? "送信中..." : "残す"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 自分の残響モーダル */}
      {showMyList && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-lg bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 md:p-8 flex flex-col max-h-[85vh] relative">
            <button onClick={() => setShowMyList(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300 transition-colors p-1"><X className="w-5 h-5" /></button>
            <h2 className="text-lg tracking-widest text-neutral-300 font-light mb-4">自分の残響</h2>

            {/* タブ */}
            <div className="flex border-b border-neutral-800 mb-4 font-sans">
              <button
                onClick={() => setMyListTab("bubble")}
                className={`flex-1 pb-2.5 text-sm transition-all relative ${myListTab === "bubble" ? "text-neutral-100 font-medium" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                短文 <span className="text-[10px] opacity-60">({myBubbles.length})</span>
                {myListTab === "bubble" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200"></div>}
              </button>
              <button
                onClick={() => setMyListTab("will")}
                className={`flex-1 pb-2.5 text-sm transition-all relative ${myListTab === "will" ? "text-neutral-100 font-medium" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                長文 <span className="text-[10px] opacity-60">({myWills.length})</span>
                {myListTab === "will" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200"></div>}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {(myListTab === "bubble" ? myBubbles : myWills).length === 0 ? (
                <p className="text-neutral-500 text-sm tracking-wider text-center py-12 font-sans">まだ投稿がありません。</p>
              ) : (
                (myListTab === "bubble" ? myBubbles : myWills).map((echo) => {
                  const isExpanded = expandedIds.has(echo.id);
                  const isLong = echo.mode === "will";
                  return (
                    <div key={echo.id} className="bg-neutral-950/50 border border-neutral-800/50 rounded-xl overflow-hidden">
                      <div className="p-4">
                        <div className="mb-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-sans border ${echo.mode === "bubble" ? "bg-blue-950/50 text-blue-300 border-blue-900/50" : "bg-purple-950/50 text-purple-300 border-purple-900/50"}`}>
                            {echo.mode === "bubble" ? "泡沫" : "遺言"}
                          </span>
                        </div>
                        {isLong ? (
                          <>
                            <p className={`text-sm text-neutral-300 italic font-light leading-relaxed whitespace-pre-wrap ${!isExpanded ? "line-clamp-3" : ""}`}>
                              {echo.content}
                            </p>
                            <button
                              onClick={() => toggleExpand(echo.id)}
                              className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors font-sans"
                            >
                              {isExpanded ? <><ChevronUp className="w-3 h-3" />折りたたむ</> : <><ChevronDown className="w-3 h-3" />すべて表示</>}
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-neutral-300 italic font-light">&ldquo;{echo.content}&rdquo;</p>
                        )}
                      </div>

                      <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t border-neutral-900/50 pt-2.5">
                        {echo.is_deleted ? (
                          <span className="text-[10px] text-neutral-600 font-sans">消滅済み</span>
                        ) : (
                          <span className="text-[10px] text-neutral-500 font-sans flex items-center gap-2">
                            <span>残り: <strong className="text-neutral-300">{echo.remaining_views}</strong> 回</span>
                            <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5 text-red-500/70 fill-red-950/20" />{echo.resonance_count}</span>
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {!echo.is_deleted && (
                            <button
                              onClick={() => viewEchoOnMain(echo)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-sans text-neutral-400 hover:text-neutral-100 bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/50 rounded-full transition-all"
                              title="この内容を表示"
                            >
                              <ExternalLink className="w-3 h-3" />
                              表示
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteMyEcho(echo.id, echo.is_deleted)}
                            className="text-neutral-600 hover:text-red-400 transition-colors p-1"
                            title="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
