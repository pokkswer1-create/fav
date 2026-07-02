"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useEffect, useMemo, useState } from "react";

type Post = {
  id: string;
  account_name: string | null;
  account_avatar: string | null;
  caption: string | null;
  image_url: string | null;
  like_count: number;
  comment_count: number;
  posted_at: string | null;
  status: string;
  instagram_post_id: string | null;
};

type InternalComment = {
  id: string;
  user_name: string | null;
  comment: string;
  created_at: string;
};

type InstaLink = {
  instagram_business_id: string;
  created_at: string;
  expires_at: string | null;
} | null;

export default function InstagramPage() {
  const [tab, setTab] = useState<"my" | "reference" | "analytics">("my");
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [refPosts, setRefPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [detail, setDetail] = useState<Post | null>(null);
  const [instaComments, setInstaComments] = useState<
    { id: string; author: string; content: string; like_count: number; posted_at: string | null }[]
  >([]);
  const [internalComments, setInternalComments] = useState<InternalComment[]>([]);
  const [newComment, setNewComment] = useState("");

  const [instaLink, setInstaLink] = useState<InstaLink>(null);
  const [linkBusinessId, setLinkBusinessId] = useState("");
  const [linkAccessToken, setLinkAccessToken] = useState("");

  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [location, setLocation] = useState("");
  const [publishType, setPublishType] = useState<"now" | "scheduled">("now");
  const [scheduledTime, setScheduledTime] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [refUsername, setRefUsername] = useState("");
  const [refCategory, setRefCategory] = useState("음악학원");

  const analytics = useMemo(() => {
    const rows = myPosts.filter((p) => p.status === "published");
    const avgLike = rows.length ? Math.round(rows.reduce((s, p) => s + (p.like_count ?? 0), 0) / rows.length) : 0;
    const avgComment = rows.length
      ? Math.round(rows.reduce((s, p) => s + (p.comment_count ?? 0), 0) / rows.length)
      : 0;
    return {
      total: rows.length,
      avgLike,
      avgComment,
    };
  }, [myPosts]);

  const loadMyPosts = async () => {
    const res = await authFetch("/api/instagram/posts/my");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "우리 게시물 조회 실패");
      return;
    }
    setMyPosts((json.data ?? []).map((p: Post) => ({ ...p })));
  };

  const loadInstagramLink = async () => {
    const res = await authFetch("/api/instagram/link");
    const json = await res.json();
    if (res.ok) {
      setInstaLink(json.link);
    }
  };

  const loadReferencePosts = async (categoryValue = category) => {
    const query = categoryValue ? `?category=${encodeURIComponent(categoryValue)}` : "";
    const res = await authFetch(`/api/instagram/reference/posts${query}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "참고 게시물 조회 실패");
      return;
    }
    setRefPosts((json ?? []).map((p: Post) => ({ ...p })));
  };

  useEffect(() => {
    void loadMyPosts();
    void loadReferencePosts("");
    void loadInstagramLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPost = async () => {
    const form = new FormData();
    form.append("caption", caption);
    form.append("hashtags", JSON.stringify(hashtags.split(" ").filter((h) => h.startsWith("#"))));
    form.append("location", location);
    form.append("publishType", publishType);
    if (scheduledTime) form.append("scheduledTime", scheduledTime);
    if (mediaUrl) form.append("mediaUrl", mediaUrl);
    if (uploadFile) form.append("media", uploadFile);

    const res = await authFetch("/api/instagram/posts/create", { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "게시물 생성 실패");
      return;
    }
    setCaption("");
    setMediaUrl("");
    setHashtags("");
    setLocation("");
    setScheduledTime("");
    setUploadFile(null);
    await loadMyPosts();
  };

  const addReference = async () => {
    const res = await authFetch("/api/instagram/reference/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: refUsername, category: refCategory }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "참고 계정 추가 실패");
      return;
    }
    setRefUsername("");
    await loadReferencePosts();
  };

  const openDetail = async (postId: string) => {
    const [postRes, instaRes, internalRes] = await Promise.all([
      authFetch(`/api/instagram/posts/${postId}`),
      authFetch(`/api/instagram/posts/${postId}/insta-comments`),
      authFetch(`/api/instagram/posts/${postId}/internal-comments`),
    ]);
    const postJson = await postRes.json();
    const instaJson = await instaRes.json();
    const internalJson = await internalRes.json();
    if (!postRes.ok || !instaRes.ok || !internalRes.ok) {
      setError(postJson.error ?? instaJson.error ?? internalJson.error ?? "상세 조회 실패");
      return;
    }
    setDetail(postJson);
    setInstaComments(instaJson);
    setInternalComments(internalJson);
  };

  const addInternalComment = async () => {
    if (!detail || !newComment.trim()) return;
    const res = await authFetch(`/api/instagram/posts/${detail.id}/internal-comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: newComment.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "내부 댓글 등록 실패");
      return;
    }
    setInternalComments((prev) => [json, ...prev]);
    setNewComment("");
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8">
      <h1 className="text-2xl font-semibold">인스타그램 관리</h1>
      {error ? <p className="text-rose-500">{error}</p> : null}

      <section className="grid gap-3 rounded-xl border p-4 text-sm dark:border-zinc-800 md:grid-cols-3">
        <div className="md:col-span-2">
          <p className="text-sm font-semibold">학원 인스타그램 계정 연동</p>
          {instaLink ? (
            <p className="mt-1 text-xs text-emerald-600">
              연결됨: 비즈니스 ID <code>{instaLink.instagram_business_id}</code>
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              아직 인스타그램 비즈니스 계정이 연결되지 않았습니다. 아래에 비즈니스 계정 ID와 액세스
              토큰을 입력하면, 이 계정으로 게시물이 올라갑니다.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
            placeholder="Instagram Business Account ID"
            value={linkBusinessId}
            onChange={(e) => setLinkBusinessId(e.target.value)}
          />
          <input
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
            placeholder="Long-lived Access Token"
            value={linkAccessToken}
            onChange={(e) => setLinkAccessToken(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
              onClick={async () => {
                const res = await authFetch("/api/instagram/link", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    businessId: linkBusinessId,
                    accessToken: linkAccessToken,
                  }),
                });
                const json = await res.json();
                if (!res.ok) {
                  setError(json.error ?? "인스타그램 연동 저장 실패");
                  return;
                }
                setLinkAccessToken("");
                setLinkBusinessId("");
                await loadInstagramLink();
              }}
            >
              계정 연동 저장
            </button>
            {instaLink ? (
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                onClick={async () => {
                  const res = await authFetch("/api/instagram/link", { method: "DELETE" });
                  const json = await res.json();
                  if (!res.ok) {
                    setError(json.error ?? "연동 해제 실패");
                    return;
                  }
                  setInstaLink(null);
                }}
              >
                연동 해제
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex gap-2">
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${tab === "my" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"}`}
          onClick={() => setTab("my")}
        >
          우리 게시물
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${tab === "reference" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"}`}
          onClick={() => setTab("reference")}
        >
          참고 게시물
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${tab === "analytics" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"}`}
          onClick={() => setTab("analytics")}
        >
          분석
        </button>
      </section>

      {tab === "my" ? (
        <>
          <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-2">
            <textarea
              className="min-h-24 rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700 md:col-span-2"
              placeholder="게시물 설명"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <input
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              placeholder="이미지 URL(선택)"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
            />
            <input
              type="file"
              accept="image/*,video/*"
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            <input
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              placeholder="#음악 #성악"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
            <input
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              placeholder="위치"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <select
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={publishType}
              onChange={(e) => setPublishType(e.target.value as "now" | "scheduled")}
            >
              <option value="now">지금 발행</option>
              <option value="scheduled">예약 발행</option>
            </select>
            <input
              type="datetime-local"
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              disabled={publishType !== "scheduled"}
            />
            <button
              type="button"
              onClick={createPost}
              className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900 md:col-span-2"
            >
              게시하기
            </button>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {myPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                className="overflow-hidden rounded-xl border text-left dark:border-zinc-800"
                onClick={() => openDetail(post.id)}
              >
                <img
                  src={post.image_url ?? "https://picsum.photos/seed/empty/600/600"}
                  alt=""
                  className="h-52 w-full object-cover"
                />
                <div className="space-y-1 p-3 text-sm">
                  <p className="line-clamp-2">{post.caption ?? "(내용 없음)"}</p>
                  <p className="text-xs opacity-70">
                    ❤️ {post.like_count} · 💬 {post.comment_count}
                  </p>
                  <p className="text-xs opacity-70">상태: {post.status}</p>
                </div>
              </button>
            ))}
          </section>
        </>
      ) : null}

      {tab === "reference" ? (
        <>
          <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-4">
            <input
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              placeholder="@계정명"
              value={refUsername}
              onChange={(e) => setRefUsername(e.target.value)}
            />
            <select
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={refCategory}
              onChange={(e) => setRefCategory(e.target.value)}
            >
              <option value="음악학원">음악학원</option>
              <option value="성악학원">성악학원</option>
              <option value="피아노학원">피아노학원</option>
              <option value="기타">기타</option>
            </select>
            <button
              type="button"
              onClick={addReference}
              className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              참고 계정 추가
            </button>
            <select
              className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                void loadReferencePosts(e.target.value);
              }}
            >
              <option value="">전체</option>
              <option value="음악학원">음악학원</option>
              <option value="성악학원">성악학원</option>
              <option value="피아노학원">피아노학원</option>
              <option value="기타">기타</option>
            </select>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {refPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                className="overflow-hidden rounded-xl border text-left dark:border-zinc-800"
                onClick={() => openDetail(post.id)}
              >
                <img
                  src={post.image_url ?? "https://picsum.photos/seed/empty-ref/600/600"}
                  alt=""
                  className="h-52 w-full object-cover"
                />
                <div className="space-y-1 p-3 text-sm">
                  <p className="text-xs font-semibold">@{post.account_name ?? "unknown"}</p>
                  <p className="line-clamp-2">{post.caption ?? "(내용 없음)"}</p>
                  <p className="text-xs opacity-70">
                    ❤️ {post.like_count} · 💬 {post.comment_count}
                  </p>
                </div>
              </button>
            ))}
          </section>
        </>
      ) : null}

      {tab === "analytics" ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm opacity-70">발행 게시물 수</p>
            <p className="mt-1 text-xl font-semibold">{analytics.total}건</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm opacity-70">평균 좋아요</p>
            <p className="mt-1 text-xl font-semibold">{analytics.avgLike}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm opacity-70">평균 댓글</p>
            <p className="mt-1 text-xl font-semibold">{analytics.avgComment}</p>
          </div>
        </section>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">@{detail.account_name ?? "계정"}</h2>
              <button type="button" onClick={() => setDetail(null)} className="rounded border px-2 py-1 text-sm">
                닫기
              </button>
            </div>
            <img src={detail.image_url ?? ""} alt="" className="mb-3 w-full rounded-lg object-cover" />
            <p className="mb-2 text-sm">{detail.caption}</p>
            <p className="mb-3 text-xs opacity-70">
              ❤️ {detail.like_count} · 💬 {detail.comment_count}
            </p>

            <div className="mb-3 rounded border p-3 text-sm dark:border-zinc-800">
              <h3 className="mb-2 font-semibold">인스타그램 댓글</h3>
              <div className="space-y-2">
                {instaComments.length === 0 ? (
                  <p className="text-xs opacity-70">댓글이 없습니다.</p>
                ) : (
                  instaComments.map((comment) => (
                    <div key={comment.id} className="rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
                      <p className="font-semibold">@{comment.author}</p>
                      <p>{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded border p-3 text-sm dark:border-zinc-800">
              <h3 className="mb-2 font-semibold">내부 의견</h3>
              <div className="mb-2 space-y-2">
                {internalComments.length === 0 ? (
                  <p className="text-xs opacity-70">의견이 없습니다.</p>
                ) : (
                  internalComments.map((comment) => (
                    <div key={comment.id} className="rounded bg-sky-50 p-2 text-xs dark:bg-sky-950/30">
                      <p className="font-semibold">{comment.user_name ?? "팀원"}</p>
                      <p>{comment.comment}</p>
                    </div>
                  ))
                )}
              </div>
              <textarea
                className="min-h-20 w-full rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                placeholder="의견을 남겨주세요..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button
                type="button"
                onClick={addInternalComment}
                className="mt-2 rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                댓글 달기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
