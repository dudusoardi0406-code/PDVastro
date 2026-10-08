# PDVastro — totem de autoatendimento com Pix

Totem touch para eventos: o cliente escolhe os itens, paga por **Pix (Itaú)** e recebe uma **ficha impressa** com senha e comprovante. Inclui um painel web para cadastrar eventos (com o visual de cada um), cardápio e totens, acompanhar pedidos, reimprimir fichas e ver relatórios.

Escopo e decisões: [pdv-eventos-escopo.md](pdv-eventos-escopo.md).

- **Next.js 16** (App Router, Cache Components) na **Vercel**
- **Supabase**: Postgres, Auth (login do painel) e Storage (fotos e logos)
- **Pix**: API Pix Recebimentos do Itaú (OAuth + mTLS) ou o provedor `mock` para testes

| Rota | O que é |
|---|---|
| `/totem` | Tela do cliente (abrir no totem em modo quiosque) |
| `/admin` | Painel: eventos e tema, cardápio, totens, pedidos, relatórios, Pix |
| `/api/totem/*` | API do totem (exige o cookie de pareamento) |
| `/api/webhooks/pix/{segredo}` | Webhook Pix |
| `/api/cron/reconcile` | Conciliação a cada minuto (cron da Vercel) |

---

## 1. Banco de dados (Supabase)

1. No **SQL Editor** do projeto Supabase, rode, nesta ordem:
   1. [supabase/migrations/0001_schema.sql](supabase/migrations/0001_schema.sql): tabelas, RLS e o bucket `assets`
   2. [supabase/migrations/0002_functions.sql](supabase/migrations/0002_functions.sql): funções atômicas (pedido, Pix, senha e ficha)
   3. *(opcional)* [supabase/seed.sql](supabase/seed.sql): 2 eventos de exemplo ("Pagode do Zé" e "Submundo do Funk") com cardápio
2. **Crie o usuário do painel**: em Authentication › Users › *Add user*, informe e-mail e senha e marque *Auto confirm*.
3. **Libere o usuário no painel** (SQL Editor):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'seu-email@exemplo.com';
   ```
4. **Desative o cadastro público** em Authentication › Sign In / Providers › *Allow new users to sign up* (desligado). Quem não está na tabela `admins` não entra, mas é melhor não deixar o cadastro aberto.

Segurança do banco: RLS está ligado em todas as tabelas e não há policies públicas. O navegador nunca acessa o banco direto: totem e painel passam pelas rotas do servidor, que usam a chave secreta.

## 2. Variáveis de ambiente

Copie [.env.example](.env.example) para `.env.local` (uso local) e cadastre as mesmas chaves na Vercel em **Settings › Environment Variables**.

| Variável | Development | Preview | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | ✔ | ✔ | ✔ |
| `PIX_PROVIDER` | `mock` | `mock` | `itau` (quando as credenciais chegarem) |
| `PIX_WEBHOOK_SECRET`, `CRON_SECRET` | ✔ | ✔ | ✔ (valores longos e diferentes) |
| `ITAU_*` | — | — | ✔ |

> Se o Supabase foi conectado pela integração da Vercel, ela cria `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. O sistema aceita esses nomes também.
>
> Se Preview e Production usarem o **mesmo** banco, os pedidos de teste (mock) aparecem nos relatórios. O ideal é um projeto Supabase separado para testes.

## 3. Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev                  # http://localhost:3000
```

Teste completo com `PIX_PROVIDER=mock`:

1. Acesse `/admin`, entre e confira os eventos (os do seed ou um novo).
2. Em **Totens** › *Novo totem*, escolha o evento e copie o link de pareamento.
3. Abra o link (no totem ou em outra aba): ele abre `/totem` já pareado.
4. Monte um pedido › *Pagar com Pix* › **Simular pagamento (teste)** › a senha aparece e a ficha vai para a impressão.
5. Para testar *valor divergente*: em **Pix** › *Simular pagamento*, informe o txid (detalhe do pedido) e um valor diferente.

Outros comandos: `npm run lint`, `npm run typecheck`, `npm run build`.

## 4. Totem Windows (quiosque + impressão silenciosa)

1. Instale o driver da impressora térmica e defina-a como **impressora padrão** do Windows.
2. Faça uma impressão manual no Chrome (Ctrl+P) e salve as opções: **Margens: nenhuma**, **Cabeçalhos e rodapés: desmarcado**, papel de 80 mm (ou 58 mm).
3. Crie um atalho do Chrome com o destino:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing --noerrdialogs --disable-pinch --overscroll-history-navigation=0 --disable-features=TranslateUI https://SEU-DOMINIO/totem
   ```
4. Coloque o atalho em `shell:startup` (Win+R › `shell:startup`) para abrir junto com o Windows.
5. No painel, em **Totens**, ajuste a largura do papel (58/80 mm).
6. Abra uma vez o link de pareamento nesse Chrome. O cookie fica salvo por 2 anos.

Comportamento:
- **Sem internet, o totem fica "fora do ar"** e não aceita pedidos.
- Se o cliente já tinha pagado, a ficha sai quando a conexão voltar.
- Reimpressões feitas pelo painel saem no totem em até 5 segundos.

## 5. Pix Itaú

O que o dono da conta PJ precisa providenciar (seção 6.2 do escopo):
1. Contratar com o gerente a **API Pix Recebimento (modelo sem parceria)**.
2. Receber o `client_id` e a senha temporária e gerar o `client_secret` e o **certificado** no portal de desenvolvedores do Itaú.
3. Ter a **chave Pix** cadastrada na conta.

Configuração:
1. Converta o certificado e a chave para base64 (PowerShell):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.crt")) | Set-Clipboard
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("chave.key")) | Set-Clipboard
   ```
2. Na Vercel (Production), defina `PIX_PROVIDER=itau`, `ITAU_CLIENT_ID`, `ITAU_CLIENT_SECRET`, `ITAU_CERT_B64`, `ITAU_KEY_B64` e `ITAU_PIX_KEY`.
3. **Confirme com o Itaú as URLs** de token e da API Pix e preencha `ITAU_TOKEN_URL` e `ITAU_PIX_BASE_URL`. As fontes públicas divergem; os padrões estão em [lib/pix/itau.ts](lib/pix/itau.ts).
4. No painel, em **Pix**, confira que todas as variáveis aparecem como "definida" e clique em *Cadastrar webhook no Itaú*.
5. Faça um **Pix real de R$ 1,00** de ponta a ponta antes do evento.

Como a confirmação funciona:
- Um pedido só vira pago depois que o servidor **consulta a cobrança no Itaú** (`GET /cob/{txid}`) e confere o valor.
- Essa consulta acontece em três momentos:
  - enquanto o QR está na tela (a cada ~2,5 s);
  - no cron, a cada minuto;
  - quando chega o webhook.
- A Vercel **não valida certificado de cliente (mTLS) nas requisições que recebe**. Por isso o webhook só acelera: o payload nunca marca pagamento sozinho, e o sistema funciona mesmo que o Itaú não entregue o webhook.
- Para trocar de banco ou gateway, basta escrever outro provedor com a interface de [lib/pix/types.ts](lib/pix/types.ts).

> O cron por minuto (`vercel.json`) exige o plano **Vercel Pro**. No Hobby o cron é diário, mas o polling do totem continua confirmando os pagamentos.

## 6. Regras importantes

- Valores sempre em **centavos**. O total é **recalculado no banco** a partir dos preços cadastrados; o totem só envia IDs e quantidades.
- **Webhook ou consulta repetidos não pagam duas vezes** nem geram ficha duplicada. O totem só imprime depois de "pegar" a ficha (`claim_print_job`).
- **Pix pago nunca se perde**: se cair depois de o QR expirar ou de o cliente cancelar, o pedido vira pago e a ficha é impressa.
- Pagamento com **valor diferente** fica como *divergente* e não libera ficha. **Dois Pix para o mesmo pedido** ficam como *duplicado*, para estorno manual. As duas situações aparecem no relatório.
- A **senha** (ex.: `A-042`) é sequencial por evento e reinicia no **dia operacional**, que vira às **06:00** (horário de Porto Velho), porque os eventos vão das 20h às 04h.
- Comprovante **sem valor fiscal**. O projeto está pronto para NFC-e numa fase futura.

## 7. Estrutura

```
app/totem/                 tela do cliente (máquina de estados, temas, ficha)
app/admin/                 painel (Server Actions em app/admin/actions.ts)
app/api/                   rotas do totem, webhook, cron e saúde
lib/pix/                   provedores Pix (itau, mock) e confirmação única
lib/themes.ts              presets de tema (pagode, underground)
styles/totem.css           visual do totem por preset
supabase/                  migrações SQL e seed
```
