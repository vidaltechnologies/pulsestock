// Textos da coleção do Postman nos três idiomas. Em português, pastas, nomes
// e descrições vêm direto da especificação (./spec); em inglês e espanhol,
// das traduções abaixo, pela mesma chave "método caminho". postman.test.ts
// falha se faltar alguma.

export const POSTMAN_LANGUAGES = ["pt", "en", "es"] as const;
export type Language = (typeof POSTMAN_LANGUAGES)[number];

type Texts = {
  // Vai no nome da coleção, para as três conviverem no Postman.
  label: string;
  // Pasta de cada tag da especificação, pelo nome em português.
  tags: Record<string, { name: string; description: string }>;
  operations: Record<string, { summary: string; description?: string }>;
  access: { public: string; user: string; admin: string };
  intro: string[];
  start: string;
  logoutFolder: { name: string; description: string };
  skipReset: string;
  orRateLimited: string;
  comments: { unique: string; store: string; resetOnly: string; language: string };
  examples: Record<"category" | "product" | "productDescription" | "stockReason" | "customer" | "orderNotes" | "orderEdited", string>;
};

export const POSTMAN_TEXTS: Record<Language, Texts> = {
  pt: {
    label: "Português",
    tags: {},
    operations: {},
    access: { public: "Acesso: público.", user: "Acesso: admin e operador.", admin: "Acesso: só administrador." },
    intro: [],
    start:
      "**Para começar:** escolha o ambiente *Pulse Stock (local)*, preencha `email` e `password` e rode **Gera um token de acesso**. O token fica salvo e vale para os outros requests. A coleção inteira roda no Collection Runner, na ordem das pastas.",
    logoutFolder: {
      name: "Sair",
      description: "Fica por último porque invalida o refreshToken. O accessToken vale até expirar.",
    },
    skipReset: "Troca de senha pulada: preencha newPassword no ambiente para usar.",
    orRateLimited: "ou 429 se o Supabase limitar os e-mails",
    comments: {
      unique: "Sufixo único para SKU e nomes, e um CPF válido novo, a cada request.",
      store: "Guarda no ambiente (ou na coleção, sem ambiente) para os próximos requests.",
      resetOnly: "Só troca a senha se newPassword estiver preenchido no ambiente.",
      language: "Mensagens de erro da API em português.",
    },
    examples: {
      category: "Categoria",
      product: "Produto criado pela API",
      productDescription: "Cadastrado pela coleção do Postman.",
      stockReason: "Entrada pela API",
      customer: "Cliente",
      orderNotes: "Pedido criado pela API",
      orderEdited: "Pedido editado pela API",
    },
  },
  en: {
    label: "English",
    tags: {
      Autenticação: { name: "Authentication", description: "Token for external clients and the screens' session" },
      Produtos: { name: "Products", description: "Catalog, prices and categories" },
      Estoque: { name: "Inventory", description: "Entries, exits, adjustments and history" },
      Clientes: { name: "Customers", description: "Customers with CPF or CNPJ" },
      Pedidos: { name: "Orders", description: "Sales orders and status changes" },
      Dashboard: { name: "Dashboard", description: "Sales and inventory indicators" },
      Usuários: { name: "Users", description: "Access profiles (admin only)" },
    },
    operations: {
      "post /auth/token": {
        summary: "Get an access token",
        description:
          "Exchanges email and password for an accessToken (Supabase Auth JWT) and a refreshToken. No cookie is set. A deactivated user gets 403 `user_inactive`.",
      },
      "post /auth/refresh": {
        summary: "Refresh the token",
        description: "Exchanges the refreshToken for a new pair. Each refreshToken works once.",
      },
      "post /auth/login": {
        summary: "Cookie login (used by the screens)",
        description: "Stores the session in an httpOnly cookie. To call the API from outside the app, use `/auth/token`.",
      },
      "post /auth/logout": {
        summary: "End the session",
        description: "Clears the cookie session or, with a token, revokes its refreshToken. The accessToken stays valid until it expires.",
      },
      "post /auth/password/forgot": {
        summary: "Request the password recovery email",
        description:
          "Answers 202 whether or not the email has an account, so the route doesn't reveal who is a user. The email link opens the app's new password screen.",
      },
      "post /auth/password/reset": {
        summary: "Save the new password",
        description:
          "Uses the session opened by the recovery link (cookie, not token) and ends it afterwards. Expired link → 401 `recovery_expired`.",
      },
      "get /me": { summary: "Signed-in user" },
      "get /categories": { summary: "List categories" },
      "post /categories": {
        summary: "Create a category",
        description: "Repeated name, case-insensitive, → 409 `conflict`.",
      },
      "get /categories/{id}": { summary: "Category details" },
      "patch /categories/{id}": { summary: "Rename a category" },
      "get /products": { summary: "List products" },
      "post /products": {
        summary: "Create a product",
        description: "The balance starts at zero and only changes through stock movements. Repeated SKU → 409 `conflict`.",
      },
      "get /products/{id}": { summary: "Product details" },
      "patch /products/{id}": {
        summary: "Edit a product",
        description: "Partial update: send only the fields that change. Deactivate = `{ \"active\": false }`.",
      },
      "get /stock-movements": { summary: "Movement history" },
      "post /stock-movements": {
        summary: "Record a movement",
        description:
          "Entry (`in`): any user. Exit (`out`) and adjustment (`adjustment`): admin only. Insufficient balance → 409 `insufficient_stock` and nothing is saved.",
      },
      "get /customers": { summary: "List customers" },
      "post /customers": { summary: "Create a customer", description: "Repeated CPF/CNPJ → 409 `conflict`." },
      "get /customers/{id}": { summary: "Customer details" },
      "patch /customers/{id}": {
        summary: "Edit a customer",
        description: "Partial update. Deactivating or reactivating (`active`) is admin only.",
      },
      "get /orders": { summary: "List orders" },
      "post /orders": {
        summary: "Create a pending order",
        description: "Each item's price is the product's current sale price. Stock doesn't change until confirmation.",
      },
      "get /orders/{id}": { summary: "Order details with customer and items" },
      "patch /orders/{id}": {
        summary: "Replace customer, items and notes",
        description: "Same body as creation. Pending orders only; otherwise → 409 `not_editable`.",
      },
      "post /orders/{id}/status": {
        summary: "Change the order status",
        description:
          "Confirming (`confirmed`) deducts the stock of every item in one transaction; if stock is short → 409 `insufficient_stock` and nothing changes. Then: `shipped` → `delivered`. Cancelling (`cancelled`) is admin only and returns the stock of an already confirmed order. Invalid transition → 409 `invalid_transition`.",
      },
      "get /dashboard": {
        summary: "Indicators and chart series",
        description: "`monthMargin` and `stockValue` are `null` for operators.",
      },
      "get /users": { summary: "List users" },
      "patch /users/{id}": {
        summary: "Edit name, role or status",
        description: "Admins can't change their own role or deactivate themselves (409 `self_change`).",
      },
    },
    access: { public: "Access: public.", user: "Access: admin and operator.", admin: "Access: admin only." },
    intro: [
      "Pulse Stock REST API, a mini ERP for inventory and sales orders.",
      "**Conventions:** success in `{ data }`; lists with `pagination`; errors in `{ error: { code, message, details? } }`. This collection sends `Accept-Language: en`, so error messages come in English. Sorting with `sort=field` or `sort=-field`. Every response has `X-Request-Id`.",
      "**Business rule:** stock is only deducted when the order is confirmed.",
    ],
    start:
      "**Getting started:** pick the *Pulse Stock (local)* environment, fill in `email` and `password` and run **Get an access token**. The token is saved and used by the other requests. The whole collection runs in the Collection Runner, in folder order.",
    logoutFolder: {
      name: "Sign out",
      description: "Last on purpose because it revokes the refreshToken. The accessToken stays valid until it expires.",
    },
    skipReset: "Password change skipped: fill in newPassword in the environment to use it.",
    orRateLimited: "or 429 if Supabase rate-limits the emails",
    comments: {
      unique: "Unique suffix for SKU and names, and a new valid CPF, on every request.",
      store: "Saves to the environment (or the collection, with no environment) for the next requests.",
      resetOnly: "Only changes the password if newPassword is filled in the environment.",
      language: "API error messages in English.",
    },
    examples: {
      category: "Category",
      product: "Product created by the API",
      productDescription: "Created by the Postman collection.",
      stockReason: "Entry through the API",
      customer: "Customer",
      orderNotes: "Order created by the API",
      orderEdited: "Order edited by the API",
    },
  },
  es: {
    label: "Español",
    tags: {
      Autenticação: { name: "Autenticación", description: "Token para clientes externos y sesión de las pantallas" },
      Produtos: { name: "Productos", description: "Catálogo, precios y categorías" },
      Estoque: { name: "Inventario", description: "Entradas, salidas, ajustes e historial" },
      Clientes: { name: "Clientes", description: "Registro de clientes con CPF o CNPJ" },
      Pedidos: { name: "Pedidos", description: "Pedidos de venta y cambio de estado" },
      Dashboard: { name: "Panel", description: "Indicadores de ventas e inventario" },
      Usuários: { name: "Usuarios", description: "Perfiles de acceso (solo administrador)" },
    },
    operations: {
      "post /auth/token": {
        summary: "Genera un token de acceso",
        description:
          "Cambia correo y contraseña por un accessToken (JWT de Supabase Auth) y un refreshToken. No guarda cookie. Un usuario desactivado recibe 403 `user_inactive`.",
      },
      "post /auth/refresh": {
        summary: "Renueva el token",
        description: "Cambia el refreshToken por un par nuevo. Cada refreshToken sirve una sola vez.",
      },
      "post /auth/login": {
        summary: "Login por cookie (usado por las pantallas)",
        description: "Guarda la sesión en una cookie httpOnly. Para llamar a la API desde fuera de la app, usa `/auth/token`.",
      },
      "post /auth/logout": {
        summary: "Cierra la sesión",
        description: "Borra la sesión de la cookie o, con token, invalida su refreshToken. El accessToken vale hasta que vence.",
      },
      "post /auth/password/forgot": {
        summary: "Pide el correo de recuperación de contraseña",
        description:
          "Responde 202 haya o no una cuenta para el correo, para no revelar quién es usuario. El enlace del correo abre la pantalla de nueva contraseña de la app.",
      },
      "post /auth/password/reset": {
        summary: "Guarda la nueva contraseña",
        description:
          "Usa la sesión abierta por el enlace de recuperación (cookie, no token) y la cierra después. Enlace vencido → 401 `recovery_expired`.",
      },
      "get /me": { summary: "Usuario conectado" },
      "get /categories": { summary: "Lista categorías" },
      "post /categories": {
        summary: "Registra una categoría",
        description: "Nombre repetido, sin distinguir mayúsculas, → 409 `conflict`.",
      },
      "get /categories/{id}": { summary: "Detalle de la categoría" },
      "patch /categories/{id}": { summary: "Renombra una categoría" },
      "get /products": { summary: "Lista productos" },
      "post /products": {
        summary: "Registra un producto",
        description: "El saldo empieza en cero y solo cambia con los movimientos de inventario. SKU repetido → 409 `conflict`.",
      },
      "get /products/{id}": { summary: "Detalle del producto" },
      "patch /products/{id}": {
        summary: "Edita un producto",
        description: "Edición parcial: envía solo los campos que cambian. Desactivar = `{ \"active\": false }`.",
      },
      "get /stock-movements": { summary: "Historial de movimientos" },
      "post /stock-movements": {
        summary: "Registra un movimiento",
        description:
          "Entrada (`in`): cualquier usuario. Salida (`out`) y ajuste (`adjustment`): solo administrador. Saldo insuficiente → 409 `insufficient_stock` y no se guarda nada.",
      },
      "get /customers": { summary: "Lista clientes" },
      "post /customers": { summary: "Registra un cliente", description: "CPF/CNPJ repetido → 409 `conflict`." },
      "get /customers/{id}": { summary: "Detalle del cliente" },
      "patch /customers/{id}": {
        summary: "Edita un cliente",
        description: "Edición parcial. Desactivar o reactivar (`active`) es solo del administrador.",
      },
      "get /orders": { summary: "Lista pedidos" },
      "post /orders": {
        summary: "Crea un pedido pendiente",
        description: "El precio de cada ítem es el precio de venta actual del producto. El inventario no cambia hasta la confirmación.",
      },
      "get /orders/{id}": { summary: "Detalle del pedido con cliente e ítems" },
      "patch /orders/{id}": {
        summary: "Reemplaza cliente, ítems y observaciones",
        description: "Mismo cuerpo de la creación. Solo para pedido pendiente; si no → 409 `not_editable`.",
      },
      "post /orders/{id}/status": {
        summary: "Cambia el estado del pedido",
        description:
          "Confirmar (`confirmed`) descuenta el inventario de todos los ítems en una transacción; si falta saldo → 409 `insufficient_stock` y nada cambia. Después: `shipped` → `delivered`. Cancelar (`cancelled`) es solo del administrador y devuelve el inventario de un pedido ya confirmado. Transición inválida → 409 `invalid_transition`.",
      },
      "get /dashboard": {
        summary: "Indicadores y series de los gráficos",
        description: "`monthMargin` y `stockValue` vienen `null` para el operador.",
      },
      "get /users": { summary: "Lista usuarios" },
      "patch /users/{id}": {
        summary: "Edita nombre, perfil o estado",
        description: "El administrador no cambia su propio perfil ni se desactiva (409 `self_change`).",
      },
    },
    access: { public: "Acceso: público.", user: "Acceso: administrador y operador.", admin: "Acceso: solo administrador." },
    intro: [
      "API REST de Pulse Stock, un mini ERP de inventario y pedidos de venta.",
      "**Convenciones:** éxito en `{ data }`; listas con `pagination`; errores en `{ error: { code, message, details? } }`. Esta colección envía `Accept-Language: es`, así que los mensajes de error vienen en español. Orden con `sort=campo` o `sort=-campo`. Cada respuesta lleva `X-Request-Id`.",
      "**Regla de negocio:** el inventario solo se descuenta cuando el pedido se confirma.",
    ],
    start:
      "**Para empezar:** elige el entorno *Pulse Stock (local)*, completa `email` y `password` y ejecuta **Genera un token de acceso**. El token se guarda y sirve para las demás solicitudes. Toda la colección se ejecuta en el Collection Runner, en el orden de las carpetas.",
    logoutFolder: {
      name: "Salir",
      description: "Va al final porque invalida el refreshToken. El accessToken vale hasta que vence.",
    },
    skipReset: "Cambio de contraseña omitido: completa newPassword en el entorno para usarlo.",
    orRateLimited: "o 429 si Supabase limita los correos",
    comments: {
      unique: "Sufijo único para SKU y nombres, y un CPF válido nuevo, en cada solicitud.",
      store: "Guarda en el entorno (o en la colección, sin entorno) para las siguientes solicitudes.",
      resetOnly: "Solo cambia la contraseña si newPassword está completo en el entorno.",
      language: "Mensajes de error de la API en español.",
    },
    examples: {
      category: "Categoría",
      product: "Producto creado por la API",
      productDescription: "Registrado por la colección de Postman.",
      stockReason: "Entrada por la API",
      customer: "Cliente",
      orderNotes: "Pedido creado por la API",
      orderEdited: "Pedido editado por la API",
    },
  },
};
