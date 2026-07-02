insert into public.students
  (name, phone, email, grade, status, join_date, parent_name, parent_phone, notes)
values
  ('주하린', '010-1111-2222', 'harin@example.com', '초3', 'active', current_date - interval '20 days', '이은정', '010-9999-1111', '수학 집중반'),
  ('김민준', '010-3333-4444', 'minjun@example.com', '초4', 'active', current_date - interval '15 days', '김도윤', '010-7777-1212', null),
  ('박서윤', '010-5555-6666', 'seoyun@example.com', '중1', 'paused', current_date - interval '40 days', '박민수', '010-8888-3434', '4월 복귀 예정');

insert into public.classes
  (name, teacher_name, class_type, days_of_week, start_time, end_time, monthly_fee, monthly_sessions, capacity, makeup_capacity)
values
  ('초3 수학반', '김선생', 'regular', array['mon', 'wed', 'fri'], '14:00', '15:00', 350000, 12, 12, 6),
  ('초4 영어 체험', '박선생', 'trial', array['tue', 'thu'], '16:00', '17:00', 50000, 4, 10, 0),
  ('방학 특강: 경시준비', '이선생', 'oneday', array['sat'], '10:00', '11:30', 50000, 1, 20, 0);

insert into public.enrollments (student_id, class_id)
select s.id, c.id
from public.students s
join public.classes c on c.name = '초3 수학반'
where s.name in ('주하린', '김민준')
on conflict do nothing;

insert into public.payments (student_id, month_key, amount_due, amount_paid, status, paid_at)
select s.id, to_char(current_date, 'YYYY-MM'), 350000,
  case when s.name = '주하린' then 350000 else 0 end,
  case when s.name = '주하린' then 'paid' else 'unpaid' end,
  case when s.name = '주하린' then now() else null end
from public.students s
where s.name in ('주하린', '김민준')
on conflict (student_id, month_key) do nothing;

-- 학부모 공개 사이트 기본 설정·공지 (스키마에 테이블이 있을 때만 유효)
insert into public.academy_settings (setting_key, setting_value, category) values
  (
    'tuition',
    '{"60min":{"1week":180000,"2week":320000,"fee":50000,"kit":"웰컴키트 별도 안내"},"90min":{"1week":220000,"2week":380000,"fee":50000,"kit":"웰컴키트 별도 안내"},"elite":{"monthly":280000,"fee":50000,"kit":"유니폼·양말 등"},"adult":{"evening":120000,"morning":150000}}'::jsonb,
    'tuition'
  ),
  (
    'preparation_items',
    '["실내전용 운동화 필수","음식물 반입 제한","개인 물통 지참"]'::jsonb,
    'preparation'
  ),
  (
    'shuttle_info',
    '{"youth":"유소년 셔틀 노선은 상담 시 안내","adult":"성인반 별도 문의","schedule":"시간표는 카카오 오픈채팅에서 확인"}'::jsonb,
    'shuttle'
  ),
  (
    'payment_guide',
    '{"info1":"전월 15일~익월 5일 선결제","info2":"월 단위 결제","info3":"카카오톡 결제 링크 발송","info4":"현장 결제 가능 여부는 사무실 문의"}'::jsonb,
    'payment'
  ),
  (
    'makeup_policy',
    '{"min60":"월 2회","min90":"월 2회","elite":"대표팀 별도 규정","adult":"성인반 제한적"}'::jsonb,
    'makeup'
  ),
  (
    'refund_policy',
    '{"bullets":["서비스 개시 전: 납부 수강료 전액 환불","첫 수업 전: 총액의 10% 위약금 공제 후 환불","1회 수업 후: 위약금 10% + 1회분 공제","2회 수업 후: 위약금 10% + 2회분 공제","3회 이상: 학원법 및 내부 규정에 따라 환불 불가"]}'::jsonb,
    'refund'
  )
on conflict (setting_key) do update set
  setting_value = excluded.setting_value,
  category = excluded.category;

insert into public.public_notices (title, content, category, is_published)
values
  (
    'JB 스포츠 봄 시즌 안내',
    '새 학기 정규·체험 수업 일정은 카카오톡 또는 전화로 문의해 주세요.',
    'announcement',
    true
  );

-- Run these after creating auth users and matching profiles manually.
-- Example salary policy defaults for teacher accounts:
-- insert into public.salary_policies
--   (teacher_profile_id, base_salary, class_bonus_per_record, journal_bonus_per_record, deduction_rate)
-- values
--   ('<teacher-profile-uuid>', 2000000, 3000, 5000, 5.0)
-- on conflict (teacher_profile_id) do update
-- set
--   base_salary = excluded.base_salary,
--   class_bonus_per_record = excluded.class_bonus_per_record,
--   journal_bonus_per_record = excluded.journal_bonus_per_record,
--   deduction_rate = excluded.deduction_rate;
