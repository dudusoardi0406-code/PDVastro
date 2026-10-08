# PDV Totem de Autoatendimento para Eventos (MVP com Pix)

> Documento de escopo e especificação técnica. Valores e prazos de terceiros são referências pesquisadas e devem ser reconfirmados antes de fechar.

## 1. Contexto

- **Cliente:** empresa de eventos.
- **Equipamento:** 1 totem touch com Windows, impressora térmica embutida e leitor de QR/código de barras. **Não tem leitor de cartão nem pinpad.**
- **Operação:** autoatendimento. O cliente escolhe os itens, paga e recebe uma ficha impressa.
- **Pagamento (MVP):** somente Pix, com QR dinâmico na tela. O dinheiro cai na **conta PJ do dono do evento**.
- **Controle:** interno, sem emissão de nota fiscal agora. O projeto deve ficar aberto para NFC-e depois.
- **Internet nos locais:** instável. Decisão do cliente: **se a internet cair, o totem fica fora do ar** (sem modo offline).
- **Quantidade:** 1 totem por evento.
- **Prazo até o primeiro evento:** 2 dias.

## 2. Escopo do MVP (dentro)

1. Tela do totem: cardápio por categorias, carrinho, resumo do pedido.
2. Pagamento por Pix: QR dinâmico e "copia e cola", com confirmação automática (webhook).
3. Ficha impressa após o pagamento confirmado: **senha + comprovante**.
4. Painel administrativo web: cadastro de categorias e produtos (nome, preço, foto, ativo/inativo), lista de pedidos, relatório de vendas, reimpressão de ficha.
5. Tela de "totem fora do ar" quando não houver conexão.

## 3. Fora do escopo (fase 2 ou à parte)

- Pagamento por cartão (integração com maquininha/TEF da Rede/Itaú).
- Emissão de NFC-e.
- Modo offline com fila de sincronização e 4G de reserva.
- Retirada com leitura de QR da ficha (tela de balcão/cozinha).
- Cashless (pulseira/cartão com saldo) e venda de ingressos.
- Mais de um totem com relatório unificado (a modelagem já prevê, mas não entra nos testes).

## 4. Fluxo do cliente no totem

1. Tela inicial ("Toque para pedir").
2. Escolhe itens e quantidades; o carrinho mostra o total.
3. Toca em **Pagar com Pix**. O sistema cria o pedido (`aguardando_pagamento`) e gera a cobrança Pix.
4. O totem exibe o QR e o "copia e cola", com contagem regressiva de validade (ex.: 3 a 5 minutos).
5. O cliente paga no app do banco.
6. O servidor recebe a confirmação do Pix, marca o pedido como `pago` e o totem avança sozinho.
7. O totem imprime a ficha e mostra "Pagamento confirmado. Retire sua ficha".
8. Voltando à tela inicial após alguns segundos. Se o QR expirar, o pedido é cancelado e o cliente pode tentar de novo.

Regra central: **pedido só é considerado pago quando o servidor confirmar o Pix.** O navegador do totem nunca decide sozinho que foi pago.

## 5. Ficha impressa (senha + comprovante)

Conteúdo sugerido:

- Nome do evento e data/hora.
- **Senha** em destaque (ex.: `A-042`), sequencial por evento e reiniciada a cada dia.
- Lista de itens, quantidades e valor total.
- Forma de pagamento: Pix, com identificador da transação (últimos caracteres).
- Aviso: "Apresente esta ficha no balcão. Comprovante sem valor fiscal."

Papel térmico: confirmar largura (58 mm ou 80 mm) no totem.

## 6. Pagamento Pix

### 6.1 Arquitetura

Toda a cobrança fica atrás de uma **camada única de provedor Pix** (interface com `criarCobranca`, `consultarCobranca` e `tratarWebhook`). Assim dá para usar o Itaú direto ou um gateway, trocando só o provedor.

### 6.2 Opção A: API Pix direto no Itaú (se a conta PJ do dono for Itaú)

O dono precisa:

1. Contratar com o banco (via gerente) o serviço **API Pix Recebimento, modelo sem parceria**.
2. Receber do banco o `client_id` e uma senha temporária. Segundo a OpenPix, essa senha vale cerca de 72 horas.
3. Cadastrar a conta no **portal de desenvolvedores do Itaú** e gerar o **certificado digital** (autenticação mTLS).
4. Ter a **chave Pix** da conta cadastrada.

Com isso o sistema recebe: `client_id`, `client_secret`, arquivos do certificado e a chave Pix.

Risco: não foi confirmado o prazo de liberação pelo banco. Com 2 dias, tratar como risco alto.

### 6.3 Opção B (plano B): gateway com conta PJ digital (ex.: Asaas)

- Dono abre a conta online; o dinheiro cai nessa conta e ele transfere para o banco dele.
- Tarifa citada pelo Asaas: R$ 0,99 por Pix recebido nos 3 primeiros meses e R$ 1,99 depois. **Reconfirmar antes de fechar.** A taxa sai do faturamento do dono.
- Alguns relatos de usuários citam outros provedores (Woovi, EFI) em torno de 0,8% a 1% por Pix. É informação não oficial.
- Tempo de aprovação do cadastro: não confirmado.

### 6.4 Decisão operacional

O dono inicia **os dois caminhos hoje** (gerente do Itaú e conta no gateway). Usa-se o que liberar primeiro.

### 6.5 Regras de segurança do Pix

- Credenciais e certificado ficam **só no servidor** (variáveis de ambiente na Vercel), nunca no front-end.
- Webhook com **validação de origem** (segredo/assinatura do provedor ou consulta de volta ao provedor para confirmar).
- **Idempotência:** o mesmo webhook recebido duas vezes não pode pagar o pedido duas vezes nem imprimir ficha duplicada.
- Valor sempre em **centavos (inteiro)** e conferido: o valor pago deve ser igual ao valor do pedido.
- **Polling de segurança:** se o webhook atrasar, o servidor consulta o provedor a cada poucos segundos enquanto o QR estiver válido.
- Teste de ponta a ponta com um Pix real de **R$ 1,00** antes do evento.

## 7. Stack

| Camada | Escolha | Observação |
|---|---|---|
| Front do totem e painel | Next.js (React) | Mesma aplicação, rotas separadas (`/totem`, `/admin`) |
| Hospedagem | Vercel **Pro** (~US$ 20/mês por membro) | Hobby é só uso não comercial; PDV de empresa exige Pro |
| Banco e auth | Supabase **Pro** (~US$ 25/mês + uso) | Postgres, Auth do admin, Storage de fotos |
| API/webhook | Rotas de API do Next.js (ou Edge Functions) | Segredos só no servidor |
| Totem | Chrome/Edge em modo quiosque | Ver seção 9 |

Custo fixo estimado de infra: cerca de **US$ 45/mês** mais uso.

## 8. Modelo de dados (rascunho)

```sql
-- eventos (permite vários no futuro)
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at date not null,
  active boolean default true
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int default 0,
  active boolean default true
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id),
  name text not null,
  price_cents int not null check (price_cents >= 0),
  image_url text,
  active boolean default true
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id),
  ticket_number int not null,          -- senha sequencial por evento/dia
  ticket_code text not null,           -- ex.: A-042
  status text not null default 'aguardando_pagamento',
    -- aguardando_pagamento | pago | expirado | cancelado
  total_cents int not null,
  created_at timestamptz default now(),
  paid_at timestamptz,
  printed_at timestamptz,
  print_count int default 0
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  name_snapshot text not null,
  unit_price_cents int not null,
  quantity int not null check (quantity > 0)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  provider text not null,              -- 'itau' | 'asaas' | ...
  provider_txid text unique,           -- id da cobrança no provedor
  pix_copia_cola text,
  amount_cents int not null,
  status text not null default 'pendente', -- pendente | pago | expirado | falhou
  expires_at timestamptz,
  paid_at timestamptz,
  raw_webhook jsonb
);
```

Notas:

- Guardar `name_snapshot` e `unit_price_cents` nos itens para o histórico não mudar se o preço do produto mudar.
- RLS ativado: o totem só **lê** cardápio; criação de pedido e pagamento passam pelo servidor. A chave de serviço do Supabase nunca vai para o navegador.
- A senha (`ticket_number`) deve ser gerada no banco de forma atômica para não repetir.

## 9. Totem Windows: quiosque e impressão

- Abrir o navegador em modo quiosque apontando para `/totem`, com inicialização automática com o Windows.
- **Impressão da ficha (caminho do MVP):** usar o navegador com impressão silenciosa (`--kiosk-printing`) na impressora térmica definida como padrão. A ficha é uma página HTML com largura de papel fixa (58 ou 80 mm).
- Alternativa se a impressão silenciosa falhar: pequeno programa local no Windows que recebe o pedido e imprime em ESC/POS.
- **Testar no totem real hoje:** driver da impressora, largura do papel, corte automático, fila de impressão.
- O leitor de QR funciona como teclado; não é usado no MVP, mas fica disponível para a fase de retirada por QR.

## 10. Internet instável (sem modo offline)

- O totem faz verificação periódica (ex.: a cada 5 s) em uma rota de saúde.
- Sem conexão: mostrar **"Totem temporariamente fora do ar. Procure o caixa."** e **bloquear novos pedidos**.
- Pix pendente quando a internet cai: a confirmação chega ao servidor pelo webhook. Ao reconectar, o totem consulta o pedido e, se estiver `pago` e sem `printed_at`, imprime a ficha.
- Cliente que pagou e não recebeu a ficha: reimpressão pelo painel admin, buscando por senha ou horário.
- **Contingência combinada com o cliente:** ter um ponto de venda humano de reserva no evento.

## 11. Telas

**Totem**

- Início, cardápio com categorias e fotos grandes, carrinho, pagamento (QR + contagem regressiva), confirmação, fora do ar.
- Botões grandes, textos curtos, timeout de inatividade que limpa o carrinho.

**Admin** (login com Supabase Auth)

- Produtos e categorias (CRUD, ativar/inativar, foto).
- Pedidos do dia com status e reimpressão.
- Relatório: total vendido, por produto, por hora, quantidade de pedidos, conciliação com os Pix recebidos.

## 12. Endpoints (rascunho)

| Método | Rota | Função |
|---|---|---|
| GET | `/api/menu` | Cardápio ativo |
| POST | `/api/orders` | Cria pedido com itens e recalcula o total no servidor |
| POST | `/api/orders/:id/pix` | Gera cobrança Pix e devolve QR/copia e cola |
| GET | `/api/orders/:id` | Status do pedido (usado pelo totem) |
| POST | `/api/webhooks/pix` | Recebe confirmação do provedor |
| POST | `/api/orders/:id/print` | Marca impressão / reimpressão (admin) |
| GET | `/api/health` | Verificação de conexão do totem |

O **total é sempre recalculado no servidor** a partir dos preços do banco. O front só envia IDs e quantidades.

## 13. Cronograma (2 dias)

**Dia 1**

- Projeto no Next.js, Supabase e Vercel; schema e RLS.
- Admin de produtos/categorias.
- Totem: cardápio, carrinho, criação de pedido.
- Ficha: layout e **teste de impressão no totem real**.
- Cliente: abrir os dois caminhos de Pix (Itaú e gateway).

**Dia 2**

- Integração Pix com o provedor que estiver liberado, webhook e polling de segurança.
- Teste com Pix real de R$ 1,00 e fluxo completo.
- Tela de fora do ar, modo quiosque, inicialização automática.
- Cardápio real cadastrado, treinamento rápido e entrega.

Se o Pix não estiver liberado até o fim do Dia 1, o evento corre risco. Avisar o cliente imediatamente e manter um caixa humano de reserva.

## 14. Pendências com o cliente (pedir hoje)

- [ ] Banco da conta PJ do dono e se a API Pix já está liberada.
- [ ] Conta no gateway aberta (plano B).
- [ ] Cardápio com preços e fotos.
- [ ] Acesso ao totem (Windows) para testes de impressão.
- [ ] Nome do evento e identidade visual (logo e cores).
- [ ] Largura do papel da impressora (58 mm ou 80 mm).
- [ ] Aceite do escopo por escrito.

## 15. Proposta comercial (estimativa)

> Referências: dev freelancer pleno no Brasil costuma cobrar de R$ 90 a R$ 180 por hora. PDV pronto genérico custa algo como R$ 167 a R$ 290 por mês. Os valores abaixo são uma estimativa para decisão sua, não aconselhamento financeiro.

- **Implantação (MVP):** R$ 5 mil a R$ 12 mil. Base: 40 a 80 horas, mais cerca de 30% de adicional de urgência.
- **Mensalidade:** R$ 400 a R$ 1.000, cobrindo hospedagem (~US$ 45), suporte e correções.
- **Taxa do Pix:** paga pelo dono ao provedor, fora do preço acima.
- **Fase 2 (cobrar à parte):** cartão/TEF, NFC-e, offline com 4G, retirada por QR.

Itens para deixar por escrito:

- Escopo e o que fica de fora (seções 2 e 3).
- Totem sem internet = totem fora do ar; contingência humana por conta do cliente.
- Limite de alterações incluídas e valor da hora para extras.
- Quem fornece a conta Pix e as credenciais; a responsabilidade pela guarda delas.
- Nota fiscal: o sistema é de controle interno; obrigações fiscais são do cliente e do contador dele.

## 16. Critérios de aceite

- [ ] Cliente monta pedido e paga por Pix de verdade (R$ 1,00) e o pedido vira `pago` sozinho.
- [ ] Ficha imprime uma única vez, com senha, itens e total corretos.
- [ ] Webhook duplicado não duplica pagamento nem ficha.
- [ ] Pix expirado cancela o pedido e libera nova tentativa.
- [ ] Sem internet, o totem mostra "fora do ar" e não aceita pedidos.
- [ ] Ao reconectar, ficha pendente de pedido pago é impressa.
- [ ] Admin cadastra produto, vê pedidos, reimprime e exporta/consulta relatório do dia.
- [ ] Credenciais do Pix não aparecem no código do navegador.

## 17. Fontes consultadas

- Contratação da API Pix Itaú (modelo sem parceria) e certificado no portal Itaú: guias da Clínica nas Nuvens.
- Credenciais Itaú e senha temporária de 72 h: documentação da OpenPix.
- Tarifas do Pix no Asaas: página oficial do Asaas.
- Preços Supabase e Vercel: guias de preços 2026 (verificar nas páginas oficiais).
- Faixas de valor/hora de dev: Jobrise, "Freelance Developer Brasil 2026".
