const GRAPH_BASE = "https://graph.facebook.com/v18.0";

function hasInstagramEnv() {
  return Boolean(
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID && process.env.INSTAGRAM_ACCESS_TOKEN
  );
}

async function corePublish(
  accountId: string,
  accessToken: string,
  imageUrl: string,
  caption: string,
  hashtags: string[]
): Promise<{ id: string }> {
  const createRes = await fetch(`${GRAPH_BASE}/${accountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: `${caption}\n\n${hashtags.join(" ")}`.trim(),
      access_token: accessToken,
    }),
  });
  const createJson = await createRes.json();
  if (!createRes.ok || !createJson?.id) {
    throw new Error(createJson?.error?.message ?? "Instagram media 생성 실패");
  }

  const publishRes = await fetch(`${GRAPH_BASE}/${accountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: createJson.id,
      access_token: accessToken,
    }),
  });
  const publishJson = await publishRes.json();
  if (!publishRes.ok || !publishJson?.id) {
    throw new Error(publishJson?.error?.message ?? "Instagram 게시 실패");
  }

  return { id: publishJson.id as string };
}

export async function publishToInstagram(
  imageUrl: string,
  caption: string,
  hashtags: string[]
): Promise<{ id: string }> {
  if (!hasInstagramEnv()) {
    return { id: `mock-${Date.now()}` };
  }

  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN!;
  return corePublish(accountId, accessToken, imageUrl, caption, hashtags);
}

export async function publishToInstagramForAccount(
  accountId: string,
  accessToken: string,
  imageUrl: string,
  caption: string,
  hashtags: string[]
): Promise<{ id: string }> {
  return corePublish(accountId, accessToken, imageUrl, caption, hashtags);
}

export async function fetchInstagramPostStats(postId: string) {
  if (!hasInstagramEnv()) {
    return {
      like_count: Math.floor(Math.random() * 200),
      comments_count: Math.floor(Math.random() * 30),
      reach: Math.floor(Math.random() * 2000),
    };
  }
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN!;
  const res = await fetch(
    `${GRAPH_BASE}/${postId}?fields=like_count,comments_count,reach&access_token=${accessToken}`
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Instagram 통계 조회 실패");
  return json as { like_count: number; comments_count: number; reach: number };
}

export async function fetchInstagramComments(postId: string) {
  if (!hasInstagramEnv()) {
    return [];
  }
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN!;
  const res = await fetch(
    `${GRAPH_BASE}/${postId}/comments?fields=id,text,timestamp,username,like_count&access_token=${accessToken}`
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Instagram 댓글 조회 실패");
  return (json.data ?? []) as {
    id: string;
    text: string;
    timestamp: string;
    username: string;
    like_count: number;
  }[];
}

export async function getInstagramAccountId(username: string) {
  return `ref-${username.replace("@", "").toLowerCase()}`;
}

export async function syncReferenceAccountPostsMock(username: string) {
  const now = new Date();
  return Array.from({ length: 8 }).map((_, idx) => ({
    instagramPostId: `mock-ref-${username}-${idx + 1}`,
    caption: `${username} 참고 게시물 ${idx + 1}`,
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(username)}-${idx}/800/800`,
    mediaType: "IMAGE",
    likeCount: Math.floor(Math.random() * 500),
    commentCount: Math.floor(Math.random() * 70),
    postedAt: new Date(now.getTime() - idx * 86400000).toISOString(),
  }));
}
