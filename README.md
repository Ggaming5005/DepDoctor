# depdoctor

Local dependency health toolkit with CLI and visual dashboard.

Install:
```bash
npm install
# or for dev usage
npm link
```

Start dashboard from the depdoctor folder (uses current folder as project root):
```bash
npx depdoctor serve --port 3000
# or after npm link:
depdoctor serve --port 3000
```

CLI examples:
```bash
npx depdoctor analyze --depcheck
npx depdoctor migrate
npx depdoctor badge --output README.md
```

Notes:
- Commander v14 requires Node 20+. If you need Node 18 compatibility, tell me and I'll adjust.
- Dashboard runs CLI under the hood using the folder where the server is started.
