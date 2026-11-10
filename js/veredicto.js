// El veredicto: junta país, operadores, servicios y tu prueba local en una sola respuesta.
// Función pura y determinista: mismo insumo → mismo veredicto.

function lista(nombres) {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * entrada = {
 *   pais: { estado, motivos: [texto] },
 *   operadores: [{ nombre, estado }],      // nombre ya legible («Claro móvil»)
 *   servicios: [{ nombre, estado }],       // estado de Statuspage traducido
 *   pops: [{ ciudad, estado }],            // centros de Cloudflare en Colombia
 *   local: { estado, ok, total },          // de resumirSondeo
 *   enVivo: número de fuentes remotas que respondieron en vivo
 * }
 * Devuelve { codigo, titular, detalle, tono: 'rojo'|'ambar'|'calma' }.
 */
export function decidir(entrada) {
  const { pais = { estado: 'sin-dato', motivos: [] }, operadores = [], servicios = [], pops = [], local = { estado: 'sin-medir' }, enVivo = 0 } = entrada ?? {};
  const motivos = pais.motivos ?? [];

  // 1. Tu equipo no llega a nada y ninguna fuente respondió: el problema está de tu lado.
  if (local.estado === 'sin-conexion' && enVivo === 0) {
    return {
      codigo: 'tu-conexion', tono: 'rojo', titular: 'Solo tú',
      detalle: 'Tu equipo no llegó a ningún sitio de prueba ni a las fuentes de datos. Revisa el wifi, el router o los datos móviles; si todo está prendido, llama a tu operador.',
    };
  }

  // 2. Caída a nivel país.
  if (pais.estado === 'caida') {
    return {
      codigo: 'caida-pais', tono: 'rojo', titular: 'Sí',
      detalle: `Las mediciones de Colombia muestran una caída${motivos.length ? `: ${motivos.join('; ')}` : ''}. No es solo tuyo.`,
    };
  }

  // 3. Caída de uno o más operadores.
  const caidos = operadores.filter((o) => o.estado === 'caida').map((o) => o.nombre);
  if (caidos.length) {
    return {
      codigo: 'caida-operador', tono: 'rojo', titular: `Sí, en ${lista(caidos)}`,
      detalle: `La red de ${lista(caidos)} perdió alcance en las mediciones. Si usas ese operador, no es solo tuyo.`,
    };
  }

  // 4. Algo raro sin confirmar.
  const raros = operadores.filter((o) => o.estado === 'aviso').map((o) => o.nombre);
  if (pais.estado === 'aviso' || raros.length) {
    const partes = [];
    if (pais.estado === 'aviso') partes.push(motivos.length ? motivos.join('; ') : 'una señal de Colombia está por debajo de lo normal');
    if (raros.length) partes.push(`señales bajas en ${lista(raros)}`);
    return {
      codigo: 'raro', tono: 'ambar', titular: 'Quizá',
      detalle: `Hay algo fuera de lo normal, sin confirmar: ${partes.join('; ')}. Si te falla, puede no ser solo tuyo.`,
    };
  }

  // 5. Internet bien, pero un servicio grande o un centro de Cloudflare en Colombia falla.
  const servCaidos = servicios.filter((s) => s.estado === 'caida').map((s) => s.nombre);
  const popsMal = pops.filter((p) => p.estado === 'caida').map((p) => `Cloudflare ${p.ciudad}`);
  const fallas = [...servCaidos, ...popsMal];
  if (fallas.length) {
    return {
      codigo: 'servicio', tono: 'ambar', titular: `No: es ${fallas[0]}`,
      detalle: `Internet en Colombia se ve normal, pero ${lista(fallas)} reporta${fallas.length > 1 ? 'n' : ''} una falla grande en su página de estado.`,
    };
  }

  // 6. Colombia bien, tu prueba no.
  if (['sin-conexion', 'parcial', 'lento'].includes(local.estado)) {
    const que = local.estado === 'lento'
      ? 'tu equipo responde, pero lento'
      : `tu equipo solo llegó a ${local.ok ?? 0} de ${local.total ?? 0} sitios de prueba`;
    return {
      codigo: 'solo-tu', tono: 'ambar', titular: 'Solo tú',
      detalle: `Colombia se ve normal, pero ${que}. Reinicia el router o prueba con datos móviles; un bloqueador de anuncios también puede frenar la prueba.`,
    };
  }

  // 7. No hay forma de saber cómo está el país.
  if (pais.estado === 'sin-dato') {
    return {
      codigo: 'sin-datos', tono: 'ambar', titular: 'No sé',
      detalle: local.estado === 'ok'
        ? 'Tu conexión funciona, pero no pude leer las mediciones de Colombia. Intenta de nuevo en unos minutos.'
        : 'No pude leer las mediciones de Colombia. Intenta de nuevo en unos minutos.',
    };
  }

  // 8. Todo normal.
  return {
    codigo: 'normal', tono: 'calma', titular: 'No',
    detalle: local.estado === 'ok'
      ? 'Internet en Colombia se ve normal y tu conexión responde. Si una app te falla, el problema es de esa app.'
      : 'Internet en Colombia se ve normal. Si a ti te falla, el problema está en tu red o en tu operador.',
  };
}
