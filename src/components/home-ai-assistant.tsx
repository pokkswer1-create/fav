"use client";

import { useCallback, useState } from "react";

type ChatLine = { role: "user" | "assistant"; text: string };

export function HomeAiAssistant() {
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setError("");
    setLines((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("로그인(또는 개발용 인증 우회) 후 이용할 수 있습니다.");
        } else {
          setError(json.error ?? "응답을 받지 못했습니다.");
        }
        setLines((prev) => [
          ...prev,
          { role: "assistant", text: "요청을 처리하지 못했습니다." },
        ]);
        return;
      }
      const answer = typeof json.answer === "string" ? json.answer : "";
      const polished = Boolean(json.usedOpenAIPolish);
      const actionDone = Boolean(json.isAction);
      const suffix =
        (polished ? "\n\n(문장만 OpenAI로 다듬음 · 숫자·이름은 DB 답변과 동일)" : "") +
        (actionDone ? "\n\n(요청하신 작업을 서버에서 실행했습니다.)" : "");
      setLines((prev) => [...prev, { role: "assistant", text: answer + suffix }]);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLines((prev) => [
        ...prev,
        { role: "assistant", text: "연결에 실패했습니다." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">센터 AI 질문</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        조회 예: 이번 달 매출 · 미납자 이름 알려줘 · 예약 대기 몇 건? · 오늘 결석 누구? 실행 예(관리자): 미납자에게 결제
        안내 보내줘 · 3월 미납 독촉 발송 · KVA 공지 갱신해줘. 답변·발송은 DB·모의 알림 기준입니다. OPENAI_API_KEY가
        있으면 해석·문장 다듬기에 활용됩니다.
      </p>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900/50">
        {lines.length === 0 ? (
          <p className="text-zinc-500">질문을 입력하면 결제·출석 데이터를 바탕으로 답합니다.</p>
        ) : (
          lines.map((line, i) => (
            <div
              key={`${i}-${line.role}`}
              className={
                line.role === "user"
                  ? "ml-6 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-zinc-800"
                  : "mr-6 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
              }
            >
              <p className="text-xs font-medium opacity-60">
                {line.role === "user" ? "나" : "답변"}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{line.text}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600"
          placeholder="질문을 입력하세요…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={loading}
        />
        <button
          type="button"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          onClick={() => void send()}
          disabled={loading}
        >
          {loading ? "…" : "보내기"}
        </button>
      </div>
    </section>
  );
}
