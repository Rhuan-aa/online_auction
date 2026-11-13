
ADR-002. Uso de Event Sourcing para a arquitetura de armazenamento do sistema.
 
## Status
Aceita.
 
# Contexto
No contexto de um leilão online, o qual usa uma Arquitetura Baseada em Eventos, devemos armazenar todo e qualquer lance para que seja possível ter uma rastreabilidade completa perante os eventos ocorridos. É necessário garantir que as ações realmente aconteceram e não foram alteradas, permitindo a recuperação de estados e consultas temporais. Também é necessário garantir consistência forte na gravação: dois lances simultâneos não podem ser aceitos sobre a mesma versão do leilão. O estado do leilão pode ser guardado como um registro atual, sobrescrito a cada alteração (CRUD), como um registro atual acompanhado de uma tabela de auditoria, ou derivado de uma sequência imutável de eventos (Event Sourcing). Nesse último caso, os eventos podem ser guardados em uma tabela no PostgreSQL ou no próprio Kafka.
 
# Decisão
Adotaremos o Event Sourcing, no qual o estado do leilão é persistido como uma sequência imutável de eventos, em vez de armazenar apenas o estado atual, e é reconstruído através de replay.
No modelo CRUD, o histórico se perde a cada UPDATE, o que impede a imutabilidade, a auditoria e o replay. Com uma tabela de auditoria ao lado, a auditoria passa a ser uma segunda cópia do estado, que pode divergir dele. No Event Sourcing existe uma única verdade: o próprio histórico de eventos.
Guardaremos os eventos em uma tabela append-only no PostgreSQL (Event Store), e não no Kafka. Cada evento é gravado com a versão do leilão, e a restrição UNIQUE(leilao_id, versao) faz com que, entre dois lances sobre a mesma versão, apenas um seja aceito. O Kafka não permite gravar um evento somente se a versão do leilão ainda for a esperada e, portanto, não impediria dois lances vencedores simultâneos.
O Event Store é a única fonte da verdade do sistema. Para evitar a reconstrução constante de todo o histórico de eventos, o estado calculado é guardado como cópia derivada (checkpoint e cache), conforme a ADR-003.
 
# Consequências
Benefícios:
Rastreabilidade e auditoria completas: como cada lance e alteração é um evento imutável, o histórico do leilão é 100% auditável.
Capacidade de Replay e Viagem no Tempo: é possível reconstruir o estado exato do sistema em qualquer ponto no tempo ou reprocessar eventos para corrigir falhas.
Concorrência segura: dois lances simultâneos nunca geram dois vencedores, sem a necessidade de locks no banco.
 
Trade-offs:
Custo de reconstrução: sem otimização, cada operação relê todos os eventos do leilão, e esse custo cresce com o número de lances. Ele é tratado pelo caching (ADR-003).
Complexidade arquitetural acrescida: as cópias derivadas do estado podem ficar atrás do Event Store. Por isso, toda cópia carrega a versão do leilão e nenhuma decisão de negócio depende delas.
Gerenciamento de Schema de Eventos: mudanças no formato dos eventos ao longo do tempo exigem estratégias de versionamento e migração de eventos.
 
# Conformidade
Um trigger no banco recusa UPDATE e DELETE na tabela de eventos, e o usuário do serviço de escrita só tem permissão de INSERT e SELECT sobre ela. Os checkpoints (ADR-003) ficam separados, com permissões próprias, pois podem ser apagados e refeitos. Um teste de integração dispara dois lances com a mesma versão e verifica que apenas um é aceito. O ArchUnit garante que o domínio (agregado Auction) não depende de Spring nem de JDBC.
 
# Notas
Autor: Rhuan. Aprovado por: Christian, Mariana e Nicolas. Última atualização: 12 de novembro de 2026. Relacionadas: ADR-001, ADR-003 e ADR-004.
 
 

