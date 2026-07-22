/// <reference types="https://deno.land/x/deno/cli/tsconfig/tsconfig.json" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/* ---------- Google auth ---------- */

async function googleToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
      refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN") ?? "",
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Google OAuth falhou: " + JSON.stringify(data));
  }
  return data.access_token as string;
}

/* ---------- Drive helpers ---------- */

const escapeQ = (value: string) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function findOrCreateFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const query =
    `name='${escapeQ(name)}' and mimeType='application/vnd.google-apps.folder'` +
    ` and trashed=false` + (parentId ? ` and '${parentId}' in parents` : "");

  const search = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query) +
      "&fields=files(id)&pageSize=1",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const found = await search.json();
  if (found.files?.length) return found.files[0].id as string;

  const create = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    },
  );
  const created = await create.json();
  if (!created.id) throw new Error("Falha ao criar pasta no Drive.");
  return created.id as string;
}

const sanitize = (value: string) =>
  value.replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 90);

/* ---------- Handler ---------- */

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Autorização ausente." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("ADMIN_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida." }, 401);

    const body = await request.json();
    const action = String(body.action || "");
    const contentId = String(body.contentId || "");

    /* Visibilidade validada com o cliente do usuário (RLS aplica) */
    const { data: item } = await userClient
      .from("content_items")
      .select("id, title, client_id, drive_folder_id")
      .eq("id", contentId)
      .maybeSingle();
    if (!item) return json({ error: "Demanda não encontrada ou sem acesso." }, 403);

    const token = await googleToken();

    async function ensureFolders(): Promise<string> {
      if (item.drive_folder_id) return item.drive_folder_id;

      const { data: client } = await admin
        .from("clients")
        .select("id, name, drive_folder_id")
        .eq("id", item.client_id)
        .single();

      const rootId = await findOrCreateFolder(token, "PAUTA");

      let clientFolder = client.drive_folder_id as string | null;
      if (!clientFolder) {
        clientFolder = await findOrCreateFolder(token, sanitize(client.name), rootId);
        await admin.from("clients")
          .update({ drive_folder_id: clientFolder }).eq("id", client.id);
      }

      const demandName = `${sanitize(item.title)} — ${item.id.slice(0, 8)}`;
      const demandFolder = await findOrCreateFolder(token, demandName, clientFolder);
      await admin.from("content_items")
        .update({ drive_folder_id: demandFolder }).eq("id", item.id);

      return demandFolder;
    }

    if (action === "get_folder") {
      const folderId = await ensureFolders();
      return json({
        folderId,
        folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      });
    }

    if (action === "create_upload_session") {
      const fileName = String(body.fileName || "arquivo");
      const mimeType = String(body.mimeType || "application/octet-stream");
      const size = Number(body.size || 0);

      /*
       * CORS FIX: o Origin enviado ao Google PRECISA ser o origin exato do
       * site que fará o PUT. O header nem sempre atravessa o gateway do
       * Supabase, então o frontend agora manda no body (prioritário).
       */
      const origin =
        String(body.origin || "") || request.headers.get("Origin") || "";
      if (!origin) {
        return json(
          { error: "Origin ausente — atualize o DriveUploader para a v2." },
          400,
        );
      }

      const folderId = await ensureFolders();

      const session = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mimeType,
            "X-Upload-Content-Length": String(size),
            Origin: origin,
          },
          body: JSON.stringify({ name: fileName, parents: [folderId] }),
        },
      );

      const uploadUrl = session.headers.get("Location");
      if (!uploadUrl) {
        const detail = await session.text();
        return json(
          { error: "Falha ao criar sessão de upload: " + detail.slice(0, 300) },
          500,
        );
      }
      return json({ uploadUrl, folderId });
    }

    if (action === "finalize_file") {
      const fileId = String(body.fileId || "");
      const fileName = String(body.fileName || "arquivo");
      const mimeType = String(body.mimeType || "");
      const size = Number(body.size || 0);
      if (!fileId) return json({ error: "fileId obrigatório." }, 400);

      await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ role: "reader", type: "anyone" }),
        },
      );

      const { data: attachment, error } = await admin
        .from("content_attachments")
        .insert({
          content_id: item.id,
          source: "drive",
          drive_file_id: fileId,
          file_name: fileName,
          mime_type: mimeType,
          size_bytes: size,
          uploaded_by: user.id,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);

      await admin.from("content_events").insert({
        content_id: item.id,
        actor_id: user.id,
        event_type: "file_uploaded",
        comment: `Arquivo enviado ao Drive: ${fileName}`,
      });

      return json({ success: true, attachment });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error(error);
    return json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      500,
    );
  }
});
