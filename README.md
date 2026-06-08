# smile 2032

A small personal website with a simple local backend.

## How to view it

Run this once from the project folder:

```bash
node server.js
```

Then open:

```text
http://localhost:3000
```

(When we set up the live version, you'll also get a public link anyone can visit.)

## The files

- `index.html` - the content and structure of the page (the words, sections, buttons).
- `styles.css` - how it looks (colors, fonts, spacing, layout).
- `server.js` - the local backend. It serves the website and saves contact form messages.
- `README.md` - this file.

Look for `EDIT:` comments inside `index.html`. They point to the spots you'll most likely want to change.

## Contact form messages

When someone submits the contact form locally, messages are saved in:

```text
data/messages.jsonl
```

That file is ignored by Git so private messages do not get uploaded to GitHub.

## Working together (the everyday rhythm)

We use Git and GitHub so two people can work without overwriting each other. The normal loop:

1. **Get the latest:** `git pull`
2. **Start your own copy of the change:** `git checkout -b my-change` (a "branch")
3. Make your edits, then save them: `git add -A` then `git commit -m "what I changed"`
4. **Send it up:** `git push -u origin my-change`
5. On GitHub, open a **Pull Request** so the other person can see and approve it.
6. Merge it in. Done.

Don't worry about memorizing this. We'll go through it together the first few times.

## Next steps

- [ ] Put the project on GitHub
- [ ] Add your partner as a collaborator
- [ ] Deploy it so it has a real web address
- [ ] Replace the placeholder words and emojis with the real thing
- [ ] (Optional) connect a custom domain name
