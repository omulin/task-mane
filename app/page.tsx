"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

type CurrentUser = {
  id: number | null;
  name: string | null;
  email: string | null;
  role: string | null;
};

type TeamSummary = {
  id: number;
  name: string;
  createdById?: number | null;
  _count?: {
    users: number;
    subTeams: number;
  };
};

type SubTeamSummary = {
  id: number;
  name: string;
  teamId: number;
  createdById?: number | null;
  team?: {
    id: number;
    name: string;
  };
  _count?: {
    users: number;
  };
};

type UserSummary = {
  id: number;
  name: string;
  email: string;
  role: string;
  teamId?: number | null;
  subTeamId?: number | null;
  team?: {
    id: number;
    name: string;
  } | null;
  subTeam?: {
    id: number;
    name: string;
    teamId: number;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

type TaskItem = {
  id: number;
  title: string;
  label?: string | null;
  color?: string | null;
  status: "TODO" | "DOING" | "DONE";
  approval?: string;
  assigneeId: number;
  createdById: number;
  startDate?: string | null;
  endDate?: string | null;
  week?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

type ScheduleView = "gantt" | "calendar";
type TaskPanelView = "create" | "manage";

const MANAGEMENT_ROLES = ["STAFF", "MANAGER", "DIRECTOR", "AREA", "ADMIN"];

function isManagementRole(role: string | null | undefined) {
  return !!role && MANAGEMENT_ROLES.includes(role);
}

export default function Home() {
  const { data: session } = useSession();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [usersList, setUsersList] = useState<UserSummary[]>([]);
  const [teamsList, setTeamsList] = useState<TeamSummary[]>([]);
  const [subTeamsList, setSubTeamsList] = useState<SubTeamSummary[]>([]);

  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [newTaskColor, setNewTaskColor] = useState("#4a90e2");

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("USER");

  const [newTeamName, setNewTeamName] = useState("");
  const [newSubTeamName, setNewSubTeamName] = useState("");
  const [selectedTeamIdForSubTeam, setSelectedTeamIdForSubTeam] = useState("");

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userTeamFilter, setUserTeamFilter] = useState("all");
  const [userSubTeamFilter, setUserSubTeamFilter] = useState("all");

  const [userId, setUserId] = useState<number | null>(null);
  const [staffView, setStaffView] = useState<"tasks" | "users">("tasks");
  const [scheduleView, setScheduleView] = useState<ScheduleView>("gantt");
  const [taskPanelView, setTaskPanelView] = useState<TaskPanelView>("create");
  const [historyTargetUserId, setHistoryTargetUserId] = useState<string>("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    id: null,
    name: null,
    email: null,
    role: null,
  });

  const fetchTasks = () => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTasks(data);
        } else {
          setTasks([]);
        }
      });
  };

  const fetchUsers = () => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUsersList(data);
        } else {
          setUsersList([]);
        }
      });
  };

  const fetchTeams = () => {
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTeamsList(data);
        } else {
          setTeamsList([]);
        }
      });
  };

  const fetchSubTeams = () => {
    fetch("/api/subTeams")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSubTeamsList(data);
        } else {
          setSubTeamsList([]);
        }
      });
  };

  const fetchMe = () => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        const nextRole = data?.role ?? null;

        setUserId(data?.id ?? null);
        setCurrentUser({
          id: data?.id ?? null,
          name: data?.name ?? null,
          email: data?.email ?? null,
          role: nextRole,
        });

        if (!isManagementRole(nextRole)) {
          setStaffView("tasks");
          setHistoryTargetUserId("all");
        }
      });
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (!session) {
      setUserId(null);
      setUsersList([]);
      setTeamsList([]);
      setSubTeamsList([]);
      setCurrentUser({
        id: null,
        name: null,
        email: null,
        role: null,
      });
      setStaffView("tasks");
      setScheduleView("gantt");
      setTaskPanelView("create");
      setHistoryTargetUserId("all");
      setWeekOffset(0);
      setMonthOffset(0);
      return;
    }

    fetchMe();
    fetchTasks();
  }, [session]);

  useEffect(() => {
    if (!session || !isManagementRole(currentUser.role)) {
      setUsersList([]);
      setTeamsList([]);
      setSubTeamsList([]);
      return;
    }

    fetchUsers();
    fetchTeams();
    fetchSubTeams();
  }, [session, currentUser.role]);

  const createTask = async () => {
    if (!newTitle.trim()) return;

    await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: newTitle,
        startDate: newStart,
        endDate: newEnd,
        label: newTaskLabel,
        color: newTaskColor,
      }),
    });

    setNewTitle("");
    setNewStart("");
    setNewEnd("");
    setNewTaskLabel("");
    setNewTaskColor("#4a90e2");
    fetchTasks();
  };

  const createUser = async () => {
    if (!newUserName || !newUserEmail) return;

    await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      }),
    });

    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole("USER");
    fetchUsers();
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;

    await fetch("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newTeamName,
      }),
    });

    setNewTeamName("");
    fetchTeams();
  };

  const createSubTeam = async () => {
    if (!newSubTeamName.trim() || !selectedTeamIdForSubTeam) return;

    await fetch("/api/subTeams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newSubTeamName,
        teamId: Number(selectedTeamIdForSubTeam),
      }),
    });

    setNewSubTeamName("");
    fetchTeams();
    fetchSubTeams();
  };

  const updateUserRole = async (id: number, role: string) => {
    await fetch("/api/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        role,
      }),
    });

    fetchUsers();

    if (id === userId) {
      fetchMe();
      fetchTasks();
    }
  };

  const updateUserAssignment = async (
    id: number,
    teamId: number | null,
    subTeamId: number | null
  ) => {
    await fetch("/api/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        teamId,
        subTeamId,
      }),
    });

    fetchUsers();
    fetchTeams();
    fetchSubTeams();
  };

  const updateTaskStatus = async (
    id: number,
    status: "TODO" | "DOING" | "DONE"
  ) => {
    await fetch("/api/tasks", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, status }),
    });
    fetchTasks();
  };

  const saveTask = async (task: TaskItem) => {
    await fetch("/api/tasks", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: task.id,
        title: task.title,
        startDate: task.startDate || null,
        endDate: task.endDate || null,
        label: task.label ?? "",
        color: task.color ?? "#4a90e2",
        assigneeId: task.assigneeId,
      }),
    });
    fetchTasks();
  };

  const saveTeamName = async (team: TeamSummary) => {
    await fetch("/api/teams", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: team.id,
        name: team.name,
      }),
    });
    fetchTeams();
    fetchSubTeams();
    fetchUsers();
  };

  const saveSubTeamName = async (subTeam: SubTeamSummary) => {
    await fetch("/api/subTeams", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: subTeam.id,
        name: subTeam.name,
      }),
    });
    fetchSubTeams();
    fetchUsers();
  };

  const handleRoleSelectChange = (id: number, role: string) => {
    setUsersList((prev) =>
      prev.map((user) => (user.id === id ? { ...user, role } : user))
    );
  };

  const handleUserTeamChange = (id: number, value: string) => {
    const teamId = value === "" ? null : Number(value);
    const selectedTeam =
      teamId === null ? null : teamsList.find((team) => team.id === teamId) || null;

    setUsersList((prev) =>
      prev.map((user) =>
        user.id === id
          ? {
              ...user,
              teamId,
              team: selectedTeam ? { id: selectedTeam.id, name: selectedTeam.name } : null,
              subTeamId: null,
              subTeam: null,
            }
          : user
      )
    );
  };

  const handleUserSubTeamChange = (id: number, value: string) => {
    const subTeamId = value === "" ? null : Number(value);
    const selectedSubTeam =
      subTeamId === null
        ? null
        : subTeamsList.find((subTeam) => subTeam.id === subTeamId) || null;
    const selectedTeam =
      selectedSubTeam === null
        ? null
        : teamsList.find((team) => team.id === selectedSubTeam.teamId) || null;

    setUsersList((prev) =>
      prev.map((user) =>
        user.id === id
          ? {
              ...user,
              teamId:
                selectedSubTeam !== null
                  ? selectedSubTeam.teamId
                  : user.teamId ?? null,
              team:
                selectedSubTeam && selectedTeam
                  ? { id: selectedTeam.id, name: selectedTeam.name }
                  : user.team ?? null,
              subTeamId,
              subTeam: selectedSubTeam
                ? {
                    id: selectedSubTeam.id,
                    name: selectedSubTeam.name,
                    teamId: selectedSubTeam.teamId,
                  }
                : null,
            }
          : user
      )
    );
  };

  const handleTaskLocalChange = (
    id: number,
    patch: Partial<
      Pick<TaskItem, "title" | "startDate" | "endDate" | "label" | "color" | "assigneeId">
    >
  ) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...patch } : task))
    );
  };

  const handleTeamLocalChange = (id: number, name: string) => {
    setTeamsList((prev) =>
      prev.map((team) => (team.id === id ? { ...team, name } : team))
    );
  };

  const handleSubTeamLocalChange = (id: number, name: string) => {
    setSubTeamsList((prev) =>
      prev.map((subTeam) => (subTeam.id === id ? { ...subTeam, name } : subTeam))
    );
  };

  const deleteTask = async (id: number) => {
    await fetch("/api/tasks", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    fetchTasks();
  };

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const toDateKey = (value: string | Date) => {
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const isTaskOnDate = (task: TaskItem, date: Date) => {
    if (!task.startDate) return false;

    const targetKey = toDateKey(date);
    const startKey = toDateKey(task.startDate);
    const endKey = task.endDate ? toDateKey(task.endDate) : startKey;

    return startKey <= targetKey && targetKey <= endKey;
  };

  const formatMonthDay = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatMonthLabel = (date: Date) => {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };

  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  const navButtonStyle = {
    minWidth: 68,
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: "#4a90e2",
    color: "#fff",
    fontWeight: 700,
  } as const;

  const smallMutedText = {
    fontSize: 12,
    color: "#666",
  } as const;

  const actionButtonStyle = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: "#4a90e2",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
  } as const;

  const subtleButtonStyle = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    cursor: "pointer",
    background: "#fff",
    color: "#111827",
    fontSize: 12,
  } as const;

  const compactInputStyle = {
    maxWidth: 140,
  } as const;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const actualTodayStr = formatDateKey(today);

  const baseWeekDate = new Date(today);
  baseWeekDate.setDate(today.getDate() + weekOffset * 7);

  const startOfWeek = new Date(baseWeekDate);
  startOfWeek.setDate(baseWeekDate.getDate() - baseWeekDate.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const firstWeekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return date;
  });

  const secondWeekStart = new Date(startOfWeek);
  secondWeekStart.setDate(startOfWeek.getDate() + 7);
  secondWeekStart.setHours(0, 0, 0, 0);

  const secondWeekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(secondWeekStart);
    date.setDate(secondWeekStart.getDate() + i);
    return date;
  });

  const ganttRangeStart = firstWeekDates[0];
  const ganttRangeEnd = secondWeekDates[6];
  const ganttRangeLabel = `${formatMonthDay(ganttRangeStart)} 〜 ${formatMonthDay(
    ganttRangeEnd
  )}`;

  const baseMonthDate = new Date(today);
  baseMonthDate.setMonth(today.getMonth() + monthOffset);
  baseMonthDate.setDate(1);
  baseMonthDate.setHours(0, 0, 0, 0);

  const monthLabel = formatMonthLabel(baseMonthDate);

  const monthStart = new Date(baseMonthDate);
  const monthEnd = new Date(baseMonthDate.getFullYear(), baseMonthDate.getMonth() + 1, 0);

  const calendarGridStart = new Date(monthStart);
  calendarGridStart.setDate(monthStart.getDate() - monthStart.getDay());
  calendarGridStart.setHours(0, 0, 0, 0);

  const calendarGridEnd = new Date(monthEnd);
  calendarGridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));
  calendarGridEnd.setHours(0, 0, 0, 0);

  const totalCalendarDays =
    Math.round(
      (calendarGridEnd.getTime() - calendarGridStart.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

  const calendarDates = Array.from({ length: totalCalendarDays }, (_, i) => {
    const date = new Date(calendarGridStart);
    date.setDate(calendarGridStart.getDate() + i);
    return date;
  });

  const calendarRows: Date[][] = [];
  for (let i = 0; i < calendarDates.length; i += 7) {
    calendarRows.push(calendarDates.slice(i, i + 7));
  }

  const todayTasks = tasks.filter((t) => isTaskOnDate(t, today));

  const progress = Math.round(
    (tasks.filter((t) => t.status === "DONE").length / (tasks.length || 1)) * 100
  );

  const totalUsers = usersList.length;
  const totalStaff = usersList.filter((u) => u.role === "STAFF").length;
  const totalNormalUsers = usersList.filter((u) => u.role === "USER").length;
  const totalTeams = teamsList.length;
  const totalSubTeams = subTeamsList.length;
  const unassignedUsers = usersList.filter((u) => !u.teamId).length;

  const isManagementUser = isManagementRole(currentUser.role);
  const isStaffUsersView = isManagementUser && staffView === "users";

  const completedTasks = useMemo(() => {
    return tasks.filter((task) => task.status === "DONE");
  }, [tasks]);

  const historyTasks = useMemo(() => {
    if (isManagementUser) {
      if (historyTargetUserId === "all") return completedTasks;
      return completedTasks.filter(
        (task) => String(task.createdById) === historyTargetUserId
      );
    }

    if (!userId) return [];
    return completedTasks.filter((task) => task.createdById === userId);
  }, [completedTasks, isManagementUser, historyTargetUserId, userId]);

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();

    return usersList.filter((user) => {
      const keywordMatch =
        keyword === "" ||
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        (user.team?.name ?? "").toLowerCase().includes(keyword) ||
        (user.subTeam?.name ?? "").toLowerCase().includes(keyword);

      const roleMatch = userRoleFilter === "all" || user.role === userRoleFilter;

      const teamMatch =
        userTeamFilter === "all" ||
        (userTeamFilter === "__unassigned__" && !user.teamId) ||
        String(user.teamId ?? "") === userTeamFilter;

      const subTeamMatch =
        userSubTeamFilter === "all" ||
        (userSubTeamFilter === "__unassigned__" && !user.subTeamId) ||
        String(user.subTeamId ?? "") === userSubTeamFilter;

      return keywordMatch && roleMatch && teamMatch && subTeamMatch;
    });
  }, [usersList, userSearch, userRoleFilter, userTeamFilter, userSubTeamFilter]);

  const renderTaskLabelChip = (task: TaskItem) => {
    if (!task.label) return null;

    return (
      <span
        style={{
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 999,
          background: "#eef2ff",
          color: "#334155",
          whiteSpace: "nowrap",
        }}
      >
        {task.label}
      </span>
    );
  };

  const renderGanttWeek = (weekDates: Date[], rowLabel: string) => {
    const weekStart = new Date(weekDates[0]);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekDates[6]);
    weekEnd.setHours(23, 59, 59, 999);

    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ ...smallMutedText, fontWeight: "bold", marginBottom: 6 }}>
          {rowLabel}
        </div>

        <div style={{ display: "flex", marginBottom: 8 }}>
          <div style={{ width: 88 }} />
          {weekDates.map((date) => (
            <div key={formatDateKey(date)} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 11 }}>{weekdayLabels[date.getDay()]}</div>
              <div style={{ fontSize: 10, color: "#666" }}>{formatMonthDay(date)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          {tasks.map((task) => {
            if (!task.startDate || !task.endDate) return null;

            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);

            taskStart.setHours(0, 0, 0, 0);
            taskEnd.setHours(0, 0, 0, 0);

            if (taskEnd < weekStart || taskStart > weekEnd) {
              return null;
            }

            const visibleStart = taskStart < weekStart ? weekStart : taskStart;
            const visibleEnd = taskEnd > weekEnd ? weekEnd : taskEnd;

            const startOffset = Math.floor(
              (visibleStart.getTime() - weekStart.getTime()) / 86400000
            );
            const endOffset = Math.floor(
              (visibleEnd.getTime() - weekStart.getTime()) / 86400000
            );
            const span = endOffset - startOffset + 1;

            return (
              <div
                key={`${rowLabel}-${task.id}`}
                style={{ display: "flex", alignItems: "center", height: 34 }}
              >
                <div
                  style={{
                    width: 88,
                    fontSize: 12,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {task.title}
                </div>
                <div style={{ flex: 1, position: "relative", height: 18 }}>
                  <div
                    style={{
                      position: "absolute",
                      left: `${(startOffset / 7) * 100}%`,
                      width: `${(span / 7) * 100}%`,
                      height: 8,
                      borderRadius: 999,
                      background: task.color || "#4a90e2",
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="container"
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", gap: 12, height: "35%" }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">支援管理システム</div>

          <div className="tabs">
            <div className={`tab ${!isManagementUser ? "active" : ""}`}>利用者</div>
            <div className={`tab ${isManagementUser ? "active" : ""}`}>管理者</div>
          </div>

          {isManagementUser && (
            <div className="tabs" style={{ marginBottom: 8 }}>
              <div
                className={`tab ${staffView === "tasks" ? "active" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setStaffView("tasks")}
              >
                タスク管理
              </div>
              <div
                className={`tab ${staffView === "users" ? "active" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setStaffView("users")}
              >
                利用者管理
              </div>
            </div>
          )}

          {!session ? (
            <button className="button" onClick={() => signIn("google")}>
              Googleでログイン
            </button>
          ) : (
            <>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                {currentUser.name ?? session.user?.name ?? "no-name"}
              </div>

              <div style={{ fontSize: 12, marginBottom: 8 }}>
                {currentUser.email ?? session.user?.email}
              </div>

              <div
                style={{
                  fontSize: 12,
                  marginBottom: 8,
                  display: "inline-block",
                  padding: "4px 8px",
                  borderRadius: 8,
                  background: isManagementUser ? "#dbeafe" : "#f3f4f6",
                }}
              >
                権限：{currentUser.role ?? "USER"}
              </div>

              <button className="button" onClick={() => signOut()}>
                ログアウト
              </button>
            </>
          )}
        </div>

        {isStaffUsersView ? (
          <>
            <div
              className="card"
              style={{
                flex: 2,
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
              }}
            >
              <div className="tabs">
                <div className="tab active">利用者・チーム追加</div>
                <div className="tab">所属管理</div>
              </div>

              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                管理者専用：利用者追加、チーム作成、サブチーム作成ができます
              </div>

              <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>
                利用者追加
              </div>

              <input
                className="input"
                placeholder="名前"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />

              <input
                className="input"
                placeholder="メールアドレス"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />

              <input
                className="input"
                placeholder="パスワード（未入力なら1234）"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />

              <select
                className="input"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
              >
                <option value="USER">USER</option>
                <option value="STAFF">STAFF</option>
                <option value="MANAGER">MANAGER</option>
                <option value="DIRECTOR">DIRECTOR</option>
                <option value="AREA">AREA</option>
                <option value="ADMIN">ADMIN</option>
              </select>

              <button className="button" onClick={createUser}>
                利用者追加
              </button>

              <hr style={{ margin: "14px 0", borderColor: "#eee" }} />

              <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>
                チーム追加
              </div>

              <input
                className="input"
                placeholder="チーム名"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />

              <button className="button" onClick={createTeam}>
                チーム追加
              </button>

              <hr style={{ margin: "14px 0", borderColor: "#eee" }} />

              <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>
                サブチーム追加
              </div>

              <select
                className="input"
                value={selectedTeamIdForSubTeam}
                onChange={(e) => setSelectedTeamIdForSubTeam(e.target.value)}
              >
                <option value="">親チームを選択</option>
                {teamsList.map((team) => (
                  <option key={team.id} value={String(team.id)}>
                    {team.name}
                  </option>
                ))}
              </select>

              <input
                className="input"
                placeholder="サブチーム名"
                value={newSubTeamName}
                onChange={(e) => setNewSubTeamName(e.target.value)}
              />

              <button className="button" onClick={createSubTeam}>
                サブチーム追加
              </button>

              <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
                ユーザーは未所属で追加して、あとから配属できます
              </div>
            </div>

            <div className="card" style={{ flex: 1 }}>
              <div className="card-title">チームダッシュボード</div>

              <div style={{ fontSize: 20, fontWeight: "bold" }}>{totalUsers}人</div>

              <div style={{ height: 8, background: "#eee", borderRadius: 4, marginBottom: 12 }}>
                <div
                  style={{
                    width: totalUsers > 0 ? `${(totalStaff / totalUsers) * 100}%` : "0%",
                    background: "#4a90e2",
                    height: "100%",
                    borderRadius: 4,
                  }}
                />
              </div>

              利用者合計 {totalUsers}
              <br />
              STAFF {totalStaff}
              <br />
              USER {totalNormalUsers}
              <br />
              未所属 {unassignedUsers}
              <br />
              チーム {totalTeams}
              <br />
              サブチーム {totalSubTeams}
            </div>
          </>
        ) : (
          <>
            <div
              className="card"
              style={{ flex: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              <div className="card-title">タスク管理</div>

              <div className="tabs" style={{ marginBottom: 8 }}>
                <div
                  className={`tab ${taskPanelView === "create" ? "active" : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => setTaskPanelView("create")}
                >
                  追加
                </div>
                <div
                  className={`tab ${taskPanelView === "manage" ? "active" : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => setTaskPanelView("manage")}
                >
                  管理
                </div>
              </div>

              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                {isManagementUser ? "全体タスク表示" : "自分のタスク表示"}
              </div>

              {isManagementUser && (
                <div
                  style={{
                    fontSize: 12,
                    marginBottom: 8,
                    display: "inline-block",
                    padding: "4px 8px",
                    borderRadius: 8,
                    background: "#fee2e2",
                    color: "#991b1b",
                    width: "fit-content",
                  }}
                >
                  管理モード
                </div>
              )}

              {taskPanelView === "create" ? (
                <div
                  style={{
                    flex: 1,
                    paddingRight: 4,
                    display: "grid",
                    gap: 6,
                    alignContent: "start",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: "bold" }}>新規タスク</div>

                  <input
                    className="input"
                    placeholder="タスク名"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto 1fr",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="date"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                    />
                    <span style={{ fontSize: 12, color: "#666" }}>〜</span>
                    <input
                      type="date"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      className="input"
                      placeholder="ラベル"
                      value={newTaskLabel}
                      onChange={(e) => setNewTaskLabel(e.target.value)}
                    />

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#666" }}>色</span>
                      <input
                        type="color"
                        value={newTaskColor}
                        onChange={(e) => setNewTaskColor(e.target.value)}
                        style={{
                          width: 40,
                          height: 34,
                          border: "none",
                          background: "transparent",
                          padding: 0,
                        }}
                      />
                    </div>
                  </div>

                  <button className="button" onClick={createTask}>
                    追加
                  </button>
                </div>
              ) : (
                <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
                  {tasks.length === 0 && (
                    <div style={{ fontSize: 12, color: "#888" }}>タスクなし</div>
                  )}

                  {tasks.map((task) => {
                    const assigneeName =
                      usersList.find((user) => user.id === task.assigneeId)?.name ??
                      `ID: ${task.assigneeId}`;

                    return (
                      <div
                        key={task.id}
                        className="task"
                        style={{
                          borderLeft: `6px solid ${task.color || "#4a90e2"}`,
                          marginBottom: 8,
                          padding: 10,
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <div style={{ fontWeight: "bold" }}>{task.title}</div>
                              {renderTaskLabelChip(task)}
                            </div>

                            <select
                              value={task.status}
                              onChange={(e) =>
                                updateTaskStatus(
                                  task.id,
                                  e.target.value as "TODO" | "DOING" | "DONE"
                                )
                              }
                            >
                              <option value="TODO">未入力</option>
                              <option value="DOING">進行中</option>
                              <option value="DONE">完了</option>
                            </select>
                          </div>

                          <input
                            className="input"
                            value={task.title}
                            onChange={(e) =>
                              handleTaskLocalChange(task.id, { title: e.target.value })
                            }
                            placeholder="タイトル"
                          />

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            <input
                              type="date"
                              value={task.startDate ? toDateKey(task.startDate) : ""}
                              onChange={(e) =>
                                handleTaskLocalChange(task.id, {
                                  startDate: e.target.value || null,
                                })
                              }
                            />
                            <span style={{ fontSize: 12, color: "#666" }}>〜</span>
                            <input
                              type="date"
                              value={task.endDate ? toDateKey(task.endDate) : ""}
                              onChange={(e) =>
                                handleTaskLocalChange(task.id, {
                                  endDate: e.target.value || null,
                                })
                              }
                            />
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <input
                              className="input"
                              placeholder="ラベル"
                              value={task.label ?? ""}
                              onChange={(e) =>
                                handleTaskLocalChange(task.id, { label: e.target.value })
                              }
                              style={compactInputStyle}
                            />

                            <input
                              type="color"
                              value={task.color || "#4a90e2"}
                              onChange={(e) =>
                                handleTaskLocalChange(task.id, { color: e.target.value })
                              }
                              style={{
                                width: 40,
                                height: 34,
                                border: "none",
                                background: "transparent",
                              }}
                            />

                            {isManagementUser ? (
                              <select
                                value={task.assigneeId}
                                onChange={(e) =>
                                  handleTaskLocalChange(task.id, {
                                    assigneeId: Number(e.target.value),
                                  })
                                }
                                style={{ maxWidth: 160 }}
                              >
                                {usersList.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div style={{ fontSize: 12, color: "#666" }}>
                                担当: {assigneeName}
                              </div>
                            )}

                            <button style={actionButtonStyle} onClick={() => saveTask(task)}>
                              保存
                            </button>

                            <button style={subtleButtonStyle} onClick={() => deleteTask(task.id)}>
                              削除
                            </button>
                          </div>

                          {isManagementUser && (
                            <div style={{ fontSize: 11, color: "#888" }}>
                              作成者ID: {task.createdById} / 担当者: {assigneeName}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card" style={{ flex: 1 }}>
              <div className="card-title">ダッシュボード</div>

              <div style={{ fontSize: 20, fontWeight: "bold" }}>{progress}%</div>

              <div style={{ height: 8, background: "#eee", borderRadius: 4 }}>
                <div
                  style={{
                    width: `${progress}%`,
                    background: "#4a90e2",
                    height: "100%",
                    borderRadius: 4,
                  }}
                />
              </div>

              未入力 {tasks.filter((t) => t.status === "TODO").length}
              <br />
              進行中 {tasks.filter((t) => t.status === "DOING").length}
              <br />
              完了 {tasks.filter((t) => t.status === "DONE").length}
            </div>
          </>
        )}
      </div>

      {isStaffUsersView ? (
        <div style={{ display: "flex", gap: 12, height: "35%" }}>
          <div className="card" style={{ flex: 3, overflowY: "auto" }}>
            <div className="card-title">利用者一覧</div>

            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <input
                className="input"
                placeholder="名前 / メール / チーム検索"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  className="input"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  style={{ maxWidth: 150 }}
                >
                  <option value="all">全role</option>
                  <option value="USER">USER</option>
                  <option value="STAFF">STAFF</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="DIRECTOR">DIRECTOR</option>
                  <option value="AREA">AREA</option>
                  <option value="ADMIN">ADMIN</option>
                </select>

                <select
                  className="input"
                  value={userTeamFilter}
                  onChange={(e) => setUserTeamFilter(e.target.value)}
                  style={{ maxWidth: 170 }}
                >
                  <option value="all">全チーム</option>
                  <option value="__unassigned__">未所属のみ</option>
                  {teamsList.map((team) => (
                    <option key={team.id} value={String(team.id)}>
                      {team.name}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  value={userSubTeamFilter}
                  onChange={(e) => setUserSubTeamFilter(e.target.value)}
                  style={{ maxWidth: 180 }}
                >
                  <option value="all">全サブチーム</option>
                  <option value="__unassigned__">未所属のみ</option>
                  {subTeamsList.map((subTeam) => (
                    <option key={subTeam.id} value={String(subTeam.id)}>
                      {subTeam.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredUsers.length === 0 && (
              <div style={{ fontSize: 12, color: "#888" }}>該当する利用者なし</div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              {filteredUsers.map((user) => {
                const availableSubTeams = user.teamId
                  ? subTeamsList.filter((subTeam) => subTeam.teamId === user.teamId)
                  : [];

                return (
                  <div
                    key={user.id}
                    className="task"
                    style={{
                      padding: 10,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: "bold" }}>{user.name}</div>
                      <div
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#f3f4f6",
                        }}
                      >
                        {user.role}
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: "#666" }}>{user.email}</div>

                    <div style={{ fontSize: 12, color: "#444" }}>
                      {user.team?.name ?? "未所属"} / {user.subTeam?.name ?? "未所属"}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <select
                        className="input"
                        value={user.role}
                        onChange={(e) => handleRoleSelectChange(user.id, e.target.value)}
                        style={{ maxWidth: 140 }}
                      >
                        <option value="USER">USER</option>
                        <option value="STAFF">STAFF</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="DIRECTOR">DIRECTOR</option>
                        <option value="AREA">AREA</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>

                      <button
                        className="button"
                        onClick={() => updateUserRole(user.id, user.role)}
                      >
                        権限更新
                      </button>

                      <select
                        className="input"
                        value={user.teamId ?? ""}
                        onChange={(e) => handleUserTeamChange(user.id, e.target.value)}
                        style={{ maxWidth: 150 }}
                      >
                        <option value="">チーム未所属</option>
                        {teamsList.map((team) => (
                          <option key={team.id} value={String(team.id)}>
                            {team.name}
                          </option>
                        ))}
                      </select>

                      <select
                        className="input"
                        value={user.subTeamId ?? ""}
                        onChange={(e) => handleUserSubTeamChange(user.id, e.target.value)}
                        style={{ maxWidth: 160 }}
                        disabled={!user.teamId}
                      >
                        <option value="">サブチーム未所属</option>
                        {availableSubTeams.map((subTeam) => (
                          <option key={subTeam.id} value={String(subTeam.id)}>
                            {subTeam.name}
                          </option>
                        ))}
                      </select>

                      <button
                        className="button"
                        onClick={() =>
                          updateUserAssignment(
                            user.id,
                            user.teamId ?? null,
                            user.subTeamId ?? null
                          )
                        }
                      >
                        所属更新
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ flex: 2, overflowY: "auto" }}>
            <div className="card-title">チーム / サブチーム管理</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>
                チーム一覧
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {teamsList.map((team) => (
                  <div key={team.id} className="task" style={{ padding: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        className="input"
                        value={team.name}
                        onChange={(e) => handleTeamLocalChange(team.id, e.target.value)}
                        style={{ maxWidth: 180 }}
                      />
                      <button style={actionButtonStyle} onClick={() => saveTeamName(team)}>
                        名前更新
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                      所属人数: {team._count?.users ?? 0} / サブチーム数: {team._count?.subTeams ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>
                サブチーム一覧
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {subTeamsList.map((subTeam) => (
                  <div key={subTeam.id} className="task" style={{ padding: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        className="input"
                        value={subTeam.name}
                        onChange={(e) => handleSubTeamLocalChange(subTeam.id, e.target.value)}
                        style={{ maxWidth: 180 }}
                      />
                      <button style={actionButtonStyle} onClick={() => saveSubTeamName(subTeam)}>
                        名前更新
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                      親チーム: {subTeam.team?.name ?? "-"} / 所属人数: {subTeam._count?.users ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, height: "35%" }}>
          <div className="card" style={{ flex: 1, overflowY: "auto" }}>
            <div className="card-title">今日のタスク</div>

            {todayTasks.length === 0 && (
              <div style={{ fontSize: 12, color: "#888" }}>今日のタスクなし</div>
            )}

            {todayTasks.map((t) => (
              <div
                key={t.id}
                className="task"
                style={{ borderLeft: `6px solid ${t.color || "#4a90e2"}` }}
              >
                <div style={{ fontWeight: "bold" }}>{t.title}</div>
                {renderTaskLabelChip(t)}
              </div>
            ))}
          </div>

          <div className="card" style={{ flex: 2 }}>
            <div className="card-title">ボード</div>
            <div className="board">
              {["TODO", "DOING", "DONE"].map((s) => (
                <div key={s} className="board-column">
                  <div>{s}</div>
                  {tasks
                    .filter((t) => t.status === s)
                    .map((t) => (
                      <div
                        key={t.id}
                        className="task-card"
                        style={{
                          borderLeft: `6px solid ${t.color || "#4a90e2"}`,
                        }}
                      >
                        <div>{t.title}</div>
                        {t.label && (
                          <div style={{ marginTop: 4, fontSize: 10, color: "#555" }}>
                            {t.label}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ flex: 3, overflowY: "auto" }}>
            <div className="tabs">
              <div
                className={`tab ${scheduleView === "gantt" ? "active" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setScheduleView("gantt")}
              >
                ガント
              </div>
              <div
                className={`tab ${scheduleView === "calendar" ? "active" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setScheduleView("calendar")}
              >
                カレンダー
              </div>
            </div>

            {scheduleView === "gantt" ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 80px 80px 80px",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                    marginBottom: 10,
                  }}
                >
                  <button style={navButtonStyle} onClick={() => setWeekOffset((prev) => prev - 1)}>
                    前週
                  </button>

                  <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 13 }}>
                    {ganttRangeLabel}
                  </div>

                  <button style={navButtonStyle} onClick={() => setWeekOffset(0)}>
                    今週
                  </button>

                  <button style={navButtonStyle} onClick={() => setWeekOffset((prev) => prev + 1)}>
                    次週
                  </button>

                  <div />
                </div>

                <div className="card-title" style={{ marginTop: 4 }}>
                  ガント（2週間）
                </div>

                {renderGanttWeek(firstWeekDates, "1週目")}
                {renderGanttWeek(secondWeekDates, "2週目")}
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 80px 80px 80px",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                    marginBottom: 10,
                  }}
                >
                  <button style={navButtonStyle} onClick={() => setMonthOffset((prev) => prev - 1)}>
                    前月
                  </button>

                  <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 13 }}>
                    {monthLabel}
                  </div>

                  <button style={navButtonStyle} onClick={() => setMonthOffset(0)}>
                    今月
                  </button>

                  <button style={navButtonStyle} onClick={() => setMonthOffset((prev) => prev + 1)}>
                    次月
                  </button>

                  <div />
                </div>

                <div className="card-title" style={{ marginTop: 4 }}>
                  カレンダー（月表示）
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 4,
                    marginTop: 8,
                    marginBottom: 6,
                  }}
                >
                  {weekdayLabels.map((day) => (
                    <div key={day} style={{ textAlign: "center", fontWeight: "bold", fontSize: 12 }}>
                      {day}
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gap: 4 }}>
                  {calendarRows.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: 4,
                      }}
                    >
                      {row.map((date) => {
                        const isCurrentMonth = date.getMonth() === monthStart.getMonth();
                        const isToday = formatDateKey(date) === actualTodayStr;
                        const dayTasks = tasks.filter((t) => isTaskOnDate(t, date));

                        return (
                          <div
                            key={formatDateKey(date)}
                            style={{
                              minHeight: 88,
                              border: "1px solid #eee",
                              borderRadius: 8,
                              padding: 6,
                              background: isCurrentMonth ? "#fff" : "#f7f7f7",
                              opacity: isCurrentMonth ? 1 : 0.7,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: "bold",
                                color: isToday ? "#2563eb" : "#333",
                                marginBottom: 4,
                              }}
                            >
                              {date.getDate()}
                            </div>

                            <div style={{ display: "grid", gap: 4 }}>
                              {dayTasks.slice(0, 3).map((task) => (
                                <div
                                  key={`${task.id}-${formatDateKey(date)}`}
                                  style={{
                                    fontSize: 10,
                                    padding: "3px 5px",
                                    borderRadius: 6,
                                    borderLeft: `4px solid ${task.color || "#4a90e2"}`,
                                    background: "#f3f4f6",
                                    overflow: "hidden",
                                    whiteSpace: "nowrap",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {task.title}
                                </div>
                              ))}

                              {dayTasks.length > 3 && (
                                <div style={{ fontSize: 10, color: "#666" }}>
                                  +{dayTasks.length - 3}件
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isStaffUsersView ? (
        <div className="card" style={{ height: "30%", overflowY: "auto" }}>
          <div className="card-title">登録済みユーザー詳細</div>

          {usersList.length === 0 && (
            <div style={{ fontSize: 12, color: "#888" }}>利用者データなし</div>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            {usersList.map((user) => (
              <div
                key={user.id}
                className="task"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: "bold" }}>
                  ID: {user.id} / {user.name}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>{user.email}</div>
                <div style={{ fontSize: 12, color: "#444" }}>権限: {user.role}</div>
                <div style={{ fontSize: 12, color: "#444" }}>
                  チーム: {user.team?.name ?? "未所属"}
                </div>
                <div style={{ fontSize: 12, color: "#444" }}>
                  サブチーム: {user.subTeam?.name ?? "未所属"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card" style={{ height: "30%", overflowY: "auto" }}>
          <div className="card-title">過去の記録</div>

          {isManagementUser && (
            <div style={{ marginBottom: 12 }}>
              <select
                className="input"
                value={historyTargetUserId}
                onChange={(e) => setHistoryTargetUserId(e.target.value)}
                style={{ maxWidth: 220 }}
              >
                <option value="all">全員</option>
                {usersList.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {historyTasks.length === 0 && (
            <div style={{ fontSize: 12, color: "#888" }}>履歴なし</div>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            {historyTasks.map((task) => (
              <div
                key={task.id}
                className="task"
                style={{ borderLeft: `6px solid ${task.color || "#4a90e2"}` }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: "bold" }}>{task.title}</div>
                  {renderTaskLabelChip(task)}
                </div>

                <div style={{ fontSize: 12, color: "#666" }}>
                  {task.startDate &&
                    task.endDate &&
                    `${new Date(task.startDate).getMonth() + 1}/${new Date(
                      task.startDate
                    ).getDate()}〜${new Date(task.endDate).getMonth() + 1}/${new Date(
                      task.endDate
                    ).getDate()}`}
                </div>

                {isManagementUser && (
                  <div style={{ fontSize: 11, color: "#888" }}>
                    作成者ID: {task.createdById}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}