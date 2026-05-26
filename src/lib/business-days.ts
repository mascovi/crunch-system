/**
 * Calcula dias úteis entre duas datas (ignora sábados e domingos).
 */
export function calcularDiasUteis(dataInicio: string | Date, dataFim?: string | Date): number {
  const inicio = new Date(dataInicio)
  const fim = dataFim ? new Date(dataFim) : new Date()

  // Normalizar para início do dia
  inicio.setHours(0, 0, 0, 0)
  fim.setHours(0, 0, 0, 0)

  if (fim <= inicio) return 0

  let diasUteis = 0
  const atual = new Date(inicio)

  while (atual < fim) {
    atual.setDate(atual.getDate() + 1)
    const diaSemana = atual.getDay()
    // 0 = domingo, 6 = sábado
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasUteis++
    }
  }

  return diasUteis
}
