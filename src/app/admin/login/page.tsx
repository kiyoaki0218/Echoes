"use client";

import { useState } from "react";
import { loginAdmin } from "@/app/actions/admin";
import { Lock } from "lucide-react";

export default function AdminLogin() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const result = await loginAdmin(formData);
    
    if (result?.error) {
      setError(result.error);
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-200 font-serif flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at center, #333 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      
      <div className="w-full max-w-md bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-neutral-400" />
          </div>
          <h1 className="text-xl tracking-widest text-neutral-300 font-light">管理者ログイン</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="passcode" className="block text-sm font-sans text-neutral-500 mb-2">パスコード</label>
            <input
              type="password"
              id="passcode"
              name="passcode"
              required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-neutral-200 font-sans focus:outline-none focus:border-neutral-600 transition-colors"
              placeholder="パスコードを入力"
            />
          </div>
          
          {error && <p className="text-red-400 text-sm font-sans text-center">{error}</p>}
          
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-neutral-200 text-neutral-950 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-600 rounded-lg py-3 font-sans font-medium transition-colors"
          >
            {isPending ? "認証中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
