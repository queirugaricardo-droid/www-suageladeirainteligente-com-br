# Geladeira Inteligente — hospedar fora da Lovable

Este guia prepara uma **cópia independente**, sem desligar o aplicativo atual. Não troque o domínio nem apague o projeto Lovable antes de testar a cópia. Nenhuma conta externa foi criada e nenhum dado foi transferido automaticamente.

## O que foi preparado

- Com `GEMINI_API_KEY` no servidor, fotos e estimativas de preços usam Google Gemini diretamente. Sem essa chave, continua o Lovable AI Gateway com o modelo atual.
- O modelo direto padrão é `gemini-2.5-flash`; `GEMINI_MODEL` permite indicar outro modelo compatível com imagens, respostas JSON e streaming. Confirme disponibilidade na sua conta Google.
- O mesmo prompt, revisão antes de salvar, catálogo privado, histórico e cota de **2 fotos por mês** continuam sendo usados. Uma falha do Gemini não muda automaticamente de provedor nem registra uma análise bem-sucedida.
- `VITE_SUPABASE_ANON_KEY` tem prioridade sobre a chave pública atual, por um alias de compilação. `VITE_SUPABASE_URL` já era configurável. Os arquivos gerenciados pela Lovable permanecem intactos. Sem novos valores, ficam as configurações atuais.
- `vercel.json` e `netlify.toml` preservam o aplicativo completo. **Não é uma SPA estática:** cadastro, IA e funções privadas precisam do servidor TanStack Start. Não adicione um redirecionamento de tudo para `index.html`; o Nitro gera as rotas corretas.
- Dentro da Lovable nada precisa ser alterado. A chave Gemini não está configurada neste projeto, portanto o caminho direto ainda precisa de teste real após você fornecer uma chave.

## 1. Criar o seu banco e autenticação

1. Acesse https://supabase.com e crie sua conta. Isso é para a cópia externa; o projeto atual continua usando Lovable Cloud.
2. Clique em **New project**, escolha organização, nome, região e uma senha forte para o banco. Guarde a senha fora do GitHub.
3. Em **Project Settings → API** (ou **Connect / API Keys**, conforme a interface), copie a URL do projeto e a chave **anon** ou **publishable**. São configurações públicas; a segurança dos dados depende das políticas por usuário já existentes.
4. Escolha **apenas uma** das duas formas de preparar os dados:

### A. Começar com banco vazio (sem migrar usuários antigos)

Abra **SQL Editor** no projeto novo. No GitHub, abra `drizzle/migrations/` e execute o conteúdo completo dos arquivos `.sql`, um por vez, nesta ordem:

1. `0000_migration.sql`
2. `0001_create_estoque_ideal.sql`
3. `0002_catalogo_e_historico_confirmado.sql`
4. `0003_sincronizar_catalogo_estoque.sql`
5. `0004_perfis_assinaturas_seguros.sql`
6. `0005_restringir_grants_contas.sql`
7. `0006_assinaturas_stripe.sql`
8. `0007_desativar_cobranca_stripe.sql`

Espere cada execução terminar sem erros antes da próxima. Não execute os arquivos JSON de `meta`. Os dois últimos SQL são parte da sequência histórica: **o último desativa acesso pago**, não reativa cobrança. Não use `drizzle push` para substituir essas migrations: funções, políticas, permissões e gatilhos precisam ser preservados. Esses SQL dependem do Auth do Supabase, não funcionam sem adaptação em um PostgreSQL genérico.

### B. Preservar usuários, alimentos e histórico atuais

Use a exportação completa da seção 5 em um projeto novo separado. Ela já inclui estrutura; **não aplique novamente as oito migrations sobre o banco restaurado**, pois criariam tabelas já existentes. Compare a estrutura restaurada com a versão do código. Se a exportação já contém a migration 0007, não a repita.

## 2. Configurar login no projeto externo

1. Abra **Authentication → Providers / Sign In** e habilite **Email** e senha. Mantenha confirmação de e-mail ligada. Não habilite cadastro anônimo.
2. Em **Authentication → URL Configuration**, configure **Site URL** com o novo endereço HTTPS. Inclua em **Redirect URLs** `https://SEU-DOMINIO/**` e, durante testes, `https://SEU-PROJETO.vercel.app/**`. Substitua pelos endereços reais, não pelos exemplos.
3. Cadastro retorna a `/auth/callback`; recuperação retorna a `/reset-password`. Os endereços são construídos a partir do domínio atual.
4. Para Google, acesse https://console.cloud.google.com/apis/credentials, crie um projeto, configure a tela de consentimento OAuth e crie um cliente OAuth do tipo **Web application**. Em testes, adicione sua conta como usuário de teste.
5. Cadastre no Google o endereço de retorno **mostrado no painel do seu Supabase** para o provedor Google (é o callback do serviço de autenticação, não `/auth/callback` do site). Configure também a origem do novo site quando solicitada.
6. Cole Client ID e Client Secret em **Authentication → Providers → Google** do projeto externo e habilite o provedor.
7. Configure `VITE_AUTH_PROVIDER=supabase` na hospedagem externa. Assim Google usa seu próprio projeto; o botão Lovable fica oculto somente nesse ambiente. Dentro da Lovable deixe essa variável ausente para preservar ambos os logins atuais.
8. Configure envio de e-mail próprio/SMTP antes de atender usuários reais; o remetente padrão pode ter restrições. Teste confirmação e recuperação recebendo o e-mail e concluindo o link.

As configurações Google, SMTP, segredos e URLs permitidas não acompanham uma exportação de banco. Sessões antigas não se transferem entre domínios: usuários entram novamente; não envie tokens por links.

## 3. Criar a chave Gemini

1. Entre com sua conta Google em https://aistudio.google.com/apikey e escolha **Create API key**, vinculando-a a um projeto seu.
2. Confira cota, região, condições de uso de dados e cobrança: https://ai.google.dev/gemini-api/docs/billing e https://ai.google.dev/gemini-api/docs/rate-limits. A disponibilidade de faixa gratuita não significa serviço ilimitado ou gratuito garantido.
3. Guarde a chave em `GEMINI_API_KEY`, apenas nas variáveis do **servidor** da hospedagem. Nunca use `VITE_GEMINI_API_KEY` e nunca cole a chave no código/GitHub.
4. Faça uma nova publicação depois de configurar a chave. Se a chave existir mas for inválida ou sem cota, o app mostra erro e não troca silenciosamente de serviço.

Se desejar usá-la ainda dentro da Lovable, adicione `GEMINI_API_KEY` pelo formulário seguro de Secrets e publique novamente. O preview lê a chave atual; o site publicado precisa de nova publicação.

## 4. Importar o GitHub na Vercel

1. Crie sua conta em https://vercel.com/signup e conecte seu GitHub. Autorize o repositório **www-suageladeirainteligente-com-br**.
2. Clique em **Add New → Project**, importe o repositório e mantenha a pasta raiz. Use Node.js **22**. Os arquivos de configuração indicam instalação `bun install --frozen-lockfile` e compilação `bun run build`.
3. Selecione **Other**, não um preset de Vite SPA, e não substitua o destino por `dist`. Nitro gera `.vercel/output` com arquivos públicos e funções. O ambiente Vercel é detectado automaticamente; `NITRO_PRESET=vercel` torna a escolha explícita.
4. Em **Settings → Environment Variables**, configure:

| Nome | Valor / finalidade |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do seu projeto externo, usada no navegador |
| `VITE_SUPABASE_ANON_KEY` | Chave anon/publishable do mesmo projeto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Mesma chave pública; mantenha igual à anterior para ferramentas externas |
| `SUPABASE_URL` | Mesma URL, usada no servidor |
| `SUPABASE_PUBLISHABLE_KEY` | Mesma chave pública, usada para validar sessão no servidor |
| `VITE_AUTH_PROVIDER` | `supabase` para seu Google OAuth externo |
| `GEMINI_API_KEY` | Sua chave Gemini, privada, somente no servidor |
| `NITRO_PRESET` | `vercel` |

Configure para **Production** e, se for testar, também **Preview**. URL e chaves públicas de navegador e servidor devem pertencer ao mesmo projeto, ou login e dados privados falharão. O app atual não precisa de chave service-role para suas operações normais; não adicione uma chave privilegiada por precaução.

5. As variáveis `VITE_` entram na compilação. Valores da hospedagem têm prioridade sobre o `.env` já existente. Não deixe URL nova junto com chave antiga. Não envie arquivos com segredos ao GitHub; `.env` atual contém apenas parâmetros públicos, mas não deve virar depósito de segredos.
6. Clique em **Deploy**. Após qualquer alteração de variável, faça **Redeploy**. Cadastre o endereço final nas URLs de autenticação da seção 2.
7. Verifique os logs caso falhe. Esta preparação não substitui um primeiro deploy e teste real na sua conta Vercel. O projeto usa Nitro beta fixado no lockfile; não atualize dependências durante a primeira migração.

### Alternativa Netlify

Em https://app.netlify.com importe o mesmo GitHub. `netlify.toml` define o comando, Node 22, `NITRO_PRESET=netlify` e a pasta pública `dist`. Cadastre as mesmas variáveis, trocando o preset para `netlify`. Nitro gera `.netlify/functions-internal` e as regras de servidor; não adicione um redirect SPA `/* /index.html 200`. Confira que funções foram publicadas, não somente HTML. Segredos precisam estar disponíveis às funções em runtime, não apenas à compilação.

## 5. Exportar dados atuais e importar com segurança

**O dono da conta precisa iniciar esta exportação. Nenhum dado de produção foi modificado aqui.**

1. Na Lovable, abra **More → Database → Manage → Settings**.
2. Em **Export project data**, clique em **Export data**. No cartão **Database**, escolha **Export → Start export**.
3. Baixe o arquivo pelo link enviado por e-mail ou em **More → Storage**. Se houver seletor Test/Live, escolha o ambiente com os dados reais que deseja migrar.
4. O arquivo inclui banco, estrutura, usuários e hashes de senha. Não inclui arquivos de Storage, segredos, código de funções ou configurações de login. Baixe arquivos de Storage separadamente em **More → Storage**; não publique o export no GitHub.
5. Limites documentados: banco até 15 GB, arquivo até 5 GB e uma exportação a cada 24 horas. O banco precisa estar em execução.
6. Restaure em um **projeto externo novo**, seguindo https://supabase.com/docs/guides/platform/migrating-within-supabase. O método depende do formato baixado: se for dump custom, use `pg_restore`; se for SQL, use `psql`. A restauração completa de Auth exige conexão administrativa ao destino e orientação técnica; não cole um dump completo no SQL Editor nem importe tudo como CSV.
7. Peça ajuda técnica para conferir conflitos com schemas gerenciados, ownership, roles e versões. Preserve IDs dos usuários de `auth.users` e IDs de catálogo/histórico/estoque: recriar contas com IDs novos quebra a associação dos dados. Hashes de senha estão no export, mas teste login após restaurar antes de prometer migração concluída.
8. Não misture migrations de banco vazio com restauração completa. Reconfigure provedores, e-mails e URLs; teste gatilho de cadastro, consentimento, RLS, funções de confirmação e cota mensal.
9. Faça uma exportação final e planeje uma janela sem novas gravações antes de trocar o domínio, para não perder alterações feitas entre cópia e troca. Mantenha a origem intacta até validar o destino.

## 6. Checklist antes de mudar o domínio

- Cadastro real com e-mail recebido e confirmado; login válido/inválido; Google; recuperação completa; sair e entrar novamente após recarregar.
- Duas contas: catálogo, estoque, perfil e histórico de uma não aparecem na outra.
- Uma foto real → alimentos em revisão → corrigir → confirmar → histórico e catálogo → recarregar. Resultado incerto nunca é salvo antes da confirmação.
- Conferir cota de 2 fotos/mês e bloqueio no terceiro envio. **Os logs `analises_foto` precisam migrar**, ou a cópia perde o consumo mensal anterior.
- Lista de compras, frequência e WhatsApp; preços continuam estimados, não ofertas verificadas.
- `/oferta` permanece estática e independente de login. Não há cobrança Stripe ou plano pago liberado.
- Verificar logs de servidor, funções e tempos máximos da hospedagem: análises podem demorar; ajuste limites compatíveis com o plano escolhido.

## Dependências que não são transferidas automaticamente

- O Lovable AI Gateway requer uma chave Lovable válida e créditos; para independência use sua chave Gemini. Não há garantia de IA gratuita ou reconhecimento sem erro.
- Mercados próximos continuam usando o conector Google Maps da Lovable quando configurado. Este pedido não migrou o conector. Sem essa configuração o app mantém a mensagem de indisponibilidade/fallback de localização; independência total dessa busca exige integração Maps direta futura.
- Os botões Google/Lovable atuais ficam preservados dentro da Lovable. No externo configure o modo e Google próprio conforme seção 2.
- Nenhuma exportação, restauração, configuração de provedor ou publicação Vercel/Netlify foi realizada pelo preparo de código. Esses testes externos ficam pendentes de suas contas e credenciais.

## O que só você pode autorizar/configurar

### Verificação desta preparação

- Compilação automática: OK. 16 testes passaram (provedor opcional, chave pública, resposta Gemini, cota e validações existentes).
- Preview com sessão autenticada: perfil e catálogo carregaram sem erro; histórico consultado e vazio; contador confirmou 1 de 2 fotos restantes. Nenhum erro de execução observado.
- Não enviei foto nova para não consumir a última foto mensal da conta. Análise real completa, gravação/recarga do histórico, Gemini direto e publicação externa ainda não foram verificados nesta preparação. Não confunda testes de seleção de provedor com teste real de reconhecimento.

1. **Supabase externo:** criar conta/projeto e guardar credenciais — https://supabase.com/dashboard.
2. **Google:** criar chave Gemini, OAuth e autorizar cobrança/cotas — https://aistudio.google.com/apikey e https://console.cloud.google.com.
3. **Vercel (ou Netlify):** criar conta, autorizar GitHub, configurar variáveis e publicar — https://vercel.com/new ou https://app.netlify.com.
4. **Lovable Cloud:** iniciar e baixar exportação pelo caminho da seção 5.
5. **Domínio/e-mail:** autorizar mudança de DNS e configurar remetente. Faça isso somente depois dos testes.