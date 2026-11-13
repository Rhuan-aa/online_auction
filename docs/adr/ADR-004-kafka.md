ADR-004. Uso do Apache Kafka como broker de eventos.
 
## Status
Aceita.
 
# Contexto
Em uma aplicação de leilão em tempo real, os eventos do ciclo de vida do leilão enfrentam desafios críticos, principalmente nos momentos finais de encerramento de um lote ("efeito sniping"):
• Picos extremos de tráfego: centenas ou milhares de usuários enviam lances simultaneamente nos últimos segundos do leilão.
• Ordenação estrita: a ordem em que os eventos de um mesmo leilão são entregues determina o que cada consumidor enxerga, como quem está vencendo e quando o prazo foi estendido.
• Múltiplos consumidores (Fan-out): um lance aceito precisa disparar diversas ações independentes, como avisar quem foi superado, ajustar o prazo de encerramento e, no futuro, alimentar métricas de antifraude.
• Reprocessamento: consumidores novos ou que falharam precisam conseguir reler os eventos.
Esses eventos podem ser distribuídos por um broker de filas, como o RabbitMQ ou o SQS, ou por um log distribuído e retido, como o Apache Kafka.
 
# Decisão
Adotaremos o Apache Kafka como broker para os eventos do ciclo de vida do leilão (tópico auction.events) e para os comandos do agendador (tópico auction.commands.timer).
As justificativas para essa decisão:
• Log Imutável e Retenção: os tópicos manterão os eventos persistidos em disco, permitindo que consumidores releiam o histórico recente. O RabbitMQ apaga as mensagens após o consumo, o que impediria o replay. A retenção é limitada, então o histórico completo vem do Event Store (ADR-002).
• Particionamento por ID do Leilão: todos os eventos serão publicados utilizando o ID do leilão como chave da mensagem. Isso garante que todos os eventos de um mesmo leilão caiam na mesma partição e sejam entregues em ordem estrita (FIFO), enquanto leilões diferentes escalam paralelamente em outras partições. No RabbitMQ, manter a ordem por leilão com múltiplos consumidores exigiria topologias muito mais complexas.
• Grupos de Consumidores Independentes: o agendador de leilões, o serviço de notificações e, futuramente, um antifraude lerão os tópicos de forma isolada e assíncrona, cada um no seu ritmo.
A fonte da verdade continua sendo o Event Store no PostgreSQL (ADR-002). Os eventos chegam ao Kafka pelo padrão outbox, gravado na mesma transação que o evento, para que nenhum evento seja publicado sem estar gravado.
 
# Consequências
Benefícios:
• Garantia de Ordem: o particionamento pelo ID do leilão garante que cada consumidor receba os eventos de um leilão na ordem em que foram gravados. A disputa entre lances simultâneos é resolvida antes, no Event Store, pela versão do leilão.
• Proteção da escrita nos picos: consumidores lentos, como as notificações, não atrasam o registro dos lances.
• Replay: o histórico retido permite reprocessar eventos em caso de falhas em serviços secundários e incluir consumidores novos, dentro do período de retenção.
• Desacoplamento: novos recursos (como detecção de fraude em tempo real ou dashboards analíticos) podem ser adicionados sem impactar a latência do envio de lances.
 
Trade-offs:
• Consistência Eventual nos consumidores: as notificações e o agendador recebem os eventos depois do commit. O lance em si é validado e confirmado de forma síncrona pelo serviço de escrita.
• Complexidade Operacional: exige monitoramento rigoroso de consumer lag (atraso no consumo), pois um atraso do agendador nos segundos finais pode atrasar o encerramento do leilão.
• Idempotência Obrigatória: a entrega é "pelo menos uma vez", então os consumidores precisam garantir que reprocessamentos ou falhas de rede não dupliquem notificações ou comandos de encerramento.
 
# Conformidade
Os testes das notificações e do agendador verificam que um evento repetido não gera aviso nem comando em duplicidade. Na Kafka UI, confere-se que os eventos de um mesmo leilão ficam na mesma partição, na ordem de gravação, e acompanha-se o atraso de cada consumidor.
 
# Notas
Autor: Christian. Aprovado por: Mariana, Nicolas e Rhuan. Última atualização: 12 de novembro de 2026. Relacionadas: ADR-001 e ADR-002.
 