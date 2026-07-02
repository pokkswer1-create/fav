import type { ApprovalStatus } from "@/lib/types";

export const DEFAULT_APPROVAL_STATUS: ApprovalStatus = "PENDING";

export function toApprovalStatus(
  approvalStatus: string | null | undefined,
  approved: boolean | null | undefined
): ApprovalStatus {
  if (approvalStatus === "APPROVED" || approvalStatus === "PENDING" || approvalStatus === "REJECTED") {
    return approvalStatus;
  }
  return approved === false ? "PENDING" : "APPROVED";
}

export function isApprovedStatus(status: ApprovalStatus) {
  return status === "APPROVED";
}

