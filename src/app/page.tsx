"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PenTool, X, Heart, Trash2 } from "lucide-react";

type Mode = "bubble" | "will";

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
  resonance_count: number;
  remaining_views: number;
  is_deleted: boolean;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("bubble");
  const [currentEcho, setCurrentEcho] = useState<Echo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [resonateLoading, setResonateLoading] = useState<boolean>(false);
  const [fade, setFade] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [showForm, setShowForm] = useState<boolean>(false);
  const [inputContent, setInputContent] = useState<string>("");
  const [formMode, setFormMode] = useState<Mode>("bubble");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [myEchoes, setMyEchoes] = useState<MyEchoStatus[]>([]);
  const [showMyList, setShowMyList] = useState<boolean>(false);

  const maxChars = formMode === "bubble" ? 60 : 800;

  const fetchRandomEcho = async (selectedMode: Mode) => {
    setFade(false);
    setErrorMsg(null);
    setTimeout(async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc("get_random_echo", {
          post_mode: selectedMode,
        });

        if (error) throw error;

        if (data && data.length > 0) {
          const echo = data[0] as Echo;
          setCurrentEcho(echo);
          await handleIncrementView(echo.id);
        } else {
          setCurrentEcho(null);
        }
      } catch (err: any) {
        console.error("Error fetching random echo:", err);
        setErrorMsg("データの取得に失敗しました。Supabaseの接続設定（URLやKey）を確認してください。");
      } finally {
        setLoading(false);
        setFade(true);
      }
    }, 300);
  };

  const handleIncrementView = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc("increment_view", {
        post_id: id,
      });
      if (error) throw error;
      
      if (data) {
        if (data.status !== "deleted") {
          setCurrentEcho(prev => {
            if (prev && prev.id === id) {
              return { ...prev, view_count: data.view_count };
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error("Error incrementing view:", err);
    }
  };

  const handleResonate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentEcho || resonateLoading) return;

    try {
      setResonateLoading(true);
      const { data, error } = await supabase.rpc("resonate_post", {
        post_id: currentEcho.id,
      });

      if (error) throw error;

      if (data && data.status === "success") {
        setCurrentEcho(prev => {
          if (prev) {
            return {
              ...prev,
              resonance_count: data.resonance_count,
              max_views: data.max_views,
            };
          }
          return prev;
        });
      }
    } catch (err: any) {
      console.error("Error resonating:", err);
      alert("共鳴処理に失敗しました: " + err.message);
    } finally {
      setResonateLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      
      const { data, error } = await supabase
        .from("echoes")
        .insert([
          {
            content: inputContent.trim(),
            mode: formMode,
            max_views: formMode === "bubble" ? 100 : 500,
            view_count: 0,
            resonance_count: 0
          }
        ])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const newEcho = data[0];
        const saved = localStorage.getItem("my_echoes");
        const list = saved ? JSON.parse(saved) : [];
        list.push({ id: newEcho.id, content: newEcho.content.substring(0, 30) + (newEcho.content.length > 30 ? "..." : "") });
        localStorage.setItem("my_echoes", JSON.stringify(list));
        
        setInputContent("");
        setShowForm(false);
        fetchMyEchoesStatus();

        setMode(formMode);
        fetchRandomEcho(formMode);
      }
    } catch (err: any) {
      console.error("Error posting echo:", err);
      alert("投稿に失敗しました。Supabaseの接続やテーブル・ポリシーの設定を確認してください。\nエラー: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchMyEchoesStatus = async () => {
    try {
      const saved = localStorage.getItem("my_echoes");
      if (!saved) return;
      
      const list = JSON.parse(saved) as { id: string; content: string }[];
      if (list.length === 0) return;

      const ids = list.map(item => item.id);
      
      const { data, error } = await supabase
        .from("echoes")
        .select("id, content, resonance_count, view_count, max_views")
        .in("id", ids);

      if (error) throw error;

      const statuses: MyEchoStatus[] = list.map(item => {
        const dbItem = data?.find(d => d.id === item.id);
        if (dbItem) {
          return {
            id: item.id,
            content: item.content,
            resonance_count: dbItem.resonance_count,
            remaining_views: Math.max(0, dbItem.max_views - dbItem.view_count),
            is_deleted: false,
          };
        } else {
          return {
            id: item.id,
            content: item.content,
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
    if (!confirm("この投稿をデータベースおよび履歴から完全に消去しますか？")) return;

    if (!isDeletedFromDb) {
      try {
        const { error } = await supabase
          .from("echoes")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (err: any) {
        console.error("Error deleting echo from DB:", err);
      }
    }

    // LocalStorageから削除
    const saved = localStorage.getItem("my_echoes");
    if (saved) {
      const list = JSON.parse(saved) as { id: string; content: string }[];
      const newList = list.filter(item => item.id !== id);
      localStorage.setItem("my_echoes", JSON.stringify(newList));
    }

    // ステートを更新
    setMyEchoes(prev => prev.filter(echo => echo.id !== id));

    // 現在表示されている投稿が削除されたものなら画面をリフレッシュ
    if (currentEcho && currentEcho.id === id) {
      fetchRandomEcho(mode);
    }
  };

  useEffect(() => {
    fetchRandomEcho(mode);
    fetchMyEchoesStatus();
  }, []);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    fetchRandomEcho(newMode);
  };

  return (
    <div 
      className="flex flex-col min-h-screen bg-neutral-950 text-neutral-100 font-serif select-none justify-between overflow-hidden relative"
      onClick={() => fetchRandomEcho(mode)}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neutral-900 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

      <header className="w-full max-w-4xl mx-auto px-6 py-8 flex justify-between items-center z-10" onClick={(e) => e.stopPropagation()}>
        <h1 className="text-xl tracking-[0.2em] font-light text-neutral-300">残響 <span className="text-xs text-neutral-500 font-sans tracking-normal ml-1">Echoes</span></h1>
        
        <div className="flex bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-full p-1 text-sm font-sans">
          <button
            onClick={() => handleModeChange("bubble")}
            className={`px-4 py-1.5 rounded-full transition-all duration-300 ${
              mode === "bubble" 
                ? "bg-neutral-800 text-neutral-100 shadow-lg" 
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            短文
          </button>
          <button
            onClick={() => handleModeChange("will")}
            className={`px-4 py-1.5 rounded-full transition-all duration-300 ${
              mode === "will" 
                ? "bg-neutral-800 text-neutral-100 shadow-lg" 
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            長文
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center items-center px-6 max-w-3xl mx-auto w-full z-10 cursor-pointer">
        <div className={`w-full transition-opacity duration-300 flex flex-col items-center ${fade ? "opacity-100" : "opacity-0"}`}>
          {loading ? (
            <div className="text-neutral-500 text-sm tracking-widest animate-pulse font-sans">
              投稿を取得しています...
            </div>
          ) : errorMsg ? (
            <div className="text-red-450/80 text-sm text-center tracking-wide font-sans max-w-md bg-red-950/20 border border-red-900/30 p-4 rounded-xl">
              {errorMsg}
            </div>
          ) : currentEcho ? (
            <div className="w-full flex flex-col items-center text-center">
              <p className={`text-neutral-200 leading-relaxed font-light ${
                currentEcho.mode === "bubble" 
                  ? "text-2xl md:text-3xl tracking-wide font-normal max-w-xl" 
                  : "text-lg md:text-xl text-left tracking-normal max-w-2xl whitespace-pre-wrap font-light"
              }`}>
                {currentEcho.content}
              </p>

              <div className="w-full max-w-md mt-16 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                <div className="w-full h-[2px] bg-neutral-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-neutral-400 transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(100, (currentEcho.view_count / currentEcho.max_views) * 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[11px] text-neutral-500 font-sans tracking-wider">
                  <span>表示回数: {currentEcho.view_count} / {currentEcho.max_views}</span>
                  <span>（上限に達すると自動消滅します）</span>
                </div>
              </div>

              <div className="mt-8 flex gap-4" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={handleResonate}
                  disabled={resonateLoading}
                  className="group flex items-center gap-2 px-5 py-2.5 bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800/80 rounded-full text-xs font-sans tracking-widest text-neutral-400 hover:text-neutral-200 transition-all duration-300 active:scale-95"
                >
                  <Heart className={`w-3.5 h-3.5 transition-transform group-hover:scale-125 ${currentEcho.resonance_count > 0 ? "fill-red-900/50 text-red-500" : ""}`} />
                  <span>共鳴する ({currentEcho.resonance_count})</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-neutral-500 text-sm tracking-widest font-sans">
                表示できる投稿がありません。
              </p>
              <p className="text-neutral-600 text-xs mt-2 tracking-wider font-sans">
                画面をタップして再読み込みするか、新しく投稿してください。
              </p>
            </div>
          )}
        </div>
        
        {currentEcho && !loading && !errorMsg && (
          <div className="mt-16 text-[10px] text-neutral-600 font-sans tracking-widest animate-pulse pointer-events-none">
            画面をタップして次の投稿へ
          </div>
        )}
      </main>

      <footer className="w-full max-w-4xl mx-auto px-6 py-8 flex justify-between items-center z-20" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => {
            setShowMyList(true);
            fetchMyEchoesStatus();
          }}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors font-sans tracking-wider border-b border-transparent hover:border-neutral-700 pb-0.5"
        >
          自分の残響
        </button>

        <button
          onClick={() => {
            setInputContent("");
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-950 rounded-full text-xs font-sans font-medium hover:bg-neutral-200 transition-all active:scale-95 shadow-md"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>投稿する</span>
        </button>
      </footer>

      {showForm && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-6 transition-all duration-300" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-lg bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 md:p-8 flex flex-col relative">
            <button 
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg tracking-widest text-neutral-300 font-light mb-6">新規投稿</h2>

            <div className="flex border-b border-neutral-800 mb-6 font-sans">
              <button
                type="button"
                onClick={() => setFormMode("bubble")}
                className={`flex-1 pb-3 text-sm transition-all relative ${
                  formMode === "bubble" ? "text-neutral-100 font-medium" : "text-neutral-500"
                }`}
              >
                短文 <span className="text-[10px] opacity-70">(最大60字 / 初期寿命100表示)</span>
                {formMode === "bubble" && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200"></div>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFormMode("will")}
                className={`flex-1 pb-3 text-sm transition-all relative ${
                  formMode === "will" ? "text-neutral-100 font-medium" : "text-neutral-500"
                }`}
              >
                長文 <span className="text-[10px] opacity-70">(最大800字 / 初期寿命500表示)</span>
                {formMode === "will" && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200"></div>
                )}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1">
              <textarea
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                maxLength={maxChars}
                placeholder={formMode === "bubble" ? "短い想いを入力してください..." : "心に残る長文を入力してください..."}
                required
                className="w-full flex-1 min-h-[140px] bg-transparent text-neutral-200 border-0 outline-none resize-none placeholder-neutral-600 text-base font-light leading-relaxed mb-4 focus:ring-0 focus:ring-offset-0"
              />
              
              <div className="flex justify-between items-center mt-auto pt-4 border-t border-neutral-800">
                <span className="text-xs text-neutral-500 font-sans">
                  {inputContent.length} / {maxChars} 文字
                </span>
                
                <button
                  type="submit"
                  disabled={submitting || !inputContent.trim()}
                  className="px-6 py-2 bg-neutral-100 text-neutral-950 hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 rounded-full text-xs font-sans font-medium transition-colors"
                >
                  {submitting ? "送信中..." : "投稿する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMyList && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-lg bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 md:p-8 flex flex-col max-h-[80vh] relative">
            <button 
              onClick={() => setShowMyList(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg tracking-widest text-neutral-300 font-light mb-6">自分の残響</h2>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {myEchoes.length === 0 ? (
                <p className="text-neutral-500 text-sm tracking-wider text-center py-12 font-sans">
                  まだ投稿していません。
                </p>
              ) : (
                myEchoes.map((echo) => (
                  <div key={echo.id} className="p-4 bg-neutral-950/50 border border-neutral-800/50 rounded-xl flex flex-col space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-sm text-neutral-300 italic font-light flex-1">
                        &ldquo;{echo.content}&rdquo;
                      </p>
                      <button
                        onClick={() => handleDeleteMyEcho(echo.id, echo.is_deleted)}
                        className="text-neutral-600 hover:text-red-400 transition-colors p-1"
                        title="この投稿を消去"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {echo.is_deleted ? (
                      <div className="flex justify-between items-center text-[10px] text-neutral-600 font-sans pt-1 border-t border-neutral-900/50">
                        <span>消滅しました</span>
                        <span>共鳴: -</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[10px] text-neutral-400 font-sans pt-1 border-t border-neutral-900/50">
                        <span className="text-neutral-500">残り寿命: <strong className="text-neutral-300 font-medium">{echo.remaining_views}</strong> 回表示</span>
                        <span className="flex items-center gap-1"><Heart className="w-2.5 h-2.5 text-red-500/80 fill-red-950/20" /> 共鳴数: {echo.resonance_count}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
