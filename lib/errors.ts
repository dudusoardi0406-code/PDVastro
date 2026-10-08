// Códigos lançados pelas funções SQL (raise exception 'CODIGO') -> mensagens para a tela.

const MESSAGES: Record<string, string> = {
  TOTEM_SEM_EVENTO: "Este totem não está ligado a nenhum evento.",
  EVENTO_INATIVO: "O evento está desativado no momento.",
  CARRINHO_VAZIO: "Seu pedido está vazio.",
  CARRINHO_GRANDE: "Pedido com itens demais. Divida em dois pedidos.",
  QUANTIDADE_INVALIDA: "Quantidade inválida.",
  PRODUTO_INDISPONIVEL: "Um item do seu pedido ficou indisponível. Revise o pedido.",
  TOTAL_INVALIDO: "Valor do pedido inválido.",
  PEDIDO_NAO_ENCONTRADO: "Pedido não encontrado.",
  PEDIDO_NAO_PAGAVEL: "Este pedido não pode mais ser pago.",
  PIX_JA_ATIVO: "Já existe um Pix ativo para este pedido.",
  MESMO_EVENTO: "Escolha um evento diferente do atual.",
};

export function errorCode(err: unknown): string | null {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return Object.keys(MESSAGES).find((code) => message.includes(code)) ?? null;
}

export function friendlyError(err: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  const code = errorCode(err);
  return code ? MESSAGES[code] : fallback;
}
