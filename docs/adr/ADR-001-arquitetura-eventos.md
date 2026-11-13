
ADR-001. Adoção de arquitetura baseada em eventos com broker.
 
## Status
Aceita. Data: 12/11/2026
 
# Contexto

Durante um leilão, cada novo lance precisa ser comunicado a diferentes partes do sistema, como os avisos de lances superados e o controle dos prazos de abertura e encerramento. Novas partes, como um antifraude, devem poder entrar depois, e cada parte deve realizar sua responsabilidade sem depender diretamente das outras. Isso pode ser feito por chamadas síncronas diretas entre as partes (REST), por eventos coordenados por um mediador, que conhece e conduz o fluxo, ou por eventos publicados em um broker, ao qual cada parte se inscreve.
 
# Decisão
Adotaremos uma arquitetura baseada em eventos com broker, responsável por receber, guardar e distribuir os acontecimentos do leilão, como o registro de um lance ou o seu encerramento, para que cada parte os utilize de forma independente e no seu próprio tempo.
O serviço de lances não precisa de nenhuma resposta de quem consome essas informações. Com chamadas síncronas, ele ficaria preso à disponibilidade de cada consumidor e precisaria conhecer todos eles, de modo que uma falha nas notificações impediria novos lances. O mediador concentraria o conhecimento de todo o fluxo em um componente central; ele é útil em processos com várias etapas e compensação, como pagamento e logística, que o sistema não possui. Com o broker, o serviço de lances apenas publica, e novos consumidores entram sem nenhuma alteração em quem publica.
Os acontecimentos de um mesmo leilão devem respeitar a ordem em que ocorreram, e o broker deve retê-los para que consumidores novos, ou que ficaram fora do ar, possam reler o histórico. Quem acompanha o leilão também deve receber as atualizações em tempo real, o que será feito por SSE, após a gravação do evento.
O broker retém os eventos por tempo limitado. O histórico completo está no Event Store (ADR-002).
 
# Consequências
Benefícios:
A arquitetura permite que os lances continuem sendo registrados mesmo quando as notificações ou o agendador estiverem indisponíveis, e facilita a inclusão de novas funcionalidades sem alterar quem publica os eventos. Além disso, o histórico dos eventos, guardado no Event Store, possibilita reconstruir as informações do leilão quando necessário.
 
Trade-offs:
As partes que consomem os eventos trabalham com consistência eventual, e a depuração fica mais difícil, pois um lance passa por vários componentes. Por isso, serão utilizados controle de eventos repetidos, um correlationId em todos os eventos e ferramentas para acompanhar o funcionamento do sistema.
 
# Conformidade
Para garantir que a arquitetura siga essa decisão, serão realizadas verificações automáticas (ArchUnit) durante a compilação e integração do código, impedindo dependências indevidas entre os serviços (por exemplo, o módulo de notificações não pode depender do serviço de escrita). A proteção do histórico contra alterações é feita no banco (ADR-002).
 
# Notas
Autor: Nícolas. Aprovado por: Christian, Mariana e Rhuan. Última atualização: 12 de novembro de 2026. Relacionadas: ADR-002 e ADR-004.