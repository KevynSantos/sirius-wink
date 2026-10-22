<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

try {
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $method = $_SERVER['REQUEST_METHOD'];
    if ($path === '/api/health') { db(); respond(['status'=>'ok']); }
    if ($path === '/api/session' && $method === 'GET') {
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
        $u = query('SELECT id,name,email,role,active FROM users WHERE id=?', [$_SESSION['user_id'] ?? 0])->fetch();
        respond(['user'=>($u && $u['active']) ? $u : null, 'csrf'=>$_SESSION['csrf'], 'today'=>date('Y-m-d')]);
    }
    if (!in_array($method, ['GET','HEAD'])) csrf();
    if ($path === '/api/login' && $method === 'POST') {
        $b = body(); $email = strtolower(str($b,'email',255)); $password = str($b,'password',256);
        $key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $email);
        $attempt = query('SELECT * FROM login_attempts WHERE key=?',[$key])->fetch();
        if ($attempt && $attempt['since'] > time()-900 && $attempt['attempts'] >= 10) fail('Muitas tentativas. Tente novamente em 15 minutos.',429);
        $u = query('SELECT * FROM users WHERE email=?',[$email])->fetch();
        if (!$u || !$u['active'] || !password_verify($password,$u['password'])) {
            query('INSERT INTO login_attempts(key,attempts,since) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN since<? THEN 1 ELSE attempts+1 END,since=CASE WHEN since<? THEN excluded.since ELSE since END',[$key,time(),time()-900,time()-900]);
            fail('E-mail ou senha inválidos.',401);
        }
        query('DELETE FROM login_attempts WHERE key=?',[$key]);
        session_regenerate_id(true); $_SESSION['user_id'] = $u['id']; $_SESSION['csrf'] = bin2hex(random_bytes(32));
        unset($u['password']); respond(['user'=>$u,'csrf'=>$_SESSION['csrf'],'today'=>date('Y-m-d')]);
    }
    $actor = user();
    if ($path === '/api/logout' && $method === 'POST') { $_SESSION=[]; session_destroy(); respond(['ok'=>true]); }
    if ($path === '/api/password' && $method === 'PUT') {
        $b=body(); $current=str($b,'current',256); $password=str($b,'password',256);
        if (!password_verify($current, query('SELECT password FROM users WHERE id=?',[$actor['id']])->fetchColumn())) fail('A senha atual não confere.');
        if (strlen($password)<10) fail('A nova senha deve ter pelo menos 10 caracteres.');
        query('UPDATE users SET password=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$actor['id']]);
        session_regenerate_id(true); respond(['ok'=>true]);
    }
    if ($path === '/api/entries' && $method === 'GET') {
        $from=validDate($_GET['from'] ?? date('Y-m-01')); $to=validDate($_GET['to'] ?? date('Y-m-t'));
        if ($from>$to) fail('O início do período deve ser anterior ao fim.');
        $uid=$actor['role']==='admin' ? (int)($_GET['user_id'] ?? 0) : (int)$actor['id'];
        $sql='SELECT e.*,u.name AS user_name FROM entries e JOIN users u ON u.id=e.user_id WHERE date BETWEEN ? AND ?'; $params=[$from,$to];
        if ($uid) { $sql.=' AND user_id=?'; $params[]=$uid; }
        $rows=array_map('enrich', query($sql.' ORDER BY date DESC,start DESC,id DESC',$params)->fetchAll());
        if (($_GET['format'] ?? '')==='csv') {
            header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="sirius-wink-relatorio.csv"'); header('Cache-Control: no-store');
            $out=fopen('php://output','w'); fwrite($out,"\xEF\xBB\xBF");
            fputcsv($out,['Pessoa','Data','Descrição','Jira','Trello','Entrada','Saída','Retorno','Saída final','Minutos','Modalidade','Extra','Plantão'],';', '"', '');
            foreach($rows as $r) { $cells=[$r['user_name'],$r['date'],$r['description'],$r['jira_url'],$r['trello_url'],$r['start'],$r['end'],$r['return_time'],$r['final_end'],$r['minutes'],$r['mode'],$r['extra']?'Sim':'Não',$r['on_call']?'Sim':'Não'];
                $cells=array_map(fn($v)=>is_string($v) && preg_match('/^[\s]*[=+@\-]/u',$v) ? "'".$v : $v,$cells); fputcsv($out,$cells,';', '"', ''); }
            fclose($out); exit;
        }
        respond($rows);
    }
    if (preg_match('#^/api/entries(?:/(\d+))?$#',$path,$m) && in_array($method,['POST','PUT','DELETE'])) {
        $id=(int)($m[1]??0); db()->exec('BEGIN IMMEDIATE');
        $old=$id ? query('SELECT * FROM entries WHERE id=?',[$id])->fetch() : null;
        if (($method !== 'POST' && !$old) || ($method === 'POST' && $id)) fail('Lançamento não encontrado.',404);
        if ($method==='DELETE') { editable($actor,$old); query('DELETE FROM entries WHERE id=?',[$id]); audit($actor,'delete','entry',$id,$old,null); }
        else {
            $e=validateEntry(body(),$actor,$old); $e['updated_at']=date(DATE_ATOM);
            if ($old) { $sets=implode(',',array_map(fn($k)=>$k.'=?',array_keys($e))); query('UPDATE entries SET '.$sets.' WHERE id=?',[...array_values($e),$id]); }
            else { $e['created_at']=date(DATE_ATOM); query('INSERT INTO entries('.implode(',',array_keys($e)).') VALUES('.implode(',',array_fill(0,count($e),'?')).')',array_values($e)); $id=(int)db()->lastInsertId(); }
            audit($actor,$old?'update':'create','entry',$id,$old,$e);
        }
        db()->exec('COMMIT'); respond(['id'=>$id],$method==='POST'?201:200);
    }
    if ($path==='/api/calendar' && $method==='GET') {
        $from=validDate($_GET['from']??date('Y-01-01')); $to=validDate($_GET['to']??date('Y-12-31'));
        respond(query('SELECT * FROM calendar WHERE date BETWEEN ? AND ? ORDER BY date',[$from,$to])->fetchAll());
    }
    if (preg_match('#^/api/calendar/(\d{4}-\d{2}-\d{2})$#',$path,$m) && in_array($method,['PUT','DELETE'])) {
        admin($actor); $date=validDate($m[1]); db()->exec('BEGIN IMMEDIATE');
        $old=query('SELECT * FROM calendar WHERE date=?',[$date])->fetch();
        if ($method==='DELETE') { query('DELETE FROM calendar WHERE date=?',[$date]); $e=null; }
        else { $b=body(); $e=['date'=>$date,'title'=>str($b,'title',150),'note'=>str($b,'note',4000),'holiday'=>flag($b,'holiday')];
            if (!$e['title']) fail('Informe um título para o dia.');
            if ($e['holiday'] && query('SELECT id FROM entries WHERE date=? LIMIT 1',[$date])->fetch()) fail('Existem lançamentos neste dia. Remova ou transfira os lançamentos antes de marcar o feriado.');
            query('INSERT INTO calendar(date,title,note,holiday) VALUES(?,?,?,?) ON CONFLICT(date) DO UPDATE SET title=excluded.title,note=excluded.note,holiday=excluded.holiday',array_values($e)); }
        audit($actor,$method==='DELETE'?'delete':'save','calendar',$date,$old,$e); db()->exec('COMMIT'); respond(['ok'=>true]);
    }
    if ($path==='/api/users' && $method==='GET') { admin($actor); respond(query('SELECT id,name,email,role,active FROM users ORDER BY name')->fetchAll()); }
    if (preg_match('#^/api/users(?:/(\d+))?$#',$path,$m) && in_array($method,['POST','PUT'])) {
        admin($actor); $id=(int)($m[1]??0); $b=body();
        $name=str($b,'name',150); $email=strtolower(str($b,'email',255)); $role=str($b,'role',5); $active=flag($b,'active'); $password=str($b,'password',256);
        if (!$name || !filter_var($email,FILTER_VALIDATE_EMAIL) || !in_array($role,['admin','user'])) fail('Preencha nome, e-mail válido e perfil.');
        if ((!$id || $password) && strlen($password)<10) fail('A senha deve ter pelo menos 10 caracteres.');
        db()->exec('BEGIN IMMEDIATE'); $old=$id ? query('SELECT id,name,email,role,active FROM users WHERE id=?',[$id])->fetch() : null;
        if ($method==='PUT' && !$old) fail('Usuário não encontrado.',404);
        if ($method==='POST' && $id) fail('Rota inválida.',404);
        if ($id===$actor['id'] && (!$active || $role!=='admin')) fail('Você não pode desativar ou remover seu próprio acesso administrativo.');
        if (query('SELECT id FROM users WHERE email=? AND id<>?',[$email,$id])->fetch()) fail('Este e-mail já está cadastrado.');
        if ($id) { query('UPDATE users SET name=?,email=?,role=?,active=? WHERE id=?',[$name,$email,$role,$active,$id]); if ($password) query('UPDATE users SET password=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$id]); }
        else { query('INSERT INTO users(name,email,role,active,password) VALUES(?,?,?,?,?)',[$name,$email,$role,$active,password_hash($password,PASSWORD_DEFAULT)]); $id=(int)db()->lastInsertId(); }
        audit($actor,$old?'update':'create','user',$id,$old,['name'=>$name,'email'=>$email,'role'=>$role,'active'=>$active]); db()->exec('COMMIT'); respond(['id'=>$id],$method==='POST'?201:200);
    }
    fail('Recurso não encontrado.',404);
} catch (Throwable $e) {
    try { db()->exec('ROLLBACK'); } catch (Throwable) {}
    error_log((string)$e); respond(['error'=>'Não foi possível concluir a operação. Tente novamente.'],500);
}
