# 支援管理システム

## 概要
利用者の活動を管理し、支援員が進捗や状況を把握できるシステムです。  
タスクの状態・期間・日付を一元管理できます。

---

## 主な機能
- タスク作成・削除
- ステータス管理（未入力 / 進行中 / 完了）
- ガントチャート（期間の可視化）
- カレンダー表示
- 今日のタスク表示
- ダッシュボード（進行率）

---

## 使用技術
- Next.js
- Prisma
- PostgreSQL

---

## セットアップ方法

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev