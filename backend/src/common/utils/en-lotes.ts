/**
 * Recorre `items` de a `tamanoLote` en paralelo, con una pausa entre lotes. Pensado para
 * envíos masivos de correo sin chocar con el rate limit del proveedor (Resend permite
 * pocas requests por segundo en su plan base). Devuelve cuántos `fn` resolvieron `true`.
 */
export async function enLotes<T>(
  items: T[],
  fn: (item: T) => Promise<boolean>,
  tamanoLote = 2,
  pausaMs = 1000,
): Promise<{ ok: number; fallidos: number }> {
  let ok = 0;
  let fallidos = 0;
  for (let i = 0; i < items.length; i += tamanoLote) {
    const resultados = await Promise.all(items.slice(i, i + tamanoLote).map(fn));
    ok += resultados.filter(Boolean).length;
    fallidos += resultados.filter((r) => !r).length;
    if (i + tamanoLote < items.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, pausaMs));
    }
  }
  return { ok, fallidos };
}
