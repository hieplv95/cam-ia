/**
 * Reporting an AI result (required by Google Play's AI-generated content policy): shared by the report sheet
 * and /api/report. Labels: report.reason.<id>.
 */
export const REPORT_REASONS = ['sexual', 'violent', 'hateful', 'dangerous', 'misleading', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const isReportReason = (v: unknown): v is ReportReason => REPORT_REASONS.includes(v as ReportReason);

export const MAX_REPORT_NOTE = 300;
export const MAX_REPORT_PROMPT = 2000;
/** Reports one person may send a day (their device, or their hashed IP). */
export const REPORTS_PER_DAY = 20;
/** Reported pictures are deleted after this long, reviewed or not (see the privacy policy). */
export const REPORT_IMAGE_DAYS = 90;

/** One report as the admin page shows it. */
export type ReportRow = {
  id: number;
  createdAt: number;
  userId: number | null;
  email: string | null;
  tool: string;
  reason: ReportReason;
  note: string;
  prompt: string;
  /** JPEG base64, or null when there was none or it was deleted after REPORT_IMAGE_DAYS. */
  image: string | null;
  status: 'open' | 'done';
};

export type ReportList = { reports: ReportRow[]; open: number; done: number; pageSize: number };
