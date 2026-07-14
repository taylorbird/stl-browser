# Multiple GitHub Accounts via SSH

~/.ssh/config has `github.com-personal` alias pointing to github.com with the personal SSH key. Use this as the git remote host when pushing to the taylorbird account:

```
git remote add origin git@github.com-personal:taylorbird/stl-browser.git
```

The `gh` CLI is authenticated as taylorbirdbumphealth (work account) and cannot create repos under taylorbird. Use SSH git push or create repos manually on github.com for the personal account.
