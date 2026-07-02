export type CalendarEventDto = {
  id: string;
  source: string;
  category: string;
  studentName: string | null;
  className: string | null;
  time: string | null;
  note: string | null;
  deletable: boolean;
};
