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

type TaskLinkedUser = {
  id: number;
  name: string;
  email: string;
  role?: string | null;
  teamId?: number | null;
  subTeamId?: number | null;
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
  doneById?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  completedAt?: string | null;
  week?: number | null;
  createdAt?: string;
  updatedAt?: string;
  assignee?: TaskLinkedUser | null;
  createdBy?: TaskLinkedUser | null;
  doneBy?: TaskLinkedUser | null;
};

type ScheduleView = "gantt" | "calendar";
type TaskPanelView = "create" | "manage";
type NoticeType = "success" | "error";
type TodayTaskScope = "mine" | "subteam" | "team" | "management";
type HistoryDateFilter = "all" | "today" | "week" | "month";
type TaskOwnershipFilter = "all" | "createdByMe" | "assignedToMe";
type TaskSortMode =
  | "statusThenDate"
  | "endDateAsc"
  | "createdAtDesc"
  | "completedAtDesc"
  | "titleAsc";

const MANAGEMENT_ROLES = ["STAFF", "MANAGER", "DIRECTOR", "AREA", "ADMIN"];

const STATUS_LABELS: Record<"TODO" | "DOING" | "DONE", string> = {
  TODO: "未入力",
  DOING: "進行中",
  DONE: "完了",
};

const STATUS_SORT_ORDER: Record<"TODO" | "DOING" | "DONE", number> = {
  DOING: 0,
  TODO: 1,
  DONE: 2,
};

function isManagementRole(role: string | null | undefined) {
  return !!role && MANAGEMENT_ROLES.includes(role);
}

function getTaskSortDate(task: TaskItem) {
  if (task.endDate) return new Date(task.endDate).getTime();
  if (task.startDate) return new Date(task.startDate).getTime();
  if (task.createdAt) return new Date(task.createdAt).getTime();
  return Number.MAX_SAFE_INTEGER;
}

function compareTasksForList(a: TaskItem, b: TaskItem) {
  const statusDiff = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
  if (statusDiff !== 0) return statusDiff;

  const dateDiff = getTaskSortDate(a) - getTaskSortDate(b);
  if (dateDiff !== 0) return dateDiff;

  return a.title.localeCompare(b.title, "ja");
}

function compareTasksByMode(a: TaskItem, b: TaskItem, mode: TaskSortMode) {
  if (mode === "statusThenDate") {
    return compareTasksForList(a, b);
  }

  if (mode === "endDateAsc") {
    const aTime = a.endDate
      ? new Date(a.endDate).getTime()
      : a.startDate
        ? new Date(a.startDate).getTime()
        : Number.MAX_SAFE_INTEGER;

    const bTime = b.endDate
      ? new Date(b.endDate).getTime()
      : b.startDate
        ? new Date(b.startDate).getTime()
        : Number.MAX_SAFE_INTEGER;

    if (aTime !== bTime) return aTime - bTime;
    return a.title.localeCompare(b.title, "ja");
  }

  if (mode === "createdAtDesc") {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.title.localeCompare(b.title, "ja");
  }

  if (mode === "completedAtDesc") {
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.title.localeCompare(b.title, "ja");
  }

  return a.title.localeCompare(b.title, "ja");
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
  const [showCreateLabelSuggestions, setShowCreateLabelSuggestions] = useState(false);

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

  const [showTaskFilters, setShowTaskFilters] = useState(false);
  const [taskKeyword, setTaskKeyword] = useState("");
  const [taskLabelKeyword, setTaskLabelKeyword] = useState("");
  const [taskDateFrom, setTaskDateFrom] = useState("");
  const [taskDateTo, setTaskDateTo] = useState("");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");
  const [taskTeamFilter, setTaskTeamFilter] = useState("all");
  const [taskSubTeamFilter, setTaskSubTeamFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskOwnershipFilter, setTaskOwnershipFilter] =
    useState<TaskOwnershipFilter>("all");
  const [taskSortMode, setTaskSortMode] =
    useState<TaskSortMode>("statusThenDate");

  const [boardOnlyMine, setBoardOnlyMine] = useState(false);
  const [boardAssigneeFilter, setBoardAssigneeFilter] = useState("all");
  const [boardTeamFilter, setBoardTeamFilter] = useState("all");
  const [boardSubTeamFilter, setBoardSubTeamFilter] = useState("all");
  const [boardLabelFilter, setBoardLabelFilter] = useState("all");
  const [showBoardFilters, setShowBoardFilters] = useState(false);

  const [todayTaskScope, setTodayTaskScope] = useState<TodayTaskScope>("mine");
  const [historyDateFilter, setHistoryDateFilter] =
    useState<HistoryDateFilter>("all");

  const [userId, setUserId] = useState<number | null>(null);
  const [staffView, setStaffView] = useState<"tasks" | "users">("tasks");
  const [scheduleView, setScheduleView] = useState<ScheduleView>("gantt");
  const [taskPanelView, setTaskPanelView] =
    useState<TaskPanelView>("create");
  const [historyTargetUserId, setHistoryTargetUserId] =
    useState<string>("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    id: null,
    name: null,
    email: null,
    role: null,
  });

  const [notice, setNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  const showNotice = (text: string, type: NoticeType = "success") => {
    setNotice({ text, type });
  };

  const requestJson = async (
    url: string,
    options?: RequestInit,
    successMessage?: string
  ) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || "エラーが発生しました");
    }

    if (successMessage) {
      showNotice(successMessage, "success");
    }

    return data;
  };

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
      setHistoryDateFilter("all");
      setWeekOffset(0);
      setMonthOffset(0);

      setShowTaskFilters(false);
      setTaskKeyword("");
      setTaskLabelKeyword("");
      setTaskDateFrom("");
      setTaskDateTo("");
      setTaskAssigneeFilter("all");
      setTaskTeamFilter("all");
      setTaskSubTeamFilter("all");
      setTaskStatusFilter("all");
      setTaskOwnershipFilter("all");
      setTaskSortMode("statusThenDate");

      setBoardOnlyMine(false);
      setBoardAssigneeFilter("all");
      setBoardTeamFilter("all");
      setBoardSubTeamFilter("all");
      setBoardLabelFilter("all");
      setShowBoardFilters(false);

      setShowCreateLabelSuggestions(false);
      setTodayTaskScope("mine");
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

    try {
      await requestJson(
        "/api/tasks",
        {
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
        },
        "タスクを追加しました"
      );

      setNewTitle("");
      setNewStart("");
      setNewEnd("");
      setNewTaskLabel("");
      setNewTaskColor("#4a90e2");
      setShowCreateLabelSuggestions(false);
      fetchTasks();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "タスク追加に失敗しました",
        "error"
      );
    }
  };

  const createUser = async () => {
    if (!newUserName || !newUserEmail) return;

    try {
      await requestJson(
        "/api/users",
        {
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
        },
        "利用者を追加しました"
      );

      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("USER");
      fetchUsers();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "利用者追加に失敗しました",
        "error"
      );
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;

    try {
      await requestJson(
        "/api/teams",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newTeamName,
          }),
        },
        "チームを追加しました"
      );

      setNewTeamName("");
      fetchTeams();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "チーム追加に失敗しました",
        "error"
      );
    }
  };

  const createSubTeam = async () => {
    if (!newSubTeamName.trim() || !selectedTeamIdForSubTeam) return;

    try {
      await requestJson(
        "/api/subTeams",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newSubTeamName,
            teamId: Number(selectedTeamIdForSubTeam),
          }),
        },
        "サブチームを追加しました"
      );

      setNewSubTeamName("");
      fetchTeams();
      fetchSubTeams();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "サブチーム追加に失敗しました",
        "error"
      );
    }
  };

  const updateUserRole = async (id: number, role: string) => {
    try {
      await requestJson(
        "/api/users",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            role,
          }),
        },
        "権限を更新しました"
      );

      fetchUsers();

      if (id === userId) {
        fetchMe();
        fetchTasks();
      }
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "権限更新に失敗しました",
        "error"
      );
    }
  };

  const updateUserAssignment = async (
    id: number,
    teamId: number | null,
    subTeamId: number | null
  ) => {
    try {
      await requestJson(
        "/api/users",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            teamId,
            subTeamId,
          }),
        },
        "所属を更新しました"
      );

      fetchUsers();
      fetchTeams();
      fetchSubTeams();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "所属更新に失敗しました",
        "error"
      );
    }
  };

  const updateTaskStatus = async (
    id: number,
    status: "TODO" | "DOING" | "DONE"
  ) => {
    try {
      await requestJson(
        "/api/tasks",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, status }),
        },
        `状態を「${STATUS_LABELS[status]}」に更新しました`
      );
      fetchTasks();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "状態更新に失敗しました",
        "error"
      );
    }
  };

  const saveTask = async (task: TaskItem) => {
    try {
      await requestJson(
        "/api/tasks",
        {
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
        },
        "タスクを保存しました"
      );
      fetchTasks();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "タスク保存に失敗しました",
        "error"
      );
    }
  };

  const saveTeamName = async (team: TeamSummary) => {
    try {
      await requestJson(
        "/api/teams",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: team.id,
            name: team.name,
          }),
        },
        "チーム名を更新しました"
      );
      fetchTeams();
      fetchSubTeams();
      fetchUsers();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "チーム名更新に失敗しました",
        "error"
      );
    }
  };

  const saveSubTeamName = async (subTeam: SubTeamSummary) => {
    try {
      await requestJson(
        "/api/subTeams",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: subTeam.id,
            name: subTeam.name,
          }),
        },
        "サブチーム名を更新しました"
      );
      fetchSubTeams();
      fetchUsers();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "サブチーム名更新に失敗しました",
        "error"
      );
    }
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
    try {
      await requestJson(
        "/api/tasks",
        {
          method: "DELETE",
          body: JSON.stringify({ id }),
        },
        "タスクを削除しました"
      );
      fetchTasks();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "タスク削除に失敗しました",
        "error"
      );
    }
  };

  const resetTaskFilters = () => {
    setTaskKeyword("");
    setTaskLabelKeyword("");
    setTaskDateFrom("");
    setTaskDateTo("");
    setTaskAssigneeFilter("all");
    setTaskTeamFilter("all");
    setTaskSubTeamFilter("all");
    setTaskStatusFilter("all");
    setTaskOwnershipFilter("all");
    setTaskSortMode("statusThenDate");
    showNotice("検索条件をリセットしました");
  };

  const resetBoardFilters = () => {
    setBoardOnlyMine(false);
    setBoardAssigneeFilter("all");
    setBoardTeamFilter("all");
    setBoardSubTeamFilter("all");
    setBoardLabelFilter("all");
    showNotice("ボードの絞り込みをリセットしました");
  };

  const clearBoardChip = (
    type: "mine" | "assignee" | "team" | "subteam" | "label"
  ) => {
    if (type === "mine") setBoardOnlyMine(false);
    if (type === "assignee") setBoardAssigneeFilter("all");
    if (type === "team") setBoardTeamFilter("all");
    if (type === "subteam") setBoardSubTeamFilter("all");
    if (type === "label") setBoardLabelFilter("all");
  };

  const applySuggestedLabel = (label: string) => {
    setNewTaskLabel(label);
  };

  const applySuggestedLabelToSearch = (label: string) => {
    setTaskLabelKeyword(label);
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

  const formatMonthDay = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatMonthLabel = (date: Date) => {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const d = new Date(value);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  };

  const formatDateRange = (start?: string | null, end?: string | null) => {
    if (!start || !end) return "-";
    const s = new Date(start);
    const e = new Date(end);
    return `${s.getMonth() + 1}/${s.getDate()}〜${e.getMonth() + 1}/${e.getDate()}`;
  };

  const isTaskOnDate = (task: TaskItem, date: Date) => {
    if (!task.startDate) return false;

    const targetKey = toDateKey(date);
    const startKey = toDateKey(task.startDate);
    const endKey = task.endDate ? toDateKey(task.endDate) : startKey;

    return startKey <= targetKey && targetKey <= endKey;
  };

  const getDisplayUserName = (
    linkedUser: TaskLinkedUser | null | undefined,
    fallbackId?: number | null
  ) => {
    if (linkedUser?.name) return linkedUser.name;
    if (fallbackId == null) return "-";
    return `ID: ${fallbackId}`;
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

  const todayScopeTabStyle = (active: boolean) =>
    ({
      padding: "8px 10px",
      borderRadius: 8,
      border: active ? "1px solid #60a5fa" : "1px solid #e5e7eb",
      background: active ? "#dbeafe" : "#fff",
      color: active ? "#1d4ed8" : "#374151",
      fontSize: 12,
      fontWeight: 700,
      textAlign: "center" as const,
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
    }) as const;

  const boardSelectStyle = {
    width: "100%",
    fontSize: 12,
    padding: "6px 8px",
    borderRadius: 8,
  } as const;

  const suggestionChipStyle = {
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    cursor: "pointer",
  } as const;

  const compactActionButtonStyle = {
    ...actionButtonStyle,
    padding: "5px 9px",
    fontSize: 11,
  } as const;

  const compactSubtleButtonStyle = {
    ...subtleButtonStyle,
    padding: "5px 9px",
    fontSize: 11,
  } as const;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const actualTodayStr = formatDateKey(today);

  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay());
  currentWeekStart.setHours(0, 0, 0, 0);

  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
  currentWeekEnd.setHours(23, 59, 59, 999);

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

  const isManagementUser = isManagementRole(currentUser.role);

  const currentUserSummary = useMemo(() => {
    return usersList.find((user) => user.id === userId) ?? null;
  }, [usersList, userId]);

  const labelSuggestions = useMemo(() => {
    return Array.from(
      new Set(
        tasks
          .map((task) => (task.label ?? "").trim())
          .filter((label) => label !== "")
      )
    )
      .sort((a, b) => a.localeCompare(b, "ja"))
      .slice(0, 12);
  }, [tasks]);

  const filteredSuggestedLabelsForCreate = useMemo(() => {
    const keyword = newTaskLabel.trim().toLowerCase();
    return labelSuggestions.filter((label) => {
      if (keyword === "") return true;
      return label.toLowerCase().includes(keyword);
    });
  }, [labelSuggestions, newTaskLabel]);

  const filteredSuggestedLabelsForSearch = useMemo(() => {
    const keyword = taskLabelKeyword.trim().toLowerCase();
    return labelSuggestions.filter((label) => {
      if (keyword === "") return true;
      return label.toLowerCase().includes(keyword);
    });
  }, [labelSuggestions, taskLabelKeyword]);

  const activeTaskFilterCount = useMemo(() => {
    let count = 0;
    if (taskKeyword.trim()) count += 1;
    if (taskLabelKeyword.trim()) count += 1;
    if (taskDateFrom) count += 1;
    if (taskDateTo) count += 1;
    if (taskAssigneeFilter !== "all") count += 1;
    if (taskTeamFilter !== "all") count += 1;
    if (taskSubTeamFilter !== "all") count += 1;
    if (taskStatusFilter !== "all") count += 1;
    if (taskOwnershipFilter !== "all") count += 1;
    if (taskSortMode !== "statusThenDate") count += 1;
    return count;
  }, [
    taskKeyword,
    taskLabelKeyword,
    taskDateFrom,
    taskDateTo,
    taskAssigneeFilter,
    taskTeamFilter,
    taskSubTeamFilter,
    taskStatusFilter,
    taskOwnershipFilter,
    taskSortMode,
  ]);

  const availableTaskSubTeams = useMemo(() => {
    if (taskTeamFilter === "all" || taskTeamFilter === "__unassigned__") {
      return subTeamsList;
    }
    return subTeamsList.filter((subTeam) => String(subTeam.teamId) === taskTeamFilter);
  }, [subTeamsList, taskTeamFilter]);

  const filteredTaskBase = useMemo(() => {
    const keyword = taskKeyword.trim().toLowerCase();
    const labelKeyword = taskLabelKeyword.trim().toLowerCase();

    return tasks.filter((task) => {
      const fallbackAssignee = usersList.find((user) => user.id === task.assigneeId);
      const fallbackCreator = usersList.find((user) => user.id === task.createdById);

      const assigneeTeamId = task.assignee?.teamId ?? fallbackAssignee?.teamId ?? null;
      const assigneeSubTeamId = task.assignee?.subTeamId ?? fallbackAssignee?.subTeamId ?? null;
      const assigneeName = task.assignee?.name ?? fallbackAssignee?.name ?? "";
      const creatorName = task.createdBy?.name ?? fallbackCreator?.name ?? "";

      const joinedSearchText = [
        task.title,
        task.label ?? "",
        assigneeName,
        creatorName,
      ]
        .join(" ")
        .toLowerCase();

      if (keyword && !joinedSearchText.includes(keyword)) {
        return false;
      }

      if (labelKeyword && !(task.label ?? "").toLowerCase().includes(labelKeyword)) {
        return false;
      }

      if (taskStatusFilter !== "all" && task.status !== taskStatusFilter) {
        return false;
      }

      if (taskOwnershipFilter === "createdByMe" && task.createdById !== userId) {
        return false;
      }

      if (taskOwnershipFilter === "assignedToMe" && task.assigneeId !== userId) {
        return false;
      }

      if (taskAssigneeFilter !== "all" && String(task.assigneeId) !== taskAssigneeFilter) {
        return false;
      }

      if (taskTeamFilter === "__unassigned__" && assigneeTeamId !== null) {
        return false;
      }

      if (
        taskTeamFilter !== "all" &&
        taskTeamFilter !== "__unassigned__" &&
        String(assigneeTeamId ?? "") !== taskTeamFilter
      ) {
        return false;
      }

      if (taskSubTeamFilter === "__unassigned__" && assigneeSubTeamId !== null) {
        return false;
      }

      if (
        taskSubTeamFilter !== "all" &&
        taskSubTeamFilter !== "__unassigned__" &&
        String(assigneeSubTeamId ?? "") !== taskSubTeamFilter
      ) {
        return false;
      }

      if (taskDateFrom || taskDateTo) {
        const taskStart = task.startDate
          ? new Date(task.startDate).setHours(0, 0, 0, 0)
          : task.endDate
            ? new Date(task.endDate).setHours(0, 0, 0, 0)
            : null;

        const taskEnd = task.endDate
          ? new Date(task.endDate).setHours(23, 59, 59, 999)
          : task.startDate
            ? new Date(task.startDate).setHours(23, 59, 59, 999)
            : null;

        if (taskStart === null || taskEnd === null) {
          return false;
        }

        const from = taskDateFrom
          ? new Date(taskDateFrom).setHours(0, 0, 0, 0)
          : null;
        const to = taskDateTo
          ? new Date(taskDateTo).setHours(23, 59, 59, 999)
          : null;

        if (from !== null && taskEnd < from) {
          return false;
        }

        if (to !== null && taskStart > to) {
          return false;
        }
      }

      return true;
    });
  }, [
    tasks,
    usersList,
    taskKeyword,
    taskLabelKeyword,
    taskAssigneeFilter,
    taskTeamFilter,
    taskSubTeamFilter,
    taskDateFrom,
    taskDateTo,
    taskStatusFilter,
    taskOwnershipFilter,
    userId,
  ]);

  const rawTodayTasks = filteredTaskBase.filter((t) => isTaskOnDate(t, today));

  const todayTaskCounts = useMemo(() => {
    const currentTeamId = currentUserSummary?.teamId ?? null;
    const currentSubTeamId = currentUserSummary?.subTeamId ?? null;

    const counts = {
      mine: 0,
      subteam: 0,
      team: 0,
      management: 0,
    };

    rawTodayTasks.forEach((task) => {
      const fallbackAssignee = usersList.find((user) => user.id === task.assigneeId);
      const assigneeTeamId = task.assignee?.teamId ?? fallbackAssignee?.teamId ?? null;
      const assigneeSubTeamId =
        task.assignee?.subTeamId ?? fallbackAssignee?.subTeamId ?? null;
      const assigneeRole = fallbackAssignee?.role ?? task.assignee?.role ?? null;

      if (task.assigneeId === userId) counts.mine += 1;
      if (currentSubTeamId !== null && assigneeSubTeamId === currentSubTeamId)
        counts.subteam += 1;
      if (currentTeamId !== null && assigneeTeamId === currentTeamId) counts.team += 1;
      if (assigneeRole && MANAGEMENT_ROLES.includes(assigneeRole)) counts.management += 1;
    });

    return counts;
  }, [rawTodayTasks, usersList, userId, currentUserSummary]);

  const todayTasks = useMemo(() => {
    const currentTeamId = currentUserSummary?.teamId ?? null;
    const currentSubTeamId = currentUserSummary?.subTeamId ?? null;

    let filtered: TaskItem[];

    if (!isManagementUser) {
      filtered = rawTodayTasks.filter((task) => task.assigneeId === userId);
    } else {
      filtered = rawTodayTasks.filter((task) => {
        const fallbackAssignee = usersList.find((user) => user.id === task.assigneeId);
        const assigneeTeamId = task.assignee?.teamId ?? fallbackAssignee?.teamId ?? null;
        const assigneeSubTeamId =
          task.assignee?.subTeamId ?? fallbackAssignee?.subTeamId ?? null;
        const assigneeRole = fallbackAssignee?.role ?? task.assignee?.role ?? null;

        switch (todayTaskScope) {
          case "mine":
            return task.assigneeId === userId;
          case "subteam":
            return currentSubTeamId !== null && assigneeSubTeamId === currentSubTeamId;
          case "team":
            return currentTeamId !== null && assigneeTeamId === currentTeamId;
          case "management":
            return !!assigneeRole && MANAGEMENT_ROLES.includes(assigneeRole);
          default:
            return false;
        }
      });
    }

    return [...filtered].sort((a, b) => compareTasksByMode(a, b, taskSortMode));
  }, [
    rawTodayTasks,
    usersList,
    userId,
    isManagementUser,
    todayTaskScope,
    currentUserSummary,
    taskSortMode,
  ]);

  const manageVisibleTasks = useMemo(() => {
    return [...filteredTaskBase].sort((a, b) => compareTasksByMode(a, b, taskSortMode));
  }, [filteredTaskBase, taskSortMode]);

  const progress = Math.round(
    (tasks.filter((t) => t.status === "DONE").length / (tasks.length || 1)) * 100
  );

  const totalUsers = usersList.length;
  const totalStaff = usersList.filter((u) => u.role === "STAFF").length;
  const totalNormalUsers = usersList.filter((u) => u.role === "USER").length;
  const totalTeams = teamsList.length;
  const totalSubTeams = subTeamsList.length;
  const unassignedUsers = usersList.filter((u) => !u.teamId).length;

  const completedTodayCount = tasks.filter(
    (task) => task.completedAt && toDateKey(task.completedAt) === actualTodayStr
  ).length;

  const completedThisMonthCount = tasks.filter((task) => {
    if (!task.completedAt) return false;
    const d = new Date(task.completedAt);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }).length;

  const isStaffUsersView = isManagementUser && staffView === "users";

  const completedTasks = useMemo(() => {
    return [...filteredTaskBase]
      .filter((task) => task.status === "DONE")
      .sort((a, b) => {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [filteredTaskBase]);

  const historyTasks = useMemo(() => {
    const base =
      isManagementUser && historyTargetUserId !== "all"
        ? completedTasks.filter((task) => String(task.createdById) === historyTargetUserId)
        : isManagementUser
          ? completedTasks
          : userId
            ? completedTasks.filter((task) => task.createdById === userId)
            : [];

    return base.filter((task) => {
      if (historyDateFilter === "all") return true;
      if (!task.completedAt) return false;

      const completed = new Date(task.completedAt);
      const completedKey = toDateKey(completed);

      if (historyDateFilter === "today") {
        return completedKey === actualTodayStr;
      }

      if (historyDateFilter === "week") {
        return completed >= currentWeekStart && completed <= currentWeekEnd;
      }

      if (historyDateFilter === "month") {
        return (
          completed.getFullYear() === today.getFullYear() &&
          completed.getMonth() === today.getMonth()
        );
      }

      return true;
    });
  }, [
    completedTasks,
    isManagementUser,
    historyTargetUserId,
    userId,
    historyDateFilter,
    actualTodayStr,
    currentWeekStart,
    currentWeekEnd,
    today,
  ]);

  const historyCounts = useMemo(() => {
    const base =
      isManagementUser && historyTargetUserId !== "all"
        ? completedTasks.filter((task) => String(task.createdById) === historyTargetUserId)
        : isManagementUser
          ? completedTasks
          : userId
            ? completedTasks.filter((task) => task.createdById === userId)
            : [];

    const counts = {
      all: base.length,
      today: 0,
      week: 0,
      month: 0,
    };

    base.forEach((task) => {
      if (!task.completedAt) return;
      const completed = new Date(task.completedAt);
      const completedKey = toDateKey(completed);

      if (completedKey === actualTodayStr) counts.today += 1;
      if (completed >= currentWeekStart && completed <= currentWeekEnd) counts.week += 1;
      if (
        completed.getFullYear() === today.getFullYear() &&
        completed.getMonth() === today.getMonth()
      ) {
        counts.month += 1;
      }
    });

    return counts;
  }, [
    completedTasks,
    isManagementUser,
    historyTargetUserId,
    userId,
    actualTodayStr,
    currentWeekStart,
    currentWeekEnd,
    today,
  ]);

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

  const boardLabelOptions = useMemo(() => {
    return Array.from(
      new Set(
        tasks
          .map((task) => (task.label ?? "").trim())
          .filter((label) => label !== "")
      )
    ).sort((a, b) => a.localeCompare(b, "ja"));
  }, [tasks]);

  const activeBoardFilterCount = useMemo(() => {
    let count = 0;
    if (boardOnlyMine) count += 1;
    if (boardAssigneeFilter !== "all") count += 1;
    if (boardTeamFilter !== "all") count += 1;
    if (boardSubTeamFilter !== "all") count += 1;
    if (boardLabelFilter !== "all") count += 1;
    return count;
  }, [
    boardOnlyMine,
    boardAssigneeFilter,
    boardTeamFilter,
    boardSubTeamFilter,
    boardLabelFilter,
  ]);

  const activeBoardFilterChips = useMemo(() => {
    const chips: Array<{
      key: string;
      label: string;
      type: "mine" | "assignee" | "team" | "subteam" | "label";
    }> = [];

    if (boardOnlyMine) {
      chips.push({
        key: "mine",
        label: "自分担当のみ",
        type: "mine",
      });
    }

    if (boardAssigneeFilter !== "all") {
      const assignee = usersList.find((user) => String(user.id) === boardAssigneeFilter);
      chips.push({
        key: "assignee",
        label: `担当者: ${assignee?.name ?? boardAssigneeFilter}`,
        type: "assignee",
      });
    }

    if (boardTeamFilter !== "all") {
      chips.push({
        key: "team",
        label:
          boardTeamFilter === "__unassigned__"
            ? "チーム: 未所属"
            : `チーム: ${teamsList.find((team) => String(team.id) === boardTeamFilter)?.name ?? boardTeamFilter}`,
        type: "team",
      });
    }

    if (boardSubTeamFilter !== "all") {
      chips.push({
        key: "subteam",
        label:
          boardSubTeamFilter === "__unassigned__"
            ? "サブチーム: 未所属"
            : `サブチーム: ${
                subTeamsList.find((subTeam) => String(subTeam.id) === boardSubTeamFilter)?.name ??
                boardSubTeamFilter
              }`,
        type: "subteam",
      });
    }

    if (boardLabelFilter !== "all") {
      chips.push({
        key: "label",
        label:
          boardLabelFilter === "__unlabeled__"
            ? "ラベル: なし"
            : `ラベル: ${boardLabelFilter}`,
        type: "label",
      });
    }

    return chips;
  }, [
    boardOnlyMine,
    boardAssigneeFilter,
    boardTeamFilter,
    boardSubTeamFilter,
    boardLabelFilter,
    usersList,
    teamsList,
    subTeamsList,
  ]);

  const filteredBoardTasks = useMemo(() => {
    return filteredTaskBase.filter((task) => {
      const fallbackUser = usersList.find((user) => user.id === task.assigneeId);

      const teamId = task.assignee?.teamId ?? fallbackUser?.teamId ?? null;
      const subTeamId = task.assignee?.subTeamId ?? fallbackUser?.subTeamId ?? null;
      const label = (task.label ?? "").trim();

      if (boardOnlyMine && task.assigneeId !== userId) return false;

      if (
        boardAssigneeFilter !== "all" &&
        String(task.assigneeId) !== boardAssigneeFilter
      ) {
        return false;
      }

      if (boardTeamFilter === "__unassigned__" && teamId !== null) {
        return false;
      }

      if (
        boardTeamFilter !== "all" &&
        boardTeamFilter !== "__unassigned__" &&
        String(teamId ?? "") !== boardTeamFilter
      ) {
        return false;
      }

      if (boardSubTeamFilter === "__unassigned__" && subTeamId !== null) {
        return false;
      }

      if (
        boardSubTeamFilter !== "all" &&
        boardSubTeamFilter !== "__unassigned__" &&
        String(subTeamId ?? "") !== boardSubTeamFilter
      ) {
        return false;
      }

      if (boardLabelFilter === "__unlabeled__" && label !== "") {
        return false;
      }

      if (
        boardLabelFilter !== "all" &&
        boardLabelFilter !== "__unlabeled__" &&
        label !== boardLabelFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    filteredTaskBase,
    usersList,
    userId,
    boardOnlyMine,
    boardAssigneeFilter,
    boardTeamFilter,
    boardSubTeamFilter,
    boardLabelFilter,
  ]);

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
        <div style={{ fontSize: 12, color: "#666", fontWeight: "bold", marginBottom: 6 }}>
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
          {filteredTaskBase.map((task) => {
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
        position: "relative",
      }}
    >
      {notice && (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 9999,
            padding: "10px 14px",
            borderRadius: 10,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            background: notice.type === "success" ? "#16a34a" : "#dc2626",
            boxShadow: "0 10px 24px rgba(0,0,0,0.15)",
          }}
        >
          {notice.text}
        </div>
      )}

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

              {taskPanelView === "manage" && (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <button
                      style={{
                        ...subtleButtonStyle,
                        background: activeTaskFilterCount > 0 ? "#dbeafe" : "#fff",
                        border:
                          activeTaskFilterCount > 0
                            ? "1px solid #60a5fa"
                            : "1px solid #d1d5db",
                        color: activeTaskFilterCount > 0 ? "#1d4ed8" : "#111827",
                        fontWeight: activeTaskFilterCount > 0 ? 700 : 400,
                      }}
                      onClick={() => setShowTaskFilters((prev) => !prev)}
                    >
                      検索・絞り込み
                      {activeTaskFilterCount > 0 ? ` (${activeTaskFilterCount})` : ""}
                    </button>

                    {activeTaskFilterCount > 0 && (
                      <button style={subtleButtonStyle} onClick={resetTaskFilters}>
                        リセット
                      </button>
                    )}
                  </div>

                  {(showTaskFilters || activeTaskFilterCount > 0) && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <input
                        className="input"
                        placeholder="キーワード検索"
                        value={taskKeyword}
                        onChange={(e) => setTaskKeyword(e.target.value)}
                      />

                      <input
                        className="input"
                        placeholder="ラベル検索"
                        value={taskLabelKeyword}
                        onChange={(e) => setTaskLabelKeyword(e.target.value)}
                      />

                      <input
                        type="date"
                        value={taskDateFrom}
                        onChange={(e) => setTaskDateFrom(e.target.value)}
                      />

                      <input
                        type="date"
                        value={taskDateTo}
                        onChange={(e) => setTaskDateTo(e.target.value)}
                      />

                      <select
                        className="input"
                        value={taskStatusFilter}
                        onChange={(e) => setTaskStatusFilter(e.target.value)}
                      >
                        <option value="all">全ステータス</option>
                        <option value="TODO">未入力</option>
                        <option value="DOING">進行中</option>
                        <option value="DONE">完了</option>
                      </select>

                      <select
                        className="input"
                        value={taskOwnershipFilter}
                        onChange={(e) =>
                          setTaskOwnershipFilter(e.target.value as TaskOwnershipFilter)
                        }
                      >
                        <option value="all">全範囲</option>
                        <option value="createdByMe">自分作成</option>
                        <option value="assignedToMe">自分担当</option>
                      </select>

                      <select
                        className="input"
                        value={taskSortMode}
                        onChange={(e) => setTaskSortMode(e.target.value as TaskSortMode)}
                      >
                        <option value="statusThenDate">標準順</option>
                        <option value="endDateAsc">締切が近い順</option>
                        <option value="createdAtDesc">作成が新しい順</option>
                        <option value="completedAtDesc">完了が新しい順</option>
                        <option value="titleAsc">タイトル順</option>
                      </select>

                      {isManagementUser ? (
                        <select
                          className="input"
                          value={taskAssigneeFilter}
                          onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                        >
                          <option value="all">全担当者</option>
                          {usersList.map((user) => (
                            <option key={user.id} value={String(user.id)}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ fontSize: 12, color: "#666", alignSelf: "center" }}>
                          自分の見える範囲で検索
                        </div>
                      )}

                      {isManagementUser && (
                        <>
                          <select
                            className="input"
                            value={taskTeamFilter}
                            onChange={(e) => {
                              setTaskTeamFilter(e.target.value);
                              setTaskSubTeamFilter("all");
                            }}
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
                            value={taskSubTeamFilter}
                            onChange={(e) => setTaskSubTeamFilter(e.target.value)}
                          >
                            <option value="all">全サブチーム</option>
                            <option value="__unassigned__">未所属のみ</option>
                            {availableTaskSubTeams.map((subTeam) => (
                              <option key={subTeam.id} value={String(subTeam.id)}>
                                {subTeam.name}
                              </option>
                            ))}
                          </select>
                        </>
                      )}

                      {filteredSuggestedLabelsForSearch.length > 0 && (
                        <div
                          style={{
                            gridColumn: "1 / -1",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                          }}
                        >
                          {filteredSuggestedLabelsForSearch.map((label) => (
                            <button
                              key={`search-${label}`}
                              style={suggestionChipStyle}
                              onClick={() => applySuggestedLabelToSearch(label)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

             {taskPanelView === "create" ? (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      paddingRight: 4,
      display: "flex",
      flexDirection: "column",
      gap: 6,
      justifyContent: "space-between",
    }}
  >
    <div style={{ display: "grid", gap: 6 }}>
      <input
        className="input"
        placeholder="タスク名"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        style={{ marginBottom: 0 }}
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
          gridTemplateColumns: "minmax(0, 1fr) auto auto",
          gap: 6,
          alignItems: "center",
        }}
      >
        <input
          className="input"
          placeholder="ラベル"
          value={newTaskLabel}
          onChange={(e) => setNewTaskLabel(e.target.value)}
          style={{ marginBottom: 0 }}
        />

        <button
          style={compactSubtleButtonStyle}
          onClick={() => setShowCreateLabelSuggestions((prev) => !prev)}
        >
          {showCreateLabelSuggestions ? "閉じる" : "候補"}
        </button>

        <input
          type="color"
          value={newTaskColor}
          onChange={(e) => setNewTaskColor(e.target.value)}
          style={{
            width: 36,
            height: 34,
            border: "none",
            background: "transparent",
            padding: 0,
          }}
        />
      </div>

      {showCreateLabelSuggestions &&
        filteredSuggestedLabelsForCreate.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 2,
            }}
          >
            {filteredSuggestedLabelsForCreate.slice(0, 8).map((label) => (
              <button
                key={`create-${label}`}
                style={{
                  ...suggestionChipStyle,
                  flexShrink: 0,
                }}
                onClick={() => applySuggestedLabel(label)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
    </div>

    <button className="button" onClick={createTask}>
      追加
    </button>
  </div>
) : (
                <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
                  {manageVisibleTasks.length === 0 && (
                    <div style={{ fontSize: 12, color: "#888" }}>該当するタスクなし</div>
                  )}

                  {manageVisibleTasks.map((task) => {
                    const assigneeName = getDisplayUserName(task.assignee, task.assigneeId);
                    const creatorName = getDisplayUserName(task.createdBy, task.createdById);
                    const doneByName = getDisplayUserName(task.doneBy, task.doneById ?? null);

                    return (
                      <div
                        key={task.id}
                        className="task"
                        style={{
                          borderLeft: `6px solid ${task.color || "#4a90e2"}`,
                          marginBottom: 8,
                          padding: 8,
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1fr) 110px",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <input
                              className="input"
                              value={task.title}
                              onChange={(e) =>
                                handleTaskLocalChange(task.id, {
                                  title: e.target.value,
                                })
                              }
                              placeholder="タイトル"
                              style={{ marginBottom: 0 }}
                            />

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

                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
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

                            <input
                              className="input"
                              placeholder="ラベル"
                              value={task.label ?? ""}
                              onChange={(e) =>
                                handleTaskLocalChange(task.id, { label: e.target.value })
                              }
                              style={{
                                width: 120,
                                marginBottom: 0,
                              }}
                            />

                            <input
                              type="color"
                              value={task.color || "#4a90e2"}
                              onChange={(e) =>
                                handleTaskLocalChange(task.id, { color: e.target.value })
                              }
                              style={{
                                width: 34,
                                height: 34,
                                border: "none",
                                background: "transparent",
                                padding: 0,
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
                                style={{ maxWidth: 140 }}
                              >
                                {usersList.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span style={{ fontSize: 11, color: "#666" }}>
                                担当: {assigneeName}
                              </span>
                            )}

                            <button
                              style={compactActionButtonStyle}
                              onClick={() => saveTask(task)}
                            >
                              保存
                            </button>

                            <button
                              style={compactSubtleButtonStyle}
                              onClick={() => deleteTask(task.id)}
                            >
                              削除
                            </button>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              alignItems: "center",
                              fontSize: 11,
                              color: "#888",
                            }}
                          >
                            {renderTaskLabelChip(task)}
                            <span>作成: {creatorName}</span>
                            <span>担当: {assigneeName}</span>
                            {task.completedAt && (
                              <>
                                <span>完了: {formatDateTime(task.completedAt)}</span>
                                <span>完了者: {doneByName}</span>
                              </>
                            )}
                          </div>
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

              <div style={{ height: 8, background: "#eee", borderRadius: 4, marginBottom: 10 }}>
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
              <br />
              今日完了 {completedTodayCount}
              <br />
              今月完了 {completedThisMonthCount}
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

            {isManagementUser && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                <button
                  style={todayScopeTabStyle(todayTaskScope === "mine")}
                  onClick={() => setTodayTaskScope("mine")}
                >
                  自分 ({todayTaskCounts.mine})
                </button>
                <button
                  style={todayScopeTabStyle(todayTaskScope === "subteam")}
                  onClick={() => setTodayTaskScope("subteam")}
                >
                  サブチーム ({todayTaskCounts.subteam})
                </button>
                <button
                  style={todayScopeTabStyle(todayTaskScope === "team")}
                  onClick={() => setTodayTaskScope("team")}
                >
                  チーム ({todayTaskCounts.team})
                </button>
                <button
                  style={todayScopeTabStyle(todayTaskScope === "management")}
                  onClick={() => setTodayTaskScope("management")}
                >
                  スタッフ以上 ({todayTaskCounts.management})
                </button>
              </div>
            )}

            {todayTasks.length === 0 && (
              <div style={{ fontSize: 12, color: "#888" }}>今日のタスクなし</div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              {todayTasks.map((t) => {
                const assigneeName = getDisplayUserName(t.assignee, t.assigneeId);

                return (
                  <div
                    key={t.id}
                    className="task"
                    style={{ borderLeft: `6px solid ${t.color || "#4a90e2"}` }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: "bold" }}>{t.title}</div>

                      <select
                        value={t.status}
                        onChange={(e) =>
                          updateTaskStatus(
                            t.id,
                            e.target.value as "TODO" | "DOING" | "DONE"
                          )
                        }
                      >
                        <option value="TODO">未入力</option>
                        <option value="DOING">進行中</option>
                        <option value="DONE">完了</option>
                      </select>
                    </div>

                    {renderTaskLabelChip(t)}

                    {isManagementUser && todayTaskScope !== "mine" && (
                      <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
                        担当者: {assigneeName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="card"
            style={{ flex: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div className="card-title">ボード</div>

            {isManagementUser && (
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom:
                      showBoardFilters || activeBoardFilterCount > 0 ? 8 : 0,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#444",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={boardOnlyMine}
                      onChange={(e) => setBoardOnlyMine(e.target.checked)}
                    />
                    自分担当のみ
                  </label>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      style={{
                        ...subtleButtonStyle,
                        background: activeBoardFilterCount > 0 ? "#dbeafe" : "#fff",
                        border: activeBoardFilterCount > 0 ? "1px solid #60a5fa" : "1px solid #d1d5db",
                        color: activeBoardFilterCount > 0 ? "#1d4ed8" : "#111827",
                        fontWeight: activeBoardFilterCount > 0 ? 700 : 400,
                      }}
                      onClick={() => setShowBoardFilters((prev) => !prev)}
                    >
                      絞り込み
                      {activeBoardFilterCount > 0 ? ` (${activeBoardFilterCount})` : ""}
                    </button>

                    {activeBoardFilterCount > 0 && (
                      <button style={subtleButtonStyle} onClick={resetBoardFilters}>
                        リセット
                      </button>
                    )}
                  </div>
                </div>

                {activeBoardFilterChips.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    {activeBoardFilterChips.map((chip) => (
                      <button
                        key={chip.key}
                        onClick={() => clearBoardChip(chip.type)}
                        style={{
                          border: "1px solid #bfdbfe",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          borderRadius: 999,
                          padding: "4px 8px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        {chip.label} ×
                      </button>
                    ))}
                  </div>
                )}

                {(showBoardFilters || activeBoardFilterCount > 0) && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 8,
                    }}
                  >
                    <select
                      className="input"
                      value={boardAssigneeFilter}
                      onChange={(e) => setBoardAssigneeFilter(e.target.value)}
                    >
                      <option value="all">全担当者</option>
                      {usersList.map((user) => (
                        <option key={user.id} value={String(user.id)}>
                          {user.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="input"
                      value={boardTeamFilter}
                      onChange={(e) => setBoardTeamFilter(e.target.value)}
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
                      value={boardSubTeamFilter}
                      onChange={(e) => setBoardSubTeamFilter(e.target.value)}
                    >
                      <option value="all">全サブチーム</option>
                      <option value="__unassigned__">未所属のみ</option>
                      {subTeamsList.map((subTeam) => (
                        <option key={subTeam.id} value={String(subTeam.id)}>
                          {subTeam.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="input"
                      value={boardLabelFilter}
                      onChange={(e) => setBoardLabelFilter(e.target.value)}
                    >
                      <option value="all">全ラベル</option>
                      <option value="__unlabeled__">ラベルなし</option>
                      {boardLabelOptions.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div
              className="board"
              style={{
                flex: 1,
                overflow: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(170px, 1fr))",
                gap: 10,
                alignItems: "start",
              }}
            >
              {(["TODO", "DOING", "DONE"] as const).map((s) => {
                const columnTasks = [...filteredBoardTasks]
                  .filter((t) => t.status === s)
                  .sort((a, b) => compareTasksByMode(a, b, taskSortMode));

                return (
                  <div
                    key={s}
                    className="board-column"
                    style={{
                      minWidth: 0,
                      display: "grid",
                      gap: 8,
                      alignContent: "start",
                    }}
                  >
                    <div style={{ fontWeight: "bold", marginBottom: 2 }}>
                      {STATUS_LABELS[s]} ({columnTasks.length})
                    </div>

                    {columnTasks.map((t) => (
                      <div
                        key={t.id}
                        className="task-card"
                        style={{
                          borderLeft: `6px solid ${t.color || "#4a90e2"}`,
                          display: "grid",
                          gap: 5,
                          padding: 8,
                          borderRadius: 10,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{t.title}</div>

                        {t.label && (
                          <div style={{ fontSize: 10, color: "#555" }}>{t.label}</div>
                        )}

                        <select
                          value={t.status}
                          onChange={(e) =>
                            updateTaskStatus(
                              t.id,
                              e.target.value as "TODO" | "DOING" | "DONE"
                            )
                          }
                          style={boardSelectStyle}
                        >
                          <option value="TODO">未入力</option>
                          <option value="DOING">進行中</option>
                          <option value="DONE">完了</option>
                        </select>
                      </div>
                    ))}
                  </div>
                );
              })}
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
                        const dayTasks = filteredTaskBase.filter((t) => isTaskOnDate(t, date));

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

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            {isManagementUser && (
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
            )}

            <button
              style={todayScopeTabStyle(historyDateFilter === "all")}
              onClick={() => setHistoryDateFilter("all")}
            >
              全件 ({historyCounts.all})
            </button>
            <button
              style={todayScopeTabStyle(historyDateFilter === "today")}
              onClick={() => setHistoryDateFilter("today")}
            >
              今日 ({historyCounts.today})
            </button>
            <button
              style={todayScopeTabStyle(historyDateFilter === "week")}
              onClick={() => setHistoryDateFilter("week")}
            >
              今週 ({historyCounts.week})
            </button>
            <button
              style={todayScopeTabStyle(historyDateFilter === "month")}
              onClick={() => setHistoryDateFilter("month")}
            >
              今月 ({historyCounts.month})
            </button>
          </div>

          {historyTasks.length === 0 && (
            <div style={{ fontSize: 12, color: "#888" }}>履歴なし</div>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            {historyTasks.map((task) => {
              const creatorName = getDisplayUserName(task.createdBy, task.createdById);
              const assigneeName = getDisplayUserName(task.assignee, task.assigneeId);
              const doneByName = getDisplayUserName(task.doneBy, task.doneById ?? null);

              return (
                <div
                  key={task.id}
                  className="task"
                  style={{
                    borderLeft: `6px solid ${task.color || "#4a90e2"}`,
                    display: "grid",
                    gap: 4,
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: "bold" }}>{task.title}</div>
                      {renderTaskLabelChip(task)}
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#ecfdf5",
                          color: "#047857",
                          fontWeight: 700,
                        }}
                      >
                        完了
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "#666" }}>
                      {formatDateTime(task.completedAt)}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#666",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      lineHeight: 1.5,
                    }}
                  >
                    <span>期間: {formatDateRange(task.startDate, task.endDate)}</span>
                    <span>作成: {creatorName}</span>
                    <span>担当: {assigneeName}</span>
                    <span>完了: {doneByName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}