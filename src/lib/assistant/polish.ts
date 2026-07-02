export async function polishAssistantAnswer(
  userQuestion: string,
  factualAnswer: string
): Promise<string | null> {
  if (process.env.OPENAI_DISABLE_POLISH === "true") return null;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model =
    process.env.OPENAI_POLISH_MODEL ??
    process.env.OPENAI_ASSISTANT_MODEL ??
    "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `학원 관리 화면용 한국어 답변 편집자입니다. 아래 FACTUAL_ANSWER를 자연스럽고 정중한 한국어로 다듬습니다.
규칙:
- 원문에 나온 모든 숫자, 금액(원), 퍼센트(%), 날짜, 이름을 글자 단위로 그대로 유지합니다. 새로 계산하거나 반올림하지 않습니다.
- 사실을 추가·삭제·바꾸지 않습니다.
- 출력은 최종 답변 문장만, 따옴표나 접두어 없이.`,
          },
          {
            role: "user",
            content: `질문: ${userQuestion}\n\nFACTUAL_ANSWER:\n${factualAnswer}`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return text;
  } catch {
    return null;
  }
}
