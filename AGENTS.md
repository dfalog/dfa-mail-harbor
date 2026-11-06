<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- IMAP/SMTP lives in the separate Node server `mail-server/` (imapflow, nodemailer, mailparser); the Lovable frontend only calls it via `VITE_MAIL_API_URL`. Why: edge workers can't hold IMAP connections.
- Mail passwords never reach the browser: the server keeps them AES-GCM encrypted in memory behind an opaque session token.
