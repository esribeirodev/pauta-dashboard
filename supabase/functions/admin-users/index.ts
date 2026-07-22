/// <reference types="https://deno.land/x/deno/cli/tsconfig/tsconfig.json" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRoles = [
  "admin",
  "supervisora",
  "estrategista",
  "design",
  "editora",
  "videomaker",
];

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return json(
      {
        error: "Método não permitido. Use POST.",
      },
      405,
    );
  }

  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
      return json(
        {
          error: "Autorização ausente.",
        },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("ADMIN_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(
        {
          error: "Secrets da Edge Function não foram configurados.",
        },
        500,
      );
    }

    /*
     * Cliente com a sessão do usuário atual.
     * Serve para identificar quem fez a requisição.
     */
    const userClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      },
    );

    const {
      data: {
        user: requester,
      },
      error: requesterError,
    } = await userClient.auth.getUser();

    if (requesterError || !requester) {
      return json(
        {
          error: "Sessão inválida ou expirada.",
        },
        401,
      );
    }

    /*
     * Cliente administrativo.
     * A service_role nunca deve ser exposta no frontend.
     */
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: requesterProfile,
      error: requesterProfileError,
    } = await adminClient
      .from("profiles")
      .select("id, role, active")
      .eq("id", requester.id)
      .maybeSingle();

    if (
      requesterProfileError ||
      !requesterProfile ||
      requesterProfile.role !== "admin" ||
      requesterProfile.active !== true
    ) {
      return json(
        {
          error:
            "Somente um Administrador ativo pode realizar esta operação.",
        },
        403,
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return json(
        {
          error: "Corpo da requisição inválido.",
        },
        400,
      );
    }

    const action = String(body.action || "").trim();

    /*
     * Aceita tanto "create" quanto "create_user",
     * para funcionar com versões diferentes do frontend.
     */
    switch (action) {
      case "create":
      case "create_user":
        return await createUser(adminClient, body);

      case "update_profile":
        return await updateProfile(adminClient, body);

      case "set_active":
        return await setUserActive(
          adminClient,
          body,
          requester.id,
        );

      case "delete":
        return await deleteUser(
          adminClient,
          body,
          requester.id,
        );

      default:
        return json(
          {
            error: "Ação inválida.",
          },
          400,
        );
    }
  } catch (error) {
    console.error("Erro inesperado na Edge Function:", error);

    return json(
      {
        error: error instanceof Error
          ? error.message
          : "Erro interno da Edge Function.",
      },
      500,
    );
  }
});

async function createUser(
  adminClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const email = String(body.email || "").trim().toLowerCase();

  const fullName = String(
    body.fullName ||
    body.name ||
    "",
  ).trim();

  const role = String(body.role || "").trim();

  const password = body.password
    ? String(body.password)
    : "";

  if (!email || !fullName || !role) {
    return json(
      {
        error: "Nome, e-mail e cargo são obrigatórios.",
      },
      400,
    );
  }

  if (!isValidEmail(email)) {
    return json(
      {
        error: "Informe um e-mail válido.",
      },
      400,
    );
  }

  if (!allowedRoles.includes(role)) {
    return json(
      {
        error: "Cargo inválido.",
      },
      400,
    );
  }

  if (password && password.length < 8) {
    return json(
      {
        error: "A senha deve ter pelo menos 8 caracteres.",
      },
      400,
    );
  }

  const createPayload: {
    email: string;
    email_confirm: boolean;
    user_metadata: {
      full_name: string;
    };
    password?: string;
  } = {
    email,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  };

  if (password) {
    createPayload.password = password;
  }

  const {
    data: authData,
    error: authError,
  } = await adminClient.auth.admin.createUser(
    createPayload,
  );

  if (authError || !authData.user) {
    return json(
      {
        error:
          authError?.message ||
          "Não foi possível criar o usuário.",
      },
      400,
    );
  }

  const {
    error: profileError,
  } = await adminClient
    .from("profiles")
    .insert({
      id: authData.user.id,
      full_name: fullName,
      role,
      active: true,
    });

  if (profileError) {
    /*
     * Evita deixar usuário no Auth sem registro em profiles.
     */
    await adminClient.auth.admin.deleteUser(
      authData.user.id,
    );

    return json(
      {
        error: profileError.message,
      },
      400,
    );
  }

  return json(
    {
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        fullName,
        role,
        active: true,
      },
    },
    201,
  );
}

async function updateProfile(
  adminClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const userId = String(body.userId || "").trim();

  const fullName = String(
    body.fullName ||
    body.name ||
    "",
  ).trim();

  const role = String(body.role || "").trim();

  if (!userId || !fullName || !role) {
    return json(
      {
        error: "Usuário, nome e cargo são obrigatórios.",
      },
      400,
    );
  }

  if (!allowedRoles.includes(role)) {
    return json(
      {
        error: "Cargo inválido.",
      },
      400,
    );
  }

  const {
    error: profileError,
  } = await adminClient
    .from("profiles")
    .update({
      full_name: fullName,
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    return json(
      {
        error: profileError.message,
      },
      400,
    );
  }

  const {
    error: authError,
  } = await adminClient.auth.admin.updateUserById(
    userId,
    {
      user_metadata: {
        full_name: fullName,
      },
    },
  );

  if (authError) {
    return json(
      {
        error: authError.message,
      },
      400,
    );
  }

  return json({
    success: true,
    message: "Perfil atualizado com sucesso.",
  });
}

async function setUserActive(
  adminClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  requesterId: string,
): Promise<Response> {
  const userId = String(body.userId || "").trim();
  const active = body.active;

  if (!userId || typeof active !== "boolean") {
    return json(
      {
        error: "Usuário e status são obrigatórios.",
      },
      400,
    );
  }

  if (userId === requesterId && active === false) {
    return json(
      {
        error: "Você não pode desativar a própria conta.",
      },
      400,
    );
  }

  const {
    error: profileError,
  } = await adminClient
    .from("profiles")
    .update({
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    return json(
      {
        error: profileError.message,
      },
      400,
    );
  }

  /*
   * Bloqueia ou desbloqueia o login no Auth.
   */
  const {
    error: authError,
  } = await adminClient.auth.admin.updateUserById(
    userId,
    {
      ban_duration: active
        ? "none"
        : "876000h",
    },
  );

  if (authError) {
    return json(
      {
        error: authError.message,
      },
      400,
    );
  }

  return json({
    success: true,
    active,
    message: active
      ? "Usuário ativado com sucesso."
      : "Usuário desativado com sucesso.",
  });
}

async function deleteUser(
  adminClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  requesterId: string,
): Promise<Response> {
  const userId = String(body.userId || "").trim();

  if (!userId) {
    return json(
      {
        error: "ID do usuário é obrigatório.",
      },
      400,
    );
  }

  if (userId === requesterId) {
    return json(
      {
        error: "Você não pode excluir a própria conta.",
      },
      400,
    );
  }

  const {
    data: targetProfile,
    error: targetProfileError,
  } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (targetProfileError) {
    return json(
      {
        error: targetProfileError.message,
      },
      400,
    );
  }

  if (!targetProfile) {
    return json(
      {
        error: "Perfil do usuário não encontrado.",
      },
      404,
    );
  }

  const {
    error: authError,
  } = await adminClient.auth.admin.deleteUser(
    userId,
  );

  if (authError) {
    return json(
      {
        error: authError.message,
      },
      400,
    );
  }

  /*
   * Caso não exista cascade no banco, remove o perfil manualmente.
   */
  await adminClient
    .from("profiles")
    .delete()
    .eq("id", userId);

  return json({
    success: true,
    message: "Usuário excluído com sucesso.",
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function json(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}
