/** Concatenate PostgREST / Postgres fields — `details` often holds the real column error. */
export function supabaseErrorText(err: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null | undefined): string {
  if (!err) return "";
  return [err.message, err.details, err.hint, err.code].filter(Boolean).join(" | ");
}

/** Postgres/PostgREST errors when enrollments discount columns are not migrated yet */
export function isMissingEnrollmentDiscountColumn(text: string) {
  const m = text.toLowerCase();
  if (!m) return false;
  const mentionsEnrollment = m.includes("enrollments") || m.includes("enrollment");
  const mentionsDiscountCols =
    m.includes("discount_type") ||
    m.includes("discount_value") ||
    m.includes("discount_reason") ||
    m.includes("discount_start") ||
    m.includes("discount_end") ||
    m.includes("final_fee");
  if (m.includes("does not exist") && mentionsEnrollment && mentionsDiscountCols) {
    return true;
  }
  return (
    m.includes("enrollments_1.discount_type") ||
    m.includes("enrollments.discount_type") ||
    m.includes("enrollments_1.discount_value") ||
    m.includes("enrollments.discount_value") ||
    m.includes("enrollments_1.discount_reason") ||
    m.includes("enrollments.discount_reason") ||
    m.includes("enrollments_1.discount_start_date") ||
    m.includes("enrollments.discount_start_date") ||
    m.includes("enrollments_1.discount_end_date") ||
    m.includes("enrollments.discount_end_date") ||
    m.includes("enrollments_1.final_fee") ||
    m.includes("enrollments.final_fee")
  );
}

/** Older DBs may lack payment_method / notes / status_changed_at on payments */
export function isMissingPaymentsEmbedColumn(text: string) {
  const m = text.toLowerCase();
  if (!m) return false;
  const mentionsPayments = m.includes("payments");
  const mentionsCols =
    m.includes("payment_method") ||
    m.includes("status_changed_at") ||
    m.includes("updated_by") ||
    m.includes("payments_1.notes") ||
    m.includes("payments.notes") ||
    m.includes("'notes'") ||
    (m.includes("notes") && mentionsPayments);
  const pgMissing = m.includes("does not exist") && mentionsPayments && mentionsCols;
  // PostgREST often reports missing columns as schema cache errors, not "does not exist"
  const schemaCacheMissing =
    m.includes("could not find") &&
    m.includes("schema cache") &&
    mentionsPayments &&
    (mentionsCols || m.includes("column of"));
  return pgMissing || schemaCacheMissing;
}

/** Missing table errors on Supabase/PostgREST */
export function isMissingTableError(text: string) {
  const m = (text ?? "").toLowerCase();
  if (!m) return false;
  return (
    m.includes("could not find the table") ||
    m.includes("relation") && m.includes("does not exist") && m.includes("public.") ||
    m.includes("does not exist") && m.includes("public.") && m.includes("table")
  );
}
