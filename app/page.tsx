"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

type CurrentUser = {
  id: number | null;
  name: string | null;
  email: string | null;
  role: string | null;
};

type UserSummary = {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
};

type ScheduleView = "gantt" | "calendar";

export default function Home() {
  const { data: session } = useSession();

  const [tasks, setTasks] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<UserSummary[]>([]);

  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("USER");

  const [userId, setUserId] = useState<number | null>(null);
  const [staffView, setStaffView] = useState<"tasks" | "users">("tasks");
  const [scheduleView, setScheduleView] = useState<ScheduleView>("gantt");
  const [historyTargetUserId, setHistoryTargetUserId] = useState<string>("all");

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

  const fetchMe = () => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setUserId(data?.id ?? null);
        setCurrentUser({
          id: data?.id ?? null,
          name: data?.name ?? null,
          email: data?.email ?? null,
          role: data?.role ?? null,
        });

        if (data?.role !== "STAFF") {
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
      setCurrentUser({
        id: null,
        name: null,
        email: null,
        role: null,
      });
      setStaffView("tasks");
      setScheduleView("gantt");
      setHistoryTargetUserId("all");
      return;
    }

    fetchMe();
    fetchTasks();
  }, [session]);

  useEffect(() => {
    if (!session || currentUser.role !== "STAFF") {
      setUsersList([]);
      return;
    }

    fetchUsers();
  }, [session, currentUser.role]);

  const createTask = async () => {
    if (!newTitle) return;

    await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: newTitle,
        startDate: newStart,
        endDate: newEnd,
      }),
    });

    setNewTitle("");
    setNewStart("");
    setNewEnd("");
    setDueDate("");
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

  const handleRoleSelectChange = (id: number, role: string) => {
    setUsersList((prev) =>
      prev.map((user) => (user.id === id ? { ...user, role } : user))
    );
  };

  const deleteTask = async (id: number) => {
    await fetch("/api/tasks", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    fetchTasks();
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch("/api/tasks", {
      method: "PUT",
      body: JSON.stringify({ id, status }),
    });
    fetchTasks();
  };

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatMonthDay = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const todayStr = formatDateKey(today);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return date;
  });

  const ganttStartDate = new Date(startOfWeek);
  const ganttDates = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(ganttStartDate);
    date.setDate(ganttStartDate.getDate() + i);
    return date;
  });

  const ganttEndDate = new Date(ganttStartDate);
  ganttEndDate.setDate(ganttStartDate.getDate() + 13);
  ganttEndDate.setHours(23, 59, 59, 999);

  const todayTasks = tasks.filter((t) => {
    if (!t.startDate) return false;
    return formatDateKey(new Date(t.startDate)) === todayStr;
  });

  const progress = Math.round(
    (tasks.filter((t) => t.status === "DONE").length / (tasks.length || 1)) * 100
  );

  const totalUsers = usersList.length;
  const totalStaff = usersList.filter((u) => u.role === "STAFF").length;
  const totalNormalUsers = usersList.filter((u) => u.role === "USER").length;

  const isStaffUsersView = currentUser.role === "STAFF" && staffView === "users";

  const completedTasks = useMemo(() => {
    return tasks.filter((task) => task.status === "DONE");
  }, [tasks]);

  const historyTasks = useMemo(() => {
    if (currentUser.role === "STAFF") {
      if (historyTargetUserId === "all") return completedTasks;
      return completedTasks.filter(
        (task) => String(task.createdById) === historyTargetUserId
      );
    }

    if (!userId) return [];
    return completedTasks.filter((task) => task.createdById === userId);
  }, [completedTasks, currentUser.role, historyTargetUserId, userId]);

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
      {/* 上段 */}
      <div style={{ display: "flex", gap: 12, height: "35%" }}>
        {/* ログイン */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">支援管理システム</div>

          <div className="tabs">
            <div className={`tab ${currentUser.role !== "STAFF" ? "active" : ""}`}>
              利用者
            </div>
            <div className={`tab ${currentUser.role === "STAFF" ? "active" : ""}`}>
              スタッフ
            </div>
          </div>

          {currentUser.role === "STAFF" && (
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
                  background: currentUser.role === "STAFF" ? "#dbeafe" : "#f3f4f6",
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

        {/* STAFF: 利用者管理ビュー */}
        {isStaffUsersView ? (
          <>
            <div
              className="card"
              style={{ flex: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              <div className="tabs">
                <div className="tab active">利用者追加</div>
                <div className="tab">権限管理</div>
              </div>

              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                STAFF専用：利用者を追加できます
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

              <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
                Googleログインの初回自動登録に加えて、必要なら手動追加もできます
              </div>
            </div>

            <div className="card" style={{ flex: 1 }}>
              <div className="card-title">利用者ダッシュボード</div>

              <div style={{ fontSize: 20, fontWeight: "bold" }}>{totalUsers}人</div>

              <div style={{ height: 8, background: "#eee", borderRadius: 4 }}>
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
            </div>
          </>
        ) : (
          <>
            {/* 中央：リスト */}
            <div
              className="card"
              style={{ flex: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              <div className="tabs">
                <div className="tab active">リスト</div>
                <div className="tab">ボード</div>
                <div className="tab">ガント</div>
              </div>

              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                {currentUser.role === "STAFF" ? "全体タスク表示" : "自分のタスク表示"}
              </div>

              {currentUser.role === "STAFF" && (
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

              <input
                className="input"
                placeholder="タスク名"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />

              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                />
                <span>〜</span>
                <input
                  type="date"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                />
              </div>

              <button className="button" onClick={createTask}>
                追加
              </button>

              <div style={{ overflowY: "auto", flex: 1 }}>
                {tasks.map((task) => (
                  <div key={task.id} className="task">
                    {task.title}

                    {currentUser.role === "STAFF" && (
                      <div style={{ fontSize: 11, color: "#888" }}>
                        作成者ID: {task.createdById}
                      </div>
                    )}

                    <div style={{ fontSize: 11, color: "#666" }}>
                      {task.startDate &&
                        task.endDate &&
                        `${new Date(task.startDate).getMonth() + 1}/${new Date(
                          task.startDate
                        ).getDate()}〜${new Date(task.endDate).getMonth() + 1}/${new Date(
                          task.endDate
                        ).getDate()}`}
                    </div>

                    <select
                      value={task.status}
                      onChange={(e) => updateStatus(task.id, e.target.value)}
                    >
                      <option value="TODO">未入力</option>
                      <option value="DOING">進行中</option>
                      <option value="DONE">完了</option>
                    </select>

                    <button onClick={() => deleteTask(task.id)}>削除</button>
                  </div>
                ))}
              </div>
            </div>

            {/* ダッシュボード */}
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

      {/* 中段 */}
      {isStaffUsersView ? (
        <div style={{ display: "flex", gap: 12, height: "35%" }}>
          <div className="card" style={{ flex: 3, overflowY: "auto" }}>
            <div className="card-title">利用者一覧</div>

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
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: "bold" }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{user.email}</div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      className="input"
                      value={user.role}
                      onChange={(e) => handleRoleSelectChange(user.id, e.target.value)}
                      style={{ maxWidth: 180 }}
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
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ flex: 2 }}>
            <div className="card-title">管理メモ</div>
            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.8 }}>
              ・初回Googleログイン時に自動でUSER登録<br />
              ・STAFFはここから権限変更可能<br />
              ・必要なら手動で利用者追加も可能
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, height: "35%" }}>
          {/* 今日のタスク */}
          <div className="card" style={{ flex: 1, overflowY: "auto" }}>
            <div className="card-title">今日のタスク</div>

            {todayTasks.length === 0 && (
              <div style={{ fontSize: 12, color: "#888" }}>今日のタスクなし</div>
            )}

            {todayTasks.map((t) => (
              <div key={t.id} className="task">
                {t.title}
              </div>
            ))}
          </div>

          {/* ボード */}
          <div className="card" style={{ flex: 2 }}>
            <div className="card-title">ボード</div>
            <div className="board">
              {["TODO", "DOING", "DONE"].map((s) => (
                <div key={s} className="board-column">
                  <div>{s}</div>
                  {tasks
                    .filter((t) => t.status === s)
                    .map((t) => (
                      <div key={t.id} className="task-card">
                        {t.title}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

          {/* ガント / カレンダー切替 */}
          <div className="card" style={{ flex: 3 }}>
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
                <div className="card-title" style={{ marginTop: 8 }}>
                  ガント（2週間）
                </div>

                <div style={{ display: "flex" }}>
                  <div style={{ width: 88 }} />
                  {ganttDates.map((date) => (
                    <div key={formatDateKey(date)} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: 11 }}>{["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}</div>
                      <div style={{ fontSize: 10, color: "#666" }}>{formatMonthDay(date)}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8 }}>
                  {tasks.map((t) => {
                    if (!t.startDate || !t.endDate) return null;

                    const taskStart = new Date(t.startDate);
                    const taskEnd = new Date(t.endDate);

                    taskStart.setHours(0, 0, 0, 0);
                    taskEnd.setHours(0, 0, 0, 0);

                    if (taskEnd < ganttStartDate || taskStart > ganttEndDate) {
                      return null;
                    }

                    const visibleStart =
                      taskStart < ganttStartDate ? ganttStartDate : taskStart;
                    const visibleEnd =
                      taskEnd > ganttEndDate ? ganttEndDate : taskEnd;

                    const startOffset = Math.floor(
                      (visibleStart.getTime() - ganttStartDate.getTime()) / 86400000
                    );
                    const endOffset = Math.floor(
                      (visibleEnd.getTime() - ganttStartDate.getTime()) / 86400000
                    );
                    const span = endOffset - startOffset + 1;

                    return (
                      <div
                        key={t.id}
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
                          {t.title}
                        </div>
                        <div style={{ flex: 1, position: "relative", height: 18 }}>
                          <div
                            style={{
                              position: "absolute",
                              left: `${(startOffset / 14) * 100}%`,
                              width: `${(span / 14) * 100}%`,
                              height: 8,
                              borderRadius: 999,
                              background: "#4a90e2",
                              top: "50%",
                              transform: "translateY(-50%)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="card-title" style={{ marginTop: 8 }}>
                  カレンダー（1週間）
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  {weekDates.map((date) => (
                    <div
                      key={formatDateKey(date)}
                      style={{
                        flex: 1,
                        minHeight: 180,
                        border: "1px solid #eee",
                        borderRadius: 8,
                        padding: 6,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: "bold" }}>
                        {["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}
                      </div>
                      <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>
                        {formatMonthDay(date)}
                      </div>

                      <div style={{ display: "grid", gap: 4 }}>
                        {tasks
                          .filter(
                            (t) =>
                              t.startDate &&
                              formatDateKey(new Date(t.startDate)) === formatDateKey(date)
                          )
                          .map((t) => (
                            <div
                              key={t.id}
                              style={{
                                fontSize: 10,
                                padding: "4px 6px",
                                borderRadius: 6,
                                background: "#f3f4f6",
                              }}
                            >
                              {t.title}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 下段 */}
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
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card" style={{ height: "30%", overflowY: "auto" }}>
          <div className="card-title">過去の記録</div>

          {currentUser.role === "STAFF" && (
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
              <div key={task.id} className="task">
                <div style={{ fontWeight: "bold" }}>{task.title}</div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {task.startDate &&
                    task.endDate &&
                    `${new Date(task.startDate).getMonth() + 1}/${new Date(
                      task.startDate
                    ).getDate()}〜${new Date(task.endDate).getMonth() + 1}/${new Date(
                      task.endDate
                    ).getDate()}`}
                </div>

                {currentUser.role === "STAFF" && (
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