import type { DiscountType } from "@/lib/types";

export function calculateFinalFee(baseFee: number, discountType: DiscountType, discountValue: number) {
  const normalizedBase = Math.max(0, Number(baseFee || 0));
  const normalizedDiscount = Math.max(0, Number(discountValue || 0));

  if (discountType === "amount") {
    return Math.max(0, normalizedBase - normalizedDiscount);
  }
  if (discountType === "percent") {
    const discounted = Math.round(normalizedBase * (1 - normalizedDiscount / 100));
    return Math.max(0, discounted);
  }
  return normalizedBase;
}

export function formatWon(value: number) {
  return `${Math.max(0, Number(value || 0)).toLocaleString("ko-KR")}원`;
}
