# Geladeira Inteligente — tarefas

## Pedido atual — autenticação profissional
- [x] Corrigir apresentação do login e completar cadastro com nome, termos, confirmação e recuperação de senha
- [x] Criar perfil protegido, sessão consistente e encerramento seguro
- [x] Preparar assinatura privada e validação legítima de acesso pago
- [x] Documentar integração comercial entre domínios sem simular pagamentos
- [x] Testar validações, login inválido, solicitação de recuperação, páginas privadas, permissões e celular
- [ ] Testar cadastro confirmado, duplicação, login válido, sessão, troca de senha e isolamento entre duas contas — bloqueado: não há conta confirmada nem caixa de e-mail de teste disponível
- [x] Ativar cobrança de teste (R$ 19,90/mês, 2 fotos), checkout, confirmação no servidor e gerenciamento da assinatura
- [ ] Testar uma compra de teste ponta a ponta — bloqueado: não há conta cadastrada para entrar
- [ ] Receber pagamentos reais — bloqueado: o dono precisa concluir a ativação na aba de Pagamentos
- [ ] Finalizar termos e privacidade — bloqueado: faltam identificação legal, contato e política de retenção do operador

## Pedido atual — catálogo e histórico
- [x] Criar catálogo privado e histórico de análises confirmadas, com segurança por conta
- [x] Integrar busca e edição do catálogo e consulta de relatórios anteriores
- [x] Validar regras de dados, acesso público e apresentação no computador/celular
- [ ] Validar salvamento e recarga com login — bloqueado: nenhuma conta criada; precisa de cadastro confirmado

- [x] Criar página estática de vendas do plano mensal em `/oferta`
- [ ] Reformular navegação e início mobile-first com resumo do produto
- [x] Criar revisão dos alimentos detectados antes de salvar
- [x] Permitir confirmar, editar, remover e adicionar itens detectados
- [x] Organizar resultados por categoria e sinalizar confiança
- [ ] Alimentar Minha geladeira e lista após confirmação sem perder dados
- [ ] Polir lista de compras, estados vazios, loading e erros
- [ ] Validar fluxos principais em desktop e iPhone
- [x] Atualizar o preview ao finalizar

## Pedido atual — limite mensal do plano pago
- [x] Manter o plano de R$ 19,90 limitado a 2 fotos por mês, sem reiniciar uso ao pagar
- [x] Atualizar oferta, assinatura, conta e confirmação e testar a regra de cota
