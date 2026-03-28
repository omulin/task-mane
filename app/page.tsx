"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();

  const [tasks, setTasks] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [userId, setUserId] = useState<number | null>(null);

  const fetchTasks = () => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((data) => setTasks(data));
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (!session) return;

    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setUserId(data?.id ?? null));
  }, [session]);

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

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const todayStr = new Date().toISOString().split("T")[0];

  const todayTasks = tasks.filter((t) => {
    if (!t.startDate) return false;
    return t.startDate.split("T")[0] === todayStr;
  });

  const progress = Math.round(
    (tasks.filter((t) => t.status === "DONE").length / (tasks.length || 1)) * 100
  );

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
        {/* 🔥 ログインだけ変更 */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">支援管理システム</div>
          <div className="tabs">
            <div className="tab active">利用者</div>
            <div className="tab">スタッフ</div>
          </div>

          {!session ? (
            <button className="button" onClick={() => signIn("google")}>
              Googleでログイン
            </button>
          ) : (
            <>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                {session.user?.email}
              </div>
              <button className="button" onClick={() => signOut()}>
                ログアウト
              </button>
            </>
          )}
        </div>

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
      </div>

      {/* 中段 */}
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

        {/* ガント */}
        <div className="card" style={{ flex: 2 }}>
          <div className="card-title">ガント（週間）</div>

          <div style={{ display: "flex" }}>
            <div style={{ width: 80 }} />
            {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
              <div key={d} style={{ flex: 1, textAlign: "center" }}>
                {d}
              </div>
            ))}
          </div>

          {tasks.map((t) => {
            if (!t.startDate || !t.endDate) return null;

            const start = new Date(t.startDate).getDay();
            const end = new Date(t.endDate).getDay();
            const span = end - start + 1;

            return (
              <div
                key={t.id}
                style={{ display: "flex", alignItems: "center", height: 30 }}
              >
                <div style={{ width: 80 }}>{t.title}</div>
                <div style={{ flex: 1, position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: `${(start / 7) * 100}%`,
                      width: `${(span / 7) * 100}%`,
                      height: 6,
                      background: "#4a90e2",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* カレンダー */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">カレンダー</div>

          <div style={{ display: "flex" }}>
            {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
              <div key={d} style={{ flex: 1 }}>
                <div>{d}</div>
                {tasks
                  .filter(
                    (t) => t.startDate && new Date(t.startDate).getDay() === i
                  )
                  .map((t) => (
                    <div key={t.id} style={{ fontSize: 10 }}>
                      {t.title}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 下段 */}
      <div className="card" style={{ height: "30%" }}>
        <div className="card-title">過去の記録</div>
      </div>
    </div>
  );
}