# Sirius Wink

**Gestão inteligente de horas.** Aplicação local com React + TypeScript, API PHP 8.4 e SQLite persistido em volume Docker. Interface em português, sem cadastro público.

## Executar

Requisitos: Docker Desktop com engine Linux e Docker Compose.

```powershell
cd C:\workspace\sirius-wink
docker compose up -d --build
```

Abra **http://localhost:8080** neste computador ou **http://192.168.69.129:8080** em outro dispositivo da mesma rede local. O Docker publica a porta no loopback e no IP de rede configurado em `LAN_IP` (padrão `192.168.69.129`). Se o IP do computador mudar, atualize `LAN_IP` no `.env` e execute `docker compose up -d`.

Se o Windows bloquear o acesso de outros dispositivos, execute uma vez em um PowerShell **como administrador**. Esta regra permite somente conexões da sub-rede local para o IP indicado:

```powershell
New-NetFirewallRule -Name 'SiriusWink-8080-LAN' -DisplayName 'Sirius Wink - HTTP rede local 8080' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -LocalAddress 192.168.69.129 -RemoteAddress LocalSubnet -Profile Any
```

### Acesso inicial de desenvolvimento

| Campo | Valor |
| --- | --- |
| E-mail | `admin@sirius.local` |
| Senha | `SiriusWink@2026` |

Estas credenciais são exclusivamente para testes locais. Clique no perfil para alterar a senha. O administrador cria os demais acessos na página **Equipe**. O sistema não possui opção de cadastre-se.

Para personalizar o primeiro administrador ou a porta, copie `.env.example` para `.env` e ajuste antes da primeira inicialização. As variáveis `ADMIN_*` são usadas somente quando o banco ainda não tem usuários. Alterar o ambiente depois não redefine a senha existente.

```powershell
docker compose ps
docker compose logs -f app
docker compose down
```

`down` mantém os dados. Não utilize `down -v` a menos que deseje apagar todo o banco.

## Regras do sistema

- É obrigatório preencher pelo menos um dos campos: descrição, link Jira ou link Trello. Links devem ser URLs HTTP/HTTPS válidas. Os links são referências; não há sincronização com essas plataformas.
- Entrada e primeira saída são obrigatórias. Retorno e saída final são opcionais, preenchidos em conjunto. Cada saída deve ser posterior à sua entrada; retorno não pode anteceder a primeira saída. Os períodos são dentro de uma mesma data; trabalho que cruza a meia-noite deve ser separado em dois dias.
- Sobreposição é verificada por pessoa, por dia e pelos dois intervalos efetivos. Intervalos que apenas encostam são permitidos. Marcar **Extra** ou **Plantão**, caixas independentes, permite sobreposição. Se qualquer um dos registros estiver marcado, essa sobreposição é aceita. Essas horas entram no total; havendo sobreposição autorizada, o total soma os registros, não representa tempo de relógio único.
- **Colaborador:** visualiza somente seus registros; cadastra datas de 2000 a 2100; só edita/exclui seus lançamentos cuja data seja hoje, mantendo a data de hoje na edição. Não gerencia equipe ou calendário.
- **Administrador:** visualiza relatórios de todos, filtra por pessoa/período, exporta CSV, corrige/exclui registros em qualquer data e gerencia usuários, feriados e observações.
- **Feriado:** nenhum lançamento é aceito, inclusive de administradores, extras e plantões. Para marcar como feriado um dia que já possui lançamentos, primeiro remova ou transfira as horas. Observações sem feriado não bloqueiam horas. Feriados não são importados automaticamente: devem ser cadastrados pela administração.
- **Híbrido:** segunda e sexta são remotos; terça, quarta e quinta são presenciais. Sábado e domingo aparecem como fim de semana. A modalidade é calculada automaticamente pela data do lançamento.
- O dia atual e as permissões usam **America/Sao_Paulo**, calculado no servidor. O navegador atualiza essa referência periodicamente.
- Usuários são desativados em vez de excluídos, preservando referências e histórico. Sessões de pessoas desativadas perdem acesso imediatamente. O administrador não pode remover o próprio perfil administrativo ou se desativar.

## Estrutura e manutenção

```text
src/main.tsx          Aplicação React e navegação
src/components.tsx    Formulários e componentes da interface
src/lib.ts            Tipos, datas e cliente HTTP
src/styles.css       Estilos responsivos
backend/index.php    Rotas da API e autenticação
backend/bootstrap.php Banco, validações e permissões
docker/              Configuração Apache/PHP
tests/api.mjs        Testes de integração reais da API
compose.yaml         Serviço e volume local
Dockerfile           Build React e imagem PHP/Apache
```

O build de produção é servido pelo Apache junto com a API, na mesma origem. As rotas `/api/*` são processadas pelo PHP; as demais suportam o frontend React. O código PHP fica fora da raiz pública. Senhas são armazenadas com `password_hash`, sessões têm cookies HttpOnly/SameSite, mutações exigem token CSRF, login tem limite de tentativas, consultas usam parâmetros e exportações mitigam fórmulas CSV. Alterações de horas, usuários e calendário ficam na tabela `audit`, com autor, instante e valores anteriores/posteriores (sem senhas). Escritas de horários e calendário usam transações SQLite para prevenir conflitos entre requisições simultâneas.

O volume `sirius-wink_sirius-data` contém `/var/www/data/sirius.sqlite`. Para uma cópia consistente com o serviço ativo:

```powershell
docker compose exec app php -r '$db=new PDO("sqlite:/var/www/data/sirius.sqlite"); $db->exec("VACUUM INTO " . $db->quote("/var/www/data/backup.sqlite"));'
docker cp sirius-wink:/var/www/data/backup.sqlite ./backup.sqlite
```

Use um nome novo se o backup já existir. Para restaurar, pare o serviço e substitua o banco no volume por uma cópia consistente; não copie somente o arquivo principal enquanto há escritas, pois SQLite usa WAL.

### Desenvolvimento do frontend

Node.js 22 ou superior:

```powershell
npm ci
npm run dev
```

O Vite mostra a URL local e encaminha `/api` para o Docker na porta 8080. Após alterações PHP, reconstrua a imagem com `docker compose up -d --build`. Não há necessidade de instalar PHP na máquina.

### Verificação

```powershell
npm run build
npm run test:api
```

No Windows, a opção recomendada usa um contêiner temporário na porta 18081, com banco em memória, sem alterar os dados da instância principal:

```powershell
powershell -ExecutionPolicy Bypass -File tests/docker.ps1
```

Os testes exigem o Docker iniciado e usam as credenciais locais padrão (ou `TEST_ADMIN_EMAIL` e `TEST_ADMIN_PASSWORD`). **Execute em uma instância de desenvolvimento descartável.** Criam usuários de teste, horas e um feriado, verificam permissões, isolamento, conflitos, exceções, períodos, exportação e desativação. Os lançamentos e o feriado são removidos ao final; usuários de teste ficam inativos e a auditoria é preservada. `TEST_URL` permite apontar para outra instância.

O acesso HTTP pela rede local é destinado a testes. No Windows, o firewall deve permitir TCP na porta 8080 para a sub-rede local. Para produção, configure HTTPS, `COOKIE_SECURE=1`, credenciais próprias, backups e uma estratégia de recuperação. Ative cookies seguros somente ao usar HTTPS. SQLite facilita a operação em uma instância; avalie PostgreSQL se houver múltiplas réplicas ou alto volume de escritas.
