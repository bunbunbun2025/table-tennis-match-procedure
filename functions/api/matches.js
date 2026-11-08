// functions/api/matches.js

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // D1 データベースのバインディング（名前は「DB」とします）
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding 'DB' not found." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 1. 【データ読み込み (GET)】：参加者や本部が画面を開いたとき
  if (request.method === "GET") {
    try {
      // データベースから全試合スケジュールを順序通りに取得
      const { results } = await db.prepare("SELECT * FROM matches ORDER BY id ASC").all();
      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // 2. 【データ保存・更新 (POST)】：本部がインポートやスコア入力をしたとき
  if (request.method === "POST") {
    try {
      const body = await request.json();
      
      // セキュリティ対策：本部の操作であるかパスワード検証
      // ※簡易的な検証のため、ヘッダーにパスワードを載せて通信させます
      const adminPass = request.headers.get("X-Admin-Password");
      if (adminPass !== "admin123") {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      // 古いデータを一度すべて削除し、新しい状態を上書き保存
      // (一括インポートやリアルタイム更新をシンプルかつ確実に同期するため)
      await db.prepare("DELETE FROM matches").run();

      if (body && body.length > 0) {
        // 大量の試合データを一括で安全に挿入するトランザクション風のバッチ処理
        const statements = body.map(m => {
          return db.prepare(
            "INSERT INTO matches (grp, court, pA, pB, ref, status, scA, scB) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(m.grp, m.court, m.pA, m.pB, m.ref, m.status, m.scA, m.scB);
        });
        
        await db.batch(statements);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
