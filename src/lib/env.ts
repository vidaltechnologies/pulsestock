// Variáveis públicas do Supabase. Referências literais a process.env.NEXT_PUBLIC_*
// são necessárias para o Next.js embutir os valores no bundle do navegador.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local (veja o .env.example).",
    );
  }

  return { url, publishableKey };
}
