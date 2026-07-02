"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import styles from "./auth.module.css";

type StatusTone = "neutral" | "error" | "success";

function FloatingField({
  id,
  label,
  type,
  value,
  onChange,
  onKeyDown,
  hasError,
  autoComplete,
  staggerClass,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  hasError?: boolean;
  autoComplete?: string;
  staggerClass: string;
}) {
  return (
    <div className={`${styles.inputWrapper} ${styles.stagger} ${staggerClass}`}>
      <input
        id={id}
        className={`${styles.inputField} ${hasError ? styles.inputFieldError : ""}`}
        type={type}
        placeholder=" "
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <label htmlFor={id} className={styles.floatingLabel}>
        {label}
      </label>
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [position, setPosition] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<string>("");
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [fieldError, setFieldError] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
  }, []);

  const onShakeEnd = useCallback(() => {
    setShake(false);
  }, []);

  useEffect(() => {
    let client: ReturnType<typeof getSupabaseClient>;
    try {
      client = getSupabaseClient();
      setSupabase(client);
    } catch (error) {
      setStatus((error as Error).message);
      setStatusTone("error");
      return;
    }

    const loadSession = async () => {
      const { data, error } = await client.auth.getSession();
      if (error) {
        setStatus(error.message);
        setStatusTone("error");
        return;
      }

      setSession(data.session);
    };

    void loadSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignUp = async () => {
    setLoading(true);
    setStatus("");
    setStatusTone("neutral");
    setFieldError(false);
    const safeEmail = email.trim();
    const safeName = fullName.trim();
    const safePhone = phone.trim();
    const safeOrganization = organization.trim();
    const safePosition = position.trim();

    if (!safeName || !safePhone) {
      setStatus("회원가입에는 이름과 연락처가 필요합니다.");
      setStatusTone("error");
      setFieldError(true);
      triggerShake();
      setLoading(false);
      return;
    }

    if (!supabase) {
      setStatus("Supabase 클라이언트가 아직 준비되지 않았습니다.");
      setStatusTone("error");
      triggerShake();
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: safeEmail,
      password,
      options: {
        data: {
          full_name: safeName,
          phone: safePhone,
          organization: safeOrganization || null,
          position: safePosition || null,
        },
      },
    });
    const token = data.session?.access_token;
    if (!error && token) {
      await fetch("/api/auth/register-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: safeName,
          phone: safePhone,
          organization: safeOrganization,
          position: safePosition,
        }),
      });
    }
    setLoading(false);

    if (error) {
      setStatus(`회원가입 실패: ${error.message}`);
      setStatusTone("error");
      setFieldError(true);
      triggerShake();
      return;
    }

    setStatusTone("success");
    setStatus(
      data.user?.identities?.length
        ? "회원가입 신청 완료. 관리자 승인 후 로그인할 수 있습니다."
        : "이미 등록된 이메일입니다. 로그인해 주세요."
    );
  };

  const handleSignIn = async () => {
    setLoading(true);
    setStatus("");
    setStatusTone("neutral");
    setFieldError(false);
    const safeEmail = email.trim();

    if (!supabase) {
      setStatus("Supabase 클라이언트가 아직 준비되지 않았습니다.");
      setStatusTone("error");
      triggerShake();
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: safeEmail,
      password,
    });
    setLoading(false);

    if (error) {
      setStatus(`로그인 실패: ${error.message}`);
      setStatusTone("error");
      setFieldError(true);
      triggerShake();
      return;
    }

    const token = data.session?.access_token;
    if (token) {
      const checkRes = await fetch("/api/auth/access-status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const checkJson = await checkRes.json();
      if (!checkRes.ok) {
        if (checkRes.status === 401 || checkRes.status === 403) {
          await supabase.auth.signOut();
          setStatus(checkJson.error ?? "승인 상태 확인 실패");
          setStatusTone("error");
          triggerShake();
          return;
        }
      }
      if (checkJson.approvalStatus === "PENDING") {
        await supabase.auth.signOut();
        setStatus("관리자 승인 대기중입니다. 승인 후 로그인해 주세요.");
        setStatusTone("error");
        triggerShake();
        return;
      }
      if (checkJson.approvalStatus === "REJECTED") {
        await supabase.auth.signOut();
        setStatus(
          checkJson.rejectionReason
            ? `회원가입이 반려되었습니다. 사유: ${checkJson.rejectionReason}`
            : "회원가입이 반려되었습니다. 관리자에게 문의해 주세요."
        );
        setStatusTone("error");
        triggerShake();
        return;
      }
    }

    localStorage.setItem("kva-refresh-once", "1");
    setStatusTone("success");
    setStatus("로그인 완료. 대시보드로 이동합니다.");
    window.location.href = "/dashboard";
  };

  const handleLoginEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mode !== "login") return;
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!loading) {
      void handleSignIn();
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    setStatus("");
    setStatusTone("neutral");
    setFieldError(false);

    if (!supabase) {
      setStatus("Supabase 클라이언트가 아직 준비되지 않았습니다.");
      setStatusTone("error");
      triggerShake();
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signOut();
    setLoading(false);

    if (error) {
      setStatus(`로그아웃 실패: ${error.message}`);
      setStatusTone("error");
      triggerShake();
      return;
    }

    setStatusTone("neutral");
    setStatus("로그아웃 완료.");
  };

  const handleFindId = () => {
    setStatus("아이디(이메일) 찾기는 관리자에게 문의해 주세요.");
    setStatusTone("neutral");
  };

  const handleResetPassword = async () => {
    if (!supabase) {
      setStatus("Supabase 클라이언트가 아직 준비되지 않았습니다.");
      setStatusTone("error");
      triggerShake();
      return;
    }
    if (!email.trim()) {
      setStatus("비밀번호 찾기를 위해 이메일을 먼저 입력해 주세요.");
      setStatusTone("error");
      triggerShake();
      return;
    }
    setLoading(true);
    setStatus("");
    setStatusTone("neutral");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) {
      setStatus(`비밀번호 재설정 메일 전송 실패: ${error.message}`);
      setStatusTone("error");
      triggerShake();
      return;
    }
    setStatusTone("success");
    setStatus("비밀번호 재설정 메일을 보냈습니다. 이메일을 확인해 주세요.");
  };

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setStatus("");
    setStatusTone("neutral");
    setFieldError(false);
  };

  return (
    <main className={styles.page}>
      <div className={styles.orbPrimary} aria-hidden />
      <div className={styles.orbSecondary} aria-hidden />

      <div
        className={`${styles.shakeWrapper} ${shake ? styles.shakeWrapperActive : ""}`}
        onAnimationEnd={onShakeEnd}
      >
        <div className={styles.loginCard}>
          <div className={`${styles.stagger} ${styles.stagger1}`}>
            <div className={styles.modeToggle} role="tablist" aria-label="로그인 또는 회원가입">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? styles.modeToggleActive : ""}
                onClick={() => switchMode("login")}
              >
                로그인
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? styles.modeToggleActive : ""}
                onClick={() => switchMode("signup")}
              >
                회원가입
              </button>
            </div>
          </div>

          <h1 className={`${styles.title} ${styles.stagger} ${styles.stagger1}`}>
            {mode === "signup" ? "회원가입" : "로그인"}
          </h1>
          <p className={`${styles.subtitle} ${styles.stagger} ${styles.stagger2}`}>
            원패스클래스 관리자 · 강사 포털
          </p>

          {mode === "login" ? (
            <div className={`${styles.stagger} ${styles.stagger2}`}>
              <div className={styles.sessionPill}>
                <span className={session ? styles.sessionDot : `${styles.sessionDot} ${styles.sessionDotOff}`} />
                {session ? `로그인됨 · ${session.user.email}` : "로그아웃 상태"}
              </div>
            </div>
          ) : (
            <p className={`${styles.subtitle} ${styles.stagger} ${styles.stagger2}`} style={{ marginTop: "-0.5rem" }}>
              이메일·비밀번호와 기본 정보를 입력해 주세요.
            </p>
          )}

          <div key={mode}>
            <FloatingField
              id="auth-email"
              label="이메일"
              type="email"
              value={email}
              onChange={setEmail}
              onKeyDown={handleLoginEnter}
              hasError={fieldError}
              autoComplete="email"
              staggerClass={styles.stagger3}
            />
            <FloatingField
              id="auth-password"
              label="비밀번호"
              type="password"
              value={password}
              onChange={setPassword}
              onKeyDown={handleLoginEnter}
              hasError={fieldError}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              staggerClass={styles.stagger4}
            />

            {mode === "signup" ? (
              <>
                <FloatingField
                  id="auth-name"
                  label="이름"
                  type="text"
                  value={fullName}
                  onChange={setFullName}
                  staggerClass={styles.stagger5}
                />
                <FloatingField
                  id="auth-phone"
                  label="연락처"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  autoComplete="tel"
                  staggerClass={styles.stagger6}
                />
                <FloatingField
                  id="auth-org"
                  label="소속 (선택)"
                  type="text"
                  value={organization}
                  onChange={setOrganization}
                  staggerClass={styles.stagger7}
                />
                <FloatingField
                  id="auth-position"
                  label="직책 (선택)"
                  type="text"
                  value={position}
                  onChange={setPosition}
                  staggerClass={styles.stagger8}
                />
              </>
            ) : null}

            {mode === "signup" ? (
              <div className={`${styles.buttonRow} ${styles.stagger} ${styles.stagger9}`}>
                <button
                  type="button"
                  className={`${styles.primaryButton} ${loading ? styles.primaryButtonLoading : ""}`}
                  onClick={() => void handleSignUp()}
                  disabled={loading}
                >
                  {loading ? (
                    <span className={styles.loadingInner}>
                      <span className={styles.spinner} aria-hidden />
                      <span className={styles.loadingText}>처리 중…</span>
                    </span>
                  ) : (
                    "회원가입 완료"
                  )}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => switchMode("login")}
                  disabled={loading}
                >
                  로그인으로
                </button>
              </div>
            ) : (
              <>
                <div className={`${styles.stagger} ${styles.stagger5}`}>
                  <button
                    type="button"
                    className={`${styles.primaryButton} ${loading ? styles.primaryButtonLoading : ""}`}
                    onClick={() => void handleSignIn()}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className={styles.loadingInner}>
                        <span className={styles.spinner} aria-hidden />
                        <span className={styles.loadingText}>로그인 중…</span>
                      </span>
                    ) : (
                      "로그인"
                    )}
                  </button>
                </div>
                <div className={`${styles.buttonRow} ${styles.stagger} ${styles.stagger6}`}>
                  <button type="button" className={styles.secondaryButton} onClick={() => switchMode("signup")} disabled={loading}>
                    회원가입
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={() => void handleSignOut()} disabled={loading}>
                    로그아웃
                  </button>
                </div>
                <div className={`${styles.linkRow} ${styles.stagger} ${styles.stagger7}`}>
                  <button type="button" className={styles.secondaryButton} onClick={handleFindId} disabled={loading}>
                    아이디 찾기
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={() => void handleResetPassword()} disabled={loading}>
                    비밀번호 찾기
                  </button>
                </div>
              </>
            )}
          </div>

          {status ? (
            <p
              className={`${styles.statusMessage} ${
                statusTone === "error"
                  ? styles.statusError
                  : statusTone === "success"
                    ? styles.statusSuccess
                    : styles.statusNeutral
              }`}
              role={statusTone === "error" ? "alert" : "status"}
            >
              {status}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
