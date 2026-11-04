# DFA Mail — servidor de e-mail

Backend Node.js que conecta o DFA Mail às contas da Hostinger usando bibliotecas maduras:
**imapflow** (IMAP), **nodemailer** (SMTP) e **mailparser** (MIME/anexos).

Por que separado: o site no Lovable roda em ambiente edge, que não mantém conexões IMAP longas.
Este servidor roda em qualquer VPS com Node 20+ (ex.: VPS Hostinger).

## Segurança
- A senha só trafega no login (HTTPS) e é validada diretamente no IMAP da Hostinger.
- No servidor fica cifrada com AES-256-GCM, só em memória; o navegador recebe apenas um token opaco.
- Cada requisição abre conexão com as credenciais do próprio usuário → isolamento total entre contas.
- Login limitado a domínios em `ALLOWED_DOMAINS` e com limite de tentativas.

## Instalação (VPS)
```bash
cd mail-server
npm install
cp .env.example .env   # preencha SESSION_SECRET com: openssl rand -hex 32
npm install -g pm2 && pm2 start src/index.js --name dfa-mail && pm2 save
```

## Domínios / DNS (painel Hostinger → DNS)
- `mail.dfalog.com.br` → frontend (conecte o domínio no Lovable: Configurações → Domínios; ele mostra os registros A/TXT).
  Atenção: se `mail.dfalog.com.br` já for usado pelo e-mail da Hostinger, use outro, ex. `webmail.dfalog.com.br`.
- `api-mail.dfalog.com.br` → registro **A** para o IP da VPS.

## HTTPS (Nginx + Certbot)
```nginx
server {
  server_name api-mail.dfalog.com.br;
  client_max_body_size 30m;
  location / { proxy_pass http://127.0.0.1:4000; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header Host $host; }
}
```
`sudo certbot --nginx -d api-mail.dfalog.com.br`

## Frontend
Defina `VITE_MAIL_API_URL=https://api-mail.dfalog.com.br` no projeto Lovable.

## Endpoints
`POST /auth/login`, `POST /auth/logout`, `GET /folders`, `POST|DELETE /folders`, `GET /messages?folder&q&page`,
`GET /messages/:uid`, `GET /messages/:uid/attachments/:i`, `POST /messages/action`, `POST /send` (multipart).
