# Youtarr on Unraid

Unraid has not yet been accepted into the Community Templates store, but has been validated as working on Unraid


## Deploying on Unraid

- Install the Community Applications plugin (if you have not already), then add the template repo URL `https://github.com/DialmasterOrg/unraid-templates` under **Apps → Settings → Manage Template Repositories**.
- Setup your MariaDB instance. See [docs/EXTERNAL_DB.md](./EXTERNAL_DB.md) for more information about external DB setup since this uses a DB instance that is not directly bundled with Youtarr.
  - The MariaDB Official docker container will work fine for this purpose.
- Search for **Youtarr** under the Apps tab and launch the template. The XML lives at `https://github.com/DialmasterOrg/unraid-templates/blob/main/Youtarr/Youtarr.xml` for reference.
- Ensure that your MariaDB instance is setup with a database name, user and password matching what you set in the Youtarr configuration
- **Note** Until the template is accepted into the main Community Applications feed, it is available directly from the repostory above.
- Map your persistent paths (for example `/mnt/user/appdata/youtarr/config` for `/app/config` and `/mnt/user/media/youtube` for `/data`) and supply the MariaDB connection variables before deploying.
- Set both `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` to set credentials for login to Youtarr
  Leaving them blank requires completing the setup wizard from the Unraid host's localhost (e.g., via SSH port forwarding), which most headless installs won't have handy.
