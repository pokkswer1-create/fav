# fav — NEIS school helper

오마초등학교(고양시 일산서구) 나이스(NEIS) 교육정보 개방 API 연동입니다.

## Quick start

```bash
# 연결 확인
python -m neis ping

# 2026-11-02 1·2학년 하교
python -m neis dismiss --date 2026-11-02 --grades 1 2

# 급식
python -m neis meal --date 2026-11-02
```

## Env

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `NEIS_API_KEY` | 아니오 | [나이스 개방포털](https://open.neis.go.kr/portal/guide/actKeyPage.do) 인증키. 없으면 sample/keyless 모드 |

키 없이도 `schoolInfo` / `meal` / 반별 `elsTimetable` 조회는 됩니다. 키를 넣으면 페이지 제한이 풀립니다.

## Default school

- 이름: 오마초등학교
- 교육청: `J10` (경기도교육청)
- 학교코드: `7621080`

## Tests

```bash
python -m unittest discover -s tests -v
```
