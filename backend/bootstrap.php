<?php
declare(strict_types=1);
date_default_timezone_set('America/Sao_Paulo');
session_name('sirius_session');
session_set_cookie_params(['httponly' => true, 'secure' => getenv('COOKIE_SECURE') === '1', 'samesite' => 'Strict', 'path' => '/']);
session_start();

function db(): PDO {
    static $db;
    if ($db) return $db;
    $db = new PDO('sqlite:/var/www/data/sirius.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','user')), active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), date TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '', jira_url TEXT NOT NULL DEFAULT '', trello_url TEXT NOT NULL DEFAULT '',
        start TEXT NOT NULL, end TEXT NOT NULL, return_time TEXT, final_end TEXT,
        extra INTEGER NOT NULL DEFAULT 0, on_call INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS entries_user_date ON entries(user_id,date);
    CREATE TABLE IF NOT EXISTS calendar (
        date TEXT PRIMARY KEY, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', holiday INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY, actor_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL,
        entity TEXT NOT NULL, entity_id TEXT NOT NULL, before_json TEXT, after_json TEXT, at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, since INTEGER NOT NULL);");
    // SQLite serializes initialization across Apache workers.
    $db->exec('BEGIN IMMEDIATE');
    try {
        if (!$db->query('SELECT COUNT(*) FROM users')->fetchColumn()) {
            $q = $db->prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)');
            $q->execute([getenv('ADMIN_NAME') ?: 'Administrador', getenv('ADMIN_EMAIL') ?: 'admin@sirius.local', password_hash(getenv('ADMIN_PASSWORD') ?: 'SiriusWink@2026', PASSWORD_DEFAULT), 'admin']);
        }
        $db->exec('COMMIT');
    } catch (Throwable $e) { $db->exec('ROLLBACK'); throw $e; }
    return $db;
}
function query(string $sql, array $params = []): PDOStatement { $q = db()->prepare($sql); $q->execute($params); return $q; }
function respond(mixed $data, int $code = 200): never { http_response_code($code); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); exit; }
function fail(string $message, int $code = 422): never { respond(['error' => $message], $code); }
function body(): array { $raw = file_get_contents('php://input'); if (strlen($raw) > 32768) fail('Requisição muito grande.', 413); try { $value = json_decode($raw, true, 32, JSON_THROW_ON_ERROR); } catch (JsonException) { fail('JSON inválido.', 400); } if (!is_array($value)) fail('Dados inválidos.'); return $value; }
function user(): array {
    $u = query('SELECT id,name,email,role,active FROM users WHERE id=?', [$_SESSION['user_id'] ?? 0])->fetch();
    if (!$u || !$u['active']) fail('Entre na sua conta para continuar.', 401);
    return $u;
}
function admin(array $u): void { if ($u['role'] !== 'admin') fail('Acesso exclusivo de administradores.', 403); }
function csrf(): void { if (!hash_equals($_SESSION['csrf'] ?? 'missing', $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) fail('Sessão inválida. Atualize a página.', 403); }
function validDate(mixed $date): string {
    if (!is_string($date)) fail('Informe uma data válida.');
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$d || $d->format('Y-m-d') !== $date || $date < '2000-01-01' || $date > '2100-12-31') fail('Informe uma data válida entre 2000 e 2100.');
    return $date;
}
function str(array $data, string $key, int $max = 2000): string { $value = $data[$key] ?? ''; if (!is_string($value) || strlen($value) > $max) fail('Campo inválido: ' . $key); return trim($value); }
function flag(array $data, string $key): int { return !empty($data[$key]) ? 1 : 0; }
function mode(string $date): string { return match ((int)(new DateTimeImmutable($date))->format('N')) { 1,5 => 'Remoto', 2,3,4 => 'Presencial', default => 'Fim de semana' }; }
function minutes(string $time): int { [$h,$m] = array_map('intval', explode(':', $time)); return $h*60+$m; }
function intervals(array $e): array { $i = [[minutes($e['start']), minutes($e['end'])]]; if ($e['return_time']) $i[] = [minutes($e['return_time']), minutes($e['final_end'])]; return $i; }
function enrich(array $e): array { $e['minutes'] = array_sum(array_map(fn($i) => $i[1]-$i[0], intervals($e))); $e['mode'] = mode($e['date']); return $e; }
function audit(array $actor, string $action, string $entity, mixed $id, mixed $before, mixed $after): void {
    query('INSERT INTO audit(actor_id,action,entity,entity_id,before_json,after_json,at) VALUES(?,?,?,?,?,?,?)', [$actor['id'],$action,$entity,(string)$id,json_encode($before),json_encode($after),date(DATE_ATOM)]);
}
function editable(array $actor, array $entry): void { if ($actor['role'] !== 'admin' && ((int)$entry['user_id'] !== (int)$actor['id'] || $entry['date'] !== date('Y-m-d'))) fail('Você só pode alterar seus próprios lançamentos do dia atual.', 403); }
function validateEntry(array $b, array $actor, ?array $old): array {
    if ($old) editable($actor, $old);
    $date = validDate($b['date'] ?? null);
    if ($old && $actor['role'] !== 'admin' && $date !== date('Y-m-d')) fail('Usuários comuns só podem alterar lançamentos mantendo a data de hoje.', 403);
    $uid = $actor['role'] === 'admin' ? (int)($b['user_id'] ?? $actor['id']) : (int)$actor['id'];
    $target = query('SELECT id,active FROM users WHERE id=?', [$uid])->fetch();
    if (!$target || (!$target['active'] && (!$old || (int)$old['user_id'] !== $uid))) fail('Selecione um usuário ativo.');
    if (query('SELECT date FROM calendar WHERE date=? AND holiday=1', [$date])->fetch()) fail('Este dia é feriado. Lançamentos de horas estão bloqueados.');
    $e = ['user_id'=>$uid,'date'=>$date,'description'=>str($b,'description',4000),'jira_url'=>str($b,'jira_url'),'trello_url'=>str($b,'trello_url')];
    if (!$e['description'] && !$e['jira_url'] && !$e['trello_url']) fail('Preencha a descrição, o link da issue do Jira ou o link do card do Trello.');
    foreach (['jira_url','trello_url'] as $k) if ($e[$k] && (!filter_var($e[$k], FILTER_VALIDATE_URL) || !in_array(strtolower(parse_url($e[$k], PHP_URL_SCHEME) ?: ''), ['http','https']))) fail('Informe links válidos começando com http:// ou https://.');
    foreach (['start','end','return_time','final_end'] as $k) {
        $v = str($b,$k,5);
        if (($k === 'start' || $k === 'end' || $v !== '') && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $v)) fail('Informe horários válidos no formato HH:MM.');
        $e[$k] = $v === '' ? null : $v;
    }
    if ($e['start'] >= $e['end']) fail('A saída deve ser posterior à entrada.');
    if ((bool)$e['return_time'] !== (bool)$e['final_end']) fail('Preencha o retorno e a segunda saída juntos.');
    if ($e['return_time'] && ($e['return_time'] < $e['end'] || $e['final_end'] <= $e['return_time'])) fail('O retorno deve ser igual ou posterior à primeira saída, e a última saída deve ser posterior ao retorno.');
    $e['extra'] = flag($b,'extra'); $e['on_call'] = flag($b,'on_call');
    if (!$e['extra'] && !$e['on_call']) {
        $others = query('SELECT * FROM entries WHERE user_id=? AND date=? AND id<>? AND extra=0 AND on_call=0', [$uid,$date,$old['id'] ?? 0])->fetchAll();
        foreach ($others as $other) foreach (intervals($e) as [$a,$b]) foreach (intervals($other) as [$c,$d]) if ($a < $d && $c < $b) fail('Este horário se sobrepõe a outro lançamento. Confira os intervalos ou marque Extra/Plantão quando aplicável.');
    }
    return $e;
}
