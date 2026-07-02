"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useEffect, useMemo, useState } from "react";

type RouteItem = {
  id: string;
  day_of_week: string;
  class_name: string;
  start_time: string;
  end_time: string;
  description: string | null;
  shuttle_registrations?: { id: string }[];
};

type StudentItem = {
  registrationId: string;
  memberId: string | null;
  studentName: string;
  pickupLocation: string;
  dropoffLocation: string | null;
  parentPhone1: string;
  parentPhone2: string | null;
  parentName: string | null;
  specialNotes: string | null;
  hasBoarded: boolean | null;
  arrivalTime: string | null;
  status: "boarded" | "not_boarded" | "not_recorded";
};

type Driver = {
  id: string;
  name: string;
  phone: string;
  license_number: string | null;
  car_info: string | null;
  status: string;
};

const days = [
  { key: "월", label: "월" },
  { key: "화", label: "화" },
  { key: "수", label: "수" },
  { key: "목", label: "목" },
  { key: "금", label: "금" },
  { key: "토", label: "토" },
  { key: "일", label: "일" },
];

export default function ShuttlePage() {
  const [selectedDay, setSelectedDay] = useState("금");
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [expandedRouteId, setExpandedRouteId] = useState("");
  const [todayData, setTodayData] = useState<Record<string, { students: StudentItem[]; stats: { total: number; boarded: number; notBoarded: number; notRecorded: number } }>>({});
  const [students, setStudents] = useState<{ id: string; name: string; parent_name: string | null; parent_phone: string | null }[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<{ totalBoarded: number; boardingRate: number; avgBoarded: number; totalDays: number } | null>(null);
  const [routeStats, setRouteStats] = useState<{ routeName: string; totalRegistered: number; totalBoarded: number; avgBoarded: number; boardingRate: number }[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [newRoute, setNewRoute] = useState({
    className: "",
    startTime: "16:40",
    endTime: "17:30",
    description: "",
  });
  const [newReg, setNewReg] = useState({
    routeId: "",
    memberId: "",
    studentName: "",
    pickupLocation: "",
    dropoffLocation: "",
    parentPhone1: "",
    parentPhone2: "",
    parentName: "",
    specialNotes: "",
  });
  const [newDriver, setNewDriver] = useState({
    name: "",
    phone: "",
    licenseNumber: "",
    carInfo: "",
  });
  const [range, setRange] = useState(() => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const start = new Date(today.getTime() - 13 * 86400000).toISOString().slice(0, 10);
    return { startDate: start, endDate: end };
  });

  const loadRoutes = async () => {
    const res = await authFetch(`/api/shuttle/routes?day=${encodeURIComponent(selectedDay)}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "셔틀 노선 조회 실패");
      return;
    }
    setRoutes(json.data ?? []);
  };

  const loadStudents = async () => {
    const res = await authFetch("/api/students?status=active&sort=name.asc");
    const json = await res.json();
    if (res.ok) setStudents(json.data ?? []);
  };

  const loadDrivers = async () => {
    const res = await authFetch("/api/shuttle/drivers");
    const json = await res.json();
    if (res.ok) setDrivers(json ?? []);
  };

  const loadStats = async () => {
    const res = await authFetch(
      `/api/shuttle/stats?startDate=${range.startDate}&endDate=${range.endDate}`
    );
    const json = await res.json();
    if (!res.ok) return;
    setStats(json.stats ?? null);
    setRouteStats(json.routeStats ?? []);
  };

  useEffect(() => {
    void loadRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  useEffect(() => {
    void loadStudents();
    void loadDrivers();
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const toggleRoute = async (routeId: string) => {
    if (expandedRouteId === routeId) {
      setExpandedRouteId("");
      return;
    }
    setExpandedRouteId(routeId);
    if (!todayData[routeId]) {
      const res = await authFetch(`/api/shuttle/routes/${routeId}/today?date=${todayKey}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "탑승 현황 조회 실패");
        return;
      }
      setTodayData((prev) => ({ ...prev, [routeId]: json }));
    }
  };

  const createRoute = async () => {
    const res = await authFetch("/api/shuttle/routes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayOfWeek: selectedDay,
        className: newRoute.className,
        startTime: newRoute.startTime,
        endTime: newRoute.endTime,
        description: newRoute.description,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "노선 생성 실패");
      return;
    }
    setMessage("노선이 생성되었습니다.");
    setNewRoute({ className: "", startTime: "16:40", endTime: "17:30", description: "" });
    await loadRoutes();
  };

  const addStudentToRoute = async () => {
    const res = await authFetch("/api/shuttle/students/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shuttleRouteId: newReg.routeId,
        memberId: newReg.memberId || null,
        studentName: newReg.studentName,
        pickupLocation: newReg.pickupLocation,
        dropoffLocation: newReg.dropoffLocation || null,
        parentPhone1: newReg.parentPhone1,
        parentPhone2: newReg.parentPhone2 || null,
        parentName: newReg.parentName || null,
        specialNotes: newReg.specialNotes || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "학생 추가 실패");
      return;
    }
    setMessage("셔틀 탑승 학생이 추가되었습니다.");
    setNewReg({
      routeId: "",
      memberId: "",
      studentName: "",
      pickupLocation: "",
      dropoffLocation: "",
      parentPhone1: "",
      parentPhone2: "",
      parentName: "",
      specialNotes: "",
    });
    await loadRoutes();
    if (expandedRouteId) {
      const res2 = await authFetch(`/api/shuttle/routes/${expandedRouteId}/today?date=${todayKey}`);
      if (res2.ok) {
        const json2 = await res2.json();
        setTodayData((prev) => ({ ...prev, [expandedRouteId]: json2 }));
      }
    }
  };

  const recordBoarding = async (registrationId: string, hasBoarded: boolean) => {
    const now = new Date();
    const arrival = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const res = await authFetch("/api/shuttle/attendance/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registrationId,
        date: todayKey,
        hasBoarded,
        arrivalTime: hasBoarded ? arrival : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "탑승 기록 실패");
      return;
    }
    if (!expandedRouteId) return;
    const res2 = await authFetch(`/api/shuttle/routes/${expandedRouteId}/today?date=${todayKey}`);
    const json2 = await res2.json();
    if (res2.ok) setTodayData((prev) => ({ ...prev, [expandedRouteId]: json2 }));
  };

  const addDriver = async () => {
    const res = await authFetch("/api/shuttle/drivers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDriver),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "운전사 추가 실패");
      return;
    }
    setNewDriver({ name: "", phone: "", licenseNumber: "", carInfo: "" });
    await loadDrivers();
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">셔틀 관리</h1>
      {error ? <p className="text-rose-500">{error}</p> : null}
      {message ? <p className="text-emerald-600">{message}</p> : null}

      <section className="flex flex-wrap gap-2">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            className={`rounded border px-3 py-1.5 text-sm ${
              selectedDay === day.key
                ? "bg-blue-600 text-white border-blue-600"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
            onClick={() => setSelectedDay(day.key)}
          >
            {day.label}
          </button>
        ))}
      </section>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-4">
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="반명 (예: 유소년 여자 1부)"
          value={newRoute.className}
          onChange={(e) => setNewRoute((p) => ({ ...p, className: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          type="time"
          value={newRoute.startTime}
          onChange={(e) => setNewRoute((p) => ({ ...p, startTime: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          type="time"
          value={newRoute.endTime}
          onChange={(e) => setNewRoute((p) => ({ ...p, endTime: e.target.value }))}
        />
        <button
          type="button"
          onClick={createRoute}
          className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          노선 추가
        </button>
      </section>

      <section className="grid gap-4">
        {routes.map((route) => {
          const info = todayData[route.id];
          const statsBox = info?.stats;
          return (
            <article key={route.id} className="rounded-xl border dark:border-zinc-800">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
                onClick={() => toggleRoute(route.id)}
              >
                <div>
                  <p className="font-semibold">🚌 {route.day_of_week} {route.class_name}</p>
                  <p className="text-sm opacity-75">
                    {route.start_time.slice(0, 5)} ~ {route.end_time.slice(0, 5)}
                  </p>
                </div>
                <div className="text-sm">
                  <span className="mr-3 text-blue-600">등록 {(route.shuttle_registrations ?? []).length}명</span>
                  <span className="mr-3 text-emerald-600">탑승 {statsBox?.boarded ?? 0}명</span>
                  <span className="text-rose-600">미탑승 {statsBox?.notBoarded ?? 0}명</span>
                </div>
              </button>
              {expandedRouteId === route.id ? (
                <div className="border-t p-4 dark:border-zinc-800">
                  {(info?.students ?? []).length === 0 ? (
                    <p className="text-sm opacity-70">등록 학생이 없습니다.</p>
                  ) : (
                    <div className="grid gap-3">
                      {(info?.students ?? []).map((student) => (
                        <div
                          key={student.registrationId}
                          className={`rounded border p-3 ${
                            student.status === "boarded"
                              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                              : student.status === "not_boarded"
                              ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20"
                              : "border-zinc-200 dark:border-zinc-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">{student.studentName}</p>
                              <p className="text-xs opacity-75">탑승지: {student.pickupLocation}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                                onClick={() => recordBoarding(student.registrationId, true)}
                              >
                                ✓ 탑승
                              </button>
                              <button
                                type="button"
                                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                                onClick={() => recordBoarding(student.registrationId, false)}
                              >
                                ✗ 미탑승
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs">
                            <p>보호자: {student.parentName ?? "-"}</p>
                            <div className="flex flex-wrap gap-2">
                              <a href={`tel:${student.parentPhone1}`} className="underline">📞 {student.parentPhone1}</a>
                              <a href={`sms:${student.parentPhone1}`} className="underline">💬 문자</a>
                              {student.parentPhone2 ? (
                                <a href={`tel:${student.parentPhone2}`} className="underline">📞 {student.parentPhone2}</a>
                              ) : null}
                            </div>
                            <p>특이사항: {student.specialNotes ?? "-"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-3">
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={newReg.routeId}
          onChange={(e) => setNewReg((p) => ({ ...p, routeId: e.target.value }))}
        >
          <option value="">노선 선택</option>
          {routes.map((route) => (
            <option key={route.id} value={route.id}>
              {route.day_of_week} {route.class_name}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          value={newReg.memberId}
          onChange={(e) => {
            const memberId = e.target.value;
            const selected = students.find((s) => s.id === memberId);
            setNewReg((p) => ({
              ...p,
              memberId,
              studentName: selected?.name ?? p.studentName,
              parentName: selected?.parent_name ?? p.parentName,
              parentPhone1: selected?.parent_phone ?? p.parentPhone1,
            }));
          }}
        >
          <option value="">학생 선택(회원 연동)</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="학생명"
          value={newReg.studentName}
          onChange={(e) => setNewReg((p) => ({ ...p, studentName: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="탑승지"
          value={newReg.pickupLocation}
          onChange={(e) => setNewReg((p) => ({ ...p, pickupLocation: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="내릴지(선택)"
          value={newReg.dropoffLocation}
          onChange={(e) => setNewReg((p) => ({ ...p, dropoffLocation: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="보호자 전화1"
          value={newReg.parentPhone1}
          onChange={(e) => setNewReg((p) => ({ ...p, parentPhone1: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="보호자 전화2(선택)"
          value={newReg.parentPhone2}
          onChange={(e) => setNewReg((p) => ({ ...p, parentPhone2: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="보호자명"
          value={newReg.parentName}
          onChange={(e) => setNewReg((p) => ({ ...p, parentName: e.target.value }))}
        />
        <textarea
          className="min-h-20 rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700 md:col-span-2"
          placeholder="특이사항"
          value={newReg.specialNotes}
          onChange={(e) => setNewReg((p) => ({ ...p, specialNotes: e.target.value }))}
        />
        <button
          type="button"
          onClick={addStudentToRoute}
          className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          학생 추가
        </button>
      </section>

      <section className="grid gap-3 rounded-xl border p-4 dark:border-zinc-800 md:grid-cols-4">
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="운전사명"
          value={newDriver.name}
          onChange={(e) => setNewDriver((p) => ({ ...p, name: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="전화번호"
          value={newDriver.phone}
          onChange={(e) => setNewDriver((p) => ({ ...p, phone: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="면허번호"
          value={newDriver.licenseNumber}
          onChange={(e) => setNewDriver((p) => ({ ...p, licenseNumber: e.target.value }))}
        />
        <input
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="차량정보"
          value={newDriver.carInfo}
          onChange={(e) => setNewDriver((p) => ({ ...p, carInfo: e.target.value }))}
        />
        <button
          type="button"
          onClick={addDriver}
          className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900 md:col-span-4"
        >
          운전사 추가
        </button>
        <div className="md:col-span-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900/60">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">전화</th>
                <th className="px-3 py-2 text-left">면허</th>
                <th className="px-3 py-2 text-left">차량</th>
                <th className="px-3 py-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{driver.name}</td>
                  <td className="px-3 py-2">
                    <a href={`tel:${driver.phone}`} className="underline">{driver.phone}</a>
                  </td>
                  <td className="px-3 py-2">{driver.license_number ?? "-"}</td>
                  <td className="px-3 py-2">{driver.car_info ?? "-"}</td>
                  <td className="px-3 py-2">{driver.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border p-4 dark:border-zinc-800">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            type="date"
            value={range.startDate}
            onChange={(e) => setRange((p) => ({ ...p, startDate: e.target.value }))}
          />
          <span>~</span>
          <input
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            type="date"
            value={range.endDate}
            onChange={(e) => setRange((p) => ({ ...p, endDate: e.target.value }))}
          />
          <button
            type="button"
            onClick={loadStats}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
          >
            조회
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="총 탑승자" value={`${stats?.totalBoarded ?? 0}명`} />
          <StatCard label="탑승률" value={`${stats?.boardingRate ?? 0}%`} />
          <StatCard label="평균 탑승자" value={`${stats?.avgBoarded ?? 0}명`} />
          <StatCard label="총 운행 일수" value={`${stats?.totalDays ?? 0}일`} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900/60">
              <tr>
                <th className="px-3 py-2 text-left">노선</th>
                <th className="px-3 py-2 text-left">등록 인원</th>
                <th className="px-3 py-2 text-left">총 탑승</th>
                <th className="px-3 py-2 text-left">평균 탑승</th>
                <th className="px-3 py-2 text-left">탑승률</th>
              </tr>
            </thead>
            <tbody>
              {routeStats.map((row, idx) => (
                <tr key={`${row.routeName}-${idx}`} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{row.routeName}</td>
                  <td className="px-3 py-2">{row.totalRegistered}</td>
                  <td className="px-3 py-2">{row.totalBoarded}</td>
                  <td className="px-3 py-2">{row.avgBoarded}</td>
                  <td className="px-3 py-2">{row.boardingRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3 dark:border-zinc-700">
      <p className="text-sm opacity-70">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
